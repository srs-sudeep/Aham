"""`platform_kit.__all__` is literal, so this guards it against drifting from `_EXPORTS`."""

import platform_kit
from platform_kit import _EXPORTS


def test_all_matches_exports() -> None:
    # Compared as sets: the *contents* must not drift, while the order of `__all__`
    # is ruff's call (RUF022 sorts SCREAMING_CASE ahead of CamelCase, `sorted()` does not).
    assert set(platform_kit.__all__) == set(_EXPORTS)
    assert len(platform_kit.__all__) == len(_EXPORTS)


def test_every_export_resolves() -> None:
    for name in _EXPORTS:
        assert getattr(platform_kit, name) is not None


def test_unknown_attribute_raises() -> None:
    try:
        platform_kit.does_not_exist  # noqa: B018
    except AttributeError as exc:
        assert "does_not_exist" in str(exc)
    else:
        raise AssertionError("expected AttributeError")
