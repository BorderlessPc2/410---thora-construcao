"""
Aprendizado incremental a partir de correções da análise determinística.
Regras são globais (todos os usuários) e persistidas no Firebase.
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any

from config import OPENAI_ORCAMENTO_MODEL, is_openai_configured
from openai import APIConnectionError, APITimeoutError, OpenAIError, RateLimitError

from services.ai_audit_logger import log_ai_exchange
from services.extraction_learnings_store import (
    append_global_learnings,
    get_learnings_prompt_addon,
    list_global_rules,
)
from services.openai_service import OpenAIServiceError, _get_client, _parse_json_content

logger = logging.getLogger(__name__)

CORRECAO_SYSTEM_PROMPT = (
    "Você é especialista em extração de orçamentos de obras a partir de PDFs (NOVACAP, licitações) "
    "e em validação determinística de cálculos (subtotal, BDI, memória de cálculo).\n\n"
    "O usuário enviou linhas que falharam na validação automática após extração do PDF.\n"
    "Sua missão:\n"
    "1. Diagnosticar a causa provável de cada erro (extração incorreta, desalinhamento de colunas, "
    "preço já com BDI no PDF, regra de validação inadequada ao formato, etc.).\n"
    "2. Sugerir como corrigir a extração na próxima leitura do mesmo tipo de planilha.\n"
    "3. Gerar regras curtas, claras e GENERALIZÁVEIS para injetar no prompt de extração futura — "
    "essas regras serão compartilhadas globalmente com todos os usuários do sistema.\n"
    "4. Evite regras hiper-específicas de um único item; prefira padrões de formato/coluna que se "
    "apliquem a planilhas similares.\n\n"
    "Responda SOMENTE em JSON válido com o schema:\n"
    "{\n"
    '  "diagnostico_geral": "string",\n'
    '  "itens": [\n'
    "    {\n"
    '      "linha_id": "string|number",\n'
    '      "item_numero": "string",\n'
    '      "causa_provavel": "string",\n'
    '      "tipo_problema": "extracao|validacao|formato_pdf|ambiguo",\n'
    '      "correcao_sugerida": "string",\n'
    '      "regra_prompt": "string|null"\n'
    "    }\n"
    "  ],\n"
    '  "aprendizados_para_extracao": ["regra curta generalizável 1", "regra curta 2"]\n'
    "}"
)


def build_extraction_system_prompt(user_id: str | None = None, base_prompt: str = "") -> str:
    del user_id  # aprendizados são globais; parâmetro mantido por compatibilidade
    addon = get_learnings_prompt_addon()
    if not addon:
        return base_prompt
    return f"{base_prompt.rstrip()}\n\n{addon}"


def _build_correcao_user_message(payload: dict[str, Any]) -> str:
    return json.dumps(payload, ensure_ascii=False, indent=2)


async def analisar_correcao_extracao(
    user_id: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    if not is_openai_configured():
        raise OpenAIServiceError(
            "OpenAI não configurada. Defina OPENAI_API_KEY para enviar correções.",
            status_code=503,
            code="openai_not_configured",
        )

    linhas = payload.get("linhas_com_problema") or []
    if not linhas:
        raise OpenAIServiceError(
            "Nenhuma linha com problema para analisar.",
            status_code=400,
            code="empty_payload",
        )

    user_msg = _build_correcao_user_message(payload)
    t0 = time.perf_counter()

    try:
        client = _get_client()
        response = await client.chat.completions.create(
            model=OPENAI_ORCAMENTO_MODEL,
            temperature=0.2,
            max_tokens=2500,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": CORRECAO_SYSTEM_PROMPT},
                {"role": "user", "content": user_msg},
            ],
        )
        raw_content = response.choices[0].message.content or "{}"
        parsed = _parse_json_content(raw_content)
        duration_ms = (time.perf_counter() - t0) * 1000

        diagnostico = str(parsed.get("diagnostico_geral") or "").strip()
        itens = parsed.get("itens") if isinstance(parsed.get("itens"), list) else []
        aprendizados_raw = parsed.get("aprendizados_para_extracao")
        aprendizados = (
            [str(a).strip() for a in aprendizados_raw if str(a).strip()]
            if isinstance(aprendizados_raw, list)
            else []
        )

        for item in itens:
            if isinstance(item, dict):
                regra = item.get("regra_prompt")
                if regra and str(regra).strip():
                    aprendizados.append(str(regra).strip())

        aprendizados_salvos = append_global_learnings(
            user_id=user_id,
            upload_id=str(payload.get("upload_id") or "") or None,
            aprendizados=aprendizados,
            diagnostico=diagnostico,
            itens_count=len(linhas),
            nome_arquivo=str(payload.get("nome_arquivo") or "") or None,
        )

        log_ai_exchange(
            operation="analise_correcao_extracao",
            provider="openai",
            model=OPENAI_ORCAMENTO_MODEL,
            input_payload={
                "upload_id": payload.get("upload_id"),
                "linhas_count": len(linhas),
                "user_id": user_id,
                "scope": "global",
            },
            output_payload={
                "diagnostico_len": len(diagnostico),
                "itens_count": len(itens),
                "aprendizados_novos": len(aprendizados),
                "total_regras_globais": len(aprendizados_salvos),
            },
            duration_ms=duration_ms,
        )

        return {
            "diagnostico_geral": diagnostico,
            "itens": itens,
            "aprendizados_para_extracao": aprendizados,
            "aprendizados_totais": aprendizados_salvos,
            "escopo": "global",
            "total_regras_globais": len(aprendizados_salvos),
            "model": OPENAI_ORCAMENTO_MODEL,
            "provider": "openai",
        }

    except (json.JSONDecodeError, OpenAIError, ValueError) as exc:
        duration_ms = (time.perf_counter() - t0) * 1000
        log_ai_exchange(
            operation="analise_correcao_extracao",
            provider="openai",
            model=OPENAI_ORCAMENTO_MODEL,
            input_payload={"linhas_count": len(linhas), "scope": "global"},
            error=str(exc),
            duration_ms=duration_ms,
        )
        if isinstance(exc, (APIConnectionError, APITimeoutError, RateLimitError)):
            raise OpenAIServiceError(
                "Falha de conexão com a OpenAI. Tente novamente.",
                status_code=503,
                code="openai_connection",
            ) from exc
        raise OpenAIServiceError(
            "A OpenAI retornou resposta inválida ao analisar correções.",
            status_code=502,
            code="invalid_response",
        ) from exc


def list_learnings(user_id: str | None = None) -> list[str]:
    del user_id
    return list_global_rules()
