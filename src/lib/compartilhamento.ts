import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import { criarLancamento } from "./parcelas";
import { adicionarItemLista } from "./config";
import { criarNotificacao } from "./notificacoes";
import { somarMesesYM } from "./date";
import { ativaNoMes, criarRecorrencia, valorNoMes, vencimentoNoMes } from "./recorrencias";
import type {
  ConfigListas,
  LancamentoCompartilhado,
  Parcela,
  Recorrencia,
  VinculoCompartilhamento,
} from "./types";

const JANELA_MESES_RECORRENCIA = 10;

type ItemParaCompartilhar = {
  chave: string;
  grupoOrigemId: string;
  parcela: string;
  vencimento: string;
  valorParcela: number;
  observacao: string | null;
  aplicacao: string;
  dataCompra: string | null;
  recorrenciaOrigemId: string | null;
};

async function itensParaCompartilharDeParcela(
  uid: string,
  p: Parcela,
  recorrencias: Recorrencia[],
  jaCompartilhados: Set<string>
): Promise<ItemParaCompartilhar[]> {
  if (p.recorrenciaId) {
    const rec = recorrencias.find((r) => r.id === p.recorrenciaId);
    if (!rec) return [];
    const ymInicio = p.vencimento.slice(0, 7);
    const resultado: ItemParaCompartilhar[] = [];
    for (let i = 0; i < JANELA_MESES_RECORRENCIA; i++) {
      const ym = somarMesesYM(ymInicio, i);
      if (!ativaNoMes(rec, ym)) continue;
      const chave = `${rec.id}_${ym}`;
      if (jaCompartilhados.has(chave)) continue;
      resultado.push({
        chave,
        grupoOrigemId: rec.id,
        parcela: "Fixa",
        vencimento: vencimentoNoMes(rec, ym),
        valorParcela: valorNoMes(rec, ym),
        observacao: rec.observacao,
        aplicacao: rec.aplicacao ?? p.aplicacao,
        dataCompra: null,
        recorrenciaOrigemId: rec.id,
      });
    }
    return resultado;
  }

  const snap = await getDocs(
    query(collection(db, "usuarios", uid, "parcelas"), where("lancamentoId", "==", p.lancamentoId))
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Parcela)
    .filter((parc) => !jaCompartilhados.has(parc.id))
    .map((parc) => ({
      chave: parc.id,
      grupoOrigemId: parc.lancamentoId,
      parcela: parc.parcelaTotal > 1 ? `${parc.parcelaNum}/${parc.parcelaTotal}` : "—",
      vencimento: parc.vencimento,
      valorParcela: parc.valorParcela,
      observacao: parc.observacao,
      aplicacao: parc.aplicacao,
      dataCompra: parc.dataCompra,
      recorrenciaOrigemId: null,
    }));
}

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function buscarUsuarioPorEmail(
  email: string
): Promise<{ uid: string; nome: string } | null> {
  const snap = await getDoc(doc(db, "indiceEmails", normalizarEmail(email)));
  if (!snap.exists()) return null;
  const dados = snap.data();
  return { uid: dados.uid as string, nome: `${dados.nome ?? ""} ${dados.sobrenome ?? ""}`.trim() };
}

export function assinarVinculos(uid: string, callback: (vinculos: VinculoCompartilhamento[]) => void) {
  return onSnapshot(collection(db, "usuarios", uid, "vinculosCompartilhamento"), (snap) => {
    callback(snap.docs.map((d) => d.data() as VinculoCompartilhamento));
  });
}

export function vinculoPorCompNome(vinculos: VinculoCompartilhamento[]): Map<string, VinculoCompartilhamento> {
  return new Map(vinculos.map((v) => [v.compNome, v]));
}

async function incrementarIndiceEmail(uid: string, emailNormalizado: string) {
  const ref = doc(db, "usuarios", uid, "emailsVinculados", emailNormalizado);
  const snap = await getDoc(ref);
  const atual = snap.exists() ? (snap.data().contagem as number) : 0;
  await setDoc(ref, { contagem: atual + 1 });
}

async function decrementarIndiceEmail(uid: string, emailNormalizado: string) {
  const ref = doc(db, "usuarios", uid, "emailsVinculados", emailNormalizado);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const atual = snap.data().contagem as number;
  if (atual <= 1) {
    await deleteDoc(ref);
  } else {
    await updateDoc(ref, { contagem: atual - 1 });
  }
}

// Vínculo é indexado por compNome (não por e-mail) para permitir vincular o mesmo
// e-mail a mais de um reembolso da mesma pessoa (ex.: percentuais diferentes).
// O índice separado emailsVinculados/{email} (contagem de comps que apontam pra ele)
// existe só para as regras do Firestore conseguirem checar "existe algum vínculo pra
// esse e-mail" em O(1), sem precisar variar por compNome.
export async function salvarVinculo(
  uid: string,
  compNome: string,
  email: string,
  emailAnterior?: string | null
): Promise<boolean> {
  const emailNormalizado = normalizarEmail(email);
  const usuarioVinculado = await buscarUsuarioPorEmail(emailNormalizado);
  if (!usuarioVinculado) return false;

  const emailAnteriorNormalizado = emailAnterior ? normalizarEmail(emailAnterior) : null;
  if (emailAnteriorNormalizado && emailAnteriorNormalizado !== emailNormalizado) {
    await decrementarIndiceEmail(uid, emailAnteriorNormalizado);
  }
  if (emailAnteriorNormalizado !== emailNormalizado) {
    await incrementarIndiceEmail(uid, emailNormalizado);
  }

  await setDoc(doc(db, "usuarios", uid, "vinculosCompartilhamento", compNome), {
    compNome,
    emailVinculado: emailNormalizado,
    uidVinculado: usuarioVinculado.uid,
    nomeVinculado: usuarioVinculado.nome,
    criadoEm: serverTimestamp(),
  });
  return true;
}

export async function removerVinculo(uid: string, compNome: string, email: string) {
  await deleteDoc(doc(db, "usuarios", uid, "vinculosCompartilhamento", compNome));
  await decrementarIndiceEmail(uid, normalizarEmail(email));
}

export async function atualizarCompartilharLancamentos(uid: string, ativo: boolean) {
  await updateDoc(doc(db, "usuarios", uid, "config", "listas"), { compartilharLancamentos: ativo });
}

export async function temCompartilhamentosAtivos(uid: string): Promise<boolean> {
  const [enviados, recebidos] = await Promise.all(
    ["deUid", "paraUid"].map(async (campo) => {
      const q = query(collection(db, "lancamentosCompartilhados"), where(campo, "==", uid), limit(1));
      const snap = await getDocs(q);
      return !snap.empty;
    })
  );
  return enviados || recebidos;
}

export function candidatosParaCompartilhar(
  parcelas: Parcela[],
  vinculos: VinculoCompartilhamento[]
): Parcela[] {
  const compsVinculados = new Set(vinculos.map((v) => v.compNome));
  return parcelas.filter((p) => p.comp && compsVinculados.has(p.comp));
}

export function assinarEnviados(uid: string, callback: (itens: LancamentoCompartilhado[]) => void) {
  const q = query(collection(db, "lancamentosCompartilhados"), where("deUid", "==", uid));
  return onSnapshot(q, (snap) => {
    const itens = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as LancamentoCompartilhado)
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
    callback(itens);
  });
}

export function assinarRecebidos(uid: string, callback: (itens: LancamentoCompartilhado[]) => void) {
  const q = query(collection(db, "lancamentosCompartilhados"), where("paraUid", "==", uid));
  return onSnapshot(q, (snap) => {
    const itens = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as LancamentoCompartilhado)
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
    callback(itens);
  });
}

export async function compartilharSelecionados(
  uid: string,
  nomeRemetente: string,
  emailRemetente: string,
  itens: Parcela[],
  config: ConfigListas,
  vinculos: VinculoCompartilhamento[],
  recorrencias: Recorrencia[],
  enviados: LancamentoCompartilhado[]
) {
  const porComp = vinculoPorCompNome(vinculos);
  const emailNormalizadoRemetente = normalizarEmail(emailRemetente);
  const jaCompartilhados = new Set(enviados.map((e) => e.lancamentoOrigemId));

  const porDestinatario = new Map<
    string,
    {
      email: string;
      nome: string;
      algumCriado: boolean;
      algumFalhou: boolean;
      primeiroVencimento: string | null;
    }
  >();

  for (const p of itens) {
    if (!p.comp) continue;
    const vinculo = porComp.get(p.comp);
    if (!vinculo) continue;
    const itemComp = config.comp.find((c) => c.nome === p.comp);
    if (!itemComp || itemComp.modo === "nenhum") continue;

    const expandidos = await itensParaCompartilharDeParcela(uid, p, recorrencias, jaCompartilhados);
    if (expandidos.length === 0) continue;

    let destino = porDestinatario.get(vinculo.uidVinculado);
    if (!destino) {
      destino = {
        email: vinculo.emailVinculado,
        nome: vinculo.nomeVinculado || vinculo.emailVinculado,
        algumCriado: false,
        algumFalhou: false,
        primeiroVencimento: null,
      };
      porDestinatario.set(vinculo.uidVinculado, destino);
    }

    for (const item of expandidos) {
      if (jaCompartilhados.has(item.chave)) continue;
      const valor = itemComp.modo === "metade" ? item.valorParcela / 2 : item.valorParcela;
      try {
        await addDoc(collection(db, "lancamentosCompartilhados"), {
          deUid: uid,
          deEmail: emailNormalizadoRemetente,
          deNome: nomeRemetente,
          paraUid: vinculo.uidVinculado,
          paraEmail: vinculo.emailVinculado,
          lancamentoOrigemId: item.chave,
          recorrenciaOrigemId: item.recorrenciaOrigemId,
          grupoOrigemId: item.grupoOrigemId,
          parcela: item.parcela,
          compNome: p.comp,
          credorSugerido: nomeRemetente,
          observacao: item.observacao,
          aplicacaoSugerida: item.aplicacao,
          valor,
          dataCompra: item.dataCompra,
          vencimento: item.vencimento,
          status: "pendente",
          criadoEm: new Date().toISOString(),
        });
        jaCompartilhados.add(item.chave);
        destino.algumCriado = true;
        if (!destino.primeiroVencimento || item.vencimento < destino.primeiroVencimento) {
          destino.primeiroVencimento = item.vencimento;
        }
      } catch {
        destino.algumFalhou = true;
        break;
      }
    }
  }

  for (const [uidDestino, destino] of porDestinatario) {
    if (destino.algumCriado) {
      await criarNotificacao({
        deUid: uid,
        uidDestino,
        paraEmail: destino.email,
        tipo: "recebido",
        mensagem: `${nomeRemetente} compartilhou um lançamento com você.`,
        deNome: nomeRemetente,
        ym: destino.primeiroVencimento?.slice(0, 7),
      });
    } else if (destino.algumFalhou) {
      await criarNotificacao({
        deUid: uid,
        uidDestino,
        paraEmail: destino.email,
        tipo: "convite",
        mensagem: `${nomeRemetente} quer compartilhar lançamentos com você. Ative "Compartilhar Lançamentos" nas Configurações para receber.`,
        deNome: nomeRemetente,
      });
      await criarNotificacao({
        deUid: uid,
        uidDestino: uid,
        paraEmail: destino.email,
        tipo: "convite",
        mensagem: `Aguardando ${destino.nome} ativar/configurar o recebimento de Lançamentos Compartilhados. Os itens continuam em Enviados como "Não enviado".`,
        deNome: nomeRemetente,
      });
    }
  }
}

export async function reenviarSelecionados(uid: string, nomeRemetente: string, itens: LancamentoCompartilhado[]) {
  const porDestinatario = new Map<
    string,
    { email: string; algumCriado: boolean; algumFalhou: boolean; primeiroVencimento: string | null }
  >();

  for (const item of itens) {
    let destino = porDestinatario.get(item.paraUid);
    if (!destino) {
      destino = { email: item.paraEmail, algumCriado: false, algumFalhou: false, primeiroVencimento: null };
      porDestinatario.set(item.paraUid, destino);
    }

    try {
      await addDoc(collection(db, "lancamentosCompartilhados"), {
        deUid: uid,
        deEmail: item.deEmail,
        deNome: nomeRemetente,
        paraUid: item.paraUid,
        paraEmail: item.paraEmail,
        lancamentoOrigemId: item.lancamentoOrigemId,
        recorrenciaOrigemId: item.recorrenciaOrigemId ?? null,
        grupoOrigemId: item.grupoOrigemId,
        parcela: item.parcela,
        compNome: item.compNome,
        credorSugerido: item.credorSugerido,
        observacao: item.observacao,
        aplicacaoSugerida: item.aplicacaoSugerida,
        valor: item.valor,
        dataCompra: item.dataCompra,
        vencimento: item.vencimento,
        status: "pendente",
        criadoEm: new Date().toISOString(),
      });
      await deleteDoc(doc(db, "lancamentosCompartilhados", item.id));
      destino.algumCriado = true;
      if (!destino.primeiroVencimento || item.vencimento < destino.primeiroVencimento) {
        destino.primeiroVencimento = item.vencimento;
      }
    } catch {
      destino.algumFalhou = true;
    }
  }

  for (const [uidDestino, destino] of porDestinatario) {
    if (destino.algumCriado) {
      await criarNotificacao({
        deUid: uid,
        uidDestino,
        paraEmail: destino.email,
        tipo: "recebido",
        mensagem: `${nomeRemetente} reenviou um lançamento compartilhado com você.`,
        deNome: nomeRemetente,
        ym: destino.primeiroVencimento?.slice(0, 7),
      });
    } else if (destino.algumFalhou) {
      await criarNotificacao({
        deUid: uid,
        uidDestino,
        paraEmail: destino.email,
        tipo: "convite",
        mensagem: `${nomeRemetente} quer compartilhar lançamentos com você. Ative "Compartilhar Lançamentos" nas Configurações para receber.`,
        deNome: nomeRemetente,
      });
      await criarNotificacao({
        deUid: uid,
        uidDestino: uid,
        paraEmail: destino.email,
        tipo: "convite",
        mensagem: `Aguardando ${destino.email} ativar/configurar o recebimento de Lançamentos Compartilhados. Os itens continuam em Enviados como "Não enviado".`,
        deNome: nomeRemetente,
      });
    }
  }
}

export async function notificarAtualizacaoRecorrencia(
  uid: string,
  recorrenciaId: string,
  compNome: string,
  novoValorParcela: number,
  config: ConfigListas,
  ymDesde: string | null
) {
  const itemComp = config.comp.find((c) => c.nome === compNome);
  if (!itemComp || itemComp.modo === "nenhum") return;

  const snap = await getDocs(
    query(
      collection(db, "lancamentosCompartilhados"),
      where("deUid", "==", uid),
      where("recorrenciaOrigemId", "==", recorrenciaId),
      where("status", "==", "pendente")
    )
  );
  if (snap.empty) return;

  const novoValorReembolso = itemComp.modo === "metade" ? novoValorParcela / 2 : novoValorParcela;
  const usuarioSnap = await getDoc(doc(db, "usuarios", uid));
  const dadosUsuario = usuarioSnap.data();
  const nomeRemetente = `${dadosUsuario?.nome ?? ""} ${dadosUsuario?.sobrenome ?? ""}`.trim();

  const porDestinatario = new Map<string, { email: string; primeiroVencimento: string }>();
  for (const d of snap.docs) {
    const item = d.data() as LancamentoCompartilhado;
    if (ymDesde && item.vencimento.slice(0, 7) < ymDesde) continue;
    await updateDoc(d.ref, { valor: novoValorReembolso });
    const atual = porDestinatario.get(item.paraUid);
    if (!atual || item.vencimento < atual.primeiroVencimento) {
      porDestinatario.set(item.paraUid, { email: item.paraEmail, primeiroVencimento: item.vencimento });
    }
  }

  for (const [uidDestino, destino] of porDestinatario) {
    await criarNotificacao({
      deUid: uid,
      uidDestino,
      paraEmail: destino.email,
      tipo: "atualizacao",
      mensagem: `${nomeRemetente} atualizou o valor de um lançamento fixo compartilhado.`,
      deNome: nomeRemetente,
      ym: destino.primeiroVencimento.slice(0, 7),
    });
  }
}

export type EscopoExclusaoRecebido = "mes" | "futuros" | "tudo";

async function excluirCompartilhadoComEscopo(
  campo: "paraUid" | "deUid",
  item: LancamentoCompartilhado,
  escopo: EscopoExclusaoRecebido
) {
  if (escopo === "mes") {
    await deleteDoc(doc(db, "lancamentosCompartilhados", item.id));
    return;
  }

  const snap = await getDocs(
    query(
      collection(db, "lancamentosCompartilhados"),
      where(campo, "==", item[campo]),
      where("grupoOrigemId", "==", item.grupoOrigemId),
      where("status", "==", "pendente")
    )
  );
  const alvos = snap.docs.filter((d) => {
    if (escopo === "tudo") return true;
    const dados = d.data() as LancamentoCompartilhado;
    return dados.vencimento >= item.vencimento;
  });
  await Promise.all(alvos.map((d) => deleteDoc(d.ref)));
}

export async function excluirRecebidoComEscopo(item: LancamentoCompartilhado, escopo: EscopoExclusaoRecebido) {
  return excluirCompartilhadoComEscopo("paraUid", item, escopo);
}

export async function excluirEnviadoComEscopo(item: LancamentoCompartilhado, escopo: EscopoExclusaoRecebido) {
  return excluirCompartilhadoComEscopo("deUid", item, escopo);
}

export function truncarNome(nome: string): string {
  const limpo = nome.trim();
  if (limpo.length <= 20) return limpo;
  const partes = limpo.split(/\s+/);
  if (partes.length === 1) return partes[0].slice(0, 20);
  return `${partes[0]} ${partes[partes.length - 1][0]}.`;
}

export async function lancarSelecionados(uid: string, itens: LancamentoCompartilhado[], grupoEscolhido: string) {
  const gruposProcessados = new Set<string>();

  for (const item of itens) {
    if (gruposProcessados.has(item.grupoOrigemId)) continue;
    gruposProcessados.add(item.grupoOrigemId);

    const snapGrupo = await getDocs(
      query(
        collection(db, "lancamentosCompartilhados"),
        where("paraUid", "==", item.paraUid),
        where("grupoOrigemId", "==", item.grupoOrigemId),
        where("status", "==", "pendente")
      )
    );
    const pendentesDoGrupo = snapGrupo.docs
      .map((d) => ({ id: d.id, ...d.data() }) as LancamentoCompartilhado)
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento));
    if (pendentesDoGrupo.length === 0) continue;

    await adicionarItemLista(uid, "aplicacoes", item.aplicacaoSugerida);
    const primeiro = pendentesDoGrupo[0];

    if (item.recorrenciaOrigemId) {
      await criarRecorrencia(uid, {
        tipo: "pagar",
        credor: truncarNome(item.credorSugerido),
        observacao: item.observacao ?? "",
        valor: primeiro.valor,
        comp: "",
        grupo: grupoEscolhido,
        aplicacao: item.aplicacaoSugerida,
        inicio: primeiro.vencimento,
      });
    } else if (pendentesDoGrupo.length > 1) {
      const valorTotal = pendentesDoGrupo.reduce((s, i) => s + i.valor, 0);
      await criarLancamento(uid, {
        credor: truncarNome(item.credorSugerido),
        dataCompra: primeiro.dataCompra ?? primeiro.vencimento,
        inicioCobranca: primeiro.vencimento,
        observacao: item.observacao ?? "",
        valorTotal,
        parcelaTotal: pendentesDoGrupo.length,
        comp: "",
        grupo: grupoEscolhido,
        aplicacao: item.aplicacaoSugerida,
      });
    } else {
      await criarLancamento(uid, {
        credor: truncarNome(item.credorSugerido),
        dataCompra: primeiro.dataCompra ?? primeiro.vencimento,
        inicioCobranca: primeiro.vencimento,
        observacao: item.observacao ?? "",
        valorTotal: primeiro.valor,
        parcelaTotal: 1,
        comp: "",
        grupo: grupoEscolhido,
        aplicacao: item.aplicacaoSugerida,
      });
    }

    await Promise.all(pendentesDoGrupo.map((p) => deleteDoc(doc(db, "lancamentosCompartilhados", p.id))));
  }
}
