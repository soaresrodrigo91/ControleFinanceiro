"use client";

import type { ReactNode } from "react";

export default function ColunaOrdenavel<TCampo extends string>({
  campo,
  ordenacao,
  onClicar,
  className = "py-2 pr-2",
  alinhamento = "left",
  children,
}: {
  campo: TCampo;
  ordenacao: { campo: TCampo; direcao: "asc" | "desc" } | null;
  onClicar: (campo: TCampo) => void;
  className?: string;
  alinhamento?: "left" | "right";
  children: ReactNode;
}) {
  const ativo = ordenacao?.campo === campo;
  return (
    <th className={className}>
      <button
        type="button"
        onClick={() => onClicar(campo)}
        className={`flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200 ${
          alinhamento === "right" ? "ml-auto" : ""
        }`}
      >
        {children}
        <span className="text-[10px]">{ativo ? (ordenacao!.direcao === "asc" ? "▲" : "▼") : ""}</span>
      </button>
    </th>
  );
}
