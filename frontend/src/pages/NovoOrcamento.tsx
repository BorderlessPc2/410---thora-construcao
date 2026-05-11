import React, { useState, useCallback } from "react";
import { useDropzone, DropzoneOptions } from "react-dropzone";
import {
  UploadCloud,
  FileText,
  X,
  CheckCircle2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { uploadPDF, extractPDF } from "../services/api";
import { btnPrimary } from "../components/ui/buttonClasses";

export default function NovoOrcamento() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<
    "idle" | "uploading" | "success" | "error"
  >("idle");
  const [uploadStep, setUploadStep] = useState<"upload" | "extract">("upload");
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Configuração do Dropzone
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setUploadStatus("idle");
      setErrorMessage("");
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
    },
    maxFiles: 1,
    multiple: false,
  } as unknown as DropzoneOptions);

  // Remover arquivo
  const removeFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFile(null);
    setUploadStatus("idle");
    setErrorMessage("");
  };

  // Upload real com backend
  const handleUpload = async () => {
    if (!file) return;

    setUploadStatus("uploading");
    setUploadStep("upload");
    setErrorMessage("");

    try {
      // Step 1: Upload do arquivo
      const uploadResponse = await uploadPDF(file);
      const uploadId = uploadResponse.upload_id;

      setUploadStep("extract");
      const extractResponse = await extractPDF(uploadId);

      setUploadStatus("success");
      toast.success("PDF processado", {
        description: "Abrindo a tela de validação…",
      });
      navigate("/validacao", {
        state: {
          file,
          uploadId,
          extractedData: extractResponse.tables,
        },
      });
    } catch (error: any) {
      console.error("Erro no upload:", error.message);
      setUploadStatus("error");
      const msg = error.message || "Erro ao processar arquivo";
      setErrorMessage(msg);
      toast.error("Falha no processamento", { description: msg });
    }
  };

  return (
    <div className="flex-1 overflow-auto flex flex-col items-center px-6 py-12 bg-slate-50">
      <h1 className="text-2xl font-semibold text-slate-900">Novo Orçamento</h1>

      <p className="mt-2 text-slate-600">
        Faça upload do PDF da planilha para começar a extração dos dados
      </p>

      {/* ÁREA DE DROPZONE */}
      {!file ? (
        // ESTADO 1: Nenhum arquivo selecionado
        <div
          {...getRootProps()}
          className={`mt-8 w-full max-w-2xl cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition duration-200
            ${
              isDragActive
                ? "border-blue-500 bg-blue-50"
                : "border-blue-200 bg-white hover:border-blue-400 hover:bg-blue-50/30"
            }`}
        >
          <input {...(getInputProps() as any)} />

          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
            <UploadCloud
              className={`h-7 w-7 ${isDragActive ? "text-blue-600" : "text-blue-500"}`}
            />
          </div>

          <p className="text-lg font-medium text-slate-800">
            {isDragActive
              ? "Pode soltar o arquivo agora"
              : "Arraste e solte seu PDF"}
          </p>

          <p className="text-sm text-slate-500">ou clique para selecionar</p>

          <p className="mt-2 text-xs text-slate-400">
            Suporta arquivos PDF de até 50MB
          </p>
        </div>
      ) : (
        // ESTADO 2: Arquivo Selecionado (Preview)
        <div className="mt-8 w-full max-w-2xl">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm relative overflow-hidden">
            <div className="flex items-center gap-4">
              <div className="bg-red-50 p-3 rounded-lg">
                <FileText className="w-8 h-8 text-red-500" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-slate-900 truncate">
                  {file.name}
                </p>
                <p className="text-sm text-slate-500">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>

              {/* Botão de Remover (só aparece se não estiver enviando ou finalizado) */}
              {uploadStatus === "idle" && (
                <button
                  type="button"
                  onClick={removeFile}
                  className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-red-600"
                  aria-label="Remover arquivo selecionado"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* Barra de Progresso e Status */}
            {uploadStatus !== "idle" && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`text-sm font-medium flex items-center gap-2 
                    ${uploadStatus === "success" ? "text-emerald-600" : uploadStatus === "error" ? "text-red-600" : "text-blue-600"}`}
                  >
                    {uploadStatus === "uploading" ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {uploadStep === "upload"
                          ? " Enviando arquivo..."
                          : " Extraindo dados do PDF..."}
                      </>
                    ) : uploadStatus === "success" ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" /> Upload concluído!
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4" /> Erro no upload
                      </>
                    )}
                  </span>
                </div>
                {uploadStatus === "uploading" && (
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 animate-pulse w-2/3 rounded-full"></div>
                  </div>
                )}
                {uploadStatus === "error" && errorMessage && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                    {errorMessage}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Botão de Ação */}
          <button
            type="button"
            onClick={handleUpload}
            disabled={uploadStatus !== "idle"}
            className={`${btnPrimary} mt-6 w-full py-3 ${
              uploadStatus === "success"
                ? "!bg-emerald-600 hover:!bg-emerald-700"
                : ""
            } disabled:cursor-not-allowed`}
          >
            {uploadStatus === "idle" && "Enviar e processar"}
            {uploadStatus === "uploading" && "Enviando…"}
            {uploadStatus === "success" && "Continuar"}
          </button>
        </div>
      )}
    </div>
  );
}
