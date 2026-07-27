"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { assinarParcelasDoIntervalo, valorEfetivo } from "@/lib/parcelas";
import { assinarRecebimentosDoIntervalo } from "@/lib/recebimentos";
import { mesclarComRecorrencias } from "@/lib/recorrencias";
import { formatarMesAnoAbreviado, formatarMoeda, somarMesesYM } from "@/lib/date";
import type { ConfigListas, Parcela, Recebimento, Recorrencia, StatusGrupo } from "@/lib/types";

const HORIZONTE = 10;

export default function VisaoGeral13Meses({
  uid,
  ym,
  config,
  filtros,
  recorrencias,
  onSelecionarMes,
  statusPorGrupo,
  totaisVisiveis,
}: {
  uid: string;
  ym: string;
  config: ConfigListas;
  filtros: Record<string, boolean>;
  recorrencias: Recorrencia[];
  onSelecionarMes: (ym: string) => void;
  statusPorGrupo?: Record<string, StatusGrupo>;
  totaisVisiveis: boolean;
}) {
  const meses = useMemo(() => {
    return Array.from({ length: HORIZONTE }, (_, i) => somarMesesYM(ym, i));
  }, [ym]);

  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [recebimentos, setRecebimentos] = useState<Recebimento[]>([]);

  useEffect(() => {
    return assinarParcelasDoIntervalo(uid, meses[0], meses[meses.length - 1], setParcelas);
  }, [uid, meses]);

  useEffect(() => {
    return assinarRecebimentosDoIntervalo(uid, meses[0], meses[meses.length - 1], setRecebimentos);
  }, [uid, meses]);

  const grupoVisivel = (grupo: string) => filtros[grupo] !== false;
  const grupos = config.grupos.filter(grupoVisivel);

  const totaisPorGrupoEMes = useMemo(() => {
    const mapa = new Map<string, Map<string, number>>();
    for (const mes of meses) {
      const parcelasReaisDoMes = parcelas.filter((p) => p.vencimento.slice(0, 7) === mes);
      const mescladas = mesclarComRecorrencias(parcelasReaisDoMes, recorrencias, mes);
      for (const p of mescladas) {
        const porMes = mapa.get(p.grupo) ?? new Map<string, number>();
        porMes.set(mes, (porMes.get(mes) ?? 0) + valorEfetivo(p));
        mapa.set(p.grupo, porMes);
      }
    }
    return mapa;
  }, [parcelas, recorrencias, meses]);

  const recebidoPorMes = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const r of recebimentos) {
      if (!r.recebido) continue;
      const mes = r.recebimento.slice(0, 7);
      mapa.set(mes, (mapa.get(mes) ?? 0) + r.valor);
    }
    return mapa;
  }, [recebimentos]);

  const subtotalGastosPorMes = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const mes of meses) {
      const total = grupos.reduce((s, g) => s + (totaisPorGrupoEMes.get(g)?.get(mes) ?? 0), 0);
      mapa.set(mes, total);
    }
    return mapa;
  }, [grupos, totaisPorGrupoEMes, meses]);

  const liquidoPorMes = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const mes of meses) {
      mapa.set(mes, (recebidoPorMes.get(mes) ?? 0) - (subtotalGastosPorMes.get(mes) ?? 0));
    }
    return mapa;
  }, [meses, recebidoPorMes, subtotalGastosPorMes]);

  const toqueInicioX = useRef<number | null>(null);

  function handleTouchStart(e: React.TouchEvent) {
    toqueInicioX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (toqueInicioX.current === null) return;
    if (window.innerWidth >= 768) {
      toqueInicioX.current = null;
      return;
    }
    const deltaX = e.changedTouches[0].clientX - toqueInicioX.current;
    toqueInicioX.current = null;
    const LIMIAR = 40;
    if (deltaX <= -LIMIAR) {
      onSelecionarMes(somarMesesYM(ym, 1));
    } else if (deltaX >= LIMIAR) {
      onSelecionarMes(somarMesesYM(ym, -1));
    }
  }

  return (
    <div className="mb-3 rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="overflow-x-auto" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <table className="w-full table-auto text-sm md:table-fixed">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-700">
            <th className="sticky left-0 z-10 w-40 shrink-0 bg-white px-2 py-2 text-left font-medium text-slate-500 md:static md:w-56 dark:bg-slate-800" />

            {meses.map((mes, indice) => (
              <th
                key={mes}
                className={`min-w-[76px] px-1 py-2 text-center font-medium md:min-w-0 ${
                  indice === 0 ? "" : "hidden md:table-cell"
                }`}
              >
                <span
                  className={`block w-full rounded-md px-1 py-1 text-[15px] ${
                    mes === ym
                      ? "bg-indigo-600 text-white"
                      : "text-indigo-500 dark:text-indigo-400"
                  }`}
                >
                  {formatarMesAnoAbreviado(mes)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grupos.map((grupo) => {
            const porMes = totaisPorGrupoEMes.get(grupo);
            const status = statusPorGrupo?.[grupo];
            return (
              <tr key={grupo} className="border-b border-slate-100 last:border-0 dark:border-slate-700">
                <td className="sticky left-0 z-10 w-40 bg-white px-2 py-2 md:static md:w-auto dark:bg-slate-800">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <Link
                      href={`/lancar?aba=buscar&grupo=${encodeURIComponent(grupo)}`}
                      title={grupo}
                      className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900 hover:underline dark:text-slate-100"
                    >
                      {grupo}
                    </Link>
                    {status === "pago" && (
                      <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                        Pago
                      </span>
                    )}
                    {status === "parcial" && (
                      <span className="shrink-0 rounded-full bg-yellow-100 px-1.5 py-0.5 text-[10px] font-medium text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400">
                        Parcial
                      </span>
                    )}
                    {status === "pendente" && (
                      <span className="shrink-0 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-950 dark:text-red-400">
                        Pendente
                      </span>
                    )}
                  </div>
                </td>
                {meses.map((mes, indice) => {
                  const valor = porMes?.get(mes) ?? 0;
                  return (
                    <td
                      key={mes}
                      className={`min-w-[76px] px-1 py-2 text-center tabular-nums text-slate-600 md:min-w-0 dark:text-slate-400 ${
                        indice === 0 ? "" : "hidden md:table-cell"
                      } ${
                        mes === ym ? "bg-indigo-50/60 font-medium text-slate-900 dark:bg-indigo-950/40 dark:text-slate-100" : ""
                      }`}
                    >
                      {valor > 0 ? formatarMoeda(valor) : "—"}
                    </td>
                  );
                })}
              </tr>
            );
          })}

          <tr className="border-t border-slate-200 dark:border-slate-700">
            <td className="sticky left-0 z-10 w-40 bg-white px-2 py-1.5 md:static md:w-auto dark:bg-slate-800">
              <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">Subtotal</span>
            </td>
            {meses.map((mes, indice) => {
              const valor = subtotalGastosPorMes.get(mes) ?? 0;
              return (
                <td
                  key={mes}
                  className={`min-w-[76px] px-1 py-1.5 text-center text-[11px] tabular-nums text-slate-400 md:min-w-0 dark:text-slate-500 ${
                    indice === 0 ? "" : "hidden md:table-cell"
                  } ${mes === ym ? "bg-indigo-50/60 dark:bg-indigo-950/40" : ""}`}
                >
                  {totaisVisiveis ? (valor > 0 ? formatarMoeda(valor) : "—") : "••••••"}
                </td>
              );
            })}
          </tr>
          <tr>
            <td className="sticky left-0 z-10 w-40 bg-white px-2 py-1.5 pb-2 md:static md:w-auto dark:bg-slate-800">
              <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">Líquido mensal</span>
            </td>
            {meses.map((mes, indice) => {
              const valor = liquidoPorMes.get(mes) ?? 0;
              return (
                <td
                  key={mes}
                  className={`min-w-[76px] px-1 py-1.5 pb-2 text-center text-[11px] tabular-nums md:min-w-0 ${
                    indice === 0 ? "" : "hidden md:table-cell"
                  } ${mes === ym ? "bg-indigo-50/60 dark:bg-indigo-950/40" : ""} ${
                    totaisVisiveis
                      ? valor < 0
                        ? "text-red-500 dark:text-red-400"
                        : "text-emerald-600 dark:text-emerald-400"
                      : "text-slate-400 dark:text-slate-500"
                  }`}
                >
                  {totaisVisiveis ? formatarMoeda(valor) : "••••••"}
                </td>
              );
            })}
          </tr>
        </tbody>
        </table>
      </div>
      <p className="border-t border-slate-100 px-2 py-1.5 text-center text-[11px] text-slate-400 md:hidden dark:border-slate-700 dark:text-slate-500">
        Arraste para o lado para ver o mês anterior/seguinte
      </p>
    </div>
  );
}
