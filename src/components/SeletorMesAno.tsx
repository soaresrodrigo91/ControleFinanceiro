"use client";

import { useEffect, useRef, useState } from "react";
import { formatarMesAno, somarMesesYM } from "@/lib/date";

const MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default function SeletorMesAno({ ym, onMudar }: { ym: string; onMudar: (novoYm: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const [anoVisivel, setAnoVisivel] = useState(() => Number(ym.slice(0, 4)));
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    function aoClicarFora(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, [aberto]);

  const anoAtual = Number(ym.slice(0, 4));
  const mesAtual = Number(ym.slice(5, 7));

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onMudar(somarMesesYM(ym, -1))}
        className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
        aria-label="Mês anterior"
      >
        ←
      </button>
      <div className="relative" ref={containerRef}>
        <button
          type="button"
          onClick={() => {
            setAnoVisivel(Number(ym.slice(0, 4)));
            setAberto((a) => !a);
          }}
          className="rounded-lg px-2 py-1.5 text-lg font-semibold whitespace-nowrap text-slate-900 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          {formatarMesAno(ym)}
        </button>
        {aberto && (
          <div className="absolute top-full left-1/2 z-20 mt-1 w-56 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-800">
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setAnoVisivel((a) => a - 1)}
                className="rounded-md p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                aria-label="Ano anterior"
              >
                ‹
              </button>
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{anoVisivel}</span>
              <button
                type="button"
                onClick={() => setAnoVisivel((a) => a + 1)}
                className="rounded-md p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                aria-label="Próximo ano"
              >
                ›
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {MESES_ABREV.map((nome, indice) => {
                const mesNum = indice + 1;
                const selecionado = anoVisivel === anoAtual && mesNum === mesAtual;
                return (
                  <button
                    key={nome}
                    type="button"
                    onClick={() => {
                      onMudar(`${anoVisivel}-${String(mesNum).padStart(2, "0")}`);
                      setAberto(false);
                    }}
                    className={`rounded-md px-2 py-1.5 text-sm ${
                      selecionado
                        ? "bg-indigo-600 text-white"
                        : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                    }`}
                  >
                    {nome}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <button
        onClick={() => onMudar(somarMesesYM(ym, 1))}
        className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
        aria-label="Próximo mês"
      >
        →
      </button>
    </div>
  );
}
