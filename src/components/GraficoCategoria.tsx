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

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-3 sm:flex-row sm:items-stretch">
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

      <ul
        className="scroll-sem-barra flex min-h-0 min-w-0 flex-1 flex-col gap-1.5 overflow-y-auto sm:w-[55%]"
        style={{ minHeight: ALTURA }}
      >
        {itens.map((item) => (
          <li key={item.nome} className="flex items-center gap-2 text-sm">
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
}: {
  titulo: string;
  itens: ItemGrafico[];
  tipoGrafico: "barra" | "pizza";
  formatarValor: (v: number) => string;
  corGrid: string;
  corTextoSecundario: string;
}) {
  const ALTURA_CARTAO = 170;
  const alturaConteudoBarra = Math.max(itens.length * 32 + 20, ALTURA_CARTAO);

  return (
    <div className={`${CLASSE_CARD} flex flex-col lg:h-full lg:min-h-0`}>
      <p className="mb-2 shrink-0 text-sm font-semibold text-slate-900 dark:text-slate-100">{titulo}</p>
      {itens.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">Sem dados para o mês.</p>
      ) : (
        <div className="flex min-h-0 flex-1 justify-center">
          {tipoGrafico === "barra" ? (
            <div className="scroll-sem-barra w-full min-h-0 overflow-y-auto" style={{ minHeight: ALTURA_CARTAO }}>
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
