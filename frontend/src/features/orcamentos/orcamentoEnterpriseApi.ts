import { apiClient } from "../../services/api";
import type { LinhaAnalitica } from "./orcamentoAnalitico";
import { linhasToExportPayload } from "./orcamentoAnalitico";

export type AuditCampoAlterado = "quantidade" | "valor_unitario" | "bdi";

export type BudgetVersion = {
  id: string;
  project_id: string;
  version_name: string;
  items_snapshot: Record<string, unknown>[];
  created_at: string;
  created_by: string;
  created_by_name: string;
};

export type ActiveLock = {
  item_id: string;
  user_id: string;
  user_name: string;
  locked_at: string;
};

export function mapEditableFieldToAuditCampo(
  field: "quantidade" | "valorUnitario" | "bdi",
): AuditCampoAlterado {
  if (field === "valorUnitario") return "valor_unitario";
  return field;
}

export async function postAuditLog(
  projectId: string,
  payload: {
    item_codigo: string;
    campo_alterado: AuditCampoAlterado;
    valor_antigo: string | number;
    valor_novo: string | number;
    user_name?: string;
  },
): Promise<void> {
  try {
    await apiClient.post(`/api/orcamentos/${projectId}/audit`, payload);
  } catch {
    /* auditoria em background — não bloqueia edição */
  }
}

export async function saveBudgetVersion(
  projectId: string,
  versionName: string,
  linhas: LinhaAnalitica[],
  createdByName?: string,
): Promise<BudgetVersion> {
  const response = await apiClient.post(`/api/orcamentos/${projectId}/versions`, {
    version_name: versionName,
    items_snapshot: linhasToExportPayload(linhas),
    created_by_name: createdByName,
  });
  return response.data.version as BudgetVersion;
}

export async function listBudgetVersions(projectId: string): Promise<BudgetVersion[]> {
  const response = await apiClient.get(`/api/orcamentos/${projectId}/versions`);
  return (response.data.versions ?? []) as BudgetVersion[];
}

export async function acquireItemLock(
  projectId: string,
  itemId: string,
  userName?: string,
): Promise<void> {
  await apiClient.post(`/api/orcamentos/${projectId}/lock/${itemId}`, {
    user_name: userName,
  });
}

export async function releaseItemLock(projectId: string, itemId: string): Promise<void> {
  try {
    await apiClient.post(`/api/orcamentos/${projectId}/unlock/${itemId}`);
  } catch {
    /* unlock best-effort */
  }
}
