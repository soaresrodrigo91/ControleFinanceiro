"use client";

import { useState } from "react";
import { CUPOM_FREE_PREMIUM, definirPlano, PRECO_ANUAL, PRECO_MENSAL } from "@/lib/plano";
import { CLASSE_INPUT } from "@/lib/estilos";
import { formatarMoeda } from "@/lib/date";
import type { FormaPagamentoPlano, Periodicidade, Plano, TipoPlano } from "@/lib/types";

export default function PlanoSeletor({
  uid,
  planoAtual,
  onConcluido,
}: {
  uid: string;
  planoAtual?: Plano | null;
  onConcluido: () => void;
}) {
  const [tipo, setTipo] = useState<TipoPlano>(planoAtual?.tipo ?? "premium");
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamentoPlano>(
    planoAtual?.formaPagamento === "cartao" ? "cartao" : "pix"
  );
  const [periodicidade, setPeriodicidade] = useState<Periodicidade>(planoAtual?.periodicidade ?? "mensal");
  const [cupom, setCupom] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  const cupomValido = cupom.trim().toUpperCase() === CUPOM_FREE_PREMIUM;

  async function handleConfirmar() {
    setErro("");
    setEnviando(true);
    try {
      if (tipo === "free") {
        await definirPlano(uid, { tipo: "free" });
      } else if (cupomValido) {
        await definirPlano(uid, {
          tipo: "premium",
          formaPagamento: "cupom",
          periodicidade,
          cupom: cupom.trim().toUpperCase(),
        });
      } else {
        await definirPlano(uid, {
          tipo: "premium",
          formaPagamento,
          periodicidade,
        });
      }
      onConcluido();
    } catch {
      setErro("Não foi possível confirmar o plano. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setTipo("free")}
          className={`rounded-xl border-2 p-4 text-left transition-colors ${
            tipo === "free"
              ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950"
              : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800"
          }`}
        >
          <p className="font-semibold text-slate-900 dark:text-slate-100">Free</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">R$ 0</p>
          <ul className="mt-2 flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
            <li>✓ Contas a pagar e a receber</li>
            <li>✓ Início e relatório de lançamentos</li>
            <li>✗ Aba Dashboard (gráficos)</li>
            <li>✗ Aba Relatórios</li>
            <li>✗ Modo escuro</li>
          </ul>
        </button>

        <button
          type="button"
          onClick={() => setTipo("premium")}
          className={`rounded-xl border-2 p-4 text-left transition-colors ${
            tipo === "premium"
              ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950"
              : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800"
          }`}
        >
          <p className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100">
            Premium <span className="text-amber-500">★</span>
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {formatarMoeda(PRECO_MENSAL)}
            <span className="text-sm font-normal text-slate-500 dark:text-slate-400">/mês</span>
          </p>
          <ul className="mt-2 flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
            <li>✓ Tudo do Free</li>
            <li>✓ Aba Dashboard (gráficos)</li>
            <li>✓ Aba Relatórios</li>
            <li>✓ Modo escuro</li>
          </ul>
        </button>
      </div>

      {tipo === "premium" && (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Periodicidade
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPeriodicidade("mensal")}
                className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                  periodicidade === "mensal"
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
                }`}
              >
                Mensal · {formatarMoeda(PRECO_MENSAL)}
              </button>
              <button
                type="button"
                onClick={() => setPeriodicidade("anual")}
                className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                  periodicidade === "anual"
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
                }`}
              >
                Anual · {formatarMoeda(PRECO_ANUAL)}{" "}
                <span className={periodicidade === "anual" ? "text-indigo-100" : "text-emerald-600 dark:text-emerald-400"}>
                  (2 meses grátis)
                </span>
              </button>
            </div>
          </div>

          {!cupomValido && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Forma de pagamento
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormaPagamento("pix")}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                    formaPagamento === "pix"
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
                  }`}
                >
                  Pix
                </button>
                <button
                  type="button"
                  onClick={() => setFormaPagamento("cartao")}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                    formaPagamento === "cartao"
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
                  }`}
                >
                  Cartão de crédito
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Código promocional
            </label>
            <input
              type="text"
              value={cupom}
              onChange={(e) => setCupom(e.target.value)}
              placeholder="Opcional"
              className={CLASSE_INPUT}
            />
            {cupomValido && (
              <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                Cupom válido! O Premium será liberado sem cobrança.
              </p>
            )}
          </div>
        </div>
      )}

      {erro && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}

      <button
        onClick={handleConfirmar}
        disabled={enviando}
        className="w-full rounded-lg bg-indigo-600 py-2.5 font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
      >
        {enviando
          ? "Confirmando..."
          : tipo === "free"
            ? "Continuar com Free"
            : cupomValido
              ? "Pagar com cupom promocional"
              : "Pagar"}
      </button>
    </div>
  );
}
