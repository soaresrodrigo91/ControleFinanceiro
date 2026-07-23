"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { usePlano } from "@/contexts/PlanoContext";
import { NAV_ITEMS } from "./nav-items";
import PerfilMenu from "@/components/PerfilMenu";
import BotaoSair from "@/components/BotaoSair";
import NotificacoesSino from "@/components/NotificacoesSino";

export default function TopNav() {
  const pathname = usePathname();
  const { usuario } = useAuth();
  const { plano } = usePlano();
  const itens = NAV_ITEMS.filter((item) => !item.premium || plano?.tipo === "premium");

  return (
    <header className="hidden shrink-0 border-b border-slate-200 bg-white md:block print:hidden dark:border-slate-700 dark:bg-slate-900">
      <div className="mx-auto flex max-w-[1600px] items-center gap-2 px-4 py-3 md:px-8">
        <nav className="flex items-center gap-1">
          {itens.map((item) => {
            const ativo = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
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

        <div className="ml-auto flex items-center gap-2">
          {usuario && <NotificacoesSino uid={usuario.uid} />}
          {usuario && <PerfilMenu uid={usuario.uid} />}
          <BotaoSair className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white" />
        </div>
      </div>
    </header>
  );
}
