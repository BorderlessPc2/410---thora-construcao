import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";
import { listOrcamentosByUserId } from "../features/orcamentos/orcamentoRepository";
import type { Orcamento } from "../features/orcamentos/orcamentoTypes";
import {
  formatCurrency,
  getOrcamentoTotal,
} from "../features/orcamentos/orcamentoAnalytics";
import OrcamentoAnalyticsCharts from "../components/OrcamentoAnalyticsCharts";
import TendenciaTemporalChart from "../components/dashboard/TendenciaTemporalChart";
import AlertasInteligentes from "../components/dashboard/AlertasInteligentes";
import AtividadeRecente from "../components/dashboard/AtividadeRecente";
import ComparativoOrcamentos from "../components/dashboard/ComparativoOrcamentos";
import { btnPrimary, btnSecondary } from "../components/ui/buttonClasses";

interface ResumoCardProps {
  titulo: string;
  valor: string;
  descricao: string;
  extra?: string;
  variant: "blue" | "gray" | "yellow" | "green";
  /** Classe extra no valor (ex.: moeda longa precisa de fonte menor) */
  valorClassName?: string;
}

const variantStyles = {
  blue: "bg-blue-50 text-blue-600 border-blue-100",
  gray: "bg-slate-50 text-slate-800 border-slate-200",
  yellow: "bg-amber-50 text-amber-700 border-amber-100",
  green: "bg-emerald-50 text-emerald-700 border-emerald-100",
};

const ResumoCard: React.FC<ResumoCardProps> = ({
  titulo,
  valor,
  descricao,
  extra,
  variant,
  valorClassName,
}) => {
  const valorSize =
    valorClassName ??
    (valor.length > 12
      ? "text-xl sm:text-2xl"
      : "text-3xl sm:text-4xl");

  return (
    <div
      className={`flex min-w-0 flex-col gap-2 rounded-2xl border p-6 ${variantStyles[variant]}`}
    >
      <p className="text-sm text-slate-600">{titulo}</p>
      <p
        className={`font-bold tabular-nums leading-tight tracking-tight break-words ${valorSize}`}
        title={valor}
      >
        {valor}
      </p>
      <p className="text-sm text-slate-600">{descricao}</p>
      {extra && <p className="text-sm font-medium text-emerald-600">{extra}</p>}
    </div>
  );
};

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchOrcamentos = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await listOrcamentosByUserId(user.uid);
      setOrcamentos(data);
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : "Não foi possível carregar os orçamentos.";
      console.error("[Dashboard] Falha ao carregar orçamentos:", e);
      setLoadError(msg);
      toast.error("Falha ao carregar dados", { description: msg });
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    void fetchOrcamentos();
  }, [fetchOrcamentos]);

  const stats = useMemo(() => {
    const total = orcamentos.length;
    const processing = orcamentos.filter((o) => o.status === "processing").length;
    const completed = orcamentos.filter((o) => o.status === "completed");
    const error = orcamentos.filter((o) => o.status === "error").length;
    const valorExportado = completed.reduce((s, o) => s + getOrcamentoTotal(o), 0);
    return {
      total,
      processing,
      completed: completed.length,
      error,
      valorExportado,
    };
  }, [orcamentos]);

  return (
    <div className="flex-1 overflow-auto bg-slate-50">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Dashboard
            </h1>
            <p className="mt-1 text-slate-600">
              Visão geral dos orçamentos analisados e exportados
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void fetchOrcamentos()}
              disabled={loading}
              className={`${btnSecondary} shrink-0`}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </button>
            <button
              type="button"
              onClick={() => navigate("/analise-orcamento")}
              className={btnPrimary}
            >
              Nova análise
            </button>
          </div>
        </div>

        {loadError && !loading && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {loadError}
          </div>
        )}

        <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4 [&>*]:min-w-0">
          <ResumoCard
            titulo="Total de Orçamentos"
            valor={loading ? "—" : String(stats.total)}
            descricao="Todos os projetos"
            variant="blue"
          />
          <ResumoCard
            titulo="Em processamento"
            valor={loading ? "—" : String(stats.processing)}
            descricao="Extração ou análise em andamento"
            variant="gray"
          />
          <ResumoCard
            titulo="Analisados / exportados"
            valor={loading ? "—" : String(stats.completed)}
            descricao="Prontos para validação e relatórios"
            variant="green"
          />
          <ResumoCard
            titulo="Valor consolidado"
            valor={loading ? "—" : formatCurrency(stats.valorExportado)}
            descricao="Soma dos orçamentos finalizados"
            variant="yellow"
            valorClassName="text-base sm:text-lg lg:text-xl"
          />
        </div>

        {/* Linha 2: Tendência + Alertas */}
        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <TendenciaTemporalChart orcamentos={orcamentos} loading={loading} />
          </div>
          <div className="lg:col-span-1">
            <AlertasInteligentes orcamentos={orcamentos} loading={loading} />
          </div>
        </div>

        {/* Linha 3: Analytics + Atividade recente */}
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
          <OrcamentoAnalyticsCharts
            orcamentos={orcamentos}
            loading={loading}
            onRefresh={() => void fetchOrcamentos()}
            sectionClassName="mt-0"
          />
          <AtividadeRecente orcamentos={orcamentos} loading={loading} />
        </div>

        {/* Linha 4: Comparativo (colapsável) */}
        <div className="mb-10">
          <ComparativoOrcamentos orcamentos={orcamentos} loading={loading} />
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
            <h2 className="text-lg font-semibold text-slate-900">
              Orçamentos recentes
            </h2>
            <button
              type="button"
              onClick={() => navigate("/analise-orcamento")}
              className={`${btnPrimary} w-full sm:w-auto`}
            >
              Nova análise ABC
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 sm:px-6 sm:py-4">Obra / Projeto</th>
                  <th className="px-4 py-3 sm:px-6 sm:py-4">Status</th>
                  <th className="px-4 py-3 text-right sm:px-6 sm:py-4">Valor total</th>
                  <th className="px-4 py-3 text-right sm:px-6 sm:py-4">Itens</th>
                  <th className="px-4 py-3 text-right sm:px-6 sm:py-4">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr>
                    <td className="px-4 py-8 text-slate-500 sm:px-6" colSpan={5}>
                      Carregando orçamentos…
                    </td>
                  </tr>
                ) : loadError ? (
                  <tr>
                    <td className="px-4 py-8 sm:px-6" colSpan={5}>
                      <p className="text-slate-600">Não foi possível carregar a lista.</p>
                      <button
                        type="button"
                        onClick={() => void fetchOrcamentos()}
                        className={`${btnSecondary} mt-3`}
                      >
                        Tentar novamente
                      </button>
                    </td>
                  </tr>
                ) : orcamentos.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-slate-500 sm:px-6" colSpan={5}>
                      Nenhum orçamento encontrado. Use{" "}
                      <button
                        type="button"
                        className="font-medium text-blue-600 underline-offset-2 hover:underline"
                        onClick={() => navigate("/analise-orcamento")}
                      >
                        Nova análise
                      </button>{" "}
                      para começar.
                    </td>
                  </tr>
                ) : (
                  orcamentos.slice(0, 20).map((o) => {
                    const statusLabel =
                      o.status === "completed"
                        ? "Finalizado"
                        : o.status === "processing"
                          ? "Em processamento"
                          : "Erro";

                    const statusPill =
                      o.status === "completed"
                        ? "bg-emerald-100 text-emerald-800"
                        : o.status === "processing"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-red-100 text-red-800";

                    const valor =
                      o.status === "completed"
                        ? formatCurrency(getOrcamentoTotal(o))
                        : "—";

                    return (
                      <tr key={o.id} className="hover:bg-slate-50/80">
                        <td className="px-4 py-4 sm:px-6">
                          <p className="font-medium text-slate-900">
                            {o.filename || o.uploadId}
                          </p>
                          <p className="text-xs text-slate-500">
                            {o.uploadedAt.toLocaleDateString("pt-BR")}
                          </p>
                        </td>
                        <td className="px-4 py-4 sm:px-6">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${statusPill}`}
                          >
                            {statusLabel}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right font-medium tabular-nums sm:px-6">
                          {valor}
                        </td>
                        <td className="px-4 py-4 text-right tabular-nums sm:px-6">
                          {o.itemsFound ?? "—"}
                        </td>
                        <td className="px-4 py-4 text-right sm:px-6">
                          {o.status === "completed" && (
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                className="text-xs font-medium text-blue-600 hover:underline"
                                onClick={() => navigate(`/validacao/${o.uploadId}`)}
                              >
                                Validar
                              </button>
                              <button
                                type="button"
                                className="text-xs font-medium text-violet-600 hover:underline"
                                onClick={() => navigate(`/curva-abc/${o.uploadId}`)}
                              >
                                Curva ABC
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
