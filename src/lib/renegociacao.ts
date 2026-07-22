import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type WriteBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { criarLancamento } from "./parcelas";
import { ativaNoMes, valorNoMes } from "./recorrencias";
import { somarMesesYM } from "./date";
import { GRUPO_FIXAS } from "./config";
import type { EscopoRenegociacao, NovoLancamento, Parcela, Recebimento, Recorrencia, Renegociacao } from "./types";

const TAMANHO_CHUNK = 450;

export function formatarNumeroRenegociacao(numero: number | null | undefined): string {
  return String(numero ?? 0).padStart(3, "0");
}

type OperacaoBatch = (batch: WriteBatch) => void;

async function commitEmChunks(operacoes: OperacaoBatch[]) {
  for (let i = 0; i < operacoes.length; i += TAMANHO_CHUNK) {
    const batch = writeBatch(db);
    operacoes.slice(i, i + TAMANHO_CHUNK).forEach((op) => op(batch));
    await batch.commit();
  }
}

export async function calcularValorRenegociacao(
  uid: string,
  params: { grupo: string; ym: string; escopo: EscopoRenegociacao }
): Promise<number> {
  const { grupo, ym, escopo } = params;
  const inicio = `${ym}-01`;

  const parcelasQuery =
    escopo === "mes"
      ? query(
          collection(db, "usuarios", uid, "parcelas"),
          where("vencimento", ">=", inicio),
          where("vencimento", "<=", `${ym}-31`)
        )
      : query(collection(db, "usuarios", uid, "parcelas"), where("vencimento", ">=", inicio));
  const parcelasSnap = await getDocs(parcelasQuery);
  const totalAvulsas = parcelasSnap.docs.reduce((soma, d) => {
    const p = d.data() as Parcela;
    if (p.grupo === grupo && !p.recorrenciaId) return soma + p.valorParcela;
    return soma;
  }, 0);

  const recorrenciasSnap = await getDocs(
    query(collection(db, "usuarios", uid, "recorrencias"), where("tipo", "==", "pagar"))
  );
  const totalRecorrencias = recorrenciasSnap.docs.reduce((soma, d) => {
    const r = d.data() as Recorrencia;
    if ((r.grupo ?? GRUPO_FIXAS) === grupo && ativaNoMes(r, ym)) return soma + valorNoMes(r, ym);
    return soma;
  }, 0);

  return totalAvulsas + totalRecorrencias;
}

export async function renegociar(
  uid: string,
  params: { grupo: string; ym: string; escopo: EscopoRenegociacao; novoLancamento: NovoLancamento }
): Promise<{ renegociacaoId: string; numero: number }> {
  const { grupo, ym, escopo, novoLancamento } = params;

  const renegociacoesRef = collection(db, "usuarios", uid, "renegociacoes");
  const renegociacaoRef = doc(renegociacoesRef);

  const ultimaSnap = await getDocs(query(renegociacoesRef, orderBy("numero", "desc"), limit(1)));
  const numero = ultimaSnap.empty ? 1 : (ultimaSnap.docs[0].data() as Renegociacao).numero + 1;

  const inicio = `${ym}-01`;

  const parcelasQuery =
    escopo === "mes"
      ? query(
          collection(db, "usuarios", uid, "parcelas"),
          where("vencimento", ">=", inicio),
          where("vencimento", "<=", `${ym}-31`)
        )
      : query(collection(db, "usuarios", uid, "parcelas"), where("vencimento", ">=", inicio));
  const parcelasSnap = await getDocs(parcelasQuery);
  // Parcelas avulsas não gravam recorrenciaId (fica ausente, não null) — por isso o filtro
  // de "é avulsa" é feito em JS (!p.recorrenciaId), nunca via where("recorrenciaId","==",null).
  const parcelasAvulsas = parcelasSnap.docs.filter((d) => {
    const p = d.data() as Parcela;
    return p.grupo === grupo && !p.recorrenciaId;
  });

  const recorrenciasSnap = await getDocs(
    query(collection(db, "usuarios", uid, "recorrencias"), where("tipo", "==", "pagar"))
  );
  const recorrenciasCandidatas = recorrenciasSnap.docs
    .map((d) => ({ id: d.id, dados: d.data() as Recorrencia }))
    .filter(({ dados }) => (dados.grupo ?? GRUPO_FIXAS) === grupo && ativaNoMes(dados, ym));

  const parcelasSnapshot: { id: string; dados: Record<string, unknown> }[] = [];
  const recebimentosSnapshot: { id: string; dados: Record<string, unknown> }[] = [];
  let substituiRenegociacaoId: string | null = null;

  for (const d of parcelasAvulsas) {
    const p = d.data() as Parcela;
    parcelasSnapshot.push({ id: d.id, dados: d.data() as Record<string, unknown> });
    if (!substituiRenegociacaoId && p.renegociacaoId) substituiRenegociacaoId = p.renegociacaoId;

    const recebSnap = await getDocs(
      query(
        collection(db, "usuarios", uid, "recebimentos"),
        where("lancamentoId", "==", p.lancamentoId),
        where("recebimento", "==", p.vencimento),
        where("origemComp", "==", true)
      )
    );
    recebSnap.docs.forEach((rd) => {
      recebimentosSnapshot.push({ id: rd.id, dados: rd.data() as Record<string, unknown> });
    });
  }

  const recorrenciasAjustadas: Renegociacao["recorrenciasAjustadas"] = [];

  for (const { id: recorrenciaId, dados: rec } of recorrenciasCandidatas) {
    recorrenciasAjustadas.push({
      recorrenciaId,
      mesesExcluidosAntes: rec.mesesExcluidos ?? [],
      fimAntes: rec.fim,
    });

    const parcelasRecSnap = await getDocs(
      query(collection(db, "usuarios", uid, "parcelas"), where("recorrenciaId", "==", recorrenciaId))
    );
    parcelasRecSnap.docs.forEach((d) => {
      const p = d.data() as Parcela;
      const pertence = escopo === "mes" ? p.vencimento.slice(0, 7) === ym : p.vencimento.slice(0, 7) >= ym;
      if (!pertence) return;
      parcelasSnapshot.push({ id: d.id, dados: d.data() as Record<string, unknown> });
      if (!substituiRenegociacaoId && p.renegociacaoId) substituiRenegociacaoId = p.renegociacaoId;
    });

    const recebRecSnap = await getDocs(
      query(
        collection(db, "usuarios", uid, "recebimentos"),
        where("lancamentoId", "==", recorrenciaId),
        where("origemComp", "==", true)
      )
    );
    recebRecSnap.docs.forEach((d) => {
      const r = d.data() as Recebimento;
      const pertence = escopo === "mes" ? r.recebimento.slice(0, 7) === ym : r.recebimento.slice(0, 7) >= ym;
      if (!pertence) return;
      recebimentosSnapshot.push({ id: d.id, dados: d.data() as Record<string, unknown> });
    });
  }

  let lancamentoId: string;
  try {
    lancamentoId = await criarLancamento(uid, novoLancamento);
  } catch {
    throw new Error("Não foi possível criar o novo lançamento da renegociação. Nada foi alterado.");
  }

  try {
    const [novasParcelasSnap, novosRecebimentosSnap] = await Promise.all([
      getDocs(query(collection(db, "usuarios", uid, "parcelas"), where("lancamentoId", "==", lancamentoId))),
      getDocs(query(collection(db, "usuarios", uid, "recebimentos"), where("lancamentoId", "==", lancamentoId))),
    ]);

    const operacoes: OperacaoBatch[] = [];

    novasParcelasSnap.docs.forEach((d) => {
      operacoes.push((batch) =>
        batch.update(d.ref, { renegociacaoId: renegociacaoRef.id, renegociacaoNumero: numero })
      );
    });
    novosRecebimentosSnap.docs.forEach((d) => {
      operacoes.push((batch) =>
        batch.update(d.ref, { renegociacaoId: renegociacaoRef.id, renegociacaoNumero: numero })
      );
    });

    parcelasSnapshot.forEach(({ id }) => {
      operacoes.push((batch) => batch.delete(doc(db, "usuarios", uid, "parcelas", id)));
    });
    recebimentosSnapshot.forEach(({ id }) => {
      operacoes.push((batch) => batch.delete(doc(db, "usuarios", uid, "recebimentos", id)));
    });
    recorrenciasCandidatas.forEach(({ id, dados: rec }) => {
      if (escopo === "mes") {
        const mesesExcluidos = [...(rec.mesesExcluidos ?? []), ym];
        operacoes.push((batch) => batch.update(doc(db, "usuarios", uid, "recorrencias", id), { mesesExcluidos }));
      } else {
        const fim = `${somarMesesYM(ym, -1)}-01`;
        operacoes.push((batch) => batch.update(doc(db, "usuarios", uid, "recorrencias", id), { fim }));
      }
    });

    await commitEmChunks(operacoes);

    const operacoesSnapshot: OperacaoBatch[] = [];
    parcelasSnapshot.forEach(({ id, dados }) => {
      operacoesSnapshot.push((batch) =>
        batch.set(doc(db, "usuarios", uid, "renegociacoes", renegociacaoRef.id, "parcelasSnapshot", id), dados)
      );
    });
    recebimentosSnapshot.forEach(({ id, dados }) => {
      operacoesSnapshot.push((batch) =>
        batch.set(doc(db, "usuarios", uid, "renegociacoes", renegociacaoRef.id, "recebimentosSnapshot", id), dados)
      );
    });
    await commitEmChunks(operacoesSnapshot);

    await setDoc(renegociacaoRef, {
      numero,
      grupo,
      escopo,
      ym,
      lancamentoId,
      criadoEm: serverTimestamp(),
      substituiRenegociacaoId: substituiRenegociacaoId ?? null,
      recorrenciasAjustadas,
    });
  } catch {
    throw new Error(
      `O novo lançamento foi criado, mas a renegociação não foi concluída — os lançamentos antigos de "${grupo}" podem não ter sido removidos. Confira Contas a Pagar e Contas a Receber antes de tentar novamente.`
    );
  }

  return { renegociacaoId: renegociacaoRef.id, numero };
}

export async function desfazerRenegociacao(uid: string, renegociacaoId: string): Promise<void> {
  const renegociacaoRef = doc(db, "usuarios", uid, "renegociacoes", renegociacaoId);
  const renegociacaoSnap = await getDoc(renegociacaoRef);
  if (!renegociacaoSnap.exists()) return;
  const renegociacao = renegociacaoSnap.data() as Renegociacao;

  const [parcelasNovasSnap, recebimentosNovosSnap, parcelasSnapshotSnap, recebimentosSnapshotSnap] =
    await Promise.all([
      getDocs(query(collection(db, "usuarios", uid, "parcelas"), where("renegociacaoId", "==", renegociacaoId))),
      getDocs(
        query(collection(db, "usuarios", uid, "recebimentos"), where("lancamentoId", "==", renegociacao.lancamentoId))
      ),
      getDocs(collection(db, "usuarios", uid, "renegociacoes", renegociacaoId, "parcelasSnapshot")),
      getDocs(collection(db, "usuarios", uid, "renegociacoes", renegociacaoId, "recebimentosSnapshot")),
    ]);

  const operacoes: OperacaoBatch[] = [];

  parcelasNovasSnap.docs.forEach((d) => operacoes.push((batch) => batch.delete(d.ref)));
  recebimentosNovosSnap.docs.forEach((d) => operacoes.push((batch) => batch.delete(d.ref)));

  parcelasSnapshotSnap.docs.forEach((d) => {
    operacoes.push((batch) => batch.set(doc(db, "usuarios", uid, "parcelas", d.id), d.data()));
    operacoes.push((batch) => batch.delete(d.ref));
  });
  recebimentosSnapshotSnap.docs.forEach((d) => {
    operacoes.push((batch) => batch.set(doc(db, "usuarios", uid, "recebimentos", d.id), d.data()));
    operacoes.push((batch) => batch.delete(d.ref));
  });

  renegociacao.recorrenciasAjustadas.forEach(({ recorrenciaId, mesesExcluidosAntes, fimAntes }) => {
    operacoes.push((batch) =>
      batch.update(doc(db, "usuarios", uid, "recorrencias", recorrenciaId), {
        mesesExcluidos: mesesExcluidosAntes,
        fim: fimAntes,
      })
    );
  });

  operacoes.push((batch) => batch.delete(renegociacaoRef));

  await commitEmChunks(operacoes);
}

export function assinarRenegociacoes(uid: string, callback: (lista: Renegociacao[]) => void) {
  const q = query(collection(db, "usuarios", uid, "renegociacoes"), orderBy("numero", "asc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Renegociacao));
  });
}
