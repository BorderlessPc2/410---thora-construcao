import type { BDIComponente, BDIResultado } from "../types/bdi";

const CATEGORIA_LABELS: Record<string, string> = {
  despesas_indiretas: "Despesas indiretas",
  risco: "Risco",
  lucro: "Lucro",
  tributos: "Tributos",
};

function findValor(componentes: BDIComponente[], ids: string[]): number {
  for (const id of ids) {
    const found = componentes.find((c) => c.id === id);
    if (found) return found.valor / 100;
  }
  return 0;
}

/** Fórmula TCU: [(1+AC+S+R+DF)×(1+L)/(1-T)-1]×100 */
export function calcularBDI(componentes: BDIComponente[]): BDIResultado {
  const AC = findValor(componentes, ["administracao_central"]);
  const S = findValor(componentes, ["seguro_garantia"]);
  const R = findValor(componentes, ["risco"]);
  const DF = findValor(componentes, ["despesas_financeiras"]);
  const L = findValor(componentes, ["lucro"]);

  const T = componentes
    .filter((c) => c.categoria === "tributos")
    .reduce((sum, c) => sum + c.valor / 100, 0);

  const numerator = (1 + AC + S + R + DF) * (1 + L);
  const denominator = 1 - T;
  const fator = denominator > 0 ? numerator / denominator : numerator;
  const bdiPercentual = Math.round((fator - 1) * 10000) / 100;
  const fatorBDI = Math.round((1 + bdiPercentual / 100) * 10000) / 10000;

  const breakdownMap: Record<string, number> = {};
  for (const comp of componentes) {
    const label = CATEGORIA_LABELS[comp.categoria] ?? comp.categoria;
    breakdownMap[label] = (breakdownMap[label] ?? 0) + comp.valor;
  }

  const breakdown = Object.entries(breakdownMap).map(([categoria, total]) => ({
    categoria,
    total: Math.round(total * 100) / 100,
  }));

  return { bdiPercentual, fatorBDI, breakdown };
}

export function formatBDIPercent(value: number): string {
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

export function formatCurrencyBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
