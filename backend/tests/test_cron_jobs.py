import io
import pytest


async def _make_client(authed_client, code="INFY"):
    r = await authed_client.post("/api/clients", json={"code": code, "name": code})
    return r.json()["id"]


async def _upload_job(authed_client, client_id, tmp_path, monkeypatch):
    monkeypatch.setenv("UPLOADS_DIR", str(tmp_path))
    content = b"#!/bin/bash\necho hello"
    r = await authed_client.post(
        "/api/cron-jobs",
        data={"client_id": client_id, "name": "Nightly Sync"},
        files={"file": ("sync.sh", io.BytesIO(content), "application/x-sh")},
    )
    return r, content


@pytest.mark.asyncio
async def test_list_cron_jobs_empty(authed_client):
    r = await authed_client.get("/api/cron-jobs")
    assert r.status_code == 200
    assert r.json() == []


@pytest.mark.asyncio
async def test_upload_cron_job(authed_client, tmp_path, monkeypatch):
    client_id = await _make_client(authed_client)
    r, content = await _upload_job(authed_client, client_id, tmp_path, monkeypatch)
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "Nightly Sync"
    assert data["filename"] == "sync.sh"
    assert data["file_size"] == len(content)
    assert data["client_id"] == client_id


@pytest.mark.asyncio
async def test_list_cron_jobs_filtered_by_client(authed_client, tmp_path, monkeypatch):
    c1 = await _make_client(authed_client, "C1")
    c2 = await _make_client(authed_client, "C2")
    await _upload_job(authed_client, c1, tmp_path, monkeypatch)
    await _upload_job(authed_client, c2, tmp_path, monkeypatch)
    r = await authed_client.get(f"/api/cron-jobs?client_id={c1}")
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 1
    assert data[0]["client_id"] == c1


@pytest.mark.asyncio
async def test_download_cron_job(authed_client, tmp_path, monkeypatch):
    client_id = await _make_client(authed_client)
    r, content = await _upload_job(authed_client, client_id, tmp_path, monkeypatch)
    job_id = r.json()["id"]
    dl = await authed_client.get(f"/api/cron-jobs/{job_id}/download")
    assert dl.status_code == 200
    assert dl.content == content


@pytest.mark.asyncio
async def test_download_nonexistent_cron_job(authed_client):
    r = await authed_client.get("/api/cron-jobs/00000000-0000-0000-0000-000000000000/download")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_delete_cron_job(authed_client, tmp_path, monkeypatch):
    client_id = await _make_client(authed_client)
    r, _ = await _upload_job(authed_client, client_id, tmp_path, monkeypatch)
    job_id = r.json()["id"]
    del_r = await authed_client.delete(f"/api/cron-jobs/{job_id}")
    assert del_r.status_code == 204
    list_r = await authed_client.get(f"/api/cron-jobs?client_id={client_id}")
    assert all(j["id"] != job_id for j in list_r.json())


@pytest.mark.asyncio
async def test_delete_nonexistent_cron_job(authed_client):
    r = await authed_client.delete("/api/cron-jobs/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 404
