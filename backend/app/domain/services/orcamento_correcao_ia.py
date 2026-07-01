"""Envia falhas da análise determinística para diagnóstico com IA."""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from services.extraction_learning import analisar_correcao_extracao
from services.openai_service import OpenAIServiceError

from app.domain.schemas.correcao_analise import CorrecaoAnaliseRequest, CorrecaoAnaliseResponse


async def executar_correcao_analise_ia(
    user_id: str,
    payload: CorrecaoAnaliseRequest,
) -> CorrecaoAnaliseResponse:
    if not payload.linhas_com_problema:
        raise HTTPException(
            status_code=400,
            detail="Informe ao menos uma linha com problema para correção.",
        )

    body: dict[str, Any] = {
        "upload_id": payload.upload_id,
        "versao_modelo": payload.versao_modelo,
        "nome_arquivo": payload.nome_arquivo,
        "contexto": payload.contexto.model_dump() if payload.contexto else {},
        "linhas_com_problema": payload.linhas_com_problema,
    }

    try:
        resultado = await analisar_correcao_extracao(user_id, body)
    except OpenAIServiceError as exc:
        raise HTTPException(
            status_code=getattr(exc, "status_code", 500) or 500,
            detail=str(exc),
        ) from exc

    return CorrecaoAnaliseResponse(**resultado)
