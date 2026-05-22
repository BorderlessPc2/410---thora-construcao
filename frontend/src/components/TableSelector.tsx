import React, { useState, useEffect, useCallback, useRef } from "react";
import { Table2, Eye, X } from "lucide-react";
import { btnPrimary } from "./ui/buttonClasses";

const PREVIEW_BASE_HEIGHT_REM = 8;
const PREVIEW_BASE_HEIGHT_LARGE_REM = 26;
const ZOOM_MIN = 0.6;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.12;

function useWheelZoom(initialScale = 1) {
  const [scale, setScale] = useState(initialScale);

  /** Usado com addEventListener(..., { passive: false }) — o onWheel do React é passivo e não permite preventDefault. */
  const applyWheelDelta = useCallback((delta: number) => {
    setScale((s) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, s + delta)));
  }, []);

  const resetZoom = useCallback(() => setScale(1), []);

  return { scale, applyWheelDelta, resetZoom };
}

const MODAL_PREVIEW_BASE_HEIGHT_REM = 36;

interface ZoomableTableImageProps {
  src: string;
  alt: string;
  /** Altura base em rem (prévia no card vs. modal) */
  baseHeightRem: number;
  containerClassName: string;
  scale: number;
  applyWheelDelta: (delta: number) => void;
  onResetZoom?: () => void;
}

function ZoomableTableImage({
  src,
  alt,
  baseHeightRem,
  containerClassName,
  scale,
  applyWheelDelta,
  onResetZoom,
}: ZoomableTableImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handler = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const step = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
      applyWheelDelta(step);
    };

    el.addEventListener("wheel", handler, { passive: false });
    return () => {
      el.removeEventListener("wheel", handler);
    };
  }, [applyWheelDelta]);

  return (
    <div
      ref={containerRef}
      className={containerClassName}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onResetZoom?.();
      }}
      role="region"
      aria-label="Prévia da tabela — use a roda do mouse para ampliar ou reduzir; duplo clique redefine o zoom"
    >
      <div className="flex justify-center py-1">
        <img
          src={src}
          alt={alt}
          className="object-contain object-top select-none"
          draggable={false}
          style={{
            height: `${baseHeightRem * scale}rem`,
            width: "auto",
            maxWidth: "none",
          }}
        />
      </div>
    </div>
  );
}

function TableCardPreviewImage({
  base64,
  tableName,
  large = false,
}: {
  base64: string;
  tableName: string;
  large?: boolean;
}) {
  const { scale, applyWheelDelta, resetZoom } = useWheelZoom(1);
  return (
    <div className={`flex flex-1 flex-col ${large ? "mb-2" : "mb-5"}`}>
      <ZoomableTableImage
        src={`data:image/png;base64,${base64}`}
        alt={`Print da tabela ${tableName}`}
        baseHeightRem={large ? PREVIEW_BASE_HEIGHT_LARGE_REM : PREVIEW_BASE_HEIGHT_REM}
        containerClassName={
          large
            ? "flex min-h-88 max-h-[32rem] flex-1 justify-center overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3"
            : "flex max-h-52 min-h-32 flex-1 justify-center overflow-auto rounded-lg border border-slate-100 bg-slate-50/80 p-2"
        }
        scale={scale}
        applyWheelDelta={applyWheelDelta}
        onResetZoom={resetZoom}
      />
      <p
        className={`mt-2 text-center leading-tight text-slate-400 ${
          large ? "text-xs" : "text-[10px]"
        }`}
      >
        Roda do mouse na prévia para zoom · duplo clique para redefinir
      </p>
    </div>
  );
}

function ExpandedTableModalContent({ imageBase64 }: { imageBase64: string }) {
  const { scale, applyWheelDelta, resetZoom } = useWheelZoom(1);
  useEffect(() => {
    resetZoom();
  }, [imageBase64, resetZoom]);

  return (
    <>
      <p className="mb-2 px-1 text-center text-xs text-slate-500">
        Roda do mouse para zoom · duplo clique na imagem para redefinir
      </p>
      <ZoomableTableImage
        src={`data:image/png;base64,${imageBase64}`}
        alt="Visualização ampliada da tabela"
        baseHeightRem={MODAL_PREVIEW_BASE_HEIGHT_REM}
        containerClassName="max-h-[calc(90vh-5rem)] overflow-auto rounded bg-slate-50 p-2"
        scale={scale}
        applyWheelDelta={applyWheelDelta}
        onResetZoom={resetZoom}
      />
    </>
  );
}

export interface MockTableOption {
  id: string;
  name: string;
  page: number;
  preview: string;
  imagem_base64?: string;
}

interface TableSelectorProps {
  tables: MockTableOption[];
  loading: boolean;
  disabled?: boolean;
  selectedIds?: string[];
  layout?: "default" | "large";
  confirmLabel?: string;
  onSelect: (table: MockTableOption) => void;
  onConfirm?: () => void;
}

function TableCardSkeleton({ large = false }: { large?: boolean }) {
  return (
    <div
      className={`animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm ${
        large ? "p-6 sm:p-8" : "p-5"
      }`}
      aria-hidden="true"
    >
      <div className="mb-5 flex items-center gap-4">
        <div className={`shrink-0 rounded-xl bg-slate-200 ${large ? "h-14 w-14" : "h-12 w-12"}`} />
        <div className="flex-1 space-y-2">
          <div className={`rounded bg-slate-200 ${large ? "h-5 w-[70%]" : "h-4 w-[85%]"}`} />
          <div className="h-3 w-24 rounded bg-slate-100" />
        </div>
      </div>
      <div className={`rounded-xl bg-slate-100 ${large ? "min-h-88" : "h-32"}`} />
    </div>
  );
}

export const TableSelector: React.FC<TableSelectorProps> = ({
  tables,
  loading,
  disabled = false,
  selectedIds = [],
  layout = "default",
  confirmLabel = "Processar com IA",
  onSelect,
  onConfirm,
}) => {
  const isLarge = layout === "large";
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPreviewImage(null);
      }
    };
    if (previewImage) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [previewImage]);

  if (loading) {
    return (
      <div
        className={`grid w-full grid-cols-1 ${
          isLarge ? "gap-8 lg:grid-cols-2" : "mt-8 max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3"
        }`}
        role="status"
        aria-label="Analisando documento em busca de tabelas"
      >
        <span className="sr-only">Carregando opções de tabelas…</span>
        <TableCardSkeleton large={isLarge} />
        <TableCardSkeleton large={isLarge} />
        <TableCardSkeleton large={isLarge} />
      </div>
    );
  }

  return (
    <div className="w-full">
      <div
        className={`grid w-full grid-cols-1 ${
          isLarge ? "gap-8 lg:grid-cols-2" : "mt-8 max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3"
        } ${disabled ? "pointer-events-none opacity-60" : ""}`}
        role="list"
        aria-label="Tabelas detectadas no documento"
        aria-busy={disabled}
      >
        {tables.map((table) => {
          const isSelected = selectedIds.includes(table.id);
          return (
            <article
              key={table.id}
              role="listitem"
              className={`flex cursor-pointer flex-col rounded-2xl border shadow-sm transition hover:border-slate-300 hover:shadow-lg ${
                isLarge ? "p-6 sm:p-8" : "p-5"
              } ${
                isSelected
                  ? "border-blue-500 bg-blue-50/60 ring-2 ring-blue-400/80"
                  : "border-slate-200 bg-white"
              }`}
              onClick={() => onSelect(table)}
              aria-labelledby={`table-name-${table.id}`}
              aria-label={`Card de tabela: ${table.name}, página ${table.page}`}
            >
              <div className={`flex items-start gap-4 ${isLarge ? "mb-5" : "mb-4"}`}>
                <div
                  className={`flex shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 ${
                    isLarge ? "h-14 w-14" : "h-12 w-12"
                  }`}
                  aria-hidden="true"
                >
                  <Table2 className={isLarge ? "h-7 w-7" : "h-6 w-6"} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3
                    id={`table-name-${table.id}`}
                    className={`font-semibold leading-snug text-slate-900 ${
                      isLarge ? "text-lg" : ""
                    }`}
                  >
                    {table.name}
                  </h3>
                  <p
                    className={`mt-1 font-medium uppercase tracking-wide text-slate-500 ${
                      isLarge ? "text-sm" : "text-xs"
                    }`}
                  >
                    Página {table.page}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {table.imagem_base64 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewImage(table.imagem_base64!);
                      }}
                      className={`rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 ${
                        isLarge ? "p-2.5" : "p-1.5"
                      }`}
                      aria-label="Visualizar tabela em tela cheia"
                    >
                      <Eye className={isLarge ? "h-6 w-6" : "h-5 w-5"} />
                    </button>
                  )}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    readOnly
                    className={`cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500 ${
                      isLarge ? "h-6 w-6" : "h-5 w-5"
                    }`}
                  />
                </div>
              </div>

              {table.imagem_base64 ? (
                <TableCardPreviewImage
                  base64={table.imagem_base64}
                  tableName={table.name}
                  large={isLarge}
                />
              ) : (
                <div
                  className={`flex flex-1 rounded-xl border border-slate-100 bg-slate-50/80 font-mono leading-relaxed text-slate-600 ${
                    isLarge
                      ? "min-h-72 p-5 text-sm"
                      : "mb-5 min-h-18 p-3 text-xs"
                  }`}
                  aria-label={`Prévia do conteúdo: ${table.preview}`}
                >
                  <p className={isLarge ? "line-clamp-12" : "line-clamp-4"}>{table.preview}</p>
                </div>
              )}
            </article>
          );
        })}
      </div>
      
      {onConfirm && tables.length > 0 && (
        <div
          className={`flex flex-col gap-3 border-t border-slate-200 sm:flex-row sm:items-center sm:justify-between ${
            isLarge ? "mt-10 pt-8" : "mt-6"
          }`}
        >
          <p className="text-sm text-slate-600">
            {selectedIds.length === 0
              ? "Selecione ao menos uma tabela para continuar."
              : `${selectedIds.length} tabela(s) selecionada(s)`}
          </p>
          <button
            type="button"
            className={`${btnPrimary} px-8 py-3.5 text-base font-semibold shadow-sm sm:shrink-0`}
            onClick={onConfirm}
            disabled={disabled || selectedIds.length === 0}
          >
            {confirmLabel}
            {selectedIds.length > 0
              ? ` (${selectedIds.length})`
              : ""}
          </button>
        </div>
      )}

      {/* Modal de Preview */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewImage(null)}
          aria-modal="true"
          role="dialog"
        >
          <div 
            className="relative flex max-h-[90vh] max-w-[90vw] flex-col rounded-lg bg-white p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute -top-4 -right-4 flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-700 shadow hover:bg-slate-100 focus:outline-none"
              aria-label="Fechar visualização"
            >
              <X className="h-5 w-5" />
            </button>
            <ExpandedTableModalContent imageBase64={previewImage} />
          </div>
        </div>
      )}
    </div>
  );
};
