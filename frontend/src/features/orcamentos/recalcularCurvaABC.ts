/**
 * Recalcula totais com BDI e classificação ABC (Curva de Pareto) para itens de orçamento.
 */

export interface OrcamentoItem {
  id: number;
  item?: string;
  tipo?: string;
  banco?: string;
  /** Numeração hierárquica do edital/PDF (ex.: 1.1.2, 2.1.1). */
  code: string;
  /** Código da base de preços (SINAPI, SICRO, cotação, etc.). */
  catalogCode?: string;
  description: string;
  bdi: number;
  unit: string;
  qty: number;
  /** Valor unitário sem BDI (base para o recálculo). */
  unitPrice: number;
  /** Preço total com BDI: qty × unitPrice × (1 + bdi/100). */
  lineTotal: number;
  /** Referência do edital antes de ajustes manuais (s/ BDI). */
  referenceUnitPrice?: number;
  /** Total c/ BDI da referência do edital. */
  referenceLineTotal?: number;
  selected?: boolean;
  classification?: "A" | "B" | "C";
  individual_percentage?: number;
  accumulated_percentage?: number;
  /** Confiança da extração híbrida (0–1). */
  extractionConfidence?: number;
  /** Alertas de validação automática (ex.: Qtd×VU≠Total). */
  extractionAlerts?: string[];
}

export function resolveTipoLinha(item: { tipo?: string; tipo_linha?: string }): "grupo" | "item" | "composicao" {
  const tipo = String(item.tipo_linha ?? item.tipo ?? "item").toLowerCase();
  if (tipo === "grupo" || tipo === "titulo" || tipo === "título" || tipo === "title") {
    return "grupo";
  }
  if (tipo === "composicao" || tipo === "composição" || tipo === "insumo" || tipo === "subitem") {
    return "composicao";
  }
  return "item";
}

export function isExecutiveItem(item: OrcamentoItem): boolean {
  const tipo = resolveTipoLinha(item);
  const desc = item.description.toLowerCase();
  return tipo === "item" && !desc.includes("total do grupo");
}

/** Converte valor vindo de input (pt-BR ou en-US) para float. */
export function parseEditableNumber(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value !== "string") return 0;
  const compact = value.replace(/R\$/gi, "").replace(/%/g, "").replace(/\s/g, "").trim();
  if (!compact) return 0;
  const normalized =
    compact.includes(",") && compact.includes(".")
      ? compact.replace(/\./g, "").replace(",", ".")
      : compact.includes(",")
        ? compact.replace(",", ".")
        : compact;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function calcularLineTotalComBdi(
  qty: number,
  unitPrice: number,
  bdi: number,
): number {
  const q = Number(qty) || 0;
  const u = Number(unitPrice) || 0;
  const b = Number(bdi) || 0;
  return q * u * (1 + b / 100);
}

/** Converte preço unitário c/ BDI (extraído do PDF) para base s/ BDI. */
export function unitPriceSemBdiFromComBdi(
  unitComBdi: number,
  bdi: number,
): number {
  const factor = 1 + (Number(bdi) || 0) / 100;
  if (unitComBdi <= 0 || factor <= 0) return unitComBdi;
  return unitComBdi / factor;
}

/** BDI válido para orçamento público brasileiro (0–100%). */
export function sanitizeBdiPercent(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value <= 100) return value;
  return 0;
}

/** Infere BDI% a partir de qty, unit s/ BDI e total c/ BDI. */
export function inferBdiPercent(
  qty: number,
  unitPriceSemBdi: number,
  valorTotalComBdi: number,
): number {
  if (qty <= 0 || unitPriceSemBdi <= 0 || valorTotalComBdi <= 0) return 0;
  const base = qty * unitPriceSemBdi;
  if (valorTotalComBdi <= base * 1.001) return 0;
  const inferred = (valorTotalComBdi / base - 1) * 100;
  return inferred > 0 && inferred <= 100 ? Math.round(inferred * 100) / 100 : 0;
}

/** Resolve qty, BDI e unitPrice (s/ BDI) a partir de item estruturado do backend. */
export function resolveStructuredItemPricing(item: {
  quantidade?: unknown;
  Quantidade?: unknown;
  qty?: unknown;
  valor_unitario?: unknown;
  "Valor Unitário"?: unknown;
  unitPrice?: unknown;
  unitValue?: unknown;
  valor_total?: unknown;
  Total?: unknown;
  totalValue?: unknown;
  bdi?: unknown;
  BDI?: unknown;
}): { qty: number; bdi: number; unitPrice: number } {
  const qty = parseEditableNumber(item.quantidade ?? item.Quantidade ?? item.qty);
  const valorTotalComBdi = parseEditableNumber(
    item.valor_total ?? item.Total ?? item.totalValue,
  );

  let bdi = sanitizeBdiPercent(
    parseEditableNumber(String(item.bdi ?? item.BDI ?? 0).replace("%", "")),
  );

  let unitPriceSemBdi = parseEditableNumber(
    item.valor_unitario ?? item["Valor Unitário"] ?? item.unitValue ?? item.unitPrice,
  );

  if (bdi <= 0) {
    bdi = inferBdiPercent(qty, unitPriceSemBdi, valorTotalComBdi);
  }

  if (unitPriceSemBdi <= 0 && valorTotalComBdi > 0 && qty > 0) {
    unitPriceSemBdi =
      bdi > 0
        ? valorTotalComBdi / qty / (1 + bdi / 100)
        : valorTotalComBdi / qty;
  }

  return { qty, bdi, unitPrice: unitPriceSemBdi };
}

/**
 * Recalcula lineTotal, ordena por valor, percentuais e classificação A/B/C.
 * Itens "grupo" permanecem no final sem entrar na Curva ABC.
 */
export function recalcularCurvaABC(items: OrcamentoItem[]): OrcamentoItem[] {
  const groups = items.filter((item) => !isExecutiveItem(item));
  const executives = items
    .filter(isExecutiveItem)
    .map((item) => {
      const calculated = calcularLineTotalComBdi(item.qty, item.unitPrice, item.bdi);
      const lineTotal =
        item.referenceLineTotal && item.referenceLineTotal > 0
          ? item.referenceLineTotal
          : calculated;
      return { ...item, lineTotal };
    });

  const sorted = [...executives].sort((a, b) => {
    const diff = b.lineTotal - a.lineTotal;
    if (diff !== 0) return diff;
    return String(a.id).localeCompare(String(b.id), "pt-BR");
  });

  const totalValue = sorted.reduce((acc, item) => acc + item.lineTotal, 0);
  let accumulatedValue = 0;

  const classified = sorted.map((item) => {
    const prevPercentage = totalValue > 0 ? (accumulatedValue / totalValue) * 100 : 0;
    accumulatedValue += item.lineTotal;
    const accumulatedPercentage =
      totalValue > 0 ? (accumulatedValue / totalValue) * 100 : 0;
    const individualPercentage =
      totalValue > 0 ? (item.lineTotal / totalValue) * 100 : 0;

    let classification: "A" | "B" | "C" = "C";
    if (prevPercentage < 80) {
      classification = "A";
    } else if (prevPercentage < 95) {
      classification = "B";
    }

    return {
      ...item,
      individual_percentage: individualPercentage,
      accumulated_percentage: accumulatedPercentage,
      classification,
    };
  });

  return [...classified, ...groups];
}

export interface AbcResumo {
  totalGeral: number;
  classeA: { count: number; valor: number };
  classeB: { count: number; valor: number };
  classeC: { count: number; valor: number };
}

export function calcularResumoAbc(items: OrcamentoItem[]): AbcResumo {
  const executives = items.filter(isExecutiveItem);
  const totalGeral = executives.reduce((acc, item) => acc + item.lineTotal, 0);

  const sumByClass = (cls: "A" | "B" | "C") => {
    const filtered = executives.filter((i) => i.classification === cls);
    return {
      count: filtered.length,
      valor: filtered.reduce((acc, i) => acc + i.lineTotal, 0),
    };
  };

  return {
    totalGeral,
    classeA: sumByClass("A"),
    classeB: sumByClass("B"),
    classeC: sumByClass("C"),
  };
}

/** Guarda preço de referência do edital/PDF na primeira vez. */
export function snapshotReferenciaOrcamento(item: OrcamentoItem): OrcamentoItem {
  if (item.referenceLineTotal != null && item.referenceLineTotal > 0) {
    return item;
  }
  const refTotal = calcularLineTotalComBdi(item.qty, item.unitPrice, item.bdi);
  return {
    ...item,
    referenceUnitPrice: item.unitPrice,
    referenceLineTotal: refTotal,
  };
}

/** Economia quando o preço atual é menor que a referência do edital. */
export function calcularEconomia(item: OrcamentoItem): number {
  const referencia = item.referenceLineTotal ?? 0;
  const atual = item.lineTotal ?? 0;
  if (referencia <= 0 || atual <= 0) return 0;
  return Math.max(0, referencia - atual);
}
