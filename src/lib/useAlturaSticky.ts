"use client";

import { useEffect, useRef, useState } from "react";

export function useAlturaSticky<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [altura, setAltura] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const atualizar = () => setAltura(el.offsetHeight);
    atualizar();
    const observador = new ResizeObserver(atualizar);
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  return { ref, altura };
}
