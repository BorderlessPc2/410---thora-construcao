"""
Valida BudgetParser + orcamento_extraction com as 3 tabelas de referência NOVACAP.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.domain.services.orcamento_extraction import (  # noqa: E402
    _deduplicate_items,
    _filter_for_analysis,
    _items_from_table_rows,
)

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

TABLE_1 = [
    ["1.1.1", "SICRO-EQ", "EQ-001", "CAVALO MECÂNICO TRATOR AGRÍCOLA DE 188 KW", "CHP", "50,00", "371,26", "18.563,00", "21,22", "22.525,82", ""],
    ["1.1.2", "SICRO-EQ", "EQ-002", "CAMINHÃO GUINDAUTO COM LANÇA TELESCÓPICA", "CHP", "80,00", "528,47", "42.277,60", "21,22", "51.138,33", ""],
]

TABLE_2 = [
    ["2.1.1", "SINAPI", "93567", "ENGENHEIRO CIVIL DE OBRA PLENO COM ENCARGOS COMPLEMENTARES", "MES", "6,00", "27.456,32", "164.737,92", "21,22", "199.695,30", ""],
    ["2.1.3", "SICRO-M", "P9864-M", "ENGENHEIRO DE SEGURANÇA DO TRABALHO COM ENCARGOS COMPLEMENTARES", "MES", "2,00", "24.150,10", "48.300,20", "21,22", "58.549,50", ""],
    ["2.2.1", "SINAPI-M", "93565-M", "ENGENHEIRO DE FUNDAÇÕES", "MES", "3,00", "23.382,42", "70.147,26", "21,22", "85.032,50", ""],
]

TABLE_3 = [
    ["3.1.4", "COTAÇÃO", "COT-SOND 05", "SONDAGEM A PERCUSSÃO (SPT) COM/SEM LAVAGEM", "UN", "4,00", "2.319,57", "9.278,28", "11,10", "10.308,15", ""],
    ["3.1.25", "COTAÇÃO", "COT-ART 02", "LAUDO TÉCNICO E ART - SONDAGEM", "UN", "1,00", "1.288,65", "1.288,65", "11,10", "1.431,68", ""],
]


def rows_for(data: list[list[str]]) -> list[list[str]]:
    return [HEADER, *data]


def parse_table(data: list[list[str]], table_id: str) -> list[dict]:
    items = _items_from_table_rows(rows_for(data), page=1, table_id=table_id)
    return _filter_for_analysis(_deduplicate_items(items), ["curva_abc"])


def brl(value: float) -> str:
    return f"R$ {value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def main() -> None:
    cases = [
        ("t1", TABLE_1, {"1.1.1", "1.1.2"}),
        ("t2", TABLE_2, {"2.1.1", "2.1.3", "2.2.1"}),
        ("t3", TABLE_3, {"3.1.4", "3.1.25"}),
    ]

    ok = True
    for table_id, data, expected_items in cases:
        items = parse_table(data, table_id)
        numeros = {str(i.get("item_numero") or i.get("item")) for i in items}
        total = sum(float(i.get("valor_total") or 0) for i in items)

        print(f"\n[{table_id}] itens={len(items)} total={brl(total)}")
        for item in items:
            num = item.get("item_numero") or item.get("item")
            print(
                f"  {num} | {item.get('banco')} | {item.get('codigo')} | "
                f"{brl(float(item.get('valor_total') or 0))}"
            )

        if numeros != expected_items:
            print(f"  ERRO numeros: esperado {expected_items}, obtido {numeros}")
            ok = False

        if table_id == "t3":
            expected_total = 10_308.15 + 1_431.68
            if abs(total - expected_total) > 0.05:
                print(f"  ERRO total t3: esperado {brl(expected_total)}, obtido {brl(total)}")
                ok = False

    if ok:
        print("\nOK - parser preserva item_numero e Total c/ BDI")
    else:
        print("\nFALHOU")
        sys.exit(1)


if __name__ == "__main__":
    main()
