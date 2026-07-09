import { useEffect } from "react";
import { useBackendKeepAlive } from "../hooks/useBackendKeepAlive";
import { connectBackendWithToast } from "../services/backendConnectionToast";
import { shouldEnableBackendKeepAlive } from "../services/backendKeepAlive";

/** Keep-alive + toast de cold start do Render na primeira carga. */
export function BackendKeepAlive() {
  useBackendKeepAlive();

  useEffect(() => {
    if (!shouldEnableBackendKeepAlive()) return;
    void connectBackendWithToast();
  }, []);

  return null;
}
