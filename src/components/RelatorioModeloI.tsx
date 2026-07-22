"use client";

import { useEffect, useMemo, useState } from "react";
import { assinarParcelasDoMes, valorEfetivo } from "@/lib/parcelas";
import { assinarRecorrencias, mesclarComRecorrencias } from "@/lib/recorrencias";
import { assinarConfigListas, CONFIG_PADRAO } from "@/lib/config";
import { useMesAtual } from "@/contexts/MesAtualContext";
import { formatarDataBR, formatarMesAno, formatarMoeda } from "@/lib/date";
import { CLASSE_CARD } from "@/lib/estilos";
import FiltroMultiSelect from "@/components/FiltroMultiSelect";
import SeletorMesAno from "@/components/SeletorMesAno";
import { agrupar, SEM_COMP, subvalorReembolso, TabelaResumo } from "@/components/TabelaResumoRelatorio";
import { compartilharPdf, gerarPdfRelatorio, type LancamentoPdf, type ResumoPdf } from "@/lib/pdfRelatorio";
import type { ConfigListas, Parcela, Recorrencia } from "@/lib/types";

const GRID_COLS_RESUMO: Record<number, string> = {
  1: "md:grid-cols-1",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
};

export default function RelatorioModeloI({ uid }: { uid: string }) {
  const { ym, definirYm: setYm } = useMesAtual();
  const [parcelasReais, setParcelasReais] = useState<Parcela[]>([]);
  const [recorrencias, setRecorrencias] = useState<Recorrencia[]>([]);
  const [config, setConfig] = useState<ConfigListas>(CONFIG_PADRAO);
  const [filtroGrupos, setFiltroGrupos] = useState<Record<string, boolean>>({});
  const [filtroComp, setFiltroComp] = useState<Record<string, boolean>>({});
  const [filtroAplicacoes, setFiltroAplicacoes] = useState<Record<string, boolean>>({});
  const [carregando, setCarregando] = useState(true);
  const [compartilhando, setCompartilhando] = useState(false);

  useEffect(() => {
    return assinarConfigListas(uid, setConfig);
  }, [uid]);

  useEffect(() => {
    return assinarRecorrencias(uid, "pagar", setRecorrencias);
  }, [uid]);

  useEffect(() => {
    return assinarParcelasDoMes(uid, ym, (dados) => {
      setParcelasReais(dados);
      setCarregando(false);
    });
  }, [uid, ym]);

  function handleMudarMes(novoYm: string) {
    setCarregando(true);
    setYm(novoYm);
  }

  const todasParcelas = useMemo(
    () => mesclarComRecorrencias(parcelasReais, recorrencias, ym),
    [parcelasReais, recorrencias, ym]
  );

  const parcelas = useMemo(
    () =>
      todasParcelas.filter(
        (p) =>
          filtroGrupos[p.grupo] !== false &&
          filtroComp[p.comp ?? SEM_COMP] !== false &&
          filtroAplicacoes[p.aplicacao] !== false
      ),
    [todasParcelas, filtroGrupos, filtroComp, filtroAplicacoes]
  );

  const porGrupo = useMemo(() => agrupar(parcelas, (p) => p.grupo), [parcelas]);
  const porAplicacao = useMemo(() => agrupar(parcelas, (p) => p.aplicacao), [parcelas]);
  const porComp = useMemo(() => agrupar(parcelas, (p) => p.comp), [parcelas]);
  const total = parcelas.reduce((s, p) => s + valorEfetivo(p), 0);

  const qtdResumosVisiveis = [
    config.resumosRelatorio.formaPagamento,
    config.resumosRelatorio.aplicacao,
    config.resumosRelatorio.compartilhamento,
  ].filter(Boolean).length;

  async function handleCompartilhar() {
    setCompartilhando(true);
    try {
      const resumos: ResumoPdf[] = [];
      if (config.resumosRelatorio.formaPagamento) {
        resumos.push({ titulo: "Por forma de pagamento", linhas: porGrupo });
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
      const lancamentos: LancamentoPdf[] = parcelas.map((p) => ({
        credor: p.credor,
        observacao: p.observacao ?? "",
        parcela: p.recorrenciaId ? "Fixa" : p.parcelaTotal > 1 ? `${p.parcelaNum}/${p.parcelaTotal}` : "—",
        data: p.dataCompra ? formatarDataBR(p.dataCompra) : "—",
        reembolso: p.comp ?? "",
        valor: p.valorParcela,
      }));
      const titulo = `Relatório · ${formatarMesAno(ym)}`;
      const blob = gerarPdfRelatorio(titulo, resumos, lancamentos, total);
      await compartilharPdf(blob, `relatorio-${ym}.pdf`, titulo);
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        console.error(err);
      }
    } finally {
      setCompartilhando(false);
    }
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div className="flex flex-wrap gap-2">
          {config.grupos.length > 0 && (
            <FiltroMultiSelect
              rotulo="Forma de pagamento"
              opcoes={config.grupos}
              filtro={filtroGrupos}
              onAlternar={(item, visivel) =>
                setFiltroGrupos((atual) => ({ ...atual, [item]: visivel }))
              }
            />
          )}
          {config.aplicacoes.length > 0 && (
            <FiltroMultiSelect
              rotulo="Aplicação"
              opcoes={config.aplicacoes}
              filtro={filtroAplicacoes}
              onAlternar={(item, visivel) =>
                setFiltroAplicacoes((atual) => ({ ...atual, [item]: visivel }))
              }
            />
          )}
          <FiltroMultiSelect
            rotulo="Reembolso"
            opcoes={[...config.comp.map((c) => c.nome), SEM_COMP]}
            filtro={filtroComp}
            onAlternar={(item, visivel) =>
              setFiltroComp((atual) => ({ ...atual, [item]: visivel }))
            }
          />
          <button
            onClick={() => window.print()}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Imprimir
          </button>
          <button
            onClick={handleCompartilhar}
            disabled={compartilhando}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {compartilhando ? "Gerando..." : "Compartilhar"}
          </button>
        </div>

        <SeletorMesAno ym={ym} onMudar={handleMudarMes} />
      </div>

      <h1 className="mb-4 hidden text-lg font-semibold text-slate-900 print:block">
        Relatório · {formatarMesAno(ym)}
      </h1>

      {carregando ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Carregando...</p>
      ) : (
        <>
          {(config.resumosRelatorio.formaPagamento ||
            config.resumosRelatorio.aplicacao ||
            config.resumosRelatorio.compartilhamento) && (
            <div className={`mb-6 grid grid-cols-1 gap-4 ${GRID_COLS_RESUMO[qtdResumosVisiveis]}`}>
              {config.resumosRelatorio.formaPagamento && (
                <TabelaResumo titulo="Por forma de pagamento" linhas={porGrupo} />
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
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Todos os lançamentos</h2>
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatarMoeda(total)}</span>
            </div>
            {parcelas.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum lançamento neste mês.</p>
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
                    {parcelas.map((p) => (
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
