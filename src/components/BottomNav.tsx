"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./nav-items";
import { usePlano } from "@/contexts/PlanoContext";

export default function BottomNav() {
  const pathname = usePathname();
  const { plano } = usePlano();
  const itens = NAV_ITEMS.filter((item) => !item.premium || plano?.tipo === "premium");

  return (
    <nav className="sticky bottom-0 z-10 flex shrink-0 border-t border-slate-200 bg-white md:hidden print:hidden dark:border-slate-700 dark:bg-slate-900">
      {itens.map((item) => {
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
            {item.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
