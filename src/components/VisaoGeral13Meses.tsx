"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { assinarParcelasDoIntervalo, valorEfetivo } from "@/lib/parcelas";
import { mesclarComRecorrencias } from "@/lib/recorrencias";
import { diferencaEmMeses, formatarMesAnoAbreviado, formatarMoeda, mesAtualYM, somarMesesYM } from "@/lib/date";
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
  onTogglePago,
}: {
  uid: string;
  ym: string;
  config: ConfigListas;
  filtros: Record<string, boolean>;
  recorrencias: Recorrencia[];
  onSelecionarMes: (ym: string) => void;
  statusPorGrupo?: Record<string, StatusGrupo>;
  onTogglePago?: (grupo: string, pago: boolean) => void;
}) {
  const meses = useMemo(() => {
    const anchor = mesAtualYM();
    const blocoIndice = Math.floor(diferencaEmMeses(anchor, ym) / HORIZONTE);
    const inicioBloco = somarMesesYM(anchor, blocoIndice * HORIZONTE);
    return Array.from({ length: HORIZONTE }, (_, i) => somarMesesYM(inicioBloco, i));
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
      <table className="w-full table-fixed text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-700">
            <th className="w-56 px-2 py-2 text-left font-medium text-slate-500" />

            {meses.map((mes) => (
              <th key={mes} className="px-1 py-2 text-center font-medium">
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
                <td className="px-2 py-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    {onTogglePago && (
                      <input
                        type="checkbox"
                        checked={status === "pago"}
                        ref={(el) => {
                          if (el) el.indeterminate = status === "parcial";
                        }}
                        onChange={(e) => onTogglePago(grupo, e.target.checked)}
                        className="h-4 w-4 shrink-0 accent-indigo-600"
                        aria-label={`Marcar ${grupo} como pago`}
                      />
                    )}
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
                      className={`px-1 py-2 text-center tabular-nums text-slate-600 dark:text-slate-400 ${
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
  );
}
