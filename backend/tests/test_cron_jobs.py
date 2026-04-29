import uuid
import pytest


async def _make_client(authed_client, code="INFY"):
    r = await authed_client.post("/api/clients", json={"code": code, "name": code})
    return r.json()["id"]


async def _upload_job(authed_client, client_id, tmp_path, monkeypatch, script_type="shell"):
    monkeypatch.setenv("UPLOADS_DIR", str(tmp_path))
    script = "#!/bin/bash\necho hello"
    r = await authed_client.post(
        "/api/cron-jobs",
        data={
            "client_id": client_id,
            "name": "Nightly Sync",
            "description": "Test job",
            "script": script,
            "script_type": script_type,
        },
    )
    return r, script.encode("utf-8")


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
    assert data["filename"] == "nightly_sync.sh"
    assert data["file_size"] == len(content)
    assert data["client_id"] == client_id
    assert data["script_category"]["slug"] == "shell"


@pytest.mark.asyncio
async def test_upload_cron_job_powershell(authed_client, tmp_path, monkeypatch):
    client_id = await _make_client(authed_client, "PS1")
    r, _ = await _upload_job(authed_client, client_id, tmp_path, monkeypatch, script_type="powershell")
    assert r.status_code == 201
    data = r.json()
    assert data["filename"].endswith(".ps1")
    assert data["script_category"]["slug"] == "powershell"


@pytest.mark.asyncio
async def test_upload_cron_job_unknown_script_type(authed_client, tmp_path, monkeypatch):
    client_id = await _make_client(authed_client, "UNK")
    monkeypatch.setenv("UPLOADS_DIR", str(tmp_path))
    r = await authed_client.post(
        "/api/cron-jobs",
        data={
            "client_id": client_id,
            "name": "Bad Script",
            "description": "x",
            "script": "echo hi",
            "script_type": "nonexistent",
        },
    )
    assert r.status_code == 422


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
async def test_list_cron_jobs_filtered_by_script_type(authed_client, tmp_path, monkeypatch):
    c1 = await _make_client(authed_client, "ST1")
    await _upload_job(authed_client, c1, tmp_path, monkeypatch, script_type="shell")
    await _upload_job(authed_client, c1, tmp_path, monkeypatch, script_type="python")
    r = await authed_client.get(f"/api/cron-jobs?script_type=python")
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 1
    assert data[0]["script_category"]["slug"] == "python"


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


@pytest.mark.asyncio
async def test_upload_cron_job_unknown_client(authed_client, tmp_path, monkeypatch):
    monkeypatch.setenv("UPLOADS_DIR", str(tmp_path))
    r = await authed_client.post(
        "/api/cron-jobs",
        data={
            "client_id": str(uuid.uuid4()),
            "name": "orphan",
            "description": "x",
            "script": "echo hi",
            "script_type": "shell",
        },
    )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_list_script_categories(authed_client):
    r = await authed_client.get("/api/script-categories")
    assert r.status_code == 200
    slugs = [c["slug"] for c in r.json()]
    assert "shell" in slugs
    assert "powershell" in slugs
    assert "python" in slugs
    assert "ansible" in slugs
    assert "cron-jobs" in slugs


@pytest.mark.asyncio
async def test_download_cron_job_contributor_no_access(client, authed_client, tmp_path, monkeypatch):
    client_id = await _make_client(authed_client, "DLCONT")
    r, _ = await _upload_job(authed_client, client_id, tmp_path, monkeypatch)
    job_id = r.json()["id"]

    reg = await client.post(
        "/api/auth/register",
        json={"username": "contrib_cron_dl", "password": "password123"},
    )
    contrib_token = reg.json()["token"]

    res = await client.get(
        f"/api/cron-jobs/{job_id}/download",
        headers={"Authorization": f"Bearer {contrib_token}"},
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_delete_cron_job_contributor_no_access(client, authed_client, tmp_path, monkeypatch):
    client_id = await _make_client(authed_client, "DELCONT")
    r, _ = await _upload_job(authed_client, client_id, tmp_path, monkeypatch)
    job_id = r.json()["id"]

    reg = await client.post(
        "/api/auth/register",
        json={"username": "contrib_cron_del", "password": "password123"},
    )
    contrib_token = reg.json()["token"]

    res = await client.delete(
        f"/api/cron-jobs/{job_id}",
        headers={"Authorization": f"Bearer {contrib_token}"},
    )
    assert res.status_code == 403
