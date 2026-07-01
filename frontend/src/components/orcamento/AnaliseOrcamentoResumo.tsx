import { useState } from "react";
import { ListChecks } from "lucide-react";
import type { ResultadoAnaliseOrcamento } from "../../features/orcamentos/analiseOrcamento";
import type { DadosExtraidosLinha } from "../../features/orcamentos/analiseOrcamento/correcaoAnalise";
import {
  AnaliseOrcamentoDetalhesModal,
  type FiltroDetalhes,
} from "./AnaliseOrcamentoDetalhesModal";

type AnaliseOrcamentoResumoProps = {
  resultado: ResultadoAnaliseOrcamento;
  uploadId?: string;
  nomeArquivo?: string;
  dadosExtraidosPorId?: Map<string | number, DadosExtraidosLinha>;
  onVerLinha?: (linhaId: string | number) => void;
};

export function AnaliseOrcamentoResumo({
  resultado,
  uploadId,
  nomeArquivo,
  dadosExtraidosPorId,
  onVerLinha,
}: AnaliseOrcamentoResumoProps) {
  const { resumo } = resultado;
  const [modalOpen, setModalOpen] = useState(false);
  const [filtroInicial, setFiltroInicial] = useState<FiltroDetalhes>("todos");

  const temProblemas = resumo.reprovadas > 0 || resumo.comAlerta > 0;

  const abrirModal = (filtro: FiltroDetalhes) => {
    setFiltroInicial(filtro);
    setModalOpen(true);
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Aprovadas</p>
          <p className="text-xl font-semibold text-emerald-900">{resumo.aprovadas}</p>
        </div>
        <button
          type="button"
          onClick={() => resumo.comAlerta > 0 && abrirModal("alerta")}
          disabled={resumo.comAlerta === 0}
          className={`rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-left transition ${
            resumo.comAlerta > 0
              ? "cursor-pointer hover:border-amber-300 hover:bg-amber-100/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
              : "cursor-default"
          }`}
          title={resumo.comAlerta > 0 ? "Clique para ver os alertas" : undefined}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-amber-700">Alertas</p>
          <p className="text-xl font-semibold text-amber-900">{resumo.comAlerta}</p>
        </button>
        <button
          type="button"
          onClick={() => resumo.reprovadas > 0 && abrirModal("reprovado")}
          disabled={resumo.reprovadas === 0}
          className={`rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-left transition ${
            resumo.reprovadas > 0
              ? "cursor-pointer hover:border-red-300 hover:bg-red-100/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
              : "cursor-default"
          }`}
          title={resumo.reprovadas > 0 ? "Clique para ver os reprovados" : undefined}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-red-700">Reprovadas</p>
          <p className="text-xl font-semibold text-red-900">{resumo.reprovadas}</p>
        </button>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-600">Ignoradas</p>
          <p className="text-xl font-semibold text-slate-900">{resumo.linhasIgnoradas}</p>
        </div>
      </div>

      {temProblemas ? (
        <button
          type="button"
          onClick={() => abrirModal("todos")}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
        >
          <ListChecks className="h-4 w-4" aria-hidden="true" />
          Ver reprovados e alertas ({resumo.reprovadas + resumo.comAlerta})
        </button>
      ) : null}

      <AnaliseOrcamentoDetalhesModal
        open={modalOpen}
        resultado={resultado}
        filtroInicial={filtroInicial}
        uploadId={uploadId}
        nomeArquivo={nomeArquivo}
        dadosExtraidosPorId={dadosExtraidosPorId}
        onClose={() => setModalOpen(false)}
        onVerLinha={onVerLinha}
      />
    </>
  );
}
