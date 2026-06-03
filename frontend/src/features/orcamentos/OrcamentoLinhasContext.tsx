import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { LinhaAnalitica } from "./orcamentoAnalitico";

type OrcamentoLinhasSnapshot = {
  linhas: LinhaAnalitica[];
  uploadId: string | null;
  nomeProjeto: string;
};

type OrcamentoLinhasContextValue = OrcamentoLinhasSnapshot & {
  setOrcamentoLinhas: (payload: Partial<OrcamentoLinhasSnapshot>) => void;
  clearOrcamentoLinhas: () => void;
};

const EMPTY: OrcamentoLinhasSnapshot = {
  linhas: [],
  uploadId: null,
  nomeProjeto: "Orçamento",
};

const OrcamentoLinhasContext = createContext<OrcamentoLinhasContextValue | null>(null);

export function OrcamentoLinhasProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<OrcamentoLinhasSnapshot>(EMPTY);

  const setOrcamentoLinhas = useCallback((payload: Partial<OrcamentoLinhasSnapshot>) => {
    setSnapshot((prev) => ({ ...prev, ...payload }));
  }, []);

  const clearOrcamentoLinhas = useCallback(() => {
    setSnapshot(EMPTY);
  }, []);

  const value = useMemo(
    () => ({
      ...snapshot,
      setOrcamentoLinhas,
      clearOrcamentoLinhas,
    }),
    [snapshot, setOrcamentoLinhas, clearOrcamentoLinhas],
  );

  return (
    <OrcamentoLinhasContext.Provider value={value}>{children}</OrcamentoLinhasContext.Provider>
  );
}

export function useOrcamentoLinhasContext(): OrcamentoLinhasContextValue {
  const ctx = useContext(OrcamentoLinhasContext);
  if (!ctx) {
    throw new Error("useOrcamentoLinhasContext deve ser usado dentro de OrcamentoLinhasProvider");
  }
  return ctx;
}
