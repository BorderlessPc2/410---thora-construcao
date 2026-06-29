import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  FileSpreadsheet,
  FileText,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../features/auth/AuthContext";
import { listOrcamentosByUserId } from "../features/orcamentos/orcamentoRepository";
import type { Orcamento } from "../features/orcamentos/orcamentoTypes";
import {
  exportOrcamentoExcel,
  resolveExportItems,
} from "../features/orcamentos/exportOrcamento";
import type { LinhaAnalitica } from "../features/orcamentos/orcamentoAnalitico";
import type { OutputModelsSelection } from "../features/orcamentos/outputModels";
import { CURVA_ABC_ONLY } from "../features/orcamentos/outputModels";
import {
  exportToPDF,
  LIVRE_EXPORT_COLUMNS,
} from "../services/api";
import { btnAccent, btnSecondary } from "./ui/buttonClasses";

export type ExportModalProps = {
  open: boolean;
  onClose: () => void;
  uploadId?: string;
  nomeProjeto?: string;
  linhas?: LinhaAnalitica[];
  hierarchicalItems?: unknown[];
  flatItems?: unknown[];
  defaultModelos?: OutputModelsSelection;
};

type TabId = "excel" | "pdf";
type ExcelTemplate = "novacap" | "sinapi" | "livre";

const ExportModal: React.FC<ExportModalProps> = ({
  open,
  onClose,
  uploadId,
  nomeProjeto,
  linhas,
  hierarchicalItems,
  flatItems,
  defaultModelos = CURVA_ABC_ONLY,
}) => {
  const { user } = useAuth();
  const [tab, setTab] = useState<TabId>("excel");
  const [loading, setLoading] = useState(false);

  const [excelTemplate, setExcelTemplate] = useState<ExcelTemplate>("novacap");
  const [livreColumns, setLivreColumns] = useState<string[]>([
    "descricao",
    "unidade",
    "quantidade",
    "precoUnitario",
    "precoTotal",
  ]);
  const [includeCompare, setIncludeCompare] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);

  const [includeCover, setIncludeCover] = useState(true);
  const [includeSummary, setIncludeSummary] = useState(true);
  const [includeAbcChart, setIncludeAbcChart] = useState(true);
  const [companyName, setCompanyName] = useState("");
  const [responsible, setResponsible] = useState("");
  const [logoBase64, setLogoBase64] = useState<string | null>(null);

  const exportItems = useMemo(
    () => resolveExportItems({ linhas, hierarchicalItems, flatItems }),
    [linhas, hierarchicalItems, flatItems],
  );

  const pdfPreviewName = useMemo(() => {
    const safe = (nomeProjeto || "orcamento")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "_")
      .slice(0, 30) || "orcamento";
    return `orcamento_${safe}_${new Date().toISOString().split("T")[0]}.pdf`;
  }, [nomeProjeto]);

  useEffect(() => {
    if (!open || !user?.uid) return;
    void listOrcamentosByUserId(user.uid)
      .then(setOrcamentos)
      .catch(() => setOrcamentos([]));
  }, [open, user?.uid]);

  const toggleCompareId = (id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  };

  const toggleLivreColumn = (colId: string) => {
    setLivreColumns((prev) =>
      prev.includes(colId) ? prev.filter((c) => c !== colId) : [...prev, colId],
    );
  };

  const moveLivreColumn = (index: number, direction: -1 | 1) => {
    setLivreColumns((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      toast.error("Logo deve ter no máximo 500KB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setLogoBase64(typeof reader.result === "string" ? reader.result : null);
    };
    reader.readAsDataURL(file);
  };

  const handleExportExcel = useCallback(async () => {
    if (exportItems.length === 0) {
      toast.warning("Nada para exportar");
      return;
    }
    if (includeCompare && compareIds.length < 2) {
      toast.warning("Selecione pelo menos 2 orçamentos para o comparativo");
      return;
    }
    if (excelTemplate === "livre" && livreColumns.length === 0) {
      toast.warning("Selecione ao menos uma coluna");
      return;
    }

    setLoading(true);
    try {
      await exportOrcamentoExcel({
        linhas,
        hierarchicalItems,
        flatItems,
        modelosSelecionados: defaultModelos,
        nomeProjeto,
        template: excelTemplate,
        colunas: excelTemplate === "livre" ? livreColumns : undefined,
        compareIds: includeCompare ? compareIds : undefined,
      });
      toast.success("Export gerado com sucesso!");
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao exportar";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [
    compareIds,
    defaultModelos,
    excelTemplate,
    exportItems.length,
    flatItems,
    hierarchicalItems,
    includeCompare,
    linhas,
    livreColumns,
    nomeProjeto,
    onClose,
  ]);

  const handleExportPdf = useCallback(async () => {
    if (!uploadId) {
      toast.error("upload_id não disponível para exportar PDF");
      return;
    }
    setLoading(true);
    try {
      await exportToPDF({
        upload_id: uploadId,
        include_cover: includeCover,
        include_summary: includeSummary,
        include_abc_chart: includeAbcChart,
        company_name: companyName || undefined,
        responsible: responsible || undefined,
        logo_base64: logoBase64 || undefined,
      });
      toast.success("Export gerado com sucesso!");
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao exportar PDF";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [
    companyName,
    includeAbcChart,
    includeCover,
    includeSummary,
    logoBase64,
    onClose,
    responsible,
    uploadId,
  ]);

  if (!open) return null;

  const completedOrcamentos = orcamentos.filter((o) => o.status === "completed");

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 id="export-modal-title" className="text-lg font-semibold text-slate-900">
            Exportar orçamento
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex border-b border-slate-200 px-6">
          <button
            type="button"
            onClick={() => setTab("excel")}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition ${
              tab === "excel"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Excel
          </button>
          <button
            type="button"
            onClick={() => setTab("pdf")}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition ${
              tab === "pdf"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <FileText className="h-4 w-4" />
            PDF
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === "excel" ? (
            <div className="space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Template
                </label>
                <select
                  value={excelTemplate}
                  onChange={(e) => setExcelTemplate(e.target.value as ExcelTemplate)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="novacap">NOVACAP (padrão)</option>
                  <option value="sinapi">SINAPI</option>
                  <option value="livre">Personalizado</option>
                </select>
              </div>

              {excelTemplate === "livre" && (
                <div>
                  <p className="mb-2 text-sm font-medium text-slate-700">Colunas</p>
                  <div className="space-y-2 rounded-xl border border-slate-200 p-3">
                    {livreColumns.map((colId, index) => {
                      const meta = LIVRE_EXPORT_COLUMNS.find((c) => c.id === colId);
                      return (
                        <div
                          key={colId}
                          className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2"
                        >
                          <span className="text-sm text-slate-800">
                            {meta?.label ?? colId}
                          </span>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => moveLivreColumn(index, -1)}
                              className="rounded p-1 hover:bg-slate-200"
                              aria-label="Mover para cima"
                            >
                              <ArrowUp className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveLivreColumn(index, 1)}
                              className="rounded p-1 hover:bg-slate-200"
                              aria-label="Mover para baixo"
                            >
                              <ArrowDown className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    <div className="flex flex-wrap gap-2 pt-2">
                      {LIVRE_EXPORT_COLUMNS.filter((c) => !livreColumns.includes(c.id)).map(
                        (col) => (
                          <button
                            key={col.id}
                            type="button"
                            onClick={() => toggleLivreColumn(col.id)}
                            className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
                          >
                            + {col.label}
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                </div>
              )}

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={includeCompare}
                  onChange={(e) => setIncludeCompare(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600"
                />
                Incluir comparativo
              </label>

              {includeCompare && (
                <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 p-3">
                  {completedOrcamentos.length === 0 ? (
                    <p className="text-sm text-slate-500">Nenhum orçamento finalizado.</p>
                  ) : (
                    completedOrcamentos.map((o) => (
                      <label
                        key={o.uploadId}
                        className="flex cursor-pointer items-center gap-2 py-1.5 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={compareIds.includes(o.uploadId)}
                          disabled={
                            !compareIds.includes(o.uploadId) && compareIds.length >= 3
                          }
                          onChange={() => toggleCompareId(o.uploadId)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600"
                        />
                        <span className="truncate">
                          {o.nomeProjeto || o.filename || o.uploadId}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={includeCover}
                  onChange={(e) => setIncludeCover(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600"
                />
                Incluir capa
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={includeSummary}
                  onChange={(e) => setIncludeSummary(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600"
                />
                Incluir sumário executivo
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={includeAbcChart}
                  onChange={(e) => setIncludeAbcChart(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600"
                />
                Incluir gráfico Curva ABC
              </label>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Nome da empresa
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Opcional"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Responsável técnico
                </label>
                <input
                  type="text"
                  value={responsible}
                  onChange={(e) => setResponsible(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Opcional"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Logo (máx. 500KB)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="w-full text-sm text-slate-600"
                />
              </div>
              <p className="text-xs text-slate-500">
                Arquivo: <span className="font-mono">{pdfPreviewName}</span>
              </p>
              {!uploadId && (
                <p className="text-sm text-amber-700">
                  PDF requer um orçamento salvo (upload_id).
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button type="button" onClick={onClose} className={btnSecondary} disabled={loading}>
            Cancelar
          </button>
          {tab === "excel" ? (
            <button
              type="button"
              onClick={() => void handleExportExcel()}
              disabled={loading || exportItems.length === 0}
              className={btnAccent}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Exportando…
                </>
              ) : (
                <>
                  <FileSpreadsheet className="h-4 w-4" />
                  Exportar Excel
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleExportPdf()}
              disabled={loading || !uploadId}
              className={btnAccent}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Gerando PDF…
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" />
                  Exportar PDF
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExportModal;
