"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./nav-items";
import { usePlano } from "@/contexts/PlanoContext";
import { IconMais } from "@/components/action-icons";

const ROTULOS_COMPACTOS: Record<string, string> = {
  "/lancar": "Pagar",
  "/receber": "Receber",
};

const HREFS_PRINCIPAIS = ["/inicio", "/lancar", "/receber"];

export default function BottomNav() {
  const pathname = usePathname();
  const { plano } = usePlano();
  const [maisAberto, setMaisAberto] = useState(false);
  const itens = NAV_ITEMS.filter((item) => !item.premium || plano?.tipo === "premium");

  const principais = itens.filter((item) => HREFS_PRINCIPAIS.includes(item.href));
  const restantes = itens.filter((item) => !HREFS_PRINCIPAIS.includes(item.href));
  const algumRestanteAtivo = restantes.some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  );

  return (
    <>
      {maisAberto && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 md:hidden"
          onClick={() => setMaisAberto(false)}
        />
      )}

      {maisAberto && (
        <div className="fixed inset-x-0 bottom-[57px] z-40 rounded-t-2xl border-t border-slate-200 bg-white pb-2 shadow-lg md:hidden dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-col p-2">
            {restantes.map((item) => {
              const ativo = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMaisAberto(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                    ativo
                      ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400"
                      : "text-slate-600 dark:text-slate-300"
                  }`}
                >
                  <item.Icone className="h-5 w-5" />
                  {item.rotulo}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <nav className="sticky bottom-0 z-20 flex shrink-0 border-t border-slate-200 bg-white md:hidden print:hidden dark:border-slate-700 dark:bg-slate-900">
        {principais.map((item) => {
          const ativo = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium ${
                ativo ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500"
              }`}
            >
              <item.Icone className="h-5 w-5" />
              {ROTULOS_COMPACTOS[item.href] ?? item.rotulo}
            </Link>
          );
        })}
        <button
          onClick={() => setMaisAberto((v) => !v)}
          className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium ${
            maisAberto || algumRestanteAtivo
              ? "text-indigo-600 dark:text-indigo-400"
              : "text-slate-400 dark:text-slate-500"
          }`}
        >
          <IconMais className="h-5 w-5" />
          Mais
        </button>
      </nav>
    </>
  );
}
