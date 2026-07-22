"use client";

import { useMemo, useState } from "react";
import { CLASSE_INPUT } from "@/lib/estilos";

export default function CampoCredor({
  id,
  label,
  value,
  onChange,
  opcoes,
  ativo,
  required,
  placeholder,
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (valor: string) => void;
  opcoes: string[];
  ativo: boolean;
  required?: boolean;
  placeholder?: string;
}) {
  const [aberto, setAberto] = useState(false);

  const sugestoes = useMemo(() => {
    if (!ativo) return [];
    const termo = value.trim().toLowerCase();
    if (!termo) return [];
    return opcoes
      .filter((nome) => nome.toLowerCase().includes(termo) && nome.toLowerCase() !== termo)
      .slice(0, 6);
  }, [ativo, value, opcoes]);

  return (
    <div className="relative">
      <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="text"
        required={required}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setAberto(true);
        }}
        onFocus={() => setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        autoComplete="off"
        placeholder={placeholder}
        className={CLASSE_INPUT}
      />
      {aberto && sugestoes.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
          {sugestoes.map((nome) => (
            <li key={nome}>
              <button
                type="button"
                onClick={() => {
                  onChange(nome);
                  setAberto(false);
                }}
                className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 dark:text-slate-300 dark:hover:bg-indigo-950 dark:hover:text-indigo-300"
              >
                {nome}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
