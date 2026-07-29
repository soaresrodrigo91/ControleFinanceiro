"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { usePlano } from "@/contexts/PlanoContext";
import { ROTAS_PREMIUM } from "@/lib/plano";
import { assinarConfigListas, CONFIG_PADRAO } from "@/lib/config";
import BottomNav from "@/components/BottomNav";
import TopNav from "@/components/TopNav";
import MenuLateral from "@/components/MenuLateral";
import PerfilMenu from "@/components/PerfilMenu";
import BotaoSair from "@/components/BotaoSair";
import NotificacoesSino from "@/components/NotificacoesSino";
import BoasVindasModal from "@/components/BoasVindasModal";
import { VERSAO_EXIBICAO } from "@/lib/versao";
import type { ConfigListas } from "@/lib/types";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { usuario, carregando } = useAuth();
  const { plano, carregando: carregandoPlano } = usePlano();
  const router = useRouter();
  const pathname = usePathname();
  const [config, setConfig] = useState<ConfigListas>(CONFIG_PADRAO);

  useEffect(() => {
    if (!usuario) return;
    return assinarConfigListas(usuario.uid, setConfig);
  }, [usuario]);

  useEffect(() => {
    if (carregando) return;
    if (!usuario) {
      router.replace("/login");
      return;
    }
    if (carregandoPlano) return;
    if (!plano) {
      router.replace("/escolher-plano");
      return;
    }
    if (plano.tipo === "free" && ROTAS_PREMIUM.includes(pathname)) {
      router.replace("/inicio");
    }
  }, [usuario, carregando, plano, carregandoPlano, pathname, router]);

  if (carregando || !usuario || carregandoPlano || !plano || (plano.tipo === "free" && ROTAS_PREMIUM.includes(pathname))) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-slate-500 dark:text-slate-400">
        Carregando...
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden print:hidden dark:border-slate-700 dark:bg-slate-900">
        <span className="font-semibold text-slate-900 dark:text-slate-100">Controle Financeiro</span>
        <div className="flex items-center gap-1">
          <NotificacoesSino uid={usuario.uid} />
          <PerfilMenu uid={usuario.uid} />
          <BotaoSair className="text-sm text-slate-500 underline dark:text-slate-400" />
        </div>
      </header>
      {config.layoutMenu === "vertical" ? <MenuLateral /> : <TopNav />}
      <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      <footer className="shrink-0 border-t border-slate-200 px-4 py-1.5 text-center text-xs text-slate-400 print:hidden md:px-8 dark:border-slate-700 dark:text-slate-500">
        Controle Financeiro - {VERSAO_EXIBICAO}
      </footer>
      <BottomNav />
      <BoasVindasModal uid={usuario.uid} />
    </div>
  );
}
