from __future__ import annotations

import json
import logging
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.config import DETECT_JOB_STALE_SECONDS, JOBS_DIR

logger = logging.getLogger(__name__)


def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


class DetectJobStore:
    """Status de detecção de tabelas (memória + disco em /tmp para o mesmo worker)."""

    def __init__(self, base_dir: Path | None = None) -> None:
        self._base_dir = base_dir or JOBS_DIR
        self._base_dir.mkdir(parents=True, exist_ok=True)
        self._jobs: dict[str, dict[str, Any]] = {}
        self._lock = threading.Lock()

    def _path(self, upload_id: str) -> Path:
        return self._base_dir / f"{upload_id}_detect_job.json"

    def _persist(self, job: dict[str, Any]) -> None:
        upload_id = str(job.get("upload_id") or "")
        if not upload_id:
            return
        try:
            self._path(upload_id).write_text(
                json.dumps(job, ensure_ascii=False),
                encoding="utf-8",
            )
        except OSError as exc:
            logger.warning("[detect-job] falha ao persistir %s: %s", upload_id, exc)

    def _load_disk(self, upload_id: str) -> dict[str, Any] | None:
        path = self._path(upload_id)
        if not path.is_file():
            return None
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                return data
        except (OSError, json.JSONDecodeError) as exc:
            logger.warning("[detect-job] falha ao ler %s: %s", upload_id, exc)
        return None

    def init_job(
        self,
        upload_id: str,
        *,
        user_id: str,
        filename: str | None = None,
        pages_total: int = 0,
        message: str = "Na fila…",
    ) -> dict[str, Any]:
        now = _utcnow()
        job = {
            "upload_id": upload_id,
            "user_id": user_id,
            "filename": filename,
            "status": "processing",
            "pages_total": pages_total,
            "pages_done": 0,
            "candidates_found": 0,
            "message": message,
            "error": None,
            "result": None,
            "created_at": now,
            "updated_at": now,
        }
        with self._lock:
            self._jobs[upload_id] = job
            self._persist(job)
        logger.info("[detect-job] init upload=%s pages_total=%s", upload_id, pages_total)
        return dict(job)

    def get(self, upload_id: str) -> dict[str, Any] | None:
        with self._lock:
            job = self._jobs.get(upload_id)
            if job is None:
                job = self._load_disk(upload_id)
                if job:
                    self._jobs[upload_id] = job
            if not job:
                return None
            job = self._mark_stale_if_needed(job)
            return dict(job)

    def _mark_stale_if_needed(self, job: dict[str, Any]) -> dict[str, Any]:
        if job.get("status") not in {"processing", "queued"}:
            return job
        updated = _parse_iso(str(job.get("updated_at") or ""))
        if not updated:
            return job
        age = (datetime.now(timezone.utc) - updated).total_seconds()
        if age < DETECT_JOB_STALE_SECONDS:
            return job
        job["status"] = "failed"
        job["error"] = (
            f"Detecção interrompida (sem progresso há {int(age)}s). "
            "O worker pode ter reiniciado ou esgotado memória — tente novamente."
        )
        job["message"] = "Falhou por timeout/inatividade"
        job["updated_at"] = _utcnow()
        self._persist(job)
        logger.error(
            "[detect-job] STALE upload=%s age=%.0fs → failed",
            job.get("upload_id"),
            age,
        )
        return job

    def update(self, upload_id: str, **fields: Any) -> dict[str, Any] | None:
        with self._lock:
            job = self._jobs.get(upload_id) or self._load_disk(upload_id)
            if not job:
                return None
            job.update(fields)
            job["updated_at"] = _utcnow()
            self._jobs[upload_id] = job
            self._persist(job)
            return dict(job)

    def clear(self, upload_id: str) -> None:
        with self._lock:
            self._jobs.pop(upload_id, None)
            path = self._path(upload_id)
            if path.is_file():
                try:
                    path.unlink()
                except OSError:
                    pass
        logger.info("[detect-job] cleared upload=%s", upload_id)

    def heartbeat(
        self,
        upload_id: str,
        *,
        pages_done: int,
        pages_total: int,
        candidates_found: int,
        message: str,
    ) -> None:
        self.update(
            upload_id,
            status="processing",
            pages_done=pages_done,
            pages_total=pages_total,
            candidates_found=candidates_found,
            message=message,
            error=None,
        )
