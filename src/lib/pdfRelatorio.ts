import jsPDF from "jspdf";
import { formatarMoeda } from "./date";

export type ResumoPdf = {
  titulo: string;
  linhas: [string, number][];
  subvalor?: (chave: string, valor: number) => number | null;
};

export type LancamentoPdf = {
  credor: string;
  observacao: string;
  parcela: string;
  data: string;
  reembolso: string;
  valor: number;
};

const MARGEM_X = 15;
const LARGURA_UTIL = 180;

export function gerarPdfRelatorio(
  titulo: string,
  resumos: ResumoPdf[],
  lancamentos: LancamentoPdf[],
  total: number
): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = 18;

  function novaPaginaSeNecessario(limite: number) {
    if (y > limite) {
      doc.addPage();
      y = 18;
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(titulo, MARGEM_X, y);
  y += 10;

  doc.setFontSize(10);
  for (const resumo of resumos) {
    if (resumo.linhas.length === 0) continue;
    novaPaginaSeNecessario(260);
    doc.setFont("helvetica", "bold");
    doc.text(resumo.titulo, MARGEM_X, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    for (const [chave, valor] of resumo.linhas) {
      novaPaginaSeNecessario(280);
      doc.text(chave, MARGEM_X + 2, y);
      doc.text(formatarMoeda(valor), MARGEM_X + LARGURA_UTIL, y, { align: "right" });
      y += 5;
      const sub = resumo.subvalor?.(chave, valor);
      if (sub != null) {
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(`Você recebe: ${formatarMoeda(sub)}`, MARGEM_X + LARGURA_UTIL, y, { align: "right" });
        doc.setFontSize(10);
        doc.setTextColor(0);
        y += 4;
      }
    }
    y += 3;
  }

  if (lancamentos.length > 0) {
    novaPaginaSeNecessario(250);
    doc.setFont("helvetica", "bold");
    doc.text(`Todos os lançamentos — ${formatarMoeda(total)}`, MARGEM_X, y);
    y += 6;

    const colX = {
      credor: MARGEM_X,
      obs: MARGEM_X + 45,
      parcela: MARGEM_X + 82,
      data: MARGEM_X + 102,
      reembolso: MARGEM_X + 128,
      valor: MARGEM_X + LARGURA_UTIL,
    };
    doc.setFontSize(9);
    doc.text("Credor", colX.credor, y);
    doc.text("Observação", colX.obs, y);
    doc.text("Parcela", colX.parcela, y);
    doc.text("Data", colX.data, y);
    doc.text("Reembolso", colX.reembolso, y);
    doc.text("Valor", colX.valor, y, { align: "right" });
    y += 2;
    doc.setLineWidth(0.2);
    doc.line(MARGEM_X, y, MARGEM_X + LARGURA_UTIL, y);
    y += 4;

    doc.setFont("helvetica", "normal");
    for (const l of lancamentos) {
      novaPaginaSeNecessario(285);
      doc.text(l.credor.slice(0, 24), colX.credor, y);
      doc.text((l.observacao || "—").slice(0, 20), colX.obs, y);
      doc.text(l.parcela, colX.parcela, y);
      doc.text(l.data, colX.data, y);
      doc.text((l.reembolso || "—").slice(0, 18), colX.reembolso, y);
      doc.text(formatarMoeda(l.valor), colX.valor, y, { align: "right" });
      y += 5.5;
    }
  }

  return doc.output("blob");
}

export async function compartilharPdf(blob: Blob, nomeArquivo: string, titulo: string) {
  const arquivo = new File([blob], nomeArquivo, { type: "application/pdf" });
  const dadosCompartilhamento = { files: [arquivo], title: titulo };

  if (navigator.canShare?.(dadosCompartilhamento)) {
    await navigator.share(dadosCompartilhamento);
    return;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
