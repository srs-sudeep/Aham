"""API tests for the SaaS identity session flow: register/login, refresh cookie rotation, tenants, logout."""

import uuid

import httpx

AUTH = "/api/v1/auth"
PASSWORD = "correct-horse-battery"


def _refresh_cookie(response: httpx.Response) -> str:
    header = next(h for h in response.headers.get_list("set-cookie") if h.startswith("refresh_token="))
    assert "HttpOnly" in header
    assert "Path=/api/v1/auth" in header
    return header.split(";", 1)[0].split("=", 1)[1]


async def _register(client: httpx.AsyncClient) -> tuple[dict, str, str]:
    slug = f"acme-{uuid.uuid4().hex[:8]}"
    email = f"{slug}@example.com"
    response = await client.post(
        f"{AUTH}/register",
        json={"email": email, "password": PASSWORD, "tenant_name": "Acme", "tenant_slug": slug},
    )
    assert response.status_code == 201, response.text
    return response.json(), _refresh_cookie(response), email


async def test_register_sets_refresh_cookie_and_lists_tenant(client) -> None:
    tokens, _, _ = await _register(client)
    assert tokens["access_token"]
    assert tokens["tenant_id"]

    tenants = await client.get(f"{AUTH}/tenants", headers={"Authorization": f"Bearer {tokens['access_token']}"})
    assert tenants.status_code == 200, tenants.text
    assert [t["tenant_id"] for t in tenants.json()] == [tokens["tenant_id"]]


async def test_refresh_from_cookie_rotates_token(client) -> None:
    _, cookie, _ = await _register(client)

    refreshed = await client.post(f"{AUTH}/refresh", headers={"Cookie": f"refresh_token={cookie}"})
    assert refreshed.status_code == 200, refreshed.text
    assert refreshed.json()["access_token"]
    rotated = _refresh_cookie(refreshed)
    assert rotated != cookie

    reused = await client.post(f"{AUTH}/refresh", headers={"Cookie": f"refresh_token={cookie}"})
    assert reused.status_code == 401


async def test_refresh_without_token_is_unauthorized(client) -> None:
    response = await client.post(f"{AUTH}/refresh")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthorized"


async def test_login_then_logout_revokes_and_clears_cookie(client) -> None:
    _, _, email = await _register(client)
    login = await client.post(f"{AUTH}/login", json={"email": email, "password": PASSWORD})
    assert login.status_code == 200, login.text
    cookie = _refresh_cookie(login)

    logout = await client.post(f"{AUTH}/logout", headers={"Cookie": f"refresh_token={cookie}"})
    assert logout.status_code == 200
    cleared = next(h for h in logout.headers.get_list("set-cookie") if h.startswith("refresh_token="))
    assert 'refresh_token=""' in cleared or "Max-Age=0" in cleared

    after = await client.post(f"{AUTH}/refresh", headers={"Cookie": f"refresh_token={cookie}"})
    assert after.status_code == 401


async def test_wrong_password_is_rejected(client) -> None:
    _, _, email = await _register(client)
    response = await client.post(f"{AUTH}/login", json={"email": email, "password": "wrong-password-123"})
    assert response.status_code == 401
