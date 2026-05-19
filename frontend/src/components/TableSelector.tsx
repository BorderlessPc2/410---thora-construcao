import React, { useState, useEffect, useCallback, useRef } from "react";
import { Table2, Eye, X } from "lucide-react";
import { btnPrimary } from "./ui/buttonClasses";

const PREVIEW_BASE_HEIGHT_REM = 8;
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

function TableCardPreviewImage({ base64, tableName }: { base64: string; tableName: string }) {
  const { scale, applyWheelDelta, resetZoom } = useWheelZoom(1);
  return (
    <div className="mb-5 flex flex-1 flex-col">
      <ZoomableTableImage
        src={`data:image/png;base64,${base64}`}
        alt={`Print da tabela ${tableName}`}
        baseHeightRem={PREVIEW_BASE_HEIGHT_REM}
        containerClassName="flex max-h-52 min-h-32 flex-1 justify-center overflow-auto rounded-lg border border-slate-100 bg-slate-50/80 p-2"
        scale={scale}
        applyWheelDelta={applyWheelDelta}
        onResetZoom={resetZoom}
      />
      <p className="mt-1.5 text-center text-[10px] leading-tight text-slate-400">
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
  onSelect: (table: MockTableOption) => void;
  onConfirm?: () => void;
}

function TableCardSkeleton() {
  return (
    <div
      className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      aria-hidden="true"
    >
      <div className="mb-4 flex items-center gap-3">
        <div className="h-12 w-12 shrink-0 rounded-lg bg-slate-200" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-[85%] rounded bg-slate-200" />
          <div className="h-3 w-20 rounded bg-slate-100" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-slate-100" />
        <div className="h-3 w-[90%] rounded bg-slate-100" />
        <div className="h-3 w-[70%] rounded bg-slate-100" />
      </div>
      <div className="mt-5 h-10 w-full rounded-lg bg-slate-200" />
    </div>
  );
}

export const TableSelector: React.FC<TableSelectorProps> = ({
  tables,
  loading,
  disabled = false,
  selectedIds = [],
  onSelect,
  onConfirm,
}) => {
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
        className="mt-8 grid w-full max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        role="status"
        aria-label="Analisando documento em busca de tabelas"
      >
        <span className="sr-only">Carregando opções de tabelas…</span>
        <TableCardSkeleton />
        <TableCardSkeleton />
        <TableCardSkeleton />
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl">
      <div
        className={`mt-8 grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 ${
          disabled ? "pointer-events-none opacity-60" : ""
        }`}
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
              className={`flex flex-col rounded-2xl border p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md cursor-pointer ${
                isSelected
                  ? "border-blue-500 bg-blue-50/60 ring-1 ring-blue-500"
                  : "border-slate-200 bg-white"
              }`}
              onClick={() => onSelect(table)}
              aria-labelledby={`table-name-${table.id}`}
              aria-label={`Card de tabela: ${table.name}, página ${table.page}`}
            >
              <div className="mb-4 flex items-start gap-3">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50"
                  aria-hidden="true"
                >
                  <Table2 className="h-6 w-6 text-slate-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3
                    id={`table-name-${table.id}`}
                    className="font-semibold leading-snug text-slate-900"
                  >
                    {table.name}
                  </h3>
                  <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Página {table.page}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {table.imagem_base64 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewImage(table.imagem_base64!);
                      }}
                      className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                      aria-label="Visualizar tabela ampliada"
                    >
                      <Eye className="h-5 w-5" />
                    </button>
                  )}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    readOnly
                    className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </div>
              </div>

              {table.imagem_base64 ? (
                <TableCardPreviewImage base64={table.imagem_base64} tableName={table.name} />
              ) : (
                <div
                  className="mb-5 flex min-h-18 flex-1 rounded-lg border border-slate-100 bg-slate-50/80 p-3 font-mono text-xs leading-relaxed text-slate-600"
                  aria-label={`Prévia do conteúdo: ${table.preview}`}
                >
                  <p className="line-clamp-4">{table.preview}</p>
                </div>
              )}
            </article>
          );
        })}
      </div>
      
      {onConfirm && tables.length > 0 && (
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            className={`${btnPrimary} px-8 py-3 text-sm font-semibold shadow-sm`}
            onClick={onConfirm}
            disabled={disabled || selectedIds.length === 0}
          >
            Processar {selectedIds.length} tabela{selectedIds.length !== 1 ? 's' : ''} com IA
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
