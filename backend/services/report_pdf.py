"""
Gera PDF da análise de relatórios a partir de Markdown (tabelas GFM, títulos, parágrafos).
Layout nativo com fpdf2 — sem write_html (evita vazamento de CSS como texto).
"""

from __future__ import annotations

import io
import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Sequence, Tuple

from PIL import Image, ImageDraw, ImageFont

try:
    from fpdf import FPDF
    from fpdf.enums import XPos, YPos
except ImportError:
    FPDF = None  # type: ignore
    XPos = YPos = None  # type: ignore

# Paleta Thora
_COLOR_PRIMARY = (31, 78, 120)
_COLOR_PRIMARY_LIGHT = (219, 234, 254)
_COLOR_TEXT = (51, 65, 85)
_COLOR_MUTED = (100, 116, 139)
_COLOR_ALT_ROW = (248, 250, 252)
_COLOR_BORDER = (203, 213, 225)
_COLOR_WHITE = (255, 255, 255)

_CHART_PALETTE = [
    (31, 78, 120),
    (46, 122, 212),
    (91, 155, 213),
    (159, 194, 232),
    (191, 219, 247),
]

_PDF_CHAR_REPLACEMENTS = (
    ("\u2014", " - "),
    ("\u2013", " - "),
    ("\u2018", "'"),
    ("\u2019", "'"),
    ("\u201c", '"'),
    ("\u201d", '"'),
    ("\u2022", "-"),
    ("\u2026", "..."),
    ("\u00a0", " "),
)


def _pdf_safe_text(text: str) -> str:
    for old, new in _PDF_CHAR_REPLACEMENTS:
        text = text.replace(old, new)
    return text.encode("latin-1", "replace").decode("latin-1")


def _strip_inline_md(text: str) -> str:
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    text = re.sub(r"\*([^*]+)\*", r"\1", text)
    text = re.sub(r"`([^`]+)`", r"\1", text)
    return _pdf_safe_text(text.strip())


def _is_table_separator(line: str) -> bool:
    stripped = line.strip()
    if not stripped.startswith("|"):
        return False
    inner = stripped.strip("|").strip()
    return bool(inner) and re.match(r"^[\s\-:|]+$", inner)


def _parse_table_row(line: str) -> List[str]:
    return [_strip_inline_md(cell.strip()) for cell in line.strip().strip("|").split("|")]


@dataclass
class MdTable:
    headers: List[str] = field(default_factory=list)
    rows: List[List[str]] = field(default_factory=list)


@dataclass
class MdBlock:
    kind: str
    text: str = ""
    table: MdTable | None = None


def _parse_markdown_blocks(markdown: str) -> List[MdBlock]:
    blocks: List[MdBlock] = []
    lines = markdown.replace("\r\n", "\n").split("\n")
    idx = 0
    while idx < len(lines):
        line = lines[idx]
        stripped = line.strip()

        if stripped.startswith("|") and "|" in stripped[1:]:
            table = MdTable()
            while idx < len(lines) and lines[idx].strip().startswith("|"):
                row_line = lines[idx].strip()
                if _is_table_separator(row_line):
                    idx += 1
                    continue
                cells = _parse_table_row(row_line)
                if not table.headers:
                    table.headers = cells
                else:
                    table.rows.append(cells)
                idx += 1
            if table.headers:
                blocks.append(MdBlock(kind="table", table=table))
            continue

        if stripped.startswith("### "):
            blocks.append(MdBlock(kind="h3", text=_strip_inline_md(stripped[4:])))
        elif stripped.startswith("## "):
            blocks.append(MdBlock(kind="h2", text=_strip_inline_md(stripped[3:])))
        elif stripped == "---":
            blocks.append(MdBlock(kind="hr"))
        elif stripped.startswith("- "):
            blocks.append(MdBlock(kind="li", text=_strip_inline_md(stripped[2:])))
        elif re.match(r"^\d+\.\s", stripped):
            blocks.append(MdBlock(kind="li", text=_strip_inline_md(stripped)))
        elif stripped:
            blocks.append(MdBlock(kind="p", text=_strip_inline_md(stripped)))

        idx += 1

    return blocks


def _column_widths(headers: Sequence[str], usable_width: float) -> List[float]:
    n = len(headers)
    if n <= 0:
        return []
    if n == 1:
        return [usable_width]

    lower = [h.lower() for h in headers]
    has_desc = any("desc" in h for h in lower)
    has_hash = any(h.strip() in ("#", "n", "no", "item") for h in lower)

    if has_desc and n == 4:
        fixed = 12.0 if has_hash else 0.0
        qty_w = 24.0
        val_w = 36.0
        desc_w = usable_width - fixed - qty_w - val_w
        if has_hash:
            return [fixed, desc_w, qty_w, val_w]
        return [desc_w * 0.55, desc_w * 0.45, qty_w, val_w]

    if has_desc and n == 5:
        return [10.0, usable_width - 10.0 - 22.0 - 22.0 - 36.0, 22.0, 22.0, 36.0]

    if has_desc:
        desc_idx = next(i for i, h in enumerate(lower) if "desc" in h)
        others = [i for i in range(n) if i != desc_idx]
        fixed_each = min(28.0, (usable_width * 0.45) / max(len(others), 1))
        fixed_total = fixed_each * len(others)
        widths = [fixed_each] * n
        widths[desc_idx] = usable_width - fixed_total
        return widths

    return [usable_width / n] * n


def _format_chart_value(value: float, value_label: str = "valor") -> str:
    label = (value_label or "valor").lower()
    if label == "quantidade":
        int_part = f"{value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
        return int_part
    if label == "percentual":
        return f"{value:.1f}%".replace(".", ",")
    raw = f"{value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R$ {raw}"


def _chart_points(chart: Dict[str, Any]) -> List[Dict[str, Any]]:
    data = chart.get("data") or []
    points: List[Dict[str, Any]] = []
    for row in data[:20]:
        if not isinstance(row, dict):
            continue
        name = str(row.get("name") or row.get("label") or "-")[:60]
        value = float(row.get("value") or row.get("valor") or 0)
        points.append({"name": name, "value": value})
    return points


def _render_pie_chart_png(points: List[Dict[str, Any]], title: str, value_label: str) -> bytes:
    w, h = 920, 520
    img = Image.new("RGB", (w, h), (255, 255, 255))
    draw = ImageDraw.Draw(img)
    try:
        font_title = ImageFont.truetype("arial.ttf", 22)
        font_legend = ImageFont.truetype("arial.ttf", 16)
        font_small = ImageFont.truetype("arial.ttf", 13)
    except OSError:
        font_title = ImageFont.load_default()
        font_legend = font_title
        font_small = font_title

    draw.text((24, 18), _pdf_safe_text(title)[:80], fill=_COLOR_PRIMARY, font=font_title)

    total = sum(p["value"] for p in points) or 1.0
    cx, cy, r_outer, r_inner = 250, 290, 165, 95
    start = 90.0
    for i, point in enumerate(points):
        sweep = 360.0 * point["value"] / total
        color = _CHART_PALETTE[i % len(_CHART_PALETTE)]
        draw.pieslice(
            [cx - r_outer, cy - r_outer, cx + r_outer, cy + r_outer],
            start=start,
            end=start + sweep,
            fill=color,
            outline=(255, 255, 255),
            width=2,
        )
        start += sweep
    draw.ellipse(
        [cx - r_inner, cy - r_inner, cx + r_inner, cy + r_inner],
        fill=(255, 255, 255),
        outline=(226, 232, 240),
        width=1,
    )

    lx, ly = 500, 80
    for i, point in enumerate(points):
        color = _CHART_PALETTE[i % len(_CHART_PALETTE)]
        pct = 100.0 * point["value"] / total
        draw.rectangle([lx, ly + 6, lx + 16, ly + 22], fill=color)
        label = _pdf_safe_text(point["name"][:42])
        draw.text((lx + 24, ly), label, fill=_COLOR_TEXT, font=font_legend)
        val_text = f"{_format_chart_value(point['value'], value_label)} ({pct:.1f}%)".replace(
            ".", ","
        )
        draw.text((lx + 24, ly + 22), val_text, fill=_COLOR_MUTED, font=font_small)
        ly += 52

    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def _render_bar_chart_png(points: List[Dict[str, Any]], title: str, value_label: str) -> bytes:
    w, h = 920, max(420, 90 + len(points) * 48)
    img = Image.new("RGB", (w, h), (255, 255, 255))
    draw = ImageDraw.Draw(img)
    try:
        font_title = ImageFont.truetype("arial.ttf", 22)
        font_label = ImageFont.truetype("arial.ttf", 14)
        font_value = ImageFont.truetype("arial.ttf", 13)
    except OSError:
        font_title = ImageFont.load_default()
        font_label = font_title
        font_value = font_title

    draw.text((24, 18), _pdf_safe_text(title)[:80], fill=_COLOR_PRIMARY, font=font_title)

    max_val = max((p["value"] for p in points), default=1.0) or 1.0
    chart_left, chart_right = 280, 860
    bar_max_w = chart_right - chart_left
    y = 70

    for i, point in enumerate(points):
        color = _CHART_PALETTE[i % len(_CHART_PALETTE)]
        label = _pdf_safe_text(point["name"][:32])
        draw.text((24, y + 8), label, fill=_COLOR_TEXT, font=font_label)
        bar_w = int(bar_max_w * (point["value"] / max_val))
        draw.rounded_rectangle(
            [chart_left, y + 4, chart_left + max(bar_w, 4), y + 30],
            radius=4,
            fill=color,
        )
        val_text = _format_chart_value(point["value"], value_label)
        draw.text((chart_right + 8, y + 8), val_text, fill=_COLOR_MUTED, font=font_value)
        y += 42

    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def render_chart_png(chart: Dict[str, Any]) -> Optional[bytes]:
    points = _chart_points(chart)
    if not points:
        return None
    title = _pdf_safe_text(str(chart.get("title") or "Grafico"))
    value_label = str(chart.get("value_label") or "valor")
    chart_type = str(chart.get("chart_type") or chart.get("type") or "horizontal_bar").lower()
    if chart_type == "pie":
        return _render_pie_chart_png(points, title, value_label)
    return _render_bar_chart_png(points, title, value_label)


def _structured_table_from_dict(table: Dict[str, Any]) -> Optional[MdTable]:
    headers = table.get("headers") or []
    rows = table.get("rows") or []
    if not headers or not rows:
        return None
    md = MdTable(
        headers=[_pdf_safe_text(str(h)) for h in headers],
        rows=[
            [_pdf_safe_text(str(c)) for c in row]
            for row in rows[:500]
            if isinstance(row, list)
        ],
    )
    return md if md.rows else None


def _cell_align(header: str, col_index: int) -> str:
    h = header.lower()
    if col_index == 0 and h.strip() in ("#", "n", "no"):
        return "C"
    if any(k in h for k in ("qtd", "quant", "valor", "total", "r$", "preço", "preco")):
        return "R"
    if re.search(r"^\d", h):
        return "R"
    return "L"


class AnalysisReportPDF(FPDF):
    """PDF A4 com cabeçalho, tabelas estilizadas e rodapé."""

    def __init__(self, doc_title: str) -> None:
        super().__init__(orientation="P", unit="mm", format="A4")
        self.doc_title = _pdf_safe_text(doc_title)
        self.set_auto_page_break(auto=True, margin=18)
        self.set_margins(left=14, top=16, right=14)
        self.alias_nb_pages()
        self._row_index = 0

    def header(self) -> None:
        self.set_fill_color(*_COLOR_PRIMARY)
        self.rect(0, 0, self.w, 22, style="F")
        self.set_text_color(*_COLOR_WHITE)
        self.set_font("Helvetica", "B", 11)
        self.set_xy(self.l_margin, 7)
        self.cell(0, 8, "THORA - Relatorio de Analise", align="L")
        self.set_font("Helvetica", "", 8)
        self.set_xy(self.l_margin, 14)
        generated = datetime.now().strftime("%d/%m/%Y %H:%M")
        self.cell(0, 5, f"Gerado em {generated}", align="L")
        self.set_text_color(*_COLOR_TEXT)
        self.ln(18)

    def footer(self) -> None:
        self.set_y(-12)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(*_COLOR_MUTED)
        self.cell(0, 8, f"Pagina {self.page_no()}/{{nb}}", align="C")

    def _usable_width(self) -> float:
        return self.w - self.l_margin - self.r_margin

    def add_document_title(self, title: str) -> None:
        self.set_font("Helvetica", "B", 16)
        self.set_text_color(*_COLOR_PRIMARY)
        self.multi_cell(self._usable_width(), 9, _pdf_safe_text(title), align="L")
        self.ln(2)
        self.set_draw_color(*_COLOR_PRIMARY)
        self.set_line_width(0.6)
        y = self.get_y()
        self.line(self.l_margin, y, self.w - self.r_margin, y)
        self.ln(6)

    def add_section_heading(self, text: str, level: int = 2) -> None:
        size = 13 if level == 2 else 11
        self.ln(3)
        self.set_font("Helvetica", "B", size)
        self.set_text_color(*_COLOR_PRIMARY)
        self.multi_cell(self._usable_width(), 7, text, align="L")
        self.ln(2)

    def add_paragraph(self, text: str) -> None:
        self.set_font("Helvetica", "", 10)
        self.set_text_color(*_COLOR_TEXT)
        self.multi_cell(self._usable_width(), 5.5, text, align="J")
        self.ln(3)

    def add_list_item(self, text: str) -> None:
        self.set_font("Helvetica", "", 10)
        self.set_text_color(*_COLOR_TEXT)
        bullet_w = 6.0
        self.set_x(self.l_margin)
        self.cell(bullet_w, 5.5, "-", align="L")
        self.multi_cell(self._usable_width() - bullet_w, 5.5, text, align="L")
        self.ln(1)

    def add_horizontal_rule(self) -> None:
        self.ln(4)
        self.set_draw_color(*_COLOR_BORDER)
        self.set_line_width(0.2)
        y = self.get_y()
        self.line(self.l_margin, y, self.w - self.r_margin, y)
        self.ln(6)

    def _ensure_space(self, min_height: float) -> None:
        if self.get_y() + min_height > self.h - self.b_margin:
            self.add_page()
            self._row_index = 0

    def add_table(self, headers: List[str], rows: List[List[str]]) -> None:
        if not headers:
            return

        widths = _column_widths(headers, self._usable_width())
        aligns = [_cell_align(h, i) for i, h in enumerate(headers)]

        self._ensure_space(14)
        self._draw_table_row(headers, widths, aligns, header=True)

        for row in rows:
            cells = list(row)
            while len(cells) < len(headers):
                cells.append("")
            cells = cells[: len(headers)]
            self._draw_table_row(cells, widths, aligns, header=False)

        self.ln(5)

    def _draw_table_row(
        self,
        cells: Sequence[str],
        widths: Sequence[float],
        aligns: Sequence[str],
        *,
        header: bool,
    ) -> None:
        line_h = 5.0
        self.set_font("Helvetica", "B" if header else "", 8 if header else 7.5)

        max_lines = 1
        for cell, w in zip(cells, widths):
            lines = self.multi_cell(w, line_h, cell or "", dry_run=True, split_only=True)
            max_lines = max(max_lines, len(lines))
        row_h = max(line_h * max_lines + 2, 8.0)

        self._ensure_space(row_h + 2)
        x0 = self.l_margin
        y0 = self.get_y()

        if header:
            fill = _COLOR_PRIMARY
            text_color = _COLOR_WHITE
        else:
            fill = _COLOR_ALT_ROW if self._row_index % 2 == 0 else _COLOR_WHITE
            text_color = _COLOR_TEXT
            self._row_index += 1

        self.set_draw_color(*_COLOR_BORDER)
        self.set_line_width(0.15)
        self.set_fill_color(*fill)
        self.set_text_color(*text_color)

        for i, (cell, w, align) in enumerate(zip(cells, widths, aligns)):
            x = x0 + sum(widths[:i])
            self.set_xy(x, y0)
            is_last = i == len(cells) - 1
            self.multi_cell(
                w,
                row_h,
                cell or "",
                border=1,
                align=align,
                fill=True,
                max_line_height=row_h,
                new_x=XPos.LMARGIN if is_last else XPos.RIGHT,
                new_y=YPos.TOP if not is_last else YPos.NEXT,
            )

        self.set_xy(x0, y0 + row_h)
        self.set_text_color(*_COLOR_TEXT)

    def render_blocks(self, blocks: List[MdBlock]) -> None:
        for block in blocks:
            if block.kind == "h2":
                self.add_section_heading(block.text, level=2)
            elif block.kind == "h3":
                self.add_section_heading(block.text, level=3)
            elif block.kind == "p":
                self.add_paragraph(block.text)
            elif block.kind == "li":
                self.add_list_item(block.text)
            elif block.kind == "hr":
                self.add_horizontal_rule()
            elif block.kind == "table" and block.table:
                self._row_index = 0
                self.add_table(block.table.headers, block.table.rows)

    def add_chart_image(self, chart: Dict[str, Any]) -> None:
        png = render_chart_png(chart)
        if not png:
            return

        chart_title = _pdf_safe_text(str(chart.get("title") or "Grafico"))
        self._ensure_space(95)
        self.add_section_heading(chart_title, level=2)
        self.ln(2)

        img_w = self._usable_width()
        self.image(io.BytesIO(png), w=img_w)
        self.ln(6)

        points = _chart_points(chart)
        if points:
            self._row_index = 0
            value_label = str(chart.get("value_label") or "valor")
            val_header = (
                "Percentual"
                if value_label == "percentual"
                else "Quantidade"
                if value_label == "quantidade"
                else "Valor (R$)"
            )
            total = sum(p["value"] for p in points) or 1.0
            rows = []
            for i, p in enumerate(points, 1):
                pct = f"{100.0 * p['value'] / total:.1f}%".replace(".", ",")
                rows.append(
                    [
                        str(i),
                        _pdf_safe_text(p["name"]),
                        _format_chart_value(p["value"], value_label),
                        pct,
                    ]
                )
            self.add_table(["#", "Item", val_header, "% do total"], rows)

    def add_structured_table(self, table: Dict[str, Any], *, heading: str | None = None) -> None:
        md_table = _structured_table_from_dict(table)
        if not md_table:
            return
        if heading:
            self.add_section_heading(_pdf_safe_text(heading), level=2)
        self._row_index = 0
        self.add_table(md_table.headers, md_table.rows)


def build_analysis_pdf_bytes(
    title: str,
    markdown_body: str,
    *,
    chart: Dict[str, Any] | None = None,
    table: Dict[str, Any] | None = None,
) -> bytes:
    if FPDF is None:
        raise RuntimeError("Biblioteca fpdf2 nao instalada. Execute: pip install fpdf2")

    pdf = AnalysisReportPDF(doc_title=title)
    pdf.add_page()
    pdf.add_document_title(title)

    body = (markdown_body or "").strip()
    blocks = _parse_markdown_blocks(body) if body else []

    if blocks:
        pdf.render_blocks(blocks)
    elif body:
        pdf.add_paragraph(_strip_inline_md(body))

    has_chart = bool(chart and _chart_points(chart))
    has_structured_table = bool(
        table and isinstance(table.get("rows"), list) and table.get("headers")
    )

    if has_chart:
        pdf.add_chart_image(chart)  # type: ignore[arg-type]

    if has_structured_table:
        table_title = str(table.get("title") or "Dados tabulares")  # type: ignore[union-attr]
        pdf.add_structured_table(table, heading=table_title)  # type: ignore[arg-type]

    if not blocks and not body and not has_chart and not has_structured_table:
        pdf.add_paragraph("Nenhum conteudo disponivel para este relatorio.")

    out = pdf.output()
    if isinstance(out, bytearray):
        return bytes(out)
    if isinstance(out, bytes):
        return out
    return str(out).encode("utf-8")
