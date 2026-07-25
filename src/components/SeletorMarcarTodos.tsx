"use client";

import { useEffect, useRef, useState } from "react";

// Checkbox compacto para marcar/desmarcar em massa: o checkbox principal age sobre a
// página atual (mesma função de sempre), e a setinha ao lado abre um menu só com a opção
// "todas as páginas" — marcar/desmarcar a página atual já é feito pelo checkbox principal,
// não precisa se repetir dentro do menu.
export default function SeletorMarcarTodos({
  marcadoPagina,
  onAlterarPagina,
  marcadoTodas,
  onAlterarTodas,
  ariaLabelPagina,
  ariaLabelTodas,
  rotuloPagina = "Nesta página",
  rotuloTodas = "Todas as páginas",
}: {
  marcadoPagina: boolean;
  onAlterarPagina: (marcado: boolean) => void;
  marcadoTodas: boolean;
  onAlterarTodas: (marcado: boolean) => void;
  ariaLabelPagina: string;
  ariaLabelTodas: string;
  rotuloPagina?: string;
  rotuloTodas?: string;
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

  return (
    <div className="relative inline-flex items-center gap-0.5" ref={ref}>
      <input
        type="checkbox"
        checked={marcadoPagina}
        onChange={(e) => onAlterarPagina(e.target.checked)}
        className="h-5 w-5 shrink-0 accent-indigo-600"
        aria-label={ariaLabelPagina}
        title={rotuloPagina}
      />
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-label="Mais opções de seleção"
        className="rounded p-0.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {aberto && (
        <div className="absolute left-0 top-full z-30 mt-1 w-52 rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-800">
          <label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700">
            <input
              type="checkbox"
              checked={marcadoTodas}
              onChange={(e) => onAlterarTodas(e.target.checked)}
              className="h-3.5 w-3.5 accent-indigo-600"
              aria-label={ariaLabelTodas}
            />
            {rotuloTodas}
          </label>
        </div>
      )}
    </div>
  );
}
