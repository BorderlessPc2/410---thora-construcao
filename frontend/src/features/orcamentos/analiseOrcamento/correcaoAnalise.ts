import type {
  ResultadoAnaliseOrcamento,
  ResultadoLinhaAnalise,
  VerificacaoLinha,
} from "./types";

export type DadosExtraidosLinha = {
  itemNumero?: string;
  codigo?: string;
  banco?: string;
  descricao?: string;
  unidade?: string;
  quantidade?: number;
  precoUnitario?: number;
  precoTotalSemBdi?: number;
  bdiPercent?: number;
  precoTotalComBdi?: number;
  observacoes?: string;
};

export type CorrecaoAnalisePayload = {
  upload_id?: string;
  versao_modelo: string;
  nome_arquivo?: string;
  contexto: {
    bdi_global_percent: number;
    tolerancia_monetaria: number;
    tolerancia_percentual: number;
  };
  linhas_com_problema: Array<{
    linha_id: string | number;
    item_numero: string;
    descricao: string;
    status_geral: string;
    verificacoes: VerificacaoLinha[];
    dados_extraidos?: DadosExtraidosLinha;
    memoria_calculo?: ResultadoLinhaAnalise["memoriaCalculo"];
  }>;
};

function verificacoesRelevantes(verificacoes: VerificacaoLinha[]): VerificacaoLinha[] {
  return verificacoes.filter(
    (v) => v.status !== "ok" && v.status !== "nao_aplicavel",
  );
}

export function linhasComProblema(resultado: ResultadoAnaliseOrcamento): ResultadoLinhaAnalise[] {
  return resultado.linhas.filter(
    (linha) => linha.statusGeral === "reprovado" || linha.statusGeral === "alerta",
  );
}

export function buildCorrecaoAnalisePayload(
  resultado: ResultadoAnaliseOrcamento,
  options?: {
    uploadId?: string;
    nomeArquivo?: string;
    dadosExtraidosPorId?: Map<string | number, DadosExtraidosLinha>;
    filtro?: "todos" | "reprovado" | "alerta";
  },
): CorrecaoAnalisePayload {
  const filtro = options?.filtro ?? "todos";
  let linhas = linhasComProblema(resultado);
  if (filtro !== "todos") {
    linhas = linhas.filter((l) => l.statusGeral === filtro);
  }

  return {
    upload_id: options?.uploadId,
    versao_modelo: resultado.versaoModelo,
    nome_arquivo: options?.nomeArquivo,
    contexto: {
      bdi_global_percent: resultado.contexto.bdiGlobalPercent,
      tolerancia_monetaria: resultado.contexto.toleranciaMonetaria,
      tolerancia_percentual: resultado.contexto.toleranciaPercentual,
    },
    linhas_com_problema: linhas.map((linha) => ({
      linha_id: linha.linhaId,
      item_numero: linha.itemNumero,
      descricao: linha.descricao,
      status_geral: linha.statusGeral,
      verificacoes: verificacoesRelevantes(linha.verificacoes),
      dados_extraidos: options?.dadosExtraidosPorId?.get(linha.linhaId),
      memoria_calculo: linha.memoriaCalculo,
    })),
  };
}

export type CorrecaoAnaliseResposta = {
  diagnostico_geral: string;
  itens: Array<{
    linha_id?: string | number;
    item_numero?: string;
    causa_provavel?: string;
    tipo_problema?: string;
    correcao_sugerida?: string;
    regra_prompt?: string | null;
  }>;
  aprendizados_para_extracao: string[];
  aprendizados_totais: string[];
  escopo?: "global";
  total_regras_globais?: number;
  model: string;
  provider: string;
};
