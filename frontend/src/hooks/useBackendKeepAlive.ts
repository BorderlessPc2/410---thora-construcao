import { useEffect } from "react";
import { startBackendKeepAlive } from "../services/backendKeepAlive";

/** Mantém o backend Render acordado enquanto o app estiver aberto no browser. */
export function useBackendKeepAlive(): void {
  useEffect(() => {
    const stop = startBackendKeepAlive();
    return stop;
  }, []);
}
