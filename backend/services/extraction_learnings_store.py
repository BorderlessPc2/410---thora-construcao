"""
Persistência global de aprendizados de extração (Firebase + cache local).
Correções de qualquer usuário beneficiam todas as extrações futuras.
"""

from __future__ import annotations

import json
import logging
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from config import CACHE_FOLDER

logger = logging.getLogger(__name__)

GLOBAL_CACHE_FILE = CACHE_FOLDER / "extraction_learnings_global.json"
LEARNINGS_LEGACY_DIR = CACHE_FOLDER / "extraction_learnings"

COLLECTION = "ai_training"
DOCUMENT_ID = "extraction_global"

MAX_GLOBAL_RULES = 80
MAX_GLOBAL_ENTRIES = 150
MAX_LEARNINGS_IN_PROMPT = 20
CACHE_TTL_SECONDS = 45

_memory_cache: dict[str, Any] = {"rules": [], "loaded_at": 0.0}
_cache_lock = threading.Lock()
_legacy_migrated = False


def _empty_store() -> dict[str, Any]:
    return {"rules": [], "entries": []}


def _normalize_rule(text: str) -> str:
    return " ".join(str(text).strip().split())


def _dedupe_rules(rules: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for raw in rules:
        rule = _normalize_rule(raw)
        if not rule:
            continue
        key = rule.casefold()
        if key in seen:
            continue
        seen.add(key)
        out.append(rule)
    return out


def _load_local_file() -> dict[str, Any]:
    if not GLOBAL_CACHE_FILE.exists():
        return _empty_store()
    try:
        data = json.loads(GLOBAL_CACHE_FILE.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            rules = data.get("rules") if isinstance(data.get("rules"), list) else []
            entries = data.get("entries") if isinstance(data.get("entries"), list) else []
            return {"rules": _dedupe_rules([str(r) for r in rules]), "entries": entries}
    except (json.JSONDecodeError, OSError) as exc:
        logger.warning("Falha ao ler cache global de aprendizados: %s", exc)
    return _empty_store()


def _save_local_file(store: dict[str, Any]) -> None:
    GLOBAL_CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "rules": store.get("rules", []),
        "entries": store.get("entries", [])[-MAX_GLOBAL_ENTRIES:],
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    GLOBAL_CACHE_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _get_firestore_db():
    try:
        from firebase_service import db as firestore_db

        return firestore_db
    except Exception as exc:
        logger.debug("Firestore indisponível para aprendizados: %s", exc)
        return None


def _load_from_firestore() -> dict[str, Any] | None:
    firestore_db = _get_firestore_db()
    if not firestore_db:
        return None
    try:
        doc = firestore_db.collection(COLLECTION).document(DOCUMENT_ID).get()
        if not doc.exists:
            return None
        data = doc.to_dict() or {}
        rules = data.get("rules") if isinstance(data.get("rules"), list) else []
        entries = data.get("entries") if isinstance(data.get("entries"), list) else []
        return {
            "rules": _dedupe_rules([str(r) for r in rules]),
            "entries": entries,
        }
    except Exception as exc:
        logger.warning("Falha ao carregar aprendizados do Firestore: %s", exc)
        return None


def _save_to_firestore(store: dict[str, Any]) -> bool:
    firestore_db = _get_firestore_db()
    if not firestore_db:
        return False
    try:
        from datetime import datetime as dt

        payload = {
            "rules": store.get("rules", [])[-MAX_GLOBAL_RULES:],
            "entries": store.get("entries", [])[-MAX_GLOBAL_ENTRIES:],
            "updatedAt": dt.now(),
            "scope": "global",
        }
        firestore_db.collection(COLLECTION).document(DOCUMENT_ID).set(payload, merge=True)
        return True
    except Exception as exc:
        logger.warning("Falha ao salvar aprendizados no Firestore: %s", exc)
        return False


def _migrate_legacy_user_files(store: dict[str, Any]) -> dict[str, Any]:
    global _legacy_migrated
    if _legacy_migrated or not LEARNINGS_LEGACY_DIR.exists():
        _legacy_migrated = True
        return store

    merged_rules = list(store.get("rules", []))
    merged_entries = list(store.get("entries", []))

    for path in LEARNINGS_LEGACY_DIR.glob("*.json"):
        try:
            legacy = json.loads(path.read_text(encoding="utf-8"))
            for entry in legacy.get("entries", []) or []:
                if isinstance(entry, dict):
                    merged_entries.append({**entry, "migrated_from": path.stem})
                    for rule in entry.get("aprendizados", []) or []:
                        merged_rules.append(str(rule))
        except (json.JSONDecodeError, OSError):
            continue

    _legacy_migrated = True
    if merged_rules or len(merged_entries) > len(store.get("entries", [])):
        logger.info("Migrados aprendizados legados por usuário para o pool global.")
        return {
            "rules": _dedupe_rules(merged_rules)[-MAX_GLOBAL_RULES:],
            "entries": merged_entries[-MAX_GLOBAL_ENTRIES:],
        }
    return store


def load_global_store(*, force_refresh: bool = False) -> dict[str, Any]:
    now = time.time()
    with _cache_lock:
        if (
            not force_refresh
            and _memory_cache.get("rules") is not None
            and now - float(_memory_cache.get("loaded_at", 0)) < CACHE_TTL_SECONDS
        ):
            return {
                "rules": list(_memory_cache.get("rules", [])),
                "entries": list(_memory_cache.get("entries", [])),
            }

    store = _load_from_firestore()
    if store is None:
        store = _load_local_file()
    else:
        _save_local_file(store)

    store = _migrate_legacy_user_files(store)

    with _cache_lock:
        _memory_cache["rules"] = list(store.get("rules", []))
        _memory_cache["entries"] = list(store.get("entries", []))
        _memory_cache["loaded_at"] = now

    return store


def list_global_rules() -> list[str]:
    store = load_global_store()
    return list(store.get("rules", []))[-MAX_GLOBAL_RULES:]


def get_learnings_prompt_addon() -> str:
    rules = list_global_rules()[-MAX_LEARNINGS_IN_PROMPT:]
    if not rules:
        return ""
    lines = "\n".join(f"- {rule}" for rule in rules)
    return (
        "APRENDIZADOS GLOBAIS DE CORREÇÕES ANTERIORES (todos os usuários — priorize ao extrair):\n"
        f"{lines}"
    )


def append_global_learnings(
    *,
    user_id: str,
    upload_id: str | None,
    aprendizados: list[str],
    diagnostico: str,
    itens_count: int,
    nome_arquivo: str | None = None,
) -> list[str]:
    cleaned = _dedupe_rules(aprendizados)
    if not cleaned and not diagnostico:
        return list_global_rules()

    store = load_global_store(force_refresh=True)
    existing_rules = set(r.casefold() for r in store.get("rules", []))
    novos = [r for r in cleaned if r.casefold() not in existing_rules]

    entry = {
        "id": str(uuid.uuid4()),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "user_id": user_id,
        "upload_id": upload_id,
        "nome_arquivo": nome_arquivo,
        "diagnostico_resumo": diagnostico[:500] if diagnostico else "",
        "itens_analisados": itens_count,
        "aprendizados": novos or cleaned,
        "scope": "global",
    }

    rules = _dedupe_rules([*store.get("rules", []), *(novos or cleaned)])[-MAX_GLOBAL_RULES:]
    entries = [*store.get("entries", []), entry][-MAX_GLOBAL_ENTRIES:]

    updated = {"rules": rules, "entries": entries}
    _save_local_file(updated)
    _save_to_firestore(updated)

    with _cache_lock:
        _memory_cache["rules"] = list(rules)
        _memory_cache["entries"] = list(entries)
        _memory_cache["loaded_at"] = time.time()

    logger.info(
        "Aprendizados globais atualizados: +%s regras (total %s) por user=%s",
        len(novos or cleaned),
        len(rules),
        user_id,
    )
    return rules
