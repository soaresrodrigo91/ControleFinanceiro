"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { mesAtualYM } from "@/lib/date";

type MesAtualContextValue = {
  ym: string;
  definirYm: (ym: string) => void;
};

const MesAtualContext = createContext<MesAtualContextValue | null>(null);

function validarYM(valor: string | null): valor is string {
  return !!valor && /^\d{4}-\d{2}$/.test(valor);
}

export function MesAtualProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  const [ym, setYm] = useState(mesAtualYM());

  useEffect(() => {
    if (!usuario) return;
    queueMicrotask(() => {
      const salvo = sessionStorage.getItem(`mesSelecionado_${usuario.uid}`);
      setYm(validarYM(salvo) ? salvo : mesAtualYM());
    });
  }, [usuario]);

  function definirYm(novoYm: string) {
    setYm(novoYm);
    if (usuario) sessionStorage.setItem(`mesSelecionado_${usuario.uid}`, novoYm);
  }

  return (
    <MesAtualContext.Provider value={{ ym, definirYm }}>{children}</MesAtualContext.Provider>
  );
}

export function useMesAtual() {
  const ctx = useContext(MesAtualContext);
  if (!ctx) throw new Error("useMesAtual deve ser usado dentro de MesAtualProvider");
  return ctx;
}
