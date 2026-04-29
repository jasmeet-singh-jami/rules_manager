import io
import uuid
import pytest


def _slug(prefix: str = "kb") -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


async def _make_client(authed_client, code="KB"):
    r = await authed_client.post("/api/clients", json={"code": f"{code}{uuid.uuid4().hex[:4]}", "name": "KB Test"})
    return r.json()["id"]


async def _create_cat(authed_client, **overrides):
    body = {"slug": _slug(), "name": "Test Cat"}
    body.update(overrides)
    r = await authed_client.post("/api/kb-categories", json=body)
    return r


async def _register_contributor(client, username_prefix="contrib"):
    username = f"{username_prefix}_{uuid.uuid4().hex[:6]}"
    reg = await client.post("/api/auth/register", json={"username": username, "password": "pw"})
    return reg.json()["token"]


# ── Auth ─────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_kb_category_requires_admin(client):
    token = await _register_contributor(client)
    r = await client.post(
        "/api/kb-categories",
        json={"slug": _slug(), "name": "Test"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_patch_kb_category_requires_admin(client, authed_client):
    created = await _create_cat(authed_client)
    cat_id = created.json()["id"]
    token = await _register_contributor(client)
    r = await client.patch(
        f"/api/kb-categories/{cat_id}",
        json={"name": "Renamed"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_delete_kb_category_requires_admin(client, authed_client):
    created = await _create_cat(authed_client)
    cat_id = created.json()["id"]
    token = await _register_contributor(client)
    r = await client.delete(
        f"/api/kb-categories/{cat_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 403


# ── Create ───────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_kb_category_basic(authed_client):
    slug = _slug()
    r = await authed_client.post("/api/kb-categories", json={"slug": slug, "name": "Runbooks"})
    assert r.status_code == 201
    data = r.json()
    assert data["slug"] == slug
    assert data["name"] == "Runbooks"
    assert isinstance(data["sort_order"], int)


@pytest.mark.asyncio
async def test_create_kb_category_auto_assigns_sort_order(authed_client):
    listing = await authed_client.get("/api/kb-categories")
    existing_max = max((c["sort_order"] for c in listing.json()), default=0)
    r = await authed_client.post("/api/kb-categories", json={"slug": _slug(), "name": "Auto Sort"})
    assert r.status_code == 201
    assert r.json()["sort_order"] == existing_max + 1


@pytest.mark.asyncio
async def test_create_kb_category_explicit_sort_order(authed_client):
    r = await authed_client.post(
        "/api/kb-categories",
        json={"slug": _slug(), "name": "Explicit", "sort_order": 999},
    )
    assert r.status_code == 201
    assert r.json()["sort_order"] == 999


@pytest.mark.asyncio
async def test_create_kb_category_duplicate_slug_returns_409(authed_client):
    slug = _slug()
    first = await authed_client.post("/api/kb-categories", json={"slug": slug, "name": "First"})
    assert first.status_code == 201
    second = await authed_client.post("/api/kb-categories", json={"slug": slug, "name": "Second"})
    assert second.status_code == 409


@pytest.mark.asyncio
async def test_create_kb_category_invalid_slug_returns_422(authed_client):
    r = await authed_client.post("/api/kb-categories", json={"slug": "Invalid Slug!", "name": "X"})
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_create_kb_category_empty_name_returns_422(authed_client):
    r = await authed_client.post("/api/kb-categories", json={"slug": _slug(), "name": "   "})
    assert r.status_code == 422


# ── Patch ────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_patch_kb_category_renames(authed_client):
    created = await _create_cat(authed_client)
    cat_id = created.json()["id"]
    r = await authed_client.patch(f"/api/kb-categories/{cat_id}", json={"name": "Renamed"})
    assert r.status_code == 200
    assert r.json()["name"] == "Renamed"


@pytest.mark.asyncio
async def test_patch_kb_category_slug_immutable(authed_client):
    created = await _create_cat(authed_client)
    cat_id = created.json()["id"]
    r = await authed_client.patch(
        f"/api/kb-categories/{cat_id}",
        json={"slug": _slug(), "name": "Renamed"},
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_patch_kb_category_unknown_returns_404(authed_client):
    r = await authed_client.patch(
        f"/api/kb-categories/{uuid.uuid4()}",
        json={"name": "Renamed"},
    )
    assert r.status_code == 404


# ── Reorder ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_reorder_kb_categories_happy_path(authed_client):
    a = (await _create_cat(authed_client, sort_order=500)).json()
    b = (await _create_cat(authed_client, sort_order=501)).json()
    r = await authed_client.post(
        "/api/kb-categories/reorder",
        json=[{"id": a["id"], "sort_order": 511}, {"id": b["id"], "sort_order": 510}],
    )
    assert r.status_code == 204
    listing = {c["id"]: c["sort_order"] for c in (await authed_client.get("/api/kb-categories")).json()}
    assert listing[a["id"]] == 511
    assert listing[b["id"]] == 510


@pytest.mark.asyncio
async def test_reorder_kb_categories_duplicate_sort_order_returns_422(authed_client):
    a = (await _create_cat(authed_client, sort_order=600)).json()
    b = (await _create_cat(authed_client, sort_order=601)).json()
    r = await authed_client.post(
        "/api/kb-categories/reorder",
        json=[{"id": a["id"], "sort_order": 700}, {"id": b["id"], "sort_order": 700}],
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_reorder_kb_categories_unknown_id_returns_404(authed_client):
    r = await authed_client.post(
        "/api/kb-categories/reorder",
        json=[{"id": str(uuid.uuid4()), "sort_order": 1}],
    )
    assert r.status_code == 404


# ── Delete ───────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_delete_kb_category_no_attachments(authed_client):
    created = (await _create_cat(authed_client)).json()
    r = await authed_client.delete(f"/api/kb-categories/{created['id']}")
    assert r.status_code == 204
    listing = await authed_client.get("/api/kb-categories")
    assert all(c["id"] != created["id"] for c in listing.json())


@pytest.mark.asyncio
async def test_delete_kb_category_unknown_returns_404(authed_client):
    r = await authed_client.delete(f"/api/kb-categories/{uuid.uuid4()}")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_delete_kb_category_with_docs_no_reassign_returns_409(authed_client, tmp_path, monkeypatch):
    monkeypatch.setenv("UPLOADS_DIR", str(tmp_path))
    cat = (await _create_cat(authed_client)).json()
    client_id = await _make_client(authed_client)
    upload = await authed_client.post(
        "/api/knowledge",
        data={"client_id": client_id, "category": cat["slug"], "name": "Doc"},
        files={"file": ("f.txt", io.BytesIO(b"hi"), "text/plain")},
    )
    assert upload.status_code == 201

    r = await authed_client.delete(f"/api/kb-categories/{cat['id']}")
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_delete_kb_category_with_docs_reassigns_then_deletes(authed_client, tmp_path, monkeypatch):
    monkeypatch.setenv("UPLOADS_DIR", str(tmp_path))
    src = (await _create_cat(authed_client)).json()
    dst = (await _create_cat(authed_client)).json()
    client_id = await _make_client(authed_client)
    upload = await authed_client.post(
        "/api/knowledge",
        data={"client_id": client_id, "category": src["slug"], "name": "Doc"},
        files={"file": ("f.txt", io.BytesIO(b"hi"), "text/plain")},
    )
    doc_id = upload.json()["id"]

    r = await authed_client.delete(f"/api/kb-categories/{src['id']}?reassign_to={dst['id']}")
    assert r.status_code == 204

    docs = (await authed_client.get(f"/api/knowledge?client_id={client_id}")).json()
    moved = next(d for d in docs if d["id"] == doc_id)
    assert moved["kb_category_id"] == dst["id"]
    assert moved["kb_category"]["slug"] == dst["slug"]

    listing = await authed_client.get("/api/kb-categories")
    assert all(c["id"] != src["id"] for c in listing.json())


@pytest.mark.asyncio
async def test_delete_kb_category_reassign_to_self_returns_422(authed_client):
    cat = (await _create_cat(authed_client)).json()
    r = await authed_client.delete(f"/api/kb-categories/{cat['id']}?reassign_to={cat['id']}")
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_delete_kb_category_reassign_to_unknown_returns_404(authed_client, tmp_path, monkeypatch):
    monkeypatch.setenv("UPLOADS_DIR", str(tmp_path))
    cat = (await _create_cat(authed_client)).json()
    client_id = await _make_client(authed_client)
    await authed_client.post(
        "/api/knowledge",
        data={"client_id": client_id, "category": cat["slug"], "name": "Doc"},
        files={"file": ("f.txt", io.BytesIO(b"hi"), "text/plain")},
    )
    r = await authed_client.delete(f"/api/kb-categories/{cat['id']}?reassign_to={uuid.uuid4()}")
    assert r.status_code == 404
