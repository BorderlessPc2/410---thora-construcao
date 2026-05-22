import React, { useId, useMemo } from "react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { AiReportChart } from "../services/api";
import { CHART_COLORS } from "../features/orcamentos/orcamentoAnalytics";

export function formatChartValue(
  value: number | string | ReadonlyArray<number | string> | undefined,
  label?: string,
): string {
  const raw = Array.isArray(value) ? value[0] : value;
  const num = typeof raw === "number" ? raw : raw ? Number(raw) : 0;
  if (Number.isNaN(num)) return "0";
  if (label === "quantidade") {
    return num.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  }
  if (label === "percentual") {
    return `${num.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  }
  return num.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: num >= 1_000_000 ? 0 : 2,
  });
}

function valueAxisLabel(label?: string): string {
  if (label === "quantidade") return "Quantidade";
  if (label === "percentual") return "Percentual";
  return "Valor (R$)";
}

type ChartRow = { name: string; fullName: string; value: number; fill: string };

function truncateLabel(text: string, max = 36): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function shouldUseHorizontalLayout(
  chartType: AiReportChart["chart_type"],
  rows: { name: string }[],
): boolean {
  if (chartType === "horizontal_bar") return true;
  if (chartType === "pie" || chartType === "line") return false;
  const longLabels = rows.filter((r) => r.name.length > 22).length;
  return longLabels >= 2 || rows.length > 5 || rows.some((r) => r.name.length > 40);
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: { payload: ChartRow; value: number }[];
  valueLabel?: string;
}

function ChartTooltip({ active, payload, valueLabel }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="max-w-[280px] rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 shadow-lg shadow-slate-200/60">
      <p className="text-xs leading-snug text-slate-600">{row.fullName}</p>
      <p className="mt-1.5 text-base font-bold tabular-nums text-[#1F4E78]">
        {formatChartValue(row.value, valueLabel)}
      </p>
    </div>
  );
}

interface ChatReportChartProps {
  chart: AiReportChart;
}

const ChatReportChart: React.FC<ChatReportChartProps> = ({ chart }) => {
  const gradientId = useId().replace(/:/g, "");
  const valueLabel = chart.value_label ?? "valor";
  const rawData = chart.data ?? [];

  const rows: ChartRow[] = useMemo(() => {
    const mapped = rawData
      .map((d, i) => ({
        name: truncateLabel(d.name),
        fullName: d.name,
        value: Number(d.value) || 0,
        fill: CHART_COLORS[i % CHART_COLORS.length],
      }))
      .filter((r) => r.value > 0);
    return mapped;
  }, [rawData]);

  const isPie =
    chart.chart_type === "pie" || chart.type === "pie";
  const horizontal =
    !isPie && shouldUseHorizontalLayout(chart.chart_type, rawData);
  const chartHeight = isPie
    ? 300
    : horizontal
      ? Math.min(420, Math.max(240, rows.length * 40 + 56))
      : Math.min(360, Math.max(260, 280));

  if (!rows.length) {
    return (
      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Não há valores numéricos válidos para exibir neste gráfico. Tente pedir por{" "}
        <strong>valor total em R$</strong> ou <strong>quantidade</strong>.
      </div>
    );
  }

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-slate-200/80 bg-gradient-to-br from-slate-50 to-white shadow-sm">
      <div className="border-b border-slate-100 bg-white/80 px-4 py-2.5">
        <p className="text-sm font-semibold text-slate-800">{chart.title}</p>
        <p className="text-xs text-slate-500">{valueAxisLabel(valueLabel)}</p>
      </div>

      <div className="px-2 py-3 sm:px-4" style={{ height: chartHeight }}>
        {isPie ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={rows}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius="42%"
                outerRadius="72%"
                paddingAngle={2}
                stroke="#fff"
                strokeWidth={2}
              >
                {rows.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip valueLabel={valueLabel} />} />
            </PieChart>
          </ResponsiveContainer>
        ) : chart.chart_type === "line" ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={rows}
              margin={{ top: 12, right: 16, left: 8, bottom: 8 }}
            >
              <defs>
                <linearGradient id={`line-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2E7AD4" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#2E7AD4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8edf3" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: "#64748b" }}
                axisLine={{ stroke: "#e2e8f0" }}
                tickLine={false}
                interval={0}
                height={48}
                angle={-20}
                textAnchor="end"
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatChartValue(v, valueLabel)}
                width={72}
              />
              <Tooltip content={<ChartTooltip valueLabel={valueLabel} />} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#1F4E78"
                strokeWidth={2.5}
                dot={{ fill: "#2E7AD4", strokeWidth: 0, r: 4 }}
                activeDot={{ r: 6, fill: "#1F4E78" }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : horizontal ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={rows}
              layout="vertical"
              margin={{ top: 8, right: 24, left: 4, bottom: 8 }}
              barCategoryGap="18%"
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#e8edf3"
                horizontal={false}
              />
              <XAxis
                type="number"
                tick={{ fontSize: 10, fill: "#64748b" }}
                axisLine={{ stroke: "#e2e8f0" }}
                tickLine={false}
                tickFormatter={(v) => formatChartValue(v, valueLabel)}
                domain={[0, (dataMax: number) => Math.max(dataMax * 1.08, 1)]}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={118}
                tick={{ fontSize: 10, fill: "#475569" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={<ChartTooltip valueLabel={valueLabel} />}
                cursor={{ fill: "rgba(46, 122, 212, 0.06)" }}
              />
              <Bar
                dataKey="value"
                radius={[0, 8, 8, 0]}
                maxBarSize={28}
                activeBar={{ fill: "#2E7AD4" }}
              >
                {rows.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={rows}
              margin={{ top: 12, right: 12, left: 4, bottom: 64 }}
              barCategoryGap="20%"
            >
              <defs>
                <linearGradient id={`bar-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2E7AD4" />
                  <stop offset="100%" stopColor="#1F4E78" />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#e8edf3"
                vertical={false}
              />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: "#64748b" }}
                axisLine={{ stroke: "#e2e8f0" }}
                tickLine={false}
                interval={0}
                angle={-35}
                textAnchor="end"
                height={72}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatChartValue(v, valueLabel)}
                width={76}
              />
              <Tooltip
                content={<ChartTooltip valueLabel={valueLabel} />}
                cursor={{ fill: "rgba(46, 122, 212, 0.06)" }}
              />
              <Bar
                dataKey="value"
                fill={`url(#bar-${gradientId})`}
                radius={[8, 8, 0, 0]}
                maxBarSize={48}
                activeBar={{ fill: "#3B82C4" }}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {horizontal && (
        <p className="border-t border-slate-100 px-4 py-2 text-[10px] text-slate-400">
          Passe o mouse sobre as barras para ver o nome completo do item.
        </p>
      )}
    </div>
  );
};

export default ChatReportChart;
