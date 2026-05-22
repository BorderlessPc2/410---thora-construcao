import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import type { Orcamento } from "./orcamentoTypes";

const toDateIfPossible = (value: unknown): Date | undefined => {
  if (!value) return undefined;
  if (value instanceof Date) return value;

  // Firestore Timestamp (has toDate)
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const maybe = value as { toDate?: () => Date };
    if (typeof maybe.toDate === "function") return maybe.toDate();
  }

  // ISO string fallback
  if (typeof value === "string") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }

  return undefined;
};

const mapOrcamentoDoc = (
  snap: QueryDocumentSnapshot<DocumentData>,
): Orcamento => {
  const data = snap.data() ?? {};

  const uploadedAt = toDateIfPossible(data.uploadedAt) ?? new Date(0);
  const extractedAt = toDateIfPossible(data.extractedAt);
  const updatedAt = toDateIfPossible(data.updatedAt);

  const items = Array.isArray(data.items) ? data.items : [];
  const itemsFound =
    typeof data.itemsFound === "number"
      ? data.itemsFound
      : Array.isArray(items)
        ? items.length
        : 0;

  return {
    id: snap.id,
    userId: String(data.userId ?? ""),
    uploadId: String(data.uploadId ?? snap.id),
    filename: String(data.filename ?? "—"),
    nomeProjeto:
      typeof data.nomeProjeto === "string" ? data.nomeProjeto : undefined,
    modelosSelecionados:
      data.modelosSelecionados && typeof data.modelosSelecionados === "object"
        ? (data.modelosSelecionados as Orcamento["modelosSelecionados"])
        : undefined,
    uploadedAt,
    extractedAt,
    updatedAt,
    items,
    itemsFound,
    tablesFound: Number(data.tablesFound ?? 0),
    status: (data.status as Orcamento["status"]) ?? "completed",
    errorMessage: (data.errorMessage as string | null | undefined) ?? null,
  };
};

export async function listOrcamentosByUserId(
  userId: string,
): Promise<Orcamento[]> {
  const q = query(
    collection(db, "orcamentos"),
    where("userId", "==", userId),
    orderBy("uploadedAt", "desc"),
  );

  const snap = await getDocs(q);
  return snap.docs.map(mapOrcamentoDoc);
}

export type UpsertOrcamentoInput = Omit<
  Orcamento,
  "id"
>;

export async function upsertOrcamento(
  documentId: string,
  data: UpsertOrcamentoInput,
): Promise<void> {
  await setDoc(doc(db, "orcamentos", documentId), data, { merge: true });
}

