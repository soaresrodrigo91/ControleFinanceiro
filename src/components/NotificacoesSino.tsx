"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { assinarNotificacoes, marcarComoLida } from "@/lib/notificacoes";
import { useMesAtual } from "@/contexts/MesAtualContext";
import { IconSino } from "@/components/action-icons";
import type { Notificacao } from "@/lib/types";

function formatarQuando(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutos = Math.floor(diffMs / 60000);
  if (minutos < 1) return "agora";
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas}h`;
  const dias = Math.floor(horas / 24);
  return `há ${dias}d`;
}

export default function NotificacoesSino({ uid }: { uid: string }) {
  const router = useRouter();
  const { definirYm } = useMesAtual();
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [aberto, setAberto] = useState(false);
  const [mensagemAberta, setMensagemAberta] = useState<Notificacao | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return assinarNotificacoes(uid, setNotificacoes);
  }, [uid]);

  useEffect(() => {
    function handleClickFora(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    if (aberto) document.addEventListener("mousedown", handleClickFora);
    return () => document.removeEventListener("mousedown", handleClickFora);
  }, [aberto]);

  const naoLidas = notificacoes.filter((n) => !n.lida);

  async function handleClicarNotificacao(n: Notificacao) {
    await marcarComoLida(n.id);
    if (n.tipo === "recebido" || n.tipo === "atualizacao") {
      if (n.ym) definirYm(n.ym);
      setAberto(false);
      router.push("/lancar?aba=compartilhados&modo=recebidos");
      if (n.tipo === "atualizacao") setMensagemAberta(n);
    } else {
      setMensagemAberta(n);
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setAberto((v) => !v)}
        aria-label="Notificações"
        className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
      >
        <IconSino className="h-5 w-5" />
        {naoLidas.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
            {naoLidas.length}
          </span>
        )}
      </button>

      {aberto && (
        <div className="absolute right-0 top-full z-30 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-800">
          {notificacoes.length === 0 ? (
            <p className="p-3 text-sm text-slate-400 dark:text-slate-500">Nenhuma notificação.</p>
          ) : (
            <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
              {notificacoes.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClicarNotificacao(n)}
                  className={`flex flex-col items-start rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 ${
                    n.lida ? "text-slate-400 dark:text-slate-500" : "text-slate-700 dark:text-slate-200"
                  }`}
                >
                  <span>{n.mensagem}</span>
                  <span className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{formatarQuando(n.criadoEm)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {mensagemAberta && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => setMensagemAberta(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-5 shadow-lg dark:bg-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-2 text-base font-semibold text-slate-900 dark:text-slate-100">
              {mensagemAberta.tipo === "atualizacao"
                ? "Valor atualizado"
                : mensagemAberta.deUid === uid
                  ? "Aguardando ativação"
                  : "Convite"}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">{mensagemAberta.mensagem}</p>
            <button
              onClick={() => setMensagemAberta(null)}
              className="mt-4 w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
