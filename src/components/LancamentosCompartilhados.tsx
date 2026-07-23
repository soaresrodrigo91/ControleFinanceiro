"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  assinarEnviados,
  assinarRecebidos,
  assinarVinculos,
  candidatosParaCompartilhar,
  compartilharSelecionados,
  excluirEnviadoComEscopo,
  excluirRecebidoComEscopo,
  lancarSelecionados,
  reenviarSelecionados,
  vinculoPorCompNome,
  type EscopoExclusaoRecebido,
} from "@/lib/compartilhamento";
import { assinarParcelasDoMes } from "@/lib/parcelas";
import { assinarRecorrencias, mesclarComRecorrencias } from "@/lib/recorrencias";
import { GRUPO_PROVISAO } from "@/lib/config";
import { assinarPerfil } from "@/lib/perfil";
import { useMesAtual } from "@/contexts/MesAtualContext";
import { formatarDataBR, formatarMoeda } from "@/lib/date";
import SeletorMesAno from "@/components/SeletorMesAno";
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
  if (p.parcelaTotal > 1) return `${p.parcelaNum}/${p.parcelaTotal}`;
  return "—";
}

export default function LancamentosCompartilhados({
  uid,
  email,
  config,
  stickyTop = 0,
  modoInicial = "enviados",
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

  return (
    <div>
      <div
        className="sticky z-10 mb-4 flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm print:static dark:border-slate-700 dark:bg-slate-800"
        style={{ top: stickyTop }}
      >
        <button
          onClick={() => setModo("enviados")}
          className={`rounded-lg px-4 py-1.5 text-sm font-medium ${
            modo === "enviados"
              ? "bg-indigo-600 text-white"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
          }`}
        >
          Enviados
        </button>
        <button
          onClick={() => setModo("recebidos")}
          className={`rounded-lg px-4 py-1.5 text-sm font-medium ${
            modo === "recebidos"
              ? "bg-indigo-600 text-white"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
          }`}
        >
          Recebidos
        </button>
      </div>

      {modo === "enviados" ? (
        <AbaEnviados uid={uid} email={email} nome={nome} config={config} vinculos={vinculos} />
      ) : (
        <AbaRecebidos uid={uid} config={config} />
      )}
    </div>
  );
}

function AbaEnviados({
  uid,
  email,
  nome,
  config,
  vinculos,
}: {
  uid: string;
  email: string;
  nome: string;
  config: ConfigListas;
  vinculos: VinculoCompartilhamento[];
}) {
  const { ym, definirYm: setYm } = useMesAtual();
  const [recorrencias, setRecorrencias] = useState<Recorrencia[]>([]);
  const [estadoMes, setEstadoMes] = useState<{ ym: string; parcelasReais: Parcela[] }>({ ym: "", parcelasReais: [] });
  const [enviados, setEnviados] = useState<LancamentoCompartilhado[]>([]);
  const [mostrarEnviados, setMostrarEnviados] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [confirmando, setConfirmando] = useState(false);
  const [confirmandoReenvio, setConfirmandoReenvio] = useState(false);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [excluindo, setExcluindo] = useState<LancamentoCompartilhado | null>(null);
  const [excluindoOcorrencia, setExcluindoOcorrencia] = useState(false);

  useEffect(() => {
    return assinarRecorrencias(uid, "pagar", setRecorrencias);
  }, [uid]);

  useEffect(() => {
    return assinarParcelasDoMes(uid, ym, (dados) => setEstadoMes({ ym, parcelasReais: dados }));
  }, [uid, ym]);

  useEffect(() => {
    return assinarEnviados(uid, setEnviados);
  }, [uid]);

  function handleAlternarMostrarEnviados(marcado: boolean) {
    setMostrarEnviados(marcado);
    setSelecionados(new Set());
    setPaginaAtual(1);
  }

  const carregando = estadoMes.ym !== ym;

  const todasParcelas = useMemo(
    () => (carregando ? [] : mesclarComRecorrencias(estadoMes.parcelasReais, recorrencias, ym)),
    [carregando, estadoMes, recorrencias, ym]
  );

  const candidatos = useMemo(() => candidatosParaCompartilhar(todasParcelas, vinculos), [todasParcelas, vinculos]);

  const origensCompartilhadas = useMemo(() => new Set(enviados.map((e) => e.lancamentoOrigemId)), [enviados]);

  const naoEnviados = useMemo(
    () => candidatos.filter((p) => !origensCompartilhadas.has(p.id)),
    [candidatos, origensCompartilhadas]
  );

  const enviadosDoMes = useMemo(() => enviados.filter((e) => e.vencimento.slice(0, 7) === ym), [enviados, ym]);

  const totalItens = mostrarEnviados ? enviadosDoMes.length : naoEnviados.length;
  const totalPaginas = totalDePaginas(totalItens, config.itensPorPagina);
  const paginadosParcelas = useMemo(
    () => paginar(naoEnviados, config.itensPorPagina, paginaAtual),
    [naoEnviados, config.itensPorPagina, paginaAtual]
  );
  const paginadosEnviados = useMemo(
    () => paginar(enviadosDoMes, config.itensPorPagina, paginaAtual),
    [enviadosDoMes, config.itensPorPagina, paginaAtual]
  );

  const idsVisiveis = mostrarEnviados ? paginadosEnviados.map((e) => e.id) : paginadosParcelas.map((p) => p.id);
  const todosSelecionadosNaPagina = idsVisiveis.length > 0 && idsVisiveis.every((id) => selecionados.has(id));

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

  const itensSelecionados = naoEnviados.filter((p) => selecionados.has(p.id));
  const enviadosSelecionados = enviadosDoMes.filter((e) => selecionados.has(e.id));

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
  const nomesDestinatariosReenvio = useMemo(
    () => nomesDestinatariosDe(enviadosSelecionados.map((e) => e.compNome)),
    [enviadosSelecionados, nomesDestinatariosDe]
  );

  async function handleConfirmarCompartilhar() {
    await compartilharSelecionados(uid, nome, email, itensSelecionados, config, vinculos, recorrencias, enviados);
    setSelecionados(new Set());
    setConfirmando(false);
  }

  async function handleConfirmarReenvio() {
    await reenviarSelecionados(uid, nome, enviadosSelecionados);
    setSelecionados(new Set());
    setConfirmandoReenvio(false);
  }

  async function handleExcluirComEscopo(escopo: EscopoExclusaoRecebido) {
    if (!excluindo) return;
    setExcluindoOcorrencia(true);
    try {
      await excluirEnviadoComEscopo(excluindo, escopo);
      setExcluindo(null);
    } finally {
      setExcluindoOcorrencia(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {mostrarEnviados ? (
            <button
              onClick={() => setConfirmandoReenvio(true)}
              disabled={enviadosSelecionados.length === 0}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Reenviar Lançamento {enviadosSelecionados.length > 0 ? `(${enviadosSelecionados.length})` : ""}
            </button>
          ) : (
            <button
              onClick={() => setConfirmando(true)}
              disabled={itensSelecionados.length === 0}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Compartilhar {itensSelecionados.length > 0 ? `(${itensSelecionados.length})` : ""}
            </button>
          )}
          <label className="flex h-[42px] cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm dark:border-slate-600">
            <input
              type="checkbox"
              checked={mostrarEnviados}
              onChange={(e) => handleAlternarMostrarEnviados(e.target.checked)}
              className="h-4 w-4 accent-indigo-600"
            />
            Enviados
          </label>
        </div>
        <SeletorMesAno ym={ym} onMudar={setYm} />
      </div>

      {carregando ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Carregando...</p>
      ) : totalItens === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {mostrarEnviados
            ? "Nenhum lançamento enviado neste mês."
            : "Nenhum lançamento pendente de envio neste mês."}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  <th className="w-10 py-2 pl-4">
                    <input
                      type="checkbox"
                      checked={todosSelecionadosNaPagina}
                      onChange={(e) => alternarTodosNaPagina(e.target.checked)}
                      className="h-5 w-5 accent-indigo-600"
                      aria-label="Selecionar todos nesta página"
                    />
                  </th>
                  <th className="py-2 pr-2">Credor</th>
                  <th className="py-2 pr-2">Observação</th>
                  <th className="py-2 pr-2">Parcela</th>
                  <th className="py-2 pr-2">Reembolso</th>
                  <th className="py-2 pr-2">Data</th>
                  <th className="py-2 pr-2 text-right">Valor</th>
                  <th className="py-2 pr-2">Status</th>
                  <th className="w-12 py-2 pr-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {mostrarEnviados
                  ? paginadosEnviados.map((e) => (
                      <tr key={e.id}>
                        <td className="py-2.5 pl-4">
                          <input
                            type="checkbox"
                            checked={selecionados.has(e.id)}
                            onChange={(ev) => alternarSelecao(e.id, ev.target.checked)}
                            className="h-5 w-5 accent-indigo-600"
                            aria-label={`Selecionar ${e.credorSugerido}`}
                          />
                        </td>
                        <td className="py-2.5 pr-2 font-medium text-slate-900 dark:text-slate-100">
                          {e.credorSugerido}
                        </td>
                        <td className="py-2.5 pr-2 text-slate-600 dark:text-slate-400">{e.observacao || "—"}</td>
                        <td className="py-2.5 pr-2 text-slate-600 dark:text-slate-400">{e.parcela}</td>
                        <td className="py-2.5 pr-2 text-slate-600 dark:text-slate-400">{e.compNome}</td>
                        <td className="py-2.5 pr-2 text-slate-600 dark:text-slate-400">
                          {e.dataCompra ? formatarDataBR(e.dataCompra) : "—"}
                        </td>
                        <td className="py-2.5 pr-2 text-right font-medium text-slate-900 dark:text-slate-100">
                          {formatarMoeda(e.valor)}
                        </td>
                        <td className="py-2.5 pr-2">
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                            Enviado
                          </span>
                        </td>
                        <td className="py-2.5 pr-4">
                          <button
                            onClick={() => setExcluindo(e)}
                            aria-label={`Excluir compartilhamento de ${e.credorSugerido}`}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600 dark:hover:bg-slate-700 dark:hover:text-red-400"
                          >
                            <IconExcluir className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  : paginadosParcelas.map((p) => (
                      <tr key={p.id}>
                        <td className="py-2.5 pl-4">
                          <input
                            type="checkbox"
                            checked={selecionados.has(p.id)}
                            onChange={(ev) => alternarSelecao(p.id, ev.target.checked)}
                            className="h-5 w-5 accent-indigo-600"
                            aria-label={`Selecionar ${p.credor}`}
                          />
                        </td>
                        <td className="py-2.5 pr-2 font-medium text-slate-900 dark:text-slate-100">{p.credor}</td>
                        <td className="py-2.5 pr-2 text-slate-600 dark:text-slate-400">{p.observacao || "—"}</td>
                        <td className="py-2.5 pr-2 text-slate-600 dark:text-slate-400">{parcelaDaParcela(p)}</td>
                        <td className="py-2.5 pr-2 text-slate-600 dark:text-slate-400">{p.comp ?? "—"}</td>
                        <td className="py-2.5 pr-2 text-slate-600 dark:text-slate-400">
                          {p.dataCompra ? formatarDataBR(p.dataCompra) : "—"}
                        </td>
                        <td className="py-2.5 pr-2 text-right font-medium text-slate-900 dark:text-slate-100">
                          {formatarMoeda(p.valorParcela)}
                        </td>
                        <td className="py-2.5 pr-2">
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-950 dark:text-red-400">
                            Não enviado
                          </span>
                        </td>
                        <td className="py-2.5 pr-4"></td>
                      </tr>
                    ))}
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

      <Modal aberto={confirmandoReenvio} onFechar={() => setConfirmandoReenvio(false)} titulo="Confirmar reenvio">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {nomesDestinatariosReenvio.length > 0
              ? `Estes lançamentos serão reenviados para ${nomesDestinatariosReenvio.join(", ")}.`
              : "Estes lançamentos serão reenviados."}
          </p>
          <button onClick={handleConfirmarReenvio} className={CLASSE_BOTAO_PRIMARIO}>
            Confirmar
          </button>
          <button
            onClick={() => setConfirmandoReenvio(false)}
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
            na sua Contas a Pagar; só o envio para {excluindo?.compNome} é desfeito.
          </p>
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
    </div>
  );
}

function AbaRecebidos({
  uid,
  config,
}: {
  uid: string;
  config: ConfigListas;
}) {
  const { ym, definirYm: setYm } = useMesAtual();
  const [recebidos, setRecebidos] = useState<LancamentoCompartilhado[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [confirmandoLancar, setConfirmandoLancar] = useState(false);
  const [grupoEscolhidoManual, setGrupoEscolhidoManual] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState<LancamentoCompartilhado | null>(null);
  const [excluindoOcorrencia, setExcluindoOcorrencia] = useState(false);

  const gruposDisponiveis = useMemo(() => config.grupos.filter((g) => g !== GRUPO_PROVISAO), [config.grupos]);
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

  const itensSelecionados = recebidosVisiveis.filter((r) => selecionados.has(r.id));

  async function handleConfirmarLancar() {
    if (!grupoEscolhido) return;
    await lancarSelecionados(uid, itensSelecionados, grupoEscolhido);
    setSelecionados(new Set());
    setConfirmandoLancar(false);
  }

  async function handleExcluirComEscopo(escopo: EscopoExclusaoRecebido) {
    if (!excluindo) return;
    setExcluindoOcorrencia(true);
    try {
      await excluirRecebidoComEscopo(excluindo, escopo);
      setExcluindo(null);
    } finally {
      setExcluindoOcorrencia(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => setConfirmandoLancar(true)}
          disabled={itensSelecionados.length === 0}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          Lançar {itensSelecionados.length > 0 ? `(${itensSelecionados.length})` : ""}
        </button>
        <SeletorMesAno ym={ym} onMudar={setYm} />
      </div>

      {recebidosVisiveis.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum lançamento recebido neste mês.</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  <th className="w-10 py-2 pl-4">
                    <input
                      type="checkbox"
                      checked={todosSelecionadosNaPagina}
                      onChange={(e) => alternarTodosNaPagina(e.target.checked)}
                      className="h-5 w-5 accent-indigo-600"
                      aria-label="Selecionar todos nesta página"
                    />
                  </th>
                  <th className="py-2 pr-2">Credor</th>
                  <th className="py-2 pr-2">Observação</th>
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
                    <td className="py-2.5 pr-2 text-slate-600 dark:text-slate-400">{r.parcela ?? "—"}</td>
                    <td className="py-2.5 pr-2 text-slate-600 dark:text-slate-400">{r.compNome ?? "—"}</td>
                    <td className="py-2.5 pr-2 text-slate-600 dark:text-slate-400">
                      {r.dataCompra ? formatarDataBR(r.dataCompra) : "—"}
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
                        onClick={() => setExcluindo(r)}
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

      <Modal aberto={confirmandoLancar} onFechar={() => setConfirmandoLancar(false)} titulo="Lançar em Contas a Pagar">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Escolha a forma de pagamento para lançar {itensSelecionados.length} item
            {itensSelecionados.length !== 1 && "s"} na sua conta.
          </p>
          <select
            value={grupoEscolhido}
            onChange={(e) => setGrupoEscolhidoManual(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          >
            {gruposDisponiveis.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          <button onClick={handleConfirmarLancar} disabled={!grupoEscolhido} className={CLASSE_BOTAO_PRIMARIO}>
            Confirmar lançamento
          </button>
          <button
            onClick={() => setConfirmandoLancar(false)}
            className="text-center text-sm text-slate-500 dark:text-slate-400"
          >
            Cancelar
          </button>
        </div>
      </Modal>

      <Modal aberto={!!excluindo} onFechar={() => setExcluindo(null)} titulo="Excluir lançamento recebido">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            &quot;{excluindo?.deNome}&quot; — o que deseja excluir?
          </p>
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
    </div>
  );
}
