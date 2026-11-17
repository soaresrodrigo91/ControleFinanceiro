"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { CLASSE_CARD } from "@/lib/estilos";
import { formatarDataBR, formatarMesAno, formatarMoeda } from "@/lib/date";
import { montarDestaques, palavraQueDestaca } from "@/lib/destaqueNoticias";
import type { IndicadoresEconomicos as Dados, PontoSerie } from "@/lib/indicadores";

// Cartão alternativo ao mini-dashboard da Início (Configurações > Geral I): dólar, Selic e
// IPCA com a última mudança, exemplos práticos, o que é afetado e notícias recentes. Ocupa o
// mesmo espaço do dashboard: 4 quadros lado a lado, cada um com o conteúdo rolando por dentro.

const ALTURA_CONTEUDO = 150;
const RECARREGAR_MS = 30 * 60 * 1000;

function pct(valor: number, casas = 2): string {
  return `${valor.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
}

function sinal(valor: number, formatar: (v: number) => string): string {
  return `${valor > 0 ? "+" : valor < 0 ? "−" : ""}${formatar(Math.abs(valor))}`;
}

function brl4(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 4 });
}

function tempoRelativo(iso: string | null): string {
  if (!iso) return "";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 60) return `há ${Math.max(min, 1)} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ontem" : `há ${d} dias`;
}

// Alta do dólar e da inflação pesa no bolso (vermelho); queda alivia (verde).
function Variacao({ valor, texto, altaEhRuim = true }: { valor: number; texto: string; altaEhRuim?: boolean }) {
  const ruim = altaEhRuim ? valor > 0 : valor < 0;
  const cor =
    valor === 0
      ? "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
      : ruim
        ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${cor}`}>
      {valor > 0 ? "▲" : valor < 0 ? "▼" : "■"} {texto}
    </span>
  );
}

const MESES_ABREV = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// Rótulos de referência do eixo do tempo embaixo dos gráficos (datas em ISO YYYY-MM-DD).
function rotuloDia(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}
function rotuloMes(iso: string): string {
  return `${MESES_ABREV[Number(iso.slice(5, 7)) - 1]}/${iso.slice(2, 4)}`;
}

// Gráfico de linha simples. Embaixo, mostra a data do primeiro, do ponto do meio e do último
// valor, para dar a referência de período (os pontos ficam igualmente espaçados).
function Sparkline({
  serie,
  rotulo,
  formatarData,
}: {
  serie: PontoSerie[];
  rotulo: string;
  formatarData: (iso: string) => string;
}) {
  if (serie.length < 2) return null;
  const meio = serie[Math.floor((serie.length - 1) / 2)];
  const L = 200;
  const A = 36;
  const valores = serie.map((p) => p.valor);
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const faixa = max - min || 1;
  const pontos = serie.map((p, i) => {
    const x = (i / (serie.length - 1)) * L;
    const y = A - 3 - ((p.valor - min) / faixa) * (A - 6);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <div className="flex min-h-12 flex-1 flex-col">
      <svg
        viewBox={`0 0 ${L} ${A}`}
        preserveAspectRatio="none"
        className="min-h-9 w-full flex-1 text-indigo-500 dark:text-indigo-400"
        role="img"
        aria-label={rotulo}
      >
        <polyline
          points={`0,${A} ${pontos.join(" ")} ${L},${A}`}
          fill="currentColor"
          fillOpacity={0.08}
          stroke="none"
        />
        <polyline
          points={pontos.join(" ")}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="mt-0.5 flex justify-between text-[10px] text-slate-400 dark:text-slate-500">
        <span>{formatarData(serie[0].data)}</span>
        {serie.length > 2 && <span>{formatarData(meio.data)}</span>}
        <span>{formatarData(serie[serie.length - 1].data)}</span>
      </div>
    </div>
  );
}

// Os 4 quadros têm sempre a mesma altura e, em telas grandes, esticam até o fim da área
// disponível da Início. ALTURA_CONTEUDO é o mínimo: se a Janela de 10 meses ocupar muito
// espaço, os quadros param nessa altura e a área rola (o conteúdo também rola por dentro).
type Parte = "dolar" | "selic" | "ipca" | "noticias";

// Botão de atualizar de cada quadro: busca de novo só a parte daquele quadro no servidor.
const AtualizarContext = createContext<{ atualizando: Parte | null; atualizar: (parte: Parte) => void }>({
  atualizando: null,
  atualizar: () => {},
});

function IconAtualizar({ girando }: { girando: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-3.5 w-3.5 ${girando ? "animate-spin" : ""}`}
    >
      <path d="M20 11a8 8 0 0 0-14.9-3.9M4 4v4h4" />
      <path d="M4 13a8 8 0 0 0 14.9 3.9M20 20v-4h-4" />
    </svg>
  );
}

function Quadro({
  titulo,
  subtitulo,
  parte,
  children,
}: {
  titulo: string;
  subtitulo: string;
  parte: Parte;
  children: ReactNode;
}) {
  const { atualizando, atualizar } = useContext(AtualizarContext);
  const girando = atualizando === parte;
  return (
    <div className={`${CLASSE_CARD} flex min-w-0 flex-col`}>
      <div className="mb-2 flex shrink-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{titulo}</p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{subtitulo}</p>
        </div>
        <button
          type="button"
          onClick={() => atualizar(parte)}
          disabled={atualizando !== null}
          title={`Atualizar ${titulo.toLowerCase()}`}
          aria-label={`Atualizar ${titulo.toLowerCase()}`}
          className="shrink-0 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-wait dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-200"
        >
          <IconAtualizar girando={girando} />
        </button>
      </div>
      <div
        className="scroll-sem-barra flex flex-1 flex-col gap-1.5 text-xs text-slate-600 lg:h-0 lg:overflow-y-auto dark:text-slate-400"
        style={{ minHeight: ALTURA_CONTEUDO }}
      >
        {children}
      </div>
    </div>
  );
}

function Destaque({ children }: { children: ReactNode }) {
  return <strong className="font-medium text-slate-800 dark:text-slate-200">{children}</strong>;
}

function ValorPrincipal({ valor, children }: { valor: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className="text-xl font-semibold text-slate-900 dark:text-slate-100">{valor}</span>
      {children}
    </div>
  );
}

function Indisponivel() {
  return <p className="text-slate-400 dark:text-slate-500">Dado indisponível no momento.</p>;
}

function QuadroDolar({ dados}: { dados: Dados["dolar"] }) {
  if (!dados)
    return (
      <Quadro parte="dolar" titulo="Dólar" subtitulo="PTAX · Banco Central">
        <Indisponivel />
      </Quadro>
    );
  const varDia = ((dados.valor - dados.anterior) / dados.anterior) * 100;
  const var30 = ((dados.valor - dados.valor30d) / dados.valor30d) * 100;
  return (
    <Quadro parte="dolar" titulo="Dólar" subtitulo={`PTAX · ${formatarDataBR(dados.data)}`}>
      <ValorPrincipal valor={brl4(dados.valor)}>
        <Variacao valor={varDia} texto={sinal(varDia, (v) => pct(v))} />
      </ValorPrincipal>
      <p>
        Antes {brl4(dados.anterior)} · 30 dias <Destaque>{sinal(var30, (v) => pct(v))}</Destaque>
      </p>
      <Sparkline serie={dados.serie} rotulo="Dólar nos últimos 30 dias" formatarData={rotuloDia} />
      <p>
        US$ 100 = <Destaque>{formatarMoeda(dados.valor * 100)}</Destaque>
      </p>
              <p>{var30 >= 0 ? "Encarece" : "Alivia"}: eletrônicos, combustíveis e viagens</p>
    </Quadro>
  );
}

// Dica (ao passar o mouse) da última linha do quadro da Selic.
const EXPLICACAO_SELIC =
  "A Selic é a taxa básica de juros do país e serve de referência para os bancos.\n\n" +
  "Quando ela cai, os bancos tendem a cobrar juros menores em empréstimos, financiamentos, " +
  "cartão de crédito e cheque especial (a redução chega aos poucos, ao longo de semanas ou meses), " +
  "e as aplicações ligadas a ela (poupança, CDB, Tesouro Selic) passam a render um pouco menos.\n\n" +
  "Quando ela sobe, acontece o contrário: pegar dinheiro emprestado fica mais caro e as aplicações rendem mais.";

function QuadroSelic({ dados}: { dados: Dados["selic"] }) {
  if (!dados)
    return (
      <Quadro parte="selic" titulo="Taxa Selic" subtitulo="Copom · Banco Central">
        <Indisponivel />
      </Quadro>
    );
  const diff = dados.anterior !== null ? dados.valor - dados.anterior : 0;
  const rendimentoMes = (Math.pow(1 + dados.valor / 100, 1 / 12) - 1) * 1000;
  return (
    <Quadro parte="selic" titulo="Taxa Selic" subtitulo="Meta do Copom · Banco Central">
      <ValorPrincipal valor={`${pct(dados.valor)} a.a.`}>
        {dados.anterior !== null && (
          <Variacao
            valor={diff}
            altaEhRuim={false}
            texto={`${sinal(diff, (v) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 }))} p.p.`}
          />
        )}
      </ValorPrincipal>
      <p>
        {dados.anterior !== null && dados.desde
          ? `Antes ${pct(dados.anterior)} · desde ${formatarDataBR(dados.desde)}`
          : "Sem mudança nos últimos 3 anos"}
      </p>
      <Sparkline serie={dados.mudancas} rotulo="Últimas mudanças da Selic" formatarData={rotuloMes} />
      <p>
        R$ 1.000 aplicados rendem <Destaque>~{formatarMoeda(rendimentoMes)}/mês</Destaque> (bruto)
      </p>
      <p className="cursor-help" title={EXPLICACAO_SELIC}>
        {diff < 0
          ? "Em queda: juros de empréstimos tendem a cair e aplicações rendem menos"
          : diff > 0
            ? "Em alta: juros de empréstimos tendem a subir e aplicações rendem mais"
            : "Referência para os juros de empréstimos e o rendimento das aplicações"}
      </p>
    </Quadro>
  );
}

function QuadroIpca({ dados}: { dados: Dados["ipca"] }) {
  if (!dados)
    return (
      <Quadro parte="ipca" titulo="Inflação (IPCA)" subtitulo="IBGE">
        <Indisponivel />
      </Quadro>
    );
  // grupos vem ordenado da maior alta para a maior queda.
  const subiram = dados.grupos.filter((g) => g.variacao > 0);
  const cairam = dados.grupos.filter((g) => g.variacao < 0).reverse();
  const listaGrupos = (titulo: string, grupos: typeof dados.grupos) =>
    [titulo + ":", ...grupos.map((g) => `${g.nome}: ${sinal(g.variacao, (v) => pct(v))}`)].join("\n");
  return (
    <Quadro parte="ipca" titulo="Inflação (IPCA)" subtitulo={`${formatarMesAno(dados.mes)} · IBGE`}>
      <ValorPrincipal valor={pct(dados.mensal)}>
        {dados.mensalAnterior !== null && (
          <Variacao valor={dados.mensal - dados.mensalAnterior} texto={`antes ${pct(dados.mensalAnterior)}`} />
        )}
      </ValorPrincipal>
      {dados.acumulado12m !== null && (
        <p>
          12 meses <Destaque>{pct(dados.acumulado12m)}</Destaque>
          {dados.acumulado12mAnterior !== null && ` · antes ${pct(dados.acumulado12mAnterior)}`}
        </p>
      )}
      <Sparkline serie={dados.serie} rotulo="IPCA mensal nos últimos 12 meses" formatarData={rotuloMes} />
      {dados.acumulado12m !== null && (
        <p>
          R$ 100 de 1 ano atrás = <Destaque>{formatarMoeda(100 * (1 + dados.acumulado12m / 100))}</Destaque>
        </p>
      )}
      {(subiram.length > 0 || cairam.length > 0) && (
        // Cada parte tem a própria dica ao passar o mouse: ▲ lista só os grupos que subiram no
        // mês e ▼ só os que caíram (do maior para o menor movimento).
        <p className="truncate">
          {subiram.length > 0 && (
            <span className="cursor-help" title={listaGrupos("Subiram no mês", subiram)}>
              ▲ {subiram[0].nome} {sinal(subiram[0].variacao, (v) => pct(v))}
            </span>
          )}
          {subiram.length > 0 && cairam.length > 0 && " · "}
          {cairam.length > 0 && (
            <span className="cursor-help" title={listaGrupos("Caíram no mês", cairam)}>
              ▼ {cairam[0].nome} {sinal(cairam[0].variacao, (v) => pct(v))}
            </span>
          )}
        </p>
      )}
    </Quadro>
  );
}

// Quantas notícias o quadro mostra (a API devolve mais, para as palavras de destaque terem
// onde procurar).
const MAX_NOTICIAS_QUADRO = 15;
// Quantas notícias normais entre uma em destaque (laranja) e a próxima.
const NORMAIS_ENTRE_DESTAQUES = 2;

function QuadroNoticias({ noticias, palavrasDestaque }: { noticias: Dados["noticias"]; palavrasDestaque: string[] }) {
  // Notícias que combinam com as palavras de destaque do usuário ficam em laranja. Para a lista
  // não ficar toda laranja, elas são intercaladas com as demais: 1 em destaque, 2 normais, 1 em
  // destaque, 2 normais... (cada grupo mantém sua ordem original). Se um dos grupos acabar, o
  // outro completa a lista.
  const lista = useMemo(() => {
    const destaques = montarDestaques(palavrasDestaque);
    const marcadas = noticias.map((n) => ({ ...n, palavra: palavraQueDestaca(n.titulo, destaques) }));
    const laranjas = marcadas.filter((n) => n.palavra);
    const normais = marcadas.filter((n) => !n.palavra);
    const intercaladas: typeof marcadas = [];
    while ((laranjas.length || normais.length) && intercaladas.length < MAX_NOTICIAS_QUADRO) {
      if (laranjas.length) intercaladas.push(laranjas.shift()!);
      intercaladas.push(...normais.splice(0, NORMAIS_ENTRE_DESTAQUES));
    }
    return intercaladas.slice(0, MAX_NOTICIAS_QUADRO);
  }, [noticias, palavrasDestaque]);

  return (
    <Quadro parte="noticias" titulo="Notícias de economia" subtitulo="G1, Folha, Estadão, Agência Brasil e IBGE">
      {lista.length === 0 ? (
        <p className="text-slate-400 dark:text-slate-500">Nenhuma notícia recente.</p>
      ) : (
        <ul className="flex flex-1 flex-col justify-between gap-3">
          {lista.map((n) => (
            <li
              key={n.link}
              className={`flex flex-col gap-0.5 leading-snug ${
                n.palavra ? "border-l-2 border-orange-500 pl-2 dark:border-orange-400" : ""
              }`}
            >
              <a
                href={n.link}
                target="_blank"
                rel="noopener noreferrer"
                className={`line-clamp-2 font-medium hover:underline ${
                  n.palavra
                    ? "text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300"
                    : "text-slate-800 hover:text-indigo-600 dark:text-slate-200 dark:hover:text-indigo-400"
                }`}
              >
                {n.titulo}
              </a>
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                {n.fonte}
                {n.data && ` · ${tempoRelativo(n.data)}`}
                {n.palavra && <span className="text-orange-600 dark:text-orange-400"> · {n.palavra}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Quadro>
  );
}

// esticar: ocupa todo o espaço que sobra na tela (com altura mínima). Sem ele (ex.: Janela de
// 10 meses oculta), os quadros ficam com a altura padrão, sem crescer até o fim da tela.
export default function IndicadoresEconomicos({
  esticar,
  palavrasDestaque,
}: {
  esticar: boolean;
  palavrasDestaque: string[];
}) {
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState(false);
  const [atualizando, setAtualizando] = useState<Parte | null>(null);

  const atualizar = useCallback(async (parte: Parte) => {
    setAtualizando(parte);
    try {
      const resp = await fetch(`/api/indicadores?atualizar=${parte}`, { cache: "no-store" });
      if (resp.ok) setDados((await resp.json()) as Dados);
    } catch {
      // Mantém o que já está na tela.
    } finally {
      setAtualizando(null);
    }
  }, []);
  const contexto = useMemo(() => ({ atualizando, atualizar }), [atualizando, atualizar]);

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      try {
        const resp = await fetch("/api/indicadores");
        if (!resp.ok) throw new Error(String(resp.status));
        const json = (await resp.json()) as Dados;
        if (ativo) {
          setDados(json);
          setErro(false);
        }
      } catch {
        if (ativo) setErro(true);
      }
    }
    carregar();
    const intervalo = setInterval(carregar, RECARREGAR_MS);
    return () => {
      ativo = false;
      clearInterval(intervalo);
    };
  }, []);

  if (!dados) {
    return (
      <p className="pt-4 text-sm text-slate-500 dark:text-slate-400">
        {erro ? "Não foi possível carregar os indicadores agora. Tente novamente mais tarde." : "Carregando indicadores..."}
      </p>
    );
  }

  return (
    <AtualizarContext.Provider value={contexto}>
      <div className={`flex flex-col pt-4 ${esticar ? "lg:min-h-[270px] lg:flex-1" : ""}`}>
        <div
          className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 ${
            esticar ? "lg:min-h-0 lg:flex-1 lg:grid-rows-[minmax(0,1fr)]" : "lg:grid-rows-[300px]"
          }`}
        >
          <QuadroDolar dados={dados.dolar} />
          <QuadroSelic dados={dados.selic} />
          <QuadroIpca dados={dados.ipca} />
          <QuadroNoticias noticias={dados.noticias} palavrasDestaque={palavrasDestaque} />
        </div>
        <p className="mt-2 text-right text-[11px] text-slate-400 dark:text-slate-500">
          Fontes: Banco Central do Brasil, IBGE, G1, Folha de S.Paulo, Estadão e Agência Brasil · atualizado{" "}
          {new Date(dados.atualizadoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </AtualizarContext.Provider>
  );
}
