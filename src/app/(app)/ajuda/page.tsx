"use client";

import { useMemo, useState } from "react";
import { ARTIGOS_AJUDA, buscarArtigos } from "@/lib/ajudaConteudo";
import { CLASSE_CARD, CLASSE_INPUT } from "@/lib/estilos";
import AjudaImagemAnotada from "@/components/AjudaImagemAnotada";
import { gerarPdfAjuda } from "@/lib/pdfAjuda";

export default function AjudaPage() {
  const [busca, setBusca] = useState("");
  const [gerando, setGerando] = useState(false);
  const artigos = useMemo(() => buscarArtigos(busca), [busca]);
  const categorias = useMemo(
    () => [...new Set(ARTIGOS_AJUDA.map((a) => a.categoria))],
    []
  );

  async function handleBaixarPdf() {
    setGerando(true);
    try {
      const blob = await gerarPdfAjuda(ARTIGOS_AJUDA);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "manual-controle-financeiro.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Central de Ajuda</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Como cada tela funciona, regras de negócio e mensagens de validação do sistema.
          </p>
        </div>
        <button
          onClick={handleBaixarPdf}
          disabled={gerando}
          className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {gerando ? "Gerando..." : "Baixar manual em PDF"}
        </button>
      </div>

      <div className="mb-4">
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Pesquisar por rotina, regra ou mensagem (ex.: reembolso, parcela, senha...)"
          className={CLASSE_INPUT}
        />
      </div>

      {!busca && (
        <div className="mb-6 flex flex-wrap gap-2">
          {categorias.map((cat) => (
            <a
              key={cat}
              href={`#categoria-${cat}`}
              className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {cat}
            </a>
          ))}
        </div>
      )}

      {artigos.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Nenhum resultado para &quot;{busca}&quot;. Tente outro termo.
        </p>
      ) : (
        <div className="flex flex-col gap-8">
          {artigos.map((artigo, indice) => {
            const primeiraDaCategoria =
              indice === 0 || artigos[indice - 1].categoria !== artigo.categoria;
            return (
              <div key={artigo.id}>
                {primeiraDaCategoria && (
                  <h2
                    id={`categoria-${artigo.categoria}`}
                    className="mb-3 scroll-mt-4 text-xs font-semibold tracking-wide text-indigo-600 uppercase dark:text-indigo-400"
                  >
                    {artigo.categoria}
                  </h2>
                )}
                <article id={artigo.id} className={`${CLASSE_CARD} scroll-mt-4`}>
                  <h3 className="mb-1 text-base font-semibold text-slate-900 dark:text-slate-100">
                    {artigo.titulo}
                  </h3>
                  <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">{artigo.resumo}</p>

                  <div className="mb-4">
                    <AjudaImagemAnotada
                      src={artigo.imagem}
                      alt={artigo.imagemAlt}
                      marcadores={artigo.marcadores}
                    />
                  </div>

                  {artigo.regras.length > 0 && (
                    <div className="mb-4">
                      <h4 className="mb-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        Regras
                      </h4>
                      <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
                        {artigo.regras.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {artigo.validacoes.length > 0 && (
                    <div>
                      <h4 className="mb-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        Mensagens de validação
                      </h4>
                      <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
                        {artigo.validacoes.map((v, i) => (
                          <li key={i}>{v}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </article>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
