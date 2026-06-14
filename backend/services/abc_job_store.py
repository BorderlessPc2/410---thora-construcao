"""Persistência de jobs da fila Curva ABC (disco + Redis ou memória)."""

from __future__ import annotations

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from config import CACHE_FOLDER

logger = logging.getLogger(__name__)

_MEMORY_JOBS: Dict[str, Dict[str, Any]] = {}
_USER_UPLOAD_IDS: Dict[str, List[str]] = {}
_redis_client = None
_redis_checked = False

_JOB_KEY_PREFIX = "abc:job:"
_USER_LIST_PREFIX = "abc:user:"
_JOB_TTL_SECONDS = 60 * 60 * 24 * 90

ABC_JOBS_DIR = CACHE_FOLDER / "abc_jobs"
ABC_USERS_DIR = CACHE_FOLDER / "abc_users"
ABC_JOBS_DIR.mkdir(exist_ok=True)
ABC_USERS_DIR.mkdir(exist_ok=True)


def _job_disk_path(upload_id: str) -> Path:
    return ABC_JOBS_DIR / f"{upload_id}.json"


def _user_disk_path(user_id: str) -> Path:
    safe_user = (user_id or "anonymous").replace("/", "_").replace("\\", "_")
    return ABC_USERS_DIR / f"{safe_user}.json"


def _load_user_ids_from_disk(user_id: str) -> List[str]:
    path = _user_disk_path(user_id)
    if not path.is_file():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        ids = data.get("upload_ids") if isinstance(data, dict) else data
        if isinstance(ids, list):
            return [str(item) for item in ids if item]
    except Exception as exc:
        logger.warning("Erro ao ler índice ABC do usuário %s: %s", user_id, exc)
    return []


def _save_user_ids_to_disk(user_id: str, upload_ids: List[str]) -> None:
    try:
        path = _user_disk_path(user_id)
        payload = {
            "user_id": user_id,
            "upload_ids": upload_ids,
            "updated_at": datetime.now().isoformat(),
        }
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception as exc:
        logger.warning("Erro ao salvar índice ABC do usuário %s: %s", user_id, exc)


def _load_job_from_disk(upload_id: str) -> Optional[Dict[str, Any]]:
    path = _job_disk_path(upload_id)
    if not path.is_file():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        logger.warning("Erro ao ler job ABC em disco %s: %s", upload_id, exc)
        return None


def _save_job_to_disk(upload_id: str, job: Dict[str, Any]) -> None:
    try:
        path = _job_disk_path(upload_id)
        path.write_text(
            json.dumps(job, default=str, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    except Exception as exc:
        logger.warning("Erro ao salvar job ABC em disco %s: %s", upload_id, exc)


def _get_redis():
    global _redis_client, _redis_checked
    if _redis_checked:
        return _redis_client

    _redis_checked = True
    try:
        from config import REDIS_URL

        if not REDIS_URL:
            return None

        import redis

        _redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)
        _redis_client.ping()
        logger.info("Jobs Curva ABC usando Redis")
        return _redis_client
    except Exception as exc:
        logger.warning("Redis indisponível para jobs ABC: %s", exc)
        _redis_client = None
        return None


def _job_key(upload_id: str) -> str:
    return f"{_JOB_KEY_PREFIX}{upload_id}"


def _user_list_key(user_id: str) -> str:
    safe_user = (user_id or "anonymous").replace("/", "_")
    return f"{_USER_LIST_PREFIX}{safe_user}"


def get_job(upload_id: str) -> Optional[Dict[str, Any]]:
    if upload_id in _MEMORY_JOBS:
        return _MEMORY_JOBS[upload_id]

    client = _get_redis()
    if client:
        try:
            raw = client.get(_job_key(upload_id))
            if raw:
                job = json.loads(raw)
                _MEMORY_JOBS[upload_id] = job
                return job
        except Exception as exc:
            logger.warning("Erro ao ler job ABC %s: %s", upload_id, exc)

    job = _load_job_from_disk(upload_id)
    if job:
        _MEMORY_JOBS[upload_id] = job
    return job


def save_job(upload_id: str, job: Dict[str, Any]) -> None:
    job["updated_at"] = datetime.now().isoformat()
    _MEMORY_JOBS[upload_id] = job
    _save_job_to_disk(upload_id, job)

    client = _get_redis()
    if client:
        try:
            client.setex(
                _job_key(upload_id),
                _JOB_TTL_SECONDS,
                json.dumps(job, default=str),
            )
        except Exception as exc:
            logger.warning("Erro ao salvar job ABC %s: %s", upload_id, exc)


def delete_job(upload_id: str) -> None:
    _MEMORY_JOBS.pop(upload_id, None)
    try:
        path = _job_disk_path(upload_id)
        if path.is_file():
            path.unlink()
    except Exception as exc:
        logger.warning("Erro ao remover job ABC em disco %s: %s", upload_id, exc)

    client = _get_redis()
    if client:
        try:
            client.delete(_job_key(upload_id))
        except Exception as exc:
            logger.warning("Erro ao remover job ABC %s: %s", upload_id, exc)


def track_user_job(user_id: str, upload_id: str) -> None:
    ids = list(_USER_UPLOAD_IDS.get(user_id, []))
    disk_ids = _load_user_ids_from_disk(user_id)
    for disk_id in disk_ids:
        if disk_id not in ids:
            ids.append(disk_id)
    if upload_id not in ids:
        ids.append(upload_id)
    _USER_UPLOAD_IDS[user_id] = ids
    _save_user_ids_to_disk(user_id, ids)

    client = _get_redis()
    if client:
        try:
            key = _user_list_key(user_id)
            if upload_id not in client.lrange(key, 0, -1):
                client.rpush(key, upload_id)
                client.expire(key, _JOB_TTL_SECONDS)
        except Exception as exc:
            logger.warning("Erro ao registrar job ABC do usuário: %s", exc)


def _user_upload_ids(user_id: str) -> List[str]:
    upload_ids: List[str] = []

    client = _get_redis()
    if client:
        try:
            upload_ids = list(client.lrange(_user_list_key(user_id), 0, -1))
        except Exception as exc:
            logger.warning("Erro ao listar jobs ABC no Redis: %s", exc)

    if not upload_ids:
        upload_ids = list(_USER_UPLOAD_IDS.get(user_id, []))

    if not upload_ids:
        upload_ids = _load_user_ids_from_disk(user_id)
        if upload_ids:
            _USER_UPLOAD_IDS[user_id] = list(upload_ids)

    return upload_ids


def list_user_jobs(user_id: str) -> List[Dict[str, Any]]:
    upload_ids = _user_upload_ids(user_id)

    jobs: List[Dict[str, Any]] = []
    for upload_id in upload_ids:
        job = get_job(upload_id)
        if job:
            jobs.append(job)

    def sort_key(job: Dict[str, Any]) -> str:
        return str(
            job.get("completed_at")
            or job.get("updated_at")
            or job.get("created_at")
            or ""
        )

    jobs.sort(key=sort_key, reverse=True)
    return jobs
