"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type Tema = "light" | "dark";

const ThemeContext = createContext<{ tema: Tema; alternarTema: () => void } | null>(null);

function temaInicial(): Tema {
  if (typeof window === "undefined") return "light";
  return localStorage.getItem("tema") === "dark" ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(temaInicial);

  function alternarTema() {
    setTema((atual) => {
      const novo: Tema = atual === "dark" ? "light" : "dark";
      localStorage.setItem("tema", novo);
      document.documentElement.classList.toggle("dark", novo === "dark");
      return novo;
    });
  }

  return <ThemeContext.Provider value={{ tema, alternarTema }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme deve ser usado dentro de ThemeProvider");
  return ctx;
}
