"""Teste E2E: upload PDF -> detect-tables -> fila ABC -> resultado IA."""

from __future__ import annotations

import json
import sys
import time
import uuid
from pathlib import Path

import requests

PDF_PATH = Path(r"c:\Users\frank\Downloads\3 Orçamento SEM Desoneração.pdf")
BASE_URL = sys.argv[1] if len(sys.argv) > 1 else "https://four10-thora-construcao-262l.onrender.com"
USER_ID = f"test-e2e-{uuid.uuid4().hex[:10]}"
HEADERS = {"X-Anonymous-User": USER_ID}
DETECT_TIMEOUT = 600
PROCESS_POLL_TIMEOUT = 1800
POLL_INTERVAL = 8


def log(step: str, msg: str) -> None:
    print(f"[{step}] {msg}", flush=True)


def main() -> int:
    if not PDF_PATH.is_file():
        log("ERRO", f"PDF nao encontrado: {PDF_PATH}")
        return 1

    base = BASE_URL.rstrip("/")
    size_mb = PDF_PATH.stat().st_size / 1024 / 1024
    log("INFO", f"API={base} user={USER_ID} pdf={PDF_PATH.name} ({size_mb:.2f} MB)")

    # 1) Health
    t0 = time.time()
    hr = requests.get(f"{base}/health", timeout=90)
    log("health", f"{hr.status_code} em {time.time()-t0:.1f}s -> {hr.text[:120]}")
    if hr.status_code != 200:
        return 1

    # 2) Upload
    t0 = time.time()
    with PDF_PATH.open("rb") as f:
        ur = requests.post(
            f"{base}/api/upload",
            files={"file": (PDF_PATH.name, f, "application/pdf")},
            headers=HEADERS,
            timeout=300,
        )
    log("upload", f"{ur.status_code} em {time.time()-t0:.1f}s")
    if ur.status_code != 200:
        log("upload", ur.text[:500])
        return 1
    upload_id = ur.json()["upload_id"]
    log("upload", f"upload_id={upload_id}")

    # 3) Register ABC job
    rr = requests.post(
        f"{base}/api/abc-analysis/batch-register",
        json={"jobs": [{"upload_id": upload_id, "filename": PDF_PATH.name}]},
        headers=HEADERS,
        timeout=60,
    )
    log("register", f"{rr.status_code} -> {rr.text[:200]}")
    if rr.status_code != 200:
        return 1

    # 4) Detect tables
    log("detect", "iniciando detect-tables (pode levar varios minutos)...")
    t0 = time.time()
    dr = requests.post(
        f"{base}/api/orcamentos/detect-tables",
        data={"upload_id": upload_id},
        headers=HEADERS,
        timeout=DETECT_TIMEOUT,
    )
    elapsed = time.time() - t0
    log("detect", f"{dr.status_code} em {elapsed:.1f}s")
    if dr.status_code != 200:
        log("detect", dr.text[:800])
        return 1

    detect = dr.json()
    options = detect.get("options") or []
    log("detect", f"{len(options)} tabela(s) encontrada(s), cached={detect.get('cached')}")
    if not options:
        return 1

    table_ids = [o["id"] for o in options[:3]]
    log("detect", f"selecionadas para IA: {table_ids}")

    # 5) Enqueue process
    pr = requests.post(
        f"{base}/api/abc-analysis/process",
        json={"upload_id": upload_id, "table_ids": table_ids},
        headers=HEADERS,
        timeout=120,
    )
    log("enqueue", f"{pr.status_code} -> {pr.text[:300]}")
    if pr.status_code != 200:
        return 1

    # 6) Poll until terminal
    log("poll", f"aguardando IA (max {PROCESS_POLL_TIMEOUT}s)...")
    t_start = time.time()
    last_status = ""
    while time.time() - t_start < PROCESS_POLL_TIMEOUT:
        sr = requests.post(
            f"{base}/api/abc-analysis/batch-status",
            json={"upload_ids": [upload_id]},
            headers=HEADERS,
            timeout=60,
        )
        if sr.status_code != 200:
            log("poll", f"batch-status {sr.status_code}: {sr.text[:200]}")
            time.sleep(POLL_INTERVAL)
            continue

        jobs = sr.json().get("jobs") or []
        if not jobs:
            log("poll", "jobs vazio — aguardando...")
            time.sleep(POLL_INTERVAL)
            continue

        job = jobs[0]
        status = job.get("status", "?")
        message = job.get("message") or ""
        pages = f"{job.get('pages_done', 0)}/{job.get('pages_total', 0)}"
        if status != last_status or int(time.time() - t_start) % 30 < POLL_INTERVAL:
            log("poll", f"status={status} pages={pages} msg={message[:80]}")
            last_status = status

        if status == "completed":
            result = job.get("result") or {}
            log("OK", json.dumps(
                {
                    "upload_id": upload_id,
                    "items_found": job.get("items_found"),
                    "result_keys": list(result.keys()) if isinstance(result, dict) else [],
                    "elapsed_sec": round(time.time() - t_start, 1),
                },
                ensure_ascii=True,
            ))
            return 0

        if status == "failed":
            log("FALHA", job.get("error") or message)
            return 1

        time.sleep(POLL_INTERVAL)

    log("TIMEOUT", f"sem conclusao em {PROCESS_POLL_TIMEOUT}s")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
