import logging
import time

from fastapi import APIRouter, Depends

from app.api.deps import get_current_user_id
from app.domain.schemas.analise import AnalisarLinhasRequest, AnalisarLinhasResponse, executar_analise_linhas
from app.domain.schemas.correcao_analise import CorrecaoAnaliseRequest, CorrecaoAnaliseResponse
from app.domain.services.orcamento_correcao_ia import executar_correcao_analise_ia

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/orcamentos", tags=["analise"])


@router.post("/analisar-linhas", response_model=AnalisarLinhasResponse)
async def analisar_linhas_orcamento(
    payload: AnalisarLinhasRequest,
    _user_id: str = Depends(get_current_user_id),
):
    """Análise determinística de linhas orçamentárias (sem IA)."""
    t0 = time.perf_counter()
    n = len(payload.linhas or [])
    logger.info("[analisar-linhas] INÍCIO linhas=%s", n)
    result = executar_analise_linhas(payload)
    logger.info(
        "[analisar-linhas] FIM linhas=%s resumo=%s em %.2fs",
        len(result.linhas),
        result.resumo,
        time.perf_counter() - t0,
    )
    return result


@router.post("/analise/correcao-ia", response_model=CorrecaoAnaliseResponse)
async def correcao_analise_ia(
    payload: CorrecaoAnaliseRequest,
    user_id: str = Depends(get_current_user_id),
):
    """Diagnostica reprovados/alertas com IA e registra aprendizados para extrações futuras."""
    t0 = time.perf_counter()
    logger.info(
        "[correcao-ia] INÍCIO user=%s problemas=%s upload=%s",
        user_id[:12] if user_id else "-",
        len(payload.linhas_com_problema or []),
        payload.upload_id,
    )
    result = await executar_correcao_analise_ia(user_id, payload)
    logger.info(
        "[correcao-ia] FIM itens=%s em %.2fs",
        len(result.itens),
        time.perf_counter() - t0,
    )
    return result
