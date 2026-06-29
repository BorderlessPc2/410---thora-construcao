export type AnalysisTypeId = "curva_abc";

export type AnalysisTypeOption = {
  id: AnalysisTypeId;
  label: string;
  description: string;
  available: boolean;
};

export const ANALYSIS_TYPE_OPTIONS: AnalysisTypeOption[] = [
  {
    id: "curva_abc",
    label: "Curva ABC",
    description:
      "Classifica itens por impacto no orçamento (Pareto 80/15/5) com os valores extraídos do PDF.",
    available: true,
  },
];
