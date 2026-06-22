import type { BDIComponente, BDIConfig, BDIConfigTipo } from "../types/bdi";
import { calcularBDI } from "../utils/bdiCalculator";

function buildComponentes(list: Omit<BDIComponente, "descricao">[]): BDIComponente[] {
  return list.map((c) => ({
    ...c,
    descricao: c.nome,
  }));
}

const COMPONENTES_OBRAS = buildComponentes([
  { id: "administracao_central", nome: "Administração Central", valor: 4.0, categoria: "despesas_indiretas", editavel: true },
  { id: "seguro_garantia", nome: "Seguro e Garantia", valor: 0.5, categoria: "despesas_indiretas", editavel: true },
  { id: "risco", nome: "Risco", valor: 1.27, categoria: "risco", editavel: true },
  { id: "despesas_financeiras", nome: "Despesas Financeiras", valor: 1.2, categoria: "despesas_indiretas", editavel: true },
  { id: "lucro", nome: "Lucro", valor: 7.4, categoria: "lucro", editavel: true },
  { id: "iss", nome: "ISS", valor: 3.0, categoria: "tributos", editavel: true },
  { id: "pis", nome: "PIS", valor: 0.65, categoria: "tributos", editavel: false },
  { id: "cofins", nome: "COFINS", valor: 3.0, categoria: "tributos", editavel: false },
  { id: "csll", nome: "CSLL", valor: 1.08, categoria: "tributos", editavel: false },
  { id: "irpj", nome: "IRPJ", valor: 1.2, categoria: "tributos", editavel: false },
]);

const COMPONENTES_FORNECIMENTO = buildComponentes([
  { id: "administracao_central", nome: "Administração Central", valor: 2.0, categoria: "despesas_indiretas", editavel: true },
  { id: "seguro_garantia", nome: "Seguro e Garantia", valor: 0.3, categoria: "despesas_indiretas", editavel: true },
  { id: "risco", nome: "Risco", valor: 0.5, categoria: "risco", editavel: true },
  { id: "lucro", nome: "Lucro", valor: 5.0, categoria: "lucro", editavel: true },
  { id: "pis", nome: "PIS", valor: 0.65, categoria: "tributos", editavel: false },
  { id: "cofins", nome: "COFINS", valor: 3.0, categoria: "tributos", editavel: false },
  { id: "csll", nome: "CSLL", valor: 1.08, categoria: "tributos", editavel: false },
  { id: "irpj", nome: "IRPJ", valor: 1.2, categoria: "tributos", editavel: false },
]);

const COMPONENTES_CUSTOMIZADO = buildComponentes([
  { id: "administracao_central", nome: "Administração Central", valor: 0, categoria: "despesas_indiretas", editavel: true },
  { id: "seguro_garantia", nome: "Seguro e Garantia", valor: 0, categoria: "despesas_indiretas", editavel: true },
  { id: "despesas_financeiras", nome: "Despesas Financeiras", valor: 0, categoria: "despesas_indiretas", editavel: true },
  { id: "risco", nome: "Risco", valor: 0, categoria: "risco", editavel: true },
  { id: "lucro", nome: "Lucro", valor: 0, categoria: "lucro", editavel: true },
  { id: "iss", nome: "ISS", valor: 0, categoria: "tributos", editavel: true },
  { id: "pis", nome: "PIS", valor: 0, categoria: "tributos", editavel: true },
  { id: "cofins", nome: "COFINS", valor: 0, categoria: "tributos", editavel: true },
  { id: "csll", nome: "CSLL", valor: 0, categoria: "tributos", editavel: true },
  { id: "irpj", nome: "IRPJ", valor: 0, categoria: "tributos", editavel: true },
]);

function createPresetConfig(
  id: string,
  nome: string,
  tipo: BDIConfigTipo,
  componentes: BDIComponente[],
): BDIConfig {
  const now = new Date().toISOString();
  const bdiCalculado = calcularBDI(componentes).bdiPercentual;
  return {
    id,
    nome,
    tipo,
    componentes: componentes.map((c) => ({ ...c })),
    bdiCalculado,
    createdAt: now,
    updatedAt: now,
  };
}

export const PRESET_TCU_OBRAS = createPresetConfig(
  "preset-obras",
  "Obras (TCU - Referência)",
  "obras",
  COMPONENTES_OBRAS,
);

export const PRESET_TCU_FORNECIMENTO = createPresetConfig(
  "preset-fornecimento",
  "Fornecimento de Material (TCU)",
  "fornecimento",
  COMPONENTES_FORNECIMENTO,
);

export const PRESET_CUSTOMIZADO = createPresetConfig(
  "preset-customizado",
  "Personalizado",
  "customizado",
  COMPONENTES_CUSTOMIZADO,
);

export const TCU_OBRAS_REFERENCIA_BDI = PRESET_TCU_OBRAS.bdiCalculado;

export const BDI_PRESETS = [PRESET_TCU_OBRAS, PRESET_TCU_FORNECIMENTO, PRESET_CUSTOMIZADO] as const;

export function clonePreset(preset: BDIConfig): BDIConfig {
  const componentes = preset.componentes.map((c) => ({ ...c }));
  return {
    ...preset,
    id: crypto.randomUUID(),
    componentes,
    bdiCalculado: calcularBDI(componentes).bdiPercentual,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
