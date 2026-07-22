"use client";

import type { ReactNode } from "react";

export function Tabs({ children }: { children: ReactNode }) {
  return (
    <div className="mb-6 flex gap-6 border-b border-slate-200 print:hidden dark:border-slate-700">{children}</div>
  );
}

export function Tab({
  ativo,
  onClick,
  icone,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  icone?: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 border-b-2 pb-2.5 text-sm font-medium transition-colors ${
        ativo
          ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
          : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      }`}
    >
      {icone}
      {children}
    </button>
  );
}
