import io
import pytest


async def _make_client(authed_client, code="INFY"):
    r = await authed_client.post("/api/clients", json={"code": code, "name": code})
    return r.json()["id"]


async def _upload_doc(authed_client, client_id, tmp_path, monkeypatch, category="integrations"):
    monkeypatch.setenv("UPLOADS_DIR", str(tmp_path))
    content = b"test document content"
    r = await authed_client.post(
        "/api/knowledge",
        data={"client_id": client_id, "category": category, "name": "Test Doc"},
        files={"file": ("test.txt", io.BytesIO(content), "text/plain")},
    )
    return r, content


@pytest.mark.asyncio
async def test_list_knowledge_docs_empty(authed_client):
    r = await authed_client.get("/api/knowledge")
    assert r.status_code == 200
    assert r.json() == []


@pytest.mark.asyncio
async def test_upload_knowledge_doc(authed_client, tmp_path, monkeypatch):
    client_id = await _make_client(authed_client)
    r, content = await _upload_doc(authed_client, client_id, tmp_path, monkeypatch)
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "Test Doc"
    assert data["category"] == "integrations"
    assert data["filename"] == "test.txt"
    assert data["file_size"] == len(content)
    assert data["client_id"] == client_id


@pytest.mark.asyncio
async def test_upload_invalid_category(authed_client, tmp_path, monkeypatch):
    monkeypatch.setenv("UPLOADS_DIR", str(tmp_path))
    client_id = await _make_client(authed_client)
    r = await authed_client.post(
        "/api/knowledge",
        data={"client_id": client_id, "category": "invalid", "name": "Doc"},
        files={"file": ("f.txt", io.BytesIO(b"x"), "text/plain")},
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_list_knowledge_docs_filtered_by_client(authed_client, tmp_path, monkeypatch):
    c1 = await _make_client(authed_client, "C1")
    c2 = await _make_client(authed_client, "C2")
    await _upload_doc(authed_client, c1, tmp_path, monkeypatch)
    await _upload_doc(authed_client, c2, tmp_path, monkeypatch)
    r = await authed_client.get(f"/api/knowledge?client_id={c1}")
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 1
    assert data[0]["client_id"] == c1


@pytest.mark.asyncio
async def test_list_knowledge_docs_filtered_by_category(authed_client, tmp_path, monkeypatch):
    client_id = await _make_client(authed_client)
    await _upload_doc(authed_client, client_id, tmp_path, monkeypatch, category="integrations")
    await _upload_doc(authed_client, client_id, tmp_path, monkeypatch, category="issues")
    r = await authed_client.get("/api/knowledge?category=integrations")
    assert r.status_code == 200
    assert all(d["category"] == "integrations" for d in r.json())


@pytest.mark.asyncio
async def test_download_knowledge_doc(authed_client, tmp_path, monkeypatch):
    client_id = await _make_client(authed_client)
    r, content = await _upload_doc(authed_client, client_id, tmp_path, monkeypatch)
    doc_id = r.json()["id"]
    dl = await authed_client.get(f"/api/knowledge/{doc_id}/download")
    assert dl.status_code == 200
    assert dl.content == content


@pytest.mark.asyncio
async def test_download_nonexistent_doc(authed_client):
    r = await authed_client.get("/api/knowledge/00000000-0000-0000-0000-000000000000/download")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_delete_knowledge_doc(authed_client, tmp_path, monkeypatch):
    client_id = await _make_client(authed_client)
    r, _ = await _upload_doc(authed_client, client_id, tmp_path, monkeypatch)
    doc_id = r.json()["id"]
    del_r = await authed_client.delete(f"/api/knowledge/{doc_id}")
    assert del_r.status_code == 204
    list_r = await authed_client.get(f"/api/knowledge?client_id={client_id}")
    assert all(d["id"] != doc_id for d in list_r.json())


@pytest.mark.asyncio
async def test_delete_nonexistent_doc(authed_client):
    r = await authed_client.delete("/api/knowledge/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 404
