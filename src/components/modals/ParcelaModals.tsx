"use client";

import { useEffect, useRef, useState } from "react";
import {
  atualizarCamposTodasParcelas,
  atualizarParcela,
  atualizarParcelaProvisao,
  buscarVencimentosPagos,
  excluirLancamento,
  excluirParcela,
  type EdicaoParcela,
} from "@/lib/parcelas";
import {
  atualizarParcelaRecorrenteApenasMes,
  atualizarRecorrenciaParcelaDesteMesEmDiante,
  atualizarRecorrenciaParcelaTudo,
  encerrarRecorrencia,
  excluirRecorrencia,
  excluirRecorrenciaApenasMes,
  excluirRecorrenciaDesteMesEmDiante,
} from "@/lib/recorrencias";
import { sincronizarValorReembolso, sincronizarValorReembolsoRecorrencia } from "@/lib/recebimentos";
import { notificarAtualizacaoRecorrencia, sincronizarValorCompartilhadoRecorrenciaMes } from "@/lib/compartilhamento";
import { formatarNumeroRenegociacao } from "@/lib/renegociacao";
import { GRUPO_FIXAS } from "@/lib/config";
import { formatarMesAno } from "@/lib/date";
import { CLASSE_BOTAO_PRIMARIO, CLASSE_INPUT } from "@/lib/estilos";
import Modal from "@/components/Modal";
import type { ConfigListas, Parcela } from "@/lib/types";

export function EditarParcelaModal({
  uid,
  parcela,
  config,
  onFechar,
  camposLimitados,
}: {
  uid: string;
  parcela: Parcela | null;
  config: ConfigListas;
  onFechar: () => void;
  camposLimitados?: boolean;
}) {
  return (
    <Modal aberto={!!parcela} onFechar={onFechar} titulo="Editar lançamento">
      {parcela && (
        <FormularioEdicaoParcela
          key={parcela.id}
          uid={uid}
          parcela={parcela}
          config={config}
          onFechar={onFechar}
          camposLimitados={camposLimitados}
        />
      )}
    </Modal>
  );
}

function FormularioEdicaoParcela({
  uid,
  parcela,
  config,
  onFechar,
  camposLimitados,
}: {
  uid: string;
  parcela: Parcela;
  config: ConfigListas;
  onFechar: () => void;
  camposLimitados?: boolean;
}) {
  const [dados, setDados] = useState<EdicaoParcela>({
    credor: parcela.credor,
    observacao: parcela.observacao,
    valorParcela: parcela.valorParcela,
    comp: parcela.comp,
    grupo: parcela.grupo,
    aplicacao: parcela.aplicacao,
    vencimento: parcela.vencimento,
  });
  const [salvando, setSalvando] = useState(false);
  const [confirmarEscopo, setConfirmarEscopo] = useState(false);
  const [confirmarParcelaTodas, setConfirmarParcelaTodas] = useState(false);
  const [confirmarEncerrar, setConfirmarEncerrar] = useState(false);
  const [encerrando, setEncerrando] = useState(false);
  const campoValorRef = useRef<HTMLInputElement>(null);

  const mostrarValorRestrito = parcela.provisao || !!parcela.recorrenciaId;

  useEffect(() => {
    if (mostrarValorRestrito) campoValorRef.current?.focus();
  }, [mostrarValorRestrito]);

  const gruposEditaveis = config.grupos.filter(
    (g) => (g !== GRUPO_FIXAS || g === dados.grupo) && (!config.gruposInativosDesde?.[g] || g === dados.grupo)
  );

  const ym = parcela.vencimento.slice(0, 7);

  async function salvarComEscopo(escopo: "mes" | "futuros" | "tudo") {
    setSalvando(true);
    try {
      const dadosRecorrencia = {
        credor: dados.credor,
        observacao: dados.observacao,
        valorParcela: dados.valorParcela,
        grupo: dados.grupo,
        aplicacao: dados.aplicacao,
      };
      if (escopo === "mes") {
        await atualizarParcelaRecorrenteApenasMes(uid, parcela, dadosRecorrencia);
      } else if (escopo === "futuros") {
        await atualizarRecorrenciaParcelaDesteMesEmDiante(uid, parcela.recorrenciaId!, ym, dadosRecorrencia);
      } else {
        await atualizarRecorrenciaParcelaTudo(uid, parcela.recorrenciaId!, dadosRecorrencia);
      }
      if (parcela.comp) {
        if (escopo === "mes") {
          await sincronizarValorReembolso(
            uid,
            parcela.lancamentoId,
            parcela.vencimento,
            parcela.comp,
            dados.valorParcela,
            { observacao: dados.observacao, grupoOrigem: dados.grupo, provisao: parcela.provisao }
          );
          await sincronizarValorCompartilhadoRecorrenciaMes(
            uid,
            parcela.recorrenciaId!,
            parcela.comp,
            dados.valorParcela,
            parcela.vencimento,
            config
          );
        } else if (escopo === "futuros") {
          await sincronizarValorReembolsoRecorrencia(
            uid,
            parcela.recorrenciaId!,
            parcela.comp,
            dados.valorParcela,
            ym
          );
          await notificarAtualizacaoRecorrencia(
            uid,
            parcela.recorrenciaId!,
            parcela.comp,
            dados.valorParcela,
            config,
            ym
          );
        } else {
          await sincronizarValorReembolsoRecorrencia(uid, parcela.recorrenciaId!, parcela.comp, dados.valorParcela);
          await notificarAtualizacaoRecorrencia(
            uid,
            parcela.recorrenciaId!,
            parcela.comp,
            dados.valorParcela,
            config,
            null
          );
        }
      }
      onFechar();
    } finally {
      setSalvando(false);
    }
  }

  function camposCompartilhadosAlterados(): string[] {
    const campos: string[] = [];
    if (dados.credor !== parcela.credor) campos.push("credor");
    if (dados.grupo !== parcela.grupo) campos.push("grupo");
    if (dados.aplicacao !== parcela.aplicacao) campos.push("aplicação");
    if ((dados.observacao ?? "") !== (parcela.observacao ?? "")) campos.push("observação");
    return campos;
  }

  function handleSalvar() {
    if (camposLimitados && parcela.recorrenciaId) {
      setConfirmarEscopo(true);
      return;
    }
    if (!parcela.recorrenciaId && parcela.parcelaTotal > 1 && camposCompartilhadosAlterados().length > 0) {
      setConfirmarParcelaTodas(true);
      return;
    }
    salvarDireto();
  }

  async function salvarDireto() {
    setSalvando(true);
    try {
      if (parcela.provisao) {
        await atualizarParcelaProvisao(uid, parcela, dados);
      } else {
        await atualizarParcela(uid, parcela.id, dados);
      }
      onFechar();
    } finally {
      setSalvando(false);
    }
  }

  async function salvarComParcelaTodas(todasParcelas: boolean) {
    setSalvando(true);
    try {
      if (parcela.provisao) {
        await atualizarParcelaProvisao(uid, parcela, dados);
      } else {
        await atualizarParcela(uid, parcela.id, dados);
      }
      if (todasParcelas) {
        await atualizarCamposTodasParcelas(uid, parcela.lancamentoId, {
          credor: dados.credor,
          grupo: dados.grupo,
          aplicacao: dados.aplicacao,
          observacao: dados.observacao,
        });
      }
      onFechar();
    } finally {
      setSalvando(false);
    }
  }

  async function handleEncerrarRecorrencia() {
    if (!parcela.recorrenciaId) return;
    setEncerrando(true);
    try {
      await encerrarRecorrencia(uid, parcela.recorrenciaId, ym);
      onFechar();
    } finally {
      setEncerrando(false);
    }
  }

  if (camposLimitados && parcela.renegociacaoId) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Este lançamento é proveniente da renegociação nº{" "}
          {formatarNumeroRenegociacao(parcela.renegociacaoNumero)}. Para alterá-lo, acesse a aba Renegociação.
        </p>
        <button onClick={onFechar} className={CLASSE_BOTAO_PRIMARIO}>
          Entendi
        </button>
      </div>
    );
  }

  if (confirmarEncerrar) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Isso vai parar a recorrência de &quot;{parcela.credor}&quot;. {formatarMesAno(ym)} continua valendo, mas
          ela deixa de aparecer nos meses seguintes.
        </p>
        <button
          onClick={handleEncerrarRecorrencia}
          disabled={encerrando}
          className="w-full rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {encerrando ? "Encerrando..." : "Sim, encerrar recorrência"}
        </button>
        <button
          onClick={() => setConfirmarEncerrar(false)}
          disabled={encerrando}
          className="text-center text-sm text-slate-500 dark:text-slate-400"
        >
          Cancelar
        </button>
      </div>
    );
  }

  if (confirmarParcelaTodas) {
    const campos = camposCompartilhadosAlterados();
    const listaCampos =
      campos.length <= 1
        ? campos.join("")
        : `${campos.slice(0, -1).join(", ")} e ${campos[campos.length - 1]}`;
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {`"${parcela.credor}" tem ${parcela.parcelaTotal} parcelas. Deseja aplicar a alteração de ${listaCampos} a todas elas?`}
        </p>
        <button
          onClick={() => salvarComParcelaTodas(false)}
          disabled={salvando}
          className="w-full rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          Apenas esta parcela
        </button>
        <button
          onClick={() => salvarComParcelaTodas(true)}
          disabled={salvando}
          className={CLASSE_BOTAO_PRIMARIO}
        >
          {salvando ? "Salvando..." : `Todas as ${parcela.parcelaTotal} parcelas`}
        </button>
        <button
          onClick={() => setConfirmarParcelaTodas(false)}
          disabled={salvando}
          className="text-center text-sm text-slate-500 dark:text-slate-400"
        >
          Cancelar
        </button>
      </div>
    );
  }

  if (confirmarEscopo) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          &quot;{parcela.credor}&quot; é uma conta fixa. Aplicar a alteração:
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
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Credor</label>
        <input
          type="text"
          value={dados.credor}
          onChange={(e) => setDados({ ...dados, credor: e.target.value })}
          className={CLASSE_INPUT}
        />
      </div>
      {mostrarValorRestrito && (
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Valor (R$)</label>
          <input
            ref={campoValorRef}
            type="number"
            step="0.01"
            value={dados.valorParcela}
            onChange={(e) => setDados({ ...dados, valorParcela: Number(e.target.value) })}
            className={CLASSE_INPUT}
          />
        </div>
      )}
      {!camposLimitados && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Valor (R$)</label>
            <input
              type="number"
              step="0.01"
              value={dados.valorParcela}
              onChange={(e) => setDados({ ...dados, valorParcela: Number(e.target.value) })}
              className={CLASSE_INPUT}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Vencimento</label>
            <input
              type="date"
              value={dados.vencimento}
              onChange={(e) => setDados({ ...dados, vencimento: e.target.value })}
              className={CLASSE_INPUT}
            />
          </div>
        </div>
      )}
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Grupo</label>
        <select
          value={dados.grupo}
          onChange={(e) => setDados({ ...dados, grupo: e.target.value })}
          className={CLASSE_INPUT}
        >
          {gruposEditaveis.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Aplicação</label>
        <select
          value={dados.aplicacao}
          onChange={(e) => setDados({ ...dados, aplicacao: e.target.value })}
          className={CLASSE_INPUT}
        >
          {config.aplicacoes.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Observação</label>
        <input
          type="text"
          value={dados.observacao ?? ""}
          onChange={(e) => setDados({ ...dados, observacao: e.target.value || null })}
          className={CLASSE_INPUT}
        />
      </div>
      <button onClick={handleSalvar} disabled={salvando} className={CLASSE_BOTAO_PRIMARIO}>
        {salvando ? "Salvando..." : "Salvar alterações"}
      </button>
      {camposLimitados && parcela.recorrenciaId && (
        <button
          onClick={() => setConfirmarEncerrar(true)}
          className="text-center text-sm text-red-600 hover:underline dark:text-red-400"
        >
          Encerrar recorrência
        </button>
      )}
    </div>
  );
}

export function ExcluirParcelaModal({
  uid,
  parcela,
  onFechar,
  restrito,
}: {
  uid: string;
  parcela: Parcela | null;
  onFechar: () => void;
  restrito?: boolean;
}) {
  const [excluindo, setExcluindo] = useState(false);
  const ym = parcela?.vencimento.slice(0, 7);
  const [estadoVerificacao, setEstadoVerificacao] = useState<{ id: string; vencimentosPagos: string[] }>({
    id: "",
    vencimentosPagos: [],
  });

  useEffect(() => {
    if (!restrito || !parcela) return;
    buscarVencimentosPagos(uid, {
      lancamentoId: parcela.lancamentoId,
      recorrenciaId: parcela.recorrenciaId ?? undefined,
    }).then((vencimentos) => {
      setEstadoVerificacao({ id: parcela.id, vencimentosPagos: vencimentos });
    });
  }, [restrito, uid, parcela]);

  const verificando = !!restrito && !!parcela && estadoVerificacao.id !== parcela.id;
  const vencimentosPagos = parcela && estadoVerificacao.id === parcela.id ? estadoVerificacao.vencimentosPagos : [];

  async function handleExcluirParcela() {
    if (!parcela) return;
    setExcluindo(true);
    try {
      await excluirParcela(uid, parcela.id, parcela.lancamentoId);
      onFechar();
    } finally {
      setExcluindo(false);
    }
  }

  async function handleExcluirLancamento() {
    if (!parcela) return;
    setExcluindo(true);
    try {
      await excluirLancamento(uid, parcela.lancamentoId);
      onFechar();
    } finally {
      setExcluindo(false);
    }
  }

  async function handleExcluirRecorrencia() {
    if (!parcela?.recorrenciaId) return;
    setExcluindo(true);
    try {
      await excluirRecorrencia(uid, parcela.recorrenciaId);
      onFechar();
    } finally {
      setExcluindo(false);
    }
  }

  async function handleExcluirRecorrenciaApenasMes() {
    if (!parcela?.recorrenciaId || !ym) return;
    setExcluindo(true);
    try {
      await excluirRecorrenciaApenasMes(uid, parcela.recorrenciaId, ym);
      onFechar();
    } finally {
      setExcluindo(false);
    }
  }

  async function handleExcluirRecorrenciaDesteMesEmDiante() {
    if (!parcela?.recorrenciaId || !ym) return;
    setExcluindo(true);
    try {
      await excluirRecorrenciaDesteMesEmDiante(uid, parcela.recorrenciaId, ym);
      onFechar();
    } finally {
      setExcluindo(false);
    }
  }

  const mesesPagos = [...new Set(vencimentosPagos.map((v) => v.slice(0, 7)))].sort();
  const bloqueadoPago = restrito && !parcela?.provisao && mesesPagos.length > 0;
  const bloqueadoRenegociacao = restrito && !!parcela?.renegociacaoId;

  return (
    <Modal aberto={!!parcela} onFechar={onFechar} titulo="Excluir lançamento">
      {parcela &&
        (bloqueadoRenegociacao ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Este lançamento é proveniente da renegociação nº{" "}
              {formatarNumeroRenegociacao(parcela.renegociacaoNumero)}. Para excluí-lo, acesse a aba Renegociação.
            </p>
            <button onClick={onFechar} className={CLASSE_BOTAO_PRIMARIO}>
              Entendi
            </button>
          </div>
        ) : restrito && verificando ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Verificando...</p>
        ) : bloqueadoPago ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {mesesPagos.length > 1
                ? `Este lançamento possui parcelas já marcadas como pagas em ${mesesPagos.map((m) => formatarMesAno(m)).join(", ")}. Para excluí-lo, acesse o(s) mês(es) correspondente(s) e desmarque o pagamento antes de tentar novamente.`
                : `Este lançamento já está marcado como pago. Para excluí-lo, vá até ${formatarMesAno(mesesPagos[0])} e desmarque o pagamento antes de tentar novamente.`}
            </p>
            <button onClick={onFechar} className={CLASSE_BOTAO_PRIMARIO}>
              Entendi
            </button>
          </div>
        ) : restrito && parcela.recorrenciaId ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              &quot;{parcela.credor}&quot; é uma conta fixa. O que deseja excluir?
            </p>
            <button
              onClick={handleExcluirRecorrenciaApenasMes}
              disabled={excluindo || !ym}
              className="w-full rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Apenas este mês
            </button>
            <button
              onClick={handleExcluirRecorrenciaDesteMesEmDiante}
              disabled={excluindo || !ym}
              className="w-full rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Este mês e os futuros
            </button>
            <button
              onClick={handleExcluirRecorrencia}
              disabled={excluindo}
              className="w-full rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {excluindo ? "Excluindo..." : "Todos (desde o início)"}
            </button>
            <button onClick={onFechar} className="text-center text-sm text-slate-500 dark:text-slate-400">
              Cancelar
            </button>
          </div>
        ) : restrito && parcela.parcelaTotal > 1 ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              &quot;{parcela.credor}&quot; faz parte de um lançamento com {parcela.parcelaTotal} parcelas. Todas
              serão excluídas.
            </p>
            <button
              onClick={handleExcluirLancamento}
              disabled={excluindo}
              className="w-full rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {excluindo ? "Excluindo..." : `Excluir lançamento inteiro (${parcela.parcelaTotal} parcelas)`}
            </button>
            <button onClick={onFechar} className="text-center text-sm text-slate-500 dark:text-slate-400">
              Cancelar
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {parcela.parcelaTotal > 1
                ? `"${parcela.credor}" faz parte de um lançamento com ${parcela.parcelaTotal} parcelas. O que você quer excluir?`
                : `Tem certeza que quer excluir "${parcela.credor}"?`}
            </p>
            {parcela.parcelaTotal > 1 && (
              <button
                onClick={handleExcluirParcela}
                disabled={excluindo}
                className="w-full rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Excluir apenas esta parcela
              </button>
            )}
            <button
              onClick={handleExcluirLancamento}
              disabled={excluindo}
              className="w-full rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {excluindo
                ? "Excluindo..."
                : parcela.parcelaTotal > 1
                  ? `Excluir lançamento inteiro (${parcela.parcelaTotal} parcelas)`
                  : "Excluir"}
            </button>
            <button onClick={onFechar} className="text-center text-sm text-slate-500 dark:text-slate-400">
              Cancelar
            </button>
          </div>
        ))}
    </Modal>
  );
}
