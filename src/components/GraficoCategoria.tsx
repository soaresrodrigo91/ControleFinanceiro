"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CLASSE_CARD } from "@/lib/estilos";

const COR_EIXO = "#898781";

// Altura fixa de cada linha da lista (classe h-6) e espaçamento entre elas (gap-1.5),
// usados para calcular quantas linhas cabem inteiras num espaço, sem cortar a última.
const ALTURA_LINHA = 24;
const ESPACO_LINHA = 6;

function alturaListaSemCorte(alturaMaxima: number): number {
  const linhas = Math.max(1, Math.floor((alturaMaxima + ESPACO_LINHA) / (ALTURA_LINHA + ESPACO_LINHA)));
  return linhas * ALTURA_LINHA + (linhas - 1) * ESPACO_LINHA;
}

export type ItemGrafico = { nome: string; valor: number; cor: string };

export function TooltipItem({
  active,
  payload,
  formatarValor,
}: {
  active?: boolean;
  payload?: Array<{ payload: ItemGrafico }>;
  formatarValor: (v: number) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md dark:border-slate-700 dark:bg-slate-800">
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatarValor(item.valor)}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{item.nome}</p>
    </div>
  );
}

export function GraficoPizza({
  itens,
  formatarValor,
}: {
  itens: ItemGrafico[];
  formatarValor: (v: number) => string;
}) {
  const total = itens.reduce((s, i) => s + i.valor, 0);
  const ALTURA = 170;
  const ALTURA_LISTA = alturaListaSemCorte(ALTURA);

  return (
    <div className="flex w-full flex-col gap-3 sm:flex-row">
      <div className="shrink-0 sm:w-[45%]">
        <ResponsiveContainer width="100%" height={ALTURA}>
          <PieChart>
            <Pie
              data={itens}
              dataKey="valor"
              nameKey="nome"
              cx="50%"
              cy="50%"
              outerRadius="85%"
              isAnimationActive={false}
            >
              {itens.map((item) => (
                <Cell key={item.nome} fill={item.cor} />
              ))}
            </Pie>
            <Tooltip content={<TooltipItem formatarValor={formatarValor} />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* maxHeight travado em um múltiplo exato da altura da linha: nunca mostra a
          última linha cortada — o que não cabe fica oculto até rolar o mouse. */}
      <ul
        className="scroll-sem-barra flex min-w-0 flex-col gap-1.5 overflow-y-auto sm:w-[55%]"
        style={{ maxHeight: ALTURA_LISTA }}
      >
        {itens.map((item) => (
          <li key={item.nome} className="flex h-6 shrink-0 items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.cor }} />
            <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-300">{item.nome}</span>
            <span className="shrink-0 font-medium text-slate-900 dark:text-slate-100">
              {formatarValor(item.valor)}
            </span>
            <span className="w-11 shrink-0 text-right text-xs text-slate-500 dark:text-slate-400">
              {total > 0 ? Math.round((item.valor / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function GraficoItem({
  titulo,
  itens,
  tipoGrafico,
  formatarValor,
  corGrid,
  corTextoSecundario,
  modoCompacto = false,
}: {
  titulo: string;
  itens: ItemGrafico[];
  tipoGrafico: "barra" | "pizza";
  formatarValor: (v: number) => string;
  corGrid: string;
  corTextoSecundario: string;
  modoCompacto?: boolean;
}) {
  const ALTURA_CARTAO = 170;
  const ALTURA_LISTA_COMPACTA = alturaListaSemCorte(ALTURA_CARTAO);
  const alturaConteudoBarra = Math.max(itens.length * 32 + 20, ALTURA_CARTAO);

  return (
    <div className={`${CLASSE_CARD} flex flex-col`}>
      <p className="mb-2 shrink-0 text-sm font-semibold text-slate-900 dark:text-slate-100">{titulo}</p>
      {itens.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">Sem dados para o mês.</p>
      ) : modoCompacto ? (
        // Sem espaço vertical suficiente para o gráfico: mesma informação em lista,
        // sem os círculos/barras. maxHeight travado em um múltiplo exato da altura da
        // linha para nunca cortar a última linha visível.
        <ul
          className="scroll-sem-barra flex flex-col gap-1.5 overflow-y-auto"
          style={{ maxHeight: ALTURA_LISTA_COMPACTA }}
        >
          {itens.map((item) => (
            <li key={item.nome} className="flex h-6 shrink-0 items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.cor }} />
              <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-300">{item.nome}</span>
              <span className="shrink-0 font-medium text-slate-900 dark:text-slate-100">
                {formatarValor(item.valor)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex justify-center">
          {tipoGrafico === "barra" ? (
            // Altura travada no tamanho do círculo da pizza: a lista rola com o mouse
            // dentro do quadro em vez de esticar o cartão para caber tudo.
            <div className="scroll-sem-barra w-full overflow-y-auto" style={{ height: ALTURA_CARTAO }}>
              <ResponsiveContainer width="100%" height={alturaConteudoBarra}>
                <BarChart data={itens} layout="vertical" margin={{ left: 8, right: 24 }}>
                  <CartesianGrid horizontal={false} stroke={corGrid} />
                  <XAxis
                    type="number"
                    tickFormatter={formatarValor}
                    tick={{ fill: COR_EIXO, fontSize: 11 }}
                    axisLine={{ stroke: corGrid }}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="nome"
                    width={110}
                    tick={{ fill: corTextoSecundario, fontSize: 12 }}
                    axisLine={{ stroke: corGrid }}
                    tickLine={false}
                  />
                  <Tooltip
                    content={<TooltipItem formatarValor={formatarValor} />}
                    cursor={{ fill: "rgba(148,163,184,0.12)" }}
                  />
                  <Bar dataKey="valor" barSize={20} radius={[0, 4, 4, 0]}>
                    {itens.map((item) => (
                      <Cell key={item.nome} fill={item.cor} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <GraficoPizza itens={itens} formatarValor={formatarValor} />
          )}
        </div>
      )}
    </div>
  );
}
