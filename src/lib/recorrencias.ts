import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { somarMesesYM } from "./date";
import type { Parcela, Recebimento, Recorrencia } from "./types";

export async function criarRecorrencia(
  uid: string,
  dados: {
    tipo: "pagar" | "receber";
    credor: string;
    observacao: string;
    valor: number;
    comp?: string;
    grupo?: string;
    aplicacao?: string;
    inicio: string;
    provisao?: boolean;
  }
) {
  const [, , dia] = dados.inicio.split("-").map(Number);
  await addDoc(collection(db, "usuarios", uid, "recorrencias"), {
    tipo: dados.tipo,
    credor: dados.credor,
    observacao: dados.observacao || null,
    valorAtual: dados.valor,
    comp: dados.comp || null,
    grupo: dados.grupo || null,
    aplicacao: dados.aplicacao || null,
    diaVencimento: dia,
    inicio: dados.inicio,
    fim: null,
    historicoValores: [{ valor: dados.valor, desde: dados.inicio }],
    provisao: dados.provisao === true,
  });
}

export function assinarRecorrencias(
  uid: string,
  tipo: "pagar" | "receber",
  callback: (recorrencias: Recorrencia[]) => void
) {
  const q = query(
    collection(db, "usuarios", uid, "recorrencias"),
    where("tipo", "==", tipo)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Recorrencia));
  });
}

export type EdicaoRecorrenciaParcela = {
  credor: string;
  observacao: string | null;
  valorParcela: number;
  grupo: string;
  aplicacao: string;
};

export async function atualizarParcelaRecorrenteApenasMes(
  uid: string,
  parcela: Parcela,
  dados: EdicaoRecorrenciaParcela
) {
  if (!parcela.virtual) {
    await updateDoc(doc(db, "usuarios", uid, "parcelas", parcela.id), {
      credor: dados.credor,
      observacao: dados.observacao,
      valorParcela: dados.valorParcela,
      valorTotal: dados.valorParcela,
      grupo: dados.grupo,
      aplicacao: dados.aplicacao,
    });
    return;
  }

  await addDoc(collection(db, "usuarios", uid, "parcelas"), {
    lancamentoId: parcela.recorrenciaId,
    recorrenciaId: parcela.recorrenciaId,
    credor: dados.credor,
    dataCompra: parcela.dataCompra,
    observacao: dados.observacao,
    valorTotal: dados.valorParcela,
    parcelaNum: 1,
    parcelaTotal: 1,
    valorParcela: dados.valorParcela,
    comp: parcela.comp,
    grupo: dados.grupo,
    aplicacao: dados.aplicacao,
    vencimento: parcela.vencimento,
    pago: false,
    pagoEm: null,
    provisao: parcela.provisao ?? false,
    criadoEm: serverTimestamp(),
  });
}

export async function atualizarRecorrenciaParcelaDesteMesEmDiante(
  uid: string,
  recorrenciaId: string,
  ym: string,
  dados: EdicaoRecorrenciaParcela
) {
  const batch = writeBatch(db);
  const ref = doc(db, "usuarios", uid, "recorrencias", recorrenciaId);
  const snap = await getDoc(ref);
  const historicoAtual = (snap.data() as Recorrencia | undefined)?.historicoValores ?? [];
  batch.update(ref, {
    credor: dados.credor,
    observacao: dados.observacao,
    grupo: dados.grupo,
    aplicacao: dados.aplicacao,
    valorAtual: dados.valorParcela,
    historicoValores: [...historicoAtual, { valor: dados.valorParcela, desde: `${ym}-01` }],
  });

  const q = query(
    collection(db, "usuarios", uid, "parcelas"),
    where("recorrenciaId", "==", recorrenciaId)
  );
  const snapParcelas = await getDocs(q);
  snapParcelas.docs.forEach((d) => {
    const p = d.data() as Parcela;
    if (p.vencimento.slice(0, 7) >= ym) {
      batch.update(d.ref, {
        credor: dados.credor,
        observacao: dados.observacao,
        valorParcela: dados.valorParcela,
        valorTotal: dados.valorParcela,
        grupo: dados.grupo,
        aplicacao: dados.aplicacao,
      });
    }
  });
  await batch.commit();
}

export async function atualizarRecorrenciaParcelaTudo(
  uid: string,
  recorrenciaId: string,
  dados: EdicaoRecorrenciaParcela
) {
  const batch = writeBatch(db);
  const ref = doc(db, "usuarios", uid, "recorrencias", recorrenciaId);
  const snap = await getDoc(ref);
  const inicio = (snap.data() as Recorrencia | undefined)?.inicio ?? "";
  batch.update(ref, {
    credor: dados.credor,
    observacao: dados.observacao,
    grupo: dados.grupo,
    aplicacao: dados.aplicacao,
    valorAtual: dados.valorParcela,
    historicoValores: [{ valor: dados.valorParcela, desde: inicio }],
  });

  const q = query(
    collection(db, "usuarios", uid, "parcelas"),
    where("recorrenciaId", "==", recorrenciaId)
  );
  const snapParcelas = await getDocs(q);
  snapParcelas.docs.forEach((d) => {
    batch.update(d.ref, {
      credor: dados.credor,
      observacao: dados.observacao,
      valorParcela: dados.valorParcela,
      valorTotal: dados.valorParcela,
      grupo: dados.grupo,
      aplicacao: dados.aplicacao,
    });
  });
  await batch.commit();
}

export async function excluirRecorrencia(uid: string, recorrenciaId: string) {
  const q = query(
    collection(db, "usuarios", uid, "parcelas"),
    where("recorrenciaId", "==", recorrenciaId)
  );
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, "usuarios", uid, "recorrencias", recorrenciaId));

  const recebimentosQ = query(
    collection(db, "usuarios", uid, "recebimentos"),
    where("lancamentoId", "==", recorrenciaId)
  );
  const recebimentosSnap = await getDocs(recebimentosQ);
  recebimentosSnap.docs.forEach((d) => batch.delete(d.ref));

  await batch.commit();
}

export async function excluirRecorrenciaApenasMes(uid: string, recorrenciaId: string, ym: string) {
  const q = query(
    collection(db, "usuarios", uid, "parcelas"),
    where("recorrenciaId", "==", recorrenciaId)
  );
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach((d) => {
    const p = d.data() as Parcela;
    if (p.vencimento.slice(0, 7) === ym) batch.delete(d.ref);
  });

  const recebimentosQ = query(
    collection(db, "usuarios", uid, "recebimentos"),
    where("lancamentoId", "==", recorrenciaId),
    where("origemComp", "==", true)
  );
  const recebimentosSnap = await getDocs(recebimentosQ);
  recebimentosSnap.docs.forEach((d) => {
    const r = d.data() as Recebimento;
    if (r.recebimento.slice(0, 7) === ym) batch.delete(d.ref);
  });

  const ref = doc(db, "usuarios", uid, "recorrencias", recorrenciaId);
  const snapR = await getDoc(ref);
  const atuais = (snapR.data() as Recorrencia | undefined)?.mesesExcluidos ?? [];
  batch.update(ref, { mesesExcluidos: [...atuais, ym] });

  await batch.commit();
}

export async function excluirRecorrenciaDesteMesEmDiante(uid: string, recorrenciaId: string, ym: string) {
  const q = query(
    collection(db, "usuarios", uid, "parcelas"),
    where("recorrenciaId", "==", recorrenciaId)
  );
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach((d) => {
    const p = d.data() as Parcela;
    if (p.vencimento.slice(0, 7) >= ym) batch.delete(d.ref);
  });

  const recebimentosQ = query(
    collection(db, "usuarios", uid, "recebimentos"),
    where("lancamentoId", "==", recorrenciaId),
    where("origemComp", "==", true)
  );
  const recebimentosSnap = await getDocs(recebimentosQ);
  recebimentosSnap.docs.forEach((d) => {
    const r = d.data() as Recebimento;
    if (r.recebimento.slice(0, 7) >= ym) batch.delete(d.ref);
  });

  const ref = doc(db, "usuarios", uid, "recorrencias", recorrenciaId);
  batch.update(ref, { fim: `${somarMesesYM(ym, -1)}-01` });

  await batch.commit();
}

export async function encerrarRecorrencia(uid: string, recorrenciaId: string, ym: string) {
  await updateDoc(doc(db, "usuarios", uid, "recorrencias", recorrenciaId), {
    fim: `${ym}-01`,
  });
}

export function ativaNoMes(r: Recorrencia, ym: string): boolean {
  if (ym < r.inicio.slice(0, 7)) return false;
  if (r.fim && ym > r.fim.slice(0, 7)) return false;
  if (r.mesesExcluidos?.includes(ym)) return false;
  return true;
}

export function valorNoMes(r: Recorrencia, ym: string): number {
  const fimDoMes = `${ym}-31`;
  let valor = r.valorAtual;
  for (const h of [...r.historicoValores].sort((a, b) => a.desde.localeCompare(b.desde))) {
    if (h.desde <= fimDoMes) valor = h.valor;
  }
  return valor;
}

export function vencimentoNoMes(r: Recorrencia, ym: string): string {
  const [ano, mes] = ym.split("-").map(Number);
  const ultimoDiaDoMes = new Date(ano, mes, 0).getDate();
  const dia = Math.min(r.diaVencimento, ultimoDiaDoMes);
  return `${ym}-${String(dia).padStart(2, "0")}`;
}

export function mesclarComRecorrencias(
  parcelasReaisDoMes: Parcela[],
  recorrencias: Recorrencia[],
  ym: string
): Parcela[] {
  const idsJaMaterializados = new Set(
    parcelasReaisDoMes.filter((p) => p.recorrenciaId).map((p) => p.recorrenciaId)
  );
  const virtuais: Parcela[] = recorrencias
    .filter((r) => ativaNoMes(r, ym) && !idsJaMaterializados.has(r.id))
    .map((r) => ({
      id: `virtual:${r.id}:${ym}`,
      lancamentoId: r.id,
      recorrenciaId: r.id,
      credor: r.credor,
      dataCompra: r.inicio,
      observacao: r.observacao,
      valorTotal: valorNoMes(r, ym),
      parcelaNum: 1,
      parcelaTotal: 1,
      valorParcela: valorNoMes(r, ym),
      comp: r.comp ?? null,
      grupo: r.grupo ?? "Fixas",
      aplicacao: r.aplicacao ?? "Outros",
      vencimento: vencimentoNoMes(r, ym),
      pago: false,
      pagoEm: null,
      virtual: true,
      provisao: r.provisao ?? false,
    }));
  return [...parcelasReaisDoMes, ...virtuais].sort((a, b) =>
    a.vencimento.localeCompare(b.vencimento)
  );
}

export function mesclarComRecorrenciasIntervalo(
  parcelasReais: Parcela[],
  recorrencias: Recorrencia[],
  ymInicio: string,
  ymFim: string
): Parcela[] {
  const meses: string[] = [];
  for (let ym = ymInicio; ym <= ymFim; ym = somarMesesYM(ym, 1)) {
    meses.push(ym);
  }

  const parcelasPorMes = new Map<string, Parcela[]>();
  for (const p of parcelasReais) {
    const ym = p.vencimento.slice(0, 7);
    const lista = parcelasPorMes.get(ym) ?? [];
    lista.push(p);
    parcelasPorMes.set(ym, lista);
  }

  return meses.flatMap((ym) => mesclarComRecorrencias(parcelasPorMes.get(ym) ?? [], recorrencias, ym));
}
