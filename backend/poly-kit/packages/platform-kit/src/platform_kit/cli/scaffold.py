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
    saas = cfg.platform_profile == "saas"
    extras = ["otel"]
    if kafka:
        extras.append("kafka")
    if saas:
        extras.append("saas")
    kit_extras = ",".join(extras)
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
        "saas_env": _SAAS_COMPOSE_ENV if saas else "",
        "saas_depends": "\n      redis:\n        condition: service_healthy" if saas else "",
    }
    created = _render_tree(TEMPLATES / "service", dest, variables, skip=skip)
    _write_repo_manager_files(cfg, name, dest)
    _register_database(cfg, package)
    _normalise(created, cfg.root)
    return Service(name, package, dest)


_SAAS_COMPOSE_ENV = (
    "\n      PLATFORM_PROFILE: saas"
    "\n      REDIS_URL: redis://redis:6379/0"
    '\n      CORS_ORIGINS: \'${CORS_ORIGINS:-["http://localhost:5173", "http://localhost:8080"]}\''
    "\n      FRONTEND_URL: ${FRONTEND_URL:-http://localhost:5173}"
)


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
                "docker": target(
                    f"docker build -f {cfg.services_dir}/{name}/Dockerfile -t {cfg.project_slug}-{name} ."
                ),
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


def new_catalog_example(cfg: DxConfig, service: Service) -> list[Path]:
    """Install the tenant-scoped catalog showcase (categories + items) used by the SPA."""
    created: list[Path] = []
    variables = {"package": service.package, "service": service.name}
    for name in ("categories", "items"):
        dest_dir = service.src / "modules" / name
        if dest_dir.exists():
            raise SystemExit(f"dx: example module already exists at {dest_dir}")
        pack = TEMPLATES / "example" / name
        for src in sorted(pack.glob("*.tmpl")):
            target = dest_dir / src.name[: -len(".tmpl")]
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(string.Template(src.read_text(encoding="utf-8")).substitute(variables), encoding="utf-8")
            created.append(target)
    for tmpl_name, dest_rel in (
        ("test_categories.py.tmpl", Path("tests/api/test_categories.py")),
        ("test_items.py.tmpl", Path("tests/api/test_items.py")),
        ("test_items_service.py.tmpl", Path("tests/unit/test_items_service.py")),
    ):
        src = TEMPLATES / "example" / "tests" / tmpl_name
        target = service.path / dest_rel
        if src.exists() and not target.exists():
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(string.Template(src.read_text(encoding="utf-8")).substitute(variables), encoding="utf-8")
            created.append(target)
    _add_resource(service, "CATEGORY", f"{service.name}.category")
    _add_resource(service, "ITEM", f"{service.name}.item")
    _grant_catalog_permissions(service)
    _normalise(created, cfg.root)
    return created


def _grant_catalog_permissions(service: Service) -> None:
    """Ensure member/viewer ROLE_PERMISSIONS include the catalog showcase resources."""
    path = service.src / "permissions.py"
    text = path.read_text(encoding="utf-8")
    item = f"{service.name}.item"
    category = f"{service.name}.category"
    member_grants = [
        f'"{item}:create"',
        f'"{item}:read"',
        f'"{item}:list"',
        f'"{item}:update"',
        f'"{item}:delete"',
        f'"{category}:create"',
        f'"{category}:read"',
        f'"{category}:list"',
        f'"{category}:update"',
        f'"{category}:delete"',
    ]
    viewer_grants = [
        f'"{item}:read"',
        f'"{item}:list"',
        f'"{category}:read"',
        f'"{category}:list"',
    ]
    if "member" not in text:
        # Insert a member role before the closing brace of ROLE_PERMISSIONS.
        text = text.replace(
            'ROLE_PERMISSIONS: dict[str, list[str]] = {\n    "admin": ["*"],\n',
            'ROLE_PERMISSIONS: dict[str, list[str]] = {\n    "admin": ["*"],\n'
            f'    "member": [{", ".join(member_grants)}],\n',
            1,
        )
    else:
        for grant in member_grants:
            if grant not in text:
                text = text.replace(
                    '"member": [',
                    f'"member": [\n        {grant},',
                    1,
                )
    if re.search(r'"viewer":\s*\[\s*\]', text):
        text = re.sub(
            r'"viewer":\s*\[\s*\][^\n]*',
            f'"viewer": [{", ".join(viewer_grants)}]',
            text,
            count=1,
        )
    else:
        for grant in viewer_grants:
            if grant in text:
                continue
            text = text.replace('"viewer": [', f'"viewer": [\n        {grant},', 1)
    path.write_text(text, encoding="utf-8")


def _add_resource(service: Service, member: str, value: str) -> None:
    path = service.src / "permissions.py"
    text = path.read_text(encoding="utf-8")
    marker = "    # dx:resources"
    if marker not in text:
        raise SystemExit(f"dx: marker '# dx:resources' not found in {path}; add the Resource entry manually")
    if re.search(rf"^\s+{member}\s*=", text, re.MULTILINE):
        return
    path.write_text(text.replace(marker, f'    {member} = "{value}"\n{marker}', 1), encoding="utf-8")


# ── saas spine (identity + billing modules) ───────────────────────────────────
_SAAS_RESOURCES = (
    ("IDENTITY_TENANT", "identity.tenant"),
    ("IDENTITY_USER", "identity.user"),
    ("IDENTITY_ROLE", "identity.role"),
    ("IDENTITY_PERMISSION", "identity.permission"),
    ("IDENTITY_AUDIT", "identity.audit"),
    ("BILLING_PLAN", "billing.plan"),
    ("BILLING_SUBSCRIPTION", "billing.subscription"),
)


def new_saas(
    cfg: DxConfig,
    service: Service,
    *,
    modules: tuple[str, ...] = ("identity", "billing"),
) -> list[Path]:
    """Install SaaS spine modules into an existing service."""
    created: list[Path] = []
    variables = {"package": service.package, "service": service.name}
    for name in modules:
        if name not in ("identity", "billing"):
            raise SystemExit(f"dx: unknown saas module {name!r}")
        dest_dir = service.src / "modules" / name
        if dest_dir.exists():
            raise SystemExit(f"dx: saas module already exists at {dest_dir}")
        pack = TEMPLATES / "saas" / name
        for src in sorted(pack.rglob("*")):
            if src.is_dir():
                continue
            rel = src.name
            if rel.endswith(".tmpl"):
                rel = rel[: -len(".tmpl")]
                content = string.Template(src.read_text(encoding="utf-8")).substitute(variables)
            else:
                content = src.read_text(encoding="utf-8")
            target = dest_dir / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding="utf-8")
            created.append(target)
        test_names = [name]
        if name == "identity":
            test_names.append("iam")
        for test_name in test_names:
            test_tmpl = TEMPLATES / "saas" / "tests" / f"test_{test_name}.py.tmpl"
            test_target = service.path / "tests" / "api" / f"test_{test_name}.py"
            if test_tmpl.exists() and not test_target.exists():
                test_target.parent.mkdir(parents=True, exist_ok=True)
                test_target.write_text(
                    string.Template(test_tmpl.read_text(encoding="utf-8")).substitute(variables),
                    encoding="utf-8",
                )
                created.append(test_target)
    resource_map = {
        "identity": _SAAS_RESOURCES[:5],
        "billing": _SAAS_RESOURCES[5:],
    }
    for name in modules:
        for member, value in resource_map[name]:
            _add_resource(service, member, value)
    _enable_saas_settings(service)
    _ensure_saas_dependency(service)
    _normalise(created, cfg.root)
    return created


def _enable_saas_settings(service: Service) -> None:
    path = service.src / "settings.py"
    text = path.read_text(encoding="utf-8")
    if "platform_profile" in text:
        return
    addition = (
        '    platform_profile: Literal["api", "saas"] = "saas"\n'
        '    redis_url: str | None = "redis://localhost:6379/0"\n'
        '    jwt_issuer: str | None = "https://auth.local"\n'
        '    jwt_audience: str | None = "api://local"\n'
    )
    if "from typing import Literal" not in text:
        text = text.replace(
            "from platform_kit.config import ServiceSettings",
            "from typing import Literal\n\nfrom platform_kit.config import ServiceSettings",
        )
    # Insert before the trailing `settings = Settings()` assignment.
    if "settings = Settings()" in text:
        text = text.replace("settings = Settings()", addition + "\n\nsettings = Settings()")
    else:
        text += "\n" + addition
    path.write_text(text, encoding="utf-8")


def _ensure_saas_dependency(service: Service) -> None:
    path = service.path / "pyproject.toml"
    text = path.read_text(encoding="utf-8")
    if "platform-kit[saas" in text or "platform-kit[otel,saas" in text:
        return
    text = text.replace("platform-kit[otel,kafka]", "platform-kit[otel,kafka,saas]")
    text = text.replace("platform-kit[otel]", "platform-kit[otel,saas]")
    path.write_text(text, encoding="utf-8")
