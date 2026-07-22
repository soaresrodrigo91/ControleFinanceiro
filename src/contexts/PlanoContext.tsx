"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { assinarPlano } from "@/lib/plano";
import type { Plano } from "@/lib/types";

type PlanoContextValue = {
  plano: Plano | null;
  carregando: boolean;
};

const PlanoContext = createContext<PlanoContextValue | null>(null);

export function PlanoProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  const [plano, setPlano] = useState<Plano | null>(null);
  const [uidAssinado, setUidAssinado] = useState<string | null>(null);

  useEffect(() => {
    if (!usuario) return;
    return assinarPlano(usuario.uid, (p) => {
      setPlano(p);
      setUidAssinado(usuario.uid);
    });
  }, [usuario]);

  const carregando = usuario ? uidAssinado !== usuario.uid : false;

  return (
    <PlanoContext.Provider value={{ plano: usuario ? plano : null, carregando }}>
      {children}
    </PlanoContext.Provider>
  );
}

export function usePlano() {
  const ctx = useContext(PlanoContext);
  if (!ctx) throw new Error("usePlano deve ser usado dentro de PlanoProvider");
  return ctx;
}
