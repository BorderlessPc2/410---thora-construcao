"""Análise determinística de linhas orçamentárias (sem IA)."""

from __future__ import annotations

import re
from typing import Any, Literal

StatusVerificacao = Literal["ok", "divergente", "alerta", "nao_aplicavel", "pendente"]
StatusGeralLinha = Literal["aprovado", "alerta", "reprovado", "ignorado"]
SeveridadeVerificacao = Literal["erro", "alerta", "info"]

CABECALHO_KEYWORDS = (
    "item",
    "fonte",
    "código",
    "codigo",
    "descrição",
    "descricao",
    "unidade",
    "quantidade",
    "preço unitário",
    "preco unitario",
    "preço total",
    "preco total",
    "bdi",
    "observações",
    "observacoes",
)
SUBTOTAL_KEYWORDS = (
    "total geral",
    "subtotal",
    "total do grupo",
    "total:",
    "suma",
    "resumen",
    "grand total",
)
SUBTOTAL_EXACT = {"item", "total", "subtotal", "total geral", "total do item"}

VALOR_UNIDADE_PATTERN = re.compile(
    r"(\d+(?:[.,]\d+)?)\s*(M2|M³|M3|KM|UN|UND|CHP|CHI|MÊS|MES|M)\b",
    re.IGNORECASE,
)
SOMA_PATTERN = re.compile(
    r"(\d+(?:[.,]\d+)?)\s*(M2|M³|M3|KM|UN|UND|CHP|CHI|MÊS|MES|M)?\s*\+\s*(\d+(?:[.,]\d+)?)\s*(M2|M³|M3|KM|UN|UND|CHP|CHI|MÊS|MES|M)?",
    re.IGNORECASE,
)


def _parse_number(value: Any) -> float:
    if value is None or value == "":
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip().replace("R$", "").replace("%", "").replace(" ", "")
    if "." in text and "," in text:
        text = text.replace(".", "").replace(",", ".")
    elif "," in text:
        text = text.replace(",", ".")
    try:
        return float(text)
    except ValueError:
        return 0.0


def _normalize_text(value: str) -> str:
    return (
        value.lower()
        .replace("á", "a")
        .replace("à", "a")
        .replace("ã", "a")
        .replace("â", "a")
        .replace("é", "e")
        .replace("ê", "e")
        .replace("í", "i")
        .replace("ó", "o")
        .replace("ô", "o")
        .replace("õ", "o")
        .replace("ú", "u")
        .replace("ç", "c")
        .strip()
    )


def _round_money(value: float) -> float:
    return round(value, 2)


def _motivo_exclusao(linha: dict[str, Any]) -> str | None:
    descricao = str(linha.get("descricao") or "").strip()
    desc_norm = _normalize_text(descricao)
    item_numero = str(linha.get("item_numero") or linha.get("item") or "").strip()
    codigo = str(linha.get("codigo") or linha.get("code") or "").strip()
    banco = str(linha.get("banco") or linha.get("fonte") or "").strip()
    quantidade = _parse_number(linha.get("quantidade") or linha.get("qty"))
    preco_unitario = _parse_number(
        linha.get("preco_unitario")
        or linha.get("valor_unitario")
        or linha.get("unitPrice")
    )
    preco_total_sem_bdi = _parse_number(
        linha.get("preco_total_sem_bdi") or linha.get("valor_total_sem_bdi")
    )
    preco_total_com_bdi = _parse_number(
        linha.get("preco_total_com_bdi")
        or linha.get("valor_total")
        or linha.get("lineTotal")
    )

    if descricao and sum(1 for kw in CABECALHO_KEYWORDS if kw in desc_norm) >= 4:
        if quantidade <= 0 and preco_unitario <= 0 and not codigo:
            return "Cabeçalho de colunas"

    if desc_norm in SUBTOTAL_EXACT and quantidade <= 0 and preco_unitario <= 0 and preco_total_com_bdi > 0:
        return "Linha de subtotal/totalização"
    if any(kw in desc_norm for kw in SUBTOTAL_KEYWORDS) and quantidade <= 0 and preco_unitario <= 0:
        return "Linha de subtotal/totalização"

    if re.fullmatch(r"\d+", item_numero or ""):
        letters = re.sub(r"[^A-Za-zÀ-ÿ]", "", descricao)
        if (
            len(letters) >= 8
            and descricao == descricao.upper()
            and not codigo
            and not banco
            and quantidade <= 0
            and preco_unitario <= 0
            and preco_total_sem_bdi <= 0
            and preco_total_com_bdi <= 0
        ):
            return "Capítulo/categoria"

    tipo = _normalize_text(str(linha.get("tipo_linha") or linha.get("tipo") or ""))
    sem_dados = (
        quantidade <= 0
        and preco_unitario <= 0
        and preco_total_sem_bdi <= 0
        and preco_total_com_bdi <= 0
    )
    if sem_dados and descricao:
        parts = [p for p in item_numero.split(".") if p]
        if len(parts) <= 2 and not codigo:
            if descricao == descricao.upper() or tipo == "grupo":
                return "Grupo/seção"
    if tipo in {"grupo", "titulo", "title"}:
        return "Grupo/seção"

    return None


def _analisar_memoria_calculo(
    observacoes: str,
    quantidade: float,
    tolerancia: float,
) -> dict[str, Any] | None:
    texto = observacoes.strip()
    if not texto:
        return None

    for match in SOMA_PATTERN.finditer(texto):
        esquerda = _parse_number(match.group(1))
        direita = _parse_number(match.group(3))
        total = esquerda + direita
        bate = abs(total - quantidade) <= tolerancia
        return {
            "expressoes_encontradas": [match.group(0).strip()],
            "resultado_extraido": total,
            "bate_com_quantidade": bate,
            "explicacao": (
                f"Memória de cálculo confere: soma = {total}."
                if bate
                else f"Memória de cálculo diverge: soma = {total}, quantidade = {quantidade}."
            ),
        }

    valores = [_parse_number(m.group(1)) for m in VALOR_UNIDADE_PATTERN.finditer(texto)]
    valores = [v for v in valores if v > 0]
    if not valores:
        return None

    total = sum(valores)
    bate = abs(total - quantidade) <= tolerancia
    return {
        "expressoes_encontradas": [m.group(0).strip() for m in VALOR_UNIDADE_PATTERN.finditer(texto)],
        "resultado_extraido": total,
        "bate_com_quantidade": bate,
        "explicacao": (
            f"Soma nas observações ({total}) confere com a quantidade."
            if bate
            else f"Soma nas observações ({total}) difere da quantidade ({quantidade})."
        ),
    }


def _inferir_bdi_global(linhas: list[dict[str, Any]]) -> float:
    valores = [
        _parse_number(linha.get("bdi") or linha.get("bdi_percent") or linha.get("BDI"))
        for linha in linhas
    ]
    valores = [v for v in valores if v > 0]
    if not valores:
        return 0.0
    freq: dict[float, int] = {}
    for valor in valores:
        arredondado = round(valor, 2)
        freq[arredondado] = freq.get(arredondado, 0) + 1
    return max(freq, key=freq.get)


def _tolerancia_monetaria_efetiva(valor_referencia: float, tolerancia_base: float) -> float:
    if valor_referencia <= 0:
        return max(tolerancia_base, 0.05)
    return min(2.0, max(tolerancia_base, 0.05, valor_referencia * 0.00005))


def _inferir_bdis_validos_documento(linhas: list[dict[str, Any]]) -> list[float]:
    freq: dict[float, int] = {}
    linhas_com_bdi = 0
    for linha in linhas:
        bdi = _parse_number(linha.get("bdi") or linha.get("bdi_percent") or linha.get("BDI"))
        if bdi <= 0:
            continue
        linhas_com_bdi += 1
        arredondado = round(bdi, 2)
        freq[arredondado] = freq.get(arredondado, 0) + 1
    if linhas_com_bdi == 0:
        return []
    limiar = max(2, int((linhas_com_bdi * 0.08) + 0.999))
    return sorted(
        [bdi for bdi, count in freq.items() if count >= limiar],
        reverse=True,
    )


def _linha_bdi_confere_documento(
    bdi_linha: float,
    bdis_validos: list[float],
    bdi_global: float,
    tolerancia_percentual: float,
) -> bool:
    if len(bdis_validos) > 1:
        return any(abs(bdi_linha - bdi) <= tolerancia_percentual for bdi in bdis_validos)
    if bdi_global > 0:
        return abs(bdi_linha - bdi_global) <= tolerancia_percentual
    return True


def analisar_linha_orcamento(
    linha: dict[str, Any],
    *,
    bdi_global: float = 0.0,
    bdis_validos_documento: list[float] | None = None,
    tolerancia_monetaria: float = 0.02,
    tolerancia_percentual: float = 0.5,
) -> dict[str, Any]:
    motivo = _motivo_exclusao(linha)
    quantidade = _parse_number(linha.get("quantidade") or linha.get("qty"))
    preco_unitario = _parse_number(
        linha.get("preco_unitario") or linha.get("valor_unitario") or linha.get("unitPrice")
    )
    bdi_percent = _parse_number(linha.get("bdi") or linha.get("bdi_percent") or linha.get("BDI"))
    preco_total_sem_bdi = _parse_number(
        linha.get("preco_total_sem_bdi") or linha.get("valor_total_sem_bdi")
    )
    preco_total_com_bdi = _parse_number(
        linha.get("preco_total_com_bdi")
        or linha.get("valor_total")
        or linha.get("lineTotal")
    )
    observacoes = str(
        linha.get("observacoes")
        or linha.get("observacao")
        or linha.get("observação")
        or ""
    ).strip()

    if preco_total_sem_bdi <= 0 and quantidade > 0 and preco_unitario > 0:
        preco_total_sem_bdi = quantidade * preco_unitario
    if preco_total_com_bdi <= 0 and preco_total_sem_bdi > 0 and bdi_percent > 0:
        preco_total_com_bdi = preco_total_sem_bdi * (1 + bdi_percent / 100)

    base = {
        "linha_id": linha.get("id") or linha.get("item_numero") or linha.get("item"),
        "item_numero": str(linha.get("item_numero") or linha.get("item") or "").strip(),
        "descricao": str(linha.get("descricao") or linha.get("description") or "").strip(),
    }

    if motivo or quantidade <= 0 or preco_unitario <= 0:
        return {
            **base,
            "status_geral": "ignorado",
            "motivo_ignorado": motivo or "Linha sem dados suficientes para análise",
            "verificacoes": [],
        }

    bdis_validos = bdis_validos_documento or []

    verificacoes: list[dict[str, Any]] = []
    subtotal_calc = _round_money(quantidade * preco_unitario)
    subtotal_info = preco_total_sem_bdi if preco_total_sem_bdi > 0 else subtotal_calc
    subtotal_tol = _tolerancia_monetaria_efetiva(subtotal_info, tolerancia_monetaria)
    subtotal_ok = abs(subtotal_calc - subtotal_info) <= subtotal_tol
    verificacoes.append(
        {
            "regra_id": "CALC_SUBTOTAL",
            "status": "ok" if subtotal_ok else "divergente",
            "severidade": "info" if subtotal_ok else "erro",
            "valor_calculado": subtotal_calc,
            "valor_informado": subtotal_info,
            "mensagem": (
                f"{quantidade} × {preco_unitario} = {subtotal_calc}"
                if subtotal_ok
                else f"Subtotal divergente: esperado {subtotal_calc}, informado {subtotal_info}."
            ),
        }
    )

    if bdi_percent > 0:
        total_calc = _round_money(subtotal_info * (1 + bdi_percent / 100))
        total_info = preco_total_com_bdi if preco_total_com_bdi > 0 else total_calc
        total_tol = _tolerancia_monetaria_efetiva(total_info, tolerancia_monetaria)
        total_ok = abs(total_calc - total_info) <= total_tol
        verificacoes.append(
            {
                "regra_id": "CALC_BDI",
                "status": "ok" if total_ok else "divergente",
                "severidade": "info" if total_ok else "erro",
                "valor_calculado": total_calc,
                "valor_informado": total_info,
                "mensagem": (
                    f"{subtotal_info} × (1 + {bdi_percent}%) = {total_calc}"
                    if total_ok
                    else f"Total c/ BDI divergente: esperado {total_calc}, informado {total_info}."
                ),
            }
        )
        if bdi_global > 0 or bdis_validos:
            bdi_ok = _linha_bdi_confere_documento(
                bdi_percent, bdis_validos, bdi_global, tolerancia_percentual
            )
            if len(bdis_validos) > 1:
                bdis_label = ", ".join(f"{b}%" for b in bdis_validos)
                msg_ok = f"BDI {bdi_percent}% confere com os BDIs do documento ({bdis_label})."
                msg_fail = (
                    f"BDI da linha ({bdi_percent}%) não corresponde aos BDIs do documento ({bdis_label})."
                )
            else:
                msg_ok = f"BDI {bdi_percent}% confere com o BDI predominante ({bdi_global}%)."
                msg_fail = f"BDI da linha ({bdi_percent}%) difere do global ({bdi_global}%)."
            verificacoes.append(
                {
                    "regra_id": "BDI_GLOBAL",
                    "status": "ok" if bdi_ok else "alerta",
                    "severidade": "info" if bdi_ok else "alerta",
                    "mensagem": msg_ok if bdi_ok else msg_fail,
                }
            )

    memoria = _analisar_memoria_calculo(observacoes, quantidade, tolerancia_monetaria)
    if memoria:
        verificacoes.append(
            {
                "regra_id": "MEMORIA_CALCULO",
                "status": "ok" if memoria["bate_com_quantidade"] else "alerta",
                "severidade": "info" if memoria["bate_com_quantidade"] else "alerta",
                "mensagem": memoria["explicacao"],
            }
        )

    has_erro = any(v["severidade"] == "erro" and v["status"] == "divergente" for v in verificacoes)
    has_alerta = any(v["severidade"] == "alerta" and v["status"] in {"alerta", "divergente"} for v in verificacoes)
    if has_erro:
        status_geral: StatusGeralLinha = "reprovado"
    elif has_alerta:
        status_geral = "alerta"
    else:
        status_geral = "aprovado"

    return {
        **base,
        "status_geral": status_geral,
        "verificacoes": verificacoes,
        "memoria_calculo": memoria,
    }


def analisar_linhas_orcamento(
    linhas: list[dict[str, Any]],
    *,
    bdi_global: float | None = None,
    tolerancia_monetaria: float = 0.02,
    tolerancia_percentual: float = 0.5,
) -> dict[str, Any]:
    bdi = bdi_global if bdi_global and bdi_global > 0 else _inferir_bdi_global(linhas)
    bdis_validos = _inferir_bdis_validos_documento(linhas)
    resultados = [
        analisar_linha_orcamento(
            linha,
            bdi_global=bdi,
            bdis_validos_documento=bdis_validos,
            tolerancia_monetaria=tolerancia_monetaria,
            tolerancia_percentual=tolerancia_percentual,
        )
        for linha in linhas
    ]
    analisadas = [r for r in resultados if r["status_geral"] != "ignorado"]
    return {
        "versao_modelo": "1.1",
        "contexto": {
            "bdi_global_percent": bdi,
            "bdis_validos_documento": bdis_validos,
            "tolerancia_monetaria": tolerancia_monetaria,
            "tolerancia_percentual": tolerancia_percentual,
        },
        "linhas": resultados,
        "resumo": {
            "total_linhas": len(resultados),
            "linhas_analisadas": len(analisadas),
            "linhas_ignoradas": len(resultados) - len(analisadas),
            "aprovadas": sum(1 for r in analisadas if r["status_geral"] == "aprovado"),
            "com_alerta": sum(1 for r in analisadas if r["status_geral"] == "alerta"),
            "reprovadas": sum(1 for r in analisadas if r["status_geral"] == "reprovado"),
        },
    }
