import { exportToXLSX } from "../../services/api";
import {
  linhasToExportPayload,
  mapRawListToLinhasAnaliticas,
} from "./orcamentoAnalitico";
import type { LinhaAnalitica } from "./orcamentoAnalitico";
import type { OutputModelsSelection } from "./outputModels";

export function resolveExportItems(options: {
  linhas?: LinhaAnalitica[];
  hierarchicalItems?: unknown[];
  flatItems?: unknown[];
}): unknown[] {
  const { linhas, hierarchicalItems, flatItems } = options;

  if (linhas && linhas.length > 0) {
    return linhasToExportPayload(linhas);
  }

  if (Array.isArray(hierarchicalItems) && hierarchicalItems.length > 0) {
    return linhasToExportPayload(mapRawListToLinhasAnaliticas(hierarchicalItems));
  }

  if (Array.isArray(flatItems) && flatItems.length > 0) {
    return flatItems;
  }

  return [];
}

export async function exportOrcamentoExcel(options: {
  linhas?: LinhaAnalitica[];
  hierarchicalItems?: unknown[];
  flatItems?: unknown[];
  modelosSelecionados: OutputModelsSelection;
  nomeProjeto?: string;
  template?: "novacap" | "sinapi" | "livre";
  colunas?: string[];
  compareIds?: string[];
}): Promise<{ success: boolean; message: string }> {
  const items = resolveExportItems(options);
  if (items.length === 0) {
    throw new Error("Nenhum item disponível para exportação.");
  }

  return exportToXLSX(items, {
    modelosSelecionados: options.modelosSelecionados,
    nomeProjeto: options.nomeProjeto,
    template: options.template,
    colunas: options.colunas,
    compareIds: options.compareIds,
  });
}
