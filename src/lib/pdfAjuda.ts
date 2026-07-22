import jsPDF from "jspdf";
import type { ArtigoAjuda } from "./ajudaConteudo";

const MARGEM_X = 15;
const LARGURA_UTIL = 180;
const IMG_LARGURA = 180;
const IMG_ALTURA = 112.5; // proporção 1280x800

async function carregarImagemComoDataUrl(src: string): Promise<string> {
  const resposta = await fetch(src);
  const blob = await resposta.blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D não disponível.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.72);
}

export async function gerarPdfAjuda(artigos: ArtigoAjuda[]): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = 20;

  function novaPagina() {
    doc.addPage();
    y = 20;
  }

  function garantirEspaco(altura: number, limite = 280) {
    if (y + altura > limite) novaPagina();
  }

  function paragrafo(texto: string, tamanho = 10, negrito = false) {
    doc.setFont("helvetica", negrito ? "bold" : "normal");
    doc.setFontSize(tamanho);
    const linhas = doc.splitTextToSize(texto, LARGURA_UTIL) as string[];
    for (const linha of linhas) {
      garantirEspaco(6);
      doc.text(linha, MARGEM_X, y);
      y += 5.5;
    }
  }

  // Capa
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("Manual do Controle Financeiro", MARGEM_X, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Guia completo de telas, regras de negócio e mensagens de validação.", MARGEM_X, 50);

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Sumário", MARGEM_X, 68);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  let ySumario = 76;
  let categoriaAnterior = "";
  for (const artigo of artigos) {
    if (artigo.categoria !== categoriaAnterior) {
      categoriaAnterior = artigo.categoria;
      doc.setFont("helvetica", "bold");
      doc.text(artigo.categoria, MARGEM_X, ySumario);
      doc.setFont("helvetica", "normal");
      ySumario += 5.5;
    }
    doc.text(`•  ${artigo.titulo}`, MARGEM_X + 4, ySumario);
    ySumario += 5.5;
  }

  for (const artigo of artigos) {
    novaPagina();

    paragrafo(artigo.categoria.toUpperCase(), 9, true);
    doc.setTextColor(79, 70, 229);
    paragrafo(artigo.titulo, 15, true);
    doc.setTextColor(0, 0, 0);
    paragrafo(artigo.resumo, 10);
    y += 2;

    // Imagem com marcadores numerados
    try {
      const dataUrl = await carregarImagemComoDataUrl(artigo.imagem);
      garantirEspaco(IMG_ALTURA + 4, 260);
      const imgX = MARGEM_X;
      const imgY = y;
      doc.addImage(dataUrl, "JPEG", imgX, imgY, IMG_LARGURA, IMG_ALTURA);
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.4);
      for (const m of artigo.marcadores) {
        const px = imgX + (m.xPct / 100) * IMG_LARGURA;
        const py = imgY + (m.yPct / 100) * IMG_ALTURA;
        doc.setFillColor(79, 70, 229);
        doc.circle(px, py, 2.6, "FD");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.text(String(m.numero), px, py + 0.9, { align: "center" });
      }
      doc.setTextColor(0, 0, 0);
      y = imgY + IMG_ALTURA + 6;
    } catch {
      // Se a imagem não puder ser carregada, segue sem ela.
    }

    // Legenda dos marcadores
    if (artigo.marcadores.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      garantirEspaco(6);
      doc.text("O que aparece na tela", MARGEM_X, y);
      y += 5.5;
      for (const m of artigo.marcadores) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        garantirEspaco(6);
        doc.setFillColor(79, 70, 229);
        doc.circle(MARGEM_X + 2, y - 1.2, 2.2, "F");
        doc.setTextColor(255, 255, 255);
        doc.text(String(m.numero), MARGEM_X + 2, y - 0.4, { align: "center" });
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "normal");
        const linhas = doc.splitTextToSize(m.texto, LARGURA_UTIL - 8) as string[];
        doc.text(linhas, MARGEM_X + 7, y);
        y += 5 * linhas.length + 1;
      }
      y += 2;
    }

    // Regras
    if (artigo.regras.length > 0) {
      garantirEspaco(8);
      paragrafo("Regras", 11, true);
      for (const regra of artigo.regras) {
        paragrafo(`•  ${regra}`, 9.5);
      }
      y += 2;
    }

    // Validações
    if (artigo.validacoes.length > 0) {
      garantirEspaco(8);
      paragrafo("Mensagens de validação", 11, true);
      for (const validacao of artigo.validacoes) {
        paragrafo(`•  ${validacao}`, 9.5);
      }
    }
  }

  return doc.output("blob");
}
