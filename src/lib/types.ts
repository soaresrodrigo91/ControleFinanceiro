export type StatusGrupo = "pago" | "parcial" | "pendente";

export type ModoComp = "nenhum" | "total" | "metade";

export type ItemComp = {
  nome: string;
  modo: ModoComp;
  ativo: boolean;
};

export type ResumosRelatorio = {
  formaPagamento: boolean;
  aplicacao: boolean;
  compartilhamento: boolean;
};

export type LayoutMenu = "horizontal" | "vertical";

export type ConfigListas = {
  aplicacoes: string[];
  grupos: string[];
  comp: ItemComp[];
  modoTotalizador: "todos" | "visiveis";
  resumosRelatorio: ResumosRelatorio;
  sugestaoCredor: boolean;
  itensPorPagina: number;
  observacoesListas?: { grupos?: Record<string, string>; aplicacoes?: Record<string, string> };
  layoutMenu?: LayoutMenu;
  compartilharLancamentos: boolean;
};

export type Parcela = {
  id: string;
  lancamentoId: string;
  credor: string;
  dataCompra: string | null;
  observacao: string | null;
  valorTotal: number;
  parcelaNum: number;
  parcelaTotal: number;
  valorParcela: number;
  comp: string | null;
  grupo: string;
  aplicacao: string;
  vencimento: string;
  pago: boolean;
  pagoEm: string | null;
  recorrenciaId?: string | null;
  virtual?: boolean;
  provisao?: boolean;
  renegociacaoId?: string | null;
  renegociacaoNumero?: number | null;
};

export type NovoLancamento = {
  credor: string;
  dataCompra: string;
  inicioCobranca: string;
  observacao: string;
  valorTotal: number;
  parcelaTotal: number;
  comp: string;
  grupo: string;
  aplicacao: string;
  provisao?: boolean;
};

export type HistoricoValor = { valor: number; desde: string };

export type Recorrencia = {
  id: string;
  tipo: "pagar" | "receber";
  credor: string;
  observacao: string | null;
  valorAtual: number;
  comp?: string | null;
  grupo?: string;
  aplicacao?: string;
  diaVencimento: number;
  inicio: string;
  fim: string | null;
  historicoValores: HistoricoValor[];
  mesesExcluidos?: string[];
  provisao?: boolean;
};

export type Recebimento = {
  id: string;
  lancamentoId?: string;
  origem: string;
  valor: number;
  recebimento: string;
  qtdParcelas: number | null;
  parcela: string;
  observacao: string | null;
  recebido: boolean;
  recorrenciaId?: string | null;
  virtual?: boolean;
  origemComp?: boolean;
  formaPagamentoOrigem?: string | null;
  provisao?: boolean;
  renegociacaoId?: string | null;
  renegociacaoNumero?: number | null;
};

export type NovoRecebimento = {
  origem: string;
  valor: number;
  recebimento: string;
  parcelaTotal: number;
  observacao: string;
};

export type EscopoRenegociacao = "mes" | "futuros";

export type Renegociacao = {
  id: string;
  numero: number;
  grupo: string;
  escopo: EscopoRenegociacao;
  ym: string;
  lancamentoId: string;
  criadoEm: unknown;
  substituiRenegociacaoId?: string | null;
  recorrenciasAjustadas: { recorrenciaId: string; mesesExcluidosAntes: string[]; fimAntes: string | null }[];
};

export type Perfil = {
  nome: string;
  sobrenome: string;
  telefone: string;
  fotoUrl: string | null;
};

export type VinculoCompartilhamento = {
  compNome: string;
  emailVinculado: string;
  uidVinculado: string;
  nomeVinculado: string;
  criadoEm: unknown;
};

export type TipoNotificacao = "recebido" | "convite" | "atualizacao";

export type Notificacao = {
  id: string;
  deUid: string;
  uidDestino: string;
  tipo: TipoNotificacao;
  mensagem: string;
  deNome: string;
  lida: boolean;
  criadoEm: string;
  ym?: string;
};

export type StatusCompartilhado = "pendente";

export type LancamentoCompartilhado = {
  id: string;
  deUid: string;
  deEmail: string;
  deNome: string;
  paraUid: string;
  paraEmail: string;
  lancamentoOrigemId: string;
  recorrenciaOrigemId?: string | null;
  grupoOrigemId: string;
  parcela: string;
  compNome: string;
  credorSugerido: string;
  observacao: string | null;
  aplicacaoSugerida: string;
  valor: number;
  dataCompra: string | null;
  vencimento: string;
  status: StatusCompartilhado;
  criadoEm: string;
};

export type TipoPlano = "free" | "premium";
export type FormaPagamentoPlano = "pix" | "cartao" | "cupom";
export type Periodicidade = "mensal" | "anual";

export type Plano = {
  tipo: TipoPlano;
  formaPagamento: FormaPagamentoPlano | null;
  periodicidade: Periodicidade | null;
  cupom: string | null;
  ativoDesde: string;
};
