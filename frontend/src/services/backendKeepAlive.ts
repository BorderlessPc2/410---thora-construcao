import { getApiBaseUrl, pingApiHealthLight } from "./api";

const DEFAULT_INTERVAL_MS = 30_000;

function parseIntervalMs(): number {
  const raw = import.meta.env.VITE_KEEP_ALIVE_INTERVAL_MS;
  if (!raw) return DEFAULT_INTERVAL_MS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 10_000 ? parsed : DEFAULT_INTERVAL_MS;
}

/** Ativo quando a API aponta para Render (ou forçado via env). */
export function shouldEnableBackendKeepAlive(apiBase = getApiBaseUrl()): boolean {
  const flag = String(import.meta.env.VITE_KEEP_ALIVE_ENABLED ?? "").toLowerCase();
  if (flag === "false" || flag === "0") return false;
  if (flag === "true" || flag === "1") return true;
  return /\.onrender\.com/i.test(apiBase);
}

function wakeWithImage(apiBase: string): void {
  const base = apiBase.replace(/\/$/, "");
  const img = new Image();
  img.referrerPolicy = "no-referrer";
  img.src = `${base}/health?keepalive=${Date.now()}`;
}

async function sendKeepAlivePing(apiBase: string): Promise<void> {
  wakeWithImage(apiBase);
  await pingApiHealthLight();
}

/**
 * Inicia pings periódicos em GET /health para evitar sleep do Render free tier.
 * Retorna função de cleanup (clearInterval).
 */
export function startBackendKeepAlive(options?: {
  intervalMs?: number;
  apiBase?: string;
}): () => void {
  const apiBase = options?.apiBase ?? getApiBaseUrl();

  if (!shouldEnableBackendKeepAlive(apiBase)) {
    return () => {};
  }

  const intervalMs = options?.intervalMs ?? parseIntervalMs();
  let inFlight = false;

  const tick = () => {
    if (inFlight) return;
    inFlight = true;
    void sendKeepAlivePing(apiBase).finally(() => {
      inFlight = false;
    });
  };

  void tick();
  const timerId = window.setInterval(tick, intervalMs);

  if (import.meta.env.DEV) {
    console.info(
      `[keep-alive] Render wake a cada ${Math.round(intervalMs / 1000)}s → ${apiBase}/health`,
    );
  }

  return () => {
    window.clearInterval(timerId);
  };
}
