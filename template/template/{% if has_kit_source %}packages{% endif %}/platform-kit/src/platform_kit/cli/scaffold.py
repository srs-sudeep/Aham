"""`dx new-service` / `dx new-module`: the only supported way to create services and modules."""

import json
import re
import shutil
import string
import subprocess
from pathlib import Path

from platform_kit.cli.config import DxConfig, Service, to_package

TEMPLATES = Path(__file__).parent / "templates"
_NAME = re.compile(r"^[a-z][a-z0-9-]*[a-z0-9]$")
_MODULE = re.compile(r"^[a-z][a-z0-9_]*[a-z0-9]$")


def _render_tree(src_dir: Path, dest: Path, variables: dict[str, str], *, skip: set[str] = frozenset()) -> list[Path]:  # type: ignore[assignment]
    created: list[Path] = []
    for src in sorted(src_dir.rglob("*")):
        if src.is_dir():
            continue
        rel = str(src.relative_to(src_dir))
        for token in ("__package__", "__module__"):
            if token in rel:
                rel = rel.replace(token, variables[token.strip("_")])
        if rel.endswith(".tmpl"):
            rel = rel[: -len(".tmpl")]
            content = string.Template(src.read_text(encoding="utf-8")).substitute(variables)
        else:
            content = src.read_text(encoding="utf-8")
        if rel in skip:
            continue
        target = dest / rel
        if target.exists():
            raise SystemExit(f"dx: refusing to overwrite existing file {target}")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        if target.name.endswith(".sh"):
            target.chmod(0o755)
        created.append(target)
    return created


def _normalise(created: list[Path], root: Path) -> None:
    """Sort imports and reformat freshly generated files.

    A template cannot know whether the service package sorts before or after
    `platform_kit`, nor how long an entity name will make a line, so import order
    (ruff I001) and wrapping (E501) are settled here instead of being baked in.
    This is the same normalisation copier runs after the initial render, so a
    scaffolded module is lint-clean the moment it is created.
    """
    files = [str(p) for p in created if p.suffix == ".py"]
    if not files or shutil.which("ruff") is None:
        return
    for cmd in (
        ["ruff", "check", "--fix-only", "--select", "I", "--quiet", *files],
        ["ruff", "format", "--quiet", *files],
    ):
        subprocess.run(cmd, cwd=root, check=False, capture_output=True)


# ── services ─────────────────────────────────────────────────────────────────
def new_service(cfg: DxConfig, name: str) -> Service:
    if not _NAME.match(name):
        raise SystemExit("dx: service names are lowercase letters, digits and dashes, e.g. 'orders' or 'supplier-api'")
    if cfg.layout == "polyrepo_kit":
        raise SystemExit("dx: this is the platform-kit repo; services live in their own repos")
    package = to_package(name)
    existing = cfg.services()

    if cfg.layout == "polyrepo_service":
        if existing and (cfg.root / "src").exists():
            raise SystemExit("dx: a polyrepo service repo holds exactly one service")
        dest, prefix, dockerfile = cfg.root, "", "Dockerfile"
        skip = {"pyproject.toml", "README.md"}  # the repo root files ARE the service files
        uv_flag, ssh_mount = "", "--mount=type=ssh"
        m = re.search(r"(?:://(?:[^@/]+@)?|@)([^/:]+)", cfg.kit_git_url)
        host = m.group(1) if m else "github.com"
        git_setup = (
            "RUN apt-get update && apt-get install -y --no-install-recommends git openssh-client "
            "&& rm -rf /var/lib/apt/lists/* && mkdir -p -m 0700 /root/.ssh "
            f"&& ssh-keyscan {host} >> /root/.ssh/known_hosts"
        )
    else:
        if cfg.architecture == "monolith" and existing:
            raise SystemExit(
                "dx: this repo is a modular monolith (one service). Add a *module* instead "
                '(`dx new-module`), or set [tool.dx] architecture = "microservices" '
                "if you really need a second service."
            )
        dest = cfg.root / cfg.services_dir / name
        if dest.exists():
            raise SystemExit(f"dx: {dest} already exists")
        prefix = f"{cfg.services_dir}/{name}/"
        dockerfile = f"{prefix}Dockerfile"
        skip, uv_flag, ssh_mount, git_setup = set(), f"--package {name}", "", ""

    kafka = cfg.messaging == "kafka"
    kit_extras = "otel,kafka" if kafka else "otel"
    deps = [f'  "platform-kit[{kit_extras}]",']
    if cfg.layout == "polyrepo_service":
        sources = (
            f'platform-kit = {{ git = "{cfg.kit_git_url}", '
            f'subdirectory = "packages/platform-kit", tag = "{cfg.kit_version}" }}'
        )
    else:
        sources = "platform-kit = { workspace = true }"
    if kafka:
        deps.append('  "contracts",')
        if cfg.layout == "polyrepo_service":
            sources += (
                f'\ncontracts = {{ git = "{cfg.kit_git_url}", '
                f'subdirectory = "packages/contracts", tag = "{cfg.kit_version}" }}'
            )
        else:
            sources += "\ncontracts = { workspace = true }"

    variables = {
        "service": name,
        "package": package,
        "project_slug": cfg.project_slug,
        "python_version": cfg.python_version,
        "port": str(8001 if cfg.layout == "polyrepo_service" else 8001 + len(existing)),
        "dockerfile_path": dockerfile,
        "service_dir_prefix": prefix,
        "uv_package_flag": uv_flag,
        "ssh_mount": ssh_mount,
        "git_setup": git_setup,
        "kit_dependencies": "\n".join(deps),
        "kit_sources": sources,
        "kafka_enabled": "true" if kafka else "false",
        "kafka_bool": "True" if kafka else "False",
        "kafka_depends": "\n      kafka:\n        condition: service_healthy" if kafka else "",
    }
    created = _render_tree(TEMPLATES / "service", dest, variables, skip=skip)
    _write_repo_manager_files(cfg, name, dest)
    _register_database(cfg, package)
    _normalise(created, cfg.root)
    return Service(name, package, dest)


def _write_repo_manager_files(cfg: DxConfig, name: str, dest: Path) -> None:
    if cfg.repo_manager == "nx":
        def target(cmd: str, **extra: object) -> dict[str, object]:
            return {"executor": "nx:run-commands", "options": {"command": cmd, "cwd": "{workspaceRoot}"}, **extra}

        project = {
            "$schema": "../../node_modules/nx/schemas/project-schema.json",
            "name": name,
            "projectType": "application",
            "sourceRoot": f"{cfg.services_dir}/{name}/src",
            "implicitDependencies": ["platform-kit", *(["contracts"] if cfg.messaging == "kafka" else [])],
            "targets": {
                "lint": target(f"uv run dx lint --service {name}", cache=True),
                "test": target(f"uv run dx test --service {name}", cache=True),
                "serve": target(f"uv run dx run {name}", continuous=True),
                "docker": target(f"docker build -f {cfg.services_dir}/{name}/Dockerfile -t {cfg.project_slug}-{name} ."),
            },
        }
        (dest / "project.json").write_text(json.dumps(project, indent=2) + "\n", encoding="utf-8")
    elif cfg.repo_manager == "moon":
        deps = ["platform-kit", *(["contracts"] if cfg.messaging == "kafka" else [])]
        (dest / "moon.yml").write_text(
            f"""language: python
layer: application
dependsOn: {json.dumps(deps)}

tasks:
  lint:
    command: uv run dx lint --service {name}
    options: {{ runFromWorkspaceRoot: true }}
  test:
    command: uv run dx test --service {name}
    options: {{ runFromWorkspaceRoot: true }}
  serve:
    command: uv run dx run {name}
    preset: server
    options: {{ runFromWorkspaceRoot: true }}
  docker:
    command: docker build -f {cfg.services_dir}/{name}/Dockerfile -t {cfg.project_slug}-{name} .
    options: {{ runFromWorkspaceRoot: true, cache: false }}
""",
            encoding="utf-8",
        )


def _register_database(cfg: DxConfig, package: str) -> None:
    init = cfg.root / "infra" / "postgres" / "init" / "01-databases.sql"
    if not init.parent.exists():
        return
    line = f"CREATE DATABASE {package};"
    current = init.read_text(encoding="utf-8") if init.exists() else ""
    if line not in current:
        init.write_text(current + line + "\n", encoding="utf-8")


# ── modules ──────────────────────────────────────────────────────────────────
def _singular(word: str) -> str:
    if word.endswith("ies"):
        return word[:-3] + "y"
    if word.endswith(("ses", "xes", "ches", "shes")):
        return word[:-2]
    if word.endswith("s") and not word.endswith("ss"):
        return word[:-1]
    return word


def new_module(cfg: DxConfig, service: Service, module: str, entity: str | None = None) -> list[Path]:
    if not _MODULE.match(module):
        raise SystemExit("dx: module names are snake_case and plural, e.g. 'purchase_orders'")
    target_dir = service.src / "modules" / module
    if target_dir.exists():
        raise SystemExit(f"dx: module {target_dir} already exists")
    entity_snake = entity or _singular(module)
    Entity = "".join(p.capitalize() for p in entity_snake.split("_"))  # noqa: N806
    human = entity_snake.replace("_", " ")
    variables = {
        "package": service.package,
        "service": service.name,
        "module": module,
        "module_human": module.replace("_", " "),
        "module_url": module.replace("_", "-"),
        "entity": entity_snake,
        "Entity": Entity,
        "Entity_human": human.capitalize(),
        "entity_human_lower": human,
        "RESOURCE": entity_snake.upper(),
        "table": module,
    }
    created = _render_tree(TEMPLATES / "module", service.path, variables)
    _add_resource(service, entity_snake.upper(), f"{service.name}.{entity_snake}")
    _normalise(created, cfg.root)
    return created


def _add_resource(service: Service, member: str, value: str) -> None:
    path = service.src / "permissions.py"
    text = path.read_text(encoding="utf-8")
    marker = "    # dx:resources"
    if marker not in text:
        raise SystemExit(f"dx: marker '# dx:resources' not found in {path}; add the Resource entry manually")
    if re.search(rf"^\s+{member}\s*=", text, re.MULTILINE):
        return
    path.write_text(text.replace(marker, f'    {member} = "{value}"\n{marker}', 1), encoding="utf-8")
