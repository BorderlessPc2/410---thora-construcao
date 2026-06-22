"""
Router BDI — cálculo TCU e aplicação em orçamentos.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Callable, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from firebase_service import OrcamentoFirestore, db
from services.bdi_calculator import calcular_bdi_tcu

router = APIRouter(tags=["bdi"])

_get_current_user_id: Optional[Callable] = None


def configure_bdi_auth(get_user_id: Callable) -> None:
    global _get_current_user_id
    _get_current_user_id = get_user_id


async def _current_user_id(request: Request) -> str:
    if _get_current_user_id is None:
        raise HTTPException(status_code=500, detail="Auth não configurado para BDI")
    return await _get_current_user_id(request)


class BDICalculateRequest(BaseModel):
    componentes: List[Dict[str, Any]] = Field(default_factory=list)


class BDIApplyRequest(BaseModel):
    upload_id: str
    bdi_percentual: float = Field(..., ge=0, le=100)
    bdi_config_id: str = ""
    tipo_aplicacao: Literal["todos", "apenas_servicos", "apenas_materiais"] = "todos"


def _coerce_number(value: Any) -> float:
    try:
        if value is None:
            return 0.0
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _item_unit_price(item: Dict[str, Any]) -> float:
    for key in ("valor_unitario", "unitValue", "unitPrice", "precoUnitario"):
        val = _coerce_number(item.get(key))
        if val > 0:
            return val
    return 0.0


def _item_qty(item: Dict[str, Any]) -> float:
    for key in ("quantidade", "quantity", "qty"):
        val = _coerce_number(item.get(key))
        if val > 0:
            return val
    return 0.0


def _should_apply_item(item: Dict[str, Any], tipo_aplicacao: str) -> bool:
    if tipo_aplicacao == "todos":
        return True
    tipo = str(item.get("tipo") or item.get("tipo_linha") or "item").lower()
    desc = str(item.get("descricao") or item.get("description") or "").lower()
    if tipo == "grupo" or "total do grupo" in desc:
        return False
    is_material = (
        "material" in desc
        or "insumo" in tipo
        or tipo in ("material", "insumo")
    )
    is_servico = (
        "serviço" in desc
        or "servico" in desc
        or "mão de obra" in desc
        or "mao de obra" in desc
        or tipo in ("servico", "serviço", "composicao", "composição")
    )
    if tipo_aplicacao == "apenas_materiais":
        return is_material or (not is_servico and tipo == "item")
    if tipo_aplicacao == "apenas_servicos":
        return is_servico or (not is_material and tipo == "item")
    return True


def _apply_bdi_to_items(
    items: List[Dict[str, Any]],
    bdi_percentual: float,
    tipo_aplicacao: str,
) -> tuple[List[Dict[str, Any]], int, float, float, float]:
    factor = 1 + bdi_percentual / 100
    updated: List[Dict[str, Any]] = []
    impactados = 0
    valor_sem = 0.0
    valor_com = 0.0
    economia_base = 0.0

    for raw in items:
        if not isinstance(raw, dict):
            continue
        item = dict(raw)
        if not _should_apply_item(item, tipo_aplicacao):
            updated.append(item)
            continue

        qty = _item_qty(item)
        unit = _item_unit_price(item)
        if qty <= 0 or unit <= 0:
            updated.append(item)
            continue

        unit_com = round(unit * factor, 4)
        total_sem = qty * unit
        total_com = qty * unit_com
        bdi_pdf = _coerce_number(item.get("bdi"))
        if bdi_pdf > 0:
            total_pdf = qty * unit * (1 + bdi_pdf / 100)
            economia_base += total_pdf - total_com

        item["valor_unitario"] = unit_com
        item["unitValue"] = unit_com
        item["unitPrice"] = unit
        item["bdi"] = bdi_percentual
        item["valor_total"] = round(total_com, 2)
        item["totalValue"] = round(total_com, 2)
        item["lineTotal"] = round(total_com, 2)

        valor_sem += total_sem
        valor_com += total_com
        impactados += 1
        updated.append(item)

    return updated, impactados, valor_sem, valor_com, economia_base


@router.post("/api/bdi/calculate")
async def bdi_calculate(payload: BDICalculateRequest):
    """Cálculo stateless do BDI pela fórmula TCU."""
    if not payload.componentes:
        raise HTTPException(status_code=400, detail="Nenhum componente informado.")
    try:
        return calcular_bdi_tcu(payload.componentes)
    except Exception as exc:
        print(f"[bdi/calculate] Erro: {exc}")
        raise HTTPException(status_code=500, detail=f"Erro ao calcular BDI: {exc}") from exc


@router.post("/api/bdi/apply")
async def bdi_apply(
    payload: BDIApplyRequest,
    user_id: str = Depends(_current_user_id),
):
    """Aplica BDI aos itens do orçamento e persiste registro."""
    upload_id = payload.upload_id.strip()
    if not upload_id:
        raise HTTPException(status_code=400, detail="upload_id é obrigatório.")

    orcamento = OrcamentoFirestore.get_orcamento_by_upload_id(upload_id, user_id=user_id)
    if not orcamento:
        raise HTTPException(status_code=404, detail=f"Orçamento não encontrado: {upload_id}")

    items = orcamento.get("items") or []
    if not items:
        items_data = orcamento.get("itemsData") or orcamento.get("items_data") or {}
        if isinstance(items_data, dict):
            items = items_data.get("items") or items_data.get("hierarchical_items") or []

    if not items:
        raise HTTPException(status_code=400, detail="Orçamento sem itens para aplicar BDI.")

    updated_items, impactados, valor_sem, valor_com, economia = _apply_bdi_to_items(
        items,
        payload.bdi_percentual,
        payload.tipo_aplicacao,
    )

    if impactados == 0:
        raise HTTPException(status_code=400, detail="Nenhum item elegível para aplicar BDI.")

    doc_id = str(orcamento.get("id") or upload_id)
    OrcamentoFirestore.update_orcamento(doc_id, {
        "items": updated_items,
        "updatedAt": datetime.now(),
    })

    aplicado = {
        "userId": user_id,
        "uploadId": upload_id,
        "bdiConfigId": payload.bdi_config_id or "",
        "bdiPercentual": payload.bdi_percentual,
        "valorSemBDI": round(valor_sem, 2),
        "valorComBDI": round(valor_com, 2),
        "economia": round(economia, 2),
        "dataAplicacao": datetime.now().isoformat(),
        "itensImpactados": impactados,
        "tipoAplicacao": payload.tipo_aplicacao,
    }

    if db:
        try:
            db.collection("bdi_aplicados").add(aplicado)
        except Exception as exc:
            print(f"[bdi/apply] Erro ao salvar bdi_aplicados: {exc}")

    return {
        "uploadId": upload_id,
        "bdiConfigId": payload.bdi_config_id or "",
        "bdiPercentual": payload.bdi_percentual,
        "valorSemBDI": round(valor_sem, 2),
        "valorComBDI": round(valor_com, 2),
        "economia": round(economia, 2),
        "dataAplicacao": aplicado["dataAplicacao"],
        "itensImpactados": impactados,
    }
