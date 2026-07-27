import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { Perfil } from "./types";

const FOTO_PERFIL_TAMANHO_MAX = 256;
const FOTO_PERFIL_QUALIDADE = 0.8;

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

export function assinarBoasVindasVistas(uid: string, callback: (vistas: boolean) => void) {
  return onSnapshot(doc(db, "usuarios", uid), (snap) => {
    callback(snap.data()?.boasVindasVistas !== false);
  });
}

export async function marcarBoasVindasVistas(uid: string) {
  await updateDoc(doc(db, "usuarios", uid), { boasVindasVistas: true });
}

async function redimensionarFoto(arquivo: File): Promise<string> {
  const bitmap = await createImageBitmap(arquivo);
  const escala = Math.min(1, FOTO_PERFIL_TAMANHO_MAX / Math.max(bitmap.width, bitmap.height));
  const largura = Math.round(bitmap.width * escala);
  const altura = Math.round(bitmap.height * escala);

  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const contexto = canvas.getContext("2d");
  if (!contexto) throw new Error("Não foi possível processar a imagem.");
  contexto.drawImage(bitmap, 0, 0, largura, altura);

  return canvas.toDataURL("image/jpeg", FOTO_PERFIL_QUALIDADE);
}

export async function uploadFotoPerfil(uid: string, arquivo: File): Promise<string> {
  const dataUrl = await redimensionarFoto(arquivo);
  await updateDoc(doc(db, "usuarios", uid), { fotoUrl: dataUrl });
  return dataUrl;
}
