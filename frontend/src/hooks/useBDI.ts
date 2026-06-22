import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "../features/auth/AuthContext";
import {
  deleteBDIConfig,
  listBDIConfigs,
  saveBDIConfig,
} from "../features/bdi/bdiRepository";
import {
  PRESET_CUSTOMIZADO,
  PRESET_TCU_FORNECIMENTO,
  PRESET_TCU_OBRAS,
  clonePreset,
} from "../constants/bdiPresets";
import type { BDIConfig, BDIAplicado, BDIComponente, BDIResultado } from "../types/bdi";
import { calcularBDI } from "../utils/bdiCalculator";
import { applyBDI, calculateBDI } from "../services/api";

export function useBDI() {
  const { user } = useAuth();
  const [configs, setConfigs] = useState<BDIConfig[]>([]);
  const [activeConfig, setActiveConfig] = useState<BDIConfig>(() => clonePreset(PRESET_TCU_OBRAS));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resultado = useMemo(
    () => calcularBDI(activeConfig.componentes),
    [activeConfig.componentes],
  );

  useEffect(() => {
    setActiveConfig((prev) => ({
      ...prev,
      bdiCalculado: resultado.bdiPercentual,
    }));
  }, [resultado.bdiPercentual]);

  const carregarConfigs = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listBDIConfigs(user.uid);
      setConfigs(data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao carregar configurações BDI";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    void carregarConfigs();
  }, [carregarConfigs]);

  const calcularBDILocal = useCallback(
    (componentes: BDIComponente[]): BDIResultado => calcularBDI(componentes),
    [],
  );

  const salvarConfig = useCallback(
    async (config: BDIConfig) => {
      if (!user?.uid) {
        toast.error("Usuário não autenticado");
        return;
      }
      setSaving(true);
      try {
        const toSave: BDIConfig = {
          ...config,
          bdiCalculado: calcularBDI(config.componentes).bdiPercentual,
          updatedAt: new Date().toISOString(),
        };
        await saveBDIConfig(user.uid, toSave);
        await carregarConfigs();
        setActiveConfig(toSave);
        toast.success("Configuração BDI salva com sucesso!");
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Erro ao salvar configuração";
        toast.error(msg);
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [user?.uid, carregarConfigs],
  );

  const deletarConfig = useCallback(
    async (configId: string) => {
      if (!user?.uid) return;
      if (!window.confirm("Deseja excluir esta configuração BDI?")) return;
      setLoading(true);
      try {
        await deleteBDIConfig(user.uid, configId);
        setConfigs((prev) => prev.filter((c) => c.id !== configId));
        toast.success("Configuração removida");
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Erro ao excluir";
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    },
    [user?.uid],
  );

  const aplicarBDI = useCallback(
    async (
      uploadId: string,
      bdiConfig: BDIConfig,
      tipoAplicacao: "todos" | "apenas_servicos" | "apenas_materiais" = "todos",
      bdiOverride?: number,
    ): Promise<BDIAplicado> => {
      setApplying(true);
      try {
        const bdiPercentual = bdiOverride ?? calcularBDI(bdiConfig.componentes).bdiPercentual;
        const data = await applyBDI({
          upload_id: uploadId,
          bdi_percentual: bdiPercentual,
          bdi_config_id: bdiConfig.id,
          tipo_aplicacao: tipoAplicacao,
        });
        toast.success(
          `BDI de ${bdiPercentual.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}% aplicado com sucesso!`,
        );
        return data;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Erro ao aplicar BDI";
        toast.error(msg);
        throw e;
      } finally {
        setApplying(false);
      }
    },
    [],
  );

  const loadPreset = useCallback((preset: "obras" | "fornecimento" | "customizado") => {
    const source =
      preset === "obras"
        ? PRESET_TCU_OBRAS
        : preset === "fornecimento"
          ? PRESET_TCU_FORNECIMENTO
          : PRESET_CUSTOMIZADO;
    setActiveConfig(clonePreset(source));
  }, []);

  const updateComponente = useCallback((id: string, valor: number) => {
    setActiveConfig((prev) => {
      const componentes = prev.componentes.map((c) =>
        c.id === id ? { ...c, valor: Math.max(0, valor) } : c,
      );
      return {
        ...prev,
        componentes,
        bdiCalculado: calcularBDI(componentes).bdiPercentual,
      };
    });
  }, []);

  const updateConfigNome = useCallback((nome: string) => {
    setActiveConfig((prev) => ({ ...prev, nome }));
  }, []);

  const editConfig = useCallback((config: BDIConfig) => {
    setActiveConfig({ ...config, componentes: config.componentes.map((c) => ({ ...c })) });
  }, []);

  const novaConfig = useCallback(() => {
    setActiveConfig(clonePreset(PRESET_CUSTOMIZADO));
  }, []);

  const verifyWithBackend = useCallback(async (componentes: BDIComponente[]) => {
    try {
      return await calculateBDI(componentes);
    } catch {
      return calcularBDI(componentes);
    }
  }, []);

  return {
    configs,
    activeConfig,
    setActiveConfig,
    loading,
    saving,
    applying,
    error,
    resultado,
    calcularBDI: calcularBDILocal,
    salvarConfig,
    carregarConfigs,
    aplicarBDI,
    deletarConfig,
    loadPreset,
    updateComponente,
    updateConfigNome,
    editConfig,
    novaConfig,
    verifyWithBackend,
  };
}
