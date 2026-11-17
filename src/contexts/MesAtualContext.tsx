"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { assinarConfigListas, salvarMesSelecionado } from "@/lib/config";
import { mesAtualYM } from "@/lib/date";

type MesAtualContextValue = {
  ym: string;
  definirYm: (ym: string) => void;
};

const MesAtualContext = createContext<MesAtualContextValue | null>(null);

function validarYM(valor: string | null | undefined): valor is string {
  return !!valor && /^\d{4}-\d{2}$/.test(valor);
}

export function MesAtualProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  const [ym, setYm] = useState(mesAtualYM());
  // Config "Manter o mês selecionado ao acessar o sistema" (Configurações > Geral I).
  const manterMesRef = useRef(false);
  const mesSalvoRef = useRef<string | null>(null);

  useEffect(() => {
    if (!usuario) return;
    const uid = usuario.uid;
    let inicializado = false;
    return assinarConfigListas(uid, (config) => {
      manterMesRef.current = config.manterMesSelecionado ?? false;
      mesSalvoRef.current = config.mesSelecionadoSalvo ?? null;
      if (inicializado) return;
      inicializado = true;
      // Dentro da mesma sessão (sessionStorage) o mês escolhido sempre prevalece; ao
      // acessar o sistema de novo, usa o mês salvo se a config estiver ligada, senão o atual.
      const daSessao = sessionStorage.getItem(`mesSelecionado_${uid}`);
      if (validarYM(daSessao)) setYm(daSessao);
      else if (manterMesRef.current && validarYM(mesSalvoRef.current)) setYm(mesSalvoRef.current);
      else setYm(mesAtualYM());
    });
  }, [usuario]);

  function definirYm(novoYm: string) {
    setYm(novoYm);
    if (!usuario) return;
    sessionStorage.setItem(`mesSelecionado_${usuario.uid}`, novoYm);
    if (manterMesRef.current && mesSalvoRef.current !== novoYm) {
      mesSalvoRef.current = novoYm;
      salvarMesSelecionado(usuario.uid, novoYm).catch(() => {});
    }
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
