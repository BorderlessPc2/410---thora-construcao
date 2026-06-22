import React, { useRef, useState } from "react";
import { toast } from "sonner";
import {
  TrendingUp,
  DollarSign,
  BarChart3,
  PieChart,
  Download,
  Filter,
  RefreshCw,
} from "lucide-react";
import {
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import type { Orcamento } from "../features/orcamentos/orcamentoTypes";
import {
  buildAbcDistribution,
  buildMonthlyBudgetSeries,
  CHART_COLORS,
  formatCurrency,
  formatCurrencyK,
  getOrcamentoTotal,
} from "../features/orcamentos/orcamentoAnalytics";

interface OrcamentoAnalyticsChartsProps {
  orcamentos: Orcamento[];
  loading: boolean;
  onRefresh?: () => void;
  title?: string;
  subtitle?: string;
  sectionClassName?: string;
}

const OrcamentoAnalyticsCharts: React.FC<OrcamentoAnalyticsChartsProps> = ({
  orcamentos,
  loading,
  onRefresh,
  title = "Análise dos orçamentos",
  subtitle = "Dados consolidados dos orçamentos exportados e finalizados",
  sectionClassName = "mt-10",
}) => {
  const [dateRange, setDateRange] = useState("30days");
  const [isExporting, setIsExporting] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);

  const completed = orcamentos.filter((o) => o.status === "completed");
  const totals = {
    totalBudget: completed.reduce((s, o) => s + getOrcamentoTotal(o), 0),
    totalItems: completed.reduce((s, o) => s + (o.itemsFound ?? 0), 0),
  };

  const monthlyData = buildMonthlyBudgetSeries(completed);
  const abcData = buildAbcDistribution(completed);

  const kpis = [
    {
      label: "Orçamento Total",
      value: loading ? "—" : formatCurrency(totals.totalBudget),
      icon: <DollarSign className="h-6 w-6" />,
      color: "bg-blue-500",
    },
    {
      label: "Orçamentos analisados",
      value: loading ? "—" : String(completed.length),
      icon: <TrendingUp className="h-6 w-6" />,
      color: "bg-green-500",
    },
    {
      label: "Itens (total)",
      value: loading ? "—" : String(totals.totalItems),
      icon: <BarChart3 className="h-6 w-6" />,
      color: "bg-purple-500",
    },
    {
      label: "Média por orçamento",
      value:
        loading || completed.length === 0
          ? "—"
          : formatCurrency(totals.totalBudget / completed.length),
      icon: <PieChart className="h-6 w-6" />,
      color: "bg-orange-500",
    },
  ];

  const handleExportDashboard = async () => {
    if (!dashboardRef.current) return;
    try {
      setIsExporting(true);
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;

      pdf.setFontSize(20);
      pdf.setFont("helvetica", "bold");
      pdf.text("Dashboard — Thora", margin, margin + 10);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Data: ${new Date().toLocaleDateString("pt-BR")}`, margin, margin + 18);

      let yPosition = margin + 35;
      const blocks = dashboardRef.current.querySelectorAll(".chart-card, .kpi-card");

      for (let i = 0; i < blocks.length; i++) {
        const element = blocks[i] as HTMLElement;
        const canvas = await html2canvas(element, {
          scale: 2,
          backgroundColor: "#ffffff",
          logging: false,
        });
        const imgData = canvas.toDataURL("image/png");
        const imgWidth = pageWidth - 2 * margin;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        if (yPosition + imgHeight > pageHeight - margin) {
          pdf.addPage();
          yPosition = margin;
        }
        pdf.addImage(imgData, "PNG", margin, yPosition, imgWidth, imgHeight);
        yPosition += imgHeight + 12;
      }

      pdf.save(`Dashboard-Thora-${new Date().toISOString().split("T")[0]}.pdf`);
      toast.success("Dashboard exportado em PDF");
    } catch {
      toast.error("Não foi possível exportar o dashboard");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <section className={sectionClassName}>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">{title}</h2>
          <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Filter className="h-4 w-4" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="7days">Últimos 7 dias</option>
              <option value="30days">Últimos 30 dias</option>
              <option value="90days">Últimos 90 dias</option>
              <option value="all">Todo período</option>
            </select>
          </div>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </button>
          )}
          <button
            type="button"
            onClick={() => void handleExportDashboard()}
            disabled={isExporting || loading || completed.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            <Download className={`h-4 w-4 ${isExporting ? "animate-bounce" : ""}`} />
            {isExporting ? "Exportando…" : "Exportar PDF"}
          </button>
        </div>
      </div>

      <div ref={dashboardRef}>
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {kpis.map((kpi, idx) => (
            <div
              key={idx}
              className="kpi-card rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className={`${kpi.color} mb-4 inline-flex rounded-lg p-3 text-white`}>
                {kpi.icon}
              </div>
              <p className="text-sm text-slate-600">{kpi.label}</p>
              <p className="text-2xl font-bold text-slate-900">{kpi.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="chart-card rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">
              Evolução mensal (valor total)
            </h3>
            {completed.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-500">
                Finalize orçamentos para ver a evolução.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={monthlyData}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2E7AD4" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#2E7AD4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" tickFormatter={(v) => formatCurrencyK(v)} />
                  <Tooltip formatter={(v) => formatCurrencyK(v)} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#2E7AD4"
                    fill="url(#colorValue)"
                    name="Valor exportado"
                  />
                  <Line
                    type="monotone"
                    dataKey="planned"
                    stroke="#f59e0b"
                    strokeDasharray="5 5"
                    name="Referência"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="chart-card rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">
              Curva ABC (valor por classe)
            </h3>
            {abcData.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-500">
                Valide orçamentos para gerar classificação ABC nos gráficos.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <RechartsPieChart>
                  <Pie
                    data={abcData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => {
                      const pct = percent ? Math.round(percent * 100) : 0;
                      return `${name ?? ""} ${pct}%`;
                    }}
                    outerRadius={90}
                    dataKey="value"
                  >
                    {abcData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatCurrencyK(v)} />
                </RechartsPieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="chart-card rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">
              Orçamentos por valor total
            </h3>
            {completed.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-500">
                Nenhum orçamento finalizado ainda.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={completed.slice(0, 8).map((o) => ({
                    name: (o.filename || o.uploadId).slice(0, 18),
                    value: getOrcamentoTotal(o),
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" tickFormatter={(v) => formatCurrencyK(v)} />
                  <Tooltip formatter={(v) => formatCurrencyK(v)} />
                  <Bar dataKey="value" fill="#1F4E78" name="Valor (R$)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default OrcamentoAnalyticsCharts;
