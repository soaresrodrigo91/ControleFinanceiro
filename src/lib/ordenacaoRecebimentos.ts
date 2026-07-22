import type { Recebimento } from "./types";

export type CampoOrdenacaoRecebimentos = "origem" | "data" | "valor";
export type OrdenacaoRecebimentos = { campo: CampoOrdenacaoRecebimentos; direcao: "asc" | "desc" } | null;

function compararPadrao(a: Recebimento, b: Recebimento): number {
  if (a.recebimento !== b.recebimento) return a.recebimento.localeCompare(b.recebimento);
  return a.origem.localeCompare(b.origem, "pt-BR");
}

export function ordenarRecebimentos(lista: Recebimento[], ordenacao: OrdenacaoRecebimentos): Recebimento[] {
  const copia = [...lista];
  if (!ordenacao) {
    copia.sort(compararPadrao);
    return copia;
  }
  const { campo, direcao } = ordenacao;
  copia.sort((a, b) => {
    let cmp = 0;
    if (campo === "origem") cmp = a.origem.localeCompare(b.origem, "pt-BR");
    else if (campo === "data") cmp = a.recebimento.localeCompare(b.recebimento);
    else cmp = a.valor - b.valor;
    return direcao === "asc" ? cmp : -cmp;
  });
  return copia;
}

export function proximaOrdenacaoRecebimentos(
  atual: OrdenacaoRecebimentos,
  campo: CampoOrdenacaoRecebimentos
): OrdenacaoRecebimentos {
  if (!atual || atual.campo !== campo) return { campo, direcao: "asc" };
  return { campo, direcao: atual.direcao === "asc" ? "desc" : "asc" };
}
