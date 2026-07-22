"use client";

import { useEffect, useMemo, useState } from "react";
import { assinarParcelasDoMes, marcarPago, materializarPagamentoRecorrencia } from "@/lib/parcelas";
import { assinarConfigListas, CONFIG_PADRAO } from "@/lib/config";
import { assinarRecorrencias, mesclarComRecorrencias } from "@/lib/recorrencias";
import { useMesAtual } from "@/contexts/MesAtualContext";
import { formatarDataBR, formatarMoeda } from "@/lib/date";
import { EditarParcelaModal, ExcluirParcelaModal } from "@/components/modals/ParcelaModals";
import { IconEditar, IconExcluir } from "@/components/action-icons";
import FiltroMultiSelect from "@/components/FiltroMultiSelect";
import SeletorMesAno from "@/components/SeletorMesAno";
import CampoCredor from "@/components/CampoCredor";
import CampoValorMonetario, { paraNumero } from "@/components/CampoValorMonetario";
import Paginacao from "@/components/Paginacao";
import ColunaOrdenavel from "@/components/ColunaOrdenavel";
import Modal from "@/components/Modal";
import { CLASSE_BOTAO_PRIMARIO } from "@/lib/estilos";
import { paginar, totalDePaginas } from "@/lib/paginacao";
import { ordenarParcelas, proximaOrdenacao, type OrdenacaoParcelas } from "@/lib/ordenacaoParcelas";
import type { ConfigListas, Parcela, Recorrencia } from "@/lib/types";

const SEM_COMP = "(sem reembolso)";

function passaFiltroInclusivo(filtro: Record<string, boolean>, valor: string): boolean {
  const algumSelecionado = Object.values(filtro).some(Boolean);
  if (!algumSelecionado) return true;
  return filtro[valor] === true;
}

export default function BuscaParcelas({
  uid,
  stickyTop = 0,
  grupoInicial,
}: {
  uid: string;
  stickyTop?: number;
  grupoInicial?: string;
}) {
  const [config, setConfig] = useState<ConfigListas>(CONFIG_PADRAO);
  const [recorrencias, setRecorrencias] = useState<Recorrencia[]>([]);
  const { ym, definirYm: setYm } = useMesAtual();
  const [estadoMes, setEstadoMes] = useState<{ ym: string; parcelasReais: Parcela[] }>({
    ym: "",
    parcelasReais: [],
  });

  const [texto, setTexto] = useState("");
  const [filtroGrupos, setFiltroGrupos] = useState<Record<string, boolean>>(() =>
    grupoInicial ? { [grupoInicial]: true } : {}
  );
  const [filtroAplicacoes, setFiltroAplicacoes] = useState<Record<string, boolean>>({});
  const [filtroComp, setFiltroComp] = useState<Record<string, boolean>>({});
  const [filtroProvisao, setFiltroProvisao] = useState(false);
  const [filtroValor, setFiltroValor] = useState("");

  const [ordenacao, setOrdenacao] = useState<OrdenacaoParcelas>(null);

  const [parcelaEditando, setParcelaEditando] = useState<Parcela | null>(null);
  const [parcelaExcluindo, setParcelaExcluindo] = useState<Parcela | null>(null);

  useEffect(() => {
    return assinarConfigListas(uid, setConfig);
  }, [uid]);

  useEffect(() => {
    return assinarRecorrencias(uid, "pagar", setRecorrencias);
  }, [uid]);

  useEffect(() => {
    return assinarParcelasDoMes(uid, ym, (dados) => {
      setEstadoMes({ ym, parcelasReais: dados });
    });
  }, [uid, ym]);

  const carregando = estadoMes.ym !== ym;

  const todasParcelas = useMemo(
    () => (carregando ? [] : mesclarComRecorrencias(estadoMes.parcelasReais, recorrencias, ym)),
    [carregando, estadoMes, recorrencias, ym]
  );

  const recorrenciaPorId = useMemo(
    () => new Map(recorrencias.map((r) => [r.id, r])),
    [recorrencias]
  );

  const credoresDoMes = useMemo(
    () => [...new Set(todasParcelas.map((p) => p.credor))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [todasParcelas]
  );

  function handleTogglePago(p: Parcela, pago: boolean) {
    if (p.virtual && p.recorrenciaId) {
      if (pago) materializarPagamentoRecorrencia(uid, recorrenciaPorId.get(p.recorrenciaId)!, ym);
      return;
    }
    marcarPago(uid, p, pago);
  }

  const textoNormalizado = texto.trim().toLowerCase();

  const algumFormaMarcada = Object.values(filtroGrupos).some(Boolean);

  const valorFiltroNum = filtroValor ? paraNumero(filtroValor) : null;
  const valorFiltroAtivo = valorFiltroNum !== null && !Number.isNaN(valorFiltroNum);

  const parcelasFiltradas = useMemo(() => {
    if (filtroProvisao) {
      return todasParcelas.filter((p) => {
        if (!p.provisao) return false;
        if (textoNormalizado && !p.credor.toLowerCase().includes(textoNormalizado)) return false;
        if (!passaFiltroInclusivo(filtroGrupos, p.grupo)) return false;
        if (valorFiltroAtivo && Math.abs(p.valorParcela - (valorFiltroNum as number)) >= 0.005) return false;
        return true;
      });
    }
    if (!algumFormaMarcada) return [];
    return todasParcelas.filter((p) => {
      if (textoNormalizado && !p.credor.toLowerCase().includes(textoNormalizado)) return false;
      if (!passaFiltroInclusivo(filtroGrupos, p.grupo)) return false;
      if (!passaFiltroInclusivo(filtroAplicacoes, p.aplicacao)) return false;
      if (!passaFiltroInclusivo(filtroComp, p.comp ?? SEM_COMP)) return false;
      if (valorFiltroAtivo && Math.abs(p.valorParcela - (valorFiltroNum as number)) >= 0.005) return false;
      return true;
    });
  }, [
    todasParcelas,
    textoNormalizado,
    filtroGrupos,
    filtroAplicacoes,
    filtroComp,
    algumFormaMarcada,
    filtroProvisao,
    valorFiltroNum,
    valorFiltroAtivo,
  ]);

  const total = parcelasFiltradas.reduce((s, p) => s + p.valorParcela, 0);

  const parcelasOrdenadas = useMemo(
    () => ordenarParcelas(parcelasFiltradas, ordenacao),
    [parcelasFiltradas, ordenacao]
  );

  function handleClicarColuna(campo: Parameters<typeof proximaOrdenacao>[1]) {
    setOrdenacao((atual) => proximaOrdenacao(atual, campo));
  }

  const [paginaAtual, setPaginaAtual] = useState(1);
  const chavePaginacao = `${ym}|${textoNormalizado}|${JSON.stringify(filtroGrupos)}|${JSON.stringify(filtroAplicacoes)}|${JSON.stringify(filtroComp)}|${filtroProvisao}|${filtroValor}`;
  const [chavePaginacaoAnterior, setChavePaginacaoAnterior] = useState(chavePaginacao);
  if (chavePaginacao !== chavePaginacaoAnterior) {
    setChavePaginacaoAnterior(chavePaginacao);
    setPaginaAtual(1);
  }
  const [ymOrdenacaoAnterior, setYmOrdenacaoAnterior] = useState(ym);
  if (ym !== ymOrdenacaoAnterior) {
    setYmOrdenacaoAnterior(ym);
    setOrdenacao(null);
  }
  const totalPaginas = totalDePaginas(parcelasOrdenadas.length, config.itensPorPagina);
  const parcelasPaginadas = useMemo(
    () => paginar(parcelasOrdenadas, config.itensPorPagina, paginaAtual),
    [parcelasOrdenadas, config.itensPorPagina, paginaAtual]
  );

  function handleTogglePagoTodos(pago: boolean) {
    parcelasPaginadas.forEach((p) => {
      if (p.pago !== pago) handleTogglePago(p, pago);
    });
  }

  function handleTogglePagoTodasAsPaginas(pago: boolean) {
    parcelasFiltradas.forEach((p) => {
      if (p.pago !== pago) handleTogglePago(p, pago);
    });
  }

  const [confirmacaoTodasAsPaginas, setConfirmacaoTodasAsPaginas] = useState<boolean | null>(null);

  const todosPagos = parcelasPaginadas.length > 0 && parcelasPaginadas.every((p) => p.pago);
  const todosPagosTodasAsPaginas = parcelasFiltradas.length > 0 && parcelasFiltradas.every((p) => p.pago);

  return (
    <div>
      <div
        className="sticky z-10 mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm print:static dark:border-slate-700 dark:bg-slate-800"
        style={{ top: stickyTop }}
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1">
              <CampoCredor
                label="Credor"
                value={texto}
                onChange={setTexto}
                opcoes={credoresDoMes}
                ativo={config.sugestaoCredor}
                placeholder="Buscar por nome..."
              />
            </div>

            {config.grupos.length > 0 && (
              <FiltroMultiSelect
                rotulo="Forma de pagamento"
                opcoes={config.grupos}
                filtro={filtroGrupos}
                onAlternar={(item, visivel) => setFiltroGrupos((atual) => ({ ...atual, [item]: visivel }))}
                modoInclusao
              />
            )}
            {algumFormaMarcada && !filtroProvisao && (
              <>
                {config.aplicacoes.length > 0 && (
                  <FiltroMultiSelect
                    rotulo="Aplicação"
                    opcoes={config.aplicacoes}
                    filtro={filtroAplicacoes}
                    onAlternar={(item, visivel) => setFiltroAplicacoes((atual) => ({ ...atual, [item]: visivel }))}
                    modoInclusao
                  />
                )}
                <FiltroMultiSelect
                  rotulo="Reembolso"
                  opcoes={[...config.comp.map((c) => c.nome), SEM_COMP]}
                  filtro={filtroComp}
                  onAlternar={(item, visivel) => setFiltroComp((atual) => ({ ...atual, [item]: visivel }))}
                  modoInclusao
                />
              </>
            )}
            <label className="flex h-[42px] cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm dark:border-slate-600">
              <input
                type="checkbox"
                checked={filtroProvisao}
                onChange={(e) => setFiltroProvisao(e.target.checked)}
                className="h-4 w-4 accent-amber-500"
              />
              Provisão
            </label>
            <div className="flex h-[42px] items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm dark:border-slate-600">
              <span className="text-slate-500 dark:text-slate-400">Valor</span>
              <CampoValorMonetario
                value={filtroValor}
                onChange={setFiltroValor}
                className="w-20 border-none bg-transparent p-0 text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>
          </div>

          <SeletorMesAno ym={ym} onMudar={setYm} />
        </div>
      </div>

      {carregando ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Carregando...</p>
      ) : !filtroProvisao && !algumFormaMarcada ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Selecione ao menos uma forma de pagamento para ver os lançamentos.
        </p>
      ) : (
        <>
          <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">
            {parcelasFiltradas.length} resultado{parcelasFiltradas.length !== 1 && "s"} ·{" "}
            <span className="font-medium text-slate-900 dark:text-slate-100">{formatarMoeda(total)}</span>
          </p>
          {parcelasFiltradas.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum lançamento encontrado.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    <th className="w-24 py-2 pl-4">
                      <div className="flex items-center gap-2.5 divide-x divide-slate-200 dark:divide-slate-600">
                        <label
                          className="flex flex-col items-center gap-1"
                          title="Marcar todos como pago (nesta página)"
                        >
                          <input
                            type="checkbox"
                            checked={todosPagos}
                            onChange={(e) => handleTogglePagoTodos(e.target.checked)}
                            className="h-5 w-5 shrink-0 accent-indigo-600"
                            aria-label="Marcar todos como pago nesta página"
                          />
                          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Pág.</span>
                        </label>
                        <label
                          className="flex flex-col items-center gap-1 pl-2.5"
                          title="Marcar todos como pago (todas as páginas)"
                        >
                          <input
                            type="checkbox"
                            checked={todosPagosTodasAsPaginas}
                            onChange={(e) => setConfirmacaoTodasAsPaginas(e.target.checked)}
                            className="h-5 w-5 shrink-0 accent-indigo-600"
                            aria-label="Marcar todos como pago em todas as páginas"
                          />
                          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Todas</span>
                        </label>
                      </div>
                    </th>
                    <ColunaOrdenavel campo="credor" ordenacao={ordenacao} onClicar={handleClicarColuna}>
                      Credor
                    </ColunaOrdenavel>
                    <th className="py-2 pr-2">Observação</th>
                    <th className="py-2 pr-2">Parcela</th>
                    <ColunaOrdenavel campo="dataCompra" ordenacao={ordenacao} onClicar={handleClicarColuna}>
                      Data
                    </ColunaOrdenavel>
                    <th className="py-2 pr-2">Reembolso</th>
                    <ColunaOrdenavel
                      campo="valor"
                      ordenacao={ordenacao}
                      onClicar={handleClicarColuna}
                      className="py-2 pr-2 text-right"
                      alinhamento="right"
                    >
                      Valor
                    </ColunaOrdenavel>
                    <th className="w-16 py-2 pr-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {parcelasPaginadas.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2.5 pl-4">
                        <input
                          type="checkbox"
                          checked={p.pago}
                          onChange={(e) => handleTogglePago(p, e.target.checked)}
                          className="h-5 w-5 shrink-0 accent-indigo-600"
                          aria-label={`Marcar ${p.credor} como pago`}
                        />
                      </td>
                      <td className="py-2.5 pr-2 font-medium text-slate-900 dark:text-slate-100">
                        {p.credor}
                        {p.pago ? (
                          <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                            Pago
                          </span>
                        ) : (
                          <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-950 dark:text-red-400">
                            Pendente
                          </span>
                        )}
                        {p.provisao && (
                          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                            Provisão
                          </span>
                        )}
                        {p.renegociacaoId && (
                          <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:bg-violet-950 dark:text-violet-400">
                            Renegociação
                          </span>
                        )}
                        <p className="truncate text-xs font-normal text-slate-500 dark:text-slate-400">
                          {p.grupo} · {p.aplicacao}
                        </p>
                      </td>
                      <td className="py-2.5 pr-2 text-slate-600 dark:text-slate-400">{p.observacao || "—"}</td>
                      <td className="py-2.5 pr-2 text-slate-600 dark:text-slate-400">
                        {p.recorrenciaId ? "Fixa" : p.parcelaTotal > 1 ? `${p.parcelaNum}/${p.parcelaTotal}` : "—"}
                      </td>
                      <td className="py-2.5 pr-2 text-slate-600 dark:text-slate-400">
                        {p.dataCompra ? formatarDataBR(p.dataCompra) : "—"}
                      </td>
                      <td className="py-2.5 pr-2 text-slate-600 dark:text-slate-400">{p.comp ?? "—"}</td>
                      <td className="py-2.5 pr-2 text-right font-medium text-slate-900 dark:text-slate-100">
                        {formatarMoeda(p.valorParcela)}
                      </td>
                      <td className="py-2.5 pr-4">
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            onClick={() => setParcelaEditando(p)}
                            aria-label={`Editar ${p.credor}`}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-700 dark:hover:text-indigo-400"
                          >
                            <IconEditar className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setParcelaExcluindo(p)}
                            aria-label={`Excluir ${p.credor}`}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600 dark:hover:bg-slate-700 dark:hover:text-red-400"
                          >
                            <IconExcluir className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Paginacao
            paginaAtual={paginaAtual}
            totalPaginas={totalPaginas}
            totalItens={parcelasOrdenadas.length}
            itensPorPagina={config.itensPorPagina}
            onMudarPagina={setPaginaAtual}
          />
        </>
      )}

      <EditarParcelaModal
        uid={uid}
        parcela={parcelaEditando}
        config={config}
        onFechar={() => setParcelaEditando(null)}
        camposLimitados
      />
      <ExcluirParcelaModal
        uid={uid}
        parcela={parcelaExcluindo}
        onFechar={() => setParcelaExcluindo(null)}
        restrito
      />
      <Modal
        aberto={confirmacaoTodasAsPaginas !== null}
        onFechar={() => setConfirmacaoTodasAsPaginas(null)}
        titulo="Confirmar ação em massa"
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {confirmacaoTodasAsPaginas
              ? `Marcar todos os ${parcelasFiltradas.length} lançamentos filtrados (todas as páginas) como pago?`
              : `Desmarcar todos os ${parcelasFiltradas.length} lançamentos filtrados (todas as páginas) como pago?`}
          </p>
          <button
            onClick={() => {
              if (confirmacaoTodasAsPaginas !== null) handleTogglePagoTodasAsPaginas(confirmacaoTodasAsPaginas);
              setConfirmacaoTodasAsPaginas(null);
            }}
            className={CLASSE_BOTAO_PRIMARIO}
          >
            Confirmar
          </button>
          <button
            onClick={() => setConfirmacaoTodasAsPaginas(null)}
            className="text-center text-sm text-slate-500 dark:text-slate-400"
          >
            Cancelar
          </button>
        </div>
      </Modal>
    </div>
  );
}
