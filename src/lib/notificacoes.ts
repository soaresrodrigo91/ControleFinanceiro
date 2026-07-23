import { addDoc, collection, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { db } from "./firebase";
import type { Notificacao, TipoNotificacao } from "./types";

export function assinarNotificacoes(uid: string, callback: (notificacoes: Notificacao[]) => void) {
  const q = query(collection(db, "notificacoes"), where("uidDestino", "==", uid));
  return onSnapshot(q, (snap) => {
    const notificacoes = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as Notificacao)
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
    callback(notificacoes);
  });
}

export async function marcarComoLida(id: string) {
  await updateDoc(doc(db, "notificacoes", id), { lida: true });
}

export async function criarNotificacao(dados: {
  deUid: string;
  uidDestino: string;
  paraEmail: string;
  tipo: TipoNotificacao;
  mensagem: string;
  deNome: string;
  ym?: string;
}) {
  await addDoc(collection(db, "notificacoes"), {
    deUid: dados.deUid,
    uidDestino: dados.uidDestino,
    paraEmail: dados.paraEmail,
    tipo: dados.tipo,
    mensagem: dados.mensagem,
    deNome: dados.deNome,
    lida: false,
    criadoEm: new Date().toISOString(),
    ym: dados.ym ?? null,
  });
}
