import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Download,
  FileText,
  BarChart3,
  Clock,
  Trash2,
  Eye,
  Plus,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import jsPDF from "jspdf";
import { listOrcamentos, getCurvaABC } from "../services/api";
import ConfirmDialog from "../components/ConfirmDialog";
import { btnAccent, btnSecondary } from "../components/ui/buttonClasses";

interface Report {
  id: string;
  name: string;
  type: "budget" | "curva-abc" | "comparison" | "financial";
  createdAt: string;
  orcamentoName: string;
  size: string;
  uploadId?: string;           // present for real uploads
  itemsFound?: number;
  hasReviewedItems?: boolean;
  hasAIAnalysis?: boolean;
}

const MOCK_REPORTS: Report[] = [];

const Reports: React.FC = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>(MOCK_REPORTS);
  const [filter, setFilter] = useState<string>("all");
  const [loadingReports, setLoadingReports] = useState(true);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [deleteReportId, setDeleteReportId] = useState<string | null>(null);

  // ── Load real uploads from backend on mount ─────────────────────────────
  useEffect(() => {
    const fetchReports = async () => {
      try {
        const data = await listOrcamentos();
        const realReports: Report[] = (data.orcamentos || []).map(
          (o: any, i: number) => ({
            id: o.uploadId || String(i),
            name: o.filename || o.uploadId || `Orçamento ${i + 1}`,
            type: "budget" as const,
            createdAt: o.uploadedAt
              ? new Date(o.uploadedAt).toLocaleString("pt-BR")
              : "—",
            orcamentoName: o.filename || o.uploadId || "—",
            size: `${o.itemsFound ?? "?"} itens`,
            uploadId: o.uploadId,
            itemsFound: o.itemsFound,
            hasReviewedItems: o.hasReviewedItems,
            hasAIAnalysis: o.hasAIAnalysis,
          }),
        );
        setReports(realReports);
      } catch (err) {
        console.error("Erro ao carregar orçamentos:", err);
        setReports([]);
      } finally {
        setLoadingReports(false);
      }
    };
    fetchReports();
  }, []);

  const filteredReports = reports.filter((r) =>
    filter === "all" ? true : r.type === filter
  );

  // ── Generate PDF ─────────────────────────────────────────────────────────
  const handleGenerateReport = async (report: Report) => {
    setGeneratingId(report.id);
    try {
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;

      // Header bar
      pdf.setFillColor(31, 78, 120);
      pdf.rect(0, 0, pageWidth, 30, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(20);
      pdf.text("Thora Construction", margin, 20);

      // Title
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(14);
      pdf.text(report.name, margin, 45);

      pdf.setFontSize(10);
      pdf.text(`Arquivo: ${report.orcamentoName}`, margin, 56);
      pdf.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, margin, 64);

      let yPos = 78;

      if (report.uploadId) {
        // ── Real report ────────────────────────────────────────────────────
        const curvaData = await getCurvaABC(report.uploadId);
        const items: any[] = curvaData?.items || [];

        const totalValue = items.reduce(
          (s: number, i: any) => s + Number(i.valor_total || 0),
          0,
        );
        const classA = items.filter((i) => i.classification === "A");
        const classB = items.filter((i) => i.classification === "B");
        const classC = items.filter((i) => i.classification === "C");

        // Summary section
        pdf.setFontSize(12);
        pdf.setFont(undefined as any, "bold");
        pdf.text("Resumo do Orçamento", margin, yPos);
        pdf.setFont(undefined as any, "normal");
        pdf.setFontSize(10);
        yPos += 10;

        const summaryLines = [
          `Total do Orçamento: R$ ${totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
          `Total de Itens: ${items.length}`,
          `Classe A: ${classA.length} itens (alto valor)`,
          `Classe B: ${classB.length} itens (médio valor)`,
          `Classe C: ${classC.length} itens (baixo valor)`,
          report.hasReviewedItems
            ? "✓ Itens com revisão manual aplicada"
            : "Itens extraídos automaticamente (sem revisão manual)",
        ];
        summaryLines.forEach((line) => {
          pdf.text(`• ${line}`, margin + 5, yPos);
          yPos += 8;
        });

        // Items table
        yPos += 8;
        pdf.setFontSize(12);
        pdf.setFont(undefined as any, "bold");
        pdf.text("Lista de Itens", margin, yPos);
        yPos += 8;

        // Table header
        pdf.setFontSize(8);
        pdf.setFillColor(240, 244, 248);
        pdf.rect(margin, yPos, pageWidth - 2 * margin, 7, "F");
        pdf.setFont(undefined as any, "bold");
        pdf.text("#", margin + 2, yPos + 5);
        pdf.text("Descrição", margin + 10, yPos + 5);
        pdf.text("Qtd", margin + 100, yPos + 5);
        pdf.text("Un", margin + 118, yPos + 5);
        pdf.text("V. Unit", margin + 130, yPos + 5);
        pdf.text("V. Total", margin + 153, yPos + 5);
        pdf.text("ABC", margin + 173, yPos + 5);
        yPos += 9;

        pdf.setFont(undefined as any, "normal");
        items.slice(0, 60).forEach((item: any, idx: number) => {
          if (yPos > pageHeight - 20) {
            pdf.addPage();
            yPos = margin;
          }
          if (idx % 2 === 0) {
            pdf.setFillColor(249, 250, 251);
            pdf.rect(margin, yPos - 1, pageWidth - 2 * margin, 6.5, "F");
          }
          const desc = String(item.descricao || "").substring(0, 45);
          const qty = Number(item.quantidade || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
          const unit = String(item.unidade || "un");
          const vUnit = Number(item.valor_unitario || 0).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          });
          const vTotal = Number(item.valor_total || 0).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          });
          pdf.setFontSize(7.5);
          pdf.text(String(idx + 1), margin + 2, yPos + 4);
          pdf.text(desc, margin + 10, yPos + 4);
          pdf.text(qty, margin + 100, yPos + 4);
          pdf.text(unit, margin + 118, yPos + 4);
          pdf.text(vUnit, margin + 130, yPos + 4);
          pdf.text(vTotal, margin + 153, yPos + 4);
          pdf.text(item.classification || "—", margin + 173, yPos + 4);
          yPos += 7;
        });

        if (items.length > 60) {
          pdf.setFontSize(8);
          pdf.setTextColor(120, 120, 120);
          pdf.text(
            `... e mais ${items.length - 60} itens (exporte XLSX para lista completa)`,
            margin,
            yPos + 5,
          );
          pdf.setTextColor(0, 0, 0);
        }
      } else {
        // ── Fallback: static report ────────────────────────────────────────
        pdf.setFontSize(12);
        pdf.setFont(undefined as any, "bold");
        pdf.text("Resumo Executivo", margin, yPos);
        pdf.setFontSize(10);
        pdf.setFont(undefined as any, "normal");
        yPos += 12;
        pdf.text("Nenhum dado real disponível para este relatório.", margin, yPos);
      }

      // Footer
      pdf.setFontSize(8);
      pdf.setTextColor(128, 128, 128);
      pdf.text(
        `Gerado em ${new Date().toLocaleString("pt-BR")} · Thora Construction`,
        margin,
        pageHeight - 10,
      );

      pdf.save(`${report.name.replace(/\s+/g, "_")}.pdf`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Erro ao gerar PDF", { description: msg });
    } finally {
      setGeneratingId(null);
    }
  };

  const confirmRemoveFromList = () => {
    if (deleteReportId == null) return;
    setReports((prev) => prev.filter((r) => r.id !== deleteReportId));
    setDeleteReportId(null);
    toast.success("Removido da lista local", {
      description: "O arquivo no servidor não foi apagado.",
    });
  };

  return (
    <div className="flex min-h-full flex-col bg-slate-50 pb-16">
      <ConfirmDialog
        open={deleteReportId !== null}
        title="Remover da lista?"
        description="O orçamento continua salvo; apenas some desta visualização até a próxima atualização."
        confirmLabel="Remover"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={confirmRemoveFromList}
        onCancel={() => setDeleteReportId(null)}
      />

      <header className="border-b border-slate-200 bg-white px-4 py-5 shadow-sm sm:px-8 sm:py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Relatórios
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              PDFs gerados com os dados reais dos orçamentos enviados
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/orcamento")}
            className={`${btnAccent} shrink-0`}
          >
            <Plus className="h-5 w-5" />
            Novo Orçamento
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-8">
        {/* Filtros */}
        <div className="mb-8 flex gap-3 flex-wrap">
          {[
            { value: "all", label: "Todos" },
            { value: "budget", label: "Orçamentos" },
          ].map((f) => (
            <button
              type="button"
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                filter === f.value
                  ? "bg-blue-600 text-white shadow-sm"
                  : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Loading skeleton */}
        {loadingReports ? (
          <div className="flex items-center justify-center h-48 gap-3 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>Carregando orçamentos…</span>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-96 text-center">
            <FileText className="w-16 h-16 text-slate-300 mb-4" />
            <p className="text-slate-600 text-lg font-medium">
              Nenhum orçamento encontrado
            </p>
            <p className="text-slate-500 text-sm mt-1">
              Envie um PDF na aba{" "}
              <button
                type="button"
                className="font-medium text-blue-600 underline-offset-2 hover:underline"
                onClick={() => navigate("/orcamento")}
              >
                Novo Orçamento
              </button>{" "}
              para gerar relatórios reais.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredReports.map((report) => {
              const isGenerating = generatingId === report.id;
              return (
                <div
                  key={report.id}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3
                        className="text-base font-semibold text-slate-900 mb-1 truncate"
                        title={report.name}
                      >
                        {report.name}
                      </h3>
                      {/* Status badges */}
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Orçamento
                        </span>
                        {report.hasReviewedItems && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle2 className="w-3 h-3" />
                            Revisado
                          </span>
                        )}
                        {report.hasAIAnalysis && (
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            Análise IA
                          </span>
                        )}
                      </div>
                    </div>
                    <FileText className="w-8 h-8 text-slate-300 ml-3 flex-shrink-0" />
                  </div>

                  <div className="space-y-1.5 mb-5 text-sm text-slate-600">
                    <p className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{report.orcamentoName}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <Clock className="w-4 h-4 flex-shrink-0" />
                      {report.createdAt}
                    </p>
                    {report.itemsFound !== undefined && (
                      <p className="text-slate-400 text-xs pl-6">
                        {report.itemsFound} itens extraídos
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={isGenerating}
                      onClick={() => handleGenerateReport(report)}
                      className={`${btnAccent} min-h-[2.5rem] flex-1 py-2 text-sm disabled:opacity-60`}
                    >
                      {isGenerating ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      {isGenerating ? "Gerando…" : "Baixar PDF"}
                    </button>
                    {report.uploadId && (
                      <button
                        type="button"
                        onClick={() =>
                          navigate(`/analise-detalhada/${report.uploadId}`)
                        }
                        className={`${btnSecondary} min-h-[2.5rem] flex-1 py-2 text-sm`}
                      >
                        <Eye className="w-4 h-4" />
                        Ver análise
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setDeleteReportId(report.id)}
                      className="inline-flex min-h-[2.5rem] items-center justify-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-red-700 transition hover:bg-red-100"
                      title="Remover da lista"
                      aria-label="Remover relatório da lista"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default Reports;
