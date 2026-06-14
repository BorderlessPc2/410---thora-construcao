import React from "react";
import {
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Table2,
  XCircle,
} from "lucide-react";
import type { AbcAnalysisJob, AbcJobStatus } from "../../services/abcAnalysis";

type AbcAnalysisListProps = {
  items: AbcAnalysisJob[];
  onSelectAwaiting?: (item: AbcAnalysisJob) => void;
  onSelectCompleted?: (item: AbcAnalysisJob) => void;
  selectedUploadId?: string | null;
};

function statusLabel(item: AbcAnalysisJob): string {
  switch (item.status) {
    case "uploading":
      return "Enviando…";
    case "detecting":
      return "Detectando tabelas…";
    case "awaiting_selection":
      return item.tables_found
        ? `${item.tables_found} tabela(s) — clique para escolher`
        : "Aguardando seleção de tabela";
    case "queued":
      return item.queue_position
        ? `Na fila (#${item.queue_position})`
        : "Na fila";
    case "processing":
      return item.message ?? "Análise em segundo plano — IA montando Curva ABC…";
    case "completed":
      return item.items_found
        ? `Concluído — ${item.items_found} item(ns). Clique para revisar PDF e dados.`
        : "Concluído — clique para revisar PDF e dados";
    case "failed":
      return item.error ?? item.message ?? "Falhou";
    default:
      return item.message ?? "";
  }
}

function StatusIcon({ status }: { status: AbcJobStatus }) {
  if (status === "completed") {
    return <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />;
  }
  if (status === "failed") {
    return <XCircle className="h-5 w-5 shrink-0 text-red-500" aria-hidden="true" />;
  }
  if (status === "awaiting_selection") {
    return <Table2 className="h-5 w-5 shrink-0 text-violet-600" aria-hidden="true" />;
  }
  if (status === "queued") {
    return <Clock className="h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />;
  }
  if (status === "uploading" || status === "detecting" || status === "processing") {
    return <Loader2 className="h-5 w-5 shrink-0 animate-spin text-blue-600" aria-hidden="true" />;
  }
  return <FileText className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />;
}

export function AbcAnalysisList({
  items: itemsProp,
  onSelectAwaiting,
  onSelectCompleted,
  selectedUploadId,
}: AbcAnalysisListProps) {
  const items = itemsProp ?? [];

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center">
        <FileText className="mx-auto h-10 w-10 text-slate-300" aria-hidden="true" />
        <p className="mt-3 text-sm text-slate-500">Nenhuma análise ainda.</p>
        <p className="mt-1 text-xs text-slate-400">
          Envie um ou mais PDFs na Curva ABC. Análises em segundo plano e concluídas ficam salvas
          aqui para você abrir quando quiser.
        </p>
      </div>
    );
  }

  const completedCount = items.filter((i) => i.status === "completed").length;
  const activeCount = items.filter((i) =>
    ["uploading", "detecting", "queued", "processing"].includes(i.status),
  ).length;
  const awaitingCount = items.filter((i) => i.status === "awaiting_selection").length;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-900">Suas análises</h2>
        <p className="mt-1 text-sm text-slate-500">
          {items.length} análise(s) salva(s)
          {completedCount > 0 ? ` · ${completedCount} concluída(s)` : ""}
          {activeCount > 0 ? ` · ${activeCount} em segundo plano` : ""}
          {awaitingCount > 0 ? ` · ${awaitingCount} aguardando tabela` : ""}
        </p>
      </div>

      <ul className="divide-y divide-slate-100">
        {items.map((item) => {
          const isAwaiting = item.status === "awaiting_selection";
          const isCompleted = item.status === "completed";
          const isProcessing = ["uploading", "detecting", "queued", "processing"].includes(
            item.status,
          );
          const isClickable =
            (isAwaiting && Boolean(onSelectAwaiting)) ||
            (isCompleted && Boolean(onSelectCompleted));
          const isSelected = selectedUploadId === item.upload_id;

          return (
            <li key={item.upload_id}>
              <button
                type="button"
                disabled={!isClickable}
                onClick={() => {
                  if (isAwaiting) onSelectAwaiting?.(item);
                  if (isCompleted) onSelectCompleted?.(item);
                }}
                className={`flex w-full items-start gap-4 px-5 py-4 text-left transition ${
                  isClickable ? "cursor-pointer hover:bg-slate-50" : "cursor-default"
                } ${isSelected ? "bg-blue-50" : ""}`}
              >
                <StatusIcon status={item.status} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium text-slate-900">{item.filename}</p>
                    {isProcessing ? (
                      <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
                        Em andamento
                      </span>
                    ) : null}
                    {isCompleted ? (
                      <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                        Salvo
                      </span>
                    ) : null}
                  </div>
                  <p
                    className={`mt-0.5 text-sm ${
                      item.status === "failed" ? "text-red-600" : "text-slate-500"
                    }`}
                  >
                    {statusLabel(item)}
                  </p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
