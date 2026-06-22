"""
Exportação profissional de orçamento em PDF (fpdf2).
"""

from __future__ import annotations

import base64
import re
import tempfile
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from services.xlsx_export import (
    prepare_curva_abc_rows,
    prepare_hierarchical_analitico_rows,
    prepare_sintetico_rows,
    _coerce_number,
    _is_group_row,
)

try:
    from fpdf import FPDF
except ImportError:
    FPDF = None  # type: ignore

_COLOR_PRIMARY = (30, 58, 95)
_COLOR_DARK = (31, 41, 55)
_COLOR_MUTED = (100, 116, 139)
_COLOR_ALT = (242, 242, 242)
_COLOR_A = (220, 252, 231)
_COLOR_B = (254, 249, 195)
_COLOR_C = (255, 237, 213)
_COLOR_WHITE = (255, 255, 255)


def _safe(text: Any) -> str:
    raw = str(text or "")
    for old, new in (("\u2014", "-"), ("\u2013", "-"), ("\u2022", "-")):
        raw = raw.replace(old, new)
    return raw.encode("latin-1", "replace").decode("latin-1")


def _fmt_currency(value: float) -> str:
    return f"R$ {value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def _extract_items(orcamento: Dict[str, Any]) -> List[Dict[str, Any]]:
    items = orcamento.get("items")
    if isinstance(items, list) and items:
        return [i for i in items if isinstance(i, dict)]
    items_data = orcamento.get("itemsData") or orcamento.get("items_data")
    if isinstance(items_data, dict):
        nested = items_data.get("items") or items_data.get("hierarchical_items")
        if isinstance(nested, list):
            return [i for i in nested if isinstance(i, dict)]
    hierarchical = orcamento.get("hierarchical_items")
    if isinstance(hierarchical, list):
        return [i for i in hierarchical if isinstance(i, dict)]
    return []


def _abc_summary(items: List[Dict[str, Any]]) -> Dict[str, Any]:
    rows, total = prepare_curva_abc_rows(items)
    counts = {"A": 0.0, "B": 0.0, "C": 0.0}
    for row in rows:
        cls = str(row.get("classification") or "").upper()
        if cls in counts:
            counts[cls] += float(row.get("total_com_bdi") or 0)
    total_val = sum(counts.values()) or total or 1.0
    return {
        "total": total or total_val,
        "count_items": len(rows),
        "A": {"value": counts["A"], "pct": counts["A"] / total_val * 100},
        "B": {"value": counts["B"], "pct": counts["B"] / total_val * 100},
        "C": {"value": counts["C"], "pct": counts["C"] / total_val * 100},
        "rows": rows,
    }


def _top_groups(items: List[Dict[str, Any]], limit: int = 3) -> List[Tuple[str, float]]:
    sintetico = prepare_sintetico_rows(items)
    ranked: List[Tuple[str, float]] = []
    for row in sintetico:
        name = str(row.get("descricao") or row.get("description") or "Grupo").strip()
        val = _coerce_number(row.get("valor_total") or row.get("total_com_bdi"))
        ranked.append((name, val))
    ranked.sort(key=lambda x: x[1], reverse=True)
    return ranked[:limit]


class OrcamentoPdfExporter:
    def __init__(self) -> None:
        if FPDF is None:
            raise RuntimeError("fpdf2 não está instalado")
        self.pdf = FPDF(orientation="P", unit="mm", format="A4")
        self.pdf.set_auto_page_break(auto=True, margin=18)
        self.pdf.set_margins(15, 15, 15)

    def _add_cover(
        self,
        *,
        project_name: str,
        upload_id: str,
        company_name: Optional[str],
        responsible: Optional[str],
        logo_path: Optional[str],
    ) -> None:
        self.pdf.add_page()
        y = 20
        if logo_path and Path(logo_path).exists():
            try:
                self.pdf.image(logo_path, x=15, y=y, w=40)
                y += 28
            except Exception:
                print(f"[pdf_export] Logo inválido: {logo_path}")

        self.pdf.set_y(max(y, 35))
        self.pdf.set_font("Helvetica", "B", 24)
        self.pdf.set_text_color(*_COLOR_PRIMARY)
        self.pdf.cell(0, 12, _safe("ORÇAMENTO DE OBRA"), align="C", new_x="LMARGIN", new_y="NEXT")

        self.pdf.ln(6)
        self.pdf.set_font("Helvetica", "B", 18)
        self.pdf.set_text_color(*_COLOR_DARK)
        self.pdf.multi_cell(0, 10, _safe(project_name), align="C")

        if company_name:
            self.pdf.ln(4)
            self.pdf.set_font("Helvetica", "", 14)
            self.pdf.cell(0, 8, _safe(company_name), align="C", new_x="LMARGIN", new_y="NEXT")

        if responsible:
            self.pdf.set_font("Helvetica", "", 12)
            self.pdf.cell(
                0, 7, _safe(f"Responsável técnico: {responsible}"), align="C", new_x="LMARGIN", new_y="NEXT"
            )

        self.pdf.ln(8)
        self.pdf.set_font("Helvetica", "", 11)
        self.pdf.set_text_color(*_COLOR_MUTED)
        today = datetime.now().strftime("%d/%m/%Y")
        self.pdf.cell(0, 6, _safe(f"Data de geração: {today}"), align="C", new_x="LMARGIN", new_y="NEXT")

        self.pdf.ln(10)
        self.pdf.set_draw_color(*_COLOR_PRIMARY)
        self.pdf.set_line_width(0.8)
        self.pdf.line(15, self.pdf.get_y(), 195, self.pdf.get_y())

        self.pdf.ln(8)
        doc_id = f"DOC-{upload_id[:8].upper()}"
        self.pdf.set_font("Helvetica", "B", 11)
        self.pdf.set_text_color(*_COLOR_DARK)
        self.pdf.cell(0, 6, _safe(doc_id), align="C")

    def _draw_card(self, x: float, y: float, w: float, h: float, title: str, value: str) -> None:
        self.pdf.set_fill_color(248, 250, 252)
        self.pdf.set_draw_color(226, 232, 240)
        self.pdf.rect(x, y, w, h, style="DF")
        self.pdf.set_xy(x + 3, y + 4)
        self.pdf.set_font("Helvetica", "", 9)
        self.pdf.set_text_color(*_COLOR_MUTED)
        self.pdf.cell(w - 6, 5, _safe(title))
        self.pdf.set_xy(x + 3, y + 12)
        self.pdf.set_font("Helvetica", "B", 12)
        self.pdf.set_text_color(*_COLOR_DARK)
        self.pdf.cell(w - 6, 7, _safe(value))

    def _add_summary(
        self,
        *,
        orcamento: Dict[str, Any],
        summary: Dict[str, Any],
        top_groups: List[Tuple[str, float]],
    ) -> None:
        self.pdf.add_page()
        self.pdf.set_font("Helvetica", "B", 16)
        self.pdf.set_text_color(*_COLOR_PRIMARY)
        self.pdf.cell(0, 10, _safe("Sumário Executivo"), new_x="LMARGIN", new_y="NEXT")
        self.pdf.ln(4)

        uploaded = orcamento.get("uploadedAt")
        upload_str = "—"
        if hasattr(uploaded, "strftime"):
            upload_str = uploaded.strftime("%d/%m/%Y")
        elif isinstance(uploaded, str):
            upload_str = uploaded[:10]

        y0 = self.pdf.get_y()
        self._draw_card(15, y0, 85, 24, "Valor total", _fmt_currency(float(summary["total"])))
        self._draw_card(105, y0, 85, 24, "Quantidade de itens", str(summary["count_items"]))
        self.pdf.set_y(y0 + 30)
        self._draw_card(15, self.pdf.get_y(), 85, 24, "Data de upload", upload_str)
        self._draw_card(105, self.pdf.get_y(), 85, 24, "Status", str(orcamento.get("status") or "—"))
        self.pdf.ln(32)

        self.pdf.set_font("Helvetica", "B", 12)
        self.pdf.cell(0, 8, _safe("Distribuição Curva ABC"), new_x="LMARGIN", new_y="NEXT")
        self.pdf.set_font("Helvetica", "", 10)
        for cls in ("A", "B", "C"):
            data = summary[cls]
            self.pdf.cell(
                0,
                6,
                _safe(
                    f"Classe {cls}: {_fmt_currency(data['value'])} ({data['pct']:.1f}%)".replace(".", ",")
                ),
                new_x="LMARGIN",
                new_y="NEXT",
            )

        if top_groups:
            self.pdf.ln(4)
            self.pdf.set_font("Helvetica", "B", 12)
            self.pdf.cell(0, 8, _safe("Top 3 grupos por valor"), new_x="LMARGIN", new_y="NEXT")
            self.pdf.set_font("Helvetica", "", 10)
            for i, (name, val) in enumerate(top_groups, 1):
                self.pdf.cell(
                    0,
                    6,
                    _safe(f"{i}. {name[:60]} — {_fmt_currency(val)}"),
                    new_x="LMARGIN",
                    new_y="NEXT",
                )

    def _class_color(self, cls: str) -> Tuple[int, int, int]:
        if cls == "A":
            return _COLOR_A
        if cls == "B":
            return _COLOR_B
        if cls == "C":
            return _COLOR_C
        return _COLOR_WHITE

    def _add_items_table(self, items: List[Dict[str, Any]], summary_rows: List[Dict[str, Any]]) -> None:
        self.pdf.add_page()
        self.pdf.set_font("Helvetica", "B", 14)
        self.pdf.cell(0, 10, _safe("Itens do Orçamento"), new_x="LMARGIN", new_y="NEXT")

        col_widths = [14, 62, 12, 16, 22, 24, 14]
        headers = ["Cód.", "Descrição", "Un.", "Qtd.", "P.Unit.", "P.Total", "ABC"]

        hierarchical = prepare_hierarchical_analitico_rows(items)
        use_hierarchical = len(hierarchical) > len(summary_rows)

        def draw_header() -> None:
            self.pdf.set_font("Helvetica", "B", 8)
            self.pdf.set_fill_color(*_COLOR_PRIMARY)
            self.pdf.set_text_color(255, 255, 255)
            for i, header in enumerate(headers):
                self.pdf.cell(col_widths[i], 7, _safe(header), border=1, fill=True, align="C")
            self.pdf.ln()

        draw_header()
        self.pdf.set_font("Helvetica", "", 7)
        self.pdf.set_text_color(*_COLOR_DARK)

        row_idx = 0
        source = hierarchical if use_hierarchical else summary_rows
        current_group = ""

        for raw in source:
            if use_hierarchical:
                desc = str(raw.get("description") or raw.get("descricao") or "")
                if _is_group_row(raw):
                    current_group = desc
                    if self.pdf.get_y() > 250:
                        self.pdf.add_page()
                        draw_header()
                    self.pdf.set_font("Helvetica", "B", 8)
                    self.pdf.set_fill_color(226, 232, 240)
                    self.pdf.cell(sum(col_widths), 7, _safe(f"Grupo: {desc[:80]}"), border=1, fill=True)
                    self.pdf.ln()
                    self.pdf.set_font("Helvetica", "", 7)
                    continue
                code = str(raw.get("code") or raw.get("codigo") or "")
                unit = str(raw.get("unit") or raw.get("unidade") or "")
                qty = _coerce_number(raw.get("qty") or raw.get("quantidade"))
                unit_price = _coerce_number(raw.get("unit_com_bdi") or raw.get("valor_unitario"))
                total = _coerce_number(raw.get("total_com_bdi") or raw.get("valor_total"))
                cls = ""
            else:
                desc = str(raw.get("description") or "")
                code = str(raw.get("code") or "")
                unit = str(raw.get("unit") or "")
                qty = _coerce_number(raw.get("qty"))
                unit_price = _coerce_number(raw.get("unit_com_bdi"))
                total = _coerce_number(raw.get("total_com_bdi"))
                cls = str(raw.get("classification") or "")

            if self.pdf.get_y() > 265:
                self.pdf.add_page()
                draw_header()

            fill = _COLOR_ALT if row_idx % 2 else _COLOR_WHITE
            if cls:
                fill = self._class_color(cls.upper())

            values = [
                code[:10],
                desc[:55],
                unit[:6],
                f"{qty:,.3f}".replace(",", "X").replace(".", ",").replace("X", "."),
                _fmt_currency(unit_price) if unit_price else "—",
                _fmt_currency(total) if total else "—",
                cls,
            ]
            for i, val in enumerate(values):
                align = "R" if i >= 3 and i <= 5 else ("C" if i in (2, 6) else "L")
                self.pdf.set_fill_color(*fill)
                self.pdf.cell(col_widths[i], 6, _safe(val), border=1, fill=True, align=align)
            self.pdf.ln()
            row_idx += 1

        total = float(summary_rows and sum(float(r.get("total_com_bdi") or 0) for r in summary_rows) or 0)
        if self.pdf.get_y() > 265:
            self.pdf.add_page()
            draw_header()
        self.pdf.set_font("Helvetica", "B", 8)
        self.pdf.set_fill_color(*_COLOR_DARK)
        self.pdf.set_text_color(255, 255, 255)
        self.pdf.cell(sum(col_widths[:-1]), 8, _safe("TOTAL GERAL"), border=1, fill=True, align="R")
        self.pdf.cell(col_widths[-1], 8, _safe(_fmt_currency(total)), border=1, fill=True, align="R")

    def _add_signature(self, *, upload_id: str, responsible: Optional[str]) -> None:
        self.pdf.add_page()
        self.pdf.set_font("Helvetica", "B", 12)
        self.pdf.cell(0, 10, _safe("Assinaturas"), new_x="LMARGIN", new_y="NEXT")
        self.pdf.ln(20)
        self.pdf.set_font("Helvetica", "", 10)
        resp = responsible or "Responsável técnico"
        self.pdf.cell(0, 6, _safe("_" * 50), new_x="LMARGIN", new_y="NEXT")
        self.pdf.cell(0, 6, _safe(resp), new_x="LMARGIN", new_y="NEXT")
        self.pdf.ln(10)
        self.pdf.cell(0, 6, _safe("Data: ___/___/______"), new_x="LMARGIN", new_y="NEXT")
        self.pdf.ln(15)
        doc_id = f"DOC-{upload_id[:8].upper()}"
        today = datetime.now().strftime("%d/%m/%Y %H:%M")
        self.pdf.set_font("Helvetica", "I", 9)
        self.pdf.set_text_color(*_COLOR_MUTED)
        self.pdf.cell(
            0,
            5,
            _safe(f"{doc_id} — Gerado por Thora Construção em {today}"),
            align="C",
        )


def generate_orcamento_pdf(
    orcamento: Dict[str, Any],
    *,
    include_cover: bool = True,
    include_summary: bool = True,
    include_abc_chart: bool = True,
    company_name: Optional[str] = None,
    responsible: Optional[str] = None,
    logo_base64: Optional[str] = None,
    temp_folder: Path,
) -> Tuple[Path, str]:
    """Gera PDF do orçamento. include_abc_chart reservado para gráfico futuro."""
    _ = include_abc_chart  # ABC já no sumário e tabela

    upload_id = str(orcamento.get("uploadId") or orcamento.get("id") or uuid.uuid4())
    project_name = str(
        orcamento.get("nomeProjeto") or orcamento.get("filename") or upload_id
    )
    items = _extract_items(orcamento)
    if not items:
        raise ValueError("Orçamento sem itens para exportar.")

    summary = _abc_summary(items)
    top_groups = _top_groups(items)

    logo_path: Optional[str] = None
    temp_logo: Optional[Path] = None
    if logo_base64:
        try:
            raw = logo_base64.split(",", 1)[-1]
            data = base64.b64decode(raw)
            temp_logo = temp_folder / f"logo_{uuid.uuid4().hex[:8]}.png"
            temp_logo.write_bytes(data)
            logo_path = str(temp_logo)
        except Exception as exc:
            print(f"[pdf_export] Erro ao decodificar logo: {exc}")

    exporter = OrcamentoPdfExporter()
    if include_cover:
        exporter._add_cover(
            project_name=project_name,
            upload_id=upload_id,
            company_name=company_name,
            responsible=responsible,
            logo_path=logo_path,
        )
    if include_summary:
        exporter._add_summary(orcamento=orcamento, summary=summary, top_groups=top_groups)

    exporter._add_items_table(items, summary["rows"])

    exporter._add_signature(upload_id=upload_id, responsible=responsible)

    safe = re.sub(r"[^\w\s-]", "", project_name, flags=re.UNICODE)
    safe = re.sub(r"\s+", "_", safe)[:40] or "orcamento"
    date_part = datetime.now().strftime("%Y%m%d")
    filename = f"orcamento_{safe}_{date_part}.pdf"
    file_path = temp_folder / filename
    exporter.pdf.output(str(file_path))

    if temp_logo and temp_logo.exists():
        try:
            temp_logo.unlink()
        except OSError:
            pass

    return file_path, filename
