import { useEffect, useState } from "react";
import { collection, onSnapshot, type Timestamp } from "firebase/firestore";
import { db } from "../../services/firebase";
import type { ActiveLock } from "./orcamentoEnterpriseApi";

function toIsoString(value: unknown): string {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as Timestamp).toDate === "function"
  ) {
    return (value as Timestamp).toDate().toISOString();
  }
  return String(value ?? "");
}

export function useActiveLocks(projectId: string | null): Map<string, ActiveLock> {
  const [locks, setLocks] = useState<Map<string, ActiveLock>>(new Map());

  useEffect(() => {
    if (!projectId) {
      setLocks(new Map());
      return;
    }

    const locksRef = collection(db, "projects", projectId, "active_locks");
    const unsubscribe = onSnapshot(
      locksRef,
      (snapshot) => {
        const next = new Map<string, ActiveLock>();
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as ActiveLock;
          next.set(docSnap.id, {
            item_id: data.item_id ?? docSnap.id,
            user_id: data.user_id,
            user_name: data.user_name,
            locked_at: toIsoString(data.locked_at),
          });
        });
        setLocks(next);
      },
      () => {
        setLocks(new Map());
      },
    );

    return () => unsubscribe();
  }, [projectId]);

  return locks;
}
