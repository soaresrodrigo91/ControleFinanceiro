import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  onSnapshot,
} from "firebase/firestore";
import { db } from "./firebase";
import type { ConfigListas, LayoutMenu, ModoComp } from "./types";

export type CampoLista = "grupos" | "aplicacoes";

const CAMPO_PARA_ATRIBUTO_PARCELA: Record<CampoLista | "comp", string> = {
  grupos: "grupo",
  aplicacoes: "aplicacao",
  comp: "comp",
};

// Grupo com regra especial de provisão (ver ESPECIFICACAO.md secao 4.1-2).
// Numa fase futura isso vira uma flag "ehProvisao" configuravel por grupo;
// por enquanto o comportamento e' amarrado a este nome, como no seed padrao.
export const GRUPO_PROVISAO = "Provisões";

// Grupo reservado para recorrências (contas fixas); lançamentos avulsos não
// podem usá-lo (ver ESPECIFICACAO.md secao 4.2-8).
export const GRUPO_FIXAS = "Fixas";

export const CONFIG_PADRAO: ConfigListas = {
  grupos: ["Fixas", "Cartão de Crédito", "Provisões", "Outros"],
  aplicacoes: [
    "Alimentação",
    "Moradia",
    "Transporte",
    "Saúde",
    "Lazer",
    "Assinaturas",
    "Parcelamentos",
    "Outros",
  ],
  comp: [],
  modoTotalizador: "todos",
  resumosRelatorio: { formaPagamento: true, aplicacao: true, compartilhamento: true },
  sugestaoCredor: true,
  itensPorPagina: 10,
  layoutMenu: "horizontal",
  compartilharLancamentos: false,
};

export async function garantirUsuarioSemeado(
  uid: string,
  nome: string,
  sobrenome: string,
  email: string
) {
  const usuarioRef = doc(db, "usuarios", uid);
  const usuarioSnap = await getDoc(usuarioRef);
  if (usuarioSnap.exists()) return;

  const batch = writeBatch(db);
  batch.set(usuarioRef, {
    nome,
    sobrenome,
    telefone: "",
    fotoUrl: null,
    email,
    criadoEm: serverTimestamp(),
    filtrosDashboard: {},
    boasVindasVistas: false,
  });
  batch.set(doc(db, "usuarios", uid, "config", "listas"), CONFIG_PADRAO);
  batch.set(doc(db, "indiceEmails", email.trim().toLowerCase()), { uid, nome, sobrenome });
  await batch.commit();
}

export function assinarConfigListas(
  uid: string,
  callback: (config: ConfigListas) => void
) {
  return onSnapshot(doc(db, "usuarios", uid, "config", "listas"), (snap) => {
    callback({ ...CONFIG_PADRAO, ...(snap.data() as ConfigListas | undefined) });
  });
}

export async function atualizarSugestaoCredor(uid: string, ativo: boolean) {
  await updateDoc(doc(db, "usuarios", uid, "config", "listas"), { sugestaoCredor: ativo });
}

export async function atualizarItensPorPagina(uid: string, valor: number) {
  await updateDoc(doc(db, "usuarios", uid, "config", "listas"), { itensPorPagina: valor });
}

export async function atualizarLayoutMenu(uid: string, layout: LayoutMenu) {
  await updateDoc(doc(db, "usuarios", uid, "config", "listas"), { layoutMenu: layout });
}

export async function atualizarResumoRelatorio(
  uid: string,
  campo: keyof ConfigListas["resumosRelatorio"],
  visivel: boolean
) {
  const ref = doc(db, "usuarios", uid, "config", "listas");
  const snap = await getDoc(ref);
  const atual = (snap.data() as ConfigListas | undefined)?.resumosRelatorio ?? CONFIG_PADRAO.resumosRelatorio;
  await updateDoc(ref, { resumosRelatorio: { ...atual, [campo]: visivel } });
}

export async function itemEstaEmUso(
  uid: string,
  campo: CampoLista | "comp",
  valor: string
): Promise<boolean> {
  const atributo = CAMPO_PARA_ATRIBUTO_PARCELA[campo];
  const [emParcelas, emRecorrencias] = await Promise.all(
    ["parcelas", "recorrencias"].map(async (colecao) => {
      const q = query(
        collection(db, "usuarios", uid, colecao),
        where(atributo, "==", valor),
        limit(1)
      );
      const snap = await getDocs(q);
      return !snap.empty;
    })
  );
  return emParcelas || emRecorrencias;
}

export async function adicionarItemLista(uid: string, campo: CampoLista, item: string) {
  const ref = doc(db, "usuarios", uid, "config", "listas");
  const snap = await getDoc(ref);
  const atual = (snap.data() as ConfigListas | undefined)?.[campo] ?? [];
  if (atual.includes(item)) return;
  await updateDoc(ref, { [campo]: [...atual, item] });
}

export async function removerItemLista(uid: string, campo: CampoLista, item: string) {
  const ref = doc(db, "usuarios", uid, "config", "listas");
  const snap = await getDoc(ref);
  const dados = snap.data() as ConfigListas | undefined;
  const atual = dados?.[campo] ?? [];
  const observacoesCampo = { ...(dados?.observacoesListas?.[campo] ?? {}) };
  delete observacoesCampo[item];
  await updateDoc(ref, {
    [campo]: atual.filter((v) => v !== item),
    observacoesListas: { ...dados?.observacoesListas, [campo]: observacoesCampo },
  });
}

export async function atualizarObservacaoItem(
  uid: string,
  campo: CampoLista,
  item: string,
  observacao: string
) {
  const ref = doc(db, "usuarios", uid, "config", "listas");
  const snap = await getDoc(ref);
  const atual = (snap.data() as ConfigListas | undefined)?.observacoesListas ?? {};
  const atualCampo = atual[campo] ?? {};
  await updateDoc(ref, {
    observacoesListas: { ...atual, [campo]: { ...atualCampo, [item]: observacao } },
  });
}

export async function adicionarComp(uid: string, nome: string, modo: ModoComp) {
  const ref = doc(db, "usuarios", uid, "config", "listas");
  const snap = await getDoc(ref);
  const atual = (snap.data() as ConfigListas | undefined)?.comp ?? [];
  if (atual.some((c) => c.nome === nome)) return;
  await updateDoc(ref, { comp: [...atual, { nome, modo, ativo: true }] });
}

export async function alternarAtivoComp(uid: string, nome: string, ativo: boolean) {
  const ref = doc(db, "usuarios", uid, "config", "listas");
  const snap = await getDoc(ref);
  const atual = (snap.data() as ConfigListas | undefined)?.comp ?? [];
  await updateDoc(ref, {
    comp: atual.map((c) => (c.nome === nome ? { ...c, ativo } : c)),
  });
}

export async function removerComp(uid: string, nome: string) {
  const ref = doc(db, "usuarios", uid, "config", "listas");
  const snap = await getDoc(ref);
  const atual = (snap.data() as ConfigListas | undefined)?.comp ?? [];
  await updateDoc(ref, { comp: atual.filter((c) => c.nome !== nome) });
}

export async function atualizarModoComp(uid: string, nome: string, modo: ModoComp) {
  const ref = doc(db, "usuarios", uid, "config", "listas");
  const snap = await getDoc(ref);
  const atual = (snap.data() as ConfigListas | undefined)?.comp ?? [];
  await updateDoc(ref, {
    comp: atual.map((c) => (c.nome === nome ? { ...c, modo } : c)),
  });
}

export async function atualizarModoTotalizador(
  uid: string,
  modo: ConfigListas["modoTotalizador"]
) {
  await updateDoc(doc(db, "usuarios", uid, "config", "listas"), {
    modoTotalizador: modo,
  });
}
