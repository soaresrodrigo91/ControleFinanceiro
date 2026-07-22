"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { usePlano } from "@/contexts/PlanoContext";
import AuthHeader from "@/components/AuthHeader";
import PlanoSeletor from "@/components/PlanoSeletor";

export default function EscolherPlanoPage() {
  const { usuario, carregando: carregandoAuth } = useAuth();
  const { plano, carregando: carregandoPlano } = usePlano();
  const router = useRouter();

  useEffect(() => {
    if (carregandoAuth) return;
    if (!usuario) {
      router.replace("/login");
      return;
    }
    if (!carregandoPlano && plano) {
      router.replace("/inicio");
    }
  }, [usuario, carregandoAuth, plano, carregandoPlano, router]);

  if (!usuario || carregandoPlano || plano) return null;

  return (
    <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-slate-50 px-4 py-8 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">
      <div className="w-full max-w-xl">
        <AuthHeader />
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h1 className="mb-1 text-center text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Escolha seu plano
          </h1>
          <p className="mb-6 text-center text-sm text-slate-500 dark:text-slate-400">
            Você pode mudar de plano quando quiser em Configurações.
          </p>
          <PlanoSeletor uid={usuario.uid} onConcluido={() => router.replace("/inicio")} />
        </div>
      </div>
    </div>
  );
}
