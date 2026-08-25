"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useMesAtual } from "@/contexts/MesAtualContext";
import { assinarConfigListas, CONFIG_PADRAO, gruposAtivos } from "@/lib/config";
import { assinarTodasParcelas } from "@/lib/parcelas";
import { assinarTodosRecebimentos } from "@/lib/recebimentos";
import { formatarMoeda, formatarDataBR } from "@/lib/date";
import { CLASSE_CARD } from "@/lib/estilos";
import FiltroMultiSelect from "@/components/FiltroMultiSelect";
import SeletorMesAno from "@/components/SeletorMesAno";
import { useTheme } from "@/contexts/ThemeContext";
import { GraficoItem, type ItemGrafico } from "@/components/GraficoCategoria";
import { IconFechar, IconMaximizar, IconMinimizar } from "@/components/action-icons";
import type { ConfigListas, Parcela, Recebimento } from "@/lib/types";

function FiltroTipoConta({
  tipoConta,
  onAlterar,
}: {
  tipoConta: "pagar" | "receber";
  onAlterar: (valor: "pagar" | "receber") => void;
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
        className="flex h-[42px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700"
      >
        <span className="text-slate-500 dark:text-slate-400">Tipo:</span>
        <span className="font-medium text-slate-900 dark:text-slate-100">
          {tipoConta === "pagar" ? "Contas a pagar" : "Contas a receber"}
        </span>
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {aberto && (
        <div className="absolute z-30 mt-1 flex w-48 flex-col gap-0.5 rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
          {(["pagar", "receber"] as const).map((valor) => (
            <button
              key={valor}
              type="button"
              onClick={() => {
                onAlterar(valor);
                setAberto(false);
              }}
              className={`rounded-md px-2 py-1.5 text-left text-sm ${
                tipoConta === valor
                  ? "bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                  : "text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              {valor === "pagar" ? "Contas a pagar" : "Contas a receber"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

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

type ChaveCartao = "primario" | "secundario" | "reembolso" | "parcelamento";

function chaveRegistroPara(
  cartao: ChaveCartao,
  tipoConta: "pagar" | "receber",
  registro: Parcela | Recebimento
): string {
  if (cartao === "primario") {
    return tipoConta === "pagar" ? (registro as Parcela).grupo : (registro as Recebimento).origem;
  }
  if (cartao === "secundario") {
    return tipoConta === "pagar"
      ? (registro as Parcela).aplicacao
      : (registro as Recebimento).observacao || SEM_OBSERVACAO;
  }
  if (cartao === "reembolso") {
    return tipoConta === "pagar"
      ? (registro as Parcela).comp ?? SEM_COMP
      : (registro as Recebimento).origemComp
        ? "Reembolso"
        : "Direto";
  }
  return tipoConta === "pagar"
    ? (registro as Parcela).parcelaTotal > 1
      ? "Parcelado"
      : "À vista"
    : ((registro as Recebimento).qtdParcelas ?? 1) > 1
      ? "Parcelado"
      : "À vista";
}

type GrupoDetalhe = { nome: string; total: number; cor: string; registros: (Parcela | Recebimento)[] };

function agruparDetalhe(
  registros: (Parcela | Recebimento)[],
  cartao: ChaveCartao,
  tipoConta: "pagar" | "receber",
  itensGrafico: ItemGrafico[]
): GrupoDetalhe[] {
  const valorDe = (r: Parcela | Recebimento) => (tipoConta === "pagar" ? (r as Parcela).valorParcela : (r as Recebimento).valor);
  const grupos = new Map<string, { total: number; registros: (Parcela | Recebimento)[] }>();

  for (const registro of registros) {
    const chave = chaveRegistroPara(cartao, tipoConta, registro);
    const atual = grupos.get(chave) ?? { total: 0, registros: [] };
    atual.total += valorDe(registro);
    atual.registros.push(registro);
    grupos.set(chave, atual);
  }

  return [...grupos.entries()]
    .map(([nome, dados]) => ({
      nome,
      total: dados.total,
      cor: itensGrafico.find((i) => i.nome === nome)?.cor ?? COR_OUTROS,
      registros: dados.registros.sort((a, b) => valorDe(b) - valorDe(a)),
    }))
    .sort((a, b) => b.total - a.total);
}

function PainelDetalheCartao({
  titulo,
  grupos,
  tipoConta,
  alturaMax,
  maximizado,
  onAlternarMaximizar,
  onFechar,
}: {
  titulo: string;
  grupos: GrupoDetalhe[];
  tipoConta: "pagar" | "receber";
  alturaMax?: number;
  maximizado: boolean;
  onAlternarMaximizar: () => void;
  onFechar: () => void;
}) {
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  const alternar = (nome: string) => {
    setExpandidos((atual) => {
      const novo = new Set(atual);
      if (novo.has(nome)) {
        novo.delete(nome);
      } else {
        novo.add(nome);
      }
      return novo;
    });
  };

  return (
    <div
      className={`${CLASSE_CARD} flex min-h-0 flex-1 flex-col`}
      style={alturaMax ? { maxHeight: alturaMax } : undefined}
    >
      <div className="mb-3 flex shrink-0 items-center justify-between">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{titulo}</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onAlternarMaximizar}
            aria-label={maximizado ? "Restaurar" : "Maximizar"}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          >
            {maximizado ? <IconMinimizar className="h-4 w-4" /> : <IconMaximizar className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-red-100 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-900/30 dark:hover:text-red-400"
          >
            <IconFechar className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="scroll-sem-barra min-h-0 flex-1 overflow-y-auto">
        {grupos.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">Sem dados para o mês.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {grupos.map((grupo) => {
              const aberto = expandidos.has(grupo.nome);
              return (
                <div key={grupo.nome}>
                  <button
                    type="button"
                    onClick={() => alternar(grupo.nome)}
                    className="flex w-full items-center gap-2 rounded-lg py-1.5 text-left hover:bg-slate-50 dark:hover:bg-slate-700/40"
                  >
                    <span
                      className={`shrink-0 text-[10px] text-slate-400 transition-transform dark:text-slate-500 ${
                        aberto ? "rotate-90" : ""
                      }`}
                    >
                      ▶
                    </span>
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: grupo.cor }} />
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{grupo.nome}</span>
                    <span className="ml-auto shrink-0 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {formatarMoeda(grupo.total)}
                    </span>
                  </button>
                  {aberto && (
                    <div className="pb-1 pl-5">
                      <div className="grid grid-cols-[76px_1fr_1fr_92px] gap-2 px-0.5 pb-1 text-xs font-medium text-slate-400 dark:text-slate-500">
                        <span>Data</span>
                        <span>{tipoConta === "pagar" ? "Credor" : "Origem"}</span>
                        <span>Observação</span>
                        <span className="text-right">Valor</span>
                      </div>
                      <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-700">
                        {grupo.registros.map((registro) => {
                          const ehParcela = tipoConta === "pagar";
                          const p = registro as Parcela;
                          const r = registro as Recebimento;
                          const descricao = ehParcela ? p.credor : r.origem;
                          const data = ehParcela ? p.dataCompra : r.recebimento;
                          const observacao = (ehParcela ? p.observacao : r.observacao) || "—";
                          const valor = ehParcela ? p.valorParcela : r.valor;
                          return (
                            <div
                              key={registro.id}
                              className="grid grid-cols-[76px_1fr_1fr_92px] items-center gap-2 py-1.5 text-sm"
                            >
                              <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">
                                {data ? formatarDataBR(data) : "—"}
                              </span>
                              <span className="min-w-0 truncate text-slate-700 dark:text-slate-300">{descricao}</span>
                              <span className="min-w-0 truncate text-slate-500 dark:text-slate-400">{observacao}</span>
                              <span className="text-right font-medium text-slate-900 dark:text-slate-100">
                                {formatarMoeda(valor)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
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
  const [cartaoSelecionado, setCartaoSelecionado] = useState<ChaveCartao | null>(null);
  const [painelMaximizado, setPainelMaximizado] = useState(false);
  const colunaQuadrosRef = useRef<HTMLDivElement | null>(null);
  const [alturaColunaQuadros, setAlturaColunaQuadros] = useState<number | undefined>(undefined);

  useEffect(() => {
    setCartaoSelecionado(null);
  }, [ym, tipoConta]);

  useEffect(() => {
    setPainelMaximizado(false);
  }, [cartaoSelecionado]);

  useEffect(() => {
    if (!cartaoSelecionado || painelMaximizado) return;
    const el = colunaQuadrosRef.current;
    if (!el) return;
    const atualizar = () => setAlturaColunaQuadros(el.offsetHeight);
    atualizar();
    const observador = new ResizeObserver(atualizar);
    observador.observe(el);
    return () => observador.disconnect();
  }, [cartaoSelecionado, painelMaximizado]);

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

  const totalPago =
    tipoConta === "pagar"
      ? filtradas.filter((p) => p.pago).reduce((s, p) => s + p.valorParcela, 0)
      : recebimentosFiltrados.filter((r) => r.recebido).reduce((s, r) => s + r.valor, 0);
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

  const resumoLancamentos =
    tipoConta === "pagar"
      ? `${qtdLancamentos} lançamentos · Pago: ${formatarMoeda(totalPago)}`
      : `${qtdLancamentos} recebimentos · Recebido: ${formatarMoeda(totalPago)}`;

  const cartoes: { chave: ChaveCartao; titulo: string; subtitulo?: string; itens: ItemGrafico[] }[] = [
    { chave: "secundario", titulo: tituloGraficoSecundario, subtitulo: resumoLancamentos, itens: graficoSecundario },
    { chave: "primario", titulo: tituloGraficoPrimario, itens: graficoPrimario },
    { chave: "reembolso", titulo: "Tipo de reembolso", itens: porReembolso },
    { chave: "parcelamento", titulo: "Lançamentos parcelados", itens: porParcelamento },
  ];
  const cartaoAtivo = cartoes.find((c) => c.chave === cartaoSelecionado) ?? null;
  const gruposDetalhe = useMemo(
    () => (cartaoAtivo ? agruparDetalhe(registrosFiltrados, cartaoAtivo.chave, tipoConta, cartaoAtivo.itens) : []),
    [cartaoAtivo, registrosFiltrados, tipoConta]
  );

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col px-4 py-6 md:px-8 lg:h-full">
      <div className="sticky top-0 z-30 bg-background pb-1 print:static">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <FiltroTipoConta tipoConta={tipoConta} onAlterar={setTipoConta} />
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
            <SeletorMesAno ym={ym} onMudar={setYm} />
          </div>
        </div>

        {!carregando && registrosFiltrados.length > 0 && (
          <div className="mb-1 flex shrink-0 items-center justify-end gap-1">
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
            <div
              className={
                !cartaoSelecionado
                  ? "block lg:min-h-0 lg:flex-1"
                  : painelMaximizado
                    ? "flex flex-col gap-4 lg:flex-1 lg:flex-row lg:items-stretch"
                    : "flex flex-col gap-4 lg:flex-row lg:items-start"
              }
            >
              {!painelMaximizado && (
                <div
                  ref={colunaQuadrosRef}
                  className={
                    cartaoSelecionado
                      ? "grid shrink-0 grid-cols-2 gap-3 lg:w-[320px] lg:grid-cols-1"
                      : "grid grid-cols-1 gap-4 lg:grid-cols-2"
                  }
                >
                  {cartoes.map((cartao) => (
                    <button
                      key={cartao.chave}
                      type="button"
                      onClick={() =>
                        setCartaoSelecionado((atual) => (atual === cartao.chave ? null : cartao.chave))
                      }
                      className={`w-full rounded-xl border-2 text-left transition ${
                        cartaoSelecionado === cartao.chave
                          ? "border-indigo-500"
                          : cartaoSelecionado
                            ? "border-transparent opacity-60 hover:opacity-100"
                            : "border-transparent hover:opacity-90"
                      }`}
                    >
                      <GraficoItem
                        titulo={cartao.titulo}
                        subtitulo={cartao.subtitulo}
                        itens={cartao.itens}
                        tipoGrafico={tipoGrafico}
                        formatarValor={formatarMoeda}
                        corGrid={corGrid}
                        corTextoSecundario={corTextoSecundario}
                        modoCompacto={!!cartaoSelecionado}
                      />
                    </button>
                  ))}
                </div>
              )}

              {cartaoAtivo && (
                <PainelDetalheCartao
                  key={cartaoAtivo.chave}
                  titulo={cartaoAtivo.titulo}
                  grupos={gruposDetalhe}
                  tipoConta={tipoConta}
                  alturaMax={painelMaximizado ? undefined : alturaColunaQuadros}
                  maximizado={painelMaximizado}
                  onAlternarMaximizar={() => setPainelMaximizado((v) => !v)}
                  onFechar={() => setCartaoSelecionado(null)}
                />
              )}
            </div>
            </>
          )}
        </>
      )}
      </div>
    </div>
  );
}
