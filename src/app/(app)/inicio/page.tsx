"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useMesAtual } from "@/contexts/MesAtualContext";
import { assinarParcelasDoMes, valorEfetivo } from "@/lib/parcelas";
import { assinarConfigListas, CONFIG_PADRAO } from "@/lib/config";
import { alternarFiltroGrupo, assinarFiltrosDashboard } from "@/lib/perfil";
import { assinarRecorrencias, mesclarComRecorrencias } from "@/lib/recorrencias";
import { assinarRecebimentosDoMes, sincronizarReembolsosRecorrentes } from "@/lib/recebimentos";
import { formatarMoeda, mesAtualYM } from "@/lib/date";
import VisaoGeral13Meses from "@/components/VisaoGeral13Meses";
import DashboardFormaPagamento from "@/components/DashboardFormaPagamento";
import SeletorMesAno from "@/components/SeletorMesAno";
import { IconOlho, IconOlhoFechado } from "@/components/action-icons";
import type { ConfigListas, Parcela, Recebimento, Recorrencia, StatusGrupo } from "@/lib/types";

function statusGrupo(parcelas: Parcela[]): StatusGrupo {
  if (parcelas.every((p) => p.pago)) return "pago";
  if (parcelas.every((p) => !p.pago)) return "pendente";
  return "parcial";
}

function validarYM(valor: string | null): string | null {
  return valor && /^\d{4}-\d{2}$/.test(valor) ? valor : null;
}

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardConteudo />
    </Suspense>
  );
}

function DashboardConteudo() {
  const { usuario } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { ym: ymCompartilhado, definirYm } = useMesAtual();
  const ymUrl = validarYM(searchParams.get("mes"));
  const ym = ymUrl ?? ymCompartilhado;

  useEffect(() => {
    if (!ymUrl || ymUrl === ymCompartilhado) return;
    queueMicrotask(() => definirYm(ymUrl));
  }, [ymUrl, ymCompartilhado, definirYm]);

  const [config, setConfig] = useState<ConfigListas>(CONFIG_PADRAO);
  const [filtros, setFiltros] = useState<Record<string, boolean>>({});
  const [gruposRevelados, setGruposRevelados] = useState<Record<string, boolean>>({});
  const [totaisVisiveis, setTotaisVisiveis] = useState(false);
  const [mostrar12Meses, setMostrar12Meses] = useState(true);
  const loginProcessadoRef = useRef<string | null>(null);
  const [recorrencias, setRecorrencias] = useState<Recorrencia[]>([]);
  const [recebimentos, setRecebimentos] = useState<Recebimento[]>([]);
  const [estadoMes, setEstadoMes] = useState<{ ym: string; parcelasReais: Parcela[] }>({
    ym: "",
    parcelasReais: [],
  });

  // Mede o espaço realmente disponível entre a Janela de 10 meses e o rodapé, para o
  // mini-dashboard decidir se cabe inteiro, se precisa virar lista compacta (sem os
  // gráficos) ou se nem cabe — sem cortar cartões nem o título dele pela metade.
  const refAreaDashboard = useRef<HTMLDivElement | null>(null);
  const [alturaAreaDashboard, setAlturaAreaDashboard] = useState<number | null>(null);

  useEffect(() => {
    const el = refAreaDashboard.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    // Só restringe em telas grandes (breakpoint lg do Tailwind) — no celular o dashboard
    // sempre mostra tudo normalmente, empilhado, rolando a tela inteira como antes.
    const observador = new ResizeObserver((entradas) => {
      if (window.innerWidth < 1024) {
        setAlturaAreaDashboard(null);
        return;
      }
      const altura = entradas[0]?.contentRect.height;
      if (altura !== undefined) setAlturaAreaDashboard(altura);
    });
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  useEffect(() => {
    if (!usuario) return;
    queueMicrotask(() => {
      const salvo = localStorage.getItem(`mostrar12Meses_${usuario.uid}`);
      if (salvo !== null) setMostrar12Meses(salvo === "true");
    });
  }, [usuario]);

  function handleToggle12Meses() {
    setMostrar12Meses((v) => {
      const novo = !v;
      if (usuario) localStorage.setItem(`mostrar12Meses_${usuario.uid}`, String(novo));
      return novo;
    });
  }

  useEffect(() => {
    if (!usuario) return;
    if (loginProcessadoRef.current === usuario.uid) return;
    loginProcessadoRef.current = usuario.uid;
    queueMicrotask(() => {
      const chaveNovoLogin = `authNovoLogin_${usuario.uid}`;
      const chaveRevelados = `gruposRevelados_${usuario.uid}`;
      const ehNovoLogin = sessionStorage.getItem(chaveNovoLogin) === "true";

      if (ehNovoLogin) {
        sessionStorage.removeItem(chaveNovoLogin);
        sessionStorage.setItem(`totaisVisiveis_${usuario.uid}`, "false");
        sessionStorage.setItem(chaveRevelados, "{}");
        setTotaisVisiveis(false);
        setGruposRevelados({});
      } else {
        setTotaisVisiveis(sessionStorage.getItem(`totaisVisiveis_${usuario.uid}`) === "true");
        const salvos = sessionStorage.getItem(chaveRevelados);
        setGruposRevelados(salvos ? JSON.parse(salvos) : {});
      }
    });
  }, [usuario]);

  useEffect(() => {
    if (!usuario) return;
    return assinarConfigListas(usuario.uid, setConfig);
  }, [usuario]);

  useEffect(() => {
    if (!usuario) return;
    return assinarFiltrosDashboard(usuario.uid, setFiltros);
  }, [usuario]);

  useEffect(() => {
    if (!usuario) return;
    return assinarRecorrencias(usuario.uid, "pagar", setRecorrencias);
  }, [usuario]);

  useEffect(() => {
    if (!usuario || recorrencias.length === 0) return;
    if (ym > mesAtualYM()) return;
    sincronizarReembolsosRecorrentes(usuario.uid, recorrencias, ym);
  }, [usuario, recorrencias, ym]);

  useEffect(() => {
    if (!usuario) return;
    return assinarRecebimentosDoMes(usuario.uid, ym, setRecebimentos);
  }, [usuario, ym]);

  useEffect(() => {
    if (!usuario) return;
    return assinarParcelasDoMes(usuario.uid, ym, (dados) => {
      setEstadoMes({ ym, parcelasReais: dados });
    });
  }, [usuario, ym]);

  const carregando = estadoMes.ym !== ym;

  const parcelas = useMemo(
    () => (carregando ? [] : mesclarComRecorrencias(estadoMes.parcelasReais, recorrencias, ym)),
    [carregando, estadoMes, recorrencias, ym]
  );

  const filtrosEfetivos = useMemo(
    () =>
      Object.fromEntries(config.grupos.map((g) => [g, gruposRevelados[g] ? filtros[g] : false])),
    [config.grupos, filtros, gruposRevelados]
  );

  const todosGruposMarcados =
    config.grupos.length > 0 && config.grupos.every((g) => filtrosEfetivos[g] !== false);

  function handleAlternarTodosGrupos(marcar: boolean) {
    if (!usuario) return;
    setGruposRevelados((prev) => {
      const novo = { ...prev };
      config.grupos.forEach((g) => {
        novo[g] = true;
      });
      sessionStorage.setItem(`gruposRevelados_${usuario.uid}`, JSON.stringify(novo));
      return novo;
    });
    config.grupos.forEach((g) => alternarFiltroGrupo(usuario.uid, g, marcar));
  }

  const parcelasVisiveis = useMemo(
    () => parcelas.filter((p) => filtrosEfetivos[p.grupo] !== false),
    [parcelas, filtrosEfetivos]
  );

  const porGrupo = useMemo(() => {
    const mapa = new Map<string, Parcela[]>();
    for (const p of parcelasVisiveis) {
      const lista = mapa.get(p.grupo) ?? [];
      lista.push(p);
      mapa.set(p.grupo, lista);
    }
    const ordem = config.grupos;
    return [...mapa.entries()].sort((a, b) => ordem.indexOf(a[0]) - ordem.indexOf(b[0]));
  }, [parcelasVisiveis, config.grupos]);

  const statusPorGrupo = useMemo(
    () => Object.fromEntries(porGrupo.map(([grupo, itens]) => [grupo, statusGrupo(itens)])),
    [porGrupo]
  );

  const totais = useMemo(() => {
    const base = config.modoTotalizador === "visiveis" ? parcelasVisiveis : parcelas;
    let total = 0;
    let pago = 0;
    for (const p of base) {
      const valor = valorEfetivo(p);
      total += valor;
      if (p.pago) pago += valor;
    }
    return { total, pago, pendente: total - pago };
  }, [parcelas, parcelasVisiveis, config.modoTotalizador]);

  const totalAReceber = useMemo(() => recebimentos.reduce((s, r) => s + r.valor, 0), [recebimentos]);

  const totalRecebido = useMemo(
    () => recebimentos.filter((r) => r.recebido).reduce((s, r) => s + r.valor, 0),
    [recebimentos]
  );

  const faltaReceber = totalRecebido < totalAReceber;

  const liquidoMensal = totalRecebido - totais.total;

  function irParaMes(novoYm: string) {
    definirYm(novoYm);
    router.push(`/inicio?mes=${novoYm}`);
  }

  if (!usuario) return null;

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col px-4 py-4 md:px-8 lg:h-full">
      <div className="sticky top-0 z-20 bg-background pb-1 print:static">
        <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="grid grid-cols-2 gap-2 text-center sm:flex-1 sm:grid-cols-5">
            <div className="rounded-lg border border-slate-200 bg-white px-2 py-1 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Total de gastos no mês</p>
              <p
                className={`text-sm font-semibold ${
                  totaisVisiveis ? "text-red-600 dark:text-red-400" : "text-slate-900 dark:text-slate-100"
                }`}
              >
                {totaisVisiveis ? formatarMoeda(totais.total) : "••••••"}
              </p>
            </div>
            <Link
              href={`/receber?aba=mes&mes=${ym}`}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 shadow-sm transition-colors hover:border-emerald-300 hover:bg-emerald-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-emerald-700 dark:hover:bg-emerald-950"
            >
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Recebimentos do mês</p>
              <p
                className={`text-sm font-semibold ${
                  totaisVisiveis
                    ? faltaReceber
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-emerald-600 dark:text-emerald-400"
                    : "text-slate-900 dark:text-slate-100"
                }`}
              >
                {totaisVisiveis ? formatarMoeda(totalRecebido) : "••••••"}
              </p>
            </Link>
            <div className="rounded-lg border border-slate-200 bg-white px-2 py-1 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Pago</p>
              <p
                className={`text-sm font-semibold ${
                  totaisVisiveis ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-slate-100"
                }`}
              >
                {totaisVisiveis ? formatarMoeda(totais.pago) : "••••••"}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-2 py-1 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Pendente</p>
              <p
                className={`text-sm font-semibold ${
                  totaisVisiveis ? "text-red-600 dark:text-red-400" : "text-slate-900 dark:text-slate-100"
                }`}
              >
                {totaisVisiveis ? formatarMoeda(totais.pendente) : "••••••"}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-2 py-1 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Líquido mensal</p>
              <p
                className={`text-sm font-semibold ${
                  totaisVisiveis
                    ? liquidoMensal < 0
                      ? "text-red-600 dark:text-red-400"
                      : liquidoMensal === 0
                        ? "text-slate-900 dark:text-slate-100"
                        : "text-emerald-600 dark:text-emerald-400"
                    : "text-slate-900 dark:text-slate-100"
                }`}
              >
                {totaisVisiveis ? formatarMoeda(liquidoMensal) : "••••••"}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 sm:contents">
            <button
              onClick={() =>
                setTotaisVisiveis((v) => {
                  const novo = !v;
                  if (usuario) sessionStorage.setItem(`totaisVisiveis_${usuario.uid}`, String(novo));
                  return novo;
                })
              }
              aria-label={totaisVisiveis ? "Ocultar totalizadores" : "Mostrar totalizadores"}
              className="rounded-lg border border-slate-300 p-2 text-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              {totaisVisiveis ? <IconOlhoFechado className="h-4 w-4" /> : <IconOlho className="h-4 w-4" />}
            </button>

            <SeletorMesAno ym={ym} onMudar={irParaMes} />
          </div>
        </div>

        {config.grupos.length > 0 && (
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleAlternarTodosGrupos(!todosGruposMarcados)}
              className="rounded-full border border-slate-300 px-3 py-1 text-sm text-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              {todosGruposMarcados ? "Desmarcar todos" : "Marcar todos"}
            </button>
            {config.grupos.map((grupo) => {
              const visivel = filtrosEfetivos[grupo] !== false;
              return (
                <label
                  key={grupo}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${
                    visivel
                      ? "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
                      : "border-slate-200 bg-white text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={visivel}
                    onChange={(e) => {
                      setGruposRevelados((prev) => {
                        const novo = { ...prev, [grupo]: true };
                        sessionStorage.setItem(`gruposRevelados_${usuario.uid}`, JSON.stringify(novo));
                        return novo;
                      });
                      alternarFiltroGrupo(usuario.uid, grupo, e.target.checked);
                    }}
                    className="h-3.5 w-3.5 accent-indigo-600"
                  />
                  {grupo}
                </label>
              );
            })}
          </div>
        )}

        <div className="mb-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Janela de 10 meses</span>
            <button
              onClick={handleToggle12Meses}
              aria-label={mostrar12Meses ? "Ocultar próximos 12 meses" : "Mostrar próximos 12 meses"}
              className="rounded-lg border border-slate-300 p-1.5 text-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              {mostrar12Meses ? <IconOlhoFechado className="h-3.5 w-3.5" /> : <IconOlho className="h-3.5 w-3.5" />}
            </button>
          </div>

          {mostrar12Meses && (
            <div className="mt-1">
              <VisaoGeral13Meses
                uid={usuario.uid}
                ym={ym}
                config={config}
                filtros={filtrosEfetivos}
                recorrencias={recorrencias}
                onSelecionarMes={irParaMes}
                statusPorGrupo={statusPorGrupo}
                totaisVisiveis={totaisVisiveis}
                mostrarSubtotalProvisao={config.mostrarSubtotalProvisaoInicio ?? false}
              />
            </div>
          )}
        </div>
      </div>

      <div ref={refAreaDashboard} className="scroll-sem-barra lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        {carregando ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Carregando...</p>
        ) : parcelas.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center dark:border-slate-600 dark:bg-slate-800">
            <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">Nenhum lançamento neste mês ainda.</p>
            <Link href="/lancar" className="text-sm font-medium text-indigo-600 underline dark:text-indigo-400">
              Lançar a primeira conta
            </Link>
          </div>
        ) : config.mostrarDashboardInicio ? (
          <DashboardFormaPagamento
            parcelas={parcelasVisiveis}
            gruposConfig={config.grupos}
            aplicacoesConfig={config.aplicacoes}
            tipoGrafico={config.tipoGraficoDashboard ?? "pizza"}
            alturaDisponivel={alturaAreaDashboard}
          />
        ) : null}
      </div>
    </div>
  );
}
