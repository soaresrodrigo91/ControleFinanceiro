"use client";

import { useEffect, useState } from "react";

export default function ToastSucesso({
  mensagem,
  duracaoMs = 3000,
  onFechar,
}: {
  mensagem: string;
  duracaoMs?: number;
  onFechar: () => void;
}) {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const quadro = requestAnimationFrame(() => setVisivel(true));
    const id = setTimeout(onFechar, duracaoMs);
    return () => {
      cancelAnimationFrame(quadro);
      clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mensagem]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-6">
      <div
        className={`flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white px-8 py-7 shadow-2xl transition-all duration-300 dark:border-slate-700 dark:bg-slate-800 ${
          visivel ? "scale-100 opacity-100" : "scale-75 opacity-0"
        }`}
      >
        <div className="grid h-16 w-16 place-items-center rounded-full bg-green-600 text-white">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            width={30}
            height={30}
          >
            <path d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <span className="text-center text-sm font-semibold text-slate-800 dark:text-slate-100">{mensagem}</span>
      </div>
    </div>
  );
}
