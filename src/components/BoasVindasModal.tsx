"use client";

import { useEffect, useState } from "react";
import { assinarBoasVindasVistas, marcarBoasVindasVistas } from "@/lib/perfil";
import { CLASSE_BOTAO_PRIMARIO } from "@/lib/estilos";
import Modal from "@/components/Modal";

export default function BoasVindasModal({ uid }: { uid: string }) {
  const [mostrar, setMostrar] = useState(false);

  useEffect(() => {
    return assinarBoasVindasVistas(uid, (vistas) => setMostrar(!vistas));
  }, [uid]);

  async function handleFechar() {
    setMostrar(false);
    await marcarBoasVindasVistas(uid);
  }

  return (
    <Modal aberto={mostrar} onFechar={handleFechar} titulo="Bem-vindo(a)!">
      <div className="flex flex-col gap-3 text-sm text-slate-600 dark:text-slate-300">
        <p>👋 Olá! Seja muito bem-vindo(a) ao Controle Financeiro.</p>
        <p>Parabéns por dar o primeiro passo para organizar sua vida financeira! 💙</p>
        <p>
          Aqui você poderá registrar suas receitas e despesas, acompanhar seus gastos e ter uma
          visão clara do seu dinheiro, tudo de forma simples e prática.
        </p>
        <p>
          Se precisar de ajuda, estamos à disposição. Esperamos que o Controle Financeiro facilite
          o seu dia a dia e ajude você a alcançar seus objetivos.
        </p>
        <p>Bem-vindo ao jeito simples de cuidar das finanças! 🚀</p>
        <button onClick={handleFechar} className={CLASSE_BOTAO_PRIMARIO}>
          Começar
        </button>
      </div>
    </Modal>
  );
}
