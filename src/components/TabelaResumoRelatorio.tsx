import { valorEfetivo } from "@/lib/parcelas";
import { formatarMoeda } from "@/lib/date";
import { CLASSE_CARD } from "@/lib/estilos";
import type { ConfigListas, Parcela } from "@/lib/types";

export const SEM_COMP = "(sem reembolso)";

export function agrupar(parcelas: Parcela[], atributo: (p: Parcela) => string | null): [string, number][] {
  const mapa = new Map<string, number>();
  for (const p of parcelas) {
    const chave = atributo(p) ?? SEM_COMP;
    mapa.set(chave, (mapa.get(chave) ?? 0) + valorEfetivo(p));
  }
  return [...mapa.entries()].sort((a, b) => b[1] - a[1]);
}

export function subvalorReembolso(config: ConfigListas, chave: string, valor: number): number | null {
  const modo = config.comp.find((c) => c.nome === chave)?.modo;
  if (modo === "metade") return valor / 2;
  if (modo === "total") return valor;
  return null;
}

export function TabelaResumo({
  titulo,
  linhas,
  subvalor,
}: {
  titulo: string;
  linhas: [string, number][];
  subvalor?: (chave: string, valor: number) => number | null;
}) {
  return (
    <div className={`${CLASSE_CARD} flex h-full flex-col`}>
      <h2 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{titulo}</h2>
      {linhas.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">Sem dados.</p>
      ) : (
        <>
          <ul className="flex flex-col gap-1.5 text-sm">
            {linhas.map(([chave, valor]) => {
              const sub = subvalor?.(chave, valor);
              return (
                <li key={chave} className="flex items-center justify-between gap-2">
                  <span className="truncate text-slate-600 dark:text-slate-400">{chave}</span>
                  <span className="shrink-0 text-right">
                    <span className="tabular-nums text-slate-900 dark:text-slate-100">{formatarMoeda(valor)}</span>
                    {sub != null && (
                      <span className="block text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                        Você recebe: {formatarMoeda(sub)}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          {(() => {
            const totalValor = linhas.reduce((s, [, valor]) => s + valor, 0);
            const totalSub = subvalor
              ? linhas.reduce((s, [chave, valor]) => s + (subvalor(chave, valor) ?? 0), 0)
              : null;
            return (
              <div className="mt-auto flex items-start justify-between gap-2 border-t border-slate-200 pt-2 text-sm dark:border-slate-700">
                <span className="font-medium text-slate-600 dark:text-slate-400">Total</span>
                <span className="shrink-0 text-right">
                  <span className="tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                    {formatarMoeda(totalValor)}
                  </span>
                  <span
                    className={`block text-[11px] tabular-nums text-slate-400 dark:text-slate-500 ${
                      totalSub != null && totalSub > 0 ? "" : "invisible"
                    }`}
                  >
                    Você recebe: {formatarMoeda(totalSub ?? 0)}
                  </span>
                </span>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
