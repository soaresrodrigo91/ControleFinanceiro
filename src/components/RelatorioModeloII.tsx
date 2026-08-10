"use client";

import { useEffect, useMemo, useState } from "react";
import { assinarParcelasDoIntervalo, assinarTodasParcelas, valorEfetivo } from "@/lib/parcelas";
import { assinarRecorrencias, mesclarComRecorrenciasIntervalo } from "@/lib/recorrencias";
import { assinarConfigListas, CONFIG_PADRAO, gruposAtivos } from "@/lib/config";
import { useMesAtual } from "@/contexts/MesAtualContext";
import { dataBrParaIso, formatarDataBR, formatarMoeda } from "@/lib/date";
import { formatarDataDigitada } from "@/lib/mascara";
import { CLASSE_CARD, CLASSE_INPUT } from "@/lib/estilos";
import CampoCredor from "@/components/CampoCredor";
import FiltroMultiSelect from "@/components/FiltroMultiSelect";
import { agrupar, SEM_COMP, subvalorReembolso, TabelaResumo } from "@/components/TabelaResumoRelatorio";
import { compartilharPdf, gerarPdfRelatorio, type LancamentoPdf, type ResumoPdf } from "@/lib/pdfRelatorio";
import type { ConfigListas, Parcela, Recorrencia } from "@/lib/types";

const GRID_COLS_RESUMO: Record<number, string> = {
  1: "md:grid-cols-1",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
};

function intervaloDoMes(ym: string): { inicio: string; fim: string } {
  const [ano, mes] = ym.split("-").map(Number);
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    inicio: `01/${pad(mes)}/${ano}`,
    fim: `${pad(ultimoDia)}/${pad(mes)}/${ano}`,
  };
}

export default function RelatorioModeloII({ uid }: { uid: string }) {
  const { ym: ymCompartilhado } = useMesAtual();
  const [config, setConfig] = useState<ConfigListas>(CONFIG_PADRAO);
  const [todasParcelasHistorico, setTodasParcelasHistorico] = useState<Parcela[]>([]);
  const [parcelasReais, setParcelasReais] = useState<Parcela[]>([]);
  const [recorrencias, setRecorrencias] = useState<Recorrencia[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [credor, setCredor] = useState("");
  const [credoresFiltro, setCredoresFiltro] = useState<string[]>([]);
  const [filtroGrupos, setFiltroGrupos] = useState<Record<string, boolean>>({});
  const [filtroAplicacoes, setFiltroAplicacoes] = useState<Record<string, boolean>>({});
  const [filtroComp, setFiltroComp] = useState<Record<string, boolean>>({});
  const [dataInicio, setDataInicio] = useState(() => intervaloDoMes(ymCompartilhado).inicio);
  const [dataFim, setDataFim] = useState(() => intervaloDoMes(ymCompartilhado).fim);
  const [erroData, setErroData] = useState("");
  const [compartilhando, setCompartilhando] = useState(false);

  const [ymSincronizado, setYmSincronizado] = useState(ymCompartilhado);
  if (ymCompartilhado !== ymSincronizado) {
    setYmSincronizado(ymCompartilhado);
    const intervalo = intervaloDoMes(ymCompartilhado);
    setDataInicio(intervalo.inicio);
    setDataFim(intervalo.fim);
    setErroData("");
  }

  useEffect(() => {
    return assinarConfigListas(uid, setConfig);
  }, [uid]);

  useEffect(() => {
    return assinarRecorrencias(uid, "pagar", setRecorrencias);
  }, [uid]);

  useEffect(() => {
    return assinarTodasParcelas(uid, setTodasParcelasHistorico);
  }, [uid]);

  const ymInicio = dataBrParaIso(dataInicio)?.slice(0, 7) ?? ymCompartilhado;
  const ymFim = dataBrParaIso(dataFim)?.slice(0, 7) ?? ymCompartilhado;

  useEffect(() => {
    return assinarParcelasDoIntervalo(uid, ymInicio, ymFim, (dados) => {
      setParcelasReais(dados);
      setCarregando(false);
    });
  }, [uid, ymInicio, ymFim]);

  const todasParcelas = useMemo(
    () => mesclarComRecorrenciasIntervalo(parcelasReais, recorrencias, ymInicio, ymFim),
    [parcelasReais, recorrencias, ymInicio, ymFim]
  );

  const credoresConhecidos = useMemo(() => {
    return [...new Set(todasParcelasHistorico.map((p) => p.credor))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [todasParcelasHistorico]);

  const credorNormalizado = credor.trim().toLowerCase();

  // Termos que somam no filtro: os credores já adicionados (Enter ou clique numa sugestão)
  // mais o que está sendo digitado agora, mesmo antes de adicionar — assim a lista já filtra
  // ao vivo enquanto o usuário digita, sem esperar ele confirmar o nome.
  const termosCredor = useMemo(() => {
    const termos = credoresFiltro.map((c) => c.toLowerCase());
    if (credorNormalizado && !termos.includes(credorNormalizado)) termos.push(credorNormalizado);
    return termos;
  }, [credoresFiltro, credorNormalizado]);

  function adicionarCredorAoFiltro(nome?: string) {
    const termo = (nome ?? credor).trim();
    if (!termo) return;
    setCredoresFiltro((atual) =>
      atual.some((c) => c.toLowerCase() === termo.toLowerCase()) ? atual : [...atual, termo]
    );
    setCredor("");
  }

  function removerCredorDoFiltro(nome: string) {
    setCredoresFiltro((atual) => atual.filter((c) => c !== nome));
  }

  const parcelasFiltradas = useMemo(() => {
    return todasParcelas.filter((p) => {
      if (termosCredor.length > 0 && !termosCredor.some((t) => p.credor.toLowerCase().includes(t))) return false;
      if (config.gruposInativosDesde?.[p.grupo]) return false;
      if (filtroGrupos[p.grupo] === false) return false;
      if (filtroAplicacoes[p.aplicacao] === false) return false;
      if (filtroComp[p.comp ?? SEM_COMP] === false) return false;
      const inicioValido = dataBrParaIso(dataInicio);
      const fimValido = dataBrParaIso(dataFim);
      if (inicioValido && p.vencimento < inicioValido) return false;
      if (fimValido && p.vencimento > fimValido) return false;
      return true;
    });
  }, [
    todasParcelas,
    termosCredor,
    config.gruposInativosDesde,
    filtroGrupos,
    filtroAplicacoes,
    filtroComp,
    dataInicio,
    dataFim,
  ]);

  const total = parcelasFiltradas.reduce((s, p) => s + valorEfetivo(p), 0);

  const porGrupo = useMemo(() => agrupar(parcelasFiltradas, (p) => p.grupo), [parcelasFiltradas]);
  const porAplicacao = useMemo(() => agrupar(parcelasFiltradas, (p) => p.aplicacao), [parcelasFiltradas]);
  const porComp = useMemo(() => agrupar(parcelasFiltradas, (p) => p.comp), [parcelasFiltradas]);

  const qtdResumosVisiveis = [
    config.resumosRelatorio.formaPagamento,
    config.resumosRelatorio.aplicacao,
    config.resumosRelatorio.compartilhamento,
  ].filter(Boolean).length;

  async function handleCompartilhar() {
    if (!datasValidas()) return;
    setCompartilhando(true);
    try {
      const resumos: ResumoPdf[] = [];
      if (config.resumosRelatorio.formaPagamento) {
        resumos.push({ titulo: "Por grupo", linhas: porGrupo });
      }
      if (config.resumosRelatorio.aplicacao) {
        resumos.push({ titulo: "Por aplicação", linhas: porAplicacao });
      }
      if (config.resumosRelatorio.compartilhamento) {
        resumos.push({
          titulo: "Por reembolso",
          linhas: porComp,
          subvalor: (chave, valor) => subvalorReembolso(config, chave, valor),
        });
      }
      const lancamentos: LancamentoPdf[] = parcelasFiltradas.map((p) => ({
        credor: p.credor,
        observacao: p.observacao ?? "",
        parcela: p.recorrenciaId ? "Fixa" : p.parcelaTotal > 1 ? `${p.parcelaNum}/${p.parcelaTotal}` : "—",
        data: p.dataCompra ? formatarDataBR(p.dataCompra) : "—",
        reembolso: p.comp ?? "",
        valor: p.valorParcela,
      }));
      const titulo = "Relatório Modelo II";
      const blob = gerarPdfRelatorio(titulo, resumos, lancamentos, total);
      await compartilharPdf(blob, "relatorio-modelo-ii.pdf", titulo);
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        console.error(err);
      }
    } finally {
      setCompartilhando(false);
    }
  }

  function validarIntervalo(inicio: string, fim: string) {
    const iniIso = dataBrParaIso(inicio);
    const fimIso = dataBrParaIso(fim);
    if (iniIso && fimIso && fimIso < iniIso) {
      setErroData("A data final não pode ser anterior à inicial.");
      setDataFim("");
      return;
    }
    setErroData("");
  }

  function aoSairDataInicio() {
    if (dataInicio && !dataBrParaIso(dataInicio)) {
      setErroData("Informe a data inicial completa (dd/mm/aaaa).");
      setDataInicio("");
      return;
    }
    validarIntervalo(dataInicio, dataFim);
  }

  function aoSairDataFim() {
    if (dataFim && !dataBrParaIso(dataFim)) {
      setErroData("Informe a data final completa (dd/mm/aaaa).");
      setDataFim("");
      return;
    }
    validarIntervalo(dataInicio, dataFim);
  }

  function datasValidas(): boolean {
    const iniIso = dataBrParaIso(dataInicio);
    const fimIso = dataBrParaIso(dataFim);
    if (!dataInicio || !iniIso) {
      setErroData("Informe a data inicial completa (dd/mm/aaaa) antes de continuar.");
      return false;
    }
    if (!dataFim || !fimIso) {
      setErroData("Informe a data final completa (dd/mm/aaaa) antes de continuar.");
      return false;
    }
    if (fimIso < iniIso) {
      setErroData("A data final não pode ser anterior à inicial.");
      return false;
    }
    setErroData("");
    return true;
  }

  return (
    <>
      <div className="mb-2 flex flex-wrap items-end gap-2 print:hidden">
        <div
          className="w-44"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              adicionarCredorAoFiltro();
            }
          }}
        >
          <CampoCredor
            id="relatorio2-credor"
            label="Credor"
            value={credor}
            onChange={setCredor}
            opcoes={credoresConhecidos}
            ativo={config.sugestaoCredor}
            placeholder="Digite o nome"
            onSelecionarSugestao={adicionarCredorAoFiltro}
          />
        </div>
        {gruposAtivos(config).length > 0 && (
          <FiltroMultiSelect
            rotulo="Grupo"
            opcoes={gruposAtivos(config)}
            filtro={filtroGrupos}
            onAlternar={(item, visivel) => setFiltroGrupos((atual) => ({ ...atual, [item]: visivel }))}
          />
        )}
        {config.aplicacoes.length > 0 && (
          <FiltroMultiSelect
            rotulo="Aplicação"
            opcoes={config.aplicacoes}
            filtro={filtroAplicacoes}
            onAlternar={(item, visivel) => setFiltroAplicacoes((atual) => ({ ...atual, [item]: visivel }))}
          />
        )}
        <FiltroMultiSelect
          rotulo="Reembolso"
          opcoes={[...config.comp.map((c) => c.nome), SEM_COMP]}
          filtro={filtroComp}
          onAlternar={(item, visivel) => setFiltroComp((atual) => ({ ...atual, [item]: visivel }))}
        />
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">De</label>
          <input
            type="text"
            inputMode="numeric"
            value={dataInicio}
            onChange={(e) => setDataInicio(formatarDataDigitada(e.target.value))}
            onBlur={aoSairDataInicio}
            placeholder="dd/mm/aaaa"
            className={`${CLASSE_INPUT} w-28 text-sm`}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Até</label>
          <input
            type="text"
            inputMode="numeric"
            value={dataFim}
            onChange={(e) => setDataFim(formatarDataDigitada(e.target.value))}
            onBlur={aoSairDataFim}
            placeholder="dd/mm/aaaa"
            className={`${CLASSE_INPUT} w-28 text-sm`}
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => datasValidas() && window.print()}
            className="h-[42px] shrink-0 rounded-lg bg-indigo-600 px-3 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Imprimir
          </button>
          <button
            onClick={handleCompartilhar}
            disabled={compartilhando}
            className="h-[42px] shrink-0 rounded-lg bg-indigo-600 px-3 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {compartilhando ? "Gerando..." : "Compartilhar"}
          </button>
        </div>
      </div>
      {credoresFiltro.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1 print:hidden">
          {credoresFiltro.map((nome) => (
            <span
              key={nome}
              className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
            >
              {nome}
              <button
                type="button"
                onClick={() => removerCredorDoFiltro(nome)}
                aria-label={`Remover ${nome} do filtro de credor`}
                className="text-indigo-400 hover:text-indigo-700 dark:text-indigo-500 dark:hover:text-indigo-300"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      {erroData && <p className="mb-4 text-xs text-red-600 dark:text-red-400 print:hidden">{erroData}</p>}

      <h1 className="mb-4 hidden text-lg font-semibold text-slate-900 print:block">Relatório Modelo II</h1>

      {carregando ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Carregando...</p>
      ) : (
        <>
          {(config.resumosRelatorio.formaPagamento ||
            config.resumosRelatorio.aplicacao ||
            config.resumosRelatorio.compartilhamento) && (
            <div className={`mb-6 grid grid-cols-1 gap-4 ${GRID_COLS_RESUMO[qtdResumosVisiveis]}`}>
              {config.resumosRelatorio.formaPagamento && (
                <TabelaResumo titulo="Por grupo" linhas={porGrupo} />
              )}
              {config.resumosRelatorio.aplicacao && (
                <TabelaResumo titulo="Por aplicação" linhas={porAplicacao} />
              )}
              {config.resumosRelatorio.compartilhamento && (
                <TabelaResumo
                  titulo="Por reembolso"
                  linhas={porComp}
                  subvalor={(chave, valor) => subvalorReembolso(config, chave, valor)}
                />
              )}
            </div>
          )}

        <div className={`hidden print:block ${CLASSE_CARD}`}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {parcelasFiltradas.length} lançamento{parcelasFiltradas.length !== 1 && "s"}
            </h2>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatarMoeda(total)}</span>
          </div>
          {parcelasFiltradas.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum lançamento encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    <th className="py-2 pr-2">Credor</th>
                    <th className="py-2 pr-2">Observação</th>
                    <th className="py-2 pr-2">Parcela</th>
                    <th className="py-2 pr-2">Data</th>
                    <th className="py-2 pr-2">Reembolso</th>
                    <th className="py-2 pr-2 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {parcelasFiltradas.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2.5 pr-2 font-medium text-slate-900 dark:text-slate-100">
                        {p.credor}
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        </>
      )}
    </>
  );
}
