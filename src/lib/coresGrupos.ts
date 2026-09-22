import type { CorGrupo } from "./types";

// Cores que podem ser escolhidas para um grupo (Configurações → Grupos). A cor só é usada
// no nome do grupo na lista de Contas a Pagar → Lançamentos; sem cor, o grupo mantém o
// estilo padrão. As classes ficam escritas por extenso para o Tailwind encontrá-las.
export const CORES_GRUPO: { valor: CorGrupo; rotulo: string; classeTexto: string; classeAmostra: string }[] = [
  { valor: "roxo", rotulo: "Roxo", classeTexto: "text-purple-600 dark:text-purple-400", classeAmostra: "bg-purple-500" },
  { valor: "vermelho", rotulo: "Vermelho", classeTexto: "text-red-600 dark:text-red-400", classeAmostra: "bg-red-500" },
  { valor: "amarelo", rotulo: "Amarelo", classeTexto: "text-yellow-600 dark:text-yellow-400", classeAmostra: "bg-yellow-400" },
  { valor: "laranja", rotulo: "Laranja", classeTexto: "text-orange-600 dark:text-orange-400", classeAmostra: "bg-orange-500" },
  { valor: "verde", rotulo: "Verde", classeTexto: "text-green-600 dark:text-green-400", classeAmostra: "bg-green-500" },
  { valor: "azul", rotulo: "Azul", classeTexto: "text-blue-600 dark:text-blue-400", classeAmostra: "bg-blue-500" },
];

export function corDoGrupo(cor: CorGrupo | undefined) {
  return CORES_GRUPO.find((c) => c.valor === cor);
}
