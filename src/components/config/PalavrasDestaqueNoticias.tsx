"use client";

import { useState, type FormEvent } from "react";
import { atualizarPalavrasDestaqueNoticias } from "@/lib/config";
import { normalizarTexto } from "@/lib/destaqueNoticias";
import { CLASSE_INPUT } from "@/lib/estilos";
import Modal from "@/components/Modal";

// Palavras/assuntos que deixam em laranja as notícias do quadro de Indicadores econômicos da
// Início (a comparação aceita variações e assuntos relacionados — ver lib/destaqueNoticias).
// Fica dentro do card "Painel inicial" (Configurações > Geral I), visível só quando
// a opção "Indicadores econômicos" está marcada. No card aparece só um resumo de altura fixa
// (para não mexer no tamanho dos outros cards, por mais palavras que existam); a lista
// completa é editada numa janela própria.
export default function PalavrasDestaqueNoticias({ uid, palavras }: { uid: string; palavras: string[] }) {
  const [aberto, setAberto] = useState(false);
  const [nova, setNova] = useState("");
  const [erro, setErro] = useState("");

  async function handleAdicionar(e: FormEvent) {
    e.preventDefault();
    const palavra = nova.trim().replace(/\s+/g, " ");
    if (!palavra) return;
    if (palavras.some((p) => normalizarTexto(p) === normalizarTexto(palavra))) {
      setErro("Essa palavra já está na lista.");
      return;
    }
    setErro("");
    setNova("");
    await atualizarPalavrasDestaqueNoticias(uid, [...palavras, palavra]);
  }

  async function handleRemover(palavra: string) {
    await atualizarPalavrasDestaqueNoticias(
      uid,
      palavras.filter((p) => p !== palavra)
    );
  }

  function fechar() {
    setAberto(false);
    setNova("");
    setErro("");
  }

  return (
    <div className="mt-2 border-t border-slate-200 pt-2 dark:border-slate-700">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Destaques nas notícias</h3>
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="shrink-0 rounded-md border border-slate-300 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          Gerenciar
        </button>
      </div>
      <p
        className="mt-1 truncate text-[11px] text-slate-500 dark:text-slate-400"
        title={palavras.length > 0 ? palavras.join(", ") : undefined}
      >
        {palavras.length === 0 ? (
          "Nenhuma palavra cadastrada."
        ) : (
          <>
            <span className="font-medium text-orange-600 dark:text-orange-400">
              {palavras.length} {palavras.length === 1 ? "palavra" : "palavras"}
            </span>
            {": "}
            {palavras.join(", ")}
          </>
        )}
      </p>

      <Modal aberto={aberto} onFechar={fechar} titulo="Destaques nas notícias">
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
          Notícias com estas palavras, ou parecidas, ficam em laranja e no topo da lista dos Indicadores
          econômicos da Início. Ex.: <strong className="font-medium">combustível</strong> também destaca
          combustíveis, gasolina, diesel, etanol, petróleo e Petrobras.
        </p>

        <form onSubmit={handleAdicionar} className="flex gap-2">
          <input
            value={nova}
            onChange={(e) => {
              setNova(e.target.value);
              setErro("");
            }}
            placeholder="Nova palavra ou assunto"
            maxLength={40}
            autoFocus
            className={CLASSE_INPUT}
          />
          <button
            type="submit"
            disabled={!nova.trim()}
            className="shrink-0 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Adicionar
          </button>
        </form>
        {erro && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{erro}</p>}

        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            {palavras.length === 0
              ? "Nenhuma palavra cadastrada ainda."
              : `${palavras.length} ${palavras.length === 1 ? "palavra cadastrada" : "palavras cadastradas"}`}
          </p>
          {palavras.length > 0 && (
            <div className="scroll-sem-barra flex max-h-56 flex-wrap content-start gap-2 overflow-y-auto">
              {palavras.map((p) => (
                <span
                  key={p}
                  className="flex max-w-full items-center gap-1 rounded-full bg-orange-100 py-1 pr-1 pl-3 text-sm font-medium text-orange-700 dark:bg-orange-950 dark:text-orange-300"
                >
                  <span className="truncate">{p}</span>
                  <button
                    type="button"
                    onClick={() => handleRemover(p)}
                    aria-label={`Remover ${p}`}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full leading-none hover:bg-orange-200 dark:hover:bg-orange-900"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={fechar}
          className="mt-5 w-full rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          Concluir
        </button>
      </Modal>
    </div>
  );
}
