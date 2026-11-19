"""API tests for tenant-scoped catalog items."""

import uuid

from core_api.permissions import Resource

BASE = "/api/v1/items"
CATS = "/api/v1/categories"


def perm(action: str) -> str:
    return f"{Resource.ITEM.value}:{action}"


def cat_perm(action: str) -> str:
    return f"{Resource.CATEGORY.value}:{action}"


def _item_body(**overrides: object) -> dict[str, object]:
    body: dict[str, object] = {
        "name": "Widget",
        "sku": "WDG-1",
        "status": "draft",
        "description": "A widget",
    }
    body.update(overrides)
    return body


async def test_create_then_get(client, auth, grant_catalog) -> None:
    tid = str(uuid.uuid4())
    await grant_catalog(tid)
    headers = auth(perm("create"), perm("read"), tid=tid)
    created = await client.post(BASE, json=_item_body(), headers=headers)
    assert created.status_code == 201, created.text
    item_id = created.json()["id"]
    assert created.json()["tenant_id"] == tid
    assert created.json()["sku"] == "WDG-1"

    fetched = await client.get(f"{BASE}/{item_id}", headers=headers)
    assert fetched.status_code == 200
    assert fetched.json()["name"] == "Widget"


async def test_list_returns_total_and_filters(client, auth, grant_catalog) -> None:
    tid = str(uuid.uuid4())
    await grant_catalog(tid)
    headers = auth(perm("create"), perm("list"), tid=tid)
    await client.post(BASE, json=_item_body(name="Alpha", sku="A-1", status="active"), headers=headers)
    await client.post(BASE, json=_item_body(name="Beta", sku="B-1", status="draft"), headers=headers)

    listed = await client.get(f"{BASE}?status=active&page=1&pageSize=10", headers=headers)
    assert listed.status_code == 200, listed.text
    body = listed.json()
    assert body["total"] == 1
    assert body["items"][0]["name"] == "Alpha"


async def test_tenant_isolation(client, auth, grant_catalog) -> None:
    a, b = str(uuid.uuid4()), str(uuid.uuid4())
    await grant_catalog(a)
    await grant_catalog(b)
    headers_a = auth(perm("create"), perm("read"), perm("list"), tid=a)
    headers_b = auth(perm("read"), perm("list"), tid=b)

    created = await client.post(BASE, json=_item_body(), headers=headers_a)
    item_id = created.json()["id"]

    assert (await client.get(f"{BASE}/{item_id}", headers=headers_b)).status_code == 404
    listed = await client.get(BASE, headers=headers_b)
    assert listed.json()["total"] == 0


async def test_category_association(client, auth, grant_catalog) -> None:
    tid = str(uuid.uuid4())
    await grant_catalog(tid)
    headers = auth(
        perm("create"),
        perm("read"),
        cat_perm("create"),
        tid=tid,
    )
    cat = await client.post(CATS, json={"name": "Hardware"}, headers=headers)
    assert cat.status_code == 201, cat.text
    category_id = cat.json()["id"]

    created = await client.post(BASE, json=_item_body(category_id=category_id, sku="HW-1"), headers=headers)
    assert created.status_code == 201, created.text
    assert created.json()["category_id"] == category_id


async def test_catalog_feature_required(client, auth, grant_catalog) -> None:
    tid = str(uuid.uuid4())
    await grant_catalog(tid, catalog=False)
    headers = auth(perm("create"), tid=tid)
    response = await client.post(BASE, json=_item_body(), headers=headers)
    assert response.status_code == 403, response.text


async def test_requires_authentication(client) -> None:
    response = await client.get(BASE)
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthorized"


async def test_requires_permission(client, auth, grant_catalog) -> None:
    tid = str(uuid.uuid4())
    await grant_catalog(tid)
    response = await client.post(BASE, json=_item_body(), headers=auth(perm("read"), tid=tid))
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "forbidden"


async def test_not_found_uses_error_envelope(client, auth, grant_catalog) -> None:
    tid = str(uuid.uuid4())
    await grant_catalog(tid)
    response = await client.get(f"{BASE}/{uuid.uuid4()}", headers=auth(perm("read"), tid=tid))
    assert response.status_code == 404
    error = response.json()["error"]
    assert error["code"] == "item_not_found"
    assert error["request_id"] == response.headers["x-request-id"]


async def test_validation_error_lists_fields(client, auth, grant_catalog) -> None:
    tid = str(uuid.uuid4())
    await grant_catalog(tid)
    response = await client.post(BASE, json={"name": "", "sku": "X"}, headers=auth(perm("create"), tid=tid))
    assert response.status_code == 422
    assert response.json()["error"]["fields"][0]["field"] == "body.name"


async def test_duplicate_name_conflicts(client, auth, grant_catalog) -> None:
    tid = str(uuid.uuid4())
    await grant_catalog(tid)
    headers = auth(perm("create"), tid=tid)
    await client.post(BASE, json=_item_body(name="dup", sku="D-1"), headers=headers)
    response = await client.post(BASE, json=_item_body(name="dup", sku="D-2"), headers=headers)
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "item_name_taken"
