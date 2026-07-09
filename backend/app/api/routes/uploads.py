import asyncio
import logging
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.api.deps import get_current_user_id
from app.config import MAX_FILE_SIZE
from app.domain.schemas.upload import UploadResponse
from app.infrastructure.auth.firebase_auth import _init_firebase
from app.infrastructure.storage.upload_store import UploadStore

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["uploads"])

_upload_store = UploadStore()


async def _backup_pdf_to_storage(
    *,
    upload_id: str,
    user_id: str,
    pdf_bytes: bytes,
    filename: str,
) -> None:
    """Backup assíncrono no Firebase Storage (disco do Render é efêmero)."""
    try:
        _init_firebase()
        from services.storage_service import is_storage_available, upload_pdf_bytes_async

        if not is_storage_available():
            _upload_store.update_meta(upload_id, cloudUploadStatus="unavailable")
            return

        storage_url = await upload_pdf_bytes_async(
            upload_id=upload_id,
            user_id=user_id,
            pdf_bytes=pdf_bytes,
        )
        if not storage_url:
            _upload_store.update_meta(upload_id, cloudUploadStatus="failed")
            return

        _upload_store.update_meta(
            upload_id,
            storageUrl=storage_url,
            cloudUploadStatus="completed",
        )
        logger.info("PDF em nuvem: %s (%s)", upload_id, filename)
    except Exception as exc:
        logger.error("Backup Storage falhou para %s: %s", upload_id, exc)
        try:
            _upload_store.update_meta(upload_id, cloudUploadStatus="failed")
        except Exception:
            pass


@router.post("/upload", response_model=UploadResponse)
async def upload_pdf(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Apenas arquivos PDF são permitidos")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        max_mb = MAX_FILE_SIZE / 1024 / 1024
        raise HTTPException(
            status_code=413,
            detail=(
                f"Arquivo muito grande. Máximo: {max_mb:.0f}MB. "
                f"Tamanho: {len(contents) / 1024 / 1024:.2f}MB"
            ),
        )

    upload_id = str(uuid.uuid4())
    filename = file.filename or f"{upload_id}.pdf"

    _upload_store.save_pdf(
        upload_id,
        contents,
        user_id=user_id,
        filename=filename,
        content_type=file.content_type or "application/pdf",
    )

    # Backup em nuvem em background — necessário no Render (disco efêmero).
    asyncio.create_task(
        _backup_pdf_to_storage(
            upload_id=upload_id,
            user_id=user_id,
            pdf_bytes=contents,
            filename=filename,
        )
    )

    logger.info("PDF salvo: %s (%.2f MB)", upload_id, len(contents) / 1024 / 1024)

    return UploadResponse(
        upload_id=upload_id,
        filename=filename,
        size=len(contents),
        message="Arquivo recebido com sucesso",
    )
