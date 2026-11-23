import type {
  GrupoIpca,
  IndicadorDolar,
  IndicadorIpca,
  IndicadorSelic,
  IndicadoresEconomicos,
  Noticia,
  PontoSerie,
} from "@/lib/indicadores";

// Indicadores econômicos (dólar, Selic, IPCA e notícias) para o cartão da tela Início.
// Busca direto nas fontes oficiais pelo servidor (evita CORS no navegador) e guarda o resultado
// por 30 minutos (em memória e no CDN via Cache-Control) — os dados mudam no máximo uma vez por
// dia (PTAX) ou por mês (IPCA). Não usa o cache do fetch do Next: a API do Banco Central
// responde 304/400 às requisições de revalidação que ele faz.
export const dynamic = "force-dynamic";

const CACHE_MS = 30 * 60 * 1000;
const CACHE_FALHA_MS = 5 * 60 * 1000;
const SEM_CACHE = { cache: "no-store" } as const;
const SGS = "https://api.bcb.gov.br/dados/serie/bcdata.sgs";

type PontoSgs = { data: string; valor: string };

function sgsParaISO(data: string): string {
  const [dia, mes, ano] = data.split("/");
  return `${ano}-${mes}-${dia}`;
}

function isoParaSgs(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

async function buscarJson<T>(url: string): Promise<T> {
  const resp = await fetch(url, { ...SEM_CACHE, signal: AbortSignal.timeout(10000) });
  if (!resp.ok) throw new Error(`${resp.status} ${url}`);
  return (await resp.json()) as T;
}

// Busca uma série do SGS por intervalo de datas (até hoje). Obs.: o parâmetro "ultimos/N" do
// SGS aceita no máximo 20 valores, e o servidor do BC às vezes responde 304 (sem corpo) para
// uma URL repetida — nesse caso tenta de novo recuando a data inicial em um dia, o que muda a
// URL sem alterar o resultado útil.
async function buscarSerieSgs(serie: number, inicio: Date): Promise<PontoSerie[]> {
  const hoje = new Date();
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    const ini = new Date(inicio);
    ini.setDate(ini.getDate() - tentativa);
    const url = `${SGS}.${serie}/dados?formato=json&dataInicial=${isoParaSgs(ini)}&dataFinal=${isoParaSgs(hoje)}`;
    const resp = await fetch(url, { ...SEM_CACHE, signal: AbortSignal.timeout(10000) });
    if (resp.status === 304) continue;
    if (!resp.ok) throw new Error(`${resp.status} ${url}`);
    const dados = (await resp.json()) as PontoSgs[];
    if (!Array.isArray(dados)) throw new Error("Resposta inesperada do SGS");
    return dados
      .map((p) => ({ data: sgsParaISO(p.data), valor: Number(p.valor) }))
      .filter((p) => Number.isFinite(p.valor));
  }
  throw new Error(`SGS ${serie}: sem resposta válida`);
}

function diasAtras(dias: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d;
}

async function buscarDolar(): Promise<IndicadorDolar> {
  // Série 1: dólar comercial (venda) — PTAX do Banco Central.
  const serie = await buscarSerieSgs(1, diasAtras(30));
  if (serie.length < 2) throw new Error("Série do dólar vazia");
  const atual = serie[serie.length - 1];
  const anterior = serie[serie.length - 2];
  return {
    valor: atual.valor,
    data: atual.data,
    anterior: anterior.valor,
    dataAnterior: anterior.data,
    valor30d: serie[0].valor,
    data30d: serie[0].data,
    serie,
  };
}

async function buscarSelic(): Promise<IndicadorSelic> {
  // Série 432: meta da Selic definida pelo Copom (valor diário; o BC já publica os dias até a
  // próxima reunião, por isso descarta datas futuras).
  const hoje = new Date().toISOString().slice(0, 10);
  const serie = (await buscarSerieSgs(432, diasAtras(3 * 365))).filter((p) => p.data <= hoje);
  if (serie.length === 0) throw new Error("Série da Selic vazia");

  const mudancas: PontoSerie[] = [];
  for (const p of serie) {
    if (mudancas.length === 0 || mudancas[mudancas.length - 1].valor !== p.valor) mudancas.push(p);
  }
  const ultima = mudancas[mudancas.length - 1];
  const penultima = mudancas.length > 1 ? mudancas[mudancas.length - 2] : null;
  return {
    valor: ultima.valor,
    // Se a série inteira tem um valor só, não dá para saber quando mudou de fato.
    desde: penultima ? ultima.data : "",
    anterior: penultima?.valor ?? null,
    mudancas: mudancas.slice(1).slice(-8),
  };
}

// Grupos do IPCA na tabela 7060 do SIDRA/IBGE.
const GRUPOS_IPCA = "7170,7445,7486,7558,7625,7660,7712,7766,7786";

type LinhaSidra = { V: string; D3C: string; D4N: string };

async function buscarIpca(): Promise<IndicadorIpca> {
  // Série 433: IPCA variação mensal; 13522: acumulado em 12 meses.
  const [mensalCompleto, acumulado, sidra] = await Promise.all([
    buscarSerieSgs(433, diasAtras(400)),
    buscarSerieSgs(13522, diasAtras(120)).catch(() => [] as PontoSerie[]),
    buscarJson<LinhaSidra[]>(
      `https://apisidra.ibge.gov.br/values/t/7060/n1/all/v/63/p/last%201/c315/${GRUPOS_IPCA}`
    ).catch(() => [] as LinhaSidra[]),
  ]);
  const mensal = mensalCompleto.slice(-12);
  if (mensal.length === 0) throw new Error("Série do IPCA vazia");
  const atual = mensal[mensal.length - 1];
  const mes = atual.data.slice(0, 7);

  const grupos: GrupoIpca[] = sidra
    .slice(1) // primeira linha é o cabeçalho
    .filter((l) => l.D3C === mes.replace("-", "") && Number.isFinite(Number(l.V)))
    .map((l) => ({ nome: l.D4N.replace(/^\d+\./, "").trim(), variacao: Number(l.V) }))
    .sort((a, b) => b.variacao - a.variacao);

  const acumAtual = acumulado.find((p) => p.data.slice(0, 7) === mes) ?? null;
  const acumAnterior = acumulado.filter((p) => p.data.slice(0, 7) < mes).at(-1) ?? null;
  return {
    mes,
    mensal: atual.valor,
    mensalAnterior: mensal.length > 1 ? mensal[mensal.length - 2].valor : null,
    acumulado12m: acumAtual?.valor ?? null,
    acumulado12mAnterior: acumAnterior?.valor ?? null,
    serie: mensal,
    grupos,
  };
}

// Assuntos que mais pesam no bolso: aparecem primeiro na lista de notícias.
const PALAVRAS_CHAVE =
  /d[óo]lar|c[âa]mbio|selic|juros|copom|infla[çc][ãa]o|ipca|banco central|pre[çc]os?\b|impostos?\b|tribut|\bIR\b|imposto de renda|\bCBS\b|\bIBS\b|al[íi]quota|gasolina|diesel|combust[íi]ve|etanol|petrobras|conta de luz|energia el[ée]trica|tarifa|aluguel|sal[áa]rio m[íi]nimo|aposentadoria|\bINSS\b|financiamento|cr[ée]dito|d[íi]vida|endividamento|poupan[çc]a|\bFGTS\b|reajuste/i;

// Feeds RSS de economia. A Folha usa ISO-8859-1 e passa os links por um redirecionador
// ("https://redir.folha.com.br/...*https://link-real") — por isso a leitura trata os dois.
const FEEDS_RSS = [
  { fonte: "G1", url: "https://g1.globo.com/rss/g1/economia/" },
  { fonte: "Folha", url: "https://feeds.folha.uol.com.br/mercado/rss091.xml" },
  { fonte: "Estadão", url: "https://www.estadao.com.br/arc/outboundfeeds/feeds/rss/sections/economia/" },
  { fonte: "Agência Brasil", url: "https://agenciabrasil.ebc.com.br/rss/economia/feed.xml" },
];

function decodificarEntidades(texto: string): string {
  return texto
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&")
    .trim();
}

function linkSeguro(link: string): string | null {
  try {
    const url = new URL(link.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

async function buscarRss(fonte: string, url: string): Promise<Noticia[]> {
  const resp = await fetch(url, {
    ...SEM_CACHE,
    headers: { "User-Agent": "Mozilla/5.0 (compatible; ControleFinanceiro/1.0)" },
    signal: AbortSignal.timeout(10000),
  });
  if (!resp.ok) return [];
  const bytes = await resp.arrayBuffer();
  const cabecalho = new TextDecoder("latin1").decode(bytes.slice(0, 200));
  const codificacao = cabecalho.match(/encoding=["']([\w-]+)["']/i)?.[1]?.toLowerCase() ?? "utf-8";
  let xml: string;
  try {
    xml = new TextDecoder(codificacao).decode(bytes);
  } catch {
    xml = new TextDecoder("utf-8").decode(bytes);
  }
  const noticias: Noticia[] = [];
  for (const [, item] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const titulo = decodificarEntidades(item.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "");
    let linkBruto = decodificarEntidades(item.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? "");
    const redirecionado = linkBruto.indexOf("*http");
    if (redirecionado >= 0) linkBruto = linkBruto.slice(redirecionado + 1);
    const link = linkSeguro(linkBruto);
    const pub = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1];
    if (!titulo || !link) continue;
    const data = pub ? new Date(pub.trim()) : null;
    noticias.push({
      titulo,
      link,
      fonte,
      data: data && !Number.isNaN(data.getTime()) ? data.toISOString() : null,
      destaque: PALAVRAS_CHAVE.test(titulo),
    });
  }
  return noticias;
}

type NoticiaIbge = { titulo: string; link: string; data_publicacao: string };

async function buscarNoticiasIbge(): Promise<Noticia[]> {
  const dados = await buscarJson<{ items?: NoticiaIbge[] }>(
    "https://servicodados.ibge.gov.br/api/v3/noticias/?busca=IPCA&qtd=2&tipo=noticia"
  );
  return (dados.items ?? []).flatMap((n) => {
    const link = linkSeguro(n.link);
    if (!link || !n.titulo) return [];
    // data_publicacao vem como "dd/mm/aaaa hh:mm:ss" (horário de Brasília).
    const m = n.data_publicacao?.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})/);
    const data = m ? new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:00-03:00`).toISOString() : null;
    return [{ titulo: decodificarEntidades(n.titulo), link, fonte: "IBGE", data, destaque: true }];
  });
}

// Devolve mais do que o quadro mostra (15): assim as palavras de destaque do usuário, que são
// aplicadas no navegador, ainda encontram notícias que ficariam fora da lista padrão.
const MAX_NOTICIAS = 40;
const MAX_POR_FONTE = 10;

async function buscarNoticias(): Promise<Noticia[]> {
  const listas = await Promise.all([
    ...FEEDS_RSS.map((f) => buscarRss(f.fonte, f.url).catch(() => [] as Noticia[])),
    buscarNoticiasIbge().catch(() => [] as Noticia[]),
  ]);
  const ordenar = (a: Noticia, b: Noticia) =>
    Number(b.destaque) - Number(a.destaque) || (b.data ?? "").localeCompare(a.data ?? "");
  // Até MAX_POR_FONTE de cada veículo (as mais relevantes/recentes), para a lista não ficar
  // dominada por uma fonte só; depois junta tudo, sem títulos repetidos, na mesma ordem.
  const vistos = new Set<string>();
  return listas
    .flatMap((lista, i) => [...lista].sort(ordenar).slice(0, i === listas.length - 1 ? 1 : MAX_POR_FONTE))
    .sort(ordenar)
    .filter((n) => {
      const chave = n.titulo.toLowerCase();
      if (vistos.has(chave)) return false;
      vistos.add(chave);
      return true;
    })
    .slice(0, MAX_NOTICIAS);
}

function valorOuNulo<T>(r: PromiseSettledResult<T>): T | null {
  if (r.status === "fulfilled") return r.value;
  console.error("[indicadores]", r.reason);
  return null;
}

async function montarIndicadores(): Promise<IndicadoresEconomicos> {
  const [dolar, selic, ipca, noticias] = await Promise.allSettled([
    buscarDolar(),
    buscarSelic(),
    buscarIpca(),
    buscarNoticias(),
  ]);
  const corpo: IndicadoresEconomicos = {
    atualizadoEm: new Date().toISOString(),
    dolar: valorOuNulo(dolar),
    selic: valorOuNulo(selic),
    ipca: valorOuNulo(ipca),
    noticias: valorOuNulo(noticias) ?? [],
  };
  return corpo;
}

let emCache: { dados: IndicadoresEconomicos; expira: number } | null = null;

// Hora em Brasília (UTC−3, sem horário de verão) para saber se a PTAX do dia já deveria ter
// saído: o BC publica a cotação de fechamento por volta das 13h dos dias úteis.
function agoraBrasilia(): Date {
  return new Date(Date.now() - 3 * 60 * 60 * 1000);
}

function ptaxDoDiaPendente(dolar: IndicadorDolar | null): boolean {
  const agora = agoraBrasilia();
  const diaSemana = agora.getUTCDay();
  if (diaSemana === 0 || diaSemana === 6 || agora.getUTCHours() < 13) return false;
  const hoje = agora.toISOString().slice(0, 10);
  return !dolar || dolar.data < hoje;
}

async function obterIndicadores(): Promise<IndicadoresEconomicos> {
  // Em dia útil depois das 13h, se a cotação guardada ainda não é a de hoje, busca de novo
  // (no máximo a cada 5 minutos) para a PTAX nova aparecer assim que o BC publicar.
  const pendente = emCache && ptaxDoDiaPendente(emCache.dados.dolar) && emCache.expira - CACHE_MS + CACHE_FALHA_MS < Date.now();
  if (!emCache || emCache.expira < Date.now() || pendente) {
    const dados = await montarIndicadores();
    // Se alguma fonte falhou, tenta de novo mais cedo.
    const completo = dados.dolar && dados.selic && dados.ipca && !ptaxDoDiaPendente(dados.dolar);
    emCache = { dados, expira: Date.now() + (completo ? CACHE_MS : CACHE_FALHA_MS) };
  }
  return emCache.dados;
}

// Botão de atualizar de cada quadro da Início: ?atualizar=dolar|selic|ipca|noticias busca de
// novo só aquela parte, ignorando o cache, e grava o resultado no cache. Para cliques repetidos
// não sobrecarregarem as fontes, cada parte só é rebuscada de fato a cada 30 segundos.
const PARTES = {
  dolar: buscarDolar,
  selic: buscarSelic,
  ipca: buscarIpca,
  noticias: buscarNoticias,
} as const;
type Parte = keyof typeof PARTES;
const INTERVALO_MIN_ATUALIZAR_MS = 30 * 1000;
const ultimaAtualizacaoForcada = new Map<Parte, number>();

async function atualizarParte(parte: Parte): Promise<IndicadoresEconomicos> {
  const dados = await obterIndicadores();
  const ultima = ultimaAtualizacaoForcada.get(parte) ?? 0;
  if (Date.now() - ultima < INTERVALO_MIN_ATUALIZAR_MS) return dados;
  ultimaAtualizacaoForcada.set(parte, Date.now());
  try {
    const novo = await PARTES[parte]();
    // Só substitui se veio algo (uma falha momentânea não apaga o que já estava na tela).
    if (novo && (!Array.isArray(novo) || novo.length > 0)) {
      const atualizado = { ...dados, [parte]: novo, atualizadoEm: new Date().toISOString() };
      if (emCache) emCache.dados = atualizado;
      return atualizado;
    }
  } catch (e) {
    console.error("[indicadores]", e);
  }
  return dados;
}

export async function GET(request: Request) {
  const parte = new URL(request.url).searchParams.get("atualizar");
  if (parte && parte in PARTES) {
    return Response.json(await atualizarParte(parte as Parte), { headers: { "Cache-Control": "no-store" } });
  }
  return Response.json(await obterIndicadores(), {
    // Sem cache no CDN/navegador: o cache em memória acima já poupa as fontes, e assim cada
    // entrada no sistema recebe a cotação mais recente que o servidor tiver.
    headers: { "Cache-Control": "no-store" },
  });
}
