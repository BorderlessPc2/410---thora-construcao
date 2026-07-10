import asyncio
import logging
import time

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.api.deps import get_current_user_id
from app.config import (
    DETECT_TABLES_MAX_PAGES,
    DETECT_TABLES_SKIP_THUMBNAILS,
    MAX_FILE_SIZE,
)
from app.domain.schemas.table import TableDetectResponse
from app.domain.services.table_detection import (
    detect_table_options,
    public_options_from_raw,
    recommended_table_ids,
)
from app.infrastructure.storage.table_cache_store import TableCacheStore
from app.infrastructure.storage.upload_store import UploadStore

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/orcamentos", tags=["tables"])

_upload_store = UploadStore()
_table_cache = TableCacheStore()


@router.post("/detect-tables", response_model=TableDetectResponse)
async def detect_orcamento_tables(
    upload_id: str = Form(...),
    user_id: str = Depends(get_current_user_id),
    file: UploadFile | None = File(None),
):
    """
    Detecta tabelas no PDF.

    Aceita o PDF de novo no Form (campo `file`) para ambientes com disco efêmero
    (Render Free), sem depender de Firebase Storage / plano Blaze.
    """
    t0 = time.perf_counter()
    upload_id = UploadStore.validate_upload_id(upload_id)
    logger.info(
        "[detect-tables] INÍCIO upload_id=%s user=%s file=%s skip_thumbs=%s max_pages=%s",
        upload_id,
        user_id[:12] if user_id else "-",
        file.filename if file else None,
        DETECT_TABLES_SKIP_THUMBNAILS,
        DETECT_TABLES_MAX_PAGES,
    )

    if file is not None:
        if file.content_type and file.content_type != "application/pdf":
            raise HTTPException(status_code=400, detail="Apenas arquivos PDF são permitidos")
        contents = await file.read()
        if not contents:
            raise HTTPException(status_code=400, detail="Arquivo PDF vazio")
        if len(contents) > MAX_FILE_SIZE:
            max_mb = MAX_FILE_SIZE / 1024 / 1024
            raise HTTPException(
                status_code=413,
                detail=f"Arquivo muito grande. Máximo: {max_mb:.0f}MB.",
            )
        filename = file.filename or f"{upload_id}.pdf"
        _upload_store.save_pdf(
            upload_id,
            contents,
            user_id=user_id,
            filename=filename,
            content_type=file.content_type or "application/pdf",
        )
        logger.info(
            "[detect-tables] PDF reenviado e salvo (%s, %.2f MB) em %.2fs",
            upload_id,
            len(contents) / 1024 / 1024,
            time.perf_counter() - t0,
        )
    else:
        logger.info("[detect-tables] sem file no form — usando disco/cache local")
        _upload_store.assert_access(upload_id, user_id)

    file_path = _upload_store.ensure_pdf(upload_id, user_id=user_id)
    logger.info(
        "[detect-tables] PDF pronto path=%s size=%.2f MB (%.2fs)",
        file_path.name,
        file_path.stat().st_size / 1024 / 1024,
        time.perf_counter() - t0,
    )

    if _table_cache.is_valid(upload_id):
        options, _ = _table_cache.get(upload_id)
        public = public_options_from_raw(options)
        logger.info(
            "[detect-tables] CACHE HIT → %s tabela(s) em %.2fs",
            len(public),
            time.perf_counter() - t0,
        )
        return TableDetectResponse(
            upload_id=upload_id,
            tables_found=len(public),
            options=public,
            mock_fallback=False,
            cached=True,
            recommended_table_ids=recommended_table_ids(options),
        )

    logger.info("[detect-tables] extraindo tabelas (pdfplumber)…")
    t_detect = time.perf_counter()
    try:
        options, fallback_used = await asyncio.to_thread(detect_table_options, file_path)
    except Exception as exc:
        logger.exception(
            "[detect-tables] FALHOU após %.2fs: %s",
            time.perf_counter() - t0,
            exc,
        )
        raise HTTPException(status_code=500, detail=f"Erro ao analisar PDF: {exc}") from exc

    logger.info(
        "[detect-tables] extração OK em %.2fs → %s candidato(s) camelot_fallback=%s",
        time.perf_counter() - t_detect,
        len(options),
        fallback_used,
    )

    _table_cache.save(upload_id, options)
    public = public_options_from_raw(options)
    with_img = sum(1 for o in public if o.get("imagem_base64"))
    logger.info(
        "[detect-tables] FIM upload_id=%s tables=%s com_imagem=%s total=%.2fs",
        upload_id,
        len(public),
        with_img,
        time.perf_counter() - t0,
    )

    return TableDetectResponse(
        upload_id=upload_id,
        tables_found=len(public),
        options=public,
        mock_fallback=fallback_used,
        cached=False,
        recommended_table_ids=recommended_table_ids(options),
    )


@router.get("/{upload_id}/table-candidates", response_model=TableDetectResponse)
async def get_table_candidates(
    upload_id: str,
    user_id: str = Depends(get_current_user_id),
):
    upload_id = UploadStore.validate_upload_id(upload_id)
    _upload_store.assert_access(upload_id, user_id)

    options, _ = _table_cache.get(upload_id)
    public = public_options_from_raw(options)
    logger.info(
        "[table-candidates] upload_id=%s tables=%s",
        upload_id,
        len(public),
    )
    return TableDetectResponse(
        upload_id=upload_id,
        tables_found=len(public),
        options=public,
        cached=True,
        recommended_table_ids=recommended_table_ids(options),
    )
