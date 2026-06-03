import { useCallback, useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { getOrcamento, getOrcamentoFromFirebase } from "../../services/api";
import {
  mapRawListToLinhasAnaliticas,
  type LinhaAnalitica,
} from "./orcamentoAnalitico";
import type { NovoOrcamentoFlowState } from "./outputModels";
import { recalcularGruposAnalitico } from "./recalcularAnaliticoHierarquico";
import { useOrcamentoLinhasContext } from "./OrcamentoLinhasContext";

type LoadStatus = "loading" | "ready" | "empty";

export function useOrcamentoLinhasLoader() {
  const { uploadId: uploadIdParam } = useParams<{ uploadId: string }>();
  const location = useLocation();
  const flowState = location.state as NovoOrcamentoFlowState | null;
  const { linhas: ctxLinhas, uploadId: ctxUploadId, nomeProjeto: ctxNome, setOrcamentoLinhas } =
    useOrcamentoLinhasContext();

  const [status, setStatus] = useState<LoadStatus>("loading");
  const [linhas, setLinhas] = useState<LinhaAnalitica[]>([]);
  const [uploadId, setUploadId] = useState<string | null>(uploadIdParam ?? null);
  const [nomeProjeto, setNomeProjeto] = useState(ctxNome);

  const applyData = useCallback(
    (rawItems: unknown[], nextUploadId?: string, filename?: string) => {
      const mapped = recalcularGruposAnalitico(mapRawListToLinhasAnaliticas(rawItems));
      if (mapped.length === 0) {
        setStatus("empty");
        return false;
      }
      const projeto = filename ? filename.replace(/\.pdf$/i, "") : ctxNome;
      setLinhas(mapped);
      setUploadId(nextUploadId ?? uploadIdParam ?? null);
      setNomeProjeto(projeto);
      setOrcamentoLinhas({ linhas: mapped, uploadId: nextUploadId ?? uploadIdParam ?? null, nomeProjeto: projeto });
      setStatus("ready");
      return true;
    },
    [ctxNome, setOrcamentoLinhas, uploadIdParam],
  );

  useEffect(() => {
    const load = async () => {
      if (
        ctxLinhas.length > 0 &&
        (!uploadIdParam || ctxUploadId === uploadIdParam)
      ) {
        setLinhas(ctxLinhas);
        setUploadId(ctxUploadId);
        setNomeProjeto(ctxNome);
        setStatus("ready");
        return;
      }

      const fromState =
        (flowState?.hierarchicalItems as unknown[] | undefined) ??
        (flowState?.structuredData?.hierarchicalItems as unknown[] | undefined);

      if (Array.isArray(fromState) && fromState.length > 0) {
        applyData(
          fromState,
          flowState?.uploadId as string | undefined,
          (flowState?.file as File | undefined)?.name,
        );
        return;
      }

      const stateItems = location.state?.items as unknown[] | undefined;
      if (Array.isArray(stateItems) && stateItems.length > 0) {
        applyData(stateItems, uploadIdParam);
        return;
      }

      if (!uploadIdParam) {
        setStatus("empty");
        return;
      }

      try {
        const [firebaseDoc, backendDoc] = await Promise.all([
          getOrcamentoFromFirebase(uploadIdParam).catch(() => null),
          getOrcamento(uploadIdParam).catch(() => null),
        ]);

        const itemsData =
          (firebaseDoc?.itemsData as Record<string, unknown> | undefined) ??
          (backendDoc?.orcamento?.itemsData as Record<string, unknown> | undefined);

        const hierarchical =
          (itemsData?.hierarchical_items as unknown[]) ??
          (backendDoc?.orcamento?.hierarchical_items as unknown[]) ??
          (itemsData?.items as unknown[]) ??
          (firebaseDoc?.items as unknown[]) ??
          (backendDoc?.orcamento?.items as unknown[]) ??
          [];

        if (Array.isArray(hierarchical) && hierarchical.length > 0) {
          const filename =
            (firebaseDoc?.filename as string | undefined) ??
            (backendDoc?.orcamento?.filename as string | undefined);
          applyData(hierarchical, uploadIdParam, filename);
          return;
        }

        setStatus("empty");
      } catch {
        setStatus("empty");
      }
    };

    void load();
  }, [
    uploadIdParam,
    flowState,
    location.state,
    applyData,
    ctxLinhas,
    ctxUploadId,
    ctxNome,
  ]);

  const syncLinhas = useCallback(
    (next: LinhaAnalitica[]) => {
      setLinhas(next);
      setOrcamentoLinhas({ linhas: next, uploadId, nomeProjeto });
    },
    [nomeProjeto, setOrcamentoLinhas, uploadId],
  );

  return {
    status,
    linhas,
    uploadId,
    nomeProjeto,
    applyData,
    syncLinhas,
    setNomeProjeto,
  };
}
