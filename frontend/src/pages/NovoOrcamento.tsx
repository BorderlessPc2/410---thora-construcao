import React, { useState, useCallback } from "react";
import { useDropzone, DropzoneOptions } from "react-dropzone";
import {
  UploadCloud,
  FileText,
  X,
  CheckCircle2,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function NovoOrcamento() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<
    "idle" | "uploading" | "success"
  >("idle");

  // Configuração do Dropzone
  const onDrop = useCallback((acceptedFiles: File[]) => {
    // Aceita apenas o primeiro arquivo
    if (acceptedFiles && acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setUploadStatus("idle");
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

  // Função para remover o arquivo caso o usuário tenha errado
  const removeFile = (e: React.MouseEvent) => {
    e.stopPropagation(); // Evita reabrir a janela de seleção
    setFile(null);
    setUploadStatus("idle");
  };

  // Simulação do envio para o backend
  const handleUpload = () => {
    if (!file) return;

    setUploadStatus("uploading");

    // Aqui entraria sua chamada de API real (fetch/axios)
    setTimeout(() => {
      setUploadStatus("success");

      // --- MUDANÇA AQUI: Redirecionar após o sucesso ---
      // Aguarda 1.5s para o usuário ver o check verde e navega
      setTimeout(() => {
        navigate("/validacao", { state: { file } });
      }, 1500);
      
    }, 2000);
  };

  return (
    <div className="flex flex-col items-center px-6 py-12 min-h-screen bg-slate-50">
      {/* Botão de Voltar */}
      <div className="w-full max-w-2xl mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-sm text-slate-500 hover:text-slate-800 transition"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </button>
      </div>

      <h1 className="text-2xl font-semibold text-gray-900">Novo Orçamento</h1>

      <p className="mt-2 text-gray-500">
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

          <p className="text-lg font-medium text-gray-800">
            {isDragActive
              ? "Pode soltar o arquivo agora"
              : "Arraste e solte seu PDF"}
          </p>

          <p className="text-sm text-gray-500">ou clique para selecionar</p>

          <p className="mt-2 text-xs text-gray-400">
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
                  onClick={removeFile}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-slate-100 rounded-full transition"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Barra de Progresso e Status */}
            {uploadStatus !== "idle" && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`text-sm font-medium flex items-center gap-2 
                    ${uploadStatus === "success" ? "text-emerald-600" : "text-blue-600"}`}
                  >
                    {uploadStatus === "uploading" ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Processando
                        arquivo...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" /> Upload concluído!
                      </>
                    )}
                  </span>
                </div>
                {uploadStatus === "uploading" && (
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 animate-pulse w-2/3 rounded-full"></div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Botão de Ação */}
          <button
            onClick={handleUpload}
            disabled={uploadStatus !== "idle"}
            className={`mt-6 w-full py-3 px-4 rounded-xl font-medium text-white transition flex items-center justify-center gap-2
              ${
                uploadStatus === "success"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
              }`}
          >
            {uploadStatus === "idle" && "Enviar e Processar"}
            {uploadStatus === "uploading" && "Enviando..."}
            {uploadStatus === "success" && "Ir para Validação"}
          </button>
        </div>
      )}
    </div>
  );
}