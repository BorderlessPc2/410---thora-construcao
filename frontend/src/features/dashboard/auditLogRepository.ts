import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "../../services/firebase";

export type AuditLogEntry = {
  id: string;
  projectId: string;
  userId: string;
  userName: string;
  timestamp: Date;
  itemCodigo: string;
  campoAlterado: string;
  valorAntigo: string | number | null;
  valorNovo: string | number | null;
};

const toDate = (value: unknown): Date => {
  if (value instanceof Date) return value;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const maybe = value as { toDate?: () => Date };
    if (typeof maybe.toDate === "function") return maybe.toDate();
  }
  if (typeof value === "string") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date(0);
};

const mapAuditDoc = (snap: QueryDocumentSnapshot<DocumentData>): AuditLogEntry => {
  const data = snap.data() ?? {};
  return {
    id: snap.id,
    projectId: String(data.project_id ?? ""),
    userId: String(data.user_id ?? ""),
    userName: String(data.user_name ?? ""),
    timestamp: toDate(data.timestamp),
    itemCodigo: String(data.item_codigo ?? ""),
    campoAlterado: String(data.campo_alterado ?? ""),
    valorAntigo: (data.valor_antigo as string | number | null) ?? null,
    valorNovo: (data.valor_novo as string | number | null) ?? null,
  };
};

export async function listAuditLogsByUserId(
  userId: string,
  max = 20,
): Promise<AuditLogEntry[]> {
  const q = query(
    collection(db, "audit_logs"),
    where("user_id", "==", userId),
    orderBy("timestamp", "desc"),
    limit(max),
  );
  const snap = await getDocs(q);
  return snap.docs.map(mapAuditDoc);
}
