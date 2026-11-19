"""dx: one CLI for every repo, with or without Nx/moon.

dx new-service <name> [--with-example] [--with-saas]  create a service (monorepo) / initialise the repo service (polyrepo)
dx new-module <service> <name>           create a feature module (router/schemas/service/repository/...)
dx new-saas <service>                    install identity + billing SaaS spine modules into a service
    dx check [paths...] [--format github]    structure, RBAC, layering, error/logging rules
    dx watch                                 re-run `dx check` on save (VS Code/Cursor Problems panel)
    dx lint [--service s] [--fix]            ruff + format + pyright + dx check
    dx fmt                                   ruff format + autofix
    dx test [--service s] [--cov]            pytest per service (isolated processes) + kit tests
    dx run <service> [--port] [--no-reload]  uvicorn with reload
    dx up / down / logs                      docker compose for infra + all services
    dx db upgrade|revision <service> [-m]    alembic per service
    dx affected [--base ref] [--json]        services changed since base (CI matrix)
    dx openapi <service> [-o file]           export OpenAPI spec (contract checks)
    dx permissions <service>                 RBAC matrix: method, path, permission
    dx token <service> [--perm p | --all]    dev-only JWT for manual / schemathesis testing
    dx rules                                 list every rule code with its explanation
    dx hook claude-pre|claude-post           Claude Code hooks (reads JSON on stdin)
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

from platform_kit.cli.checks import RULES, run_checks
from platform_kit.cli.config import DxConfig, Service, load_config

PY = sys.executable


def _run(cmd: list[str], *, cwd: Path | None = None, env: dict[str, str] | None = None) -> int:
    print("$ " + " ".join(cmd), flush=True)
    return subprocess.run(cmd, cwd=cwd, env={**os.environ, **(env or {})}, check=False).returncode


def _services(cfg: DxConfig, name: str | None) -> list[Service]:
    return [cfg.get_service(name)] if name else cfg.services()


def _lint_paths(cfg: DxConfig, service: str | None) -> list[str]:
    if service:
        svc = cfg.get_service(service)
        return [str(svc.src), str(svc.tests)]
    return [str(cfg.root)]


# ── commands ─────────────────────────────────────────────────────────────────
def cmd_check(cfg: DxConfig, args: argparse.Namespace) -> int:
    paths = [Path(p) for p in args.paths] if args.paths else None
    violations = run_checks(cfg, paths, args.service)
    for v in violations:
        print(v.github() if args.format == "github" else str(v))
    if violations:
        print(f"\ndx: {len(violations)} problem(s). `dx rules` explains each code.", file=sys.stderr)
    return 1 if violations else 0


def cmd_watch(cfg: DxConfig, args: argparse.Namespace) -> int:
    roots = [s.src for s in cfg.services()]

    def once() -> None:
        print("dx-watch: start", flush=True)
        for v in run_checks(cfg):
            print(v, flush=True)
        print("dx-watch: done", flush=True)

    once()
    try:
        from watchfiles import watch  # installed with uvicorn[standard]

        for _ in watch(*roots, watch_filter=lambda _c, p: p.endswith(".py")):
            once()
    except ImportError:
        stamp = 0.0
        while True:
            newest = max((p.stat().st_mtime for r in roots for p in r.rglob("*.py")), default=0.0)
            if newest > stamp:
                stamp = newest
                once()
            time.sleep(1)
    return 0


def cmd_lint(cfg: DxConfig, args: argparse.Namespace) -> int:
    paths = _lint_paths(cfg, args.service)
    fix = ["--fix"] if args.fix else []
    codes = [
        _run([PY, "-m", "ruff", "check", *fix, *paths]),
        _run([PY, "-m", "ruff", "format", *([] if args.fix else ["--check"]), *paths]),
        _run(["pyright", *paths]) if shutil.which("pyright") else _run([PY, "-m", "pyright", *paths]),
        cmd_check(cfg, argparse.Namespace(paths=None, service=args.service, format="text")),
    ]
    return 1 if any(codes) else 0


def cmd_fmt(cfg: DxConfig, args: argparse.Namespace) -> int:
    return _run([PY, "-m", "ruff", "format", str(cfg.root)]) or _run([PY, "-m", "ruff", "check", "--fix", str(cfg.root)])


def cmd_test(cfg: DxConfig, args: argparse.Namespace) -> int:
    failed = []
    extra = list(args.pytest_args or [])
    for svc in _services(cfg, args.service):
        cov = [f"--cov={svc.package}", "--cov-report=term-missing", f"--cov-report=xml:{cfg.root}/coverage-{svc.name}.xml"] if args.cov else []
        if _run([PY, "-m", "pytest", str(svc.tests), *cov, *extra], cwd=svc.path):
            failed.append(svc.name)
    kit_tests = cfg.root / "packages" / "platform-kit" / "tests"
    if not args.service and kit_tests.is_dir() and _run([PY, "-m", "pytest", str(kit_tests), *extra]):
        failed.append("platform-kit")
    if failed:
        print(f"dx: tests failed for: {', '.join(failed)}", file=sys.stderr)
    return 1 if failed else 0


def _port(svc: Service) -> int:
    import re

    compose = svc.path / "compose.service.yaml"
    m = re.search(r'"(\d+):8000"', compose.read_text(encoding="utf-8")) if compose.exists() else None
    return int(m.group(1)) if m else 8000


def cmd_run(cfg: DxConfig, args: argparse.Namespace) -> int:
    svc = cfg.get_service(args.service)
    cmd = [PY, "-m", "uvicorn", f"{svc.package}.main:app", "--port", str(args.port or _port(svc)), "--no-access-log"]
    if not args.no_reload:
        cmd += ["--reload", "--reload-dir", str(svc.src)]
        cmd += ["--reload-dir", str(p)] if (p := cfg.root / "packages").is_dir() else []
    return _run(cmd, cwd=svc.path)


def _compose_files(cfg: DxConfig) -> list[str]:
    files = ["-f", str(cfg.root / "compose.yaml")]
    for svc in cfg.services():
        if (f := svc.path / "compose.service.yaml").exists():
            files += ["-f", str(f)]
    return files


def cmd_compose(cfg: DxConfig, args: argparse.Namespace) -> int:
    base = ["docker", "compose", "--project-directory", str(cfg.root), *_compose_files(cfg)]
    if args.command == "up":
        profiles = ["--profile", "observability"] if args.observability else []
        return _run([*base[:2], *profiles, *base[2:], "up", "--build", "-d", *args.only])
    if args.command == "down":
        return _run([*base, "down", *(["-v"] if args.volumes else [])])
    return _run([*base, "logs", "-f", *args.only])


def cmd_db(cfg: DxConfig, args: argparse.Namespace) -> int:
    svc = cfg.get_service(args.service)
    alembic = [PY, "-m", "alembic", "-c", str(svc.path / "alembic.ini")]
    if args.action == "upgrade":
        return _run([*alembic, "upgrade", args.revision or "head"], cwd=svc.path)
    if args.action == "downgrade":
        return _run([*alembic, "downgrade", args.revision or "-1"], cwd=svc.path)
    if not args.message:
        raise SystemExit("dx: `dx db revision` needs -m 'what changed'")
    return _run([*alembic, "revision", "--autogenerate", "-m", args.message], cwd=svc.path)


def cmd_affected(cfg: DxConfig, args: argparse.Namespace) -> int:
    services = cfg.services()
    if cfg.layout == "polyrepo_service":
        names = [s.name for s in services]
    else:
        out = subprocess.run(
            ["git", "diff", "--name-only", f"{args.base}...HEAD"],
            cwd=cfg.root,
            capture_output=True,
            text=True,
            check=False,
        )
        # unknown base (first commit, shallow clone): be safe, test everything
        changed = (
            ["pyproject.toml"] if out.returncode != 0 else [line for line in out.stdout.splitlines() if line]
        )
        shared_prefixes = ("packages/", "pyproject.toml", "uv.lock", ".github/", "compose.yaml")
        if any(c.startswith(shared_prefixes) for c in changed):
            names = [s.name for s in services]
        else:
            names = [s.name for s in services if any(c.startswith(f"{cfg.services_dir}/{s.name}/") for c in changed)]
    print(json.dumps(names) if args.json else "\n".join(names))
    return 0


def _load_app(svc: Service) -> Any:
    """The service package is imported dynamically, so its app type is not known here."""
    os.environ.setdefault("ENV", "test")
    os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
    os.environ.setdefault("KAFKA_ENABLED", "false")
    sys.path.insert(0, str(svc.path / "src"))
    import importlib

    return importlib.import_module(f"{svc.package}.main").app


def cmd_openapi(cfg: DxConfig, args: argparse.Namespace) -> int:
    spec = json.dumps(_load_app(cfg.get_service(args.service)).openapi(), indent=2, sort_keys=True)
    if args.output:
        Path(args.output).write_text(spec, encoding="utf-8")
    else:
        print(spec)
    return 0


def cmd_permissions(cfg: DxConfig, args: argparse.Namespace) -> int:
    from platform_kit.rbac import permission_matrix

    rows = permission_matrix(_load_app(cfg.get_service(args.service)).routes)
    width = max((len(p) for _, p, _ in rows), default=10)
    for method, path, perm in rows:
        print(f"{method:<7} {path:<{width}}  {perm}")
    return 0


def cmd_token(cfg: DxConfig, args: argparse.Namespace) -> int:
    from platform_kit.rbac import permission_matrix
    from platform_kit.testing import make_token

    app = _load_app(cfg.get_service(args.service))
    settings = app.state.settings
    if settings.jwks_url or settings.env.value == "prod":
        raise SystemExit("dx: dev tokens are only for local/test environments")
    perms = set(args.perm or [])
    if args.all:
        perms |= {p for _, _, p in permission_matrix(app.routes) if p not in ("-", "public")}
    print(make_token(settings, sub=args.sub, permissions=sorted(perms), expires_in=args.ttl))
    return 0


def cmd_new_service(cfg: DxConfig, args: argparse.Namespace) -> int:
    from platform_kit.cli.scaffold import new_module, new_service

    svc = new_service(cfg, args.name)
    print(f"dx: created service {svc.name} at {svc.path.relative_to(cfg.root) if svc.path != cfg.root else '.'}")
    if args.with_example:
        new_module(load_config(cfg.root), svc, "items")
        print("dx: added example module 'items'")
    if args.with_saas:
        from platform_kit.cli.scaffold import new_saas

        modules = ("identity", "billing")
        if args.name == "identity":
            modules = ("identity",)
        elif args.name == "billing":
            modules = ("billing",)
        for path in new_saas(load_config(cfg.root), svc, modules=modules):
            print(f"  + {path.relative_to(cfg.root)}")
        print(f"dx: added SaaS modules {modules}")
    print("next: uv sync --all-packages && uv run dx run " + svc.name)
    return 0


def cmd_new_saas(cfg: DxConfig, args: argparse.Namespace) -> int:
    from platform_kit.cli.scaffold import new_saas

    svc = cfg.get_service(args.service)
    modules = tuple(args.modules) if args.modules else ("identity", "billing")
    for path in new_saas(cfg, svc, modules=modules):
        print(f"  + {path.relative_to(cfg.root)}")
    print("dx: SaaS spine installed. Set REDIS_URL and PLATFORM_PROFILE=saas.")
    return 0


def cmd_new_module(cfg: DxConfig, args: argparse.Namespace) -> int:
    from platform_kit.cli.scaffold import new_module

    svc = cfg.get_service(args.service)
    for path in new_module(cfg, svc, args.name, args.entity):
        print(f"  + {path.relative_to(cfg.root)}")
    print(
        f"dx: module '{args.name}' created. Edit schemas/models/service, then: "
        f"uv run dx db revision {svc.name} -m 'add {args.name}'"
    )
    return 0


def cmd_rules(cfg: DxConfig, args: argparse.Namespace) -> int:
    for code, text in RULES.items():
        flag = " (disabled)" if code in cfg.ignore else ""
        print(f"{code:<9} {text}{flag}")
    return 0


def cmd_hook(cfg: DxConfig, args: argparse.Namespace) -> int:
    from platform_kit.cli import hooks

    return hooks.claude_pre() if args.name == "claude-pre" else hooks.claude_post()


# ── parser ───────────────────────────────────────────────────────────────────
def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="dx", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="command", required=True)

    s = sub.add_parser("check", help="structure / RBAC / layering rules")
    s.add_argument("paths", nargs="*")
    s.add_argument("--service")
    s.add_argument("--format", choices=["text", "github"], default="text")
    s.set_defaults(func=cmd_check)

    sub.add_parser("watch", help="re-check on every save").set_defaults(func=cmd_watch)

    s = sub.add_parser("lint", help="ruff + format + pyright + dx check")
    s.add_argument("--service")
    s.add_argument("--fix", action="store_true")
    s.set_defaults(func=cmd_lint)

    sub.add_parser("fmt", help="format + autofix").set_defaults(func=cmd_fmt)

    s = sub.add_parser("test", help="pytest per service")
    s.add_argument("--service")
    s.add_argument("--cov", action="store_true")
    s.add_argument("pytest_args", nargs=argparse.REMAINDER)
    s.set_defaults(func=cmd_test)

    s = sub.add_parser("run", help="run a service with reload")
    s.add_argument("service")
    s.add_argument("--port", type=int)
    s.add_argument("--no-reload", action="store_true")
    s.set_defaults(func=cmd_run)

    for name in ("up", "down", "logs"):
        s = sub.add_parser(name, help=f"docker compose {name}")
        s.add_argument("only", nargs="*")
        s.add_argument("--observability", action="store_true", help="also start Jaeger")
        s.add_argument("--volumes", action="store_true", help="down: also delete volumes")
        s.set_defaults(func=cmd_compose)

    s = sub.add_parser("db", help="alembic migrations")
    s.add_argument("action", choices=["upgrade", "downgrade", "revision"])
    s.add_argument("service")
    s.add_argument("-m", "--message")
    s.add_argument("--revision")
    s.set_defaults(func=cmd_db)

    s = sub.add_parser("affected", help="services changed since --base")
    s.add_argument("--base", default="origin/main")
    s.add_argument("--json", action="store_true")
    s.set_defaults(func=cmd_affected)

    s = sub.add_parser("openapi", help="export OpenAPI spec")
    s.add_argument("service")
    s.add_argument("-o", "--output")
    s.set_defaults(func=cmd_openapi)

    s = sub.add_parser("permissions", help="RBAC matrix")
    s.add_argument("service")
    s.set_defaults(func=cmd_permissions)

    s = sub.add_parser("token", help="dev-only JWT")
    s.add_argument("service")
    s.add_argument("--perm", action="append")
    s.add_argument("--all", action="store_true", help="every permission used by the service's routes")
    s.add_argument("--sub", default="dev-user")
    s.add_argument("--ttl", type=int, default=3600)
    s.set_defaults(func=cmd_token)

    s = sub.add_parser("new-service", help="scaffold a service")
    s.add_argument("name")
    s.add_argument("--with-example", action="store_true")
    s.add_argument("--with-saas", action="store_true", help="also install identity + billing modules")
    s.set_defaults(func=cmd_new_service)

    s = sub.add_parser("new-saas", help="install SaaS spine (identity + billing) into a service")
    s.add_argument("service")
    s.add_argument("--modules", nargs="+", choices=["identity", "billing"], help="subset of modules")
    s.set_defaults(func=cmd_new_saas)

    s = sub.add_parser("new-module", help="scaffold a feature module")
    s.add_argument("service")
    s.add_argument("name", help="plural snake_case, e.g. purchase_orders")
    s.add_argument("--entity", help="singular snake_case entity name (default: derived from name)")
    s.set_defaults(func=cmd_new_module)

    sub.add_parser("rules", help="list rule codes").set_defaults(func=cmd_rules)

    s = sub.add_parser("hook", help="editor/agent hooks")
    s.add_argument("name", choices=["claude-pre", "claude-post"])
    s.set_defaults(func=cmd_hook)
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    cfg = load_config()
    return int(args.func(cfg, args) or 0)


if __name__ == "__main__":
    raise SystemExit(main())
