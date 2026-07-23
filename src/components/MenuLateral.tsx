"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { usePlano } from "@/contexts/PlanoContext";
import { NAV_ITEMS } from "./nav-items";
import PerfilMenu from "@/components/PerfilMenu";
import BotaoSair from "@/components/BotaoSair";
import NotificacoesSino from "@/components/NotificacoesSino";
import { IconMenu } from "@/components/action-icons";

export default function MenuLateral() {
  const pathname = usePathname();
  const { usuario } = useAuth();
  const { plano } = usePlano();
  const [aberto, setAberto] = useState(false);
  const itens = NAV_ITEMS.filter((item) => !item.premium || plano?.tipo === "premium");

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-label="Abrir menu"
        className="fixed top-2 left-2 z-30 hidden rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:block print:hidden dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <IconMenu className="h-5 w-5" />
      </button>

      {aberto && (
        <div
          onClick={() => setAberto(false)}
          className="fixed inset-0 z-40 hidden bg-slate-900/40 md:block print:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 hidden w-64 flex-col transform border-r border-slate-200 bg-white shadow-lg transition-transform duration-200 md:flex print:hidden dark:border-slate-700 dark:bg-slate-900 ${
          aberto ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <span className="font-semibold text-slate-900 dark:text-slate-100">Menu</span>
          <button
            type="button"
            onClick={() => setAberto(false)}
            aria-label="Fechar menu"
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            ×
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {itens.map((item) => {
            const ativo = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setAberto(false)}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                  ativo
                    ? "bg-indigo-600 text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                }`}
              >
                <item.Icone className="h-4 w-4" />
                {item.rotulo}
              </Link>
            );
          })}
        </nav>
        <div className="flex shrink-0 flex-col items-start gap-0.5 p-2 pb-8">
          {usuario && (
            <div className="flex items-center gap-1">
              <NotificacoesSino uid={usuario.uid} />
              <PerfilMenu uid={usuario.uid} variante="barraLateral" />
            </div>
          )}
          <BotaoSair className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950" />
        </div>
      </aside>
    </>
  );
}
