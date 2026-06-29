import logging

from fastapi import APIRouter, Depends

from app.api.deps import get_current_user_id
from app.domain.schemas.process import ProcessTablesRequest, ProcessTablesResponse
from app.domain.services.orcamento_extraction import process_selected_tables

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/orcamentos", tags=["process"])


@router.post("/process-tables", response_model=ProcessTablesResponse)
async def process_orcamento_tables(
    payload: ProcessTablesRequest,
    user_id: str = Depends(get_current_user_id),
):
    """Extrai e analisa tabelas selecionadas com parser local (sem IA)."""
    result = process_selected_tables(
        payload.upload_id,
        user_id,
        payload.table_ids,
        list(payload.analysis_types),
    )
    logger.info(
        "process-tables: upload=%s itens=%s tipos=%s",
        payload.upload_id,
        result.get("items_found"),
        payload.analysis_types,
    )
    return ProcessTablesResponse(**result)
