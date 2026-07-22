import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { hojeISO } from "./date";
import type { FormaPagamentoPlano, Periodicidade, Plano } from "./types";

export const CUPOM_FREE_PREMIUM = "CONTROLEFREE";

export const PRECO_MENSAL = 10;
export const PRECO_ANUAL = 100;

export const ROTAS_PREMIUM = ["/dashboard", "/relatorios"];

export function assinarPlano(uid: string, callback: (plano: Plano | null) => void) {
  return onSnapshot(doc(db, "usuarios", uid), (snap) => {
    const dados = snap.data()?.plano;
    callback(dados ? (dados as Plano) : null);
  });
}

export async function definirPlano(
  uid: string,
  dados: {
    tipo: "free" | "premium";
    formaPagamento?: FormaPagamentoPlano | null;
    periodicidade?: Periodicidade | null;
    cupom?: string | null;
  }
) {
  const plano: Plano = {
    tipo: dados.tipo,
    formaPagamento: dados.tipo === "premium" ? dados.formaPagamento ?? null : null,
    periodicidade: dados.tipo === "premium" ? dados.periodicidade ?? null : null,
    cupom: dados.cupom ?? null,
    ativoDesde: hojeISO(),
  };
  await updateDoc(doc(db, "usuarios", uid), { plano });
}

export async function atualizarFormaPagamentoPlano(
  uid: string,
  formaPagamento: FormaPagamentoPlano,
  periodicidade: Periodicidade
) {
  await updateDoc(doc(db, "usuarios", uid), {
    "plano.formaPagamento": formaPagamento,
    "plano.periodicidade": periodicidade,
  });
}
