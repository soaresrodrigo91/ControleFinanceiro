"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Modal from "@/components/Modal";

export default function BotaoSair({ className }: { className?: string }) {
  const { sair } = useAuth();
  const [confirmando, setConfirmando] = useState(false);

  return (
    <>
      <button onClick={() => setConfirmando(true)} className={className}>
        Sair
      </button>
      <Modal aberto={confirmando} onFechar={() => setConfirmando(false)} titulo="Sair da conta">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Tem certeza que deseja sair da sua conta?
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setConfirmando(false)}
              className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Cancelar
            </button>
            <button
              onClick={() => sair()}
              className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Sair
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
