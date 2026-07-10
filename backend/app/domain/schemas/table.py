from typing import Any

from pydantic import BaseModel, Field


class TableCandidatePublic(BaseModel):
    id: str
    pagina: int
    num_pagina: int | None = None
    nome_tabela: str | None = None
    preview_texto: str | None = None
    coordenadas: list[float] | None = None
    imagem_base64: str | None = None
    source: str | None = None
    row_count: int | None = None
    budget_score: int | None = None
    is_budget_likely: bool | None = None
    preview_rows: list[list[str]] | None = None


class TableDetectResponse(BaseModel):
    status: str = "success"
    upload_id: str
    tables_found: int = 0
    options: list[dict[str, Any]] = Field(default_factory=list)
    mock_fallback: bool = False
    cached: bool = False
    recommended_table_ids: list[str] = Field(default_factory=list)
    # Campos de job assíncrono (quando status=processing)
    pages_total: int = 0
    pages_done: int = 0
    candidates_found: int = 0
    message: str | None = None
    error: str | None = None
