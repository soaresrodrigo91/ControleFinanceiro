export function dividirValor(valorTotal: number, parcelaTotal: number): number[] {
  const centavos = Math.round(valorTotal * 100);
  const porParcela = Math.floor(centavos / parcelaTotal);
  const valores = new Array(parcelaTotal).fill(porParcela);
  const resto = centavos - porParcela * parcelaTotal;
  valores[valores.length - 1] += resto;
  return valores.map((c) => c / 100);
}
