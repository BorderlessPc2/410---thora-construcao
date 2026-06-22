import React, { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import type { BDIConfig } from "../../types/bdi";
import { formatCurrencyBRL } from "../../utils/bdiCalculator";
import { btnPrimary } from "../ui/buttonClasses";

interface BDIImpactCardProps {
  uploadId?: string;
  valorBase: number;
  bdiPercentual: number;
  applying: boolean;
  onApply: (bdiOverride?: number) => void;
}

const BDIImpactCard: React.FC<BDIImpactCardProps> = ({
  uploadId,
  valorBase,
  bdiPercentual,
  applying,
  onApply,
}) => {
  const [simulatedBdi, setSimulatedBdi] = useState(bdiPercentual);

  React.useEffect(() => {
    setSimulatedBdi(bdiPercentual);
  }, [bdiPercentual]);

  const impact = useMemo(() => {
    const factor = 1 + simulatedBdi / 100;
    const valorCom = valorBase * factor;
    const diferenca = valorCom - valorBase;
    return { valorCom, diferenca };
  }, [valorBase, simulatedBdi]);

  if (!uploadId) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
        Selecione um orçamento para simular o impacto do BDI.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-slate-900">Impacto no orçamento</h3>

      <dl className="space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-slate-600">Valor sem BDI</dt>
          <dd className="font-medium tabular-nums">{formatCurrencyBRL(valorBase)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-600">BDI ({simulatedBdi.toFixed(2)}%)</dt>
          <dd className="font-medium tabular-nums text-amber-700">
            + {formatCurrencyBRL(impact.diferenca)}
          </dd>
        </div>
        <div className="flex justify-between border-t border-slate-200 pt-2">
          <dt className="font-semibold text-slate-900">Total com BDI</dt>
          <dd className="text-lg font-bold tabular-nums text-emerald-700">
            {formatCurrencyBRL(impact.valorCom)}
          </dd>
        </div>
      </dl>

      <div className="mt-4">
        <label className="mb-1 block text-xs text-slate-500">
          Simular BDI: {simulatedBdi.toFixed(2)}%
        </label>
        <input
          type="range"
          min={0}
          max={50}
          step={0.1}
          value={simulatedBdi}
          onChange={(e) => setSimulatedBdi(Number(e.target.value))}
          className="w-full accent-blue-600"
        />
      </div>

      <button
        type="button"
        disabled={applying}
        onClick={() => onApply(simulatedBdi)}
        className={`${btnPrimary} mt-4 w-full`}
      >
        {applying ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Aplicando…
          </>
        ) : (
          "Aplicar BDI ao orçamento"
        )}
      </button>
    </div>
  );
};

export default BDIImpactCard;
