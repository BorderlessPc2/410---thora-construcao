"""
Extração determinística de itens orçamentários a partir de tabelas selecionadas.
Usa BudgetParser — sem IA no caminho principal.
"""

from __future__ import annotations

import logging
import re
from typing import Any

from budget_parser import BudgetParser
from fastapi import HTTPException

from app.infrastructure.storage.table_cache_store import TableCacheStore
from app.infrastructure.storage.upload_store import UploadStore

logger = logging.getLogger(__name__)

_SUBTOTAL_KEYWORDS = (
    "total geral",
    "subtotal",
    "total do grupo",
    "total:",
    "suma",
    "grand total",
)


def _coerce_number(value: Any) -> float:
    if value is None or value == "":
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip().replace("R$", "").replace("$", "").replace(" ", "")
    if "." in text and "," in text:
        text = text.replace(".", "").replace(",", ".")
    elif "," in text and "." not in text:
        text = text.replace(",", ".")
    try:
        return float(text)
    except (TypeError, ValueError):
        return 0.0


def _coerce_bdi(value: Any) -> float:
    if isinstance(value, str):
        raw = _coerce_number(value.replace("%", ""))
    else:
        raw = _coerce_number(value)
    if 0 < raw <= 100:
        return raw
    return 0.0


def _infer_bdi_percent(
    quantidade: float,
    valor_unitario: float,
    valor_total: float,
) -> float:
    if quantidade <= 0 or valor_unitario <= 0 or valor_total <= 0:
        return 0.0
    base = quantidade * valor_unitario
    if valor_total <= base * 1.001:
        return 0.0
    inferred = (valor_total / base - 1) * 100
    if 0 < inferred <= 100:
        return round(inferred, 2)
    return 0.0


def _sanitize_bdi(
    bdi: float,
    quantidade: float,
    valor_unitario: float,
    valor_total: float,
) -> float:
    if 0 < bdi <= 100:
        return bdi
    return _infer_bdi_percent(quantidade, valor_unitario, valor_total)


def count_nonempty_rows(rows: list[list[Any]]) -> int:
    return sum(1 for row in rows if any(str(cell).strip() for cell in row))


def _rows_likely_missing_prices(rows: list[list[Any]]) -> bool:
    empty_price_rows = 0
    priced_rows = 0
    for row in rows[1:25]:
        if not any(str(c).strip() for c in row):
            continue
        nums = [_coerce_number(c) for c in row if str(c).strip()]
        if any(n > 0 for n in nums[-2:]):
            priced_rows += 1
        elif len(nums) >= 2:
            empty_price_rows += 1
    return empty_price_rows >= 2 and priced_rows == 0


def _infer_tipo_linha(
    descricao: str,
    quantidade: float,
    valor_unitario: float,
    valor_total: float,
    codigo: str,
    item_numero: str = "",
) -> str:
    desc_norm = descricao.strip().lower()
    if any(kw in desc_norm for kw in _SUBTOTAL_KEYWORDS):
        return "grupo"
    item_stripped = item_numero.strip()
    is_executive_item_number = bool(
        item_stripped and re.match(r"^\d+\.\d+\.\d+", item_stripped)
    )
    has_financial = quantidade > 0 or valor_unitario > 0 or valor_total > 0
    if not has_financial:
        if item_stripped and re.match(r"^\d+(?:\.\d+)?$", item_stripped):
            return "grupo"
        letters = re.sub(r"[^A-Za-zÀ-ÿ]", "", descricao)
        if letters and descricao == descricao.upper() and len(letters) >= 6:
            return "grupo"
        return "grupo"
    if is_executive_item_number and (valor_total > 0 or (quantidade > 0 and valor_unitario > 0)):
        return "item"
    if codigo and quantidade > 0:
        return "item"
    if quantidade > 0 and valor_unitario > 0:
        return "item"
    if valor_total > 0 and descricao:
        return "item"
    return "composicao"


def _score_item_confidence(item: dict[str, Any]) -> tuple[float, list[str]]:
    alerts: list[str] = []
    score = 1.0
    quantidade = _coerce_number(item.get("quantidade"))
    valor_unitario = _coerce_number(item.get("valor_unitario"))
    valor_total = _coerce_number(item.get("valor_total"))
    descricao = str(item.get("descricao") or "").strip()
    codigo = str(item.get("codigo") or "").strip()

    if not descricao:
        score -= 0.35
        alerts.append("Descrição ausente")
    if not codigo:
        score -= 0.05
    if quantidade <= 0 and valor_unitario <= 0 and valor_total <= 0:
        score -= 0.4
        alerts.append("Sem quantidade nem preços")
    elif valor_unitario <= 0 and valor_total <= 0:
        score -= 0.2
        alerts.append("Preços ausentes — preencha manualmente")

    if quantidade > 0 and valor_unitario > 0 and valor_total > 0:
        esperado = quantidade * valor_unitario
        if item.get("bdi"):
            esperado *= 1 + _coerce_bdi(item.get("bdi")) / 100
        erro = abs(valor_total - esperado) / max(abs(valor_total), abs(esperado), 1.0)
        if erro > 0.05:
            score -= min(0.3, erro)
            alerts.append("Qtd×VU pode divergir do total")

    return max(0.0, min(1.0, round(score, 3))), alerts


def _parser_row_to_structured(
    raw: dict[str, Any],
    *,
    page: int,
    table_id: str,
    index: int,
    template_sem_precos: bool,
) -> dict[str, Any]:
    descricao = str(raw.get("descricao") or "").strip()
    codigo = str(raw.get("codigo") or "").strip()
    item_numero = str(raw.get("item_numero") or raw.get("item") or "").strip()
    banco = str(raw.get("banco") or "").strip()
    quantidade = _coerce_number(raw.get("quantidade"))
    valor_unitario = _coerce_number(raw.get("valor_unitario"))
    valor_total = _coerce_number(raw.get("valor_total"))
    bdi = _sanitize_bdi(
        _coerce_bdi(raw.get("bdi")),
        quantidade,
        valor_unitario,
        valor_total,
    )

    if valor_total <= 0 and quantidade > 0 and valor_unitario > 0:
        factor = 1 + bdi / 100 if bdi > 0 else 1
        valor_total = quantidade * valor_unitario * factor

    tipo_linha = _infer_tipo_linha(
        descricao, quantidade, valor_unitario, valor_total, codigo, item_numero
    )

    row: dict[str, Any] = {
        "item": item_numero or str(index),
        "item_numero": item_numero or str(index),
        "tipo": tipo_linha,
        "tipo_linha": tipo_linha,
        "banco": banco,
        "codigo": codigo,
        "descricao": descricao,
        "bdi": bdi,
        "unidade": str(raw.get("unidade") or "un").strip() or "un",
        "quantidade": quantidade,
        "valor_unitario": valor_unitario,
        "valor_total": valor_total,
        "origem_extracao": "parser_local",
        "_source_table_id": table_id,
        "_source_page": page,
    }

    confianca, alertas = _score_item_confidence(row)
    row["confianca"] = confianca
    row["alertas"] = alertas
    if template_sem_precos and valor_unitario <= 0 and valor_total <= 0:
        alertas.append("Preços em branco no edital — informe manualmente")
        row["alertas"] = alertas

    return row


def _items_from_table_rows(
    rows: list[list[Any]],
    *,
    page: int,
    table_id: str,
) -> list[dict[str, Any]]:
    parser = BudgetParser()
    parsed_items, _ = parser.parse_table(rows, page=page)
    template_sem_precos = _rows_likely_missing_prices(rows)
    structured: list[dict[str, Any]] = []

    for idx, raw in enumerate(parsed_items, start=1):
        if not isinstance(raw, dict):
            continue
        descricao = str(raw.get("descricao") or "").strip()
        if len(descricao) < 3:
            continue
        structured.append(
            _parser_row_to_structured(
                raw,
                page=page,
                table_id=table_id,
                index=idx,
                template_sem_precos=template_sem_precos,
            )
        )

    return structured


def _deduplicate_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[tuple[str, str, str, str, float, float]] = set()
    result: list[dict[str, Any]] = []
    for raw in items:
        source = str(raw.get("_source_table_id") or "").strip().lower()
        item_numero = str(raw.get("item_numero") or raw.get("item") or "").strip().lower()
        codigo = str(raw.get("codigo") or "").strip().lower()
        descricao = str(raw.get("descricao") or "").strip().lower()[:120]
        quantidade = round(_coerce_number(raw.get("quantidade")), 4)
        valor_unitario = round(_coerce_number(raw.get("valor_unitario")), 2)
        key = (source, item_numero, codigo, descricao, quantidade, valor_unitario)
        if key in seen:
            continue
        if not codigo and not descricao:
            continue
        seen.add(key)
        result.append(raw)
    return result


def _filter_for_analysis(
    items: list[dict[str, Any]],
    analysis_types: list[str],
) -> list[dict[str, Any]]:
    if "curva_abc" not in analysis_types:
        return items

    filtered: list[dict[str, Any]] = []
    for item in items:
        tipo = str(item.get("tipo_linha") or item.get("tipo") or "item").lower()
        item_numero = str(item.get("item_numero") or item.get("item") or "").strip()
        descricao = str(item.get("descricao") or "").lower()
        if tipo == "grupo" or "total do grupo" in descricao:
            continue
        if tipo == "composicao" and not re.match(r"^\d+\.\d+\.\d+", item_numero):
            continue
        q = _coerce_number(item.get("quantidade"))
        vu = _coerce_number(item.get("valor_unitario"))
        vt = _coerce_number(item.get("valor_total"))
        if q <= 0 and vu <= 0 and vt <= 0:
            continue
        filtered.append(item)
    return filtered


def _candidate_page(candidate: dict[str, Any]) -> int:
    return int(candidate.get("num_pagina") or candidate.get("pagina") or 1)


def _resolve_rows(candidate: dict[str, Any]) -> list[list[Any]]:
    rows = candidate.get("rows")
    if not isinstance(rows, list) or not rows:
        raise HTTPException(
            status_code=409,
            detail="Cache de tabelas incompleto. Detecte as tabelas novamente.",
        )
    if count_nonempty_rows(rows) < 3:
        label = str(candidate.get("nome_tabela") or candidate.get("id") or "tabela")
        raise HTTPException(
            status_code=400,
            detail=f'A tabela "{label}" tem poucas linhas para análise.',
        )
    return rows


def process_selected_tables(
    upload_id: str,
    user_id: str,
    table_ids: list[str],
    analysis_types: list[str],
) -> dict[str, Any]:
    upload_store = UploadStore()
    upload_id = UploadStore.validate_upload_id(upload_id)
    upload_store.assert_access(upload_id, user_id)

    meta = upload_store.load_meta(upload_id)
    filename = str(meta.get("filename") or f"{upload_id}.pdf")

    cache = TableCacheStore()
    options, _ = cache.get(upload_id)
    if not options:
        raise HTTPException(
            status_code=409,
            detail="Nenhuma tabela em cache. Volte e detecte as tabelas novamente.",
        )

    by_id = {str(o.get("id")): o for o in options if o.get("id")}
    unknown = [t for t in table_ids if t not in by_id]
    if unknown:
        raise HTTPException(
            status_code=400,
            detail=f"Tabela(s) inválida(s): {', '.join(unknown)}",
        )

    all_structured: list[dict[str, Any]] = []
    tables_out: list[dict[str, Any]] = []

    for table_id in table_ids:
        candidate = by_id[table_id]
        rows = _resolve_rows(candidate)
        page = _candidate_page(candidate)
        structured = _items_from_table_rows(rows, page=page, table_id=table_id)
        all_structured.extend(structured)
        tables_out.append(
            {
                "page": page,
                "table_id": table_id,
                "rows": rows,
                "original_rows": len(rows),
                "columns": len(rows[0]) if rows else 0,
                "items_parsed": len(structured),
            }
        )
        logger.info(
            "Parser local: tabela %s pág %s → %s itens",
            table_id,
            page,
            len(structured),
        )

    deduped = _deduplicate_items(all_structured)
    filtered = _filter_for_analysis(deduped, analysis_types)

    if not filtered and deduped:
        filtered = [i for i in deduped if str(i.get("tipo_linha", i.get("tipo"))) != "grupo"]

    if not filtered:
        raise HTTPException(
            status_code=400,
            detail=(
                "Nenhum item executivo encontrado nas tabelas selecionadas. "
                "Verifique se a planilha contém Código, Qtde e Preço."
            ),
        )

    valor_total = sum(_coerce_number(i.get("valor_total")) for i in filtered)
    resumo = {
        "total_items": len(filtered),
        "valor_total": round(valor_total, 2),
        "metodo": "budget_parser",
        "analysis_types": analysis_types,
    }

    return {
        "status": "success",
        "upload_id": upload_id,
        "filename": filename,
        "tables_found": len(tables_out),
        "items_found": len(filtered),
        "analysis_types": analysis_types,
        "engine": "budget_parser",
        "tables": tables_out,
        "items": filtered,
        "structured_items": filtered,
        "hierarchical_items": filtered,
        "resumo": resumo,
        "message": (
            f"{len(filtered)} item(ns) extraídos por análise local "
            f"({', '.join(analysis_types)})."
        ),
    }
