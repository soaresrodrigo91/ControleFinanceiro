"use client";

import { useMemo } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { formatarMoeda } from "@/lib/date";
import { GraficoItem, type ItemGrafico } from "@/components/GraficoCategoria";
import type { Parcela } from "@/lib/types";

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
const COR_GRID_LIGHT = "#e1e0d9";
const COR_GRID_DARK = "#2c2c2a";
const COR_TEXTO_SECUNDARIO_LIGHT = "#52514e";
const COR_TEXTO_SECUNDARIO_DARK = "#c3c2b7";

function montarItens(mapa: Map<string, number>, ordem: string[], paleta: string[]): ItemGrafico[] {
  const copia = new Map(mapa);
  const itens: ItemGrafico[] = [];
  let indice = 0;

  ordem.forEach((nome) => {
    const valor = copia.get(nome);
    if (!valor) return;
    itens.push({ nome, valor, cor: paleta[indice % paleta.length] });
    indice++;
    copia.delete(nome);
  });

  for (const [nome, valor] of copia) {
    itens.push({ nome, valor, cor: paleta[indice % paleta.length] });
    indice++;
  }

  return itens.sort((a, b) => b.valor - a.valor);
}

// Altura mínima (em px) para o mini-dashboard caber inteiro sem cortar nada. Os cartões
// não esticam mais para acompanhar a altura do vizinho mais alto: cada um fica do
// tamanho do círculo do gráfico (170px) + título + padding (~230px), com a lista
// rolando dentro do próprio quadro. Abaixo disso vira lista compacta (título + padding
// + lista, sem gráfico) — a área ao redor (inclusive a Janela de 10 meses) também rola,
// então o mini-dashboard nunca fica oculto, só compacto quando o espaço visível é curto.
const LIMIAR_COMPLETO = 240;

export default function DashboardFormaPagamento({
  parcelas,
  gruposConfig,
  aplicacoesConfig,
  tipoGrafico,
  alturaDisponivel,
}: {
  parcelas: Parcela[];
  gruposConfig: string[];
  aplicacoesConfig: string[];
  tipoGrafico: "barra" | "pizza";
  alturaDisponivel: number | null;
}) {
  const { tema } = useTheme();
  const paleta = tema === "dark" ? PALETA_CATEGORICA_DARK : PALETA_CATEGORICA_LIGHT;
  const corGrid = tema === "dark" ? COR_GRID_DARK : COR_GRID_LIGHT;
  const corTextoSecundario = tema === "dark" ? COR_TEXTO_SECUNDARIO_DARK : COR_TEXTO_SECUNDARIO_LIGHT;

  const valorPorGrupo = useMemo(() => {
    const soma = new Map<string, number>();
    for (const p of parcelas) soma.set(p.grupo, (soma.get(p.grupo) ?? 0) + p.valorParcela);
    return montarItens(soma, gruposConfig, paleta);
  }, [parcelas, gruposConfig, paleta]);

  const qtdLancamentosPorGrupo = useMemo(() => {
    const cont = new Map<string, number>();
    for (const p of parcelas) cont.set(p.grupo, (cont.get(p.grupo) ?? 0) + 1);
    return montarItens(cont, gruposConfig, paleta);
  }, [parcelas, gruposConfig, paleta]);

  const valorPorAplicacao = useMemo(() => {
    const soma = new Map<string, number>();
    for (const p of parcelas) soma.set(p.aplicacao, (soma.get(p.aplicacao) ?? 0) + p.valorParcela);
    return montarItens(soma, aplicacoesConfig, paleta);
  }, [parcelas, aplicacoesConfig, paleta]);

  if (parcelas.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Nenhum lançamento dos grupos marcados neste mês.
      </p>
    );
  }

  const modoCompacto = alturaDisponivel !== null && alturaDisponivel < LIMIAR_COMPLETO;

  return (
    <div className="flex flex-col pt-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-start">
        <GraficoItem
          titulo="Valor por grupo"
          itens={valorPorGrupo}
          tipoGrafico={tipoGrafico}
          formatarValor={formatarMoeda}
          corGrid={corGrid}
          corTextoSecundario={corTextoSecundario}
          modoCompacto={modoCompacto}
        />
        <GraficoItem
          titulo="Lançamentos por grupo"
          itens={qtdLancamentosPorGrupo}
          tipoGrafico={tipoGrafico}
          formatarValor={(v) => String(v)}
          corGrid={corGrid}
          corTextoSecundario={corTextoSecundario}
          modoCompacto={modoCompacto}
        />
        <GraficoItem
          titulo="Aplicações dos lançamentos"
          itens={valorPorAplicacao}
          tipoGrafico={tipoGrafico}
          formatarValor={formatarMoeda}
          corGrid={corGrid}
          corTextoSecundario={corTextoSecundario}
          modoCompacto={modoCompacto}
        />
      </div>
    </div>
  );
}
