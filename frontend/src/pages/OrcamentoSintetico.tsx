import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Download, FileSpreadsheet, LayoutList, Loader2 } from "lucide-react";
import {
  filtrarLinhasSintetico,
  calcularResumoSintetico,
} from "../features/orcamentos/orcamentoSintetico";
import { useOrcamentoLinhasLoader } from "../features/orcamentos/useOrcamentoLinhasLoader";
import { FULL_ORCAMENTO_EXPORT } from "../features/orcamentos/outputModels";
import ExportModal from "../components/ExportModal";
import { btnAccent, btnMuted } from "../components/ui/buttonClasses";

const formatMoney = (value: number) =>
  value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const OrcamentoSintetico: React.FC = () => {
  const navigate = useNavigate();
  const { status, linhas, uploadId, nomeProjeto } = useOrcamentoLinhasLoader();
  const [exportModalOpen, setExportModalOpen] = useState(false);

  const linhasSintetico = useMemo(() => filtrarLinhasSintetico(linhas), [linhas]);
  const resumo = useMemo(() => calcularResumoSintetico(linhasSintetico), [linhasSintetico]);

  if (status === "loading") {
    return (
      <div className="flex min-h-full flex-col items-center justify-center bg-slate-50 py-24">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <p className="mt-4 text-sm text-slate-600">Carregando resumo gerencial…</p>
      </div>
    );
  }

  if (status === "empty" || linhasSintetico.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <LayoutList className="mx-auto h-12 w-12 text-slate-400" />
        <h1 className="mt-4 text-xl font-semibold text-slate-900">Orçamento Sintético</h1>
        <p className="mt-2 text-sm text-slate-600">
          Processe um PDF na Curva ABC para gerar o resumo por grupos.
        </p>
        <Link to="/orcamento" className={`${btnAccent} mt-6 inline-flex`}>
          Ir para Curva ABC
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Orçamento Sintético</h1>
          <p className="mt-1 text-sm text-slate-600">
            Resumo gerencial — totais por grupo pai · {nomeProjeto}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {uploadId && (
            <button
              type="button"
              className={btnMuted}
              onClick={() => navigate(`/validacao/${uploadId}`)}
            >
              Ver validação
            </button>
          )}
          <button
            type="button"
            className={btnAccent}
            onClick={() => setExportModalOpen(true)}
          >
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Grupos</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{resumo.totalGrupos}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:col-span-2">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total geral</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">R$ {formatMoney(resumo.totalGeral)}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100">
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Item</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Descrição</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700">Valor Total C/ BDI</th>
              </tr>
            </thead>
            <tbody>
              {linhasSintetico.map((linha, index) => (
                <tr
                  key={`${linha.itemNumero}-${index}`}
                  className="border-b border-slate-100 bg-slate-200/60 font-bold text-slate-900"
                >
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums">{linha.itemNumero}</td>
                  <td className="px-4 py-3">{linha.descricao}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                    R$ {formatMoney(linha.valorTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-bold">
                <td colSpan={2} className="px-4 py-3 text-right text-slate-700">
                  Total geral
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-emerald-800">
                  R$ {formatMoney(resumo.totalGeral)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
        <FileSpreadsheet className="h-4 w-4" />
        Valores consolidados a partir dos itens filhos de cada grupo no Orçamento Analítico.
      </p>

      <ExportModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        uploadId={uploadId}
        nomeProjeto={nomeProjeto}
        linhas={linhas}
        defaultModelos={FULL_ORCAMENTO_EXPORT}
      />
    </div>
  );
};

export default OrcamentoSintetico;
