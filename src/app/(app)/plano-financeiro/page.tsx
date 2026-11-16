"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useMesAtual } from "@/contexts/MesAtualContext";
import { assinarConfigListas, CONFIG_PADRAO } from "@/lib/config";
import { assinarParcelasDoIntervalo } from "@/lib/parcelas";
import { assinarRecebimentosDoIntervalo } from "@/lib/recebimentos";
import { assinarRecorrencias } from "@/lib/recorrencias";
import {
  arredondar2,
  calcularAReceberProprioPorMes,
  calcularGastosPorAplicacaoEMes,
  limiteNoMes,
  planoFinanceiroDaConfig,
  salvarPlanoFinanceiro,
} from "@/lib/planoFinanceiro";
import { formatarMesAno, formatarMesAnoAbreviado, formatarMoeda, somarMesesYM } from "@/lib/date";
import { CLASSE_CARD } from "@/lib/estilos";
import SeletorMesAno from "@/components/SeletorMesAno";
import { IconOlho, IconOlhoFechado } from "@/components/action-icons";
import CampoValorMonetario, { paraNumero } from "@/components/CampoValorMonetario";
import type { ConfigListas, ModoPlanoFinanceiro, Parcela, PlanoFinanceiro, Recebimento, Recorrencia } from "@/lib/types";

const HORIZONTE = 10;

const CLASSE_CAMPO_COMPACTO =
  "shrink-0 rounded-md border border-slate-300 px-2 py-1 text-right text-sm tabular-nums text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-900";

// Rascunho da distribuição enquanto o usuário edita: os valores ficam como texto (do jeito
// que estão nos campos) e só viram número ao calcular/salvar.
type Rascunho = { modo: ModoPlanoFinanceiro; valores: Record<string, string> };

function numeroParaTexto(valor: number, modo: ModoPlanoFinanceiro): string {
  if (!valor) return "";
  return modo === "valor"
    ? valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : String(arredondar2(valor)).replace(".", ",");
}

function textoParaNumero(texto: string): number {
  if (!texto.trim()) return 0;
  const n = paraNumero(texto);
  return Number.isFinite(n) ? n : 0;
}

// Aceita só dígitos e uma vírgula com até 2 casas (ex.: "12,5").
function limparPercentual(texto: string): string {
  const limpo = texto.replace(/[^\d,]/g, "");
  const [inteiro, ...resto] = limpo.split(",");
  if (resto.length === 0) return inteiro.slice(0, 3);
  return `${inteiro.slice(0, 3)},${resto.join("").slice(0, 2)}`;
}

function formatarPercentual(valor: number): string {
  return `${arredondar2(valor).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

// Aplicação de reserva (nome começando com "Reserva"): é dinheiro que o usuário deposita para
// si mesmo, não um gasto — por isso a lógica de cor é invertida: fica verde ao depositar a meta
// configurada (ou mais) e vermelho enquanto o depositado estiver abaixo dela.
function ehReserva(aplicacao: string): boolean {
  return aplicacao
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .startsWith("reserva");
}

function rascunhoDoPlano(plano: PlanoFinanceiro, aplicacoes: string[]): Rascunho {
  return {
    modo: plano.modo,
    valores: Object.fromEntries(aplicacoes.map((a) => [a, numeroParaTexto(plano.distribuicao[a] ?? 0, plano.modo)])),
  };
}

export default function PlanoFinanceiroPage() {
  const { usuario } = useAuth();
  const { ym, definirYm } = useMesAtual();

  const [config, setConfig] = useState<ConfigListas>(CONFIG_PADRAO);
  const [configCarregada, setConfigCarregada] = useState(false);
  const [recorrenciasPagar, setRecorrenciasPagar] = useState<Recorrencia[]>([]);
  const [recorrenciasReceber, setRecorrenciasReceber] = useState<Recorrencia[]>([]);
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [recebimentos, setRecebimentos] = useState<Recebimento[]>([]);
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState("");
  const [salvoComSucesso, setSalvoComSucesso] = useState(false);
  // Quadro de configuração recolhível; a escolha fica salva por usuário neste navegador.
  // Sem escolha salva, começa aberto só enquanto o plano ainda não tem nenhuma distribuição.
  const [configAbertaSalva, setConfigAbertaSalva] = useState<boolean | null>(null);

  const meses = useMemo(() => Array.from({ length: HORIZONTE }, (_, i) => somarMesesYM(ym, i)), [ym]);

  useEffect(() => {
    if (!usuario) return;
    return assinarConfigListas(usuario.uid, (dados) => {
      setConfig(dados);
      setConfigCarregada(true);
    });
  }, [usuario]);

  useEffect(() => {
    if (!usuario) return;
    return assinarRecorrencias(usuario.uid, "pagar", setRecorrenciasPagar);
  }, [usuario]);

  useEffect(() => {
    if (!usuario) return;
    return assinarRecorrencias(usuario.uid, "receber", setRecorrenciasReceber);
  }, [usuario]);

  useEffect(() => {
    if (!usuario) return;
    return assinarParcelasDoIntervalo(usuario.uid, meses[0], meses[meses.length - 1], setParcelas);
  }, [usuario, meses]);

  useEffect(() => {
    if (!usuario) return;
    return assinarRecebimentosDoIntervalo(usuario.uid, meses[0], meses[meses.length - 1], setRecebimentos);
  }, [usuario, meses]);

  useEffect(() => {
    if (!usuario) return;
    queueMicrotask(() => {
      try {
        const salvo = localStorage.getItem(`planoFinanceiroConfigAberta_${usuario.uid}`);
        if (salvo !== null) setConfigAbertaSalva(salvo === "true");
      } catch {
        // sem acesso ao localStorage: usa o padrão
      }
    });
  }, [usuario]);

  const planoSalvo = planoFinanceiroDaConfig(config);
  const aplicacoes = config.aplicacoes;
  // Na Distribuição do valor a receber, as Aplicações aparecem sempre em ordem alfabética —
  // inclusive as recém-criadas, que entram no lugar certo da lista.
  const aplicacoesEmOrdemAlfabetica = useMemo(
    () => [...aplicacoes].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" })),
    [aplicacoes]
  );
  const configAberta = configAbertaSalva ?? (configCarregada && Object.keys(planoSalvo.distribuicao).length === 0);

  function alternarConfigAberta() {
    const novo = !configAberta;
    setConfigAbertaSalva(novo);
    try {
      if (usuario) localStorage.setItem(`planoFinanceiroConfigAberta_${usuario.uid}`, String(novo));
    } catch {
      // ignora: a preferência só não fica lembrada
    }
  }

  // O que está nos campos: o rascunho, se o usuário começou a editar, ou o plano salvo.
  const emEdicao = rascunho ?? rascunhoDoPlano(planoSalvo, aplicacoes);
  const modo = emEdicao.modo;

  // Plano efetivo (numérico) usado para pintar a tabela — reflete o rascunho na hora, para o
  // usuário ver o verde/vermelho mudar antes mesmo de salvar.
  const distribuicaoEfetiva = useMemo(
    () => Object.fromEntries(aplicacoes.map((a) => [a, textoParaNumero(emEdicao.valores[a] ?? "")])),
    [aplicacoes, emEdicao.valores]
  );

  const aReceberPorMes = useMemo(
    () => calcularAReceberProprioPorMes(meses, recebimentos, recorrenciasReceber),
    [meses, recebimentos, recorrenciasReceber]
  );

  const gastosPorAplicacao = useMemo(
    () => calcularGastosPorAplicacaoEMes(meses, parcelas, recorrenciasPagar, config.comp ?? []),
    [meses, parcelas, recorrenciasPagar, config.comp]
  );

  const aReceberMesAtual = aReceberPorMes.get(ym) ?? 0;
  const qtdComValor = aplicacoes.filter((a) => (distribuicaoEfetiva[a] ?? 0) > 0).length;

  const totalDistribuido = arredondar2(Object.values(distribuicaoEfetiva).reduce((s, v) => s + v, 0));
  const limiteDistribuicao = modo === "percentual" ? 100 : arredondar2(aReceberMesAtual);
  const excedeu = totalDistribuido > limiteDistribuicao;
  const restante = arredondar2(limiteDistribuicao - totalDistribuido);
  // Verde: ainda há saldo a distribuir; vermelho: excedeu; cor normal: distribuído por completo.
  const corSaldo = excedeu
    ? "text-red-600 dark:text-red-400"
    : restante > 0
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-slate-900 dark:text-slate-100";

  const formatarNoModo = (valor: number) => (modo === "percentual" ? formatarPercentual(valor) : formatarMoeda(valor));

  // Linhas da tabela: só as Aplicações com algum lançamento em Contas a Pagar dentro da
  // Janela de 10 meses — primeiro as cadastradas, em ordem alfabética, depois as que não estão
  // mais na lista (ex.: removidas), que ficam com limite 0.
  // A reserva aparece também sem nenhum depósito, desde que tenha meta configurada — é
  // justamente quando nada foi depositado que ela precisa ficar vermelha.
  const linhas = useMemo(() => {
    const temGasto = (a: string) =>
      [...(gastosPorAplicacao.get(a)?.values() ?? [])].some((v) => v > 0) ||
      (ehReserva(a) && (distribuicaoEfetiva[a] ?? 0) > 0);
    const cadastradas = aplicacoesEmOrdemAlfabetica.filter(temGasto);
    const extras = [...gastosPorAplicacao.keys()]
      .filter((a) => !aplicacoes.includes(a) && temGasto(a))
      .sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
    return [...cadastradas, ...extras];
  }, [aplicacoes, aplicacoesEmOrdemAlfabetica, gastosPorAplicacao, distribuicaoEfetiva]);

  function limiteDe(aplicacao: string, mes: string): number {
    return limiteNoMes(modo, distribuicaoEfetiva[aplicacao] ?? 0, aReceberPorMes.get(mes) ?? 0);
  }

  function editarValor(aplicacao: string, texto: string) {
    setSalvoComSucesso(false);
    setErroSalvar("");
    setRascunho({ ...emEdicao, valores: { ...emEdicao.valores, [aplicacao]: texto } });
  }

  // Ao trocar entre percentual e valor, converte o que já foi distribuído usando o valor a
  // receber do mês selecionado, para o usuário não perder a divisão que já fez.
  function trocarModo(novoModo: ModoPlanoFinanceiro) {
    if (novoModo === modo) return;
    setSalvoComSucesso(false);
    setErroSalvar("");
    const valores = Object.fromEntries(
      aplicacoes.map((a) => {
        const atual = distribuicaoEfetiva[a] ?? 0;
        if (!atual || aReceberMesAtual <= 0) return [a, ""];
        const convertido =
          novoModo === "valor" ? (aReceberMesAtual * atual) / 100 : (atual / aReceberMesAtual) * 100;
        return [a, numeroParaTexto(arredondar2(convertido), novoModo)];
      })
    );
    setRascunho({ modo: novoModo, valores });
  }

  async function salvar() {
    if (!usuario || excedeu) return;
    setSalvando(true);
    setErroSalvar("");
    try {
      const distribuicao = Object.fromEntries(
        Object.entries(distribuicaoEfetiva).filter(([, v]) => v > 0).map(([a, v]) => [a, arredondar2(v)])
      );
      await salvarPlanoFinanceiro(usuario.uid, { modo, distribuicao });
      setRascunho(null);
      setSalvoComSucesso(true);
    } catch {
      setErroSalvar("Não foi possível salvar o plano. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  const alterado = rascunho !== null;

  // Navegação por gesto no celular (mesmo comportamento da Janela de 10 meses da Início).
  const toqueInicioX = useRef<number | null>(null);
  function handleTouchStart(e: React.TouchEvent) {
    toqueInicioX.current = e.touches[0].clientX;
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (toqueInicioX.current === null) return;
    const deltaX = e.changedTouches[0].clientX - toqueInicioX.current;
    toqueInicioX.current = null;
    if (window.innerWidth >= 768) return;
    if (deltaX <= -40) definirYm(somarMesesYM(ym, 1));
    else if (deltaX >= 40) definirYm(somarMesesYM(ym, -1));
  }

  if (!usuario) return null;

  const classeColunaMes = (indice: number, mes: string) =>
    `min-w-[96px] px-1 py-2 text-center tabular-nums md:min-w-0 ${indice === 0 ? "" : "hidden md:table-cell"} ${
      mes === ym ? "bg-indigo-50/60 dark:bg-indigo-950/40" : ""
    }`;

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-4 md:px-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Plano Financeiro</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Divida o que você tem a receber entre as Aplicações e acompanhe, mês a mês, o que está dentro do limite e o
            que estourou.
          </p>
        </div>
        <SeletorMesAno ym={ym} onMudar={definirYm} />
      </div>

      {/* Configuração da distribuição — recolhível, para deixar só a Janela de 10 meses */}
      <section className={`${CLASSE_CARD} mb-4 !p-0`}>
        <button
          type="button"
          onClick={alternarConfigAberta}
          aria-expanded={configAberta}
          className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left"
        >
          <span className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${configAberta ? "rotate-90" : ""}`}
              aria-hidden
            >
              <path d="M7.2 4.2a.75.75 0 0 1 1.06 0l5.25 5.25a.75.75 0 0 1 0 1.06L8.26 15.8a.75.75 0 1 1-1.06-1.06L11.92 10 7.2 5.27a.75.75 0 0 1 0-1.06Z" />
            </svg>
            Distribuição do valor a receber
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
            {aplicacoes.length} {aplicacoes.length === 1 ? "Aplicação" : "Aplicações"} · {qtdComValor} com limite
          </span>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            A receber em {formatarMesAno(ym)} (sem reembolsos):{" "}
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatarMoeda(aReceberMesAtual)}</span>
          </span>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            Distribuído:{" "}
            <span className={`font-semibold ${corSaldo}`}>
              {formatarNoModo(totalDistribuido)}
            </span>{" "}
            de {formatarNoModo(limiteDistribuicao)}
          </span>
          {alterado && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-400">
              Alterações não salvas
            </span>
          )}
          <span
            title={configAberta ? "Ocultar configuração do plano" : "Mostrar configuração do plano"}
            className="ml-auto shrink-0 rounded-lg border border-slate-300 p-1.5 text-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700"
          >
            {configAberta ? <IconOlhoFechado className="h-3.5 w-3.5" /> : <IconOlho className="h-3.5 w-3.5" />}
          </span>
        </button>

        {configAberta && (
          <div className="border-t border-slate-100 px-4 pb-4 pt-3 dark:border-slate-700">
            <div className="mb-3 flex justify-end">
              <div className="inline-flex rounded-lg border border-slate-300 p-0.5 text-sm dark:border-slate-600">
                {(["valor", "percentual"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => trocarModo(m)}
                    className={`rounded-md px-3 py-1 font-medium ${
                      modo === m
                        ? "bg-indigo-600 text-white"
                        : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                    }`}
                  >
                    {m === "percentual" ? "Percentual (%)" : "Valor (R$)"}
                  </button>
                ))}
              </div>
            </div>

            {aplicacoes.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Nenhuma Aplicação cadastrada. Cadastre em Configurações para montar o seu plano.
              </p>
            ) : (
              // auto-fill: a quantidade de colunas acompanha a largura da tela (1 no celular, várias
              // em monitores largos) e a lista rola dentro do quadro quando há muitas Aplicações.
              <div className="grid max-h-[50vh] grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-x-3 gap-y-2 overflow-y-auto pr-1">
                {aplicacoesEmOrdemAlfabetica.map((aplicacao) => {
                  const valorNum = distribuicaoEfetiva[aplicacao] ?? 0;
                  const equivalente =
                    modo === "percentual"
                      ? formatarMoeda(limiteNoMes("percentual", valorNum, aReceberMesAtual))
                      : aReceberMesAtual > 0
                        ? formatarPercentual((valorNum / aReceberMesAtual) * 100)
                        : "—";
                  return (
                    <label
                      key={aplicacao}
                      className="flex flex-col gap-1 rounded-lg border border-slate-100 px-2 py-1.5 dark:border-slate-700"
                    >
                      {/* Nome em cima, ocupando a largura toda do item; campo e equivalente embaixo. */}
                      <span className="text-sm font-medium leading-tight text-slate-700 dark:text-slate-300">
                        {aplicacao}
                      </span>
                      <span className="flex items-center gap-2">
                      {modo === "valor" ? (
                        <CampoValorMonetario
                          value={emEdicao.valores[aplicacao] ?? ""}
                          onChange={(v) => editarValor(aplicacao, v)}
                          className={`${CLASSE_CAMPO_COMPACTO} w-24`}
                          aria-label={`Valor para ${aplicacao}`}
                        />
                      ) : (
                        <span className="relative shrink-0">
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="0"
                            value={emEdicao.valores[aplicacao] ?? ""}
                            onChange={(e) => editarValor(aplicacao, limparPercentual(e.target.value))}
                            className={`${CLASSE_CAMPO_COMPACTO} w-16 pr-5`}
                            aria-label={`Percentual para ${aplicacao}`}
                          />
                          <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                            %
                          </span>
                        </span>
                      )}
                      <span className="min-w-0 text-xs tabular-nums text-slate-500 dark:text-slate-400">
                        = {equivalente}
                      </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}

            <div className="mt-3 flex flex-col gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700">
              <div className="text-sm">
                <p className="text-slate-600 dark:text-slate-300">
                  Distribuído:{" "}
                  <span className={`font-semibold ${corSaldo}`}>
                    {formatarNoModo(totalDistribuido)}
                  </span>{" "}
                  de {formatarNoModo(limiteDistribuicao)}
                  {!excedeu && (
                    <span className="text-slate-500 dark:text-slate-400">
                      {" "}
                      · Falta distribuir <span className={`font-semibold ${corSaldo}`}>{formatarNoModo(restante)}</span>
                    </span>
                  )}
                </p>
                {excedeu && (
                  <p className="mt-1 font-medium text-red-600 dark:text-red-400" role="alert">
                    Não é permitido distribuir mais que {modo === "percentual" ? "100%" : "o valor a receber"}. Você passou{" "}
                    {formatarNoModo(-restante)} do limite
                    {modo === "valor" && aReceberMesAtual <= 0 ? ` — não há valor a receber em ${formatarMesAno(ym)}` : ""}.
                  </p>
                )}
                {modo === "valor" && !excedeu && (
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                    Em valor, o limite de cada Aplicação é o mesmo em todos os meses; a validação usa o valor a receber do mês
                    selecionado.
                  </p>
                )}
                {erroSalvar && <p className="mt-1 text-red-600 dark:text-red-400">{erroSalvar}</p>}
                {salvoComSucesso && !alterado && (
                  <p className="mt-1 text-emerald-600 dark:text-emerald-400">Plano salvo.</p>
                )}
              </div>
              <div className="flex gap-2">
                {alterado && (
                  <button
                    type="button"
                    onClick={() => {
                      setRascunho(null);
                      setErroSalvar("");
                    }}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    Descartar
                  </button>
                )}
                <button
                  type="button"
                  onClick={salvar}
                  disabled={!alterado || excedeu || salvando}
                  title={excedeu ? "A distribuição passou do limite permitido" : undefined}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                >
                  {salvando ? "Salvando..." : "Salvar plano"}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Visão dos próximos meses */}
      <div className="relative rounded-xl border-x border-b border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="absolute inset-x-3 -top-2.5 flex items-center gap-2">
          <span className="shrink-0 text-xs font-medium text-slate-500 dark:text-slate-400">Janela de 10 meses</span>
          <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
        </div>
        <div className="overflow-x-auto" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          <table className="w-full table-auto text-sm md:table-fixed">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="sticky left-0 z-10 w-40 bg-white px-2 py-2 text-left font-medium text-slate-500 md:static md:w-48 dark:bg-slate-800">
                  Aplicação
                </th>
                {meses.map((mes, indice) => (
                  <th key={mes} className={`${classeColunaMes(indice, mes)} font-medium`}>
                    <span
                      className={`block w-full rounded-md px-1 py-1 text-[15px] ${
                        mes === ym
                          ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                          : "text-indigo-500 dark:text-indigo-400"
                      }`}
                    >
                      {formatarMesAnoAbreviado(mes)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.length === 0 && (
                <tr>
                  <td colSpan={meses.length + 1} className="px-2 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                    Nenhum lançamento em Contas a Pagar nos meses desta janela.
                  </td>
                </tr>
              )}

              {linhas.map((aplicacao) => {
                const configurado = distribuicaoEfetiva[aplicacao] ?? 0;
                const foraDaLista = !aplicacoes.includes(aplicacao);
                // Tem lançamento na janela (senão nem viraria linha) mas nenhum limite/meta
                // configurado: nome em laranja para chamar atenção.
                const semLimite = configurado <= 0;
                return (
                  <tr key={aplicacao} className="border-b border-slate-100 dark:border-slate-700">
                    <td className="sticky left-0 z-10 bg-white px-2 py-2 md:static dark:bg-slate-800">
                      <span
                        className={`block break-words font-semibold leading-tight ${
                          semLimite ? "text-orange-500 dark:text-orange-400" : "text-slate-900 dark:text-slate-100"
                        }`}
                        title={semLimite ? "Tem lançamentos, mas não tem limite configurado no plano" : undefined}
                      >
                        {aplicacao}
                      </span>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500">
                        {foraDaLista
                          ? "fora da lista de Aplicações"
                          : `${ehReserva(aplicacao) ? "Meta" : "Limite"}: ${formatarNoModo(configurado)}`}
                      </span>
                    </td>
                    {meses.map((mes, indice) => (
                      <CelulaAplicacao
                        key={mes}
                        className={classeColunaMes(indice, mes)}
                        gasto={gastosPorAplicacao.get(aplicacao)?.get(mes) ?? 0}
                        limite={limiteDe(aplicacao, mes)}
                        reserva={ehReserva(aplicacao)}
                        href={`/lancar?aba=buscar&mes=${mes}&todosGrupos=1&aplicacao=${encodeURIComponent(aplicacao)}`}
                      />
                    ))}
                  </tr>
                );
              })}

            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-slate-100 px-2 py-1.5 text-[11px] text-slate-400 dark:border-slate-700 dark:text-slate-500">
          <span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">Verde</span>: gasto dentro do limite
          </span>
          <span>
            <span className="font-semibold text-red-500 dark:text-red-400">Vermelho</span>: gasto acima do limite
          </span>
          <span>Abaixo: quanto sobrou (+) ou estourou (−) do limite</span>
          <span>
            Nome em <span className="font-semibold text-orange-500 dark:text-orange-400">laranja</span>: tem lançamentos,
            mas está sem limite configurado
          </span>
          <span>
            Reserva: <span className="font-semibold text-emerald-600 dark:text-emerald-400">verde</span> ao depositar a
            meta ou mais, <span className="font-semibold text-red-500 dark:text-red-400">vermelho</span> abaixo dela
          </span>
          <span>Só a sua parte — reembolsos descontados</span>
          <span>Clique no valor gasto para ver os lançamentos</span>
          <span className="md:hidden">Arraste para o lado para ver o mês anterior/seguinte</span>
        </div>
      </div>
    </div>
  );
}

// Célula de uma Aplicação num mês: em destaque o que foi gasto — verde dentro do limite,
// vermelho quando passa dele — e, embaixo, quanto sobrou ou estourou do limite. Clicar no
// valor gasto abre, numa nova aba, os Lançamentos de Contas a Pagar daquele mês filtrados
// pela Aplicação (com todos os grupos marcados).
function CelulaAplicacao({
  gasto,
  limite,
  className,
  href,
  reserva = false,
}: {
  gasto: number;
  limite: number;
  className: string;
  href: string;
  // Reserva: "gasto" é o depositado e "limite" é a meta; ruim é ficar abaixo da meta.
  reserva?: boolean;
}) {
  if (gasto === 0 && limite === 0) {
    return <td className={`${className} text-slate-400 dark:text-slate-500`}>—</td>;
  }
  const saldo = arredondar2(limite - gasto);
  // Para a reserva, ficar abaixo da meta é o ruim (vermelho); atingir ou passar é o bom (verde).
  const estourou = reserva ? saldo > 0 : saldo < 0;
  const titulo = reserva
    ? estourou
      ? `Faltam ${formatarMoeda(saldo)} para a meta — depositado ${formatarMoeda(gasto)} de uma meta de ${formatarMoeda(limite)}`
      : `Meta atingida${saldo < 0 ? ` com ${formatarMoeda(-saldo)} a mais` : ""} — depositado ${formatarMoeda(gasto)} de uma meta de ${formatarMoeda(limite)}`
    : estourou
      ? `Estourou ${formatarMoeda(-saldo)} — gasto ${formatarMoeda(gasto)} de um limite de ${formatarMoeda(limite)}`
      : `Ainda pode gastar ${formatarMoeda(saldo)} — gasto ${formatarMoeda(gasto)} de um limite de ${formatarMoeda(limite)}`;
  return (
    <td className={className} title={titulo}>
      {gasto > 0 ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          title="Ver os lançamentos desta Aplicação neste mês (abre em nova aba)"
          className={`block font-semibold underline-offset-2 hover:underline ${
            estourou ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
          }`}
        >
          {formatarMoeda(gasto)}
        </a>
      ) : (
        <span
          className={`block font-semibold ${
            estourou ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
          }`}
        >
          {formatarMoeda(gasto)}
        </span>
      )}
      <span
        className={`block text-center text-[10px] leading-tight ${
          estourou ? "text-red-500 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
        }`}
      >
        {estourou ? "−" : "+"}
        {formatarMoeda(Math.abs(saldo))}
      </span>
    </td>
  );
}
