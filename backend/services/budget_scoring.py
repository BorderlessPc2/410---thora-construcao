"""
Heurísticas compartilhadas para detectar páginas/tabelas de orçamento em PDFs.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from io import BytesIO
from typing import Any, List, Tuple

import pdfplumber

_BUDGET_PAGE_KEYWORDS = (
    "sinapi",
    "sicro",
    "orse",
    "siurb",
    "agetop",
    "sco ",
    "composição",
    "composicao",
    "insumo",
    "planilha analítica",
    "planilha analitica",
    "planilha orçamentária",
    "planilha orcamentaria",
    "valor unit",
    "preço unit",
    "preco unit",
    "preço total",
    "preco total",
    "quant.",
    "qtde",
    "qtd ",
    "b.d.i",
    "bdi",
    " und ",
    "m²",
    "m3",
)

_STRONG_BUDGET_KEYWORDS = (
    "sinapi",
    "sicro",
    "planilha analítica",
    "planilha analitica",
    "planilha orçamentária",
    "planilha orcamentaria",
    "preço unit",
    "preco unit",
    "valor unit",
    "qtde",
    "quant.",
)

_EDITAL_NOISE_KEYWORDS = (
    "licitação",
    "licitacao",
    "edital",
    "decreto",
    "art.",
    "parágrafo",
    "microempresa",
    "certame",
    "fornecedor",
    "proposta",
    "habilitação",
    "habilitacao",
    "pregão",
    "pregao",
    "impugnação",
    "impugnacao",
    "recurso administrativo",
)

_BUDGET_HEADER_HINTS: dict[str, list[str]] = {
    "descricao": ["descrição", "descricao", "serviço", "servico", "do serviço", "do servico"],
    "quantidade": ["qtde", "quant", "quantidade", "qtd"],
    "valor": [
        "preço unit",
        "preco unit",
        "valor unit",
        "p. unit",
        "p.unit",
        "unitário",
        "unitario",
        "preço total",
        "preco total",
    ],
    "codigo": ["código", "codigo", "code"],
    "bdi": ["bdi", "% bdi"],
}

_SERVICE_CODE_PATTERN = re.compile(
    r"\b(CPU\d+|[A-Z]{2,}\d{3,}|\d{5,}[A-Z]?)\b",
    re.IGNORECASE,
)

_NUMERIC_CELL_PATTERN = re.compile(r"\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}")


def _coerce_number(value: Any) -> float:
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip()
    if not text:
        return 0.0
    text = text.replace("R$", "").replace("%", "").strip()
    if "," in text and "." in text:
        text = text.replace(".", "").replace(",", ".")
    elif "," in text:
        text = text.replace(",", ".")
    try:
        return float(text)
    except ValueError:
        return 0.0


def score_budget_table_likelihood(rows: List[List[Any]]) -> int:
    """Pontua se a matriz parece planilha de orçamento (não texto do edital)."""
    if not rows:
        return 0

    score = 0
    sample_parts: list[str] = []
    for row in rows[:15]:
        sample_parts.append(" ".join(str(c).lower() for c in row if c))
    sample_text = " ".join(sample_parts)

    edital_hits = sum(1 for kw in _EDITAL_NOISE_KEYWORDS if kw in sample_text)
    if edital_hits >= 4:
        score -= 40
    elif edital_hits >= 2:
        score -= 15

    for row in rows[:18]:
        row_text = " ".join(str(c).lower() for c in row if c)
        has_desc = any(k in row_text for k in _BUDGET_HEADER_HINTS["descricao"])
        has_qtd = any(k in row_text for k in _BUDGET_HEADER_HINTS["quantidade"])
        has_val = any(k in row_text for k in _BUDGET_HEADER_HINTS["valor"])
        has_cod = any(k in row_text for k in _BUDGET_HEADER_HINTS["codigo"])
        has_bdi = any(k in row_text for k in _BUDGET_HEADER_HINTS["bdi"])
        if has_desc and (has_qtd or has_val):
            score += 28
        if has_cod and (has_qtd or has_val):
            score += 22
        if has_bdi and has_cod:
            score += 12

    code_rows = 0
    for row in rows[1 : min(45, len(rows))]:
        line = " ".join(str(c) for c in row if c)
        if _SERVICE_CODE_PATTERN.search(line):
            code_rows += 1
    score += min(code_rows * 4, 36)

    numeric_rows = 0
    for row in rows[1 : min(35, len(rows))]:
        nums = sum(1 for c in row if _coerce_number(c) > 0)
        if nums >= 2:
            numeric_rows += 1
    score += min(numeric_rows * 2, 20)

    if "orçamento" in sample_text or "orcamento" in sample_text:
        score += 8
    if "composição" in sample_text or "composicao" in sample_text:
        score += 6

    return score


def _keyword_score(text: str) -> tuple[int, int]:
    lowered = text.lower()
    general = sum(1 for kw in _BUDGET_PAGE_KEYWORDS if kw in lowered)
    strong = sum(1 for kw in _STRONG_BUDGET_KEYWORDS if kw in lowered)
    return general, strong


def _edital_noise_score(text: str) -> int:
    lowered = text.lower()
    return sum(1 for kw in _EDITAL_NOISE_KEYWORDS if kw in lowered)


def _text_has_budget_numeric_pattern(text: str) -> bool:
    return len(_NUMERIC_CELL_PATTERN.findall(text)) >= 3 or len(
        _SERVICE_CODE_PATTERN.findall(text)
    ) >= 2


@dataclass(frozen=True)
class BudgetPageCandidate:
    page_number: int
    image_detail: str  # "high" | "low" | "text"
    table_score: int
    keyword_score: int


def detect_budget_pages(
    pdf_content: bytes,
    *,
    max_pages: int = 60,
    min_table_score: int = 12,
    min_strong_keywords: int = 2,
) -> List[BudgetPageCandidate]:
    """
    Retorna páginas candidatas com nível de detalhe da visão para a IA.
    Páginas fracas (só edital com palavras genéricas) são excluídas.
    """
    candidates: list[tuple[int, BudgetPageCandidate]] = []

    with pdfplumber.open(BytesIO(pdf_content)) as pdf:
        total = min(len(pdf.pages), max_pages)
        for idx in range(total):
            page_num = idx + 1
            page = pdf.pages[idx]
            text = page.extract_text() or ""
            if not text.strip():
                continue

            kw_general, kw_strong = _keyword_score(text)
            edital_noise = _edital_noise_score(text)
            has_numeric = _text_has_budget_numeric_pattern(text)

            tables = page.extract_tables() or []
            table_scores = [
                score_budget_table_likelihood(table)
                for table in tables
                if table and any(any(str(c).strip() for c in row) for row in table)
            ]
            best_table = max(table_scores) if table_scores else 0

            if best_table >= 18:
                detail = "high"
            elif best_table >= min_table_score or (
                kw_strong >= min_strong_keywords and has_numeric
            ):
                detail = "low"
            elif kw_strong >= 3 and has_numeric and edital_noise <= 2:
                detail = "low"
            else:
                continue

            if edital_noise >= 4 and best_table < 15 and kw_strong < 2:
                continue
            if kw_general < 2 and best_table < min_table_score:
                continue
            if edital_noise >= 3 and best_table < 10 and kw_strong == 0:
                continue

            priority = best_table * 10 + kw_strong * 5 + kw_general
            candidates.append(
                (
                    priority,
                    BudgetPageCandidate(
                        page_number=page_num,
                        image_detail=detail,
                        table_score=best_table,
                        keyword_score=kw_general,
                    ),
                )
            )

    if candidates:
        candidates.sort(key=lambda item: item[1].page_number)
        return [item[1] for item in candidates]

    # Fallback conservador: páginas com tabela scoreável ou padrão numérico forte
    fallback: list[BudgetPageCandidate] = []
    with pdfplumber.open(BytesIO(pdf_content)) as pdf:
        total = min(len(pdf.pages), max_pages)
        for idx in range(total):
            page_num = idx + 1
            page = pdf.pages[idx]
            text = page.extract_text() or ""
            if not text.strip():
                continue
            tables = page.extract_tables() or []
            best_table = max(
                (score_budget_table_likelihood(t) for t in tables if t),
                default=0,
            )
            if best_table >= 8 or (
                _text_has_budget_numeric_pattern(text) and _keyword_score(text)[0] >= 1
            ):
                fallback.append(
                    BudgetPageCandidate(
                        page_number=page_num,
                        image_detail="low" if best_table < 18 else "high",
                        table_score=best_table,
                        keyword_score=_keyword_score(text)[0],
                    )
                )
    return fallback
