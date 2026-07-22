"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePlano } from "@/contexts/PlanoContext";
import { atualizarFormaPagamentoPlano, PRECO_ANUAL, PRECO_MENSAL } from "@/lib/plano";
import { CLASSE_CARD } from "@/lib/estilos";
import { formatarDataBR, formatarMoeda } from "@/lib/date";
import PlanoSeletor from "@/components/PlanoSeletor";
import type { FormaPagamentoPlano, Periodicidade } from "@/lib/types";

const ROTULO_FORMA_PAGAMENTO: Record<string, string> = {
  pix: "Pix",
  cartao: "Cartão de crédito",
  cupom: "Cupom promocional",
};

const ROTULO_PERIODICIDADE: Record<string, string> = {
  mensal: "Mensal",
  anual: "Anual",
};

type Modo = "ver" | "forma-pagamento" | "plano";

export default function PlanoPage() {
  const { usuario } = useAuth();
  const { plano } = usePlano();
  const [modo, setModo] = useState<Modo>("ver");

  if (!usuario || !plano) return null;

  if (modo === "plano") {
    return (
      <div className="mx-auto max-w-xl px-4 py-6 md:px-8">
        <h1 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">Alterar plano</h1>
        <PlanoSeletor uid={usuario.uid} planoAtual={plano} onConcluido={() => setModo("ver")} />
        <button
          onClick={() => setModo("ver")}
          className="mt-3 w-full text-center text-sm text-slate-500 dark:text-slate-400"
        >
          Cancelar
        </button>
      </div>
    );
  }

  if (modo === "forma-pagamento") {
    return (
      <div className="mx-auto max-w-xl px-4 py-6 md:px-8">
        <h1 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
          Alterar forma de pagamento
        </h1>
        <FormularioFormaPagamento
          uid={usuario.uid}
          formaPagamentoAtual={plano.formaPagamento === "cartao" ? "cartao" : "pix"}
          periodicidadeAtual={plano.periodicidade ?? "mensal"}
          onConcluido={() => setModo("ver")}
        />
        <button
          onClick={() => setModo("ver")}
          className="mt-3 w-full text-center text-sm text-slate-500 dark:text-slate-400"
        >
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-6 md:px-8">
      <div className={CLASSE_CARD}>
        <div className="mb-4 flex items-center justify-between">
          <h1 className="flex items-center gap-1.5 text-lg font-semibold text-slate-900 dark:text-slate-100">
            Seu plano
            {plano.tipo === "premium" && <span className="text-amber-500">★</span>}
          </h1>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              plano.tipo === "premium"
                ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
            }`}
          >
            {plano.tipo === "premium" ? "Premium" : "Free"}
          </span>
        </div>

        <div className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-400">
          <p>
            Ativo desde <span className="font-medium text-slate-900 dark:text-slate-100">{formatarDataBR(plano.ativoDesde)}</span>
          </p>
          {plano.tipo === "premium" && plano.formaPagamento && (
            <p>
              Forma de pagamento{" "}
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {ROTULO_FORMA_PAGAMENTO[plano.formaPagamento]}
              </span>
            </p>
          )}
          {plano.tipo === "premium" && plano.periodicidade && (
            <p>
              Periodicidade{" "}
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {ROTULO_PERIODICIDADE[plano.periodicidade]}
              </span>
            </p>
          )}
        </div>

        <div className="mt-5 flex flex-col gap-2">
          {plano.tipo === "free" ? (
            <button
              onClick={() => setModo("plano")}
              className="w-full rounded-lg bg-indigo-600 py-2.5 font-medium text-white transition-colors hover:bg-indigo-700"
            >
              Fazer upgrade para Premium
            </button>
          ) : (
            <>
              {plano.formaPagamento !== "cupom" && (
                <button
                  onClick={() => setModo("forma-pagamento")}
                  className="w-full rounded-lg border border-slate-300 py-2.5 font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Alterar forma de pagamento
                </button>
              )}
              <button
                onClick={() => setModo("plano")}
                className="w-full rounded-lg border border-slate-300 py-2.5 font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Alterar plano
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function FormularioFormaPagamento({
  uid,
  formaPagamentoAtual,
  periodicidadeAtual,
  onConcluido,
}: {
  uid: string;
  formaPagamentoAtual: FormaPagamentoPlano;
  periodicidadeAtual: Periodicidade;
  onConcluido: () => void;
}) {
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamentoPlano>(formaPagamentoAtual);
  const [periodicidade, setPeriodicidade] = useState<Periodicidade>(periodicidadeAtual);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  async function handleConfirmar() {
    setErro("");
    setEnviando(true);
    try {
      await atualizarFormaPagamentoPlano(
        uid,
        formaPagamento === "cartao" ? "cartao" : "pix",
        periodicidade
      );
      onConcluido();
    } catch {
      setErro("Não foi possível atualizar. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
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
            Anual · {formatarMoeda(PRECO_ANUAL)}
          </button>
        </div>
      </div>

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

      {erro && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}

      <button
        onClick={handleConfirmar}
        disabled={enviando}
        className="w-full rounded-lg bg-indigo-600 py-2.5 font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
      >
        {enviando ? "Salvando..." : "Salvar"}
      </button>
    </div>
  );
}
