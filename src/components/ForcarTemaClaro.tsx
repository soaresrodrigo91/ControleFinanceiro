"use client";

import { useEffect } from "react";

export default function ForcarTemaClaro() {
  useEffect(() => {
    document.documentElement.classList.remove("dark");
    return () => {
      try {
        if (localStorage.getItem("tema") === "dark") {
          document.documentElement.classList.add("dark");
        }
      } catch {
        // localStorage indisponível (ex.: navegação privada) — sem tema salvo, nada a restaurar.
      }
    };
  }, []);

  return null;
}
