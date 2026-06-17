import React, { useCallback, useEffect, useMemo, useState } from "react";
import { GitCompare, Loader2, Save, X } from "lucide-react";
import { toast } from "sonner";
import type { LinhaAnalitica } from "./orcamentoAnalitico";
import {
  listBudgetVersions,
  saveBudgetVersion,
  type BudgetVersion,
} from "./orcamentoEnterpriseApi";
import {
  computeTotalDeviation,
  computeVersionDiff,
  type VersionDiffRow,
} from "./versionDiff";
import { btnAccent, btnMuted } from "../../components/ui/buttonClasses";

const formatMoney = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type RevisoesPanelProps = {
  projectId: string;
  linhas: LinhaAnalitica[];
  userName?: string;
  onClose: () => void;
};

function diffRowClass(status: VersionDiffRow["status"]): string {
  if (status === "increase") return "bg-red-50";
  if (status === "decrease") return "bg-emerald-50";
  return "";
}

export function RevisoesPanel({
  projectId,
  linhas,
  userName,
  onClose,
}: RevisoesPanelProps) {
  const [versions, setVersions] = useState<BudgetVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [versionName, setVersionName] = useState("");
  const [versionAId, setVersionAId] = useState("");
  const [versionBId, setVersionBId] = useState("");

  const loadVersions = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await listBudgetVersions(projectId);
      setVersions(list);
      setVersionAId((prev) => prev || list[0]?.id || "");
      setVersionBId((prev) => prev || list[1]?.id || list[0]?.id || "");
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Erro ao carregar revisões";
      toast.error("Falha ao carregar revisões", { description: msg });
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadVersions();
  }, [loadVersions]);

  const versionA = versions.find((v) => v.id === versionAId);
  const versionB = versions.find((v) => v.id === versionBId);

  const diffRows = useMemo(() => {
    if (!versionA || !versionB) return [];
    return computeVersionDiff(versionA.items_snapshot, versionB.items_snapshot);
  }, [versionA, versionB]);

  const totalDeviation = useMemo(() => computeTotalDeviation(diffRows), [diffRows]);

  const handleSaveVersion = async () => {
    const name = versionName.trim();
    if (!name) {
      toast.warning("Informe um nome para a revisão");
      return;
    }
    if (linhas.length === 0) {
      toast.warning("Nenhuma linha para salvar");
      return;
    }

    setIsSaving(true);
    try {
      const saved = await saveBudgetVersion(projectId, name, linhas, userName);
      setVersions((prev) => [saved, ...prev]);
      setVersionName("");
      if (!versionAId) setVersionAId(saved.id);
      toast.success("Revisão salva", { description: name });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Erro ao salvar revisão";
      toast.error("Falha ao salvar", { description: msg });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Gerenciar revisões do orçamento"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <GitCompare className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-slate-900">Gerenciar Revisões</h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Salve snapshots e compare revisões A vs B com desvio financeiro.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Fechar painel de revisões"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="min-w-[200px] flex-1">
              <label className="mb-1 block text-xs font-medium uppercase text-slate-500">
                Nome da nova revisão
              </label>
              <input
                type="text"
                value={versionName}
                onChange={(e) => setVersionName(e.target.value)}
                placeholder='Ex: "Revisão Inicial DER"'
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <button
              type="button"
              disabled={isSaving || linhas.length === 0}
              onClick={() => void handleSaveVersion()}
              className={`${btnAccent} inline-flex items-center gap-2`}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Salvar versão atual
            </button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              Carregando revisões…
            </div>
          ) : versions.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              Nenhuma revisão salva ainda. Salve a versão atual para começar a comparar.
            </p>
          ) : (
            <>
              <div className="mb-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase text-slate-500">
                    Selecionar Versão Base (A)
                  </label>
                  <select
                    value={versionAId}
                    onChange={(e) => setVersionAId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    {versions.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.version_name} — {new Date(v.created_at).toLocaleString("pt-BR")}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase text-slate-500">
                    Selecionar Versão Comparativa (B)
                  </label>
                  <select
                    value={versionBId}
                    onChange={(e) => setVersionBId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    {versions.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.version_name} — {new Date(v.created_at).toLocaleString("pt-BR")}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {versionA && versionB ? (
                <>
                  <div
                    className={`mb-4 rounded-lg border p-4 ${
                      totalDeviation > 0
                        ? "border-red-200 bg-red-50"
                        : totalDeviation < 0
                          ? "border-emerald-200 bg-emerald-50"
                          : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <p className="text-xs font-medium uppercase text-slate-600">
                      Desvio Financeiro Total (B − A)
                    </p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                      {totalDeviation >= 0 ? "+" : ""}
                      {formatMoney(totalDeviation)}
                    </p>
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="min-w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-100 text-left text-slate-700">
                          <th className="px-3 py-2 font-semibold">Código</th>
                          <th className="px-3 py-2 font-semibold">Descrição</th>
                          <th className="px-3 py-2 text-right font-semibold">Total A</th>
                          <th className="px-3 py-2 text-right font-semibold">Total B</th>
                          <th className="px-3 py-2 text-right font-semibold">Diferença</th>
                        </tr>
                      </thead>
                      <tbody>
                        {diffRows.map((row) => (
                          <tr key={row.key} className={`border-t border-slate-100 ${diffRowClass(row.status)}`}>
                            <td className="px-3 py-2 font-mono text-xs">{row.codigo}</td>
                            <td className="px-3 py-2">{row.descricao}</td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {formatMoney(row.totalA)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {formatMoney(row.totalB)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {row.status === "equal" ? (
                                "—"
                              ) : (
                                <span
                                  className={
                                    row.status === "increase"
                                      ? "rounded bg-red-100 px-2 py-0.5 text-red-800"
                                      : "rounded bg-emerald-100 px-2 py-0.5 text-emerald-800"
                                  }
                                >
                                  {row.diff >= 0 ? "+" : ""}
                                  {formatMoney(row.diff)}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}
            </>
          )}
        </div>

        <div className="border-t border-slate-200 px-5 py-3">
          <button type="button" onClick={onClose} className={btnMuted}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
