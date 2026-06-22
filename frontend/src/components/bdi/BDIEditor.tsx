import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Loader2, RotateCcw } from "lucide-react";
import type { BDIComponente, BDIConfig } from "../../types/bdi";
import { btnAccent, btnSecondary } from "../ui/buttonClasses";

interface BDIEditorProps {
  config: BDIConfig;
  saving: boolean;
  onUpdateNome: (nome: string) => void;
  onUpdateComponente: (id: string, valor: number) => void;
  onSalvar: () => void;
  onReset: () => void;
}

type SectionKey = "despesas_indiretas" | "risco" | "tributos" | "lucro";

const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: "despesas_indiretas", label: "Despesas Indiretas" },
  { key: "risco", label: "Risco" },
  { key: "tributos", label: "Tributos" },
  { key: "lucro", label: "Lucro" },
];

const SLIDER_MAX: Record<string, number> = {
  administracao_central: 10,
  seguro_garantia: 5,
  despesas_financeiras: 5,
  risco: 10,
  lucro: 20,
  iss: 10,
};

function ComponentRow({
  comp,
  onChange,
}: {
  comp: BDIComponente;
  onChange: (valor: number) => void;
}) {
  const max = SLIDER_MAX[comp.id] ?? 15;
  return (
    <div className="space-y-2 rounded-lg border border-slate-100 bg-slate-50/80 p-3">
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm font-medium text-slate-800">{comp.nome}</label>
        {comp.id === "iss" && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
            varia por município
          </span>
        )}
        {!comp.editavel && (
          <span className="text-xs text-slate-400">fixo</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <input
          type="number"
          min={0}
          max={100}
          step={0.01}
          disabled={!comp.editavel}
          value={comp.valor}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-right text-sm tabular-nums disabled:bg-slate-100"
        />
        <span className="text-sm text-slate-500">%</span>
        {comp.editavel && (
          <input
            type="range"
            min={0}
            max={max}
            step={0.01}
            value={Math.min(comp.valor, max)}
            onChange={(e) => onChange(Number(e.target.value))}
            className="flex-1 accent-blue-600"
          />
        )}
      </div>
    </div>
  );
}

const BDIEditor: React.FC<BDIEditorProps> = ({
  config,
  saving,
  onUpdateNome,
  onUpdateComponente,
  onSalvar,
  onReset,
}) => {
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    despesas_indiretas: true,
    risco: true,
    tributos: true,
    lucro: true,
  });

  const bySection = useMemo(() => {
    const map: Record<SectionKey, BDIComponente[]> = {
      despesas_indiretas: [],
      risco: [],
      tributos: [],
      lucro: [],
    };
    for (const comp of config.componentes) {
      if (map[comp.categoria]) map[comp.categoria].push(comp);
    }
    return map;
  }, [config.componentes]);

  const toggle = (key: SectionKey) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">Editor de componentes</h2>

      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Nome da configuração
        </label>
        <input
          type="text"
          value={config.nome}
          onChange={(e) => onUpdateNome(e.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          placeholder="Ex.: Obra Residencial — SP"
        />
      </div>

      <div className="space-y-3">
        {SECTIONS.map(({ key, label }) => (
          <div key={key} className="rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => toggle(key)}
              className="flex w-full items-center justify-between px-4 py-3 text-left font-medium text-slate-800"
            >
              {label}
              {openSections[key] ? (
                <ChevronUp className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              )}
            </button>
            {openSections[key] && (
              <div className="space-y-2 border-t border-slate-100 p-3">
                {bySection[key].map((comp) => (
                  <ComponentRow
                    key={comp.id}
                    comp={comp}
                    onChange={(valor) => onUpdateComponente(comp.id, valor)}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" onClick={onSalvar} disabled={saving} className={btnAccent}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Salvar configuração
        </button>
        <button type="button" onClick={onReset} className={btnSecondary}>
          <RotateCcw className="h-4 w-4" />
          Resetar para preset
        </button>
      </div>
    </div>
  );
};

export default BDIEditor;
