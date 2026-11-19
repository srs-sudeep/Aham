"""API tests: real app, real DB (SQLite locally, Postgres in CI), real auth + RBAC + error envelope."""

import uuid

from core_api.permissions import Resource

BASE = "/api/v1/items"


def perm(action: str) -> str:
    return f"{Resource.ITEM.value}:{action}"


async def test_create_then_get(client, auth) -> None:
    created = await client.post(BASE, json={"name": "first"}, headers=auth(perm("create")))
    assert created.status_code == 201, created.text
    item_id = created.json()["id"]

    fetched = await client.get(f"{BASE}/{item_id}", headers=auth(perm("read")))
    assert fetched.status_code == 200
    assert fetched.json()["name"] == "first"


async def test_requires_authentication(client) -> None:
    response = await client.get(BASE)
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthorized"


async def test_requires_permission(client, auth) -> None:
    response = await client.post(BASE, json={"name": "x"}, headers=auth(perm("read")))
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "forbidden"


async def test_not_found_uses_error_envelope(client, auth) -> None:
    response = await client.get(f"{BASE}/{uuid.uuid4()}", headers=auth(perm("read")))
    assert response.status_code == 404
    error = response.json()["error"]
    assert error["code"] == "item_not_found"
    assert error["request_id"] == response.headers["x-request-id"]


async def test_validation_error_lists_fields(client, auth) -> None:
    response = await client.post(BASE, json={"name": ""}, headers=auth(perm("create")))
    assert response.status_code == 422
    assert response.json()["error"]["fields"][0]["field"] == "body.name"


async def test_duplicate_name_conflicts(client, auth) -> None:
    headers = auth(perm("create"))
    await client.post(BASE, json={"name": "dup"}, headers=headers)
    response = await client.post(BASE, json={"name": "dup"}, headers=headers)
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "item_name_taken"
