import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { somarMeses, hojeISO } from "./date";
import { valorNoMes, vencimentoNoMes } from "./recorrencias";
import { GRUPO_FIXAS } from "./config";
import { dividirValor } from "./dinheiro";
import { excluirLancamentoRecebimento, sincronizarReembolso, sincronizarValorReembolso } from "./recebimentos";
import type { NovoLancamento, Parcela, Recorrencia } from "./types";

export function valorEfetivo(p: Parcela): number {
  return p.valorParcela;
}

export async function criarLancamento(uid: string, dados: NovoLancamento) {
  const lancamentoId = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  const valoresParcelas = dividirValor(dados.valorTotal, dados.parcelaTotal);

  const batch = writeBatch(db);
  const parcelasRef = collection(db, "usuarios", uid, "parcelas");

  valoresParcelas.forEach((valorParcela, indice) => {
    const parcelaRef = doc(parcelasRef);
    batch.set(parcelaRef, {
      lancamentoId,
      credor: dados.credor,
      dataCompra: dados.dataCompra,
      observacao: dados.observacao || null,
      valorTotal: dados.valorTotal,
      parcelaNum: indice + 1,
      parcelaTotal: dados.parcelaTotal,
      valorParcela,
      comp: dados.comp || null,
      grupo: dados.grupo,
      aplicacao: dados.aplicacao,
      vencimento: somarMeses(dados.inicioCobranca, indice),
      pago: false,
      pagoEm: null,
      provisao: dados.provisao === true,
      origemCompartilhado: dados.origemCompartilhado ?? null,
      criadoEm: serverTimestamp(),
    });
  });

  await batch.commit();

  await sincronizarReembolso(uid, {
    lancamentoId,
    compNome: dados.comp || null,
    observacao: dados.observacao || null,
    valorTotal: dados.valorTotal,
    parcelaTotal: dados.parcelaTotal,
    dataInicio: dados.inicioCobranca,
    grupoOrigem: dados.grupo,
    provisao: dados.provisao === true,
  });

  return lancamentoId;
}

export function assinarTodasParcelas(
  uid: string,
  callback: (parcelas: Parcela[]) => void
) {
  const q = query(
    collection(db, "usuarios", uid, "parcelas"),
    orderBy("vencimento", "desc")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Parcela));
  });
}

export function assinarParcelasDoMes(
  uid: string,
  ym: string,
  callback: (parcelas: Parcela[]) => void
) {
  const inicio = `${ym}-01`;
  const fim = `${ym}-31`;
  const q = query(
    collection(db, "usuarios", uid, "parcelas"),
    where("vencimento", ">=", inicio),
    where("vencimento", "<=", fim),
    orderBy("vencimento")
  );
  return onSnapshot(q, (snap) => {
    callback(
      snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Parcela)
    );
  });
}

export function assinarParcelasDoIntervalo(
  uid: string,
  ymInicio: string,
  ymFim: string,
  callback: (parcelas: Parcela[]) => void
) {
  const inicio = `${ymInicio}-01`;
  const fim = `${ymFim}-31`;
  const q = query(
    collection(db, "usuarios", uid, "parcelas"),
    where("vencimento", ">=", inicio),
    where("vencimento", "<=", fim),
    orderBy("vencimento")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Parcela));
  });
}

export async function buscarVencimentosPagos(
  uid: string,
  chave: { lancamentoId?: string; recorrenciaId?: string }
): Promise<string[]> {
  const campo = chave.recorrenciaId ? "recorrenciaId" : "lancamentoId";
  const valor = chave.recorrenciaId ?? chave.lancamentoId;
  if (!valor) return [];
  const q = query(
    collection(db, "usuarios", uid, "parcelas"),
    where(campo, "==", valor),
    where("pago", "==", true)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => (d.data() as Parcela).vencimento);
}

export async function marcarPago(uid: string, parcela: Parcela, pago: boolean) {
  await updateDoc(doc(db, "usuarios", uid, "parcelas", parcela.id), {
    pago,
    pagoEm: pago ? hojeISO() : null,
  });
}

export type EdicaoParcela = {
  credor: string;
  observacao: string | null;
  valorParcela: number;
  comp: string | null;
  grupo: string;
  aplicacao: string;
  vencimento: string;
};

export async function atualizarParcela(uid: string, parcelaId: string, dados: EdicaoParcela) {
  await updateDoc(doc(db, "usuarios", uid, "parcelas", parcelaId), { ...dados });
}

export async function atualizarParcelaProvisao(uid: string, parcela: Parcela, dados: EdicaoParcela) {
  await updateDoc(doc(db, "usuarios", uid, "parcelas", parcela.id), { ...dados });
  if (!parcela.comp) return;
  await sincronizarValorReembolso(uid, parcela.lancamentoId, parcela.vencimento, parcela.comp, dados.valorParcela, {
    observacao: dados.observacao,
    grupoOrigem: dados.grupo,
    provisao: parcela.provisao,
  });
}

export async function atualizarCamposTodasParcelas(
  uid: string,
  lancamentoId: string,
  campos: { credor: string; grupo: string; aplicacao: string; observacao: string | null }
) {
  const q = query(collection(db, "usuarios", uid, "parcelas"), where("lancamentoId", "==", lancamentoId));
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.update(d.ref, { ...campos }));
  await batch.commit();
}

export async function excluirParcela(uid: string, parcelaId: string, lancamentoId: string) {
  await deleteDoc(doc(db, "usuarios", uid, "parcelas", parcelaId));
  await excluirLancamentoRecebimento(uid, lancamentoId);
}

export async function excluirLancamento(uid: string, lancamentoId: string) {
  const q = query(
    collection(db, "usuarios", uid, "parcelas"),
    where("lancamentoId", "==", lancamentoId)
  );
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  await excluirLancamentoRecebimento(uid, lancamentoId);
}

export async function materializarPagamentoRecorrencia(
  uid: string,
  recorrencia: Recorrencia,
  ym: string
) {
  const valor = valorNoMes(recorrencia, ym);
  const vencimento = vencimentoNoMes(recorrencia, ym);
  const grupo = recorrencia.grupo ?? GRUPO_FIXAS;
  await addDoc(collection(db, "usuarios", uid, "parcelas"), {
    lancamentoId: recorrencia.id,
    recorrenciaId: recorrencia.id,
    credor: recorrencia.credor,
    dataCompra: recorrencia.inicio,
    observacao: recorrencia.observacao,
    valorTotal: valor,
    parcelaNum: 1,
    parcelaTotal: 1,
    valorParcela: valor,
    comp: recorrencia.comp ?? null,
    grupo,
    aplicacao: recorrencia.aplicacao ?? "Outros",
    vencimento,
    pago: true,
    pagoEm: hojeISO(),
    provisao: recorrencia.provisao === true,
    origemCompartilhado: recorrencia.origemCompartilhado ?? null,
    criadoEm: serverTimestamp(),
  });

  // Pode já existir um reembolso gerado antecipadamente (sincronizarReembolsosRecorrentes) para este mês.
  const reembolsoExistente = await getDocs(
    query(
      collection(db, "usuarios", uid, "recebimentos"),
      where("lancamentoId", "==", recorrencia.id),
      where("recebimento", "==", vencimento),
      where("origemComp", "==", true)
    )
  );
  if (!reembolsoExistente.empty) return;

  await sincronizarReembolso(uid, {
    lancamentoId: recorrencia.id,
    compNome: recorrencia.comp ?? null,
    observacao: recorrencia.observacao,
    valorTotal: valor,
    parcelaTotal: 1,
    dataInicio: vencimento,
    grupoOrigem: grupo,
    provisao: recorrencia.provisao === true,
  });
}
