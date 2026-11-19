"""Architecture & convention checker (`dx check`).

Runs in four places with identical rules: the editor (`dx watch` task), Claude Code
hooks (after every AI edit), pre-commit, and CI (as GitHub PR annotations).

Suppress a single line with ``# dx: ignore[CODE]`` (reviewers will see it).
Disable a rule project-wide with ``[tool.dx] ignore = ["API005"]`` (needs CODEOWNER approval).
"""

import ast
import re
from collections.abc import Iterable, Iterator
from dataclasses import dataclass
from pathlib import Path

from platform_kit.cli.config import DxConfig, Service

RULES: dict[str, str] = {
    # structure
    "STR001": "Module folder is missing a required file",
    "STR002": "Unexpected file in a module folder (allowed: required + optional files)",
    "STR003": "Python files directly under modules/ are not allowed; create a module folder",
    "STR004": "Module folder names must be snake_case",
    "STR005": "Module folder is missing __init__.py",
    "STR010": "service.py must define a class named <Entity>Service",
    # rbac / api
    "RBAC001": "Use SecureRouter, not APIRouter/FastAPI, in router.py",
    "RBAC002": "Every endpoint must declare permission=Permission(Resource.X, Action.Y) or PUBLIC",
    "RBAC003": "router.py must define a module-level `router = SecureRouter(...)`",
    "API001": "SecureRouter(...) needs prefix= and tags=",
    "API002": "Every endpoint needs summary= (it becomes the OpenAPI summary)",
    "API003": "Endpoints must be `async def`",
    "API004": "Endpoints need a return type annotation (or response_model=)",
    "API005": "Endpoint body is too long: business logic belongs in the service layer",
    # layering
    "LAY001": "Layer imports a sibling file it must not depend on",
    "LAY002": "Layer imports a library it must not depend on",
    "LAY010": "Cross-module import of internals; import another module's service/schemas/errors only",
    "LAY020": "Cross-service import; services talk via ServiceClient (HTTP) or events, never imports",
    # errors / logging / config / safety
    "ERR001": "Do not use HTTPException; raise platform_kit errors (AppError subclasses)",
    "ERR002": "Exception swallowed with `pass`; log it or re-raise",
    "LOG001": "print() is not allowed; use platform_kit.get_logger",
    "LOG002": "logging.getLogger is not allowed; use platform_kit.get_logger",
    "CFG001": "Read configuration from settings, not os.environ/os.getenv",
    "HTTP001": "Do not import httpx/requests/aiohttp; use platform_kit.http.ServiceClient",
    "SQL001": "SQL built from an f-string/concatenation: SQL injection risk; use bound parameters",
    "ASYNC001": "Blocking call inside async def (time.sleep / requests / subprocess); use the async equivalent",
    # memory / resources / code patterns
    "MEM001": "Do not create DB engines inside functions; create once at module/lifespan scope",
    "MEM002": "Do not construct httpx clients inside handlers; use lifespan / ServiceClient",
    "MEM003": "Module-level mutable list/dict that grows at runtime is a leak risk; use bounded cache or external store",
    "CODE001": "session.commit()/await session.commit() belongs in the repository layer (BaseRepository.commit)",
}

ROUTE_VERBS = {"get", "post", "put", "patch", "delete"}
CROSS_MODULE_ALLOWED = {"service", "schemas", "errors"}
_SNAKE = re.compile(r"^[a-z][a-z0-9_]*$")
_SUPPRESS = re.compile(r"#\s*dx:\s*ignore(?:\[(?P<codes>[A-Z0-9, ]+)\])?")

# role -> (forbidden sibling files, forbidden import prefixes)
LAYER_RULES: dict[str, tuple[set[str], tuple[str, ...]]] = {
    "router": ({"repository", "models"}, ("sqlalchemy", "platform_kit.db")),
    "service": ({"router", "dependencies"}, ("fastapi", "starlette")),
    "repository": ({"router", "service", "dependencies", "schemas"}, ("fastapi", "starlette", "pydantic")),
    "models": ({"router", "service", "repository", "schemas", "dependencies", "events"}, ("fastapi", "starlette", "pydantic")),
    "schemas": ({"router", "service", "repository", "models", "dependencies", "events"}, ("sqlalchemy", "fastapi", "starlette")),
    "errors": ({"router", "service", "repository", "models", "schemas", "dependencies", "events"}, ("fastapi", "starlette", "sqlalchemy")),
    "constants": ({"router", "service", "repository", "models", "schemas", "dependencies", "events", "errors"}, ()),
    "dependencies": ({"router", "events"}, ()),
    "events": ({"router", "dependencies"}, ("fastapi", "starlette")),
}
HTTP_LIBS = ("httpx", "requests", "aiohttp", "urllib3")
BLOCKING_CALLS = (
    "time.sleep",
    "requests.get",
    "requests.post",
    "requests.request",
    "requests.put",
    "requests.patch",
    "requests.delete",
    "subprocess.run",
    "subprocess.call",
    "subprocess.Popen",
    "urllib.request.urlopen",
)
ENGINE_CTORS = ("create_engine", "create_async_engine", "sqlalchemy.create_engine", "sqlalchemy.ext.asyncio.create_async_engine")
HTTP_CTORS = ("httpx.Client", "httpx.AsyncClient")


@dataclass(frozen=True, order=True)
class Violation:
    path: str
    line: int
    col: int
    code: str
    message: str

    def __str__(self) -> str:
        return f"{self.path}:{self.line}:{self.col}: {self.code} {self.message}"

    def github(self) -> str:
        msg = self.message.replace("%", "%25").replace("\n", "%0A")
        return f"::error file={self.path},line={self.line},col={self.col},title=dx {self.code}::{msg}"


# ── file context ─────────────────────────────────────────────────────────────
@dataclass(frozen=True)
class FileCtx:
    service: Service
    path: Path
    module_name: str  # dotted name of this file
    module: str | None  # modules/<module>/... or None
    role: str | None  # router/service/... when inside a module folder

    @property
    def is_package_init(self) -> bool:
        return self.path.name == "__init__.py"


def file_context(service: Service, path: Path) -> FileCtx:
    rel = path.relative_to(service.src).with_suffix("")
    parts = list(rel.parts)
    dotted = ".".join([service.package, *parts])
    if dotted.endswith(".__init__"):
        dotted = dotted[: -len(".__init__")]
    module = role = None
    if len(parts) >= 3 and parts[0] == "modules":
        module, role = parts[1], parts[2]
    return FileCtx(service, path, dotted, module, role)


def _resolve_from(ctx: FileCtx, node: ast.ImportFrom) -> list[str]:
    if node.level:
        base = ctx.module_name.split(".")
        if not ctx.is_package_init:
            base = base[:-1]
        base = base[: len(base) - (node.level - 1)] if node.level > 1 else base
        mod = ".".join([*base, *(node.module.split(".") if node.module else [])])
    else:
        mod = node.module or ""
    return [mod, *(f"{mod}.{a.name}" for a in node.names if a.name != "*")]


def imported_names(ctx: FileCtx, tree: ast.AST) -> Iterator[tuple[ast.stmt, str]]:
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                yield node, alias.name
        elif isinstance(node, ast.ImportFrom):
            for name in _resolve_from(ctx, node):
                yield node, name


def _matches(name: str, prefix: str) -> bool:
    return name == prefix or name.startswith(prefix + ".")


def _call_name(node: ast.Call) -> str:
    func = node.func
    if isinstance(func, ast.Name):
        return func.id
    if isinstance(func, ast.Attribute):
        inner = func.value.id if isinstance(func.value, ast.Name) else "?"
        return f"{inner}.{func.attr}"
    return ""


def _kw(node: ast.Call, name: str) -> ast.keyword | None:
    return next((k for k in node.keywords if k.arg == name), None)


# ── checks ───────────────────────────────────────────────────────────────────
class _Collector:
    def __init__(self, path: Path, root: Path) -> None:
        self.rel = str(path.relative_to(root)) if path.is_relative_to(root) else str(path)
        self.items: list[Violation] = []

    def add(self, node: ast.AST | None, code: str, detail: str = "") -> None:
        line = getattr(node, "lineno", 1) or 1
        col = (getattr(node, "col_offset", 0) or 0) + 1
        message = RULES[code] + (f": {detail}" if detail else "")
        self.items.append(Violation(self.rel, line, col, code, message))


def check_imports(ctx: FileCtx, tree: ast.AST, out: _Collector, other_services: set[str]) -> None:
    seen: set[tuple[int, str]] = set()

    def add_once(node: ast.stmt, code: str, detail: str) -> None:
        if (node.lineno, code) not in seen:
            seen.add((node.lineno, code))
            out.add(node, code, detail)

    modules_prefix = f"{ctx.service.package}.modules."
    for node, name in imported_names(ctx, tree):
        top = name.split(".")[0]
        if top in other_services:
            add_once(node, "LAY020", f"`{name}`")
        if any(_matches(name, lib) for lib in HTTP_LIBS):
            add_once(node, "HTTP001", f"`{name}`")
        if name in ("fastapi.HTTPException", "starlette.exceptions.HTTPException", "fastapi.exceptions.HTTPException"):
            add_once(node, "ERR001", "")
        if name.startswith(modules_prefix):
            parts = name[len(modules_prefix) :].split(".")
            target_module, target_file = parts[0], parts[1] if len(parts) > 1 else None
            if ctx.module and target_module == ctx.module and ctx.role in LAYER_RULES:
                forbidden_siblings, _ = LAYER_RULES[ctx.role]
                if target_file in forbidden_siblings:
                    add_once(node, "LAY001", f"{ctx.role}.py must not import {target_file}.py")
            elif ctx.module and target_module != ctx.module and target_file and target_file not in CROSS_MODULE_ALLOWED:
                # attribute imports like `from x.modules.orders import service` resolve to x.modules.orders.service
                add_once(node, "LAY010", f"`{name}` (module '{ctx.module}' -> '{target_module}')")
        if ctx.role in LAYER_RULES:
            _, forbidden_libs = LAYER_RULES[ctx.role]
            for lib in forbidden_libs:
                if _matches(name, lib):
                    add_once(node, "LAY002", f"{ctx.role}.py must not import `{lib}`")


def check_router(tree: ast.Module, out: _Collector, max_statements: int) -> None:
    has_router = False
    for node in ast.walk(tree):
        if isinstance(node, ast.Call) and _call_name(node).split(".")[-1] in ("APIRouter", "FastAPI"):
            out.add(node, "RBAC001")
    for stmt in tree.body:
        if isinstance(stmt, (ast.Assign, ast.AnnAssign)) and isinstance(stmt.value, ast.Call):
            targets = stmt.targets if isinstance(stmt, ast.Assign) else [stmt.target]
            if any(isinstance(t, ast.Name) and t.id == "router" for t in targets) and _call_name(stmt.value).endswith("SecureRouter"):
                has_router = True
                missing = [k for k in ("prefix", "tags") if _kw(stmt.value, k) is None]
                if missing:
                    out.add(stmt, "API001", "missing " + ", ".join(missing))
    if not has_router:
        out.add(None, "RBAC003")

    for fn in ast.walk(tree):
        if not isinstance(fn, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        for dec in fn.decorator_list:
            if not (isinstance(dec, ast.Call) and isinstance(dec.func, ast.Attribute) and dec.func.attr in ROUTE_VERBS):
                continue
            label = f"`{fn.name}`"
            if _kw(dec, "permission") is None:
                out.add(dec, "RBAC002", label)
            if _kw(dec, "summary") is None:
                out.add(dec, "API002", label)
            if not isinstance(fn, ast.AsyncFunctionDef):
                out.add(fn, "API003", label)
            if fn.returns is None and _kw(dec, "response_model") is None:
                out.add(fn, "API004", label)
            body = fn.body[1:] if (fn.body and isinstance(fn.body[0], ast.Expr) and isinstance(fn.body[0].value, ast.Constant)) else fn.body
            count = sum(1 for _ in _iter_statements(body))
            if count > max_statements:
                out.add(fn, "API005", f"{label} has {count} statements (max {max_statements})")


def _iter_statements(body: Iterable[ast.stmt]) -> Iterator[ast.stmt]:
    for stmt in body:
        yield stmt
        for field_name in ("body", "orelse", "finalbody", "handlers"):
            child = getattr(stmt, field_name, None)
            if isinstance(child, list):
                yield from _iter_statements(c for c in child if isinstance(c, ast.stmt))


def check_service_file(tree: ast.Module, out: _Collector) -> None:
    if not any(isinstance(n, ast.ClassDef) and n.name.endswith("Service") for n in tree.body):
        out.add(None, "STR010")


def check_general(ctx: FileCtx, tree: ast.AST, out: _Collector) -> None:
    is_settings = ctx.path.name == "settings.py"
    in_repo = ctx.role == "repository"

    def visit(node: ast.AST, in_async: bool, in_function: bool) -> None:
        for child in ast.iter_child_nodes(node):
            child_async = in_async
            child_fn = in_function
            if isinstance(child, ast.AsyncFunctionDef):
                child_async = True
                child_fn = True
            elif isinstance(child, ast.FunctionDef):
                child_async = False
                child_fn = True
            elif isinstance(child, ast.Lambda):
                child_async = False
                child_fn = True
            inspect(child, child_async, child_fn)
            visit(child, child_async, child_fn)

    def inspect(node: ast.AST, in_async: bool, in_function: bool) -> None:
        if isinstance(node, ast.Call):
            name = _call_name(node)
            if name == "print":
                out.add(node, "LOG001")
            elif name == "logging.getLogger":
                out.add(node, "LOG002")
            elif name in ("os.getenv",) and not is_settings:
                out.add(node, "CFG001")
            elif name.split(".")[-1] == "text" and node.args and isinstance(node.args[0], (ast.JoinedStr, ast.BinOp)):
                out.add(node, "SQL001")
            elif in_async and (name in BLOCKING_CALLS or name.endswith(".sleep") and "asyncio" not in name):
                out.add(node, "ASYNC001", f"`{name}`")
            elif in_function and (name in ENGINE_CTORS or name.endswith("create_engine") or name.endswith("create_async_engine")):
                out.add(node, "MEM001", f"`{name}`")
            elif in_function and name in HTTP_CTORS:
                # allow inside functions named lifespan/_setup
                out.add(node, "MEM002", f"`{name}`")
            elif not in_repo and isinstance(node.func, ast.Attribute) and node.func.attr == "commit":
                # Flag session.commit / self.session.commit — allow self.repo.commit()
                recv = node.func.value
                recv_name = ""
                if isinstance(recv, ast.Name):
                    recv_name = recv.id
                elif isinstance(recv, ast.Attribute):
                    recv_name = recv.attr
                if recv_name in {"session", "db", "db_session"} or recv_name.endswith("session"):
                    out.add(node, "CODE001", f"`{recv_name}.commit()`")
        elif isinstance(node, ast.Attribute) and isinstance(node.value, ast.Name):
            if node.value.id == "os" and node.attr == "environ" and not is_settings:
                out.add(node, "CFG001")
        elif isinstance(node, ast.ImportFrom) and node.module == "os" and not is_settings:
            if any(a.name in ("environ", "getenv") for a in node.names):
                out.add(node, "CFG001")
        elif isinstance(node, ast.ExceptHandler) and len(node.body) == 1 and isinstance(node.body[0], ast.Pass):
            out.add(node, "ERR002")
        elif isinstance(node, ast.Assign) and not in_function and ctx.role in {"service", "repository"}:
            # module-level [] or {} used as mutable caches (constants UPPER_CASE allowed)
            empty_mut = (isinstance(node.value, ast.List) and not node.value.elts) or (
                isinstance(node.value, ast.Dict) and not node.value.keys
            )
            if empty_mut:
                targets = [t.id for t in node.targets if isinstance(t, ast.Name) and not t.id.isupper()]
                if targets:
                    out.add(node, "MEM003", f"`{targets[0]}`")

    visit(tree, False, False)


def check_module_dirs(service: Service, cfg: DxConfig, only: set[Path] | None, root: Path) -> list[Violation]:
    out: list[Violation] = []
    modules_dir = service.src / "modules"
    if not modules_dir.is_dir():
        return out
    allowed = set(cfg.module_required) | set(cfg.module_optional) | {"__init__"}

    def rel(p: Path) -> str:
        return str(p.relative_to(root))

    for entry in sorted(modules_dir.iterdir()):
        if entry.name.startswith((".", "__pycache__")):
            continue
        if entry.is_file():
            if entry.suffix == ".py" and entry.name != "__init__.py" and (only is None or entry in only):
                out.append(Violation(rel(entry), 1, 1, "STR003", RULES["STR003"]))
            continue
        if only is not None and entry not in only and not any(p.is_relative_to(entry) for p in only):
            continue
        if not _SNAKE.match(entry.name):
            out.append(Violation(rel(entry), 1, 1, "STR004", f"{RULES['STR004']}: '{entry.name}'"))
        if not (entry / "__init__.py").exists():
            out.append(Violation(rel(entry), 1, 1, "STR005", RULES["STR005"]))
        present = {p.stem for p in entry.glob("*.py")}
        out.extend(
            Violation(rel(entry), 1, 1, "STR001", f"{RULES['STR001']}: {req}.py")
            for req in cfg.module_required
            if req not in present
        )
        out.extend(
            Violation(rel(entry / f"{extra}.py"), 1, 1, "STR002", f"{RULES['STR002']}: {extra}.py")
            for extra in sorted(present - allowed)
        )
        out.extend(
            Violation(rel(sub), 1, 1, "STR002", f"{RULES['STR002']}: nested folder '{sub.name}'")
            for sub in sorted(p for p in entry.iterdir() if p.is_dir() and p.name != "__pycache__")
        )
    return out


def _suppressed(violation: Violation, lines: list[str]) -> bool:
    if not (1 <= violation.line <= len(lines)):
        return False
    m = _SUPPRESS.search(lines[violation.line - 1])
    if not m:
        return False
    codes = m.group("codes")
    return codes is None or violation.code in {c.strip() for c in codes.split(",")}


def check_file(ctx: FileCtx, cfg: DxConfig, other_services: set[str]) -> list[Violation]:
    source = ctx.path.read_text(encoding="utf-8")
    out = _Collector(ctx.path, cfg.root)
    try:
        tree = ast.parse(source, filename=str(ctx.path))
    except SyntaxError as exc:
        return [Violation(out.rel, exc.lineno or 1, exc.offset or 1, "E999", f"syntax error: {exc.msg}")]
    check_imports(ctx, tree, out, other_services)
    check_general(ctx, tree, out)
    if ctx.role == "router":
        check_router(tree, out, cfg.max_route_statements)
    elif ctx.role == "service":
        check_service_file(tree, out)
    lines = source.splitlines()
    return [v for v in out.items if not _suppressed(v, lines)]


def run_checks(cfg: DxConfig, paths: Iterable[Path] | None = None, service: str | None = None) -> list[Violation]:
    services = cfg.services()
    if service:
        services = [s for s in services if service in (s.name, s.package)]
    all_packages = {s.package for s in cfg.services()}
    only = {p.resolve() for p in paths} if paths else None
    violations: list[Violation] = []

    for svc in services:
        if not svc.src.is_dir():
            continue
        other = all_packages - {svc.package}
        files = sorted(svc.src.rglob("*.py"))
        if only is not None:
            files = [f for f in files if f.resolve() in only or any(f.resolve().is_relative_to(p) for p in only if p.is_dir())]
            module_scope = {f.resolve().parent for f in files} | {p for p in only if p.is_dir()}
        else:
            module_scope = None
        for f in files:
            if "__pycache__" in f.parts:
                continue
            violations += check_file(file_context(svc, f), cfg, other)
        if only is None or files or module_scope:
            violations += check_module_dirs(svc, cfg, module_scope, cfg.root)

    return sorted({v for v in violations if v.code not in set(cfg.ignore)})
