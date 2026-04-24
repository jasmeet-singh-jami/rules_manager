import os
import uuid
from pathlib import Path


def get_uploads_dir() -> Path:
    """Reads UPLOADS_DIR from env each call so tests can override via monkeypatch."""
    return Path(os.getenv("UPLOADS_DIR", "./uploads"))


def knowledge_dir(client_id: str) -> Path:
    d = get_uploads_dir() / "knowledge" / client_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def cron_jobs_dir(client_id: str) -> Path:
    d = get_uploads_dir() / "cron_jobs" / client_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def unique_filename(original: str) -> str:
    safe = Path(original).name
    if not safe:
        safe = "upload"
    return f"{uuid.uuid4()}_{safe}"
