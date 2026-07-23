"use client";

import { useEffect, useState } from "react";
import {
  assinarVinculos,
  atualizarCompartilharLancamentos,
  removerVinculo,
  salvarVinculo,
  temCompartilhamentosAtivos,
} from "@/lib/compartilhamento";
import { CLASSE_BOTAO_PRIMARIO, CLASSE_CARD, CLASSE_INPUT } from "@/lib/estilos";
import Modal from "@/components/Modal";
import type { ConfigListas, VinculoCompartilhamento } from "@/lib/types";

export default function CompartilharLancamentosCard({
  uid,
  config,
}: {
  uid: string;
  config: ConfigListas;
}) {
  const [vinculos, setVinculos] = useState<VinculoCompartilhamento[]>([]);
  const [confirmandoDesativar, setConfirmandoDesativar] = useState(false);

  useEffect(() => {
    return assinarVinculos(uid, setVinculos);
  }, [uid]);

  const vinculoPorComp = new Map(vinculos.map((v) => [v.compNome, v]));

  async function handleToggle(ativo: boolean) {
    if (!ativo) {
      const temAtivos = await temCompartilhamentosAtivos(uid).catch(() => false);
      if (temAtivos) {
        setConfirmandoDesativar(true);
        return;
      }
    }
    await atualizarCompartilharLancamentos(uid, ativo);
  }

  return (
    <div className={`${CLASSE_CARD} flex flex-col`}>
      <div className="mb-1.5 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Compartilhar Lançamentos</h2>
        <button
          type="button"
          role="switch"
          aria-checked={config.compartilharLancamentos}
          onClick={() => handleToggle(!config.compartilharLancamentos)}
          className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
            config.compartilharLancamentos ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-600"
          }`}
        >
          <span
            className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform"
            style={{ transform: config.compartilharLancamentos ? "translateX(16px)" : "translateX(0)" }}
          />
        </button>
      </div>
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
        Vincule um reembolso a um e-mail de outro usuário do sistema para compartilhar lançamentos com ele
        em Contas a Pagar → Lançamentos Compartilhados.
      </p>

      <div className="flex flex-col gap-2">
        {config.comp.length === 0 && (
          <p className="text-sm text-slate-400 dark:text-slate-500">
            Cadastre um reembolso ao lado para poder vinculá-lo a um e-mail.
          </p>
        )}
        {config.comp.map((c) => (
          <LinhaVinculo key={c.nome} uid={uid} compNome={c.nome} vinculo={vinculoPorComp.get(c.nome)} />
        ))}
      </div>

      <Modal
        aberto={confirmandoDesativar}
        onFechar={() => setConfirmandoDesativar(false)}
        titulo="Desativar Compartilhar Lançamentos?"
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Você tem lançamentos compartilhados (enviados ou recebidos). Ao desativar, a aba “Lançamentos
            Compartilhados” some do menu e novos lançamentos deixam de alimentar esse fluxo — mas o que já
            existe continua acessível se você reativar depois.
          </p>
          <button
            onClick={async () => {
              await atualizarCompartilharLancamentos(uid, false);
              setConfirmandoDesativar(false);
            }}
            className={CLASSE_BOTAO_PRIMARIO}
          >
            Desativar mesmo assim
          </button>
          <button
            onClick={() => setConfirmandoDesativar(false)}
            className="text-center text-sm text-slate-500 dark:text-slate-400"
          >
            Cancelar
          </button>
        </div>
      </Modal>
    </div>
  );
}

function LinhaVinculo({
  uid,
  compNome,
  vinculo,
}: {
  uid: string;
  compNome: string;
  vinculo: VinculoCompartilhamento | undefined;
}) {
  const [email, setEmail] = useState(vinculo?.emailVinculado ?? "");
  const [status, setStatus] = useState<"idle" | "salvando" | "naoEncontrado">("idle");
  const [emailSincronizado, setEmailSincronizado] = useState(vinculo?.emailVinculado ?? "");

  if ((vinculo?.emailVinculado ?? "") !== emailSincronizado) {
    setEmailSincronizado(vinculo?.emailVinculado ?? "");
    setEmail(vinculo?.emailVinculado ?? "");
    setStatus("idle");
  }

  async function handleBlur() {
    const digitado = email.trim();
    if (!digitado) {
      if (vinculo) await removerVinculo(uid, compNome, vinculo.emailVinculado);
      return;
    }
    if (vinculo && digitado.toLowerCase() === vinculo.emailVinculado) return;

    setStatus("salvando");
    try {
      const ok = await salvarVinculo(uid, compNome, digitado, vinculo?.emailVinculado);
      setStatus(ok ? "idle" : "naoEncontrado");
    } catch {
      setStatus("naoEncontrado");
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="truncate text-sm text-slate-700 dark:text-slate-300">{compNome}</span>
        {status === "idle" && vinculo && (
          <span className="shrink-0 text-emerald-600 dark:text-emerald-400" title="E-mail vinculado" aria-label="E-mail vinculado">
            ✓
          </span>
        )}
      </div>
      <input
        type="email"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          setStatus("idle");
        }}
        onBlur={handleBlur}
        placeholder="e-mail@exemplo.com"
        className={`${CLASSE_INPUT} h-9 text-xs`}
      />
      {status === "salvando" && <p className="mt-1 text-xs text-slate-400">Verificando...</p>}
      {status === "naoEncontrado" && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">Esse e-mail não está cadastrado no sistema.</p>
      )}
    </div>
  );
}
