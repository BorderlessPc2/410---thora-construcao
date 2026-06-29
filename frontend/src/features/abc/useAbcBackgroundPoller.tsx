import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { getAbcBatchStatus, type AbcAnalysisJob } from "../../services/abcAnalysis";
import {
  loadActiveAbcJobs,
  markAbcJobNotified,
  untrackAbcBackgroundJob,
  wasAbcJobNotified,
} from "./abcBackgroundJobs";

/** Só para toast quando o usuário saiu da tela de processamento. */
const POLL_MS = 12_000;

export function useAbcBackgroundPoller(): void {
  const navigate = useNavigate();
  const pollingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      if (pollingRef.current) return;
      const uploadIds = loadActiveAbcJobs().filter(
        (id) => id && !id.startsWith("pending-"),
      );
      if (uploadIds.length === 0) return;

      pollingRef.current = true;
      try {
        const jobs = (await getAbcBatchStatus(uploadIds)) ?? [];
        if (cancelled) return;

        for (const job of jobs) {
          handleTerminalJob(job, navigate);
        }

        const terminalIds = new Set(
          jobs
            .filter((job) => job.status === "completed" || job.status === "failed")
            .map((job) => job.upload_id),
        );
        for (const uploadId of uploadIds) {
          if (terminalIds.has(uploadId)) {
            untrackAbcBackgroundJob(uploadId);
          }
        }
      } catch {
        /* falha pontual — próximo ciclo tenta de novo */
      } finally {
        pollingRef.current = false;
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [navigate]);
}

function handleTerminalJob(job: AbcAnalysisJob, navigate: ReturnType<typeof useNavigate>): void {
  if (job.status !== "completed" && job.status !== "failed") {
    return;
  }
  if (wasAbcJobNotified(job.upload_id)) {
    untrackAbcBackgroundJob(job.upload_id);
    return;
  }

  markAbcJobNotified(job.upload_id);
  untrackAbcBackgroundJob(job.upload_id);

  if (job.status === "completed") {
    const itemsLabel =
      typeof job.items_found === "number" && job.items_found > 0
        ? `${job.items_found} item(ns) salvos`
        : "PDF e itens salvos";
    toast.success(`Análise concluída: ${job.filename}`, {
      description: `${itemsLabel}. Abra a validação para revisar os dados.`,
      duration: 12000,
      action: {
        label: "Abrir validação",
        onClick: () => navigate(`/validacao/${job.upload_id}`),
      },
    });
    return;
  }

  toast.error(`Falha na análise: ${job.filename}`, {
    description: job.error || job.message || "Tente enviar o PDF novamente.",
    duration: 10000,
    action: {
      label: "Nova análise",
      onClick: () => navigate("/orcamento"),
    },
  });
}
