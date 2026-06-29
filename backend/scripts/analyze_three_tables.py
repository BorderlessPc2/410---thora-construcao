"""
Análise das 3 tabelas com padrão Thora:
- valor econômico = Total c/ BDI
- filtro itens executivos (Curva ABC)
- classificação Pareto 80/15/5
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.domain.services.orcamento_extraction import (  # noqa: E402
    _deduplicate_items,
    _filter_for_analysis,
    _score_item_confidence,
)


def parse_br(value: str) -> float:
    s = value.strip().replace("R$", "").replace(" ", "")
    if "." in s and "," in s:
        s = s.replace(".", "").replace(",", ".")
    elif "," in s:
        s = s.replace(",", ".")
    return float(s)


def row_to_item(cells: list[str]) -> dict:
    """Linha: Item, Fonte, Código, Descrição, Unid, Qtde, V.Unit, V.Total s/BDI, BDI%, Total c/BDI"""
    item_num, fonte, codigo, descricao, unid, qtde, v_unit, _v_total_sem, bdi, v_total_com = cells
    qty = parse_br(qtde)
    unit_price = parse_br(v_unit)
    bdi_pct = parse_br(bdi)
    total_com_bdi = parse_br(v_total_com)
    row = {
        "item": item_num,
        "tipo": "item",
        "tipo_linha": "item",
        "banco": fonte,
        "codigo": codigo,
        "descricao": descricao,
        "unidade": unid,
        "quantidade": qty,
        "valor_unitario": unit_price,
        "valor_total": total_com_bdi,
        "bdi": bdi_pct,
        "origem_extracao": "parser_local",
    }
    conf, alerts = _score_item_confidence(row)
    row["confianca"] = conf
    row["alertas"] = alerts
    return row


def classify_abc(items: list[dict]) -> list[dict]:
    sorted_items = sorted(
        items,
        key=lambda x: (-float(x.get("valor_total") or 0), str(x.get("codigo") or "")),
    )
    total = sum(float(x.get("valor_total") or 0) for x in sorted_items)
    accumulated = 0.0
    out = []
    for item in sorted_items:
        vt = float(item.get("valor_total") or 0)
        pct_before = (accumulated / total * 100) if total > 0 else 0
        accumulated += vt
        cls = "A" if pct_before < 80 else "B" if pct_before < 95 else "C"
        row = dict(item)
        row["classification"] = cls
        row["accumulated_percentage"] = round(accumulated / total * 100, 1) if total else 0
        out.append(row)
    return out


def brl(value: float) -> str:
    return f"R$ {value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


# Dados extraídos das imagens (Total c/ BDI = coluna econômica para ABC)
TABLE_1 = [
    ["1.1.1", "SICRO-EQ", "EQ-001", "CAVALO MECÂNICO TRATOR AGRÍCOLA DE 188 KW", "CHP", "50,00", "371,26", "18.563,00", "21,22", "22.525,82"],
    ["1.1.2", "SICRO-EQ", "EQ-002", "CAMINHÃO GUINDAUTO COM LANÇA TELESCÓPICA", "CHP", "80,00", "528,47", "42.277,60", "21,22", "51.138,33"],
    ["1.2.3", "SICRO-EQ", "EQ-010", "TRANSPORTE COM CAMINHÃO BASCULANTE", "M3", "200,00", "37,28", "7.456,00", "21,22", "9.048,87"],
    ["1.2.4", "PRÓPRIA", "PL-01", "PLACA DE OBRA", "UN", "1,00", "14.100,00", "14.100,00", "21,22", "17.090,20"],
    ["1.2.5", "ORSE-M", "OR-55", "TAPUME COM TELHA METÁLICA", "M2", "400,00", "54,42", "21.768,00", "21,22", "26.398,78"],
    ["1.2.9", "FDE-SP", "CT-01", "LOCACAO DE CONTAINER PARA ESCRITORIO", "MES", "6,00", "1.527,00", "9.162,00", "21,22", "11.091,63"],
    ["1.2.11", "FDE-SP", "CT-03", "LOCACAO DE CONTAINER PARA SANITARIO", "MES", "6,00", "1.908,00", "11.448,00", "21,22", "13.864,53"],
    ["1.2.15", "SINAPI", "94971", "EXECUÇÃO DE RESERVATÓRIO ELEVADO DE ÁGUA (2000 LITROS)", "UN", "1,00", "22.750,00", "22.750,00", "21,22", "27.571,94"],
    ["1.2.17", "SINAPI", "94973", "ESTRUTURA DE MADEIRA PROVISÓRIA PARA CAIXA D'ÁGUA (3000L)", "UN", "1,00", "20.008,00", "20.008,00", "21,22", "24.251,70"],
    ["1.2.18", "SINAPI", "94974", "TANQUE SÉPTICO CIRCULAR", "UN", "1,00", "9.760,00", "9.760,00", "21,22", "11.826,21"],
    ["1.4.1", "PRÓPRIA", "EN-01", "CONSUMO MENSAL DE ENERGIA ELÉTRICA", "MES", "6,00", "1.660,00", "9.960,00", "21,22", "12.058,52"],
    ["1.4.2", "PRÓPRIA", "AG-01", "CONSUMO MENSAL DE ÁGUA E ESGOTO", "MES", "6,00", "832,00", "4.992,00", "21,22", "6.048,39"],
    ["1.5.1", "SICRO-EQ", "EQ-20", "CAMINHÃO PIPA 6.000 L - HORA PRODUTIVA", "CHP", "200,00", "171,20", "34.240,00", "21,22", "41.519,49"],
    ["1.5.2", "SICRO-EQ", "EQ-21", "CAMINHÃO PIPA 6.000 L - HORA IMPRODUTIVA", "CHI", "150,00", "153,20", "22.980,00", "21,22", "27.898,54"],
    ["1.5.3", "SICRO-EQ", "EQ-22", "GRUPO GERADOR ESTACIONARIO 170 KVA - HORA PRODUTIVA", "CHP", "100,00", "169,50", "16.950,00", "21,22", "20.562,40"],
    ["1.5.4", "SICRO-EQ", "EQ-23", "GRUPO GERADOR ESTACIONARIO 150 KVA - HORA IMPRODUTIVA", "CHI", "30,00", "110,00", "3.300,00", "21,22", "4.002,39"],
]

TABLE_2 = [
    ["2.1.1", "SINAPI", "93567", "ENGENHEIRO CIVIL DE OBRA PLENO COM ENCARGOS COMPLEMENTARES", "MES", "6,00", "27.456,32", "164.737,92", "21,22", "199.695,30"],
    ["2.1.2", "SINAPI", "100534", "TÉCNICO DE EDIFICAÇÕES COM ENCARGOS COMPLEMENTARES", "MES", "6,00", "4.782,19", "28.693,14", "21,22", "34.781,82"],
    ["2.1.3", "SICRO-M", "P9864-M", "ENGENHEIRO DE SEGURANÇA DO TRABALHO COM ENCARGOS COMPLEMENTARES", "MES", "2,00", "24.150,10", "48.300,20", "21,22", "58.549,50"],
    ["2.1.4", "SINAPI", "100321", "TÉCNICO EM SEGURANÇA DO TRABALHO COM ENCARGOS COMPLEMENTARES", "MES", "6,00", "11.382,12", "68.292,72", "21,22", "82.784,43"],
    ["2.1.5", "SICRO-M", "P9897-M", "TÉCNICO DE MEIO AMBIENTE COM ENCARGOS COMPLEMENTARES", "MES", "3,00", "6.982,13", "20.946,39", "21,22", "25.391,21"],
    ["2.2.1", "SINAPI-M", "93565-M", "ENGENHEIRO DE FUNDAÇÕES", "MES", "3,00", "23.382,42", "70.147,26", "21,22", "85.032,50"],
    ["2.2.2", "SICRO-M", "P8058-M", "ENGENHEIRO AMBIENTAL PLENO COM ENCARGOS COMPLEMENTARES", "MES", "3,00", "24.764,18", "74.292,54", "21,22", "90.057,41"],
]

TABLE_3 = [
    ["3.1.1", "COTAÇÃO", "COT-SOND 04", "SONDAGEM A TRADO (ST) ATÉ 5,00 M OU IMPENETRÁVEL", "M", "50,00", "154,12", "7.706,00", "11,10", "8.561,49"],
    ["3.1.2", "COTAÇÃO", "COT-SOND 16", "SONDAGEM A TRADO (ST) DE 2,0M PARA ENSAIOS", "M", "4,00", "102,83", "411,32", "11,10", "456,99"],
    ["3.1.3", "COTAÇÃO", "COT-MOB-01", "MOBILIZAÇÃO/DESMOBILIZAÇÃO DE EQUIPAMENTOS", "UN", "1,00", "3.608,21", "3.608,21", "11,10", "4.008,72"],
    ["3.1.4", "COTAÇÃO", "COT-SOND 05", "SONDAGEM A PERCUSSÃO (SPT) COM/SEM LAVAGEM", "UN", "4,00", "2.319,57", "9.278,28", "11,10", "10.308,15"],
    ["3.1.5", "COTAÇÃO", "COT-MOB-02", "MOBILIZAÇÃO PARA POÇO DE INSPEÇÃO POR DIA", "UN", "2,00", "2.371,11", "4.742,22", "11,10", "5.268,61"],
    ["3.1.6", "COTAÇÃO", "COT-SOND 01", "ESCAVAÇÃO/FECHAMENTO DE POÇO DE INSPEÇÃO (PI)", "M", "4,00", "1.237,10", "4.948,40", "11,10", "5.497,68"],
    ["3.1.7", "COTAÇÃO", "COT-SOND 03", "COLETA DE AMOSTRA INDEFORMADA EM POÇO", "UN", "2,00", "927,83", "1.855,66", "11,10", "2.061,63"],
    ["3.1.8", "COTAÇÃO", "COT-SOND 22", "PREPARAÇÃO DE AMOSTRAS DE SOLO PARA ENSAIOS", "UN", "10,00", "484,53", "4.845,30", "11,10", "5.383,14"],
    ["3.1.9", "COTAÇÃO", "COT-ENS 02", "ENSAIO DE GRANULOMETRIA POR SEDIMENTAÇÃO", "UN", "10,00", "298,97", "2.989,70", "11,10", "3.321,51"],
    ["3.1.10", "COTAÇÃO", "COT-ENS 10", "ENSAIO DE DENSIDADE REAL DOS GRÃOS", "UN", "10,00", "142,52", "1.425,20", "11,10", "1.583,44"],
    ["3.1.11", "COTAÇÃO", "COT-ENS 05", "DETERMINAÇÃO DO LIMITE DE LIQUIDEZ", "UN", "10,00", "118,56", "1.185,60", "11,10", "1.317,15"],
    ["3.1.12", "COTAÇÃO", "COT-ENS 04", "DET. LIMITE DE PLASTICIDADE E ÍNDICE DE PLASTICIDADE", "UN", "10,00", "152,06", "1.520,60", "11,10", "1.689,39"],
    ["3.1.13", "COTAÇÃO", "COT-ENS 03", "ENSAIO DE COMPACTAÇÃO - AMOSTRAS NÃO TRABALHADAS", "UN", "10,00", "387,88", "3.878,80", "11,10", "4.309,38"],
    ["3.1.14", "COTAÇÃO", "COT-ENS 07", "ENSAIO DE ÍNDICE SUPORTE CALIFÓRNIA (CBR)", "UN", "10,00", "241,49", "2.414,90", "11,10", "2.682,98"],
    ["3.1.15", "COTAÇÃO", "COT-ENS 11", "ENSAIO DE CISALHAMENTO DIRETO NATURAL (VANE TEST)", "UN", "1,00", "1.082,46", "1.082,46", "11,10", "1.202,61"],
    ["3.1.16", "COTAÇÃO", "COT-ENS 12", "ENSAIO DE CISALHAMENTO DIRETO SATURADO", "UN", "1,00", "1.386,59", "1.386,59", "11,10", "1.540,49"],
    ["3.1.17", "COTAÇÃO", "COT-ENS 17", "ENSAIO DE ADENSAMENTO NA UMIDADE NATURAL", "UN", "1,00", "3.092,76", "3.092,76", "11,10", "3.436,05"],
    ["3.1.18", "COTAÇÃO", "COT-ENS 18", "ENSAIO DE ADENSAMENTO SATURADO", "UN", "1,00", "3.092,76", "3.092,76", "11,10", "3.436,05"],
    ["3.1.19", "COTAÇÃO", "COT-ENS 60", "DET. DA UMIDADE NATURAL DA AMOSTRA INDEFORMADA", "UN", "2,00", "92,78", "185,56", "11,10", "206,16"],
    ["3.1.20", "COTAÇÃO", "COT-ENS 61", "ENSAIO DE PESO ESPECÍFICO APARENTE", "UN", "2,00", "114,43", "228,86", "11,10", "254,26"],
    ["3.1.21", "COTAÇÃO", "COT-ENS 08", "ENSAIO DE MASSA/DENSIDADE ESPECÍFICA IN SITU", "UN", "4,00", "296,39", "1.185,56", "11,10", "1.317,15"],
    ["3.1.22", "COTAÇÃO", "COT-ENS 09", "ENSAIO DE UMIDADE NATURAL", "UN", "4,00", "74,74", "298,96", "11,10", "332,15"],
    ["3.1.23", "COTAÇÃO", "COT-ENS 14", "ENSAIO DE PERMEABILIDADE/INFILTRAÇÃO", "UN", "2,00", "783,50", "1.567,00", "11,10", "1.740,93"],
    ["3.1.24", "COTAÇÃO", "COT-ENS 64", "CLASSIFICAÇÃO DE SOLOS (SUCS/TRB)", "UN", "10,00", "173,97", "1.739,70", "11,10", "1.932,77"],
    ["3.1.25", "COTAÇÃO", "COT-ART 02", "LAUDO TÉCNICO E ART - SONDAGEM", "UN", "1,00", "1.288,65", "1.288,65", "11,10", "1.431,68"],
]


def main() -> None:
    tables = [
        ("1 - Servicos Preliminares e Canteiro", TABLE_1, 32, 396_490.67),
        ("2 - Administracao Local da Obra", TABLE_2, 7, 576_292.17),
        ("3 - Ensaios e Sondagens", TABLE_3, 25, 73_280.56),
    ]

    all_filtered: list[dict] = []

    for name, rows, doc_items, doc_total in tables:
        structured = [row_to_item(r) for r in rows]
        filtered = _filter_for_analysis(structured, ["curva_abc"])
        subtotal = sum(float(i["valor_total"]) for i in filtered)
        all_filtered.extend(filtered)
        print(f"\n{name}")
        print(f"  Itens na imagem (documento): {doc_items}")
        print(f"  Itens analisados aqui: {len(filtered)}")
        print(f"  Subtotal itens listados: {brl(subtotal)}")
        print(f"  Total documento (imagem): {brl(doc_total)}")
        if len(filtered) < doc_items:
            print(f"  Nota: faltam {doc_items - len(filtered)} itens nao legiveis na captura")

    merged = _deduplicate_items(all_filtered)
    classified = classify_abc(merged)
    total_listed = sum(float(i["valor_total"]) for i in classified)
    doc_grand_total = 396_490.67 + 576_292.17 + 73_280.56

    print("\n" + "=" * 58)
    print("CONSOLIDADO CURVA ABC (3 tabelas)")
    print(f"Itens na analise: {len(classified)}")
    print(f"Valor total itens listados: {brl(total_listed)}")
    print(f"Valor total documento (3 tabelas): {brl(doc_grand_total)}")

    for cls in "ABC":
        group = [i for i in classified if i["classification"] == cls]
        val = sum(float(i["valor_total"]) for i in group)
        pct = val / total_listed * 100 if total_listed else 0
        print(f"  Classe {cls}: {len(group)} itens - {brl(val)} ({pct:.1f}%)")

    print("\nITENS (por valor decrescente):\n")
    for n, item in enumerate(classified, 1):
        desc = re.sub(r"\s+", " ", item["descricao"])[:52]
        print(
            f"{n:2}. [{item['classification']}] {item['item']} | {item['banco']} {item['codigo']} | "
            f"{desc} | {item['quantidade']} {item['unidade']} | {brl(float(item['valor_total']))}"
        )


if __name__ == "__main__":
    main()
