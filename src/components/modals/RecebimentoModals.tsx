"use client";

import { useState } from "react";
import {
  atualizarRecebimento,
  atualizarRecebimentoRecorrenteApenasMes,
  atualizarRecorrenciaRecebimentoDesteMesEmDiante,
  atualizarRecorrenciaRecebimentoTudo,
  excluirLancamentoRecebimento,
  excluirRecebimento,
  excluirRecebimentoRecorrenciaApenasMes,
  excluirRecebimentoRecorrenciaDesteMesEmDiante,
  excluirRecebimentoRecorrenciaTudo,
} from "@/lib/recebimentos";
import { formatarNumeroRenegociacao } from "@/lib/renegociacao";
import { CLASSE_BOTAO_PRIMARIO, CLASSE_INPUT } from "@/lib/estilos";
import Modal from "@/components/Modal";
import type { Recebimento } from "@/lib/types";

export function EditarRecebimentoModal({
  uid,
  recebimento,
  onFechar,
  camposLimitados,
}: {
  uid: string;
  recebimento: Recebimento | null;
  onFechar: () => void;
  camposLimitados?: boolean;
}) {
  return (
    <Modal aberto={!!recebimento} onFechar={onFechar} titulo="Editar recebimento">
      {recebimento && (
        <FormularioEdicaoRecebimento
          key={recebimento.id}
          uid={uid}
          recebimento={recebimento}
          onFechar={onFechar}
          camposLimitados={camposLimitados}
        />
      )}
    </Modal>
  );
}

function FormularioEdicaoRecebimento({
  uid,
  recebimento,
  onFechar,
  camposLimitados,
}: {
  uid: string;
  recebimento: Recebimento;
  onFechar: () => void;
  camposLimitados?: boolean;
}) {
  const [origem, setOrigem] = useState(recebimento.origem);
  const [valorTexto, setValorTexto] = useState(recebimento.valor.toFixed(2).replace(".", ","));
  const [data, setData] = useState(recebimento.recebimento);
  const [observacao, setObservacao] = useState(recebimento.observacao);
  const [salvando, setSalvando] = useState(false);
  const [confirmarEscopo, setConfirmarEscopo] = useState(false);

  const ym = recebimento.recebimento.slice(0, 7);

  async function salvarDireto() {
    const valor = Number(valorTexto.replace(",", "."));
    setSalvando(true);
    try {
      await atualizarRecebimento(uid, recebimento.id, { origem, valor, recebimento: data, observacao });
      onFechar();
    } finally {
      setSalvando(false);
    }
  }

  async function salvarComEscopo(escopo: "mes" | "futuros" | "tudo") {
    const valor = Number(valorTexto.replace(",", "."));
    setSalvando(true);
    try {
      const dadosRecorrencia = { origem, observacao, valor };
      if (escopo === "mes") {
        await atualizarRecebimentoRecorrenteApenasMes(uid, recebimento, dadosRecorrencia);
      } else if (escopo === "futuros") {
        await atualizarRecorrenciaRecebimentoDesteMesEmDiante(uid, recebimento.recorrenciaId!, ym, dadosRecorrencia);
      } else {
        await atualizarRecorrenciaRecebimentoTudo(uid, recebimento.recorrenciaId!, dadosRecorrencia);
      }
      onFechar();
    } finally {
      setSalvando(false);
    }
  }

  function handleSalvar() {
    if (camposLimitados && recebimento.recorrenciaId) {
      setConfirmarEscopo(true);
      return;
    }
    salvarDireto();
  }

  if (camposLimitados && recebimento.renegociacaoId) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Este recebimento é proveniente da renegociação nº{" "}
          {formatarNumeroRenegociacao(recebimento.renegociacaoNumero)}. Para alterá-lo, acesse a aba Renegociação.
        </p>
        <button onClick={onFechar} className={CLASSE_BOTAO_PRIMARIO}>
          Entendi
        </button>
      </div>
    );
  }

  if (camposLimitados && recebimento.origemComp) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Este lançamento é proveniente de um reembolso do Contas a Pagar. Para alterá-lo, acesse o lançamento
          correspondente em Contas a Pagar.
        </p>
        <button onClick={onFechar} className={CLASSE_BOTAO_PRIMARIO}>
          Entendi
        </button>
      </div>
    );
  }

  if (confirmarEscopo) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          &quot;{recebimento.origem}&quot; é um recebimento fixo. Aplicar a alteração:
        </p>
        <button
          onClick={() => salvarComEscopo("mes")}
          disabled={salvando}
          className="w-full rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          Apenas este mês
        </button>
        <button
          onClick={() => salvarComEscopo("futuros")}
          disabled={salvando}
          className="w-full rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          Este mês e os futuros
        </button>
        <button onClick={() => salvarComEscopo("tudo")} disabled={salvando} className={CLASSE_BOTAO_PRIMARIO}>
          {salvando ? "Salvando..." : "Todos (desde o início)"}
        </button>
        <button
          onClick={() => setConfirmarEscopo(false)}
          disabled={salvando}
          className="text-center text-sm text-slate-500 dark:text-slate-400"
        >
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Origem</label>
        <input
          type="text"
          value={origem}
          onChange={(e) => setOrigem(e.target.value)}
          className={CLASSE_INPUT}
        />
      </div>
      {camposLimitados ? (
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Valor (R$)</label>
          <input
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            value={valorTexto}
            onChange={(e) => setValorTexto(e.target.value)}
            className={CLASSE_INPUT}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Valor (R$)</label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={valorTexto}
              onChange={(e) => setValorTexto(e.target.value)}
              className={CLASSE_INPUT}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Data</label>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className={CLASSE_INPUT}
            />
          </div>
        </div>
      )}
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Observação</label>
        <input
          type="text"
          value={observacao ?? ""}
          onChange={(e) => setObservacao(e.target.value || null)}
          className={CLASSE_INPUT}
        />
      </div>
      <button onClick={handleSalvar} disabled={salvando} className={CLASSE_BOTAO_PRIMARIO}>
        {salvando ? "Salvando..." : "Salvar alterações"}
      </button>
    </div>
  );
}

export function ExcluirRecebimentoModal({
  uid,
  recebimento,
  onFechar,
  restrito,
}: {
  uid: string;
  recebimento: Recebimento | null;
  onFechar: () => void;
  restrito?: boolean;
}) {
  return (
    <Modal aberto={!!recebimento} onFechar={onFechar} titulo="Excluir recebimento">
      {recebimento && (
        <ConteudoExclusaoRecebimento
          key={recebimento.id}
          uid={uid}
          recebimento={recebimento}
          onFechar={onFechar}
          restrito={restrito}
        />
      )}
    </Modal>
  );
}

function ConteudoExclusaoRecebimento({
  uid,
  recebimento,
  onFechar,
  restrito,
}: {
  uid: string;
  recebimento: Recebimento;
  onFechar: () => void;
  restrito?: boolean;
}) {
  const [excluindo, setExcluindo] = useState(false);
  const [confirmarTudo, setConfirmarTudo] = useState(false);
  const bloqueadoRenegociacao = restrito && !!recebimento?.renegociacaoId;
  const bloqueadoOrigemComp = restrito && recebimento?.origemComp;
  const ym = recebimento?.recebimento.slice(0, 7);

  async function handleExcluirRecorrenciaApenasMes() {
    if (!recebimento?.recorrenciaId || !ym) return;
    setExcluindo(true);
    try {
      await excluirRecebimentoRecorrenciaApenasMes(uid, recebimento.recorrenciaId, ym);
      onFechar();
    } finally {
      setExcluindo(false);
    }
  }

  async function handleExcluirRecorrenciaDesteMesEmDiante() {
    if (!recebimento?.recorrenciaId || !ym) return;
    setExcluindo(true);
    try {
      await excluirRecebimentoRecorrenciaDesteMesEmDiante(uid, recebimento.recorrenciaId, ym);
      onFechar();
    } finally {
      setExcluindo(false);
    }
  }

  async function handleExcluirRecorrenciaTudo() {
    if (!recebimento?.recorrenciaId) return;
    setExcluindo(true);
    try {
      await excluirRecebimentoRecorrenciaTudo(uid, recebimento.recorrenciaId);
      onFechar();
    } finally {
      setExcluindo(false);
    }
  }

  if (confirmarTudo) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Isso vai excluir <strong>todos</strong> os recebimentos de &quot;{recebimento.origem}&quot; desde o
          início, incluindo os já recebidos no passado. Essa ação não pode ser desfeita.
        </p>
        <button
          onClick={handleExcluirRecorrenciaTudo}
          disabled={excluindo}
          className="w-full rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {excluindo ? "Excluindo..." : "Sim, excluir tudo"}
        </button>
        <button
          onClick={() => setConfirmarTudo(false)}
          disabled={excluindo}
          className="text-center text-sm text-slate-500 dark:text-slate-400"
        >
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <>
      {bloqueadoRenegociacao ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Este recebimento é proveniente da renegociação nº{" "}
            {formatarNumeroRenegociacao(recebimento.renegociacaoNumero)}. Para excluí-lo, acesse a aba
            Renegociação.
          </p>
          <button onClick={onFechar} className={CLASSE_BOTAO_PRIMARIO}>
            Entendi
          </button>
        </div>
      ) : bloqueadoOrigemComp ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Este lançamento é proveniente de um reembolso do Contas a Pagar. Para excluí-lo, acesse o lançamento
            correspondente em Contas a Pagar.
          </p>
          <button onClick={onFechar} className={CLASSE_BOTAO_PRIMARIO}>
            Entendi
          </button>
        </div>
      ) : restrito && recebimento.recorrenciaId ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            &quot;{recebimento.origem}&quot; é um recebimento fixo. O que deseja excluir?
          </p>
          <button
            onClick={handleExcluirRecorrenciaApenasMes}
            disabled={excluindo}
            className="w-full rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Apenas este mês
          </button>
          <button
            onClick={handleExcluirRecorrenciaDesteMesEmDiante}
            disabled={excluindo}
            className="w-full rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Este mês e os futuros
          </button>
          <button
            onClick={() => setConfirmarTudo(true)}
            disabled={excluindo}
            className="w-full rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            Todos (desde o início)
          </button>
          <button onClick={onFechar} className="text-center text-sm text-slate-500 dark:text-slate-400">
            Cancelar
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {recebimento.qtdParcelas && recebimento.qtdParcelas > 1
              ? `"${recebimento.origem}" faz parte de um lançamento com ${recebimento.qtdParcelas} parcelas. O que você quer excluir?`
              : `Tem certeza que quer excluir "${recebimento.origem}"?`}
          </p>
          {recebimento.qtdParcelas != null && recebimento.qtdParcelas > 1 && (
            <button
              onClick={async () => {
                await excluirRecebimento(uid, recebimento.id);
                onFechar();
              }}
              className="w-full rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Excluir apenas esta parcela
            </button>
          )}
          <button
            onClick={async () => {
              if (recebimento.qtdParcelas && recebimento.qtdParcelas > 1 && recebimento.lancamentoId) {
                await excluirLancamentoRecebimento(uid, recebimento.lancamentoId);
              } else {
                await excluirRecebimento(uid, recebimento.id);
              }
              onFechar();
            }}
            className="w-full rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            {recebimento.qtdParcelas && recebimento.qtdParcelas > 1
              ? `Excluir lançamento inteiro (${recebimento.qtdParcelas} parcelas)`
              : "Excluir"}
          </button>
          <button onClick={onFechar} className="text-center text-sm text-slate-500 dark:text-slate-400">
            Cancelar
          </button>
        </div>
      )}
    </>
  );
}
