import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Calculator } from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";
import { getOrcamentoByUploadId } from "../features/orcamentos/orcamentoRepository";
import { getOrcamentoTotal } from "../features/orcamentos/orcamentoAnalytics";
import type { Orcamento } from "../features/orcamentos/orcamentoTypes";
import { useBDI } from "../hooks/useBDI";
import BDIPresetSelector from "../components/bdi/BDIPresetSelector";
import BDIEditor from "../components/bdi/BDIEditor";
import BDIResultadoPanel from "../components/bdi/BDIResultado";
import { btnSecondary } from "../components/ui/buttonClasses";

const BDICalculator: React.FC = () => {
  const { uploadId } = useParams<{ uploadId?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [orcamento, setOrcamento] = useState<Orcamento | null>(null);
  const [loadingOrcamento, setLoadingOrcamento] = useState(false);

  const {
    configs,
    activeConfig,
    loading,
    saving,
    applying,
    resultado,
    salvarConfig,
    deletarConfig,
    loadPreset,
    updateComponente,
    updateConfigNome,
    editConfig,
    novaConfig,
    aplicarBDI,
  } = useBDI();

  useEffect(() => {
    if (!uploadId || !user?.uid) {
      setOrcamento(null);
      return;
    }
    setLoadingOrcamento(true);
    getOrcamentoByUploadId(user.uid, uploadId)
      .then(setOrcamento)
      .catch(() => setOrcamento(null))
      .finally(() => setLoadingOrcamento(false));
  }, [uploadId, user?.uid]);

  const valorBase = useMemo(() => {
    if (!orcamento) return 0;
    return getOrcamentoTotal(orcamento);
  }, [orcamento]);

  const handleSalvar = useCallback(async () => {
    await salvarConfig(activeConfig);
  }, [activeConfig, salvarConfig]);

  const handleReset = useCallback(() => {
    loadPreset(
      activeConfig.tipo === "fornecimento"
        ? "fornecimento"
        : activeConfig.tipo === "customizado"
          ? "customizado"
          : "obras",
    );
  }, [activeConfig.tipo, loadPreset]);

  const handleApply = useCallback(
    async (bdiOverride?: number) => {
      if (!uploadId) return;
      const aplicado = await aplicarBDI(uploadId, activeConfig, "todos", bdiOverride);
      navigate(`/orcamento-analitico/${uploadId}`, {
        state: {
          bdiApplied: true,
          bdiPercentual: aplicado.bdiPercentual,
          valorComBDI: aplicado.valorComBDI,
        },
      });
    },
    [uploadId, activeConfig, aplicarBDI, navigate],
  );

  return (
    <div className="flex-1 overflow-auto bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-100 p-2.5 text-blue-700">
              <Calculator className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                Calculadora BDI
              </h1>
              <p className="text-sm text-slate-600">
                Fórmula TCU — Acórdão 2622/2013
                {uploadId && (
                  <span className="ml-2 rounded bg-slate-200 px-2 py-0.5 text-xs">
                    Orçamento: {orcamento?.filename ?? uploadId.slice(0, 8)}
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              uploadId
                ? navigate(`/orcamento-analitico/${uploadId}`)
                : navigate("/")
            }
            className={btnSecondary}
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>
        </div>

        {loadingOrcamento && uploadId && (
          <p className="mb-4 text-sm text-slate-500">Carregando orçamento…</p>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <BDIPresetSelector
              configs={configs}
              activeConfigId={activeConfig.id}
              loading={loading}
              onSelectPreset={loadPreset}
              onEditConfig={editConfig}
              onDeleteConfig={deletarConfig}
              onNovaConfig={novaConfig}
            />
          </div>

          <div className="lg:col-span-5">
            <BDIEditor
              config={activeConfig}
              saving={saving}
              onUpdateNome={updateConfigNome}
              onUpdateComponente={updateComponente}
              onSalvar={() => void handleSalvar()}
              onReset={handleReset}
            />
          </div>

          <div className="lg:col-span-4">
            <BDIResultadoPanel
              resultado={resultado}
              uploadId={uploadId}
              valorBase={valorBase}
              applying={applying}
              onApply={(override) => void handleApply(override)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default BDICalculator;
