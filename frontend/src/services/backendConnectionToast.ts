import { toast } from "sonner";
import { pingApiHealthLight, wakeApiServer } from "./api";
import { shouldEnableBackendKeepAlive } from "./backendKeepAlive";

const TOAST_ID = "backend-connection-status";
const POLL_WHEN_UP_MS = 45_000;
const POLL_WHEN_DOWN_MS = 12_000;
const FAILS_BEFORE_UNAVAILABLE = 3;

type BackendStatus = "idle" | "waking" | "connected" | "unavailable";

let currentStatus: BackendStatus = "idle";
let consecutiveFails = 0;
let monitorActive = false;
let pollTimer: number | null = null;
let inFlight = false;

function clearPollTimer(): void {
  if (pollTimer != null) {
    window.clearTimeout(pollTimer);
    pollTimer = null;
  }
}

function scheduleNextPoll(delayMs: number): void {
  clearPollTimer();
  if (!monitorActive) return;
  pollTimer = window.setTimeout(() => {
    void tick();
  }, delayMs);
}

function showStatus(status: BackendStatus): void {
  if (status === currentStatus) return;
  currentStatus = status;

  if (status === "waking") {
    toast.loading("Backend acordando...", {
      id: TOAST_ID,
      description: "Aguarde — o servidor no Render está iniciando.",
      duration: Infinity,
      closeButton: false,
    });
    return;
  }

  if (status === "connected") {
    toast.success("Backend conectado", {
      id: TOAST_ID,
      description: "API online e pronta para uso.",
      duration: Infinity,
      closeButton: false,
    });
    return;
  }

  if (status === "unavailable") {
    toast.error("Backend indisponível", {
      id: TOAST_ID,
      description: "Tentando reconectar automaticamente...",
      duration: Infinity,
      closeButton: false,
    });
  }
}

async function tick(): Promise<void> {
  if (!monitorActive || inFlight) return;
  inFlight = true;

  try {
    // Wake sem XHR (evita spam de CORS 503 no console).
    wakeApiServer();

    // Só faz XHR /health de tempos em tempos; se cair, não martela.
    const up = await pingApiHealthLight();
    if (!monitorActive) return;

    if (up) {
      consecutiveFails = 0;
      showStatus("connected");
      scheduleNextPoll(POLL_WHEN_UP_MS);
      return;
    }

    consecutiveFails += 1;
    showStatus(consecutiveFails >= FAILS_BEFORE_UNAVAILABLE ? "unavailable" : "waking");
    scheduleNextPoll(POLL_WHEN_DOWN_MS);
  } finally {
    inFlight = false;
  }
}

/** Inicia toast permanente de status (pós-login). Atualiza em tempo real. */
export function startBackendStatusMonitor(): void {
  if (!shouldEnableBackendKeepAlive()) return;
  if (monitorActive) return;

  monitorActive = true;
  consecutiveFails = 0;
  currentStatus = "idle";
  showStatus("waking");
  void tick();
}

/** Para o monitor e remove o toast (logout). */
export function stopBackendStatusMonitor(): void {
  monitorActive = false;
  clearPollTimer();
  consecutiveFails = 0;
  currentStatus = "idle";
  toast.dismiss(TOAST_ID);
}

export function getBackendConnectionStatus(): BackendStatus {
  return currentStatus;
}

/**
 * Usado no cold-start interceptor / antes de uploads:
 * garante toast de "acordando" e espera a API voltar.
 */
export function connectBackendWithToast(): Promise<boolean> {
  if (!shouldEnableBackendKeepAlive()) {
    return Promise.resolve(true);
  }

  if (!monitorActive) {
    startBackendStatusMonitor();
  } else if (currentStatus !== "connected") {
    consecutiveFails = 0;
    showStatus("waking");
    clearPollTimer();
    void tick();
  }

  return new Promise((resolve) => {
    const started = Date.now();
    const maxWaitMs = 120_000;

    const wait = () => {
      if (currentStatus === "connected") {
        resolve(true);
        return;
      }
      if (!monitorActive || Date.now() - started > maxWaitMs) {
        resolve(currentStatus === "connected");
        return;
      }
      window.setTimeout(wait, 1500);
    };

    wait();
  });
}
