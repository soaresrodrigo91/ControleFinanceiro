import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
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
import { somarMeses, somarMesesYM } from "./date";
import { dividirValor } from "./dinheiro";
import { ativaNoMes, valorNoMes, vencimentoNoMes } from "./recorrencias";
import type { ConfigListas, NovoRecebimento, Recebimento, Recorrencia } from "./types";

export function assinarRecebimentosDoMes(
  uid: string,
  ym: string,
  callback: (recebimentos: Recebimento[]) => void
) {
  const inicio = `${ym}-01`;
  const fim = `${ym}-31`;
  const q = query(
    collection(db, "usuarios", uid, "recebimentos"),
    where("recebimento", ">=", inicio),
    where("recebimento", "<=", fim),
    orderBy("recebimento")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Recebimento));
  });
}

export function assinarRecebimentosDoIntervalo(
  uid: string,
  ymInicio: string,
  ymFim: string,
  callback: (recebimentos: Recebimento[]) => void
) {
  const inicio = `${ymInicio}-01`;
  const fim = `${ymFim}-31`;
  const q = query(
    collection(db, "usuarios", uid, "recebimentos"),
    where("recebimento", ">=", inicio),
    where("recebimento", "<=", fim),
    orderBy("recebimento")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Recebimento));
  });
}

export function assinarTodosRecebimentos(
  uid: string,
  callback: (recebimentos: Recebimento[]) => void
) {
  const q = query(
    collection(db, "usuarios", uid, "recebimentos"),
    orderBy("recebimento", "desc")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Recebimento));
  });
}

export async function criarRecebimento(uid: string, dados: NovoRecebimento) {
  const lancamentoId = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  const valores = dados.valorPorParcela
    ? Array(dados.parcelaTotal).fill(dados.valor)
    : dividirValor(dados.valor, dados.parcelaTotal);

  const batch = writeBatch(db);
  const recebimentosRef = collection(db, "usuarios", uid, "recebimentos");

  valores.forEach((valorParcela, indice) => {
    const ref = doc(recebimentosRef);
    batch.set(ref, {
      lancamentoId,
      origem: dados.origem,
      valor: valorParcela,
      recebimento: somarMeses(dados.recebimento, indice),
      qtdParcelas: dados.parcelaTotal,
      parcela: `${indice + 1}/${dados.parcelaTotal}`,
      observacao: dados.observacao || null,
      recebido: false,
      criadoEm: serverTimestamp(),
    });
  });

  await batch.commit();
}

export async function sincronizarReembolso(
  uid: string,
  dados: {
    lancamentoId: string;
    compNome: string | null;
    observacao: string | null;
    valorTotal: number;
    parcelaTotal: number;
    dataInicio: string;
    grupoOrigem: string | null;
    provisao?: boolean;
  }
) {
  if (!dados.compNome) return;

  const configSnap = await getDoc(doc(db, "usuarios", uid, "config", "listas"));
  const itemComp = (configSnap.data() as ConfigListas | undefined)?.comp?.find(
    (c) => c.nome === dados.compNome
  );
  if (!itemComp || itemComp.modo === "nenhum") return;

  const valorReembolso = itemComp.modo === "metade" ? dados.valorTotal / 2 : dados.valorTotal;
  const valores = dividirValor(valorReembolso, dados.parcelaTotal);

  const batch = writeBatch(db);
  const recebimentosRef = collection(db, "usuarios", uid, "recebimentos");
  valores.forEach((valorParcela, indice) => {
    const ref = doc(recebimentosRef);
    batch.set(ref, {
      lancamentoId: dados.lancamentoId,
      origem: dados.compNome,
      valor: valorParcela,
      recebimento: somarMeses(dados.dataInicio, indice),
      qtdParcelas: dados.parcelaTotal,
      parcela: `${indice + 1}/${dados.parcelaTotal}`,
      observacao: dados.observacao,
      recebido: false,
      origemComp: true,
      formaPagamentoOrigem: dados.grupoOrigem,
      provisao: dados.provisao === true,
      criadoEm: serverTimestamp(),
    });
  });
  await batch.commit();
}

export async function sincronizarValorReembolso(
  uid: string,
  lancamentoId: string,
  vencimento: string,
  compNome: string,
  novoValorParcela: number,
  dadosParaRecriar?: { observacao: string | null; grupoOrigem: string | null; provisao?: boolean }
) {
  const configSnap = await getDoc(doc(db, "usuarios", uid, "config", "listas"));
  const itemComp = (configSnap.data() as ConfigListas | undefined)?.comp?.find(
    (c) => c.nome === compNome
  );
  if (!itemComp || itemComp.modo === "nenhum") return;
  const novoValorReembolso = itemComp.modo === "metade" ? novoValorParcela / 2 : novoValorParcela;

  const snap = await getDocs(
    query(
      collection(db, "usuarios", uid, "recebimentos"),
      where("lancamentoId", "==", lancamentoId),
      where("recebimento", "==", vencimento),
      where("origemComp", "==", true)
    )
  );
  if (snap.empty) {
    if (!dadosParaRecriar) return;
    await addDoc(collection(db, "usuarios", uid, "recebimentos"), {
      lancamentoId,
      origem: compNome,
      valor: novoValorReembolso,
      recebimento: vencimento,
      qtdParcelas: 1,
      parcela: "1/1",
      observacao: dadosParaRecriar.observacao,
      recebido: false,
      origemComp: true,
      formaPagamentoOrigem: dadosParaRecriar.grupoOrigem,
      provisao: dadosParaRecriar.provisao === true,
      criadoEm: serverTimestamp(),
    });
    return;
  }
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.update(d.ref, { valor: novoValorReembolso }));
  await batch.commit();
}

export async function sincronizarValorReembolsoRecorrencia(
  uid: string,
  lancamentoId: string,
  compNome: string,
  novoValorParcela: number,
  ymDesde?: string
) {
  const configSnap = await getDoc(doc(db, "usuarios", uid, "config", "listas"));
  const itemComp = (configSnap.data() as ConfigListas | undefined)?.comp?.find(
    (c) => c.nome === compNome
  );
  if (!itemComp || itemComp.modo === "nenhum") return;
  const novoValorReembolso = itemComp.modo === "metade" ? novoValorParcela / 2 : novoValorParcela;

  const snap = await getDocs(
    query(
      collection(db, "usuarios", uid, "recebimentos"),
      where("lancamentoId", "==", lancamentoId),
      where("origemComp", "==", true)
    )
  );
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach((d) => {
    const r = d.data() as Recebimento;
    if (!ymDesde || r.recebimento.slice(0, 7) >= ymDesde) {
      batch.update(d.ref, { valor: novoValorReembolso });
    }
  });
  await batch.commit();
}

export async function sincronizarReembolsosRecorrentes(
  uid: string,
  recorrencias: Recorrencia[],
  ym: string
) {
  const candidatas = recorrencias.filter((r) => r.comp && ativaNoMes(r, ym));
  if (candidatas.length === 0) return;

  const configSnap = await getDoc(doc(db, "usuarios", uid, "config", "listas"));
  const modoPorNome = Object.fromEntries(
    ((configSnap.data() as ConfigListas | undefined)?.comp ?? []).map((c) => [c.nome, c.modo])
  );

  for (const r of candidatas) {
    const modo = modoPorNome[r.comp as string];
    if (!modo || modo === "nenhum") continue;

    const vencimento = vencimentoNoMes(r, ym);

    // Se já existe uma parcela real para este mês (paga ou não), os fluxos normais já cuidam
    // do reembolso (ou corretamente não geram nenhum, caso de Provisões pagas) — não mexer aqui.
    const parcelaExistente = await getDocs(
      query(
        collection(db, "usuarios", uid, "parcelas"),
        where("recorrenciaId", "==", r.id),
        where("vencimento", "==", vencimento)
      )
    );
    if (!parcelaExistente.empty) continue;

    const q = query(
      collection(db, "usuarios", uid, "recebimentos"),
      where("lancamentoId", "==", r.id),
      where("recebimento", "==", vencimento),
      where("origemComp", "==", true)
    );
    const snap = await getDocs(q);
    if (!snap.empty) continue;

    const valor = valorNoMes(r, ym);
    const valorReembolso = modo === "metade" ? valor / 2 : valor;
    await addDoc(collection(db, "usuarios", uid, "recebimentos"), {
      lancamentoId: r.id,
      origem: r.comp,
      valor: valorReembolso,
      recebimento: vencimento,
      qtdParcelas: 1,
      parcela: "1/1",
      observacao: r.observacao,
      recebido: false,
      origemComp: true,
      formaPagamentoOrigem: r.grupo,
      provisao: r.provisao === true,
      criadoEm: serverTimestamp(),
    });
  }
}

export async function excluirLancamentoRecebimento(uid: string, lancamentoId: string) {
  const q = query(
    collection(db, "usuarios", uid, "recebimentos"),
    where("lancamentoId", "==", lancamentoId)
  );
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

export async function marcarRecebido(uid: string, recebimentoId: string, recebido: boolean) {
  await updateDoc(doc(db, "usuarios", uid, "recebimentos", recebimentoId), { recebido });
}

export type EdicaoRecebimento = {
  origem: string;
  valor: number;
  recebimento: string;
  observacao: string | null;
};

export async function atualizarRecebimento(
  uid: string,
  recebimentoId: string,
  dados: EdicaoRecebimento
) {
  await updateDoc(doc(db, "usuarios", uid, "recebimentos", recebimentoId), { ...dados });
}

export async function excluirRecebimento(uid: string, recebimentoId: string) {
  await deleteDoc(doc(db, "usuarios", uid, "recebimentos", recebimentoId));
}

export type EdicaoRecorrenciaRecebimento = {
  origem: string;
  observacao: string | null;
  valor: number;
};

export async function atualizarRecebimentoRecorrenteApenasMes(
  uid: string,
  recebimento: Recebimento,
  dados: EdicaoRecorrenciaRecebimento
) {
  if (!recebimento.virtual) {
    await updateDoc(doc(db, "usuarios", uid, "recebimentos", recebimento.id), {
      origem: dados.origem,
      observacao: dados.observacao,
      valor: dados.valor,
    });
    return;
  }

  await addDoc(collection(db, "usuarios", uid, "recebimentos"), {
    origem: dados.origem,
    valor: dados.valor,
    recebimento: recebimento.recebimento,
    qtdParcelas: 1,
    parcela: "1/1",
    observacao: dados.observacao,
    recebido: false,
    recorrenciaId: recebimento.recorrenciaId,
    criadoEm: serverTimestamp(),
  });
}

export async function atualizarRecorrenciaRecebimentoDesteMesEmDiante(
  uid: string,
  recorrenciaId: string,
  ym: string,
  dados: EdicaoRecorrenciaRecebimento
) {
  const batch = writeBatch(db);
  const ref = doc(db, "usuarios", uid, "recorrencias", recorrenciaId);
  const snap = await getDoc(ref);
  const historicoAtual = (snap.data() as Recorrencia | undefined)?.historicoValores ?? [];
  batch.update(ref, {
    credor: dados.origem,
    observacao: dados.observacao,
    valorAtual: dados.valor,
    historicoValores: [...historicoAtual, { valor: dados.valor, desde: `${ym}-01` }],
  });

  const q = query(
    collection(db, "usuarios", uid, "recebimentos"),
    where("recorrenciaId", "==", recorrenciaId)
  );
  const snapRec = await getDocs(q);
  snapRec.docs.forEach((d) => {
    const r = d.data() as Recebimento;
    if (r.recebimento.slice(0, 7) >= ym) {
      batch.update(d.ref, { origem: dados.origem, observacao: dados.observacao, valor: dados.valor });
    }
  });
  await batch.commit();
}

export async function atualizarRecorrenciaRecebimentoTudo(
  uid: string,
  recorrenciaId: string,
  dados: EdicaoRecorrenciaRecebimento
) {
  const batch = writeBatch(db);
  const ref = doc(db, "usuarios", uid, "recorrencias", recorrenciaId);
  const snap = await getDoc(ref);
  const inicio = (snap.data() as Recorrencia | undefined)?.inicio ?? "";
  batch.update(ref, {
    credor: dados.origem,
    observacao: dados.observacao,
    valorAtual: dados.valor,
    historicoValores: [{ valor: dados.valor, desde: inicio }],
  });

  const q = query(
    collection(db, "usuarios", uid, "recebimentos"),
    where("recorrenciaId", "==", recorrenciaId)
  );
  const snapRec = await getDocs(q);
  snapRec.docs.forEach((d) => {
    batch.update(d.ref, { origem: dados.origem, observacao: dados.observacao, valor: dados.valor });
  });
  await batch.commit();
}

export async function excluirRecebimentoRecorrenciaApenasMes(uid: string, recorrenciaId: string, ym: string) {
  const q = query(
    collection(db, "usuarios", uid, "recebimentos"),
    where("recorrenciaId", "==", recorrenciaId)
  );
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach((d) => {
    const r = d.data() as Recebimento;
    if (r.recebimento.slice(0, 7) === ym) batch.delete(d.ref);
  });

  const ref = doc(db, "usuarios", uid, "recorrencias", recorrenciaId);
  const snapR = await getDoc(ref);
  const atuais = (snapR.data() as Recorrencia | undefined)?.mesesExcluidos ?? [];
  batch.update(ref, { mesesExcluidos: [...atuais, ym] });

  await batch.commit();
}

export async function excluirRecebimentoRecorrenciaDesteMesEmDiante(
  uid: string,
  recorrenciaId: string,
  ym: string
) {
  const q = query(
    collection(db, "usuarios", uid, "recebimentos"),
    where("recorrenciaId", "==", recorrenciaId)
  );
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach((d) => {
    const r = d.data() as Recebimento;
    if (r.recebimento.slice(0, 7) >= ym) batch.delete(d.ref);
  });

  const ref = doc(db, "usuarios", uid, "recorrencias", recorrenciaId);
  batch.update(ref, { fim: `${somarMesesYM(ym, -1)}-01` });

  await batch.commit();
}

export async function excluirRecebimentoRecorrenciaTudo(uid: string, recorrenciaId: string) {
  const q = query(
    collection(db, "usuarios", uid, "recebimentos"),
    where("recorrenciaId", "==", recorrenciaId)
  );
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, "usuarios", uid, "recorrencias", recorrenciaId));
  await batch.commit();
}

export async function materializarRecebimentoRecorrencia(
  uid: string,
  recorrencia: Recorrencia,
  ym: string
) {
  const valor = valorNoMes(recorrencia, ym);
  await addDoc(collection(db, "usuarios", uid, "recebimentos"), {
    origem: recorrencia.credor,
    valor,
    recebimento: vencimentoNoMes(recorrencia, ym),
    qtdParcelas: 1,
    parcela: "1/1",
    observacao: recorrencia.observacao,
    recebido: true,
    recorrenciaId: recorrencia.id,
  });
}
