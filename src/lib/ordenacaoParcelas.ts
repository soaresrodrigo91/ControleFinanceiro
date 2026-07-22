import type { Parcela } from "./types";

export type CampoOrdenacaoParcelas = "credor" | "dataCompra" | "valor";
export type OrdenacaoParcelas = { campo: CampoOrdenacaoParcelas; direcao: "asc" | "desc" } | null;

function compararPadrao(a: Parcela, b: Parcela): number {
  const dataA = a.dataCompra ?? "9999-99-99";
  const dataB = b.dataCompra ?? "9999-99-99";
  if (dataA !== dataB) return dataA.localeCompare(dataB);
  return a.credor.localeCompare(b.credor, "pt-BR");
}

export function ordenarParcelas(lista: Parcela[], ordenacao: OrdenacaoParcelas): Parcela[] {
  const copia = [...lista];
  if (!ordenacao) {
    copia.sort(compararPadrao);
    return copia;
  }
  const { campo, direcao } = ordenacao;
  copia.sort((a, b) => {
    let cmp = 0;
    if (campo === "credor") cmp = a.credor.localeCompare(b.credor, "pt-BR");
    else if (campo === "dataCompra") cmp = (a.dataCompra ?? "9999-99-99").localeCompare(b.dataCompra ?? "9999-99-99");
    else cmp = a.valorParcela - b.valorParcela;
    return direcao === "asc" ? cmp : -cmp;
  });
  return copia;
}

export function proximaOrdenacao(atual: OrdenacaoParcelas, campo: CampoOrdenacaoParcelas): OrdenacaoParcelas {
  if (!atual || atual.campo !== campo) return { campo, direcao: "asc" };
  return { campo, direcao: atual.direcao === "asc" ? "desc" : "asc" };
}
