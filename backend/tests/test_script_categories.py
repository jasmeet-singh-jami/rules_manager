import uuid
import pytest


def _slug(prefix: str = "sc") -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


async def _make_client(authed_client, code="SC"):
    r = await authed_client.post("/api/clients", json={"code": f"{code}{uuid.uuid4().hex[:4]}", "name": "SC Test"})
    return r.json()["id"]


async def _create_cat(authed_client, **overrides):
    body = {
        "slug": _slug(),
        "name": "Test Script Cat",
        "file_extension": ".sh",
        "mime_type": "text/plain",
    }
    body.update(overrides)
    r = await authed_client.post("/api/script-categories", json=body)
    return r


async def _register_contributor(client, username_prefix="contrib"):
    username = f"{username_prefix}_{uuid.uuid4().hex[:6]}"
    reg = await client.post("/api/auth/register", json={"username": username, "password": "pw"})
    return reg.json()["token"]


# ── Auth ─────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_script_category_requires_admin(client):
    token = await _register_contributor(client)
    r = await client.post(
        "/api/script-categories",
        json={"slug": _slug(), "name": "X", "file_extension": ".sh", "mime_type": "text/plain"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_patch_script_category_requires_admin(client, authed_client):
    cat = (await _create_cat(authed_client)).json()
    token = await _register_contributor(client)
    r = await client.patch(
        f"/api/script-categories/{cat['id']}",
        json={"name": "Renamed"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_delete_script_category_requires_admin(client, authed_client):
    cat = (await _create_cat(authed_client)).json()
    token = await _register_contributor(client)
    r = await client.delete(
        f"/api/script-categories/{cat['id']}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 403


# ── Create ───────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_script_category_basic(authed_client):
    slug = _slug()
    r = await authed_client.post(
        "/api/script-categories",
        json={"slug": slug, "name": "Bash Stuff", "file_extension": ".sh", "mime_type": "text/x-sh"},
    )
    assert r.status_code == 201
    data = r.json()
    assert data["slug"] == slug
    assert data["file_extension"] == ".sh"
    assert data["mime_type"] == "text/x-sh"


@pytest.mark.asyncio
async def test_create_script_category_auto_assigns_sort_order(authed_client):
    listing = await authed_client.get("/api/script-categories")
    existing_max = max((c["sort_order"] for c in listing.json()), default=0)
    r = await _create_cat(authed_client)
    assert r.status_code == 201
    assert r.json()["sort_order"] == existing_max + 1


@pytest.mark.asyncio
async def test_create_script_category_duplicate_slug_returns_409(authed_client):
    slug = _slug()
    first = await _create_cat(authed_client, slug=slug)
    assert first.status_code == 201
    second = await _create_cat(authed_client, slug=slug)
    assert second.status_code == 409


@pytest.mark.asyncio
async def test_create_script_category_invalid_slug_returns_422(authed_client):
    r = await _create_cat(authed_client, slug="Invalid Slug!")
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_create_script_category_invalid_file_extension_returns_422(authed_client):
    r = await _create_cat(authed_client, file_extension="sh")  # missing leading dot
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_create_script_category_empty_mime_type_returns_422(authed_client):
    r = await _create_cat(authed_client, mime_type="   ")
    assert r.status_code == 422


# ── Patch ────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_patch_script_category_renames_and_updates_extension(authed_client):
    cat = (await _create_cat(authed_client)).json()
    r = await authed_client.patch(
        f"/api/script-categories/{cat['id']}",
        json={"name": "Renamed", "file_extension": ".bash", "mime_type": "application/x-sh"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["name"] == "Renamed"
    assert data["file_extension"] == ".bash"
    assert data["mime_type"] == "application/x-sh"


@pytest.mark.asyncio
async def test_patch_script_category_slug_immutable(authed_client):
    cat = (await _create_cat(authed_client)).json()
    r = await authed_client.patch(
        f"/api/script-categories/{cat['id']}",
        json={"slug": _slug()},
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_patch_script_category_invalid_extension_returns_422(authed_client):
    cat = (await _create_cat(authed_client)).json()
    r = await authed_client.patch(
        f"/api/script-categories/{cat['id']}",
        json={"file_extension": "noprefix"},
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_patch_script_category_unknown_returns_404(authed_client):
    r = await authed_client.patch(
        f"/api/script-categories/{uuid.uuid4()}",
        json={"name": "Renamed"},
    )
    assert r.status_code == 404


# ── Reorder ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_reorder_script_categories_happy_path(authed_client):
    a = (await _create_cat(authed_client, sort_order=800)).json()
    b = (await _create_cat(authed_client, sort_order=801)).json()
    r = await authed_client.post(
        "/api/script-categories/reorder",
        json=[{"id": a["id"], "sort_order": 811}, {"id": b["id"], "sort_order": 810}],
    )
    assert r.status_code == 204
    listing = {c["id"]: c["sort_order"] for c in (await authed_client.get("/api/script-categories")).json()}
    assert listing[a["id"]] == 811
    assert listing[b["id"]] == 810


@pytest.mark.asyncio
async def test_reorder_script_categories_duplicate_sort_order_returns_422(authed_client):
    a = (await _create_cat(authed_client, sort_order=900)).json()
    b = (await _create_cat(authed_client, sort_order=901)).json()
    r = await authed_client.post(
        "/api/script-categories/reorder",
        json=[{"id": a["id"], "sort_order": 1000}, {"id": b["id"], "sort_order": 1000}],
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_reorder_script_categories_unknown_id_returns_404(authed_client):
    r = await authed_client.post(
        "/api/script-categories/reorder",
        json=[{"id": str(uuid.uuid4()), "sort_order": 1}],
    )
    assert r.status_code == 404


# ── Delete ───────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_delete_script_category_no_attachments(authed_client):
    cat = (await _create_cat(authed_client)).json()
    r = await authed_client.delete(f"/api/script-categories/{cat['id']}")
    assert r.status_code == 204
    listing = await authed_client.get("/api/script-categories")
    assert all(c["id"] != cat["id"] for c in listing.json())


@pytest.mark.asyncio
async def test_delete_script_category_unknown_returns_404(authed_client):
    r = await authed_client.delete(f"/api/script-categories/{uuid.uuid4()}")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_delete_script_category_with_jobs_no_reassign_returns_409(authed_client, tmp_path, monkeypatch):
    monkeypatch.setenv("UPLOADS_DIR", str(tmp_path))
    cat = (await _create_cat(authed_client)).json()
    client_id = await _make_client(authed_client)
    job = await authed_client.post(
        "/api/cron-jobs",
        data={
            "client_id": client_id,
            "name": "Test Job",
            "description": "x",
            "script": "echo hi",
            "script_type": cat["slug"],
        },
    )
    assert job.status_code == 201

    r = await authed_client.delete(f"/api/script-categories/{cat['id']}")
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_delete_script_category_with_jobs_reassigns_then_deletes(authed_client, tmp_path, monkeypatch):
    monkeypatch.setenv("UPLOADS_DIR", str(tmp_path))
    src = (await _create_cat(authed_client)).json()
    dst = (await _create_cat(authed_client)).json()
    client_id = await _make_client(authed_client)
    job = await authed_client.post(
        "/api/cron-jobs",
        data={
            "client_id": client_id,
            "name": "Reassign Job",
            "description": "x",
            "script": "echo hi",
            "script_type": src["slug"],
        },
    )
    job_id = job.json()["id"]

    r = await authed_client.delete(f"/api/script-categories/{src['id']}?reassign_to={dst['id']}")
    assert r.status_code == 204

    jobs = (await authed_client.get(f"/api/cron-jobs?client_id={client_id}")).json()
    moved = next(j for j in jobs if j["id"] == job_id)
    assert moved["script_category_id"] == dst["id"]
    assert moved["script_category"]["slug"] == dst["slug"]


@pytest.mark.asyncio
async def test_delete_script_category_reassign_to_self_returns_422(authed_client):
    cat = (await _create_cat(authed_client)).json()
    r = await authed_client.delete(f"/api/script-categories/{cat['id']}?reassign_to={cat['id']}")
    assert r.status_code == 422
