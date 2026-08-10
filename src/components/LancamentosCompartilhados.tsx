"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  assinarEnviados,
  assinarEnviosExcluidos,
  assinarRecebidos,
  assinarVinculos,
  calcularValorReembolso,
  candidatosParaCompartilhar,
  chaveOrigemParcela,
  compartilharSelecionados,
  excluirEnviadoComEscopo,
  excluirPendenciaDeEnvio,
  excluirRecebidoComEscopo,
  lancarSelecionados,
  valorOrigemDoReembolso,
  vinculoPorCompNome,
  type EscopoExclusaoRecebido,
} from "@/lib/compartilhamento";
import { assinarParcelasDoMes } from "@/lib/parcelas";
import { assinarRecorrencias, mesclarComRecorrencias } from "@/lib/recorrencias";
import { GRUPO_PROVISAO, adicionarItemLista, gruposAtivos } from "@/lib/config";
import { assinarPerfil } from "@/lib/perfil";
import { useMesAtual } from "@/contexts/MesAtualContext";
import { formatarDataBR, formatarMoeda } from "@/lib/date";
import SeletorMesAno from "@/components/SeletorMesAno";
import SeletorMarcarTodos from "@/components/SeletorMarcarTodos";
import Modal from "@/components/Modal";
import Paginacao from "@/components/Paginacao";
import { IconExcluir } from "@/components/action-icons";
import { CLASSE_BOTAO_PRIMARIO } from "@/lib/estilos";
import { paginar, totalDePaginas } from "@/lib/paginacao";
import type {
  ConfigListas,
  LancamentoCompartilhado,
  Parcela,
  Recorrencia,
  VinculoCompartilhamento,
} from "@/lib/types";

function parcelaDaParcela(p: Parcela): string {
  if (p.recorrenciaId) return "Fixa";
  return `${p.parcelaNum}/${p.parcelaTotal}`;
}

// Para conta fixa não existe "data da compra" — o dado relevante é o vencimento daquela
// ocorrência do mês.
function dataExibicaoParcela(p: Parcela): string | null {
  return p.recorrenciaId ? p.vencimento : p.dataCompra;
}

function dataExibicaoEnviado(e: LancamentoCompartilhado): string | null {
  return e.recorrenciaOrigemId ? e.vencimento : e.dataCompra;
}

// Chave de dois botões (mesmo padrão visual usado no gráfico Pizza/Barras) que alterna
// entre os lançamentos recebidos e os enviados — não muda nenhuma regra, só a forma de
// exibir a alternância.
function ChaveModoEnviadosRecebidos({
  modo,
  onAlterar,
}: {
  modo: "enviados" | "recebidos";
  onAlterar: (modo: "enviados" | "recebidos") => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        onClick={() => onAlterar("recebidos")}
        className={`shrink-0 rounded-lg border px-4 py-2 text-sm font-medium ${
          modo === "recebidos"
            ? "border-indigo-600 bg-indigo-600 text-white"
            : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        }`}
      >
        Lançamentos Recebidos
      </button>
      <button
        type="button"
        onClick={() => onAlterar("enviados")}
        className={`shrink-0 rounded-lg border px-4 py-2 text-sm font-medium ${
          modo === "enviados"
            ? "border-indigo-600 bg-indigo-600 text-white"
            : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        }`}
      >
        Lançamentos Enviados
      </button>
    </div>
  );
}

// Mesmo padrão visual do filtro acima, mas para alternar a visualização entre os itens
// ainda pendentes de envio e os já enviados dentro da aba Lançamentos Enviados — não afeta
// nenhuma regra de negócio, só o que fica visível na tabela. Os rótulos ("Pendentes"/"Já
// Enviados") propositalmente evitam repetir a palavra "Enviados" sozinha, para não parecer
// contraditório ao lado do botão "Lançamentos Enviados" já selecionado.
function FiltroStatusEnvio({
  status,
  onAlterar,
}: {
  status: "nao_enviados" | "enviados";
  onAlterar: (status: "nao_enviados" | "enviados") => void;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex h-[42px] shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700"
      >
        <span className="text-slate-500 dark:text-slate-400">Status:</span>
        <span className="font-medium text-slate-900 dark:text-slate-100">
          {status === "nao_enviados" ? "Pendentes" : "Já Enviados"}
        </span>
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {aberto && (
        <div className="absolute z-30 mt-1 w-44 rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-800">
          {(["nao_enviados", "enviados"] as const).map((opcao) => (
            <label
              key={opcao}
              className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <input
                type="checkbox"
                checked={status === opcao}
                onChange={() => onAlterar(opcao)}
                className="h-3.5 w-3.5 accent-indigo-600"
              />
              {opcao === "nao_enviados" ? "Pendentes" : "Já Enviados"}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LancamentosCompartilhados({
  uid,
  email,
  config,
  stickyTop = 0,
  modoInicial = "recebidos",
}: {
  uid: string;
  email: string;
  config: ConfigListas;
  stickyTop?: number;
  modoInicial?: "enviados" | "recebidos";
}) {
  const [modo, setModo] = useState<"enviados" | "recebidos">(modoInicial);
  const [vinculos, setVinculos] = useState<VinculoCompartilhamento[]>([]);
  const [nome, setNome] = useState("");

  useEffect(() => {
    return assinarVinculos(uid, setVinculos);
  }, [uid]);

  useEffect(() => {
    return assinarPerfil(uid, (p) => setNome(`${p.nome} ${p.sobrenome}`.trim()));
  }, [uid]);

  return modo === "enviados" ? (
    <AbaEnviados
      uid={uid}
      email={email}
      nome={nome}
      config={config}
      vinculos={vinculos}
      stickyTop={stickyTop}
      modo={modo}
      onAlterarModo={setModo}
    />
  ) : (
    <AbaRecebidos uid={uid} config={config} stickyTop={stickyTop} modo={modo} onAlterarModo={setModo} />
  );
}

type LinhaEnvio =
  | { status: "enviado"; item: LancamentoCompartilhado }
  | { status: "nao_enviado"; parcela: Parcela };

function AbaEnviados({
  uid,
  email,
  nome,
  config,
  vinculos,
  stickyTop,
  modo,
  onAlterarModo,
}: {
  uid: string;
  email: string;
  nome: string;
  config: ConfigListas;
  vinculos: VinculoCompartilhamento[];
  stickyTop: number;
  modo: "enviados" | "recebidos";
  onAlterarModo: (modo: "enviados" | "recebidos") => void;
}) {
  const { ym, definirYm: setYm } = useMesAtual();
  const [recorrencias, setRecorrencias] = useState<Recorrencia[]>([]);
  const [estadoMes, setEstadoMes] = useState<{ ym: string; parcelasReais: Parcela[] }>({ ym: "", parcelasReais: [] });
  const [enviados, setEnviados] = useState<LancamentoCompartilhado[]>([]);
  const [enviosExcluidos, setEnviosExcluidos] = useState<Set<string>>(new Set());
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [confirmando, setConfirmando] = useState(false);
  const [statusFiltro, setStatusFiltro] = useState<"nao_enviados" | "enviados">("nao_enviados");
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [excluindo, setExcluindo] = useState<LancamentoCompartilhado | null>(null);
  const [excluindoOcorrencia, setExcluindoOcorrencia] = useState(false);
  const [erroExclusao, setErroExclusao] = useState("");
  const [removendo, setRemovendo] = useState<Parcela | null>(null);
  const [removendoOcorrencia, setRemovendoOcorrencia] = useState(false);
  const [erroRemocao, setErroRemocao] = useState("");
  const [excluindoSelecionados, setExcluindoSelecionados] = useState(false);
  const [excluindoSelecionadosOcorrencia, setExcluindoSelecionadosOcorrencia] = useState(false);
  const [erroExclusaoSelecionados, setErroExclusaoSelecionados] = useState("");

  const [ymAnterior, setYmAnterior] = useState(ym);
  if (ym !== ymAnterior) {
    setYmAnterior(ym);
    setPaginaAtual(1);
  }

  const [statusFiltroAnterior, setStatusFiltroAnterior] = useState(statusFiltro);
  if (statusFiltro !== statusFiltroAnterior) {
    setStatusFiltroAnterior(statusFiltro);
    setPaginaAtual(1);
  }

  useEffect(() => {
    return assinarRecorrencias(uid, "pagar", setRecorrencias);
  }, [uid]);

  useEffect(() => {
    return assinarParcelasDoMes(uid, ym, (dados) => setEstadoMes({ ym, parcelasReais: dados }));
  }, [uid, ym]);

  useEffect(() => {
    return assinarEnviados(uid, setEnviados);
  }, [uid]);

  useEffect(() => {
    return assinarEnviosExcluidos(uid, setEnviosExcluidos);
  }, [uid]);

  const carregando = estadoMes.ym !== ym;

  const todasParcelas = useMemo(
    () => (carregando ? [] : mesclarComRecorrencias(estadoMes.parcelasReais, recorrencias, ym)),
    [carregando, estadoMes, recorrencias, ym]
  );

  const candidatos = useMemo(() => candidatosParaCompartilhar(todasParcelas, vinculos), [todasParcelas, vinculos]);

  const origensCompartilhadas = useMemo(() => new Set(enviados.map((e) => e.lancamentoOrigemId)), [enviados]);

  const naoEnviados = useMemo(
    () =>
      candidatos.filter((p) => {
        const chave = chaveOrigemParcela(p);
        return !origensCompartilhadas.has(chave) && !enviosExcluidos.has(chave);
      }),
    [candidatos, origensCompartilhadas, enviosExcluidos]
  );

  const enviadosDoMes = useMemo(() => enviados.filter((e) => e.vencimento.slice(0, 7) === ym), [enviados, ym]);

  const linhas = useMemo<LinhaEnvio[]>(
    () =>
      statusFiltro === "nao_enviados"
        ? naoEnviados.map((parcela) => ({ status: "nao_enviado" as const, parcela }))
        : enviadosDoMes.map((item) => ({ status: "enviado" as const, item })),
    [statusFiltro, naoEnviados, enviadosDoMes]
  );

  const totalItens = linhas.length;
  const totalPaginas = totalDePaginas(totalItens, config.itensPorPagina);
  const paginadas = useMemo(
    () => paginar(linhas, config.itensPorPagina, paginaAtual),
    [linhas, config.itensPorPagina, paginaAtual]
  );

  const idDaLinha = useCallback((l: LinhaEnvio) => (l.status === "enviado" ? l.item.id : l.parcela.id), []);

  const idsVisiveis = useMemo(() => paginadas.map(idDaLinha), [paginadas, idDaLinha]);
  const idsTodasAsLinhas = useMemo(() => linhas.map(idDaLinha), [linhas, idDaLinha]);
  const todosSelecionadosNaPagina = idsVisiveis.length > 0 && idsVisiveis.every((id) => selecionados.has(id));
  const todosSelecionadosTodasAsPaginas =
    idsTodasAsLinhas.length > 0 && idsTodasAsLinhas.every((id) => selecionados.has(id));

  function alternarSelecao(id: string, marcado: boolean) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (marcado) novo.add(id);
      else novo.delete(id);
      return novo;
    });
  }

  function alternarTodosNaPagina(marcado: boolean) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      idsVisiveis.forEach((id) => (marcado ? novo.add(id) : novo.delete(id)));
      return novo;
    });
  }

  function alternarTodosTodasAsPaginas(marcado: boolean) {
    setSelecionados(marcado ? new Set(idsTodasAsLinhas) : new Set());
  }

  const itensSelecionados = naoEnviados.filter((p) => selecionados.has(p.id));
  const itensSelecionadosEnviados = useMemo(
    () => enviadosDoMes.filter((e) => selecionados.has(e.id)),
    [enviadosDoMes, selecionados]
  );
  const totalSelecionadosParaExcluir = itensSelecionados.length + itensSelecionadosEnviados.length;

  const nomesDestinatariosDe = useCallback(
    (comps: (string | null)[]): string[] => {
      const porComp = vinculoPorCompNome(vinculos);
      const nomes = new Set(
        comps.map((comp) => (comp ? porComp.get(comp)?.nomeVinculado || porComp.get(comp)?.emailVinculado : null))
      );
      return [...nomes].filter((n): n is string => !!n);
    },
    [vinculos]
  );

  const nomesDestinatarios = useMemo(
    () => nomesDestinatariosDe(itensSelecionados.map((p) => p.comp)),
    [itensSelecionados, nomesDestinatariosDe]
  );

  async function handleConfirmarCompartilhar() {
    await compartilharSelecionados(uid, nome, email, itensSelecionados, config, vinculos, recorrencias, enviados);
    setSelecionados(new Set());
    setConfirmando(false);
  }

  async function handleExcluirComEscopo(escopo: EscopoExclusaoRecebido) {
    if (!excluindo) return;
    setErroExclusao("");
    setExcluindoOcorrencia(true);
    try {
      await excluirEnviadoComEscopo(excluindo, escopo, recorrencias);
      setExcluindo(null);
    } catch {
      setErroExclusao("Não foi possível excluir. Tente novamente.");
    } finally {
      setExcluindoOcorrencia(false);
    }
  }

  async function handleRemoverComEscopo(escopo: EscopoExclusaoRecebido) {
    if (!removendo) return;
    setErroRemocao("");
    setRemovendoOcorrencia(true);
    try {
      await excluirPendenciaDeEnvio(uid, removendo, recorrencias, enviados, escopo);
      setRemovendo(null);
    } catch {
      setErroRemocao("Não foi possível remover. Tente novamente.");
    } finally {
      setRemovendoOcorrencia(false);
    }
  }

  async function handleExcluirSelecionadosComEscopo(escopo: EscopoExclusaoRecebido) {
    setErroExclusaoSelecionados("");
    setExcluindoSelecionadosOcorrencia(true);
    try {
      for (const item of itensSelecionadosEnviados) {
        await excluirEnviadoComEscopo(item, escopo, recorrencias);
      }
      for (const p of itensSelecionados) {
        await excluirPendenciaDeEnvio(uid, p, recorrencias, enviados, escopo);
      }
      setSelecionados(new Set());
      setExcluindoSelecionados(false);
    } catch {
      setErroExclusaoSelecionados("Não foi possível excluir alguns itens. Tente novamente.");
    } finally {
      setExcluindoSelecionadosOcorrencia(false);
    }
  }

  return (
    <div>
      <div
        className="sticky z-30 mb-6 rounded-xl border border-slate-200 bg-white shadow-sm print:static dark:border-slate-700 dark:bg-slate-800"
        style={{ top: stickyTop }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <ChaveModoEnviadosRecebidos modo={modo} onAlterar={onAlterarModo} />
          <SeletorMesAno ym={ym} onMudar={setYm} />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-b-xl border-t border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/40">
          <FiltroStatusEnvio status={statusFiltro} onAlterar={setStatusFiltro} />
          <div className="flex h-[42px] shrink-0 items-center gap-2">
            <button
              onClick={() => setExcluindoSelecionados(true)}
              disabled={totalSelecionadosParaExcluir === 0}
              className="inline-flex h-[42px] min-w-[84px] shrink-0 items-center justify-center whitespace-nowrap rounded-lg border border-red-300 px-4 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
            >
              Excluir {totalSelecionadosParaExcluir > 0 ? `(${totalSelecionadosParaExcluir})` : ""}
            </button>
            <button
              onClick={() => setConfirmando(true)}
              disabled={itensSelecionados.length === 0}
              className="inline-flex h-[42px] min-w-[84px] shrink-0 items-center justify-center whitespace-nowrap rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Enviar {itensSelecionados.length > 0 ? `(${itensSelecionados.length})` : ""}
            </button>
          </div>
        </div>
      </div>

      {carregando ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Carregando...</p>
      ) : totalItens === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {statusFiltro === "nao_enviados"
            ? "Nenhum lançamento pendente de envio neste mês."
            : "Nenhum lançamento já enviado neste mês."}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  <th className="w-14 py-2 pl-4">
                    <SeletorMarcarTodos
                      marcadoPagina={todosSelecionadosNaPagina}
                      onAlterarPagina={(marcado) => alternarTodosNaPagina(marcado)}
                      marcadoTodas={todosSelecionadosTodasAsPaginas}
                      onAlterarTodas={(marcado) => alternarTodosTodasAsPaginas(marcado)}
                      ariaLabelPagina="Selecionar todos nesta página"
                      ariaLabelTodas="Selecionar todos em todas as páginas"
                    />
                  </th>
                  <th className="py-2 pr-2">Credor</th>
                  <th className="py-2 pr-2">Observação</th>
                  <th className="py-2 pr-2">Aplicação</th>
                  <th className="py-2 pr-2">Parcela</th>
                  <th className="py-2 pr-2">Reembolso</th>
                  <th className="py-2 pr-2">Data</th>
                  <th className="py-2 pr-2 text-right">Valor do lançamento</th>
                  <th className="py-2 pr-2 text-right">Valor do Reembolso</th>
                  <th className="py-2 pr-2">Status</th>
                  <th className="w-12 py-2 pr-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {paginadas.map((linha) =>
                  linha.status === "enviado" ? (
                    <tr key={`e-${linha.item.id}`}>
                      <td className="py-2.5 pl-4">
                        <input
                          type="checkbox"
                          checked={selecionados.has(linha.item.id)}
                          onChange={(ev) => alternarSelecao(linha.item.id, ev.target.checked)}
                          className="h-5 w-5 accent-indigo-600"
                          aria-label={`Selecionar ${linha.item.credorSugerido}`}
                        />
                      </td>
                      <td className="py-2.5 pr-2 font-medium text-slate-900 dark:text-slate-100">
                        {linha.item.credorSugerido}
                      </td>
                      <td className="py-2.5 pr-2 text-slate-600 dark:text-slate-400">
                        {linha.item.observacao || "—"}
                      </td>
                      <td className="py-2.5 pr-2 text-slate-600 dark:text-slate-400">
                        {linha.item.aplicacaoSugerida}
                      </td>
                      <td className="py-2.5 pr-2 text-slate-600 dark:text-slate-400">{linha.item.parcela}</td>
                      <td className="py-2.5 pr-2 text-slate-600 dark:text-slate-400">{linha.item.compNome}</td>
                      <td className="py-2.5 pr-2 text-slate-600 dark:text-slate-400">
                        {dataExibicaoEnviado(linha.item) ? formatarDataBR(dataExibicaoEnviado(linha.item)!) : "—"}
                      </td>
                      <td className="py-2.5 pr-2 text-right font-medium text-slate-900 dark:text-slate-100">
                        {formatarMoeda(valorOrigemDoReembolso(linha.item.valor, linha.item.compNome, config))}
                      </td>
                      <td className="py-2.5 pr-2 text-right font-medium text-slate-900 dark:text-slate-100">
                        {formatarMoeda(linha.item.valor)}
                      </td>
                      <td className="py-2.5 pr-2">
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                          Enviado
                        </span>
                      </td>
                      <td className="py-2.5 pr-4">
                        <button
                          onClick={() => {
                            setErroExclusao("");
                            setExcluindo(linha.item);
                          }}
                          aria-label={`Excluir compartilhamento de ${linha.item.credorSugerido}`}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600 dark:hover:bg-slate-700 dark:hover:text-red-400"
                        >
                          <IconExcluir className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={`p-${linha.parcela.id}`}>
                      <td className="py-2.5 pl-4">
                        <input
                          type="checkbox"
                          checked={selecionados.has(linha.parcela.id)}
                          onChange={(ev) => alternarSelecao(linha.parcela.id, ev.target.checked)}
                          className="h-5 w-5 accent-indigo-600"
                          aria-label={`Selecionar ${linha.parcela.credor}`}
                        />
                      </td>
                      <td className="py-2.5 pr-2 font-medium text-slate-900 dark:text-slate-100">
                        {linha.parcela.credor}
                      </td>
                      <td className="py-2.5 pr-2 text-slate-600 dark:text-slate-400">
                        {linha.parcela.observacao || "—"}
                      </td>
                      <td className="py-2.5 pr-2 text-slate-600 dark:text-slate-400">{linha.parcela.aplicacao}</td>
                      <td className="py-2.5 pr-2 text-slate-600 dark:text-slate-400">
                        {parcelaDaParcela(linha.parcela)}
                      </td>
                      <td className="py-2.5 pr-2 text-slate-600 dark:text-slate-400">{linha.parcela.comp ?? "—"}</td>
                      <td className="py-2.5 pr-2 text-slate-600 dark:text-slate-400">
                        {dataExibicaoParcela(linha.parcela)
                          ? formatarDataBR(dataExibicaoParcela(linha.parcela)!)
                          : "—"}
                      </td>
                      <td className="py-2.5 pr-2 text-right font-medium text-slate-900 dark:text-slate-100">
                        {formatarMoeda(linha.parcela.valorParcela)}
                      </td>
                      <td className="py-2.5 pr-2 text-right font-medium text-slate-900 dark:text-slate-100">
                        {formatarMoeda(calcularValorReembolso(linha.parcela.valorParcela, linha.parcela.comp, config))}
                      </td>
                      <td className="py-2.5 pr-2">
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-950 dark:text-red-400">
                          Não enviado
                        </span>
                      </td>
                      <td className="py-2.5 pr-4">
                        <button
                          onClick={() => {
                            setErroRemocao("");
                            setRemovendo(linha.parcela);
                          }}
                          aria-label={`Remover ${linha.parcela.credor} da lista de envio`}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600 dark:hover:bg-slate-700 dark:hover:text-red-400"
                        >
                          <IconExcluir className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
          <Paginacao
            paginaAtual={paginaAtual}
            totalPaginas={totalPaginas}
            totalItens={totalItens}
            itensPorPagina={config.itensPorPagina}
            onMudarPagina={setPaginaAtual}
          />
        </>
      )}

      <Modal aberto={confirmando} onFechar={() => setConfirmando(false)} titulo="Confirmar compartilhamento">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {nomesDestinatarios.length > 0
              ? `Estes lançamentos serão compartilhados com ${nomesDestinatarios.join(", ")}.`
              : "Estes lançamentos serão compartilhados."}
          </p>
          <button onClick={handleConfirmarCompartilhar} className={CLASSE_BOTAO_PRIMARIO}>
            Confirmar
          </button>
          <button
            onClick={() => setConfirmando(false)}
            className="text-center text-sm text-slate-500 dark:text-slate-400"
          >
            Cancelar
          </button>
        </div>
      </Modal>

      <Modal aberto={!!excluindo} onFechar={() => setExcluindo(null)} titulo="Excluir compartilhamento">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            &quot;{excluindo?.credorSugerido}&quot; — o que deseja excluir do compartilhamento? A despesa continua
            na sua Contas a Pagar; só o envio para {excluindo?.compNome} é desfeito, e não volta a aparecer
            sozinho como pendência de envio (use &quot;Reenviar&quot; em Lançamentos se quiser enviar de novo).
          </p>
          {erroExclusao && <p className="text-sm text-red-600 dark:text-red-400">{erroExclusao}</p>}
          <button
            onClick={() => handleExcluirComEscopo("mes")}
            disabled={excluindoOcorrencia}
            className="w-full rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Apenas este mês
          </button>
          <button
            onClick={() => handleExcluirComEscopo("futuros")}
            disabled={excluindoOcorrencia}
            className="w-full rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Este mês e os futuros
          </button>
          <button
            onClick={() => handleExcluirComEscopo("tudo")}
            disabled={excluindoOcorrencia}
            className="w-full rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {excluindoOcorrencia ? "Excluindo..." : "Todos (desde o início)"}
          </button>
          <button
            onClick={() => setExcluindo(null)}
            disabled={excluindoOcorrencia}
            className="text-center text-sm text-slate-500 dark:text-slate-400"
          >
            Cancelar
          </button>
        </div>
      </Modal>

      <Modal aberto={!!removendo} onFechar={() => setRemovendo(null)} titulo="Remover da lista de envio">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            &quot;{removendo?.credor}&quot; — isso remove apenas a pendência de envio da lista; o lançamento
            continua intacto na sua Contas a Pagar, com o reembolso configurado normalmente.
          </p>
          {erroRemocao && <p className="text-sm text-red-600 dark:text-red-400">{erroRemocao}</p>}
          {removendo?.recorrenciaId || (removendo && removendo.parcelaTotal > 1) ? (
            <>
              <button
                onClick={() => handleRemoverComEscopo("mes")}
                disabled={removendoOcorrencia}
                className="w-full rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Apenas este mês
              </button>
              <button
                onClick={() => handleRemoverComEscopo("futuros")}
                disabled={removendoOcorrencia}
                className="w-full rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Este mês e os futuros
              </button>
              <button
                onClick={() => handleRemoverComEscopo("tudo")}
                disabled={removendoOcorrencia}
                className="w-full rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {removendoOcorrencia ? "Removendo..." : "Todos (desde o início)"}
              </button>
            </>
          ) : (
            <button
              onClick={() => handleRemoverComEscopo("mes")}
              disabled={removendoOcorrencia}
              className="w-full rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {removendoOcorrencia ? "Removendo..." : "Remover"}
            </button>
          )}
          <button
            onClick={() => setRemovendo(null)}
            disabled={removendoOcorrencia}
            className="text-center text-sm text-slate-500 dark:text-slate-400"
          >
            Cancelar
          </button>
        </div>
      </Modal>

      <Modal
        aberto={excluindoSelecionados}
        onFechar={() => setExcluindoSelecionados(false)}
        titulo="Excluir selecionados"
      >
        <div className="flex flex-col gap-2">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {totalSelecionadosParaExcluir} lançamento{totalSelecionadosParaExcluir !== 1 && "s"} selecionado
            {totalSelecionadosParaExcluir !== 1 && "s"} — o que deseja excluir? Em ambos os casos (já enviados ou
            pendentes) sai da lista de envio e não volta a aparecer sozinho como pendência (use &quot;Reenviar&quot;
            em Lançamentos se quiser enviar de novo); o lançamento continua intacto na sua Contas a Pagar, com o
            reembolso configurado normalmente.
          </p>
          {erroExclusaoSelecionados && (
            <p className="text-sm text-red-600 dark:text-red-400">{erroExclusaoSelecionados}</p>
          )}
          <button
            onClick={() => handleExcluirSelecionadosComEscopo("mes")}
            disabled={excluindoSelecionadosOcorrencia}
            className="w-full rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Apenas este mês
          </button>
          <button
            onClick={() => handleExcluirSelecionadosComEscopo("futuros")}
            disabled={excluindoSelecionadosOcorrencia}
            className="w-full rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Este mês e os futuros
          </button>
          <button
            onClick={() => handleExcluirSelecionadosComEscopo("tudo")}
            disabled={excluindoSelecionadosOcorrencia}
            className="w-full rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {excluindoSelecionadosOcorrencia ? "Excluindo..." : "Todos (desde o início)"}
          </button>
          <button
            onClick={() => setExcluindoSelecionados(false)}
            disabled={excluindoSelecionadosOcorrencia}
            className="text-center text-sm text-slate-500 dark:text-slate-400"
          >
            Cancelar
          </button>
        </div>
      </Modal>
    </div>
  );
}

// Um lançamento compartilhado pode virar várias parcelas (mesmo grupoOrigemId); o processo
// de lançamento sequencial trata cada lançamento de origem como um passo, não cada parcela.
type GrupoParaLancar = {
  grupoOrigemId: string;
  credorSugerido: string;
  aplicacaoSugerida: string;
  valorTotal: number;
  vencimentoMin: string;
};

function AbaRecebidos({
  uid,
  config,
  stickyTop,
  modo,
  onAlterarModo,
}: {
  uid: string;
  config: ConfigListas;
  stickyTop: number;
  modo: "enviados" | "recebidos";
  onAlterarModo: (modo: "enviados" | "recebidos") => void;
}) {
  const { ym, definirYm: setYm } = useMesAtual();
  const [recebidos, setRecebidos] = useState<LancamentoCompartilhado[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [paginaAtual, setPaginaAtual] = useState(1);
  // Snapshot do que estava selecionado quando "Lançar" foi clicado — fixo durante todo o
  // processo (não recalculado a partir dos recebidos ao vivo), pra não embaralhar o índice
  // atual quando um item já lançado some da lista de pendentes no meio do processo.
  const [lancamentoEmAndamento, setLancamentoEmAndamento] = useState<{
    itens: LancamentoCompartilhado[];
    grupos: GrupoParaLancar[];
    indice: number;
  } | null>(null);
  const [grupoEscolhidoManual, setGrupoEscolhidoManual] = useState<string | null>(null);
  const [aplicacaoEscolhidaManual, setAplicacaoEscolhidaManual] = useState<string | null>(null);
  const [aplicacoesExtras, setAplicacoesExtras] = useState<string[]>([]);
  const [criandoAplicacao, setCriandoAplicacao] = useState(false);
  const [lancandoAtual, setLancandoAtual] = useState(false);
  const [erroLancamentoAtual, setErroLancamentoAtual] = useState("");
  const [excluindo, setExcluindo] = useState<LancamentoCompartilhado | null>(null);
  const [excluindoOcorrencia, setExcluindoOcorrencia] = useState(false);
  const [erroExclusao, setErroExclusao] = useState("");
  const [excluindoSelecionados, setExcluindoSelecionados] = useState(false);
  const [excluindoSelecionadosOcorrencia, setExcluindoSelecionadosOcorrencia] = useState(false);
  const [erroExclusaoSelecionados, setErroExclusaoSelecionados] = useState("");

  const gruposDisponiveis = useMemo(
    () => gruposAtivos(config).filter((g) => g !== GRUPO_PROVISAO),
    [config]
  );
  const grupoEscolhido = grupoEscolhidoManual ?? gruposDisponiveis[0] ?? "";

  useEffect(() => {
    return assinarRecebidos(uid, setRecebidos);
  }, [uid]);

  const recebidosDoMes = useMemo(
    () => recebidos.filter((r) => r.vencimento.slice(0, 7) === ym),
    [recebidos, ym]
  );

  const recebidosVisiveis = useMemo(
    () => recebidosDoMes.filter((r) => r.status === "pendente"),
    [recebidosDoMes]
  );

  const [ymAnterior, setYmAnterior] = useState(ym);
  if (ym !== ymAnterior) {
    setYmAnterior(ym);
    setPaginaAtual(1);
  }

  const totalPaginas = totalDePaginas(recebidosVisiveis.length, config.itensPorPagina);
  const paginados = useMemo(
    () => paginar(recebidosVisiveis, config.itensPorPagina, paginaAtual),
    [recebidosVisiveis, config.itensPorPagina, paginaAtual]
  );

  const todosSelecionadosNaPagina = paginados.length > 0 && paginados.every((r) => selecionados.has(r.id));
  const todosSelecionadosTodasAsPaginas =
    recebidosVisiveis.length > 0 && recebidosVisiveis.every((r) => selecionados.has(r.id));

  function alternarSelecao(id: string, marcado: boolean) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (marcado) novo.add(id);
      else novo.delete(id);
      return novo;
    });
  }

  function alternarTodosNaPagina(marcado: boolean) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      paginados.forEach((r) => (marcado ? novo.add(r.id) : novo.delete(r.id)));
      return novo;
    });
  }

  function alternarTodosTodasAsPaginas(marcado: boolean) {
    setSelecionados(marcado ? new Set(recebidosVisiveis.map((r) => r.id)) : new Set());
  }

  const itensSelecionados = recebidosVisiveis.filter((r) => selecionados.has(r.id));

  // Aplicações disponíveis pra escolher no lançamento: as já cadastradas + as que acabaram
  // de ser criadas nesta sessão (otimista, antes do listener de config confirmar via Firestore).
  const opcoesAplicacoes = useMemo(
    () => [...new Set([...config.aplicacoes, ...aplicacoesExtras])],
    [config.aplicacoes, aplicacoesExtras]
  );

  function agruparPorLancamentoOrigem(itens: LancamentoCompartilhado[]): GrupoParaLancar[] {
    const porGrupo = new Map<string, GrupoParaLancar>();
    for (const item of itens) {
      const atual = porGrupo.get(item.grupoOrigemId);
      if (!atual) {
        porGrupo.set(item.grupoOrigemId, {
          grupoOrigemId: item.grupoOrigemId,
          credorSugerido: item.credorSugerido,
          aplicacaoSugerida: item.aplicacaoSugerida,
          valorTotal: item.valor,
          vencimentoMin: item.vencimento,
        });
      } else {
        atual.valorTotal += item.valor;
        if (item.vencimento < atual.vencimentoMin) atual.vencimentoMin = item.vencimento;
      }
    }
    return [...porGrupo.values()].sort((a, b) => a.vencimentoMin.localeCompare(b.vencimentoMin));
  }

  // Abre o processo de lançamento sequencial: cada lançamento de origem selecionado (mesmo
  // que tenha várias parcelas) vira um passo, lançado individualmente ao confirmar — se o
  // usuário cancelar no meio, os passos já confirmados continuam lançados (já gravados no
  // Firestore quando confirmados) e os restantes seguem intactos como pendência.
  function iniciarLancamento() {
    if (itensSelecionados.length === 0) return;
    setLancamentoEmAndamento({ itens: itensSelecionados, grupos: agruparPorLancamentoOrigem(itensSelecionados), indice: 0 });
    setGrupoEscolhidoManual(null);
    setAplicacaoEscolhidaManual(null);
    setAplicacoesExtras([]);
    setErroLancamentoAtual("");
  }

  const grupoAtual = lancamentoEmAndamento ? lancamentoEmAndamento.grupos[lancamentoEmAndamento.indice] : null;
  const aplicacaoSugeridaAtualExiste = grupoAtual ? opcoesAplicacoes.includes(grupoAtual.aplicacaoSugerida) : false;
  const aplicacaoEscolhidaAtual =
    aplicacaoEscolhidaManual ?? (grupoAtual && aplicacaoSugeridaAtualExiste ? grupoAtual.aplicacaoSugerida : opcoesAplicacoes[0] ?? "");

  async function handleCriarAplicacaoAtual() {
    if (!grupoAtual) return;
    setCriandoAplicacao(true);
    try {
      await adicionarItemLista(uid, "aplicacoes", grupoAtual.aplicacaoSugerida);
      setAplicacoesExtras((atual) =>
        atual.includes(grupoAtual.aplicacaoSugerida) ? atual : [...atual, grupoAtual.aplicacaoSugerida]
      );
      setAplicacaoEscolhidaManual(grupoAtual.aplicacaoSugerida);
    } finally {
      setCriandoAplicacao(false);
    }
  }

  function cancelarLancamento() {
    setLancamentoEmAndamento(null);
    setAplicacaoEscolhidaManual(null);
    setErroLancamentoAtual("");
  }

  async function handleLancarAtual() {
    if (!lancamentoEmAndamento || !grupoAtual) return;
    if (!grupoEscolhido || !aplicacaoEscolhidaAtual) return;
    setErroLancamentoAtual("");
    setLancandoAtual(true);
    try {
      const itensDoGrupo = lancamentoEmAndamento.itens.filter((it) => it.grupoOrigemId === grupoAtual.grupoOrigemId);
      await lancarSelecionados(
        uid,
        itensDoGrupo,
        grupoEscolhido,
        new Map([[grupoAtual.grupoOrigemId, aplicacaoEscolhidaAtual]])
      );

      const idsLancados = new Set(itensDoGrupo.map((it) => it.id));
      setSelecionados((atual) => {
        const novo = new Set(atual);
        idsLancados.forEach((id) => novo.delete(id));
        return novo;
      });

      const proximoIndice = lancamentoEmAndamento.indice + 1;
      if (proximoIndice >= lancamentoEmAndamento.grupos.length) {
        setLancamentoEmAndamento(null);
        setAplicacaoEscolhidaManual(null);
      } else {
        setLancamentoEmAndamento({ ...lancamentoEmAndamento, indice: proximoIndice });
        setAplicacaoEscolhidaManual(null);
      }
    } catch {
      setErroLancamentoAtual("Não foi possível lançar este item. Tente novamente.");
    } finally {
      setLancandoAtual(false);
    }
  }

  async function handleExcluirComEscopo(escopo: EscopoExclusaoRecebido) {
    if (!excluindo) return;
    setErroExclusao("");
    setExcluindoOcorrencia(true);
    try {
      await excluirRecebidoComEscopo(excluindo, escopo);
      setExcluindo(null);
    } catch {
      setErroExclusao("Não foi possível excluir. Tente novamente.");
    } finally {
      setExcluindoOcorrencia(false);
    }
  }

  async function handleExcluirSelecionadosComEscopo(escopo: EscopoExclusaoRecebido) {
    setErroExclusaoSelecionados("");
    setExcluindoSelecionadosOcorrencia(true);
    try {
      for (const item of itensSelecionados) {
        await excluirRecebidoComEscopo(item, escopo);
      }
      setSelecionados(new Set());
      setExcluindoSelecionados(false);
    } catch {
      setErroExclusaoSelecionados("Não foi possível excluir alguns itens. Tente novamente.");
    } finally {
      setExcluindoSelecionadosOcorrencia(false);
    }
  }

  return (
    <div>
      <div
        className="sticky z-30 mb-6 rounded-xl border border-slate-200 bg-white shadow-sm print:static dark:border-slate-700 dark:bg-slate-800"
        style={{ top: stickyTop }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <ChaveModoEnviadosRecebidos modo={modo} onAlterar={onAlterarModo} />
          <SeletorMesAno ym={ym} onMudar={setYm} />
        </div>
        <div className="flex items-center justify-end gap-2 rounded-b-xl border-t border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/40">
          <button
            onClick={() => setExcluindoSelecionados(true)}
            disabled={itensSelecionados.length === 0}
            className="inline-flex h-[42px] min-w-[84px] shrink-0 items-center justify-center whitespace-nowrap rounded-lg border border-red-300 px-4 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
          >
            Excluir {itensSelecionados.length > 0 ? `(${itensSelecionados.length})` : ""}
          </button>
          <button
            onClick={iniciarLancamento}
            disabled={itensSelecionados.length === 0}
            className="inline-flex h-[42px] min-w-[84px] shrink-0 items-center justify-center whitespace-nowrap rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Lançar {itensSelecionados.length > 0 ? `(${itensSelecionados.length})` : ""}
          </button>
        </div>
      </div>

      {recebidosVisiveis.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum lançamento recebido neste mês.</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  <th className="w-14 py-2 pl-4">
                    <SeletorMarcarTodos
                      marcadoPagina={todosSelecionadosNaPagina}
                      onAlterarPagina={(marcado) => alternarTodosNaPagina(marcado)}
                      marcadoTodas={todosSelecionadosTodasAsPaginas}
                      onAlterarTodas={(marcado) => alternarTodosTodasAsPaginas(marcado)}
                      ariaLabelPagina="Selecionar todos nesta página"
                      ariaLabelTodas="Selecionar todos em todas as páginas"
                    />
                  </th>
                  <th className="py-2 pr-2">Credor</th>
                  <th className="py-2 pr-2">Observação</th>
                  <th className="py-2 pr-2">Aplicação</th>
                  <th className="py-2 pr-2">Parcela</th>
                  <th className="py-2 pr-2">Reembolso</th>
                  <th className="py-2 pr-2">Data</th>
                  <th className="py-2 pr-2 text-right">Valor</th>
                  <th className="py-2 pr-2">Status</th>
                  <th className="w-12 py-2 pr-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {paginados.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2.5 pl-4">
                      <input
                        type="checkbox"
                        checked={selecionados.has(r.id)}
                        onChange={(e) => alternarSelecao(r.id, e.target.checked)}
                        className="h-5 w-5 accent-indigo-600"
                        aria-label={`Selecionar recebido de ${r.deNome}`}
                      />
                    </td>
                    <td className="py-2.5 pr-2 font-medium text-slate-900 dark:text-slate-100">{r.deNome}</td>
                    <td className="py-2.5 pr-2 text-slate-600 dark:text-slate-400">{r.observacao || "—"}</td>
                    <td className="py-2.5 pr-2 text-slate-600 dark:text-slate-400">{r.aplicacaoSugerida}</td>
                    <td className="py-2.5 pr-2 text-slate-600 dark:text-slate-400">{r.parcela ?? "—"}</td>
                    <td className="py-2.5 pr-2 text-slate-600 dark:text-slate-400">
                      {r.compNome ? (
                        <span
                          className="cursor-help underline decoration-dotted"
                          title={`Credor real: ${r.credorReal ?? r.credorSugerido} · Valor real: ${formatarMoeda(r.valorReal ?? r.valor)}`}
                        >
                          {r.compNome}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2.5 pr-2 text-slate-600 dark:text-slate-400">
                      {dataExibicaoEnviado(r) ? formatarDataBR(dataExibicaoEnviado(r)!) : "—"}
                    </td>
                    <td className="py-2.5 pr-2 text-right font-medium text-slate-900 dark:text-slate-100">
                      {formatarMoeda(r.valor)}
                    </td>
                    <td className="py-2.5 pr-2">
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-950 dark:text-red-400">
                        Não Lançado
                      </span>
                    </td>
                    <td className="py-2.5 pr-4">
                      <button
                        onClick={() => {
                          setErroExclusao("");
                          setExcluindo(r);
                        }}
                        aria-label={`Excluir recebido de ${r.deNome}`}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600 dark:hover:bg-slate-700 dark:hover:text-red-400"
                      >
                        <IconExcluir className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Paginacao
            paginaAtual={paginaAtual}
            totalPaginas={totalPaginas}
            totalItens={recebidosVisiveis.length}
            itensPorPagina={config.itensPorPagina}
            onMudarPagina={setPaginaAtual}
          />
        </>
      )}

      <Modal aberto={!!lancamentoEmAndamento} onFechar={cancelarLancamento} titulo="Lançar em Contas a Pagar">
        {lancamentoEmAndamento && grupoAtual && (
          <div className="flex flex-col gap-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Lançamento {lancamentoEmAndamento.indice + 1} de {lancamentoEmAndamento.grupos.length}
            </p>
            <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
              <span className="font-medium text-slate-900 dark:text-slate-100">{grupoAtual.credorSugerido}</span>
              <span className="text-slate-500 dark:text-slate-400">{formatarMoeda(grupoAtual.valorTotal)}</span>
            </div>

            <label className="text-sm text-slate-600 dark:text-slate-300">
              Grupo
              <select
                value={grupoEscolhido}
                onChange={(e) => setGrupoEscolhidoManual(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                {gruposDisponiveis.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-slate-600 dark:text-slate-300">
              Aplicação
              <select
                value={aplicacaoEscolhidaAtual}
                onChange={(e) => setAplicacaoEscolhidaManual(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                {opcoesAplicacoes.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
            {!aplicacaoSugeridaAtualExiste && (
              <button
                type="button"
                onClick={handleCriarAplicacaoAtual}
                disabled={criandoAplicacao}
                className="self-start text-xs font-medium text-indigo-600 hover:underline disabled:opacity-50 dark:text-indigo-400"
              >
                {criandoAplicacao
                  ? "Criando..."
                  : `Criar aplicação "${grupoAtual.aplicacaoSugerida}" (usada por quem enviou) e usar aqui`}
              </button>
            )}

            {erroLancamentoAtual && <p className="text-sm text-red-600 dark:text-red-400">{erroLancamentoAtual}</p>}

            <button
              onClick={handleLancarAtual}
              disabled={lancandoAtual || !grupoEscolhido || !aplicacaoEscolhidaAtual}
              className={CLASSE_BOTAO_PRIMARIO}
            >
              {lancandoAtual
                ? "Lançando..."
                : lancamentoEmAndamento.indice + 1 < lancamentoEmAndamento.grupos.length
                  ? "Lançar e ir para o próximo"
                  : "Lançar"}
            </button>
            <button
              onClick={cancelarLancamento}
              disabled={lancandoAtual}
              className="text-center text-sm text-slate-500 disabled:opacity-50 dark:text-slate-400"
            >
              {lancamentoEmAndamento.indice > 0 ? "Parar por aqui" : "Cancelar"}
            </button>
          </div>
        )}
      </Modal>

      <Modal aberto={!!excluindo} onFechar={() => setExcluindo(null)} titulo="Excluir lançamento recebido">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            &quot;{excluindo?.deNome}&quot; — o que deseja excluir?
          </p>
          {erroExclusao && <p className="text-sm text-red-600 dark:text-red-400">{erroExclusao}</p>}
          <button
            onClick={() => handleExcluirComEscopo("mes")}
            disabled={excluindoOcorrencia}
            className="w-full rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Apenas este mês
          </button>
          <button
            onClick={() => handleExcluirComEscopo("futuros")}
            disabled={excluindoOcorrencia}
            className="w-full rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Este mês e os futuros
          </button>
          <button
            onClick={() => handleExcluirComEscopo("tudo")}
            disabled={excluindoOcorrencia}
            className="w-full rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {excluindoOcorrencia ? "Excluindo..." : "Todos (desde o início)"}
          </button>
          <button
            onClick={() => setExcluindo(null)}
            disabled={excluindoOcorrencia}
            className="text-center text-sm text-slate-500 dark:text-slate-400"
          >
            Cancelar
          </button>
        </div>
      </Modal>

      <Modal
        aberto={excluindoSelecionados}
        onFechar={() => setExcluindoSelecionados(false)}
        titulo="Excluir selecionados"
      >
        <div className="flex flex-col gap-2">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {itensSelecionados.length} lançamento{itensSelecionados.length !== 1 && "s"} selecionado
            {itensSelecionados.length !== 1 && "s"} — o que deseja excluir?
          </p>
          {erroExclusaoSelecionados && (
            <p className="text-sm text-red-600 dark:text-red-400">{erroExclusaoSelecionados}</p>
          )}
          <button
            onClick={() => handleExcluirSelecionadosComEscopo("mes")}
            disabled={excluindoSelecionadosOcorrencia}
            className="w-full rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Apenas este mês
          </button>
          <button
            onClick={() => handleExcluirSelecionadosComEscopo("futuros")}
            disabled={excluindoSelecionadosOcorrencia}
            className="w-full rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Este mês e os futuros
          </button>
          <button
            onClick={() => handleExcluirSelecionadosComEscopo("tudo")}
            disabled={excluindoSelecionadosOcorrencia}
            className="w-full rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {excluindoSelecionadosOcorrencia ? "Excluindo..." : "Todos (desde o início)"}
          </button>
          <button
            onClick={() => setExcluindoSelecionados(false)}
            disabled={excluindoSelecionadosOcorrencia}
            className="text-center text-sm text-slate-500 dark:text-slate-400"
          >
            Cancelar
          </button>
        </div>
      </Modal>
    </div>
  );
}
