export type BDICategoria =
  | "despesas_indiretas"
  | "tributos"
  | "lucro"
  | "risco";

export type BDIConfigTipo = "obras" | "fornecimento" | "servicos" | "customizado";

export type BDIComponente = {
  id: string;
  nome: string;
  descricao: string;
  valor: number;
  categoria: BDICategoria;
  editavel: boolean;
};

export type BDIConfig = {
  id: string;
  nome: string;
  tipo: BDIConfigTipo;
  componentes: BDIComponente[];
  bdiCalculado: number;
  createdAt: string;
  updatedAt: string;
};

export type BDIResultado = {
  bdiPercentual: number;
  fatorBDI: number;
  breakdown: { categoria: string; total: number }[];
};

export type BDIAplicado = {
  uploadId: string;
  bdiConfigId: string;
  bdiPercentual: number;
  valorSemBDI: number;
  valorComBDI: number;
  economia: number;
  dataAplicacao: string;
  itensImpactados: number;
};

export type BDITipoAplicacao = "todos" | "apenas_servicos" | "apenas_materiais";

export type BDIPresetId = "obras" | "fornecimento" | "customizado";
