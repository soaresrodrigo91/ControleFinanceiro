"use client";

import { useEffect, useMemo, useState } from "react";
import { assinarParcelasDoMes } from "@/lib/parcelas";
import { assinarRecorrencias, mesclarComRecorrencias } from "@/lib/recorrencias";
import {
  assinarRenegociacoes,
  calcularValorRenegociacao,
  desfazerRenegociacao,
  formatarNumeroRenegociacao,
  renegociar,
} from "@/lib/renegociacao";
import { useMesAtual } from "@/contexts/MesAtualContext";
import { formatarMesAno, formatarMoeda } from "@/lib/date";
import FiltroMultiSelect from "@/components/FiltroMultiSelect";
import SeletorMesAno from "@/components/SeletorMesAno";
import Modal from "@/components/Modal";
import FormularioLancamento from "@/components/FormularioLancamento";
import { CLASSE_BOTAO_PRIMARIO } from "@/lib/estilos";
import type { ConfigListas, EscopoRenegociacao, NovoLancamento, Parcela, Recorrencia, Renegociacao } from "@/lib/types";

function formatarEscopo(escopo: EscopoRenegociacao): string {
  return escopo === "mes" ? "Apenas o mês" : "Atual e futuros";
}

export default function RenegociacaoParcelas({
  uid,
  config,
  parcelasExistentes,
  stickyTop = 0,
}: {
  uid: string;
  config: ConfigListas;
  parcelasExistentes: Parcela[];
  stickyTop?: number;
}) {
  const { ym, definirYm } = useMesAtual();
  const [recorrencias, setRecorrencias] = useState<Recorrencia[]>([]);
  const [estadoMes, setEstadoMes] = useState<{ ym: string; parcelasReais: Parcela[] }>({
    ym: "",
    parcelasReais: [],
  });
  const [renegociacoes, setRenegociacoes] = useState<Renegociacao[]>([]);

  const [filtroGrupo, setFiltroGrupo] = useState<Record<string, boolean>>({});
  const [avisoSelecaoUnica, setAvisoSelecaoUnica] = useState(false);
  const [mostrarEscopo, setMostrarEscopo] = useState(false);
  const [modoRenegociacao, setModoRenegociacao] = useState<{ grupo: string; escopo: EscopoRenegociacao } | null>(
    null
  );

  const [excluindoRenegociacao, setExcluindoRenegociacao] = useState<Renegociacao | null>(null);
  const [processandoExclusao, setProcessandoExclusao] = useState(false);
  const [erroExclusao, setErroExclusao] = useState("");

  const [valorRenegociacao, setValorRenegociacao] = useState<number | null>(null);

  useEffect(() => {
    if (!modoRenegociacao) return;
    let cancelado = false;
    calcularValorRenegociacao(uid, {
      grupo: modoRenegociacao.grupo,
      ym,
      escopo: modoRenegociacao.escopo,
    }).then((valor) => {
      if (!cancelado) setValorRenegociacao(valor);
    });
    return () => {
      cancelado = true;
    };
  }, [uid, ym, modoRenegociacao]);

  useEffect(() => {
    return assinarRecorrencias(uid, "pagar", setRecorrencias);
  }, [uid]);

  useEffect(() => {
    return assinarParcelasDoMes(uid, ym, (dados) => {
      setEstadoMes({ ym, parcelasReais: dados });
    });
  }, [uid, ym]);

  useEffect(() => {
    return assinarRenegociacoes(uid, setRenegociacoes);
  }, [uid]);

  const carregando = estadoMes.ym !== ym;

  const todasParcelas = useMemo(
    () => (carregando ? [] : mesclarComRecorrencias(estadoMes.parcelasReais, recorrencias, ym)),
    [carregando, estadoMes, recorrencias, ym]
  );

  const grupoSelecionado = Object.keys(filtroGrupo).find((g) => filtroGrupo[g]);

  const parcelasDoGrupo = useMemo(
    () => (grupoSelecionado ? todasParcelas.filter((p) => p.grupo === grupoSelecionado) : []),
    [todasParcelas, grupoSelecionado]
  );
  const total = parcelasDoGrupo.reduce((s, p) => s + p.valorParcela, 0);

  function handleAlternarGrupo(item: string, visivel: boolean) {
    if (visivel) {
      if (grupoSelecionado && grupoSelecionado !== item) {
        setAvisoSelecaoUnica(true);
        return;
      }
      setAvisoSelecaoUnica(false);
      setFiltroGrupo({ [item]: true });
    } else {
      setAvisoSelecaoUnica(false);
      setFiltroGrupo({});
    }
  }

  function escolherEscopo(escopo: EscopoRenegociacao) {
    if (!grupoSelecionado) return;
    setMostrarEscopo(false);
    setModoRenegociacao({ grupo: grupoSelecionado, escopo });
  }

  async function handleSalvarRenegociacao({ dados }: { contaFixa: boolean; dados: NovoLancamento }) {
    if (!modoRenegociacao) return;
    await renegociar(uid, {
      grupo: modoRenegociacao.grupo,
      ym,
      escopo: modoRenegociacao.escopo,
      novoLancamento: dados,
    });
    setModoRenegociacao(null);
    setFiltroGrupo({});
  }

  const idsSubstituidos = useMemo(
    () =>
      new Set(
        renegociacoes.filter((r) => r.substituiRenegociacaoId).map((r) => r.substituiRenegociacaoId as string)
      ),
    [renegociacoes]
  );

  async function handleConfirmarExclusao() {
    if (!excluindoRenegociacao) return;
    setProcessandoExclusao(true);
    setErroExclusao("");
    try {
      await desfazerRenegociacao(uid, excluindoRenegociacao.id);
      setExcluindoRenegociacao(null);
    } catch {
      setErroExclusao("Não foi possível desfazer esta renegociação. Tente novamente.");
    } finally {
      setProcessandoExclusao(false);
    }
  }

  if (modoRenegociacao) {
    return (
      <div>
        <div className="mx-auto mb-4 max-w-md rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-200">
          Valor sendo renegociado de &quot;{modoRenegociacao.grupo}&quot; (
          {formatarEscopo(modoRenegociacao.escopo).toLowerCase()}):{" "}
          <span className="font-semibold">
            {valorRenegociacao === null ? "calculando..." : formatarMoeda(valorRenegociacao)}
          </span>
        </div>
        <FormularioLancamento
          config={config}
          parcelasExistentes={parcelasExistentes}
          grupoFixo={modoRenegociacao.grupo}
          desabilitarContaFixaEProvisao
          ocultarDataCompra
          pularVerificacaoDuplicata
          textoBotaoSalvar="Salvar Renegociação"
          onSalvar={handleSalvarRenegociacao}
          onCancelar={() => setModoRenegociacao(null)}
        />
      </div>
    );
  }

  return (
    <div>
      <div
        className="sticky z-10 mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm print:static dark:border-slate-700 dark:bg-slate-800"
        style={{ top: stickyTop }}
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-3">
            {config.grupos.length > 0 && (
              <FiltroMultiSelect
                rotulo="Forma de pagamento"
                opcoes={config.grupos}
                filtro={filtroGrupo}
                onAlternar={handleAlternarGrupo}
                modoInclusao
                ocultarAcoesEmMassa
              />
            )}
            {avisoSelecaoUnica && (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                A renegociação só pode ser feita para uma forma de pagamento por vez.
              </p>
            )}
          </div>

          <SeletorMesAno ym={ym} onMudar={definirYm} />
        </div>
      </div>

      {carregando ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Carregando...</p>
      ) : !grupoSelecionado ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Selecione uma forma de pagamento para renegociar.
        </p>
      ) : (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Total de &quot;{grupoSelecionado}&quot; em {formatarMesAno(ym)}:{" "}
            <span className="font-semibold text-slate-900 dark:text-slate-100">{formatarMoeda(total)}</span>
          </p>
          <button
            onClick={() => setMostrarEscopo(true)}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
          >
            Renegociar
          </button>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Renegociações</h2>
        </div>
        {renegociacoes.length === 0 ? (
          <p className="p-4 text-sm text-slate-500 dark:text-slate-400">Nenhuma renegociação feita ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  <th className="py-2 pl-4">Número</th>
                  <th className="py-2 pr-2">Forma de pagamento</th>
                  <th className="py-2 pr-2">Escopo</th>
                  <th className="py-2 pr-2">Mês de referência</th>
                  <th className="w-24 py-2 pr-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {renegociacoes.map((r) => {
                  const substituida = idsSubstituidos.has(r.id);
                  return (
                    <tr key={r.id}>
                      <td className="py-2.5 pl-4 font-medium text-slate-900 dark:text-slate-100">
                        {formatarNumeroRenegociacao(r.numero)}
                      </td>
                      <td className="py-2.5 pr-2 text-slate-600 dark:text-slate-400">{r.grupo}</td>
                      <td className="py-2.5 pr-2 text-slate-600 dark:text-slate-400">{formatarEscopo(r.escopo)}</td>
                      <td className="py-2.5 pr-2 text-slate-600 dark:text-slate-400">{formatarMesAno(r.ym)}</td>
                      <td className="py-2.5 pr-4 text-right">
                        <button
                          onClick={() => setExcluindoRenegociacao(r)}
                          disabled={substituida}
                          title={
                            substituida
                              ? "Esta renegociação foi substituída por outra mais recente — desfaça a mais recente primeiro."
                              : undefined
                          }
                          className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-red-400 dark:hover:bg-red-950"
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal aberto={mostrarEscopo} onFechar={() => setMostrarEscopo(false)} titulo="Renegociar">
        <div className="flex flex-col gap-2">
          <p className="mb-1 text-sm text-slate-600 dark:text-slate-300">
            Como deseja renegociar os lançamentos de &quot;{grupoSelecionado}&quot;?
          </p>
          <button
            onClick={() => escolherEscopo("mes")}
            className="w-full rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Renegociar apenas o mês atual
          </button>
          <button onClick={() => escolherEscopo("futuros")} className={CLASSE_BOTAO_PRIMARIO}>
            Renegociar valores atuais e futuros
          </button>
          <button
            onClick={() => setMostrarEscopo(false)}
            className="text-center text-sm text-slate-500 dark:text-slate-400"
          >
            Cancelar
          </button>
        </div>
      </Modal>

      <Modal
        aberto={!!excluindoRenegociacao}
        onFechar={() => setExcluindoRenegociacao(null)}
        titulo="Excluir renegociação"
      >
        {excluindoRenegociacao && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              As parcelas geradas pela renegociação nº {formatarNumeroRenegociacao(excluindoRenegociacao.numero)} serão
              excluídas e os lançamentos anteriores serão retornados.
            </p>
            {erroExclusao && <p className="text-sm text-red-600 dark:text-red-400">{erroExclusao}</p>}
            <button
              onClick={handleConfirmarExclusao}
              disabled={processandoExclusao}
              className="w-full rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {processandoExclusao ? "Excluindo..." : "Excluir"}
            </button>
            <button
              onClick={() => setExcluindoRenegociacao(null)}
              disabled={processandoExclusao}
              className="text-center text-sm text-slate-500 dark:text-slate-400"
            >
              Cancelar
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
