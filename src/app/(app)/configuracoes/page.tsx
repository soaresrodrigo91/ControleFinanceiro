"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  adicionarComp,
  adicionarItemLista,
  alternarAtivoComp,
  assinarConfigListas,
  atualizarItensPorPagina,
  atualizarLayoutMenu,
  atualizarModoComp,
  atualizarObservacaoItem,
  atualizarResumoRelatorio,
  atualizarSugestaoCredor,
  CONFIG_PADRAO,
  itemEstaEmUso,
  removerComp,
  removerItemLista,
  type CampoLista,
} from "@/lib/config";
import { CLASSE_BOTAO_PRIMARIO, CLASSE_CARD, CLASSE_INPUT } from "@/lib/estilos";
import { Tab, Tabs } from "@/components/Tabs";
import CompartilharLancamentosCard from "@/components/config/CompartilharLancamentosCard";
import { mensagemErroAuth } from "@/lib/authErrors";
import { IconBalao, IconCadeado, IconOlho, IconOlhoFechado } from "@/components/action-icons";
import Modal from "@/components/Modal";
import { useTheme } from "@/contexts/ThemeContext";
import { usePlano } from "@/contexts/PlanoContext";
import type { ConfigListas, ModoComp } from "@/lib/types";

const SECOES: { campo: CampoLista; titulo: string; ajuda: string }[] = [
  { campo: "grupos", titulo: "Formas de pagamento", ajuda: "Ex.: Fixas, Cartão de Crédito, Provisões" },
  { campo: "aplicacoes", titulo: "Aplicações", ajuda: "Ex.: Alimentação, Moradia, Transporte" },
];

const ROTULOS_MODO: Record<ModoComp, string> = {
  nenhum: "Não gera valor a receber",
  total: "Recebo 100% do valor",
  metade: "Recebo 50% do valor",
};

type Aba = "geral" | "geralII" | "seguranca";

export default function ConfiguracoesPage() {
  const { usuario } = useAuth();
  const { tema, alternarTema } = useTheme();
  const { plano } = usePlano();
  const temaLiberado = plano?.tipo === "premium";
  const [aba, setAba] = useState<Aba>("geral");
  const [config, setConfig] = useState<ConfigListas>(CONFIG_PADRAO);

  useEffect(() => {
    if (!usuario) return;
    return assinarConfigListas(usuario.uid, setConfig);
  }, [usuario]);

  if (!usuario) return null;

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-4 md:px-8">
      <Tabs>
        <Tab ativo={aba === "geral"} onClick={() => setAba("geral")}>
          Geral I
        </Tab>
        <Tab ativo={aba === "geralII"} onClick={() => setAba("geralII")}>
          Geral II
        </Tab>
        <Tab
          ativo={aba === "seguranca"}
          onClick={() => setAba("seguranca")}
          icone={<IconCadeado className="h-4 w-4" />}
        >
          Segurança
        </Tab>
      </Tabs>

      {aba === "seguranca" ? (
        <SegurancaTab email={usuario.email ?? ""} />
      ) : aba === "geralII" ? (
        <div className="grid gap-6 md:grid-cols-2">
          <ListaComp uid={usuario.uid} itens={config.comp} />
          <CompartilharLancamentosCard uid={usuario.uid} config={config} />
        </div>
      ) : (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 md:grid-cols-5">
            <div className={`${CLASSE_CARD} p-3`}>
              <h2 className="mb-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100">Resumos do relatório</h2>
              <div className="flex flex-col gap-1">
                <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={config.resumosRelatorio.formaPagamento}
                    onChange={(e) =>
                      atualizarResumoRelatorio(usuario.uid, "formaPagamento", e.target.checked)
                    }
                    className="h-3.5 w-3.5 accent-indigo-600"
                  />
                  Por forma de pagamento
                </label>
                <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={config.resumosRelatorio.aplicacao}
                    onChange={(e) =>
                      atualizarResumoRelatorio(usuario.uid, "aplicacao", e.target.checked)
                    }
                    className="h-3.5 w-3.5 accent-indigo-600"
                  />
                  Por aplicação
                </label>
                <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={config.resumosRelatorio.compartilhamento}
                    onChange={(e) =>
                      atualizarResumoRelatorio(usuario.uid, "compartilhamento", e.target.checked)
                    }
                    className="h-3.5 w-3.5 accent-indigo-600"
                  />
                  Por reembolso
                </label>
              </div>
            </div>

            <div className={`${CLASSE_CARD} flex flex-col justify-between p-3`}>
              <h2 className="mb-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100">Sugestão de credor</h2>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">Ao digitar</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={config.sugestaoCredor}
                  onClick={() => atualizarSugestaoCredor(usuario.uid, !config.sugestaoCredor)}
                  className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                    config.sugestaoCredor ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-600"
                  }`}
                >
                  <span
                    className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform"
                    style={{ transform: config.sugestaoCredor ? "translateX(16px)" : "translateX(0)" }}
                  />
                </button>
              </div>
            </div>

            <div className={`${CLASSE_CARD} flex flex-col justify-between p-3`}>
              <h2 className="mb-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100">
                Listagem por página
              </h2>
              {config.itensPorPagina > 0 ? (
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={config.itensPorPagina}
                  onChange={(e) => {
                    const valor = Math.min(50, Math.max(1, Number(e.target.value) || 1));
                    atualizarItensPorPagina(usuario.uid, valor);
                  }}
                  className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                />
              ) : (
                <p className="text-xs text-slate-400 dark:text-slate-500">Exibindo todos</p>
              )}
              <label className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={config.itensPorPagina === 0}
                  onChange={(e) => atualizarItensPorPagina(usuario.uid, e.target.checked ? 0 : 15)}
                  className="h-3.5 w-3.5 accent-indigo-600"
                />
                Exibir todos (sem paginação)
              </label>
            </div>

            <div className={`${CLASSE_CARD} flex flex-col justify-between p-3`}>
              <h2 className="mb-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100">Menu</h2>
              <div className="flex overflow-hidden rounded-lg border border-slate-300 dark:border-slate-600">
                <button
                  type="button"
                  onClick={() => atualizarLayoutMenu(usuario.uid, "horizontal")}
                  className={`flex-1 px-2.5 py-1.5 text-xs font-medium ${
                    (config.layoutMenu ?? "horizontal") === "horizontal"
                      ? "bg-indigo-600 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  }`}
                >
                  Horizontal
                </button>
                <button
                  type="button"
                  onClick={() => atualizarLayoutMenu(usuario.uid, "vertical")}
                  className={`flex-1 px-2.5 py-1.5 text-xs font-medium ${
                    config.layoutMenu === "vertical"
                      ? "bg-indigo-600 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  }`}
                >
                  Vertical
                </button>
              </div>
            </div>

            <div className={`${CLASSE_CARD} flex flex-col justify-between p-3`}>
              <h2 className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-slate-900 dark:text-slate-100">
                Tema
                {!temaLiberado && <span className="text-amber-500" title="Recurso Premium">★</span>}
              </h2>
              <div className="flex overflow-hidden rounded-lg border border-slate-300 dark:border-slate-600">
                <button
                  type="button"
                  onClick={() => tema === "dark" && alternarTema()}
                  className={`flex-1 px-2.5 py-1.5 text-xs font-medium ${
                    tema === "light"
                      ? "bg-indigo-600 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  }`}
                >
                  Claro
                </button>
                <button
                  type="button"
                  disabled={!temaLiberado}
                  onClick={() => temaLiberado && tema === "light" && alternarTema()}
                  title={temaLiberado ? undefined : "Disponível no plano Premium"}
                  className={`flex-1 px-2.5 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
                    tema === "dark"
                      ? "bg-indigo-600 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  }`}
                >
                  Escuro
                </button>
              </div>
              {!temaLiberado && (
                <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  Disponível no plano Premium.
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {SECOES.map((secao) => (
              <ListaEditavel
                key={secao.campo}
                uid={usuario.uid}
                campo={secao.campo}
                titulo={secao.titulo}
                ajuda={secao.ajuda}
                itens={config[secao.campo]}
                observacoes={config.observacoesListas?.[secao.campo] ?? {}}
                protegidos={[]}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CampoSenha({
  id,
  label,
  value,
  onChange,
  autoComplete,
  minLength,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (valor: string) => void;
  autoComplete: string;
  minLength?: number;
}) {
  const [visivel, setVisivel] = useState(false);

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visivel ? "text" : "password"}
          required
          minLength={minLength}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${CLASSE_INPUT} pr-10`}
        />
        <button
          type="button"
          onClick={() => setVisivel((v) => !v)}
          aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
        >
          {visivel ? <IconOlhoFechado className="h-4.5 w-4.5" /> : <IconOlho className="h-4.5 w-4.5" />}
        </button>
      </div>
    </div>
  );
}

function SegurancaTab({ email }: { email: string }) {
  const { alterarSenha } = useAuth();
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro("");
    setSucesso(false);

    if (novaSenha.length < 6) {
      setErro("A nova senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (novaSenha !== confirmarSenha) {
      setErro("A confirmação não confere com a nova senha.");
      return;
    }

    setEnviando(true);
    try {
      await alterarSenha(senhaAtual, novaSenha);
      setSucesso(true);
      setSenhaAtual("");
      setNovaSenha("");
      setConfirmarSenha("");
    } catch (err) {
      setErro(mensagemErroAuth(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className={`${CLASSE_CARD} max-w-md`}>
      <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Alterar senha</h2>

      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">E-mail de login</label>
        <input
          type="email"
          value={email}
          disabled
          className={`${CLASSE_INPUT} cursor-not-allowed bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-400`}
        />
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">O e-mail de login não pode ser alterado.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <CampoSenha
          id="senha-atual"
          label="Senha atual"
          value={senhaAtual}
          onChange={setSenhaAtual}
          autoComplete="current-password"
        />
        <CampoSenha
          id="nova-senha"
          label="Nova senha"
          value={novaSenha}
          onChange={setNovaSenha}
          autoComplete="new-password"
          minLength={6}
        />
        <CampoSenha
          id="confirmar-senha"
          label="Confirmar nova senha"
          value={confirmarSenha}
          onChange={setConfirmarSenha}
          autoComplete="new-password"
          minLength={6}
        />

        {erro && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}
        {sucesso && <p className="text-sm text-green-600 dark:text-green-400">Senha alterada com sucesso!</p>}

        <button type="submit" disabled={enviando} className={CLASSE_BOTAO_PRIMARIO}>
          {enviando ? "Salvando..." : "Alterar senha"}
        </button>
      </form>
    </div>
  );
}

function ListaComp({ uid, itens }: { uid: string; itens: ConfigListas["comp"] }) {
  const [novoItem, setNovoItem] = useState("");
  const [erro, setErro] = useState("");
  const [removendo, setRemovendo] = useState<string | null>(null);

  async function handleAdicionar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    const item = novoItem.trim();
    if (!item) return;
    if (itens.some((c) => c.nome === item)) {
      setErro("Este item já existe na lista.");
      return;
    }
    await adicionarComp(uid, item, "nenhum");
    setNovoItem("");
  }

  async function handleRemover(nome: string) {
    setErro("");
    setRemovendo(nome);
    try {
      const emUso = await itemEstaEmUso(uid, "comp", nome);
      if (emUso) {
        setErro(`"${nome}" está em uso em algum lançamento e não pode ser removido.`);
        return;
      }
      await removerComp(uid, nome);
    } finally {
      setRemovendo(null);
    }
  }

  return (
    <div className={`${CLASSE_CARD} flex flex-col`}>
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Reembolsos</h2>
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
        Ao lançar uma conta a pagar com esse reembolso, o app pode criar automaticamente um
        recebimento (valor total ou metade). Desative um item para que ele pare de aparecer ao
        lançar, sem perder o histórico.
      </p>

      <div className="mb-3 flex min-h-[2.25rem] flex-1 flex-col gap-2">
        {itens.length === 0 && <p className="text-sm text-slate-400 dark:text-slate-500">Nenhum item ainda.</p>}
        {itens.map((c) => {
          const ativo = c.ativo !== false;
          return (
            <div
              key={c.nome}
              className={`rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900 ${
                ativo ? "" : "opacity-50"
              }`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={ativo}
                  onChange={(e) => alternarAtivoComp(uid, c.nome, e.target.checked)}
                  title={ativo ? "Ativo" : "Inativo"}
                  className="h-3.5 w-3.5 shrink-0 accent-indigo-600"
                />
                <span className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-300">{c.nome}</span>
                <button
                  onClick={() => handleRemover(c.nome)}
                  disabled={removendo === c.nome}
                  aria-label={`Remover ${c.nome}`}
                  className="shrink-0 rounded-full px-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-50 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                >
                  {removendo === c.nome ? "…" : "×"}
                </button>
              </div>
              <select
                value={c.modo}
                onChange={(e) => atualizarModoComp(uid, c.nome, e.target.value as ModoComp)}
                className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-1.5 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
              >
                {Object.entries(ROTULOS_MODO).map(([modo, rotulo]) => (
                  <option key={modo} value={modo}>
                    {rotulo}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      {erro && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{erro}</p>}

      <form onSubmit={handleAdicionar} className="flex gap-2">
        <input
          type="text"
          value={novoItem}
          onChange={(e) => setNovoItem(e.target.value)}
          placeholder="Nome do reembolso"
          className={`${CLASSE_INPUT} h-10`}
        />
        <button
          type="submit"
          className="h-10 shrink-0 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
        >
          Adicionar
        </button>
      </form>
    </div>
  );
}

function ListaEditavel({
  uid,
  campo,
  titulo,
  ajuda,
  itens,
  observacoes,
  protegidos = [],
}: {
  uid: string;
  campo: CampoLista;
  titulo: string;
  ajuda: string;
  itens: string[];
  observacoes: Record<string, string>;
  protegidos?: string[];
}) {
  const [novoItem, setNovoItem] = useState("");
  const [novaObservacao, setNovaObservacao] = useState("");
  const [erro, setErro] = useState("");
  const [removendo, setRemovendo] = useState<string | null>(null);
  const [editandoObservacaoDe, setEditandoObservacaoDe] = useState<string | null>(null);
  const [textoObservacao, setTextoObservacao] = useState("");
  const [salvandoObservacao, setSalvandoObservacao] = useState(false);

  async function handleAdicionar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    const item = novoItem.trim();
    if (!item) return;
    if (itens.includes(item)) {
      setErro("Este item já existe na lista.");
      return;
    }
    await adicionarItemLista(uid, campo, item);
    if (novaObservacao.trim()) {
      await atualizarObservacaoItem(uid, campo, item, novaObservacao.trim());
    }
    setNovoItem("");
    setNovaObservacao("");
  }

  async function handleRemover(item: string) {
    setErro("");
    if (protegidos.includes(item)) {
      setErro(`"${item}" é uma forma de pagamento fixa do sistema e não pode ser removida.`);
      return;
    }
    setRemovendo(item);
    try {
      const emUso = await itemEstaEmUso(uid, campo, item);
      if (emUso) {
        setErro(`"${item}" está em uso em algum lançamento e não pode ser removido.`);
        return;
      }
      await removerItemLista(uid, campo, item);
    } finally {
      setRemovendo(null);
    }
  }

  function abrirEdicaoObservacao(item: string) {
    setEditandoObservacaoDe(item);
    setTextoObservacao(observacoes[item] ?? "");
  }

  async function handleSalvarObservacao() {
    if (!editandoObservacaoDe) return;
    setSalvandoObservacao(true);
    try {
      await atualizarObservacaoItem(uid, campo, editandoObservacaoDe, textoObservacao.trim());
      setEditandoObservacaoDe(null);
    } finally {
      setSalvandoObservacao(false);
    }
  }

  return (
    <div className={`${CLASSE_CARD} flex flex-col`}>
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{titulo}</h2>
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">{ajuda}</p>

      <div className="mb-3 flex min-h-[2.25rem] flex-1 flex-wrap content-start gap-2">
        {itens.length === 0 && <p className="text-sm text-slate-400 dark:text-slate-500">Nenhum item ainda.</p>}
        {itens.map((item) => {
          const protegido = protegidos.includes(item);
          const observacao = observacoes[item];
          return (
            <span
              key={item}
              title={protegido ? "Forma de pagamento fixa do sistema" : undefined}
              className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 py-1 pl-3 pr-1.5 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              {item}
              <button
                type="button"
                onClick={() => abrirEdicaoObservacao(item)}
                title={observacao || "Adicionar observação"}
                aria-label={`Observação de ${item}`}
                className={`rounded-full p-1 hover:bg-slate-200 dark:hover:bg-slate-700 ${
                  observacao ? "text-indigo-500 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500"
                }`}
              >
                <IconBalao className="h-3.5 w-3.5" />
              </button>
              {protegido ? (
                <span className="px-1.5 text-slate-300 dark:text-slate-600" aria-label="Item fixo, não pode ser removido">
                  🔒
                </span>
              ) : (
                <button
                  onClick={() => handleRemover(item)}
                  disabled={removendo === item}
                  aria-label={`Remover ${item}`}
                  className="rounded-full px-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-50 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                >
                  {removendo === item ? "…" : "×"}
                </button>
              )}
            </span>
          );
        })}
      </div>

      {erro && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{erro}</p>}

      <form onSubmit={handleAdicionar} className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={novoItem}
            onChange={(e) => setNovoItem(e.target.value)}
            placeholder="Novo item"
            className={`${CLASSE_INPUT} h-10`}
          />
          <button
            type="submit"
            className="h-10 shrink-0 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
          >
            Adicionar
          </button>
        </div>
        <input
          type="text"
          value={novaObservacao}
          onChange={(e) => setNovaObservacao(e.target.value)}
          placeholder="Observação (opcional)"
          className={CLASSE_INPUT}
        />
      </form>

      <Modal
        aberto={!!editandoObservacaoDe}
        onFechar={() => setEditandoObservacaoDe(null)}
        titulo={`Observação de "${editandoObservacaoDe ?? ""}"`}
      >
        <div className="flex flex-col gap-3">
          <textarea
            value={textoObservacao}
            onChange={(e) => setTextoObservacao(e.target.value)}
            rows={3}
            placeholder="Observação"
            className={CLASSE_INPUT}
          />
          <button onClick={handleSalvarObservacao} disabled={salvandoObservacao} className={CLASSE_BOTAO_PRIMARIO}>
            {salvandoObservacao ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
