import type { WizardStep } from "../../components/WizardStepper";

export const NOVO_ORCAMENTO_WIZARD_STEPS: WizardStep[] = [
  {
    id: 1,
    label: "Projeto e PDF",
    description: "Nome, modelos de Excel e envio do arquivo",
  },
  {
    id: 2,
    label: "Tabelas",
    description: "Escolha as tabelas do orçamento no PDF",
  },
  {
    id: 3,
    label: "Validação",
    description: "Revise valores e exporte os arquivos",
  },
];
