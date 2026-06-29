import type { WizardStep } from "../../components/WizardStepper";

/** Fluxo Análise de Orçamento: PDF → tabelas → tipo → validação. */
export const ANALISE_ORCAMENTO_WIZARD_STEPS: WizardStep[] = [
  {
    id: 1,
    label: "PDF",
    description: "Envie o PDF do orçamento ou edital",
  },
  {
    id: 2,
    label: "Tabelas",
    description: "Selecione as planilhas com os itens do orçamento",
  },
  {
    id: 3,
    label: "Análise",
    description: "Escolha o tipo de análise (ex.: Curva ABC)",
  },
  {
    id: 4,
    label: "Validação",
    description: "Revise os dados extraídos e exporte",
  },
];

/** @deprecated Use ANALISE_ORCAMENTO_WIZARD_STEPS */
export const ANALISE_ABC_WIZARD_STEPS = ANALISE_ORCAMENTO_WIZARD_STEPS;

/** @deprecated Use ANALISE_ORCAMENTO_WIZARD_STEPS */
export const NOVO_ORCAMENTO_WIZARD_STEPS = ANALISE_ORCAMENTO_WIZARD_STEPS;

export const ANALISE_ORCAMENTO_VALIDATION_STEP = 4;

/** @deprecated Use ANALISE_ORCAMENTO_VALIDATION_STEP */
export const ANALISE_ABC_VALIDATION_STEP = ANALISE_ORCAMENTO_VALIDATION_STEP;
