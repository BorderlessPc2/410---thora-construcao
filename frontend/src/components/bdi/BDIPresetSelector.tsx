import React, { useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Plus, Trash2 } from "lucide-react";
import type { BDIConfig } from "../../types/bdi";
import { formatBDIPercent } from "../../utils/bdiCalculator";
import { btnSecondary } from "../ui/buttonClasses";

interface BDIPresetSelectorProps {
  configs: BDIConfig[];
  activeConfigId: string;
  loading: boolean;
  onSelectPreset: (preset: "obras" | "fornecimento" | "customizado") => void;
  onEditConfig: (config: BDIConfig) => void;
  onDeleteConfig: (configId: string) => void;
  onNovaConfig: () => void;
}

const PRESET_CARDS = [
  { id: "obras" as const, label: "Obras (TCU)", desc: "Referência Acórdão 2622/2013" },
  { id: "fornecimento" as const, label: "Fornecimento (TCU)", desc: "Material e insumos" },
  { id: "customizado" as const, label: "Personalizado", desc: "Monte do zero" },
];

const BDIPresetSelector: React.FC<BDIPresetSelectorProps> = ({
  configs,
  activeConfigId,
  loading,
  onSelectPreset,
  onEditConfig,
  onDeleteConfig,
  onNovaConfig,
}) => {
  const [activePreset, setActivePreset] = useState<string>("obras");

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">Presets TCU</h2>
      <div className="space-y-2">
        {PRESET_CARDS.map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={() => {
              setActivePreset(card.id);
              onSelectPreset(card.id);
            }}
            className={`w-full rounded-xl border p-3 text-left transition ${
              activePreset === card.id
                ? "border-blue-500 bg-blue-50"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <p className="font-medium text-slate-900">{card.label}</p>
            <p className="text-xs text-slate-500">{card.desc}</p>
          </button>
        ))}
      </div>

      <div className="my-5 border-t border-slate-200 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Minhas configurações</h3>
          <button type="button" onClick={onNovaConfig} className={`${btnSecondary} !px-2 !py-1 text-xs`}>
            <Plus className="h-3.5 w-3.5" />
            Nova
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando…
          </div>
        ) : configs.length === 0 ? (
          <p className="py-4 text-sm text-slate-500">Nenhuma configuração salva</p>
        ) : (
          <ul className="max-h-64 space-y-2 overflow-y-auto">
            {configs.map((config) => (
              <li
                key={config.id}
                className={`rounded-lg border p-3 ${
                  config.id === activeConfigId
                    ? "border-blue-400 bg-blue-50/50"
                    : "border-slate-200"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{config.nome}</p>
                    <p className="text-xs capitalize text-slate-500">{config.tipo}</p>
                    <p className="text-sm font-semibold text-blue-700">
                      {formatBDIPercent(config.bdiCalculado)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => onEditConfig(config)}
                      className="rounded p-1 text-xs text-blue-600 hover:bg-blue-100"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDeleteConfig(config.id)}
                      className="rounded p-1 text-red-500 hover:bg-red-50"
                      aria-label="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default BDIPresetSelector;
