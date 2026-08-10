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

// Escopo do envio individual (botão "Reenviar" na tela de Lançamentos). Quando omitido
// (chamada em massa a partir da tela de Enviados), o comportamento é o original: janela de
// 10 meses à frente para conta fixa, todas as parcelas ainda não compartilhadas para avulso.
export type EscopoEnvio = "mes" | "futuros" | "tudo";

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
  credorReal: string;
};

async function itensParaCompartilharDeParcela(
  uid: string,
  p: Parcela,
  recorrencias: Recorrencia[],
  jaCompartilhados: Set<string>,
  escopo?: EscopoEnvio
): Promise<ItemParaCompartilhar[]> {
  if (p.recorrenciaId) {
    const rec = recorrencias.find((r) => r.id === p.recorrenciaId);
    if (!rec) return [];
    const ymAtual = p.vencimento.slice(0, 7);
    const resultado: ItemParaCompartilhar[] = [];

    const processarMes = (ym: string) => {
      if (!ativaNoMes(rec, ym)) return;
      const chave = `${rec.id}_${ym}`;
      if (jaCompartilhados.has(chave)) return;
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
        credorReal: rec.credor,
      });
    };

    if (escopo === "mes") {
      processarMes(ymAtual);
      return resultado;
    }

    if (escopo === "tudo") {
      for (let ym = rec.inicio.slice(0, 7); ym < ymAtual; ym = somarMesesYM(ym, 1)) {
        processarMes(ym);
      }
    }

    for (let i = 0; i < JANELA_MESES_RECORRENCIA; i++) {
      processarMes(somarMesesYM(ymAtual, i));
    }
    return resultado;
  }

  const snap = await getDocs(
    query(collection(db, "usuarios", uid, "parcelas"), where("lancamentoId", "==", p.lancamentoId))
  );
  let candidatas = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Parcela)
    .filter((parc) => !jaCompartilhados.has(parc.id));
  if (escopo === "mes") candidatas = candidatas.filter((parc) => parc.id === p.id);
  else if (escopo === "futuros") candidatas = candidatas.filter((parc) => parc.vencimento >= p.vencimento);

  return candidatas.map((parc) => ({
    chave: parc.id,
    grupoOrigemId: parc.lancamentoId,
    parcela: parc.parcelaTotal > 1 ? `${parc.parcelaNum}/${parc.parcelaTotal}` : "—",
    vencimento: parc.vencimento,
    valorParcela: parc.valorParcela,
    observacao: parc.observacao,
    aplicacao: parc.aplicacao,
    dataCompra: parc.dataCompra,
    recorrenciaOrigemId: null,
    credorReal: parc.credor,
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

// Mesma chave usada em itensParaCompartilharDeParcela para contas fixas: identifica a
// ocorrência de uma recorrência num mês específico. A parcela "virtual" exibida na tela tem
// id no formato "virtual:<recId>:<ym>", diferente do lancamentoOrigemId gravado ao
// compartilhar ("<recId>_<ym>") — por isso não dá pra comparar p.id direto.
export function chaveOrigemParcela(p: Parcela): string {
  return p.recorrenciaId ? `${p.recorrenciaId}_${p.vencimento.slice(0, 7)}` : p.id;
}

export function calcularValorReembolso(
  valorBase: number,
  compNome: string | null,
  config: ConfigListas
): number {
  if (!compNome) return valorBase;
  const itemComp = config.comp.find((c) => c.nome === compNome);
  if (!itemComp || itemComp.modo === "nenhum") return valorBase;
  return itemComp.modo === "metade" ? valorBase / 2 : valorBase;
}

// Inverso de calcularValorReembolso: a partir do valor já com o percentual aplicado (o que
// fica salvo em LancamentoCompartilhado.valor), recupera o valor cheio do lançamento
// original — usado só para exibição, já que o documento não guarda o valor bruto.
export function valorOrigemDoReembolso(
  valorReembolso: number,
  compNome: string | null,
  config: ConfigListas
): number {
  if (!compNome) return valorReembolso;
  const itemComp = config.comp.find((c) => c.nome === compNome);
  if (!itemComp || itemComp.modo === "nenhum") return valorReembolso;
  return itemComp.modo === "metade" ? valorReembolso * 2 : valorReembolso;
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

// Chaves (mesmo formato de chaveOrigemParcela) de pendências de envio que o usuário
// removeu manualmente da lista de Enviados. Guardado por usuário, sem depender de vínculo
// com ninguém — diferente de excluir um já enviado, aqui nunca existiu um envio de verdade.
export function assinarEnviosExcluidos(uid: string, callback: (chaves: Set<string>) => void) {
  return onSnapshot(collection(db, "usuarios", uid, "enviosExcluidos"), (snap) => {
    callback(new Set(snap.docs.map((d) => d.id)));
  });
}

// Remove uma pendência (ou várias, conforme o alcance) da lista de Enviados sem alterar o
// lançamento original: só marca a(s) chave(s) como "não mostrar mais aqui", em vez de apagar
// o reembolso configurado na parcela/recorrência.
export async function excluirPendenciaDeEnvio(
  uid: string,
  p: Parcela,
  recorrencias: Recorrencia[],
  enviados: LancamentoCompartilhado[],
  escopo: EscopoEnvio
) {
  const jaCompartilhados = new Set(enviados.map((e) => e.lancamentoOrigemId));
  const itens = await itensParaCompartilharDeParcela(uid, p, recorrencias, jaCompartilhados, escopo);
  await Promise.all(
    itens.map((item) =>
      setDoc(doc(db, "usuarios", uid, "enviosExcluidos", item.chave), { criadoEm: serverTimestamp() })
    )
  );
}

// Inverso de excluirPendenciaDeEnvio: remove o(s) tombstone(s) do alcance escolhido, fazendo
// o lançamento voltar a aparecer como pendência "Não enviado" em Lançamentos Enviados — não
// envia nada de verdade, é só o botão "Reenviar" desfazendo uma exclusão anterior.
export async function restaurarPendenciaDeEnvio(
  uid: string,
  p: Parcela,
  recorrencias: Recorrencia[],
  enviados: LancamentoCompartilhado[],
  escopo: EscopoEnvio
) {
  const jaCompartilhados = new Set(enviados.map((e) => e.lancamentoOrigemId));
  const itens = await itensParaCompartilharDeParcela(uid, p, recorrencias, jaCompartilhados, escopo);
  await Promise.all(itens.map((item) => deleteDoc(doc(db, "usuarios", uid, "enviosExcluidos", item.chave))));
}

export async function compartilharSelecionados(
  uid: string,
  nomeRemetente: string,
  emailRemetente: string,
  itens: Parcela[],
  config: ConfigListas,
  vinculos: VinculoCompartilhamento[],
  recorrencias: Recorrencia[],
  enviados: LancamentoCompartilhado[],
  escopo?: EscopoEnvio
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

    const expandidos = await itensParaCompartilharDeParcela(uid, p, recorrencias, jaCompartilhados, escopo);
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
      const valor = calcularValorReembolso(item.valorParcela, p.comp, config);
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
          credorReal: item.credorReal,
          observacao: item.observacao,
          aplicacaoSugerida: item.aplicacao,
          valor,
          valorReal: item.valorParcela,
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

  const novoValorReembolso = calcularValorReembolso(novoValorParcela, compNome, config);
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

// Complementa notificarAtualizacaoRecorrencia para o escopo "apenas este mês": aquela função
// só é chamada nos escopos "futuros"/"tudo" (ver ParcelaModals.tsx); sem isso, editar o valor
// de só um mês de uma conta fixa com reembolso não atualizava o item já compartilhado.
export async function sincronizarValorCompartilhadoRecorrenciaMes(
  uid: string,
  recorrenciaId: string,
  compNome: string,
  novoValorParcela: number,
  vencimento: string,
  config: ConfigListas
) {
  const itemComp = config.comp.find((c) => c.nome === compNome);
  if (!itemComp || itemComp.modo === "nenhum") return;
  const novoValorReembolso = calcularValorReembolso(novoValorParcela, compNome, config);

  const snap = await getDocs(
    query(
      collection(db, "lancamentosCompartilhados"),
      where("deUid", "==", uid),
      where("recorrenciaOrigemId", "==", recorrenciaId),
      where("vencimento", "==", vencimento),
      where("status", "==", "pendente")
    )
  );
  await Promise.all(snap.docs.map((d) => updateDoc(d.ref, { valor: novoValorReembolso })));
}

export type EscopoExclusaoRecebido = "mes" | "futuros" | "tudo";

// Marca como "excluido" em vez de apagar: se apagássemos o documento, quem enviou (deUid)
// deixaria de ter qualquer registro do envio e o item voltaria a aparecer como pendência de
// envio para ela — mesmo já tendo sido genuinamente enviado.
export async function excluirRecebidoComEscopo(item: LancamentoCompartilhado, escopo: EscopoExclusaoRecebido) {
  if (escopo === "mes") {
    await updateDoc(doc(db, "lancamentosCompartilhados", item.id), { status: "excluido" });
    return;
  }

  const snap = await getDocs(
    query(
      collection(db, "lancamentosCompartilhados"),
      where("paraUid", "==", item.paraUid),
      where("grupoOrigemId", "==", item.grupoOrigemId),
      where("status", "==", "pendente")
    )
  );
  const alvos = snap.docs.filter((d) => {
    if (escopo === "tudo") return true;
    const dados = d.data() as LancamentoCompartilhado;
    return dados.vencimento >= item.vencimento;
  });
  await Promise.all(alvos.map((d) => updateDoc(d.ref, { status: "excluido" })));
}

// Além de apagar o(s) documento(s) já enviados, marca a(s) chave(s) como excluída em
// enviosExcluidos — sem isso, ao sumir o documento a ocorrência voltaria a aparecer sozinha
// como pendência de envio (já que nada mais registraria que ela foi enviada). Marca TODAS as
// chaves do alcance escolhido, não só as que já tinham sido enviadas — senão, ao excluir
// "este mês e os futuros"/"todos" de uma conta fixa, os meses futuros que nunca chegaram a
// ser enviados continuariam aparecendo como pendência isoladamente. Quem quiser voltar a
// enviar usa o botão "Reenviar" na tela de Lançamentos, que desfaz essa marcação.
export async function excluirEnviadoComEscopo(
  item: LancamentoCompartilhado,
  escopo: EscopoExclusaoRecebido,
  recorrencias: Recorrencia[]
) {
  const parcelaOrigem = {
    id: item.lancamentoOrigemId,
    lancamentoId: item.grupoOrigemId,
    recorrenciaId: item.recorrenciaOrigemId ?? null,
    vencimento: item.vencimento,
  } as Parcela;

  const itens = await itensParaCompartilharDeParcela(item.deUid, parcelaOrigem, recorrencias, new Set(), escopo);
  const chaves = new Set(itens.map((i) => i.chave));
  // Garante a própria chave mesmo que a busca acima não encontre nada — acontece quando o
  // lançamento/recorrência de origem já não existe mais em Contas a Pagar (foi excluído à
  // parte); sem isso, este item específico nunca seria removido.
  chaves.add(item.lancamentoOrigemId);

  // Sem filtro de status aqui: um item "Enviado" nesta tela pode já estar "lancado" ou
  // "excluido" do lado de quem recebeu (ver excluirRecebidoComEscopo/lancarSelecionados) —
  // continua sendo um envio seu que pode ser excluído, então não dá pra exigir "pendente".
  const snap = await getDocs(
    query(
      collection(db, "lancamentosCompartilhados"),
      where("deUid", "==", item.deUid),
      where("grupoOrigemId", "==", item.grupoOrigemId)
    )
  );
  const alvosParaApagar = snap.docs.filter((d) =>
    chaves.has((d.data() as LancamentoCompartilhado).lancamentoOrigemId)
  );

  await Promise.all([
    ...alvosParaApagar.map((d) => deleteDoc(d.ref)),
    ...[...chaves].map((chave) =>
      setDoc(doc(db, "usuarios", item.deUid, "enviosExcluidos", chave), { criadoEm: serverTimestamp() })
    ),
  ]);
}

export function truncarNome(nome: string): string {
  const limpo = nome.trim();
  if (limpo.length <= 20) return limpo;
  const partes = limpo.split(/\s+/);
  if (partes.length === 1) return partes[0].slice(0, 20);
  return `${partes[0]} ${partes[partes.length - 1][0]}.`;
}

export async function lancarSelecionados(
  uid: string,
  itens: LancamentoCompartilhado[],
  grupoEscolhido: string,
  aplicacaoPorGrupo: Map<string, string>
) {
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

    // A aplicação é escolhida pelo usuário por grupo (tela de confirmação), não mais
    // decidida automaticamente aqui — permite usar a sugestão de quem enviou, uma aplicação
    // já existente diferente, ou uma recém-criada a partir da sugestão.
    const aplicacao = aplicacaoPorGrupo.get(item.grupoOrigemId) ?? item.aplicacaoSugerida;
    const primeiro = pendentesDoGrupo[0];
    // Fallback para itens pendentes criados antes de credorReal/valorReal existirem no
    // documento (compartilhados e ainda não lançados no momento desta atualização).
    const origemCompartilhado = {
      deNome: primeiro.deNome,
      credorReal: primeiro.credorReal ?? primeiro.credorSugerido,
      valorReal: primeiro.valorReal ?? primeiro.valor,
    };

    if (item.recorrenciaOrigemId) {
      await criarRecorrencia(uid, {
        tipo: "pagar",
        credor: truncarNome(item.credorSugerido),
        observacao: item.observacao ?? "",
        valor: primeiro.valor,
        comp: "",
        grupo: grupoEscolhido,
        aplicacao,
        inicio: primeiro.vencimento,
        origemCompartilhado,
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
        aplicacao,
        origemCompartilhado,
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
        aplicacao,
        origemCompartilhado,
      });
    }

    // Marca como "lancado" em vez de apagar, pelo mesmo motivo de excluirRecebidoComEscopo:
    // apagar faria o item voltar a aparecer como pendência de envio para quem enviou.
    await Promise.all(
      pendentesDoGrupo.map((p) => updateDoc(doc(db, "lancamentosCompartilhados", p.id), { status: "lancado" }))
    );
  }
}
