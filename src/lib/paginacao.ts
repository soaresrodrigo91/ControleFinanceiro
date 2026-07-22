export function paginar<T>(lista: T[], itensPorPagina: number, paginaAtual: number): T[] {
  if (!itensPorPagina || itensPorPagina <= 0) return lista;
  const inicio = (paginaAtual - 1) * itensPorPagina;
  return lista.slice(inicio, inicio + itensPorPagina);
}

export function totalDePaginas(totalItens: number, itensPorPagina: number): number {
  if (!itensPorPagina || itensPorPagina <= 0) return 1;
  return Math.max(1, Math.ceil(totalItens / itensPorPagina));
}
