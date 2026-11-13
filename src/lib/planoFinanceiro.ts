import { doc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { valorEfetivo } from "./parcelas";
import { ativaNoMes, mesclarComRecorrencias, valorNoMes } from "./recorrencias";
import type { ConfigListas, ItemComp, ModoPlanoFinanceiro, Parcela, PlanoFinanceiro, Recebimento, Recorrencia } from "./types";

// Plano Financeiro: o usuário divide o valor a receber de cada mês entre as Aplicações, em
// percentual ou em valor fixo. Aplicação sem entrada na distribuição (ex.: recém-criada)
// vale 0. A soma nunca pode passar de 100% / do valor a receber (validado na tela antes de
// salvar).

export const PLANO_FINANCEIRO_PADRAO: PlanoFinanceiro = { modo: "valor", distribuicao: {} };

export function planoFinanceiroDaConfig(config: ConfigListas): PlanoFinanceiro {
  return config.planoFinanceiro ?? PLANO_FINANCEIRO_PADRAO;
}

export async function salvarPlanoFinanceiro(uid: string, plano: PlanoFinanceiro) {
  await updateDoc(doc(db, "usuarios", uid, "config", "listas"), { planoFinanceiro: plano });
}

// Arredonda para centavos/centésimos, evitando que somas de ponto flutuante (ex.: 33,33 +
// 33,33 + 33,34) acusem estouro por uma diferença invisível.
export function arredondar2(valor: number): number {
  return Math.round(valor * 100) / 100;
}

// Valor a receber previsto em cada mês — mesma regra da linha "Provisão Líquido" da Início:
// recebimentos lançados + recorrências a receber ainda não materializadas + reembolsos
// previstos de recorrências a pagar com reembolso configurado.
export function calcularAReceberPorMes(
  meses: string[],
  recebimentos: Recebimento[],
  recorrenciasReceber: Recorrencia[],
  recorrenciasPagar: Recorrencia[],
  comp: ItemComp[]
): Map<string, number> {
  const modoPorNomeComp = Object.fromEntries(comp.map((c) => [c.nome, c.modo]));
  const mapa = new Map<string, number>();
  for (const mes of meses) {
    const reaisDoMes = recebimentos.filter((r) => r.recebimento.slice(0, 7) === mes);
    let total = reaisDoMes.reduce((s, r) => s + r.valor, 0);

    // Recorrências "receber" (contas fixas a receber) ainda não materializadas neste mês.
    const idsJaMaterializados = new Set(reaisDoMes.filter((r) => r.recorrenciaId).map((r) => r.recorrenciaId));
    for (const rec of recorrenciasReceber) {
      if (ativaNoMes(rec, mes) && !idsJaMaterializados.has(rec.id)) {
        total += valorNoMes(rec, mes);
      }
    }

    // Reembolsos de recorrências "pagar" com reembolso configurado, ainda não materializados
    // neste mês (o materializado só acontece quando o usuário abre aquele mês específico —
    // aqui calculamos a projeção sem depender disso).
    const lancamentosComReembolsoJaMaterializados = new Set(
      reaisDoMes.filter((r) => r.origemComp).map((r) => r.lancamentoId)
    );
    for (const rec of recorrenciasPagar) {
      if (!rec.comp || !ativaNoMes(rec, mes)) continue;
      if (lancamentosComReembolsoJaMaterializados.has(rec.id)) continue;
      const modo = modoPorNomeComp[rec.comp];
      if (!modo || modo === "nenhum") continue;
      const valor = valorNoMes(rec, mes);
      total += modo === "metade" ? valor / 2 : valor;
    }

    mapa.set(mes, total);
  }
  return mapa;
}

// Gasto por Aplicação em cada mês (parcelas reais + recorrências a pagar projetadas).
export function calcularGastosPorAplicacaoEMes(
  meses: string[],
  parcelas: Parcela[],
  recorrenciasPagar: Recorrencia[]
): Map<string, Map<string, number>> {
  const mapa = new Map<string, Map<string, number>>();
  for (const mes of meses) {
    const parcelasReaisDoMes = parcelas.filter((p) => p.vencimento.slice(0, 7) === mes);
    for (const p of mesclarComRecorrencias(parcelasReaisDoMes, recorrenciasPagar, mes)) {
      const porMes = mapa.get(p.aplicacao) ?? new Map<string, number>();
      porMes.set(mes, (porMes.get(mes) ?? 0) + valorEfetivo(p));
      mapa.set(p.aplicacao, porMes);
    }
  }
  return mapa;
}

// Limite de gasto da Aplicação num mês: percentual aplicado sobre o valor a receber do mês,
// ou o valor fixo configurado.
export function limiteNoMes(modo: ModoPlanoFinanceiro, configurado: number, aReceberNoMes: number): number {
  return modo === "percentual" ? arredondar2((aReceberNoMes * configurado) / 100) : configurado;
}
