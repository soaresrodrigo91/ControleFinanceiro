// Destaque de notícias por palavras-chave do usuário (Configurações > Geral I > "Destaques nas
// notícias"). Uma notícia combina com a palavra quando o título tem a palavra igual ou parecida:
// - sem diferenciar maiúsculas/minúsculas nem acentos;
// - aceitando plural e variações (compara pelo radical: "combustível" pega "combustíveis");
// - incluindo assuntos relacionados de GRUPOS_RELACIONADOS ("combustível" pega gasolina,
//   diesel, petróleo, Petrobras...).

export function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// Radical aproximado: tira o final da palavra para casar plural/variações. Palavras curtas
// (até 4 letras, ex.: "IR", "gás", "real") só casam inteiras, para não pegar qualquer palavra.
function radical(palavra: string): string {
  if (palavra.length <= 4) return palavra;
  return palavra.slice(0, Math.max(4, Math.ceil(palavra.length * 0.75)));
}

// Assuntos relacionados: se a palavra do usuário bate com qualquer termo de um grupo, todos os
// termos do grupo também destacam a notícia.
const GRUPOS_RELACIONADOS: string[][] = [
  ["combustivel", "gasolina", "diesel", "etanol", "alcool", "petroleo", "petrobras", "gas", "glp", "posto", "opep", "barril"],
  ["energia", "luz", "eletrica", "eletricidade", "aneel", "bandeira tarifaria", "hidreletrica"],
  ["imposto", "tributo", "tributaria", "tributacao", "aliquota", "ir", "imposto de renda", "cbs", "ibs", "icms", "iof", "ipi", "receita federal", "fisco"],
  ["dolar", "cambio", "moeda", "real", "euro"],
  ["juros", "selic", "copom", "taxa basica", "banco central"],
  ["inflacao", "ipca", "inpc", "igp-m", "carestia", "precos"],
  ["aluguel", "imovel", "imobiliario", "igp-m", "moradia", "habitacao"],
  ["salario", "salario minimo", "renda", "remuneracao", "reajuste salarial"],
  ["aposentadoria", "inss", "previdencia", "beneficio"],
  ["alimento", "alimentos", "comida", "supermercado", "cesta basica", "feira"],
  ["credito", "emprestimo", "financiamento", "cartao", "divida", "endividamento", "inadimplencia"],
  ["investimento", "poupanca", "cdb", "tesouro", "bolsa", "ibovespa", "acoes", "fundos"],
  ["carro", "veiculo", "automovel", "montadora", "ipva"],
];

function termosRelacionados(palavra: string): string[] {
  const p = normalizarTexto(palavra);
  const raizP = radical(p);
  const termos = new Set([p]);
  for (const grupo of GRUPOS_RELACIONADOS) {
    const pertence = grupo.some((t) => {
      const raizT = radical(t);
      return t === p || (p.length > 4 && t.length > 4 && (t.startsWith(raizP) || p.startsWith(raizT)));
    });
    if (pertence) grupo.forEach((t) => termos.add(t));
  }
  return [...termos];
}

function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Monta uma vez, para cada palavra do usuário, a expressão que procura qualquer termo
// relacionado no início de uma palavra do título (já normalizado).
export function montarDestaques(palavras: string[]): { palavra: string; regex: RegExp }[] {
  return palavras
    .filter((p) => normalizarTexto(p))
    .map((palavra) => {
      const partes = termosRelacionados(palavra).map((t) => {
        const r = escaparRegex(radical(t));
        return t.length <= 4 ? `${r}\\b` : r;
      });
      return { palavra, regex: new RegExp(`(?:^|[^a-z0-9])(?:${partes.join("|")})`) };
    });
}

// Devolve a palavra do usuário que destacou o título, ou null.
export function palavraQueDestaca(
  titulo: string,
  destaques: { palavra: string; regex: RegExp }[]
): string | null {
  const t = normalizarTexto(titulo);
  return destaques.find((d) => d.regex.test(t))?.palavra ?? null;
}
