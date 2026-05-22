import React, { useCallback, useState } from "react";
import { useDropzone, DropzoneOptions } from "react-dropzone";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Check,
  FileSpreadsheet,
  FileText,
  Layers,
  Loader2,
  UploadCloud,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { btnPrimary, btnMuted } from "../components/ui/buttonClasses";
import { TableSelector, type MockTableOption } from "../components/TableSelector";
import { WizardStepper } from "../components/WizardStepper";
import { NOVO_ORCAMENTO_WIZARD_STEPS } from "../features/orcamentos/novoOrcamentoWizard";
import {
  DEFAULT_OUTPUT_MODELS,
  hasAnyOutputModelSelected,
  OUTPUT_MODEL_OPTIONS,
  type OutputModelId,
  type OutputModelsSelection,
} from "../features/orcamentos/outputModels";
import {
  detectOrcamentoTables,
  processOrcamentoConfirmed,
  uploadPDF,
} from "../services/api";

type WizardStepId = 1 | 2;
type UploadPhase = "idle" | "uploading" | "detecting" | "processing_ai";

const MODEL_ICONS: Record<OutputModelId, React.ReactNode> = {
  analitico: <FileSpreadsheet className="h-5 w-5" aria-hidden="true" />,
  sintetico: <Layers className="h-5 w-5" aria-hidden="true" />,
  curva_abc: <BarChart3 className="h-5 w-5" aria-hidden="true" />,
};

export default function NovoOrcamento() {
  const navigate = useNavigate();
  const [wizardStep, setWizardStep] = useState<WizardStepId>(1);
  const [nomeProjeto, setNomeProjeto] = useState("");
  const [modelosSelecionados, setModelosSelecionados] =
    useState<OutputModelsSelection>({ ...DEFAULT_OUTPUT_MODELS });
  const [file, setFile] = useState<File | null>(null);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>("idle");
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [tableOptions, setTableOptions] = useState<MockTableOption[]>([]);
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  const nomeProjetoValido = nomeProjeto.trim().length >= 2;
  const modelosValidos = hasAnyOutputModelSelected(modelosSelecionados);
  const step1Valido = nomeProjetoValido && modelosValidos && Boolean(file);
  const isBusy = uploadPhase !== "idle";

  const toggleModelo = (id: OutputModelId) => {
    setModelosSelecionados((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      if (!hasAnyOutputModelSelected(next)) {
        toast.warning("Selecione ao menos um modelo de saída");
        return prev;
      }
      return next;
    });
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setUploadId(null);
      setTableOptions([]);
      setSelectedTableIds([]);
      setErrorMessage("");
      setUploadPhase("idle");
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    multiple: false,
    disabled: !nomeProjetoValido || !modelosValidos || isBusy,
  } as unknown as DropzoneOptions);

  const removeFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFile(null);
    setUploadId(null);
    setTableOptions([]);
    setSelectedTableIds([]);
    setErrorMessage("");
    setUploadPhase("idle");
  };

  const runUploadAndDetect = async () => {
    if (!file || !step1Valido) {
      if (!nomeProjetoValido) {
        toast.error("Informe o nome do projeto");
      } else if (!modelosValidos) {
        toast.error("Selecione ao menos um modelo");
      } else if (!file) {
        toast.error("Envie o PDF do orçamento");
      }
      return;
    }

    setErrorMessage("");
    try {
      setUploadPhase("uploading");
      const uploadResponse = await uploadPDF(file);
      const currentUploadId = uploadResponse.upload_id as string;
      setUploadId(currentUploadId);

      setUploadPhase("detecting");
      const detectResponse = await detectOrcamentoTables(currentUploadId);
      const mappedOptions: MockTableOption[] = (detectResponse.options || []).map(
        (option) => ({
          id: option.id,
          name: option.nome_tabela || `Página ${option.pagina}`,
          page: option.num_pagina || option.pagina,
          preview: option.preview_texto || "Visualização disponível via imagem.",
          imagem_base64: option.imagem_base64,
        }),
      );

      setTableOptions(mappedOptions);
      const recommended = detectResponse.recommended_table_ids ?? [];
      const validRecommended = recommended.filter((id) =>
        mappedOptions.some((t) => t.id === id),
      );
      setSelectedTableIds(validRecommended);
      setUploadPhase("idle");
      setWizardStep(2);
      toast.success("Tabelas encontradas", {
        description:
          validRecommended.length > 0
            ? `${mappedOptions.length} opção(ões); ${validRecommended.length} planilha(s) de orçamento pré-selecionada(s).`
            : `${mappedOptions.length} opção(ões) detectada(s). Selecione as páginas da planilha analítica (Código, Qtde, Preço).`,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Erro ao processar arquivo";
      setErrorMessage(msg);
      setUploadPhase("idle");
      toast.error("Falha no envio", { description: msg });
    }
  };

  const handleSelectTable = (table: MockTableOption) => {
    setSelectedTableIds((prev) =>
      prev.includes(table.id)
        ? prev.filter((id) => id !== table.id)
        : [...prev, table.id],
    );
  };

  const handleConfirmSelection = async () => {
    if (!file || !uploadId || selectedTableIds.length === 0) return;

    setUploadPhase("processing_ai");
    toast.success(
      `${selectedTableIds.length} tabela(s) selecionada(s). Preparando validação…`,
    );

    try {
      const result = await processOrcamentoConfirmed(uploadId, selectedTableIds);
      const selectedTablePreviews = selectedTableIds
        .map((id) => tableOptions.find((t) => t.id === id))
        .filter((t): t is MockTableOption => Boolean(t))
        .map((t) => ({
          id: t.id,
          name: t.name,
          page: t.page,
          imagem_base64: t.imagem_base64,
        }));

      navigate(`/validacao/${uploadId}`, {
        state: {
          nomeProjeto: nomeProjeto.trim(),
          modelosSelecionados,
          file,
          uploadId: result.upload_id ?? uploadId,
          selectedTableIds,
          selectedTablePreviews,
          extractedData: result.tables ?? [],
          structuredData: {
            items: result.structured_items ?? result.items ?? [],
            resumo: result.resumo,
          },
          iaMetadata: result.ia_metadata,
        },
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Erro ao processar com IA";
      setErrorMessage(msg);
      setUploadPhase("idle");
      toast.error("Falha ao processar", { description: msg });
    }
  };

  const goBackToStep1 = () => {
    if (isBusy) return;
    setWizardStep(1);
    setErrorMessage("");
  };

  return (
    <div className="w-full bg-slate-50">
      <div className="mx-auto w-full max-w-4xl px-4 py-4 pb-10 sm:px-6 sm:py-6">
        <header className="mb-4">
          <h1 className="text-lg font-bold text-slate-900 sm:text-xl">Novo Orçamento</h1>
          <p className="mt-1 text-sm text-slate-600">
            Passo {wizardStep} de 3 — configure o projeto e envie o PDF.
          </p>
        </header>

        <WizardStepper
          steps={NOVO_ORCAMENTO_WIZARD_STEPS}
          currentStep={wizardStep}
          className="mb-5"
        />

        {errorMessage && (
          <div className="mb-4 flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        )}

        {wizardStep === 1 && (
          <div className="space-y-4">
            <section className="rounded-xl border border-violet-200/70 bg-white p-4 shadow-sm sm:p-5">
              <label
                htmlFor="nome-projeto"
                className="block text-sm font-semibold text-slate-900"
              >
                Nome do Projeto / Orçamento
                <span className="ml-1 text-red-500" aria-hidden="true">
                  *
                </span>
              </label>
              <p className="mt-1 text-xs text-slate-500">
                Aparece na validação e nos relatórios.
              </p>
              <input
                id="nome-projeto"
                type="text"
                value={nomeProjeto}
                onChange={(e) => setNomeProjeto(e.target.value)}
                placeholder="Ex.: Edifício Centro - Reforma 2026"
                maxLength={120}
                className={`mt-3 w-full rounded-lg border px-3 py-2.5 text-sm font-medium text-slate-900 shadow-sm transition placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                  nomeProjeto.length > 0 && !nomeProjetoValido
                    ? "border-amber-300 focus:border-amber-400 focus:ring-amber-200"
                    : "border-slate-200 focus:border-violet-400 focus:ring-violet-200"
                }`}
                aria-required="true"
              />
              {nomeProjeto.length > 0 && !nomeProjetoValido && (
                <p className="mt-2 text-sm text-amber-700">Use pelo menos 2 caracteres.</p>
              )}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="text-sm font-semibold text-slate-900">
                Modelos do Excel final
              </h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {OUTPUT_MODEL_OPTIONS.map((opt) => {
                  const selected = modelosSelecionados[opt.id];
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="checkbox"
                      aria-checked={selected}
                      title={opt.description}
                      onClick={() => toggleModelo(opt.id)}
                      className={`flex flex-col items-start gap-2 rounded-lg border-2 p-3 text-left transition ${
                        selected
                          ? "border-violet-500 bg-violet-50/80"
                          : "border-slate-200 bg-slate-50/50 hover:border-slate-300"
                      }`}
                    >
                      <span className="flex w-full items-center justify-between gap-2">
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                            selected
                              ? "bg-violet-100 text-violet-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {MODEL_ICONS[opt.id]}
                        </span>
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                            selected
                              ? "border-violet-600 bg-violet-600 text-white"
                              : "border-slate-300 bg-white text-transparent"
                          }`}
                        >
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </span>
                      </span>
                      <span className="text-xs font-semibold leading-snug text-slate-900 sm:text-sm">
                        {opt.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="text-sm font-semibold text-slate-900">PDF do orçamento</h2>
              <p className="mt-1 text-xs text-slate-500">
                Documento analisado na próxima etapa.
              </p>

              {!file ? (
                <div
                  {...getRootProps()}
                  className={`mt-3 rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${
                    !nomeProjetoValido || !modelosValidos
                      ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-70"
                      : isDragActive
                        ? "cursor-pointer border-blue-500 bg-blue-50"
                        : "cursor-pointer border-blue-200 bg-slate-50/50 hover:border-blue-400 hover:bg-blue-50/40"
                  }`}
                >
                  <input
                    {...(getInputProps() as React.InputHTMLAttributes<HTMLInputElement>)}
                    disabled={!nomeProjetoValido || !modelosValidos || isBusy}
                  />
                  <div
                    className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl ${
                      nomeProjetoValido && modelosValidos ? "bg-blue-50" : "bg-slate-200"
                    }`}
                  >
                    <UploadCloud
                      className={`h-6 w-6 ${
                        nomeProjetoValido && modelosValidos
                          ? "text-blue-500"
                          : "text-slate-400"
                      }`}
                    />
                  </div>
                  <p className="text-sm font-medium text-slate-800">
                    {nomeProjetoValido && modelosValidos
                      ? isDragActive
                        ? "Solte o PDF aqui"
                        : "Arraste o PDF ou clique para selecionar"
                      : "Preencha o nome e os modelos antes do PDF"}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">Até 50 MB · formato PDF</p>
                </div>
              ) : (
                <div className="mt-3 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/80 p-4">
                  <div className="rounded-lg bg-red-50 p-2">
                    <FileText className="h-7 w-7 text-red-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900">{file.name}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  {!isBusy && (
                    <button
                      type="button"
                      onClick={removeFile}
                      className="rounded-full p-2 text-slate-400 hover:bg-white hover:text-red-600"
                      aria-label="Remover PDF"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}
                </div>
              )}

              {isBusy && wizardStep === 1 && (
                <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50/80 px-4 py-4" role="status">
                  <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {uploadPhase === "uploading"
                      ? "Enviando PDF…"
                      : "Detectando tabelas no documento…"}
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-blue-100">
                    <div
                      className={`h-full rounded-full bg-blue-600 transition-all ${
                        uploadPhase === "uploading" ? "w-1/3 animate-pulse" : "w-2/3 animate-pulse"
                      }`}
                    />
                  </div>
                </div>
              )}
            </section>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => void runUploadAndDetect()}
                disabled={!step1Valido || isBusy}
                className={`${btnPrimary} inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm disabled:opacity-50`}
              >
                {isBusy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processando…
                  </>
                ) : (
                  <>
                    Continuar para tabelas
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {wizardStep === 2 && (
          <div className="space-y-5 pb-6">
            <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-8">
              <div className="min-w-0">
                <p className="text-sm font-medium text-violet-700">{nomeProjeto.trim()}</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  Selecione as tabelas do orçamento
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Marque todas as tabelas que contêm os itens do orçamento. Use a prévia ampliada
                  para conferir o conteúdo antes de continuar.
                </p>
                {file && (
                  <p className="mt-2 truncate text-xs text-slate-500" title={file.name}>
                    {file.name}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={goBackToStep1}
                disabled={isBusy}
                className={`${btnMuted} inline-flex shrink-0 items-center gap-2 self-start sm:self-center`}
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </button>
            </div>

            <TableSelector
              layout="large"
              tables={tableOptions}
              loading={uploadPhase === "uploading" || uploadPhase === "detecting"}
              disabled={uploadPhase === "processing_ai"}
              selectedIds={selectedTableIds}
              onSelect={handleSelectTable}
              onConfirm={handleConfirmSelection}
              confirmLabel="Continuar para validação"
            />

            {uploadPhase === "processing_ai" && (
              <div
                className="rounded-2xl border border-blue-100 bg-blue-50 px-6 py-5 text-center"
                role="status"
              >
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
                <p className="mt-3 font-medium text-blue-800">Processando com IA…</p>
                <p className="mt-1 text-sm text-blue-600">
                  Em instantes você será levado à tela de validação dos valores.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
