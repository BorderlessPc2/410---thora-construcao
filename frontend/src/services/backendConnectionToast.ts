import { toast } from "sonner";
import { pingApiHealth, pingApiHealthLight, wakeApiServer } from "./api";
import { shouldEnableBackendKeepAlive } from "./backendKeepAlive";

const TOAST_ID = "backend-connection";

let connectionPromise: Promise<boolean> | null = null;

/**
 * Mostra toast "Conectando..." e faz poll em /health até o Render acordar.
 * Se a API já estiver online, não mostra toast.
 * Reutiliza a mesma Promise/toast se chamado de novo durante o cold start.
 */
export function connectBackendWithToast(): Promise<boolean> {
  if (!shouldEnableBackendKeepAlive()) {
    return Promise.resolve(true);
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = (async () => {
    wakeApiServer();

    const alreadyUp = await pingApiHealthLight();
    if (alreadyUp) {
      return true;
    }

    toast.loading("Conectando ao backend...", {
      id: TOAST_ID,
      description: "O servidor no Render pode levar até 1 minuto para acordar.",
      duration: Infinity,
    });

    const ready = await pingApiHealth(15);

    if (ready) {
      toast.success("Backend conectado", {
        id: TOAST_ID,
        description: "API pronta para uso.",
        duration: 3500,
      });
      return true;
    }

    toast.error("Backend indisponível", {
      id: TOAST_ID,
      description: "Não foi possível conectar. Tente novamente em instantes.",
      duration: 8000,
    });
    return false;
  })().finally(() => {
    connectionPromise = null;
  });

  return connectionPromise;
}
