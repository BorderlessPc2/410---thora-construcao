from typing import Any

from pydantic import BaseModel, Field


class CorrecaoAnaliseContexto(BaseModel):
    bdi_global_percent: float = 0
    tolerancia_monetaria: float = 0.02
    tolerancia_percentual: float = 0.5


class CorrecaoAnaliseRequest(BaseModel):
    upload_id: str | None = None
    versao_modelo: str = "1.0"
    contexto: CorrecaoAnaliseContexto | None = None
    linhas_com_problema: list[dict[str, Any]] = Field(default_factory=list)
    nome_arquivo: str | None = None


class CorrecaoAnaliseResponse(BaseModel):
    diagnostico_geral: str
    itens: list[dict[str, Any]]
    aprendizados_para_extracao: list[str]
    aprendizados_totais: list[str]
    escopo: str = "global"
    total_regras_globais: int = 0
    model: str
    provider: str
