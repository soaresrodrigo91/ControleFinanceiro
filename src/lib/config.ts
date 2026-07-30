import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  onSnapshot,
} from "firebase/firestore";
import { db } from "./firebase";
import { afetaApartirDe } from "./recorrencias";
import type { ConfigListas, LayoutMenu, ModoComp, Parcela, Recorrencia } from "./types";

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

// Grupos com uma entrada em gruposInativosDesde ficam de fora dos seletores/filtros do
// sistema (formulário de novo lançamento, renegociação, filtros de Lançamentos/Relatórios/
// Dashboard) até serem reativados. Os lançamentos já existentes desses grupos não são
// afetados — continuam normalmente onde já estavam.
export function gruposAtivos(config: ConfigListas): string[] {
  return config.grupos.filter((g) => !config.gruposInativosDesde?.[g]);
}

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
  tipoGraficoDashboard: "pizza",
  mostrarDashboardInicio: true,
  mostrarSubtotalProvisaoInicio: false,
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

export async function atualizarTipoGraficoDashboard(uid: string, tipo: "pizza" | "barra") {
  await updateDoc(doc(db, "usuarios", uid, "config", "listas"), { tipoGraficoDashboard: tipo });
}

export async function atualizarMostrarDashboardInicio(uid: string, mostrar: boolean) {
  await updateDoc(doc(db, "usuarios", uid, "config", "listas"), { mostrarDashboardInicio: mostrar });
}

export async function atualizarMostrarSubtotalProvisaoInicio(uid: string, mostrar: boolean) {
  await updateDoc(doc(db, "usuarios", uid, "config", "listas"), {
    mostrarSubtotalProvisaoInicio: mostrar,
  });
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

// Verifica se um grupo tem algum lançamento a partir de mesInicio (parcela avulsa com
// vencimento >= mesInicio, ou recorrência que ainda não tinha encerrado antes de mesInicio,
// mesmo que só comece depois dele). Usado para bloquear a inativação do grupo nesses casos.
export async function existeLancamentoGrupoAPartirDe(
  uid: string,
  grupo: string,
  mesInicio: string
): Promise<boolean> {
  const inicio = `${mesInicio}-01`;

  const parcelasSnap = await getDocs(
    query(collection(db, "usuarios", uid, "parcelas"), where("vencimento", ">=", inicio))
  );
  const temParcelaAvulsa = parcelasSnap.docs.some((d) => {
    const p = d.data() as Parcela;
    return p.grupo === grupo && !p.recorrenciaId;
  });
  if (temParcelaAvulsa) return true;

  const recorrenciasSnap = await getDocs(
    query(collection(db, "usuarios", uid, "recorrencias"), where("tipo", "==", "pagar"))
  );
  return recorrenciasSnap.docs.some((d) => {
    const r = d.data() as Recorrencia;
    if ((r.grupo ?? GRUPO_FIXAS) !== grupo) return false;
    return afetaApartirDe(r, mesInicio);
  });
}

export async function inativarGrupo(uid: string, grupo: string, desde: string) {
  const ref = doc(db, "usuarios", uid, "config", "listas");
  const snap = await getDoc(ref);
  const atual = (snap.data() as ConfigListas | undefined)?.gruposInativosDesde ?? {};
  await updateDoc(ref, { gruposInativosDesde: { ...atual, [grupo]: desde } });
}

export async function ativarGrupo(uid: string, grupo: string) {
  const ref = doc(db, "usuarios", uid, "config", "listas");
  const snap = await getDoc(ref);
  const atual = { ...((snap.data() as ConfigListas | undefined)?.gruposInativosDesde ?? {}) };
  delete atual[grupo];
  await updateDoc(ref, { gruposInativosDesde: atual });
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

// Remove um sufixo "NN%" já existente para obter o nome-base digitado pelo usuário.
function baseNomeComp(nome: string): string {
  return nome.replace(/\s+\d+%$/, "").trim();
}

function nomeComPercentual(nomeAtual: string, modo: ModoComp): string {
  const base = baseNomeComp(nomeAtual);
  if (modo === "total") return `${base} 100%`;
  if (modo === "metade") return `${base} 50%`;
  return base;
}

// O nome do reembolso funciona como chave em várias coleções (vínculo de e-mail, comp
// das parcelas/recorrências). Ao renomear, propaga para todo lugar que referencia o nome
// antigo, senão essas ligações silenciosamente param de bater.
async function renomearComp(uid: string, nomeAntigo: string, nomeNovo: string) {
  const [parcelasSnap, recorrenciasSnap] = await Promise.all([
    getDocs(query(collection(db, "usuarios", uid, "parcelas"), where("comp", "==", nomeAntigo))),
    getDocs(query(collection(db, "usuarios", uid, "recorrencias"), where("comp", "==", nomeAntigo))),
  ]);
  const alvos = [...parcelasSnap.docs, ...recorrenciasSnap.docs];
  for (let i = 0; i < alvos.length; i += 450) {
    const batch = writeBatch(db);
    alvos.slice(i, i + 450).forEach((d) => batch.update(d.ref, { comp: nomeNovo }));
    await batch.commit();
  }

  const vinculoRef = doc(db, "usuarios", uid, "vinculosCompartilhamento", nomeAntigo);
  const vinculoSnap = await getDoc(vinculoRef);
  if (vinculoSnap.exists()) {
    await setDoc(doc(db, "usuarios", uid, "vinculosCompartilhamento", nomeNovo), {
      ...vinculoSnap.data(),
      compNome: nomeNovo,
    });
    await deleteDoc(vinculoRef);
  }
}

export async function atualizarModoComp(uid: string, nome: string, modo: ModoComp) {
  const ref = doc(db, "usuarios", uid, "config", "listas");
  const snap = await getDoc(ref);
  const atual = (snap.data() as ConfigListas | undefined)?.comp ?? [];

  const nomeSugerido = nomeComPercentual(nome, modo);
  const colide = nomeSugerido !== nome && atual.some((c) => c.nome === nomeSugerido);
  const nomeFinal = colide ? nome : nomeSugerido;

  if (nomeFinal !== nome) {
    await renomearComp(uid, nome, nomeFinal);
  }
  await updateDoc(ref, {
    comp: atual.map((c) => (c.nome === nome ? { ...c, nome: nomeFinal, modo } : c)),
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
