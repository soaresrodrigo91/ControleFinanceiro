"use client";

import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";

export default function Modal({
  aberto,
  onFechar,
  titulo,
  children,
}: {
  aberto: boolean;
  onFechar: () => void;
  titulo: string;
  children: ReactNode;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const mousedownNoOverlayRef = useRef(false);
  const abertoEmRef = useRef(0);

  useEffect(() => {
    if (aberto) abertoEmRef.current = Date.now();
  }, [aberto]);

  if (!aberto) return null;

  function handleMouseDown(e: MouseEvent<HTMLDivElement>) {
    mousedownNoOverlayRef.current = e.target === overlayRef.current;
  }

  function handleClickFora(e: MouseEvent<HTMLDivElement>) {
    // Só fecha se tanto o mousedown quanto o click caíram exatamente no
    // overlay (não em algum elemento interno do card) — evita fechamentos
    // acidentais por seleção de texto que termina fora do card, por exemplo.
    const foiRealmenteNoOverlay = mousedownNoOverlayRef.current && e.target === overlayRef.current;
    mousedownNoOverlayRef.current = false;
    if (!foiRealmenteNoOverlay) return;
    // Evita que o segundo clique de um duplo-clique no botão que abriu o
    // modal (que cai no overlay, já que o botão fica fora do card central)
    // feche o modal antes do usuário conseguir interagir com ele.
    if (Date.now() - abertoEmRef.current < 350) return;
    onFechar();
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onMouseDown={handleMouseDown}
      onClick={handleClickFora}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-5 shadow-lg dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{titulo}</h2>
          <button
            onClick={onFechar}
            aria-label="Fechar"
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
