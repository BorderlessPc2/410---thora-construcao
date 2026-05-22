import React from "react";
import { Check } from "lucide-react";

export type WizardStep = {
  id: number;
  label: string;
  description: string;
};

type WizardStepperProps = {
  steps: WizardStep[];
  currentStep: number;
  className?: string;
};

export function WizardStepper({ steps, currentStep, className = "" }: WizardStepperProps) {
  return (
    <nav aria-label="Progresso do orçamento" className={className}>
      <ol className="flex gap-2">
        {steps.map((step) => {
          const isComplete = currentStep > step.id;
          const isCurrent = currentStep === step.id;

          return (
            <li
              key={step.id}
              className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg border px-2.5 py-2 sm:px-3 ${
                isCurrent
                  ? "border-violet-400 bg-violet-50 ring-1 ring-violet-200"
                  : isComplete
                    ? "border-emerald-200 bg-emerald-50/90"
                    : "border-slate-200 bg-white"
              }`}
              title={step.description}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                  isComplete
                    ? "bg-emerald-600 text-white"
                    : isCurrent
                      ? "bg-violet-600 text-white"
                      : "bg-slate-100 text-slate-500"
                }`}
              >
                {isComplete ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : step.id}
              </span>
              <span className="min-w-0 truncate text-xs font-semibold text-slate-800 sm:text-sm">
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
