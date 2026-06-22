import React, { useMemo } from "react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { BDIResultado } from "../../types/bdi";
import { TCU_OBRAS_REFERENCIA_BDI } from "../../constants/bdiPresets";
import { formatBDIPercent } from "../../utils/bdiCalculator";
import BDIImpactCard from "./BDIImpactCard";
import BDITCUReference from "./BDITCUReference";

const CHART_COLORS = ["#1F4E78", "#2E7AD4", "#F59E0B", "#10B981"];

interface BDIResultadoPanelProps {
  resultado: BDIResultado;
  uploadId?: string;
  valorBase: number;
  applying: boolean;
  onApply: (bdiOverride?: number) => void;
}

const BDIResultadoPanel: React.FC<BDIResultadoPanelProps> = ({
  resultado,
  uploadId,
  valorBase,
  applying,
  onApply,
}) => {
  const chartData = useMemo(
    () =>
      resultado.breakdown.map((b, i) => ({
        name: b.categoria,
        value: b.total,
        fill: CHART_COLORS[i % CHART_COLORS.length],
      })),
    [resultado.breakdown],
  );

  const diffTcu = resultado.bdiPercentual - TCU_OBRAS_REFERENCIA_BDI;
  const comparisonBadge = useMemo(() => {
    if (Math.abs(diffTcu) < 0.05) {
      return { text: "Alinhado com referência TCU", className: "bg-blue-100 text-blue-800" };
    }
    if (diffTcu > 0) {
      return {
        text: `${Math.abs(diffTcu).toFixed(2)}% acima da referência TCU`,
        className: "bg-red-100 text-red-800",
      };
    }
    return {
      text: `${Math.abs(diffTcu).toFixed(2)}% abaixo da referência TCU`,
      className: "bg-emerald-100 text-emerald-800",
    };
  }, [diffTcu]);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <p className="text-sm font-medium text-slate-600">BDI Calculado</p>
        <p className="mt-2 text-5xl font-bold tabular-nums text-blue-700">
          {formatBDIPercent(resultado.bdiPercentual)}
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Fator multiplicador: {resultado.fatorBDI.toLocaleString("pt-BR", { minimumFractionDigits: 4 })}
        </p>
        <span
          className={`mt-4 inline-block rounded-full px-3 py-1 text-xs font-medium ${comparisonBadge.className}`}
        >
          {comparisonBadge.text}
        </span>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Breakdown por categoria</h3>
        {chartData.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">Sem dados</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ name, value }) => `${name}: ${value?.toFixed(1)}%`}
              >
                {chartData.map((entry, index) => (
                  <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => `${Number(v).toFixed(2)}%`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      <BDIImpactCard
        uploadId={uploadId}
        valorBase={valorBase}
        bdiPercentual={resultado.bdiPercentual}
        applying={applying}
        onApply={onApply}
      />

      <BDITCUReference />
    </div>
  );
};

export default BDIResultadoPanel;
