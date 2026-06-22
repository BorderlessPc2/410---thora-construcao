"""
Cálculo BDI conforme fórmula TCU (Acórdão 2622/2013).
BDI = [(1 + AC + S + R + DF) × (1 + L) / (1 - T) - 1] × 100
"""

from __future__ import annotations

from typing import Any, Dict, List


CATEGORIA_LABELS = {
    "despesas_indiretas": "Despesas indiretas",
    "risco": "Risco",
    "lucro": "Lucro",
    "tributos": "Tributos",
}


def _find_valor(componentes: List[Dict[str, Any]], ids: List[str]) -> float:
    for comp_id in ids:
        for comp in componentes:
            if str(comp.get("id", "")) == comp_id:
                return float(comp.get("valor") or 0) / 100.0
    return 0.0


def calcular_bdi_tcu(componentes: List[Dict[str, Any]]) -> Dict[str, Any]:
    ac = _find_valor(componentes, ["administracao_central"])
    s = _find_valor(componentes, ["seguro_garantia"])
    r = _find_valor(componentes, ["risco"])
    df = _find_valor(componentes, ["despesas_financeiras"])
    lucro = _find_valor(componentes, ["lucro"])

    tributos = sum(
        float(c.get("valor") or 0) / 100.0
        for c in componentes
        if str(c.get("categoria", "")) == "tributos"
    )

    numerator = (1 + ac + s + r + df) * (1 + lucro)
    denominator = 1 - tributos
    fator = numerator / denominator if denominator > 0 else numerator
    bdi_percentual = round((fator - 1) * 100, 2)
    fator_bdi = round(1 + bdi_percentual / 100, 4)

    breakdown_map: Dict[str, float] = {}
    for comp in componentes:
        cat = str(comp.get("categoria") or "")
        label = CATEGORIA_LABELS.get(cat, cat)
        breakdown_map[label] = breakdown_map.get(label, 0.0) + float(comp.get("valor") or 0)

    breakdown = [
        {"categoria": cat, "total": round(total, 2)}
        for cat, total in breakdown_map.items()
    ]

    return {
        "bdi_percentual": bdi_percentual,
        "fator_bdi": fator_bdi,
        "breakdown": breakdown,
    }
