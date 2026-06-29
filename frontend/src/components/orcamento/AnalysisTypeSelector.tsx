import React from "react";
import { TrendingUp, CheckCircle2 } from "lucide-react";
import {
  ANALYSIS_TYPE_OPTIONS,
  type AnalysisTypeId,
} from "../../features/orcamentos/analysisTypes";

const ICONS: Record<AnalysisTypeId, React.ReactNode> = {
  curva_abc: <TrendingUp className="h-5 w-5" aria-hidden />,
};

type AnalysisTypeSelectorProps = {
  selected: AnalysisTypeId[];
  onChange: (next: AnalysisTypeId[]) => void;
  disabled?: boolean;
};

export function AnalysisTypeSelector({
  selected,
  onChange,
  disabled = false,
}: AnalysisTypeSelectorProps) {
  const toggle = (id: AnalysisTypeId, available: boolean) => {
    if (disabled || !available) return;
    onChange(
      selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id],
    );
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-700">
        Escolha o tipo de análise
      </p>
      <div className="grid gap-3 sm:grid-cols-1">
        {ANALYSIS_TYPE_OPTIONS.map((option) => {
          const isSelected = selected.includes(option.id);
          const isDisabled = disabled || !option.available;
          return (
            <button
              key={option.id}
              type="button"
              disabled={isDisabled}
              onClick={() => toggle(option.id, option.available)}
              className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition ${
                isSelected
                  ? "border-blue-500 bg-blue-50/60 ring-1 ring-blue-200"
                  : "border-slate-200 bg-white hover:border-slate-300"
              } ${isDisabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
            >
              <span
                className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  isSelected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                {ICONS[option.id]}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900">{option.label}</span>
                  {isSelected ? (
                    <CheckCircle2 className="h-4 w-4 text-blue-600" aria-hidden />
                  ) : null}
                  {!option.available ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                      Em breve
                    </span>
                  ) : null}
                </span>
                <span className="mt-1 block text-sm text-slate-600">
                  {option.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
