"use client";

import { useEffect, useRef, useState } from "react";

export default function FiltroMultiSelect({
  rotulo,
  opcoes,
  filtro,
  onAlternar,
  modoInclusao,
  ocultarAcoesEmMassa,
}: {
  rotulo: string;
  opcoes: string[];
  filtro: Record<string, boolean>;
  onAlternar: (item: string, visivel: boolean) => void;
  modoInclusao?: boolean;
  ocultarAcoesEmMassa?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, []);

  const selecionados = modoInclusao
    ? opcoes.filter((o) => filtro[o] === true).length
    : opcoes.filter((o) => filtro[o] !== false).length;
  const rotuloValor =
    modoInclusao && selecionados === 0
      ? "Nenhum"
      : selecionados === opcoes.length
        ? "Todos"
        : selecionados === 0
          ? "Nenhum"
          : `${selecionados} selecionados`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex h-[42px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700"
      >
        <span className="text-slate-500 dark:text-slate-400">{rotulo}:</span>
        <span className="font-medium text-slate-900 dark:text-slate-100">{rotuloValor}</span>
        <svg
          viewBox="0 0 24 24"
          className="h-3.5 w-3.5 text-slate-400"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {aberto && (
        <div className="absolute z-20 mt-1 max-h-64 w-56 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-800">
          {!ocultarAcoesEmMassa && (
            <div className="mb-1 flex gap-3 border-b border-slate-100 px-1 pb-1.5 dark:border-slate-700">
              <button
                type="button"
                onClick={() => opcoes.forEach((o) => onAlternar(o, true))}
                className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
              >
                Marcar todos
              </button>
              <button
                type="button"
                onClick={() => opcoes.forEach((o) => onAlternar(o, false))}
                className="text-xs font-medium text-slate-500 hover:underline dark:text-slate-400"
              >
                Limpar
              </button>
            </div>
          )}
          {opcoes.map((item) => {
            const visivel = modoInclusao ? filtro[item] === true : filtro[item] !== false;
            return (
              <label
                key={item}
                className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                <input
                  type="checkbox"
                  checked={visivel}
                  onChange={(e) => onAlternar(item, e.target.checked)}
                  className="h-3.5 w-3.5 accent-indigo-600"
                />
                {item}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
