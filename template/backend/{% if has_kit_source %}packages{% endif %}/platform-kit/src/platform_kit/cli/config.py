"""Reads [tool.dx] from the repository root pyproject.toml."""

import tomllib
from dataclasses import dataclass, field
from pathlib import Path

DEFAULT_REQUIRED = ["router", "schemas", "service", "repository", "models", "dependencies"]
DEFAULT_OPTIONAL = ["errors", "events", "constants"]


@dataclass(frozen=True)
class Service:
    name: str  # dashed, e.g. "core-api"
    package: str  # importable, e.g. "core_api"
    path: Path  # service root (has pyproject/Dockerfile/tests)

    @property
    def src(self) -> Path:
        return self.path / "src" / self.package

    @property
    def tests(self) -> Path:
        return self.path / "tests"


@dataclass
class DxConfig:
    root: Path
    project_slug: str = "project"
    layout: str = "monorepo"  # monorepo | polyrepo_service | polyrepo_kit
    architecture: str = "monolith"  # monolith | microservices
    repo_manager: str = "none"  # none | nx | moon
    messaging: str = "none"  # none | kafka
    platform_profile: str = "api"  # api | saas
    python_version: str = "3.12"
    services_dir: str = "services"
    service: str | None = None  # polyrepo_service: the single service name
    kit_git_url: str = ""
    kit_version: str = ""
    protected_paths: list[str] = field(default_factory=list)
    module_required: list[str] = field(default_factory=lambda: list(DEFAULT_REQUIRED))
    module_optional: list[str] = field(default_factory=lambda: list(DEFAULT_OPTIONAL))
    max_route_statements: int = 6
    ignore: list[str] = field(default_factory=list)

    def services(self) -> list[Service]:
        if self.layout == "polyrepo_service":
            if not self.service:
                return []
            return [Service(self.service, to_package(self.service), self.root)]
        base = self.root / self.services_dir
        if not base.is_dir():
            return []
        return [
            Service(p.name, to_package(p.name), p)
            for p in sorted(base.iterdir())
            if p.is_dir() and (p / "src" / to_package(p.name)).is_dir()
        ]

    def get_service(self, name: str) -> Service:
        for svc in self.services():
            if name in (svc.name, svc.package):
                return svc
        known = ", ".join(s.name for s in self.services()) or "none"
        raise SystemExit(f"dx: unknown service '{name}' (known: {known})")


def to_package(name: str) -> str:
    return name.replace("-", "_")


def find_root(start: Path | None = None) -> Path:
    here = (start or Path.cwd()).resolve()
    for candidate in [here, *here.parents]:
        pyproject = candidate / "pyproject.toml"
        if pyproject.is_file() and "[tool.dx]" in pyproject.read_text(encoding="utf-8"):
            return candidate
    raise SystemExit("dx: no pyproject.toml with [tool.dx] found in this or any parent directory")


def load_config(start: Path | None = None) -> DxConfig:
    root = find_root(start)
    data = tomllib.loads((root / "pyproject.toml").read_text(encoding="utf-8"))
    raw = data.get("tool", {}).get("dx", {})
    cfg = DxConfig(root=root)
    for key, value in raw.items():
        attr = key.replace("-", "_")
        if hasattr(cfg, attr):
            setattr(cfg, attr, value)
    return cfg
