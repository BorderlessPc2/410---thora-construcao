"""Testa extração completa das 3 tabelas de referência (48 itens executivos)."""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.domain.services.orcamento_extraction import (  # noqa: E402
    _deduplicate_items,
    _filter_for_analysis,
    _items_from_table_rows,
)

spec = importlib.util.spec_from_file_location(
    "analyze_three_tables",
    ROOT / "scripts" / "analyze_three_tables.py",
)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

HEADER = [
    "Item",
    "Fonte",
    "Código",
    "Descrição",
    "Unid.",
    "Qtde.",
    "Preço Unit.",
    "Preço Total",
    "BDI (%)",
    "Total c/ BDI",
    "Obs.",
]

EXPECTED = [
    ("1 - Servicos Preliminares", mod.TABLE_1, 16, 396_490.67),
    ("2 - Administracao Local", mod.TABLE_2, 7, 576_292.17),
    ("3 - Ensaios e Sondagens", mod.TABLE_3, 25, 73_280.56),
]


def brl(v: float) -> str:
    return f"R$ {v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def main() -> None:
    all_items: list[dict] = []
    ok = True

    for name, data, exp_count, exp_total in EXPECTED:
        rows = [HEADER, *data]
        items = _filter_for_analysis(
            _deduplicate_items(_items_from_table_rows(rows, page=1, table_id=name)),
            ["curva_abc"],
        )
        total = sum(float(i.get("valor_total") or 0) for i in items)
        print(f"\n{name}: {len(items)} itens (esperado {exp_count}) total={brl(total)} (esperado {brl(exp_total)})")
        if len(items) != exp_count:
            ok = False
        if abs(total - exp_total) > 1.0:
            ok = False
        all_items.extend(items)

    grand = sum(float(i.get("valor_total") or 0) for i in all_items)
    print(f"\nTOTAL GERAL: {len(all_items)} itens, {brl(grand)} (esperado 48 itens, {brl(1_046_063.40)})")
    if len(all_items) != 48 or abs(grand - 1_046_063.40) > 2.0:
        ok = False

    if ok:
        print("\nOK")
    else:
        print("\nFALHOU")
        sys.exit(1)


if __name__ == "__main__":
    main()
