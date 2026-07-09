import { useEffect } from "react";
import { useAuth } from "../features/auth/AuthContext";
import { useBackendKeepAlive } from "../hooks/useBackendKeepAlive";
import {
  startBackendStatusMonitor,
  stopBackendStatusMonitor,
} from "../services/backendConnectionToast";
import { shouldEnableBackendKeepAlive } from "../services/backendKeepAlive";

/**
 * Keep-alive do Render + toast permanente de status do backend após login.
 */
export function BackendKeepAlive() {
  useBackendKeepAlive();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!shouldEnableBackendKeepAlive()) return;

    if (user) {
      startBackendStatusMonitor();
      return () => {
        stopBackendStatusMonitor();
      };
    }

    stopBackendStatusMonitor();
  }, [user, isLoading]);

  return null;
}
