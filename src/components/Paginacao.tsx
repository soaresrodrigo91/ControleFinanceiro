export default function Paginacao({
  paginaAtual,
  totalPaginas,
  totalItens,
  itensPorPagina,
  onMudarPagina,
}: {
  paginaAtual: number;
  totalPaginas: number;
  totalItens: number;
  itensPorPagina: number;
  onMudarPagina: (pagina: number) => void;
}) {
  if (totalItens === 0) return null;

  const inicio = itensPorPagina > 0 ? (paginaAtual - 1) * itensPorPagina + 1 : 1;
  const fim = itensPorPagina > 0 ? Math.min(paginaAtual * itensPorPagina, totalItens) : totalItens;

  const paginas: (number | "...")[] = [];
  for (let p = 1; p <= totalPaginas; p++) {
    if (
      p === 1 ||
      p === totalPaginas ||
      (p >= paginaAtual - 1 && p <= paginaAtual + 1)
    ) {
      paginas.push(p);
    } else if (paginas[paginas.length - 1] !== "...") {
      paginas.push("...");
    }
  }

  return (
    <div className="sticky bottom-0 z-10 mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-background px-1 py-2 print:static print:border-none">
      <span className="text-xs text-slate-500 dark:text-slate-400">
        {totalPaginas > 1
          ? `Mostrando ${inicio}–${fim} de ${totalItens} ${totalItens === 1 ? "item" : "itens"}`
          : `${totalItens} ${totalItens === 1 ? "item" : "itens"}`}
      </span>
      {totalPaginas > 1 && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onMudarPagina(paginaAtual - 1)}
            disabled={paginaAtual === 1}
            aria-label="Página anterior"
            className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            ←
          </button>
          {paginas.map((p, i) =>
            p === "..." ? (
              <span key={`ellipsis-${i}`} className="px-1.5 text-sm text-slate-400 dark:text-slate-500">
                …
              </span>
            ) : (
              <button
                key={p}
                onClick={() => onMudarPagina(p)}
                aria-current={p === paginaAtual ? "page" : undefined}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  p === paginaAtual
                    ? "bg-indigo-600 text-white"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                {p}
              </button>
            )
          )}
          <button
            onClick={() => onMudarPagina(paginaAtual + 1)}
            disabled={paginaAtual === totalPaginas}
            aria-label="Próxima página"
            className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
