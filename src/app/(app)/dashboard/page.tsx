"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useMesAtual } from "@/contexts/MesAtualContext";
import { assinarConfigListas, CONFIG_PADRAO, gruposAtivos } from "@/lib/config";
import { assinarTodasParcelas } from "@/lib/parcelas";
import { assinarTodosRecebimentos } from "@/lib/recebimentos";
import { formatarMoeda } from "@/lib/date";
import { CLASSE_CARD } from "@/lib/estilos";
import FiltroMultiSelect from "@/components/FiltroMultiSelect";
import SeletorMesAno from "@/components/SeletorMesAno";
import { useTheme } from "@/contexts/ThemeContext";
import { GraficoItem, type ItemGrafico } from "@/components/GraficoCategoria";
import type { ConfigListas, Parcela, Recebimento } from "@/lib/types";

const PALETA_CATEGORICA_LIGHT = [
  "#2a78d6",
  "#008300",
  "#e87ba4",
  "#eda100",
  "#1baf7a",
  "#eb6834",
  "#4a3aa7",
  "#e34948",
];
const PALETA_CATEGORICA_DARK = [
  "#3987e5",
  "#008300",
  "#d55181",
  "#c98500",
  "#199e70",
  "#d95926",
  "#9085e9",
  "#e66767",
];
const COR_OUTROS = "#898781";
const COR_GRID_LIGHT = "#e1e0d9";
const COR_GRID_DARK = "#2c2c2a";
const COR_TEXTO_SECUNDARIO_LIGHT = "#52514e";
const COR_TEXTO_SECUNDARIO_DARK = "#c3c2b7";

const SEM_COMP = "(sem reembolso)";
const SEM_OBSERVACAO = "(sem observação)";

function agruparPorLista(
  parcelas: Parcela[],
  campo: "grupo" | "aplicacao",
  listaConfig: string[],
  paleta: string[]
): ItemGrafico[] {
  const somaPorNome = new Map<string, number>();
  for (const p of parcelas) {
    const chave = p[campo];
    somaPorNome.set(chave, (somaPorNome.get(chave) ?? 0) + p.valorParcela);
  }

  const itens: ItemGrafico[] = [];
  let somaOutros = 0;

  listaConfig.forEach((nome, indice) => {
    const valor = somaPorNome.get(nome);
    if (!valor) return;
    if (indice < paleta.length) {
      itens.push({ nome, valor, cor: paleta[indice] });
    } else {
      somaOutros += valor;
    }
    somaPorNome.delete(nome);
  });

  for (const valor of somaPorNome.values()) {
    somaOutros += valor;
  }

  if (somaOutros > 0) {
    itens.push({ nome: "Outros", valor: somaOutros, cor: COR_OUTROS });
  }

  return itens.sort((a, b) => b.valor - a.valor);
}

function agruparCampoLivre(
  itens: { chave: string; valor: number }[],
  paleta: string[]
): ItemGrafico[] {
  const somaPorNome = new Map<string, number>();
  for (const { chave, valor } of itens) {
    somaPorNome.set(chave, (somaPorNome.get(chave) ?? 0) + valor);
  }

  const ordenado = [...somaPorNome.entries()].sort((a, b) => b[1] - a[1]);
  const resultado: ItemGrafico[] = [];
  let somaOutros = 0;

  ordenado.forEach(([nome, valor], indice) => {
    if (indice < paleta.length) {
      resultado.push({ nome, valor, cor: paleta[indice] });
    } else {
      somaOutros += valor;
    }
  });

  if (somaOutros > 0) {
    resultado.push({ nome: "Outros", valor: somaOutros, cor: COR_OUTROS });
  }

  return resultado;
}

export default function DashboardGeralPage() {
  const { usuario } = useAuth();
  const { tema } = useTheme();
  const paleta = tema === "dark" ? PALETA_CATEGORICA_DARK : PALETA_CATEGORICA_LIGHT;
  const corGrid = tema === "dark" ? COR_GRID_DARK : COR_GRID_LIGHT;
  const corTextoSecundario = tema === "dark" ? COR_TEXTO_SECUNDARIO_DARK : COR_TEXTO_SECUNDARIO_LIGHT;
  const [config, setConfig] = useState<ConfigListas>(CONFIG_PADRAO);
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [recebimentos, setRecebimentos] = useState<Recebimento[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [tipoConta, setTipoConta] = useState<"pagar" | "receber">("pagar");
  const [filtroGrupos, setFiltroGrupos] = useState<Record<string, boolean>>({});
  const [filtroComp, setFiltroComp] = useState<Record<string, boolean>>({});
  const [filtroAplicacoes, setFiltroAplicacoes] = useState<Record<string, boolean>>({});
  const [filtroOrigem, setFiltroOrigem] = useState<Record<string, boolean>>({});
  const { ym, definirYm: setYm } = useMesAtual();
  const [tipoGrafico, setTipoGrafico] = useState<"barra" | "pizza">("pizza");

  useEffect(() => {
    if (!usuario) return;
    return assinarConfigListas(usuario.uid, setConfig);
  }, [usuario]);

  useEffect(() => {
    if (!usuario) return;
    return assinarTodasParcelas(usuario.uid, (dados) => {
      setParcelas(dados);
      setCarregando(false);
    });
  }, [usuario]);

  useEffect(() => {
    if (!usuario) return;
    return assinarTodosRecebimentos(usuario.uid, setRecebimentos);
  }, [usuario]);

  const filtradas = useMemo(() => {
    return parcelas.filter((p) => {
      if (p.vencimento.slice(0, 7) !== ym) return false;
      if (config.gruposInativosDesde?.[p.grupo]) return false;
      if (filtroGrupos[p.grupo] === false) return false;
      if (filtroComp[p.comp ?? SEM_COMP] === false) return false;
      if (filtroAplicacoes[p.aplicacao] === false) return false;
      return true;
    });
  }, [parcelas, ym, config.gruposInativosDesde, filtroGrupos, filtroComp, filtroAplicacoes]);

  const recebimentosFiltrados = useMemo(() => {
    return recebimentos.filter((r) => {
      if (r.recebimento.slice(0, 7) !== ym) return false;
      if (filtroOrigem[r.origem] === false) return false;
      return true;
    });
  }, [recebimentos, ym, filtroOrigem]);

  const origensDoMes = useMemo(
    () => [...new Set(recebimentos.filter((r) => r.recebimento.slice(0, 7) === ym).map((r) => r.origem))].sort(
      (a, b) => a.localeCompare(b, "pt-BR")
    ),
    [recebimentos, ym]
  );

  const totalFiltrado =
    tipoConta === "pagar"
      ? filtradas.reduce((s, p) => s + p.valorParcela, 0)
      : recebimentosFiltrados.reduce((s, r) => s + r.valor, 0);
  const totalPago =
    tipoConta === "pagar"
      ? filtradas.filter((p) => p.pago).reduce((s, p) => s + p.valorParcela, 0)
      : recebimentosFiltrados.filter((r) => r.recebido).reduce((s, r) => s + r.valor, 0);
  const totalPendente = totalFiltrado - totalPago;
  const qtdLancamentos = tipoConta === "pagar" ? filtradas.length : recebimentosFiltrados.length;

  const porGrupo = useMemo(
    () => agruparPorLista(filtradas, "grupo", gruposAtivos(config), paleta),
    [filtradas, config, paleta]
  );
  const porAplicacao = useMemo(
    () => agruparPorLista(filtradas, "aplicacao", config.aplicacoes, paleta),
    [filtradas, config.aplicacoes, paleta]
  );
  const porOrigem = useMemo(
    () => agruparCampoLivre(recebimentosFiltrados.map((r) => ({ chave: r.origem, valor: r.valor })), paleta),
    [recebimentosFiltrados, paleta]
  );
  const porObservacao = useMemo(
    () =>
      agruparCampoLivre(
        recebimentosFiltrados.map((r) => ({ chave: r.observacao || SEM_OBSERVACAO, valor: r.valor })),
        paleta
      ),
    [recebimentosFiltrados, paleta]
  );

  const graficoPrimario = tipoConta === "pagar" ? porGrupo : porOrigem;
  const graficoSecundario = tipoConta === "pagar" ? porAplicacao : porObservacao;
  const tituloGraficoPrimario = tipoConta === "pagar" ? "Por grupo" : "Por origem";
  const tituloGraficoSecundario = tipoConta === "pagar" ? "Por aplicação" : "Por observação";

  const porReembolso = useMemo(() => {
    if (tipoConta === "pagar") {
      return agruparCampoLivre(
        filtradas.map((p) => ({ chave: p.comp ?? SEM_COMP, valor: p.valorParcela })),
        paleta
      );
    }
    return agruparCampoLivre(
      recebimentosFiltrados.map((r) => ({ chave: r.origemComp ? "Reembolso" : "Direto", valor: r.valor })),
      paleta
    );
  }, [tipoConta, filtradas, recebimentosFiltrados, paleta]);

  const porParcelamento = useMemo(() => {
    if (tipoConta === "pagar") {
      return agruparCampoLivre(
        filtradas.map((p) => ({ chave: p.parcelaTotal > 1 ? "Parcelado" : "À vista", valor: p.valorParcela })),
        paleta
      );
    }
    return agruparCampoLivre(
      recebimentosFiltrados.map((r) => ({
        chave: (r.qtdParcelas ?? 1) > 1 ? "Parcelado" : "À vista",
        valor: r.valor,
      })),
      paleta
    );
  }, [tipoConta, filtradas, recebimentosFiltrados, paleta]);

  const registrosFiltrados = tipoConta === "pagar" ? filtradas : recebimentosFiltrados;

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col px-4 py-6 md:px-8 lg:h-full">
      <div className="sticky top-0 z-30 bg-background pb-1 print:static">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {tipoConta === "pagar" ? (
              <>
                {gruposAtivos(config).length > 0 && (
                  <FiltroMultiSelect
                    rotulo="Grupo"
                    opcoes={gruposAtivos(config)}
                    filtro={filtroGrupos}
                    onAlternar={(item, visivel) => setFiltroGrupos((atual) => ({ ...atual, [item]: visivel }))}
                  />
                )}
                <FiltroMultiSelect
                  rotulo="Reembolso"
                  opcoes={[...config.comp.map((c) => c.nome), SEM_COMP]}
                  filtro={filtroComp}
                  onAlternar={(item, visivel) => setFiltroComp((atual) => ({ ...atual, [item]: visivel }))}
                />
                {config.aplicacoes.length > 0 && (
                  <FiltroMultiSelect
                    rotulo="Aplicação"
                    opcoes={config.aplicacoes}
                    filtro={filtroAplicacoes}
                    onAlternar={(item, visivel) => setFiltroAplicacoes((atual) => ({ ...atual, [item]: visivel }))}
                  />
                )}
              </>
            ) : (
              origensDoMes.length > 0 && (
                <FiltroMultiSelect
                  rotulo="Origem"
                  opcoes={origensDoMes}
                  filtro={filtroOrigem}
                  onAlternar={(item, visivel) => setFiltroOrigem((atual) => ({ ...atual, [item]: visivel }))}
                />
              )
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setTipoConta("pagar")}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                  tipoConta === "pagar"
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                }`}
              >
                Contas a pagar
              </button>
              <button
                onClick={() => setTipoConta("receber")}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                  tipoConta === "receber"
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                }`}
              >
                Contas a receber
              </button>
            </div>
            <SeletorMesAno ym={ym} onMudar={setYm} />
          </div>
        </div>

        {!carregando && (
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className={CLASSE_CARD}>
              <p className="text-xs text-slate-500 dark:text-slate-400">Total filtrado</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{formatarMoeda(totalFiltrado)}</p>
            </div>
            <div className={CLASSE_CARD}>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {tipoConta === "pagar" ? "Pago" : "Recebido"}
              </p>
              <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">{formatarMoeda(totalPago)}</p>
            </div>
            <div className={CLASSE_CARD}>
              <p className="text-xs text-slate-500 dark:text-slate-400">Pendente</p>
              <p className="text-lg font-semibold text-amber-600 dark:text-amber-400">{formatarMoeda(totalPendente)}</p>
            </div>
            <div className={CLASSE_CARD}>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {tipoConta === "pagar" ? "Lançamentos" : "Recebimentos"}
              </p>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{qtdLancamentos}</p>
            </div>
          </div>
        )}
      </div>

      <div className="scroll-sem-barra flex flex-col lg:min-h-[520px] lg:flex-1 lg:overflow-y-auto">
      {carregando ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Carregando...</p>
      ) : (
        <>
          {registrosFiltrados.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum lançamento encontrado para esse filtro.</p>
          ) : (
            <>
              <div className="mb-3 flex shrink-0 items-center justify-end gap-1">
                <button
                  onClick={() => setTipoGrafico("pizza")}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                    tipoGrafico === "pizza"
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  }`}
                >
                  Pizza
                </button>
                <button
                  onClick={() => setTipoGrafico("barra")}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                    tipoGrafico === "barra"
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  }`}
                >
                  Barras
                </button>
              </div>

            <div className="grid grid-cols-1 gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-2">
              <GraficoItem
                titulo={tituloGraficoPrimario}
                itens={graficoPrimario}
                tipoGrafico={tipoGrafico}
                formatarValor={formatarMoeda}
                corGrid={corGrid}
                corTextoSecundario={corTextoSecundario}
              />

              <GraficoItem
                titulo={tituloGraficoSecundario}
                itens={graficoSecundario}
                tipoGrafico={tipoGrafico}
                formatarValor={formatarMoeda}
                corGrid={corGrid}
                corTextoSecundario={corTextoSecundario}
              />

              <GraficoItem
                titulo="Tipo de reembolso"
                itens={porReembolso}
                tipoGrafico={tipoGrafico}
                formatarValor={formatarMoeda}
                corGrid={corGrid}
                corTextoSecundario={corTextoSecundario}
              />

              <GraficoItem
                titulo="Lançamentos parcelados"
                itens={porParcelamento}
                tipoGrafico={tipoGrafico}
                formatarValor={formatarMoeda}
                corGrid={corGrid}
                corTextoSecundario={corTextoSecundario}
              />
            </div>
            </>
          )}
        </>
      )}
      </div>
    </div>
  );
}
