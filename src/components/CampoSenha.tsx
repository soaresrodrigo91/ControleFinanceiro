"use client";

import { useState, type InputHTMLAttributes } from "react";
import { IconOlho, IconOlhoFechado } from "@/components/action-icons";
import { CLASSE_INPUT } from "@/lib/estilos";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export default function CampoSenha({ className, ...props }: Props) {
  const [visivel, setVisivel] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={visivel ? "text" : "password"}
        className={`${className ?? CLASSE_INPUT} pr-10`}
      />
      <button
        type="button"
        onClick={() => setVisivel((v) => !v)}
        tabIndex={-1}
        aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
      >
        {visivel ? <IconOlhoFechado className="h-5 w-5" /> : <IconOlho className="h-5 w-5" />}
      </button>
    </div>
  );
}
