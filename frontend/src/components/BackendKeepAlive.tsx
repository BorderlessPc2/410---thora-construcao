import { useBackendKeepAlive } from "../hooks/useBackendKeepAlive";

/** Componente invisível — inicia keep-alive global da API. */
export function BackendKeepAlive() {
  useBackendKeepAlive();
  return null;
}
