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
import type { BDIAplicado } from "../../types/bdi";

function mapAplicadoDoc(snap: QueryDocumentSnapshot<DocumentData>): BDIAplicado {
  const data = snap.data() ?? {};
  return {
    uploadId: String(data.uploadId ?? ""),
    bdiConfigId: String(data.bdiConfigId ?? ""),
    bdiPercentual: Number(data.bdiPercentual ?? 0),
    valorSemBDI: Number(data.valorSemBDI ?? 0),
    valorComBDI: Number(data.valorComBDI ?? 0),
    economia: Number(data.economia ?? 0),
    dataAplicacao: String(data.dataAplicacao ?? ""),
    itensImpactados: Number(data.itensImpactados ?? 0),
  };
}

export async function getLatestBDIAplicado(
  userId: string,
  uploadId: string,
): Promise<BDIAplicado | null> {
  try {
    const q = query(
      collection(db, "bdi_aplicados"),
      where("userId", "==", userId),
      where("uploadId", "==", uploadId),
      orderBy("dataAplicacao", "desc"),
      limit(1),
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return mapAplicadoDoc(snap.docs[0]);
  } catch {
    return null;
  }
}
