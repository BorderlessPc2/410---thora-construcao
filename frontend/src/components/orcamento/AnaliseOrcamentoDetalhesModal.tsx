import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ExternalLink, Loader2, Sparkles, X, XCircle } from "lucide-react";
import { toast } from "sonner";
import type {
  ResultadoAnaliseOrcamento,
  ResultadoLinhaAnalise,
  VerificacaoLinha,
} from "../../features/orcamentos/analiseOrcamento";
import {
  buildCorrecaoAnalisePayload,
  type CorrecaoAnaliseResposta,
  type DadosExtraidosLinha,
} from "../../features/orcamentos/analiseOrcamento/correcaoAnalise";
import { REGRA_ANALISE_LABELS } from "../../features/orcamentos/analiseOrcamento/constants";
import { enviarCorrecaoAnaliseIA } from "../../services/api";
import { AnaliseOrcamentoStatusBadge } from "./AnaliseOrcamentoStatusBadge";

type FiltroDetalhes = "todos" | "reprovado" | "alerta";

type AnaliseOrcamentoDetalhesModalProps = {
  open: boolean;
  resultado: ResultadoAnaliseOrcamento;
  filtroInicial?: FiltroDetalhes;
  uploadId?: string;
  nomeArquivo?: string;
  dadosExtraidosPorId?: Map<string | number, DadosExtraidosLinha>;
  onClose: () => void;
  onVerLinha?: (linhaId: string | number) => void;
};

function formatValor(value?: number): string | null {
  if (value == null || Number.isNaN(value)) return null;
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function verificacoesRelevantes(verificacoes: VerificacaoLinha[]): VerificacaoLinha[] {
  return verificacoes.filter(
    (verificacao) =>
      verificacao.status !== "ok" && verificacao.status !== "nao_aplicavel",
  );
}

function filtrarLinhas(
  linhas: ResultadoLinhaAnalise[],
  filtro: FiltroDetalhes,
): ResultadoLinhaAnalise[] {
  if (filtro === "todos") {
    return linhas.filter(
      (linha) => linha.statusGeral === "reprovado" || linha.statusGeral === "alerta",
    );
  }
  return linhas.filter((linha) => linha.statusGeral === filtro);
}

function DetalheLinhaCard({
  linha,
  onVerLinha,
}: {
  linha: ResultadoLinhaAnalise;
  onVerLinha?: (linhaId: string | number) => void;
}) {
  const problemas = verificacoesRelevantes(linha.verificacoes);

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {linha.itemNumero ? (
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                Item {linha.itemNumero}
              </span>
            ) : null}
            <AnaliseOrcamentoStatusBadge resultado={linha} compact />
          </div>
          <p className="mt-2 text-sm font-medium text-slate-900">{linha.descricao || "—"}</p>
        </div>
        {onVerLinha ? (
          <button
            type="button"
            onClick={() => onVerLinha(linha.linhaId)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            Ver na tabela
          </button>
        ) : null}
      </div>

      {problemas.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {problemas.map((verificacao, index) => {
            const label = REGRA_ANALISE_LABELS[verificacao.regraId] ?? verificacao.regraId;
            const calculado = formatValor(verificacao.valorCalculado);
            const informado = formatValor(verificacao.valorInformado);
            const diferenca = formatValor(verificacao.diferenca);
            const isErro = verificacao.severidade === "erro";

            return (
              <li
                key={`${verificacao.regraId}-${index}`}
                className={`rounded-lg border px-3 py-2.5 ${
                  isErro
                    ? "border-red-200 bg-red-50/60"
                    : "border-amber-200 bg-amber-50/60"
                }`}
              >
                <div className="flex items-center gap-2">
                  {isErro ? (
                    <XCircle className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                  )}
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                    {label}
                  </p>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-800">{verificacao.mensagem}</p>
                {(calculado || informado || diferenca) && (
                  <dl className="mt-2 grid gap-1 text-xs text-slate-600 sm:grid-cols-3">
                    {calculado ? (
                      <div>
                        <dt className="font-medium text-slate-500">Esperado</dt>
                        <dd className="tabular-nums">{calculado}</dd>
                      </div>
                    ) : null}
                    {informado ? (
                      <div>
                        <dt className="font-medium text-slate-500">Informado</dt>
                        <dd className="tabular-nums">{informado}</dd>
                      </div>
                    ) : null}
                    {diferenca ? (
                      <div>
                        <dt className="font-medium text-slate-500">Diferença</dt>
                        <dd className="tabular-nums">{diferenca}</dd>
                      </div>
                    ) : null}
                  </dl>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-500">Nenhum detalhe adicional registrado.</p>
      )}

      {linha.memoriaCalculo && linha.statusGeral !== "aprovado" ? (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <span className="font-medium text-slate-700">Memória nas observações: </span>
          {linha.memoriaCalculo.explicacao}
        </div>
      ) : null}
    </article>
  );
}

export function AnaliseOrcamentoDetalhesModal({
  open,
  resultado,
  filtroInicial = "todos",
  uploadId,
  nomeArquivo,
  dadosExtraidosPorId,
  onClose,
  onVerLinha,
}: AnaliseOrcamentoDetalhesModalProps) {
  const [filtro, setFiltro] = useState<FiltroDetalhes>(filtroInicial);
  const [enviandoCorrecao, setEnviandoCorrecao] = useState(false);
  const [respostaCorrecao, setRespostaCorrecao] = useState<CorrecaoAnaliseResposta | null>(null);

  useEffect(() => {
    if (open) {
      setFiltro(filtroInicial);
      setRespostaCorrecao(null);
    }
  }, [open, filtroInicial]);

  const linhasFiltradas = useMemo(
    () => filtrarLinhas(resultado.linhas, filtro),
    [resultado.linhas, filtro],
  );

  const contadores = useMemo(() => {
    const reprovadas = resultado.linhas.filter((l) => l.statusGeral === "reprovado").length;
    const alertas = resultado.linhas.filter((l) => l.statusGeral === "alerta").length;
    return { reprovadas, alertas, total: reprovadas + alertas };
  }, [resultado.linhas]);

  if (!open) return null;

  const tabs: { id: FiltroDetalhes; label: string; count: number }[] = [
    { id: "todos", label: "Todos", count: contadores.total },
    { id: "reprovado", label: "Reprovados", count: contadores.reprovadas },
    { id: "alerta", label: "Alertas", count: contadores.alertas },
  ];

  const handleVerLinha = (linhaId: string | number) => {
    onVerLinha?.(linhaId);
    onClose();
  };

  const handleEnviarCorrecao = async () => {
    if (linhasFiltradas.length === 0) return;

    setEnviandoCorrecao(true);
    try {
      const payload = buildCorrecaoAnalisePayload(resultado, {
        uploadId,
        nomeArquivo,
        dadosExtraidosPorId,
        filtro,
      });
      const resposta = (await enviarCorrecaoAnaliseIA(payload)) as CorrecaoAnaliseResposta;
      setRespostaCorrecao(resposta);
      toast.success(
        `Análise concluída. ${resposta.aprendizados_para_extracao.length} aprendizado(s) registrado(s) globalmente.`,
      );
    } catch (error) {
      const mensagem =
        error instanceof Error ? error.message : "Não foi possível enviar para correção.";
      toast.error(mensagem);
    } finally {
      setEnviandoCorrecao(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="analise-detalhes-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div>
            <h2 id="analise-detalhes-title" className="text-lg font-semibold text-slate-900">
              Detalhes da análise determinística
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Motivos de reprovação e alertas para aprimorar regras e extração.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Fechar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex gap-2 border-b border-slate-200 px-6 py-3">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFiltro(tab.id)}
              disabled={tab.id !== "todos" && tab.count === 0}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                filtro === tab.id
                  ? "bg-slate-900 text-white"
                  : tab.count === 0 && tab.id !== "todos"
                    ? "cursor-not-allowed text-slate-300"
                    : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {tab.label}
              <span className="ml-1.5 tabular-nums opacity-80">({tab.count})</span>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {respostaCorrecao ? (
            <CorrecaoIAResultado resposta={respostaCorrecao} />
          ) : null}

          {linhasFiltradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckEmptyState filtro={filtro} />
            </div>
          ) : (
            <div className={`space-y-4 ${respostaCorrecao ? "mt-6 border-t border-slate-200 pt-6" : ""}`}>
              {respostaCorrecao ? (
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Itens enviados
                </p>
              ) : null}
              {linhasFiltradas.map((linha) => (
                <DetalheLinhaCard
                  key={String(linha.linhaId)}
                  linha={linha}
                  onVerLinha={onVerLinha ? handleVerLinha : undefined}
                />
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 px-6 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              Modelo v{resultado.versaoModelo} · tolerância monetária R${" "}
              {resultado.contexto.toleranciaMonetaria.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
              })}
              {resultado.contexto.bdiGlobalPercent > 0
                ? ` · BDI global ${resultado.contexto.bdiGlobalPercent}%`
                : ""}
            </p>
            {linhasFiltradas.length > 0 ? (
              <button
                type="button"
                onClick={handleEnviarCorrecao}
                disabled={enviandoCorrecao}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {enviandoCorrecao ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                )}
                {enviandoCorrecao ? "Analisando com IA…" : "Enviar para correção"}
              </button>
            ) : null}
          </div>
          {linhasFiltradas.length > 0 && !respostaCorrecao ? (
            <p className="mt-2 text-xs text-slate-500">
              A correção com IA melhora a <strong>extração</strong> em PDFs processados depois. A
              análise desta tela usa regras determinísticas (v{resultado.versaoModelo}) e é
              recalculada automaticamente ao recarregar a página.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CorrecaoIAResultado({ resposta }: { resposta: CorrecaoAnaliseResposta }) {
  return (
    <div className="space-y-4 rounded-xl border border-violet-200 bg-violet-50/50 p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-violet-600" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-violet-900">Diagnóstico da IA</h3>
      </div>
      {resposta.diagnostico_geral ? (
        <p className="text-sm leading-relaxed text-slate-800">{resposta.diagnostico_geral}</p>
      ) : null}

      {resposta.itens.length > 0 ? (
        <ul className="space-y-3">
          {resposta.itens.map((item, index) => (
            <li
              key={`${item.item_numero ?? item.linha_id ?? index}`}
              className="rounded-lg border border-violet-100 bg-white px-3 py-2.5 text-sm"
            >
              <p className="font-medium text-slate-900">
                {item.item_numero ? `Item ${item.item_numero}` : `Linha ${item.linha_id}`}
                {item.tipo_problema ? (
                  <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-normal text-slate-600">
                    {item.tipo_problema}
                  </span>
                ) : null}
              </p>
              {item.causa_provavel ? (
                <p className="mt-1 text-slate-700">
                  <span className="font-medium">Causa: </span>
                  {item.causa_provavel}
                </p>
              ) : null}
              {item.correcao_sugerida ? (
                <p className="mt-1 text-slate-600">
                  <span className="font-medium">Correção: </span>
                  {item.correcao_sugerida}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {resposta.aprendizados_para_extracao.length > 0 ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-800">
            Aprendizados registrados ({resposta.aprendizados_para_extracao.length})
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {resposta.aprendizados_para_extracao.map((regra) => (
              <li key={regra}>{regra}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-violet-700">
            Essas regras foram salvas globalmente ({resposta.total_regras_globais ?? resposta.aprendizados_totais.length}{" "}
            no total) e serão aplicadas automaticamente em todas as extrações de tabelas.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function CheckEmptyState({ filtro }: { filtro: FiltroDetalhes }) {
  const mensagem =
    filtro === "reprovado"
      ? "Nenhuma linha reprovada nesta análise."
      : filtro === "alerta"
        ? "Nenhum alerta nesta análise."
        : "Nenhum reprovado ou alerta — todas as linhas analisáveis passaram.";

  return (
    <>
      <CheckCircleIcon />
      <p className="mt-3 text-sm text-slate-600">{mensagem}</p>
    </>
  );
}

function CheckCircleIcon() {
  return (
    <svg
      className="h-10 w-10 text-emerald-500"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

export type { FiltroDetalhes };
