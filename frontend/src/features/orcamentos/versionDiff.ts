import type { LinhaAnalitica } from "./orcamentoAnalitico";
import { mapRawListToLinhasAnaliticas } from "./orcamentoAnalitico";

export type VersionDiffRow = {
  key: string;
  codigo: string;
  descricao: string;
  totalA: number;
  totalB: number;
  diff: number;
  status: "equal" | "increase" | "decrease";
};

function itemKey(linha: LinhaAnalitica): string {
  if (linha.codigo.trim()) return linha.codigo.trim();
  return `${linha.tipoLinha}-${linha.id}`;
}

export function snapshotToLinhas(snapshot: Record<string, unknown>[]): LinhaAnalitica[] {
  return mapRawListToLinhasAnaliticas(snapshot);
}

export function computeVersionDiff(
  snapshotA: Record<string, unknown>[],
  snapshotB: Record<string, unknown>[],
): VersionDiffRow[] {
  const linhasA = snapshotToLinhas(snapshotA);
  const linhasB = snapshotToLinhas(snapshotB);

  const mapA = new Map<string, LinhaAnalitica>();
  const mapB = new Map<string, LinhaAnalitica>();

  for (const linha of linhasA) {
    if (linha.tipoLinha === "grupo") continue;
    mapA.set(itemKey(linha), linha);
  }
  for (const linha of linhasB) {
    if (linha.tipoLinha === "grupo") continue;
    mapB.set(itemKey(linha), linha);
  }

  const allKeys = new Set([...mapA.keys(), ...mapB.keys()]);
  const rows: VersionDiffRow[] = [];

  for (const key of allKeys) {
    const a = mapA.get(key);
    const b = mapB.get(key);
    const totalA = a?.valorTotal ?? 0;
    const totalB = b?.valorTotal ?? 0;
    const diff = totalB - totalA;

    let status: VersionDiffRow["status"] = "equal";
    if (diff > 0.005) status = "increase";
    else if (diff < -0.005) status = "decrease";

    rows.push({
      key,
      codigo: b?.codigo || a?.codigo || key,
      descricao: b?.descricao || a?.descricao || "—",
      totalA,
      totalB,
      diff,
      status,
    });
  }

  return rows.sort((x, y) => x.codigo.localeCompare(y.codigo, "pt-BR"));
}

export function computeTotalDeviation(rows: VersionDiffRow[]): number {
  return rows.reduce((acc, row) => acc + row.diff, 0);
}
