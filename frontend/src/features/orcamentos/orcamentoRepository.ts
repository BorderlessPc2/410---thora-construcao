import {
  collection,
  doc,
  getDocs,
  limit,
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

  const uploadedAt =
    toDateIfPossible(data.uploadedAt) ??
    toDateIfPossible(data.createdAt) ??
    toDateIfPossible(data.dataUpload) ??
    new Date(0);
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

export async function getOrcamentoByUploadId(
  userId: string,
  uploadId: string,
): Promise<Orcamento | null> {
  const q = query(
    collection(db, "orcamentos"),
    where("userId", "==", userId),
    where("uploadId", "==", uploadId),
    limit(1),
  );

  try {
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return mapOrcamentoDoc(snap.docs[0]);
  } catch (error) {
    console.error("[Firestore] Falha ao buscar orçamento:", { userId, uploadId, error });
    throw error;
  }
}

export async function listOrcamentosByUserId(
  userId: string,
): Promise<Orcamento[]> {
  const q = query(
    collection(db, "orcamentos"),
    where("userId", "==", userId),
    orderBy("uploadedAt", "desc"),
  );

  try {
    const snap = await getDocs(q);
    return snap.docs.map(mapOrcamentoDoc);
  } catch (error) {
    console.error(
      "[Firestore] Falha ao listar orçamentos:",
      { userId, error },
    );
    throw error;
  }
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

