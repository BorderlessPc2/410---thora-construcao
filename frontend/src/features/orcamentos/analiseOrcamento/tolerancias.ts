import type { LinhaOrcamentoEntrada } from "./types";

/** Tolerância para totais com arredondamento de planilha (centavos). */
export function toleranciaMonetariaEfetiva(
  valorReferencia: number,
  toleranciaBase: number,
): number {
  if (valorReferencia <= 0) return Math.max(toleranciaBase, 0.05);
  return Math.min(2, Math.max(toleranciaBase, 0.05, valorReferencia * 0.00005));
}

/**
 * BDIs que aparecem com frequência relevante no documento.
 * Planilhas podem ter capítulos com BDI distinto (ex.: 21,22% e 11,1%).
 */
export function inferirBdisValidosDocumento(linhas: LinhaOrcamentoEntrada[]): number[] {
  const frequencia = new Map<number, number>();
  let linhasComBdi = 0;

  for (const linha of linhas) {
    if (linha.bdiPercent <= 0) continue;
    linhasComBdi += 1;
    const arredondado = Math.round(linha.bdiPercent * 100) / 100;
    frequencia.set(arredondado, (frequencia.get(arredondado) ?? 0) + 1);
  }

  if (linhasComBdi === 0) return [];

  const limiar = Math.max(2, Math.ceil(linhasComBdi * 0.08));

  return [...frequencia.entries()]
    .filter(([, count]) => count >= limiar)
    .map(([bdi]) => bdi)
    .sort((a, b) => b - a);
}

export function linhaBdiConfereDocumento(
  bdiLinha: number,
  bdisValidos: number[],
  bdiGlobal: number,
  toleranciaPercentual: number,
): boolean {
  if (bdisValidos.length > 1) {
    return bdisValidos.some((bdi) => Math.abs(bdiLinha - bdi) <= toleranciaPercentual);
  }
  if (bdiGlobal > 0) {
    return Math.abs(bdiLinha - bdiGlobal) <= toleranciaPercentual;
  }
  return true;
}
