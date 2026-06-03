import type { LinhaAnalitica } from "./orcamentoAnalitico";
import { parseNumeric } from "./parseNumeric";
import { recalcularGruposAnalitico } from "./recalcularAnaliticoHierarquico";

export const SINTETICO_MAX_DESCRICAO_GRUPO = 100;

export type LinhaSintetica = {
  itemNumero: string;
  descricao: string;
  valorTotal: number;
};

/** Alias explícito para totais monetários pt-BR. */
export function coerceValorTotal(value: unknown): number {
  return parseNumeric(value);
}

/** Grupo válido no sintético: descrição curta e total > 0. */
export function isGrupoSinteticoLegitimo(linha: LinhaAnalitica): boolean {
  if (linha.tipoLinha !== "grupo") return false;
  if (linha.descricao.trim().length > SINTETICO_MAX_DESCRICAO_GRUPO) return false;
  return parseNumeric(linha.valorTotal) > 0;
}

/**
 * Consolida totais dos filhos em cada grupo (parseNumeric estrito, sem concatenação).
 */
export function calcularTotaisSinteticos(linhas: LinhaAnalitica[]): LinhaAnalitica[] {
  const rows = recalcularGruposAnalitico(linhas.map((linha) => ({ ...linha })));

  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (rows[i].tipoLinha !== "grupo") continue;
    let sum = 0;
    for (let j = i + 1; j < rows.length && rows[j].tipoLinha !== "grupo"; j += 1) {
      sum += parseNumeric(rows[j].valorTotal);
    }
    rows[i].valorTotal = Math.round(sum * 100) / 100;
  }

  return rows;
}

/** Apenas grupos pai legítimos para a visão sintética. */
export function filtrarLinhasSintetico(linhas: LinhaAnalitica[]): LinhaSintetica[] {
  return calcularTotaisSinteticos(linhas)
    .filter(isGrupoSinteticoLegitimo)
    .map((linha) => ({
      itemNumero: linha.itemNumero,
      descricao: linha.descricao,
      valorTotal: parseNumeric(linha.valorTotal),
    }));
}

export function calcularResumoSintetico(linhasSintetico: LinhaSintetica[]) {
  const totalGeral = linhasSintetico.reduce(
    (acc, linha) => acc + parseNumeric(linha.valorTotal),
    0,
  );
  return {
    totalGrupos: linhasSintetico.length,
    totalGeral: Math.round(totalGeral * 100) / 100,
  };
}

export function linhasSinteticoToExportPayload(
  linhasCompletas: LinhaAnalitica[],
): Record<string, unknown>[] {
  return calcularTotaisSinteticos(linhasCompletas)
    .filter(isGrupoSinteticoLegitimo)
    .map((linha) => {
      const total = parseNumeric(linha.valorTotal);
      return {
        item: linha.itemNumero,
        item_numero: linha.itemNumero,
        tipo: "grupo",
        tipo_linha: "grupo",
        descricao: linha.descricao,
        description: linha.descricao,
        valor_total: total,
        total_com_bdi: total,
        totalValue: total,
        quantidade: 0,
        qty: 0,
        valor_unitario: 0,
        unitPrice: 0,
      };
    });
}
