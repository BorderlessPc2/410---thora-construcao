import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import type { BDIConfig } from "../../types/bdi";

function configsCollection(userId: string) {
  return collection(db, "bdi_configs", userId, "configs");
}

function mapConfigDoc(snap: QueryDocumentSnapshot<DocumentData>): BDIConfig {
  const data = snap.data() ?? {};
  return {
    id: snap.id,
    nome: String(data.nome ?? ""),
    tipo: (data.tipo as BDIConfig["tipo"]) ?? "customizado",
    componentes: Array.isArray(data.componentes) ? data.componentes : [],
    bdiCalculado: Number(data.bdiCalculado ?? 0),
    createdAt: String(data.createdAt ?? new Date().toISOString()),
    updatedAt: String(data.updatedAt ?? new Date().toISOString()),
  };
}

export async function listBDIConfigs(userId: string): Promise<BDIConfig[]> {
  const snap = await getDocs(configsCollection(userId));
  return snap.docs.map(mapConfigDoc).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function saveBDIConfig(userId: string, config: BDIConfig): Promise<void> {
  const now = new Date().toISOString();
  const payload = {
    userId,
    nome: config.nome,
    tipo: config.tipo,
    componentes: config.componentes,
    bdiCalculado: config.bdiCalculado,
    createdAt: config.createdAt || now,
    updatedAt: now,
  };
  await setDoc(doc(db, "bdi_configs", userId, "configs", config.id), payload, { merge: true });
}

export async function deleteBDIConfig(userId: string, configId: string): Promise<void> {
  await deleteDoc(doc(db, "bdi_configs", userId, "configs", configId));
}
