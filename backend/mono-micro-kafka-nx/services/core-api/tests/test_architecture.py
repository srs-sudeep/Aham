"""Structure & RBAC rules are tests too, so they can never be skipped."""

from platform_kit.cli.checks import run_checks
from platform_kit.cli.config import load_config
from platform_kit.testing import assert_all_routes_protected


def test_every_route_declares_a_permission() -> None:
    from core_api.main import app

    assert_all_routes_protected(app)


def test_codebase_follows_the_approved_structure() -> None:
    violations = run_checks(load_config(), service="core-api")
    assert not violations, "\n" + "\n".join(map(str, violations))
