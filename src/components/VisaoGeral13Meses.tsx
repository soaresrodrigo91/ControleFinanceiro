"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { assinarParcelasDoIntervalo, valorEfetivo } from "@/lib/parcelas";
import { mesclarComRecorrencias } from "@/lib/recorrencias";
import { formatarMesAnoAbreviado, formatarMoeda, somarMesesYM } from "@/lib/date";
import type { ConfigListas, Parcela, Recorrencia, StatusGrupo } from "@/lib/types";

const HORIZONTE = 10;

export default function VisaoGeral13Meses({
  uid,
  ym,
  config,
  filtros,
  recorrencias,
  onSelecionarMes,
  statusPorGrupo,
}: {
  uid: string;
  ym: string;
  config: ConfigListas;
  filtros: Record<string, boolean>;
  recorrencias: Recorrencia[];
  onSelecionarMes: (ym: string) => void;
  statusPorGrupo?: Record<string, StatusGrupo>;
}) {
  const meses = useMemo(() => {
    return Array.from({ length: HORIZONTE }, (_, i) => somarMesesYM(ym, i));
  }, [ym]);

  const [parcelas, setParcelas] = useState<Parcela[]>([]);

  useEffect(() => {
    return assinarParcelasDoIntervalo(uid, meses[0], meses[meses.length - 1], setParcelas);
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

  return (
    <div className="mb-3 rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="overflow-x-auto">
        <table className="w-full table-auto text-sm md:table-fixed">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-700">
            <th className="sticky left-0 z-10 w-40 shrink-0 bg-white px-2 py-2 text-left font-medium text-slate-500 md:static md:w-56 dark:bg-slate-800" />

            {meses.map((mes) => (
              <th key={mes} className="min-w-[76px] px-1 py-2 text-center font-medium md:min-w-0">
                <button
                  onClick={() => onSelecionarMes(mes)}
                  className={`w-full rounded-md px-1 py-1 text-[15px] transition-colors ${
                    mes === ym
                      ? "bg-indigo-600 text-white"
                      : "text-indigo-500 hover:bg-slate-100 dark:text-indigo-400 dark:hover:bg-slate-700"
                  }`}
                >
                  {formatarMesAnoAbreviado(mes)}
                </button>
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
                {meses.map((mes) => {
                  const valor = porMes?.get(mes) ?? 0;
                  return (
                    <td
                      key={mes}
                      className={`min-w-[76px] px-1 py-2 text-center tabular-nums text-slate-600 md:min-w-0 dark:text-slate-400 ${
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
        </tbody>
        </table>
      </div>
    </div>
  );
}
