import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  TrendingUp,
  DollarSign,
  BarChart3,
  PieChart,
  Calendar,
  Filter,
  Download,
  RefreshCw,
} from "lucide-react";
import {
  LineChart,
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
import { useAuth } from "../features/auth/AuthContext";
import { listOrcamentosByUserId } from "../features/orcamentos/orcamentoRepository";
import type { Orcamento, OrcamentoItem } from "../features/orcamentos/orcamentoTypes";

interface KPI {
  label: string;
  value: string;
  change: number;
  icon: React.ReactNode;
  color: string;
}

const Analytics: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState("30days");
  const [selectedMetric, setSelectedMetric] = useState("all");
  const [isExporting, setIsExporting] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [loading, setLoading] = useState(true);

  const formatCurrencyK = (
    value: number | string | ReadonlyArray<number | string> | undefined,
  ) => {
    const raw = Array.isArray(value) ? value[0] : value;
    const num = typeof raw === "number" ? raw : raw ? Number(raw) : 0;
    if (Number.isNaN(num)) {
      return "R$ 0k";
    }
    return `R$ ${(num / 1000).toFixed(0)}k`;
  };

  const getItemTotal = (item: OrcamentoItem): number => {
    const total =
      typeof item.valor_total === "number"
        ? item.valor_total
        : typeof item.totalValue === "number"
          ? item.totalValue
          : 0;
    return Number.isFinite(total) ? total : 0;
  };

  const getOrcamentoTotal = (orcamento: Orcamento): number => {
    if (!Array.isArray(orcamento.items)) return 0;
    return orcamento.items.reduce((sum, item) => sum + getItemTotal(item), 0);
  };

  useEffect(() => {
    const run = async () => {
      if (!user?.uid) return;
      setLoading(true);
      try {
        const data = await listOrcamentosByUserId(user.uid);
        setOrcamentos(data);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [user?.uid]);

  const totals = useMemo(() => {
    const totalBudget = orcamentos.reduce((sum, o) => sum + getOrcamentoTotal(o), 0);
    const totalItems = orcamentos.reduce((sum, o) => sum + (o.itemsFound ?? 0), 0);
    return { totalBudget, totalItems };
  }, [orcamentos]);

  const monthlyDataItems = useMemo(() => {
    // Agrupar por mês (últimos 6 meses) baseado em uploadedAt e soma do total do orçamento
    const now = new Date();
    const months: { key: string; label: string; start: Date; end: Date }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      const label = start.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
      const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
      months.push({ key, label: label.charAt(0).toUpperCase() + label.slice(1), start, end });
    }

    return months.map((m) => {
      const value = orcamentos
        .filter((o) => o.uploadedAt >= m.start && o.uploadedAt <= m.end)
        .reduce((sum, o) => sum + getOrcamentoTotal(o), 0);

      return { month: m.label, value, planned: value };
    });
  }, [orcamentos]);

  const categoryData = useMemo(() => {
    // Ainda não temos categoria/classificação persistida no Firestore.
    return [] as { name: string; value: number; percentage: number }[];
  }, []);

  const topSuppliers = useMemo(() => {
    // Ainda não temos fornecedor persistido no Firestore.
    return [] as { name: string; spent: number; percentage: number; items: number }[];
  }, []);

  const priceVariationData = useMemo(() => {
    // Ainda não temos histórico de preço (budgeted vs actual).
    return [] as { item: string; budgeted: number; actual: number; variance: number }[];
  }, []);

  // Função para exportar dashboard
  const handleExportDashboard = async () => {
    if (!dashboardRef.current) return;
    
    try {
      setIsExporting(true);
      
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      
      // Cabeçalho do PDF
      pdf.setFontSize(20);
      pdf.setFont("helvetica", "bold");
      pdf.text("Dashboard de Analytics", margin, margin + 10);
      
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Data: ${new Date().toLocaleDateString("pt-BR")}`, margin, margin + 18);
      pdf.text(`Período: ${dateRange === "30days" ? "Últimos 30 dias" : dateRange}`, margin, margin + 24);
      
      let yPosition = margin + 35;
      
      // Capturar KPIs
      const kpiElements = dashboardRef.current.querySelectorAll(".kpi-card");
      for (let i = 0; i < kpiElements.length; i++) {
        const element = kpiElements[i] as HTMLElement;
        try {
          const canvas = await html2canvas(element, {
            scale: 2,
            backgroundColor: "#ffffff",
            logging: false,
          });
          
          const imgData = canvas.toDataURL("image/png");
          const imgWidth = (pageWidth - 2 * margin) / 2 - 5;
          const imgHeight = (canvas.height * imgWidth) / canvas.width;
          
          const xPosition = margin + (i % 2) * (imgWidth + 10);
          
          if (yPosition + imgHeight > pageHeight - margin) {
            pdf.addPage();
            yPosition = margin;
          }
          
          pdf.addImage(imgData, "PNG", xPosition, yPosition, imgWidth, imgHeight);
          
          if (i % 2 === 1) {
            yPosition += imgHeight + 10;
          }
        } catch (err) {
          console.error("Erro ao capturar KPI:", err);
        }
      }
      
      if (kpiElements.length % 2 === 1) {
        yPosition += 50;
      }
      
      // Capturar gráficos
      const chartElements = dashboardRef.current.querySelectorAll(".chart-card");
      for (let i = 0; i < chartElements.length; i++) {
        const element = chartElements[i] as HTMLElement;
        try {
          if (yPosition > margin + 40) {
            pdf.addPage();
            yPosition = margin;
          }
          
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
          yPosition += imgHeight + 15;
        } catch (err) {
          console.error("Erro ao capturar gráfico:", err);
        }
      }
      
      // Salvar PDF
      pdf.save(`Dashboard-Analytics-${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (error) {
      console.error("Erro ao exportar dashboard:", error);
      toast.error("Não foi possível exportar o dashboard", {
        description: "Tente novamente em instantes.",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const COLORS = ["#1F4E78", "#2E7AD4", "#5B9BD5", "#9FC2E8", "#BFDBF7"];

  // KPIs
  const kpis: KPI[] = [
    {
      label: "Orçamento Total",
      value: loading
        ? "—"
        : totals.totalBudget.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          }),
      change: 0,
      icon: <DollarSign className="w-6 h-6" />,
      color: "bg-blue-500",
    },
    {
      label: "Orçamentos",
      value: loading ? "—" : String(orcamentos.length),
      change: -7.1,
      icon: <TrendingUp className="w-6 h-6" />,
      color: "bg-green-500",
    },
    {
      label: "Itens (total)",
      value: loading ? "—" : String(totals.totalItems),
      change: 6.9,
      icon: <BarChart3 className="w-6 h-6" />,
      color: "bg-purple-500",
    },
    {
      label: "Taxa de Utilização",
      value: "—",
      change: 0,
      icon: <PieChart className="w-6 h-6" />,
      color: "bg-orange-500",
    },
  ];

  return (
    <div className="flex flex-col min-h-full bg-slate-50 pb-16">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-8 py-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">BI & Analytics</h1>
            <p className="text-slate-600 text-sm">
              Análise detalhada de custos e desempenho
            </p>
          </div>
          <button 
            onClick={handleExportDashboard}
            disabled={isExporting}
            className={`flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition font-medium ${
              isExporting ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            <Download className={`w-5 h-5 ${isExporting ? "animate-bounce" : ""}`} />
            {isExporting ? "Exportando..." : "Exportar Dashboard"}
          </button>
        </div>

        {/* Filtros */}
        <div className="flex gap-3 items-center text-sm">
          <Filter className="w-4 h-4 text-slate-500" />
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-1 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="7days">Últimos 7 dias</option>
            <option value="30days">Últimos 30 dias</option>
            <option value="90days">Últimos 90 dias</option>
            <option value="all">Todo período</option>
          </select>
          <button className="flex items-center gap-2 px-3 py-1 hover:bg-slate-100 rounded-lg transition text-slate-700">
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main ref={dashboardRef} className="flex-1 overflow-auto p-8">
        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {kpis.map((kpi, idx) => (
            <div
              key={idx}
              className="kpi-card bg-white rounded-lg border border-slate-200 p-6 shadow-sm hover:shadow-md transition"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`${kpi.color} p-3 rounded-lg text-white`}>
                  {kpi.icon}
                </div>
                {kpi.change !== 0 && (
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded ${
                      kpi.change > 0
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {kpi.change > 0 ? "+" : ""}{kpi.change}%
                  </span>
                )}
              </div>
              <p className="text-slate-600 text-sm mb-1">{kpi.label}</p>
              <p className="text-2xl font-bold text-slate-900">{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Orçado vs Executado */}
          <div className="chart-card bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900 mb-6">
              Orçado vs Executado
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={monthlyDataItems}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2E7AD4" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#2E7AD4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  formatter={(value) => formatCurrencyK(value)}
                  labelStyle={{ color: "#000" }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#2E7AD4"
                  fillOpacity={1}
                  fill="url(#colorValue)"
                  name="Executado"
                />
                <Line
                  type="monotone"
                  dataKey="planned"
                  stroke="#f59e0b"
                  strokeDasharray="5 5"
                  name="Planejado"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Distribuição por Categoria */}
          <div className="chart-card bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900 mb-6">
              Distribuição por Categoria
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <RechartsPieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => {
                    const pct = percent ? Math.round(percent * 100) : 0;
                    return `${name ?? ""} ${pct}%`;
                  }}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrencyK(value)} />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Top Fornecedores */}
          <div className="chart-card bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900 mb-6">
              Top 5 Fornecedores
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topSuppliers}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip formatter={(value) => formatCurrencyK(value)} />
                <Bar dataKey="spent" fill="#1F4E78" name="Gasto (R$)" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Variação de Preços */}
          <div className="chart-card bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900 mb-6">
              Variação de Preços (Top 5)
            </h3>
            <div className="space-y-4">
              {priceVariationData.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-slate-900">{item.item}</p>
                    <p className="text-xs text-slate-600">
                      Orçado: R$ {item.budgeted.toFixed(2)} | Atual: R${" "}
                      {item.actual.toFixed(2)}
                    </p>
                  </div>
                  <span
                    className={`font-bold px-3 py-1 rounded ${
                      item.variance > 0
                        ? "bg-red-100 text-red-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {item.variance > 0 ? "+" : ""}{item.variance.toFixed(2)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tabela de Fornecedores Detalhada */}
        <div className="chart-card bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-6">
            Análise Detalhada de Fornecedores
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left font-semibold text-slate-900">
                    Fornecedor
                  </th>
                  <th className="px-6 py-4 text-right font-semibold text-slate-900">
                    Gasto Total
                  </th>
                  <th className="px-6 py-4 text-right font-semibold text-slate-900">
                    % do Total
                  </th>
                  <th className="px-6 py-4 text-right font-semibold text-slate-900">
                    Itens
                  </th>
                  <th className="px-6 py-4 text-center font-semibold text-slate-900">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {topSuppliers.map((supplier, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {supplier.name}
                    </td>
                    <td className="px-6 py-4 text-right text-slate-700">
                      R$ {(supplier.spent / 1000).toFixed(0)}k
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-24 bg-slate-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${supplier.percentage}%` }}
                          />
                        </div>
                        <span className="text-slate-700 font-medium w-12 text-right">
                          {supplier.percentage}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-slate-700">
                      {supplier.items}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-block px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                        Ativo
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Analytics;
