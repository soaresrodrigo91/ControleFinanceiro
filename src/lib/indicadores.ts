// Tipos compartilhados entre a rota /api/indicadores (servidor) e o cartão de indicadores
// econômicos da tela Início (cliente). Fontes: Banco Central (SGS), IBGE (SIDRA e Agência
// de Notícias) e Agência Brasil.

export type PontoSerie = { data: string; valor: number }; // data em ISO (YYYY-MM-DD)

export type IndicadorDolar = {
  valor: number;
  data: string;
  anterior: number;
  dataAnterior: string;
  valor30d: number;
  data30d: string;
  serie: PontoSerie[];
};

export type IndicadorSelic = {
  valor: number;
  desde: string; // data da última mudança da meta
  anterior: number | null; // meta antes da última mudança
  mudancas: PontoSerie[]; // histórico recente de mudanças (mais antiga primeiro)
};

export type GrupoIpca = { nome: string; variacao: number };

export type IndicadorIpca = {
  mes: string; // YYYY-MM do último IPCA divulgado
  mensal: number;
  mensalAnterior: number | null;
  acumulado12m: number | null;
  acumulado12mAnterior: number | null;
  serie: PontoSerie[]; // variação mensal dos últimos 12 meses
  grupos: GrupoIpca[];
};

// destaque: trata de dólar, juros ou inflação (aparece primeiro na lista).
export type Noticia = { titulo: string; link: string; fonte: string; data: string | null; destaque: boolean };

export type IndicadoresEconomicos = {
  atualizadoEm: string;
  dolar: IndicadorDolar | null;
  selic: IndicadorSelic | null;
  ipca: IndicadorIpca | null;
  noticias: Noticia[];
};
