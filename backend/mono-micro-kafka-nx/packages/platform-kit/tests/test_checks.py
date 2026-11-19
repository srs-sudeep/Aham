"""The checker is the guard rail for everything else, so it is tested like product code."""

import re
import textwrap
from pathlib import Path

import pytest

from platform_kit.cli.checks import run_checks
from platform_kit.cli.config import load_config
from platform_kit.cli.scaffold import new_module, new_service


@pytest.fixture
def repo(tmp_path: Path) -> Path:
    (tmp_path / "pyproject.toml").write_text(
        textwrap.dedent(
            """
            [project]
            name = "ws"
            version = "0"
            [tool.dx]
            layout = "monorepo"
            architecture = "microservices"
            project_slug = "demo"
            """
        )
    )
    (tmp_path / "infra" / "postgres" / "init").mkdir(parents=True)
    return tmp_path


def codes(repo: Path, **kw: object) -> set[str]:
    return {v.code for v in run_checks(load_config(repo), **kw)}  # type: ignore[arg-type]


def make_service(repo: Path, name: str = "orders", example: bool = True) -> Path:
    cfg = load_config(repo)
    svc = new_service(cfg, name)
    if example:
        new_module(load_config(repo), svc, "items")
    return svc.src


def test_scaffolded_service_is_clean(repo: Path) -> None:
    make_service(repo)
    assert codes(repo) == set()


def test_scaffold_registers_resource_and_database(repo: Path) -> None:
    src = make_service(repo)
    assert 'ITEM = "orders.item"' in (src / "permissions.py").read_text()
    assert "CREATE DATABASE orders;" in (repo / "infra/postgres/init/01-databases.sql").read_text()


def test_missing_permission_and_summary(repo: Path) -> None:
    src = make_service(repo)
    router = src / "modules/items/router.py"
    # Strip the kwargs by pattern, not by exact text: how the generated decorator is
    # wrapped is ruff's business, and this test should not break when that changes.
    stripped = re.sub(r"\n\s*permission=(?:Permission\([^)]*\)|PUBLIC),", "", router.read_text())
    stripped = re.sub(r'\n\s*summary="[^"]*",', "", stripped)
    router.write_text(stripped)
    assert {"RBAC002", "API002"} <= codes(repo)


def test_plain_apirouter_is_rejected(repo: Path) -> None:
    src = make_service(repo)
    (src / "modules/items/router.py").write_text("from fastapi import APIRouter\nrouter = APIRouter()\n")
    assert {"RBAC001", "RBAC003"} <= codes(repo)


def test_router_must_not_touch_repository_or_db(repo: Path) -> None:
    src = make_service(repo)
    router = src / "modules/items/router.py"
    router.write_text("from .repository import ItemRepository\nfrom sqlalchemy import select\n" + router.read_text())
    assert {"LAY001", "LAY002"} <= codes(repo)


def test_service_must_not_import_fastapi_or_raise_http(repo: Path) -> None:
    src = make_service(repo)
    service = src / "modules/items/service.py"
    service.write_text("from fastapi import HTTPException\n" + service.read_text())
    assert {"LAY002", "ERR001"} <= codes(repo)


def test_cross_module_internals_and_cross_service(repo: Path) -> None:
    src = make_service(repo)
    other = load_config(repo).get_service("orders")
    new_module(load_config(repo), other, "carts")
    make_service(repo, "billing", example=False)
    svc = src / "modules/carts/service.py"
    svc.write_text(
        "from orders.modules.items.repository import ItemRepository\n"
        "from orders.modules.items.service import ItemService\n"  # allowed
        "import billing.settings\n" + svc.read_text()
    )
    found = run_checks(load_config(repo))
    assert [v.code for v in found if v.line == 1] == ["LAY010"]
    assert any(v.code == "LAY020" and v.line == 3 for v in found)


def test_long_endpoint_print_env_and_blocking(repo: Path) -> None:
    src = make_service(repo)
    router = src / "modules/items/router.py"
    body = "\n".join(f"    x{i} = {i}" for i in range(8))
    router.write_text(
        router.read_text()
        + textwrap.dedent(
            """
            import os, time

            @router.get("/fat", permission=PUBLIC, summary="fat")
            async def fat() -> dict:
                print("hi")
                time.sleep(1)
                os.getenv("X")
            """
        )
        + body
        + "\n    return {}\n"
    )
    assert {"API005", "LOG001", "ASYNC001", "CFG001"} <= codes(repo)


def test_structure_rules(repo: Path) -> None:
    src = make_service(repo)
    (src / "modules/items/dependencies.py").unlink()
    (src / "modules/items/helpers.py").write_text("x = 1\n")
    (src / "modules/loose.py").write_text("x = 1\n")
    assert {"STR001", "STR002", "STR003"} <= codes(repo)


def test_inline_suppression_and_project_ignore(repo: Path) -> None:
    src = make_service(repo)
    f = src / "modules/items/service.py"
    f.write_text(f.read_text() + '\nprint("debug")  # dx: ignore[LOG001]\n')
    assert "LOG001" not in codes(repo)


def test_sql_injection_pattern(repo: Path) -> None:
    src = make_service(repo)
    f = src / "modules/items/repository.py"
    # Deliberately injectable SQL: the point of the test is that SQL001 catches it.
    bad_query = 'def bad(name: str):\n    return text(f"SELECT * FROM t WHERE n = {name}")\n'
    f.write_text(f.read_text() + "\n\n" + bad_query)
    assert "SQL001" in codes(repo)


def test_single_file_scope(repo: Path) -> None:
    src = make_service(repo)
    (src / "modules/items/service.py").write_text((src / "modules/items/service.py").read_text() + "\nprint(1)\n")
    only_router = run_checks(load_config(repo), [src / "modules/items/router.py"])
    assert not [v for v in only_router if v.code == "LOG001"]


def test_monolith_refuses_second_service(repo: Path) -> None:
    py = repo / "pyproject.toml"
    py.write_text(py.read_text().replace('"microservices"', '"monolith"'))
    make_service(repo)
    with pytest.raises(SystemExit, match="modular monolith"):
        new_service(load_config(repo), "billing")


def test_mem_engine_and_http_client_inside_functions(repo: Path) -> None:
    src = make_service(repo)
    f = src / "modules/items/service.py"
    f.write_text(
        f.read_text()
        + textwrap.dedent(
            """

            def _bad_engine():
                from sqlalchemy.ext.asyncio import create_async_engine
                return create_async_engine("sqlite+aiosqlite://")

            async def _bad_client():
                import httpx
                return httpx.AsyncClient()
            """
        )
    )
    found = codes(repo)
    assert "MEM001" in found
    assert "MEM002" in found


def test_code_session_commit_outside_repository(repo: Path) -> None:
    src = make_service(repo)
    f = src / "modules/items/service.py"
    f.write_text(
        f.read_text()
        + textwrap.dedent(
            """

            async def _bad_commit(self, session):
                await session.commit()
            """
        )
    )
    assert "CODE001" in codes(repo)


def test_mem_module_level_mutable_cache(repo: Path) -> None:
    src = make_service(repo)
    f = src / "modules/items/service.py"
    f.write_text("_cache = {}\n" + f.read_text())
    assert "MEM003" in codes(repo)


def test_tenant_scoped_module_must_bind_tenant(repo: Path) -> None:
    src = make_service(repo)
    models = src / "modules/items/models.py"
    models.write_text(models.read_text() + "\n\nclass Scoped:\n    tenant_id: str\n")
    assert "TEN001" in codes(repo)

    router = src / "modules/items/router.py"
    router.write_text("from platform_kit.tenancy import TenantIdDep\n" + router.read_text())
    assert "TEN001" not in codes(repo)
