"use client";

import { Suspense, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useMesAtual } from "@/contexts/MesAtualContext";
import {
  assinarRecebimentosDoMes,
  criarRecebimento,
  marcarRecebido,
  materializarRecebimentoRecorrencia,
  sincronizarReembolsosRecorrentes,
} from "@/lib/recebimentos";
import { assinarRecorrencias, ativaNoMes, criarRecorrencia, valorNoMes, vencimentoNoMes } from "@/lib/recorrencias";
import { assinarConfigListas, CONFIG_PADRAO } from "@/lib/config";
import { formatarDataBR, formatarMoeda, hojeISO } from "@/lib/date";
import { CLASSE_BOTAO_PRIMARIO, CLASSE_CARD, CLASSE_INPUT } from "@/lib/estilos";
import { EditarRecebimentoModal, ExcluirRecebimentoModal } from "@/components/modals/RecebimentoModals";
import { IconBuscar, IconEditar, IconExcluir } from "@/components/action-icons";
import FiltroMultiSelect from "@/components/FiltroMultiSelect";
import SeletorMesAno from "@/components/SeletorMesAno";
import CampoValorMonetario, { paraNumero } from "@/components/CampoValorMonetario";
import Modal from "@/components/Modal";
import Paginacao from "@/components/Paginacao";
import ColunaOrdenavel from "@/components/ColunaOrdenavel";
import { paginar, totalDePaginas } from "@/lib/paginacao";
import {
  ordenarRecebimentos,
  proximaOrdenacaoRecebimentos,
  type OrdenacaoRecebimentos,
} from "@/lib/ordenacaoRecebimentos";
import { Tab, Tabs } from "@/components/Tabs";
import { useAlturaSticky } from "@/lib/useAlturaSticky";
import type { ConfigListas, Recebimento, Recorrencia } from "@/lib/types";

type Aba = "novo" | "mes";

const ORIGEM_REEMBOLSO = "Reembolso";

function passaFiltroInclusivo(filtro: Record<string, boolean>, valor: string): boolean {
  const algumSelecionado = Object.values(filtro).some(Boolean);
  if (!algumSelecionado) return true;
  return filtro[valor] === true;
}

function origemExibida(r: Recebimento): string {
  return r.origemComp ? ORIGEM_REEMBOLSO : r.origem;
}

function validarYM(valor: string | null): string | null {
  return valor && /^\d{4}-\d{2}$/.test(valor) ? valor : null;
}

export default function ReceberPage() {
  return (
    <Suspense fallback={null}>
      <ReceberConteudo />
    </Suspense>
  );
}

function ReceberConteudo() {
  const { usuario } = useAuth();
  const { ref: tabsRef, altura: tabsAltura } = useAlturaSticky<HTMLDivElement>();
  const searchParams = useSearchParams();
  const abaInicial: Aba = searchParams.get("aba") === "mes" ? "mes" : "novo";
  const [aba, setAba] = useState<Aba>(abaInicial);
  const { ym, definirYm: setYm } = useMesAtual();
  const mesUrlProcessadoRef = useRef(false);
  useEffect(() => {
    if (mesUrlProcessadoRef.current) return;
    mesUrlProcessadoRef.current = true;
    const doUrl = validarYM(searchParams.get("mes"));
    if (doUrl) queueMicrotask(() => setYm(doUrl));
  }, [searchParams, setYm]);
  const [recebimentosReais, setRecebimentosReais] = useState<Recebimento[]>([]);
  const [recorrencias, setRecorrencias] = useState<Recorrencia[]>([]);
  const [recorrenciasPagar, setRecorrenciasPagar] = useState<Recorrencia[]>([]);
  const [config, setConfig] = useState<ConfigListas>(CONFIG_PADRAO);
  const [carregando, setCarregando] = useState(true);

  const [filtroOrigem, setFiltroOrigem] = useState<Record<string, boolean>>({});
  const [filtroReembolso, setFiltroReembolso] = useState<Record<string, boolean>>({});
  const [filtroFormaPagamento, setFiltroFormaPagamento] = useState<Record<string, boolean>>({});
  const [filtroApenasPendentes, setFiltroApenasPendentes] = useState(false);
  const [filtroValor, setFiltroValor] = useState("");
  const [ordenacao, setOrdenacao] = useState<OrdenacaoRecebimentos>(null);
  const [recebimentoEditando, setRecebimentoEditando] = useState<Recebimento | null>(null);
  const [recebimentoExcluindo, setRecebimentoExcluindo] = useState<Recebimento | null>(null);

  const [origem, setOrigem] = useState("");
  const [valor, setValor] = useState("");
  const [dataRecebimento, setDataRecebimento] = useState(hojeISO());
  const [parcelaTotal, setParcelaTotal] = useState("1");
  const [observacao, setObservacao] = useState("");
  const [contaFixa, setContaFixa] = useState(false);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!usuario) return;
    return assinarRecorrencias(usuario.uid, "receber", setRecorrencias);
  }, [usuario]);

  useEffect(() => {
    if (!usuario) return;
    return assinarRecorrencias(usuario.uid, "pagar", setRecorrenciasPagar);
  }, [usuario]);

  useEffect(() => {
    if (!usuario) return;
    return assinarConfigListas(usuario.uid, setConfig);
  }, [usuario]);

  useEffect(() => {
    if (!usuario) return;
    return assinarRecebimentosDoMes(usuario.uid, ym, (dados) => {
      setRecebimentosReais(dados);
      setCarregando(false);
    });
  }, [usuario, ym]);

  useEffect(() => {
    if (!usuario || recorrenciasPagar.length === 0) return;
    sincronizarReembolsosRecorrentes(usuario.uid, recorrenciasPagar, ym);
  }, [usuario, recorrenciasPagar, ym]);

  function handleMudarMes(novoYm: string) {
    setCarregando(true);
    setYm(novoYm);
  }

  const recebimentos = useMemo(() => {
    const idsJaMaterializados = new Set(
      recebimentosReais.filter((r) => r.recorrenciaId).map((r) => r.recorrenciaId)
    );
    const virtuais: Recebimento[] = recorrencias
      .filter((r) => ativaNoMes(r, ym) && !idsJaMaterializados.has(r.id))
      .map((r) => ({
        id: `virtual:${r.id}`,
        origem: r.credor,
        valor: valorNoMes(r, ym),
        recebimento: vencimentoNoMes(r, ym),
        qtdParcelas: 1,
        parcela: "1/1",
        observacao: r.observacao,
        recebido: false,
        recorrenciaId: r.id,
        virtual: true,
      }));
    return [...recebimentosReais, ...virtuais].sort((a, b) =>
      a.recebimento.localeCompare(b.recebimento)
    );
  }, [recebimentosReais, recorrencias, ym]);

  const recorrenciaPorId = useMemo(
    () => new Map(recorrencias.map((r) => [r.id, r])),
    [recorrencias]
  );

  function handleToggleRecebido(r: Recebimento, recebido: boolean) {
    if (!usuario) return;
    if (r.virtual && r.recorrenciaId) {
      if (recebido) materializarRecebimentoRecorrencia(usuario.uid, recorrenciaPorId.get(r.recorrenciaId)!, ym);
      return;
    }
    marcarRecebido(usuario.uid, r.id, recebido);
  }

  const origensDoMes = useMemo(
    () => [...new Set(recebimentos.map((r) => origemExibida(r)))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [recebimentos]
  );

  const recebimentosComReembolso = useMemo(() => recebimentos.filter((r) => r.origemComp), [recebimentos]);

  const reembolsoSelecionadoNaOrigem = filtroOrigem[ORIGEM_REEMBOLSO] === true;

  const reembolsosDoMes = useMemo(
    () =>
      [...new Set(recebimentosComReembolso.map((r) => r.origem))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [recebimentosComReembolso]
  );

  const formasPagamentoDoMes = useMemo(
    () =>
      [...new Set(recebimentosComReembolso.map((r) => r.formaPagamentoOrigem).filter((v): v is string => !!v))].sort(
        (a, b) => a.localeCompare(b, "pt-BR")
      ),
    [recebimentosComReembolso]
  );

  const algumFiltroMarcado = Object.values(filtroOrigem).some(Boolean);
  const algumReembolsoMarcado = Object.values(filtroReembolso).some(Boolean);

  const valorFiltroNum = filtroValor ? paraNumero(filtroValor) : null;
  const valorFiltroAtivo = valorFiltroNum !== null && !Number.isNaN(valorFiltroNum);

  const recebimentosFiltrados = useMemo(() => {
    if (!algumFiltroMarcado) return [];
    return recebimentos.filter((r) => {
      if (filtroApenasPendentes && r.recebido) return false;
      if (valorFiltroAtivo && Math.abs(r.valor - (valorFiltroNum as number)) >= 0.005) return false;
      if (!passaFiltroInclusivo(filtroOrigem, origemExibida(r))) return false;
      if (r.origemComp) {
        if (!passaFiltroInclusivo(filtroReembolso, r.origem)) return false;
        if (!passaFiltroInclusivo(filtroFormaPagamento, r.formaPagamentoOrigem ?? "")) return false;
      }
      return true;
    });
  }, [
    recebimentos,
    filtroOrigem,
    filtroReembolso,
    filtroFormaPagamento,
    algumFiltroMarcado,
    filtroApenasPendentes,
    valorFiltroNum,
    valorFiltroAtivo,
  ]);

  const resumoRecebimentos = useMemo(() => {
    const origens = new Set(recebimentosFiltrados.map((r) => r.origem));
    const totalValor = recebimentosFiltrados.reduce((s, r) => s + r.valor, 0);
    return { origens: origens.size, totalValor };
  }, [recebimentosFiltrados]);

  const recebimentosOrdenados = useMemo(
    () => ordenarRecebimentos(recebimentosFiltrados, ordenacao),
    [recebimentosFiltrados, ordenacao]
  );

  function handleClicarColuna(campo: Parameters<typeof proximaOrdenacaoRecebimentos>[1]) {
    setOrdenacao((atual) => proximaOrdenacaoRecebimentos(atual, campo));
  }

  const [paginaAtual, setPaginaAtual] = useState(1);
  const chavePaginacao = `${ym}|${JSON.stringify(filtroOrigem)}|${JSON.stringify(filtroReembolso)}|${JSON.stringify(filtroFormaPagamento)}|${filtroApenasPendentes}|${filtroValor}`;
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
  const totalPaginasRecebimentos = totalDePaginas(recebimentosOrdenados.length, config.itensPorPagina);
  const recebimentosPaginados = useMemo(
    () => paginar(recebimentosOrdenados, config.itensPorPagina, paginaAtual),
    [recebimentosOrdenados, config.itensPorPagina, paginaAtual]
  );

  function handleToggleTodos(recebido: boolean) {
    recebimentosPaginados.forEach((r) => {
      if (r.recebido !== recebido) handleToggleRecebido(r, recebido);
    });
  }

  function handleToggleTodosAsPaginas(recebido: boolean) {
    recebimentosFiltrados.forEach((r) => {
      if (r.recebido !== recebido) handleToggleRecebido(r, recebido);
    });
  }

  const [confirmacaoTodasAsPaginas, setConfirmacaoTodasAsPaginas] = useState<boolean | null>(null);

  const todosMarcados = recebimentosPaginados.length > 0 && recebimentosPaginados.every((r) => r.recebido);
  const todosMarcadosTodasAsPaginas =
    recebimentosFiltrados.length > 0 && recebimentosFiltrados.every((r) => r.recebido);

  const total = recebimentos.reduce((s, r) => s + r.valor, 0);
  const recebido = recebimentos.filter((r) => r.recebido).reduce((s, r) => s + r.valor, 0);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro("");
    const valorNum = paraNumero(valor);
    if (!origem || !dataRecebimento) {
      setErro("Preencha origem e data.");
      return;
    }
    if (!valorNum || valorNum <= 0) {
      setErro("Informe um valor válido.");
      return;
    }
    const parcelas = Number(parcelaTotal);
    if (!contaFixa && (!parcelas || parcelas < 1)) {
      setErro("O número de parcelas deve ser pelo menos 1.");
      return;
    }
    if (!usuario) return;
    setEnviando(true);
    try {
      if (contaFixa) {
        await criarRecorrencia(usuario.uid, {
          tipo: "receber",
          credor: origem,
          observacao,
          valor: valorNum,
          inicio: dataRecebimento,
        });
      } else {
        await criarRecebimento(usuario.uid, {
          origem,
          valor: valorNum,
          recebimento: dataRecebimento,
          parcelaTotal: parcelas,
          observacao,
        });
      }
      setOrigem("");
      setValor("");
      setParcelaTotal("1");
      setObservacao("");
      setContaFixa(false);
      setDataRecebimento(hojeISO());
    } catch {
      setErro("Não foi possível salvar. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  if (!usuario) return null;

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 md:px-8">
      <div ref={tabsRef} className="sticky top-0 z-20 bg-background print:static">
        <Tabs>
          <Tab ativo={aba === "novo"} onClick={() => setAba("novo")}>
            Novo recebimento
          </Tab>
          <Tab ativo={aba === "mes"} onClick={() => setAba("mes")} icone={<IconBuscar className="h-4 w-4" />}>
            Recebimentos
          </Tab>
        </Tabs>
      </div>

      {aba === "novo" && (
        <div className="mx-auto max-w-md">
          <form onSubmit={handleSubmit} className={`${CLASSE_CARD} flex flex-col gap-4`}>
            <div>
              <label className="block text-sm font-medium mb-1">Origem *</label>
              <input
                type="text"
                required
                value={origem}
                onChange={(e) => setOrigem(e.target.value)}
                className={CLASSE_INPUT}
              />
            </div>

            <div className="grid grid-cols-[0.9fr_1.3fr_0.7fr] gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Valor (R$) *</label>
                <CampoValorMonetario
                  required
                  value={valor}
                  onChange={setValor}
                  className={CLASSE_INPUT}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">1ª data *</label>
                <input
                  type="date"
                  required
                  value={dataRecebimento}
                  onChange={(e) => setDataRecebimento(e.target.value)}
                  className={CLASSE_INPUT}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Parcelas *</label>
                <input
                  type="number"
                  min={1}
                  required
                  disabled={contaFixa}
                  value={contaFixa ? 1 : parcelaTotal}
                  onChange={(e) => setParcelaTotal(e.target.value)}
                  className={`${CLASSE_INPUT} disabled:cursor-not-allowed disabled:opacity-50`}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={contaFixa}
                onChange={(e) => setContaFixa(e.target.checked)}
                className="h-4 w-4 accent-indigo-600"
              />
              Conta fixa (recorrente)
            </label>
            {contaFixa && (
              <p className="-mt-2 text-xs text-slate-500 dark:text-slate-400">
                O valor será lançado todo mês a partir da 1ª data, até você encerrar a recorrência.
              </p>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">Observação</label>
              <input
                type="text"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                className={CLASSE_INPUT}
              />
            </div>

            {erro && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}

            <button type="submit" disabled={enviando} className={CLASSE_BOTAO_PRIMARIO}>
              {enviando ? "Salvando..." : "Salvar recebimento"}
            </button>
          </form>
        </div>
      )}

      {aba === "mes" && (
        <div>
          <div
            className="sticky z-10 mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm print:static dark:border-slate-700 dark:bg-slate-800"
            style={{ top: tabsAltura }}
          >
            <div className="min-w-[160px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Total a receber no mês</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatarMoeda(total)}</p>
            </div>
            <div className="min-w-[160px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Recebido</p>
              <p
                className={`text-sm font-semibold ${
                  recebido < total ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {formatarMoeda(recebido)}
              </p>
            </div>
            {origensDoMes.length > 0 && (
              <FiltroMultiSelect
                rotulo="Origem"
                opcoes={origensDoMes}
                filtro={filtroOrigem}
                onAlternar={(item, visivel) => setFiltroOrigem((atual) => ({ ...atual, [item]: visivel }))}
                modoInclusao
              />
            )}
            {reembolsoSelecionadoNaOrigem && reembolsosDoMes.length > 0 && (
              <>
                <FiltroMultiSelect
                  rotulo="Reembolso"
                  opcoes={reembolsosDoMes}
                  filtro={filtroReembolso}
                  onAlternar={(item, visivel) => setFiltroReembolso((atual) => ({ ...atual, [item]: visivel }))}
                  modoInclusao
                />
                {algumReembolsoMarcado && formasPagamentoDoMes.length > 0 && (
                  <FiltroMultiSelect
                    rotulo="Forma de pagamento"
                    opcoes={formasPagamentoDoMes}
                    filtro={filtroFormaPagamento}
                    onAlternar={(item, visivel) =>
                      setFiltroFormaPagamento((atual) => ({ ...atual, [item]: visivel }))
                    }
                    modoInclusao
                  />
                )}
              </>
            )}
            <label className="flex h-[42px] cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm dark:border-slate-600">
              <input
                type="checkbox"
                checked={filtroApenasPendentes}
                onChange={(e) => setFiltroApenasPendentes(e.target.checked)}
                className="h-4 w-4 accent-red-500"
              />
              Somente pendentes
            </label>
            <div className="flex h-[42px] items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm dark:border-slate-600">
              <span className="text-slate-500 dark:text-slate-400">Valor</span>
              <CampoValorMonetario
                value={filtroValor}
                onChange={setFiltroValor}
                className="w-20 border-none bg-transparent p-0 text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>
            <div className="ml-auto">
              <SeletorMesAno ym={ym} onMudar={handleMudarMes} />
            </div>
          </div>

          {carregando ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Carregando...</p>
          ) : !algumFiltroMarcado ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Selecione ao menos uma origem para ver os lançamentos.
            </p>
          ) : recebimentosFiltrados.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum recebimento encontrado.</p>
          ) : (
            <>
              <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">
                {resumoRecebimentos.origens} {resumoRecebimentos.origens === 1 ? "origem" : "origens"} ·{" "}
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {formatarMoeda(resumoRecebimentos.totalValor)}
                </span>
              </p>
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    <th className="w-24 py-2 pl-4">
                      <div className="flex items-center gap-2.5 divide-x divide-slate-200 dark:divide-slate-600">
                        <label
                          className="flex flex-col items-center gap-1"
                          title="Marcar todos como recebido (nesta página)"
                        >
                          <input
                            type="checkbox"
                            checked={todosMarcados}
                            onChange={(e) => handleToggleTodos(e.target.checked)}
                            className="h-5 w-5 shrink-0 accent-indigo-600"
                            aria-label="Marcar todos como recebidos nesta página"
                          />
                          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Pág.</span>
                        </label>
                        <label
                          className="flex flex-col items-center gap-1 pl-2.5"
                          title="Marcar todos como recebido (todas as páginas)"
                        >
                          <input
                            type="checkbox"
                            checked={todosMarcadosTodasAsPaginas}
                            onChange={(e) => setConfirmacaoTodasAsPaginas(e.target.checked)}
                            className="h-5 w-5 shrink-0 accent-indigo-600"
                            aria-label="Marcar todos como recebidos em todas as páginas"
                          />
                          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Todas</span>
                        </label>
                      </div>
                    </th>
                    <ColunaOrdenavel campo="origem" ordenacao={ordenacao} onClicar={handleClicarColuna}>
                      Origem
                    </ColunaOrdenavel>
                    <th className="py-2 pr-2">Observação</th>
                    <th className="py-2 pr-2">Parcela</th>
                    <ColunaOrdenavel campo="data" ordenacao={ordenacao} onClicar={handleClicarColuna}>
                      Data
                    </ColunaOrdenavel>
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
                  {recebimentosPaginados.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2.5 pl-4">
                        <input
                          type="checkbox"
                          checked={r.recebido}
                          onChange={(e) => handleToggleRecebido(r, e.target.checked)}
                          className="h-5 w-5 shrink-0 accent-indigo-600"
                          aria-label={`Marcar ${r.origem} como recebido`}
                        />
                      </td>
                      <td className="py-2.5 pr-2 font-medium text-slate-900 dark:text-slate-100">
                        {r.origem}
                        {r.recebido ? (
                          <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                            Recebido
                          </span>
                        ) : (
                          <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-950 dark:text-red-400">
                            Pendente
                          </span>
                        )}
                        {r.provisao && (
                          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                            Provisão
                          </span>
                        )}
                        {r.renegociacaoId && (
                          <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:bg-violet-950 dark:text-violet-400">
                            Renegociação
                          </span>
                        )}
                        {r.formaPagamentoOrigem && (
                          <p className="truncate text-xs font-normal text-slate-500 dark:text-slate-400">
                            {r.formaPagamentoOrigem}
                          </p>
                        )}
                      </td>
                      <td className="py-2.5 pr-2 text-slate-600 dark:text-slate-400">{r.observacao || "—"}</td>
                      <td className="py-2.5 pr-2 text-slate-600 dark:text-slate-400">
                        {r.recorrenciaId ? "Fixa" : r.parcela}
                      </td>
                      <td className="py-2.5 pr-2 text-slate-600 dark:text-slate-400">
                        {formatarDataBR(r.recebimento)}
                      </td>
                      <td className="py-2.5 pr-2 text-right font-medium text-emerald-600 dark:text-emerald-400">
                        {formatarMoeda(r.valor)}
                      </td>
                      <td className="py-2.5 pr-4">
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            onClick={() => setRecebimentoEditando(r)}
                            aria-label={`Editar ${r.origem}`}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-700 dark:hover:text-indigo-400"
                          >
                            <IconEditar className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setRecebimentoExcluindo(r)}
                            aria-label={`Excluir ${r.origem}`}
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
              <Paginacao
                paginaAtual={paginaAtual}
                totalPaginas={totalPaginasRecebimentos}
                totalItens={recebimentosOrdenados.length}
                itensPorPagina={config.itensPorPagina}
                onMudarPagina={setPaginaAtual}
              />
            </>
          )}

          <EditarRecebimentoModal
            uid={usuario.uid}
            recebimento={recebimentoEditando}
            onFechar={() => setRecebimentoEditando(null)}
            camposLimitados
          />
          <ExcluirRecebimentoModal
            uid={usuario.uid}
            recebimento={recebimentoExcluindo}
            onFechar={() => setRecebimentoExcluindo(null)}
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
                  ? `Marcar todos os ${recebimentosFiltrados.length} recebimentos filtrados (todas as páginas) como recebidos?`
                  : `Desmarcar todos os ${recebimentosFiltrados.length} recebimentos filtrados (todas as páginas) como recebidos?`}
              </p>
              <button
                onClick={() => {
                  if (confirmacaoTodasAsPaginas !== null) handleToggleTodosAsPaginas(confirmacaoTodasAsPaginas);
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
      )}
    </div>
  );
}
