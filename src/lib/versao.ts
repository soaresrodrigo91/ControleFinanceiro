// Versão do sistema: dia.mês.ano.hora.minuto.segundo do último ajuste, seguido de um
// código sequencial (contador.subcontador). O subcontador vai de 01 até 100; ao chegar
// em 100, o contador principal avança e o subcontador volta a 01 (ex.: 01.100 -> 02.01).
//
// Atualize a constante abaixo (data/hora + código) a cada alteração ou correção feita no
// sistema.
export const VERSAO_SISTEMA = "28.07.2026.22.20.00 - 02.05";

// Formato de exibição no rodapé do site: "v{código} - {data} - {hora}" (ex.: "v02.03 -
// 28.07.2026 - 22:04"). O app mobile (PWA) mostra só o código de 4 dígitos (ver
// public/mobile/index.html, .menu-versao) e precisa ser atualizado manualmente lá.
const [dataHoraVersao, codigoVersao] = VERSAO_SISTEMA.split(" - ");
const [diaVersao, mesVersao, anoVersao, horaVersao, minutoVersao] = dataHoraVersao.split(".");
export const VERSAO_EXIBICAO = `v${codigoVersao} - ${diaVersao}.${mesVersao}.${anoVersao} - ${horaVersao}:${minutoVersao}`;
