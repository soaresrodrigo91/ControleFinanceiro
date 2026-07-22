import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "./firebase";
import type { Perfil } from "./types";

export function assinarFiltrosDashboard(
  uid: string,
  callback: (filtros: Record<string, boolean>) => void
) {
  return onSnapshot(doc(db, "usuarios", uid), (snap) => {
    callback((snap.data()?.filtrosDashboard as Record<string, boolean>) ?? {});
  });
}

export async function alternarFiltroGrupo(uid: string, grupo: string, visivel: boolean) {
  await updateDoc(doc(db, "usuarios", uid), {
    [`filtrosDashboard.${grupo}`]: visivel,
  });
}

export function assinarPerfil(uid: string, callback: (perfil: Perfil) => void) {
  return onSnapshot(doc(db, "usuarios", uid), (snap) => {
    const dados = snap.data();
    callback({
      nome: dados?.nome ?? "",
      sobrenome: dados?.sobrenome ?? "",
      telefone: dados?.telefone ?? "",
      fotoUrl: dados?.fotoUrl ?? null,
    });
  });
}

export async function atualizarPerfil(
  uid: string,
  dados: { nome: string; sobrenome: string; telefone: string }
) {
  await updateDoc(doc(db, "usuarios", uid), { ...dados });
}

export async function uploadFotoPerfil(uid: string, arquivo: File): Promise<string> {
  const storageRef = ref(storage, `usuarios/${uid}/foto-perfil`);
  await uploadBytes(storageRef, arquivo);
  const url = await getDownloadURL(storageRef);
  await updateDoc(doc(db, "usuarios", uid), { fotoUrl: url });
  return url;
}
