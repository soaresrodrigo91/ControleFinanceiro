export function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function mesAtualYM(): string {
  return hojeISO().slice(0, 7);
}

export function somarMeses(dataISO: string, meses: number): string {
  const [ano, mes, dia] = dataISO.split("-").map(Number);
  const data = new Date(ano, mes - 1 + meses, dia);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

export function formatarDataBR(dataISO: string): string {
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}/${ano}`;
}

export function somarMesesYM(ym: string, meses: number): string {
  const [ano, mes] = ym.split("-").map(Number);
  const data = new Date(ano, mes - 1 + meses, 1);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
}

export function formatarMesAno(ym: string): string {
  const [ano, mes] = ym.split("-").map(Number);
  const nomes = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  return `${nomes[mes - 1]} ${String(ano).slice(2)}`;
}

export function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function diferencaEmMeses(ymInicio: string, ymFim: string): number {
  const [anoInicio, mesInicio] = ymInicio.split("-").map(Number);
  const [anoFim, mesFim] = ymFim.split("-").map(Number);
  return (anoFim - anoInicio) * 12 + (mesFim - mesInicio);
}

const REGEX_DATA_BR = /^(\d{2})\/(\d{2})\/(\d{4})$/;

export function dataBrParaIso(valor: string): string | null {
  const m = REGEX_DATA_BR.exec(valor);
  if (!m) return null;
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  const ano = Number(m[3]);
  const data = new Date(ano, mes - 1, dia);
  const valida =
    data.getFullYear() === ano && data.getMonth() === mes - 1 && data.getDate() === dia;
  if (!valida) return null;
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

export function formatarMesCurto(ym: string): string {
  const [ano, mes] = ym.split("-").map(Number);
  const nomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${nomes[mes - 1]}/${String(ano).slice(2)}`;
}

export function formatarMesAnoAbreviado(ym: string): string {
  const [ano, mes] = ym.split("-").map(Number);
  const nomes = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
  return `${nomes[mes - 1]}/${String(ano).slice(2)}`;
}
