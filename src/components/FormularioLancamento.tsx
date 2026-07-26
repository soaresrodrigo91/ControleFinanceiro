"use client";

import { useMemo, useState, type FormEvent } from "react";
import { hojeISO, somarMeses } from "@/lib/date";
import { CLASSE_BOTAO_PRIMARIO, CLASSE_CARD, CLASSE_INPUT } from "@/lib/estilos";
import CampoCredor from "@/components/CampoCredor";
import CampoValorMonetario, { paraNumero } from "@/components/CampoValorMonetario";
import Modal from "@/components/Modal";
import type { ConfigListas, NovoLancamento, Parcela } from "@/lib/types";

export default function FormularioLancamento({
  config,
  parcelasExistentes,
  grupoFixo,
  desabilitarContaFixaEProvisao,
  ocultarDataCompra,
  pularVerificacaoDuplicata,
  textoBotaoSalvar = "Salvar lançamento",
  onSalvar,
  onCancelar,
}: {
  config: ConfigListas;
  parcelasExistentes: Parcela[];
  grupoFixo?: string;
  desabilitarContaFixaEProvisao?: boolean;
  ocultarDataCompra?: boolean;
  pularVerificacaoDuplicata?: boolean;
  textoBotaoSalvar?: string;
  onSalvar: (input: { contaFixa: boolean; dados: NovoLancamento }) => Promise<void>;
  onCancelar?: () => void;
}) {
  const [credor, setCredor] = useState("");
  const [dataCompra, setDataCompra] = useState(hojeISO());
  const [inicioCobranca, setInicioCobranca] = useState(somarMeses(hojeISO(), 1));
  const [inicioEditadoManualmente, setInicioEditadoManualmente] = useState(false);
  const [observacao, setObservacao] = useState("");
  const [valorTotal, setValorTotal] = useState("");
  const [valorPorParcela, setValorPorParcela] = useState(false);
  const [parcelaTotal, setParcelaTotal] = useState("1");
  const [comp, setComp] = useState("");
  const [grupo, setGrupo] = useState(grupoFixo ?? "");
  const [aplicacao, setAplicacao] = useState("");
  const [contaFixa, setContaFixa] = useState(false);
  const [provisao, setProvisao] = useState(false);

  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [duplicataDetectada, setDuplicataDetectada] = useState(false);
  const [confirmarCancelar, setConfirmarCancelar] = useState(false);

  const credoresConhecidos = useMemo(() => {
    return [...new Set(parcelasExistentes.map((p) => p.credor))].sort((a, b) =>
      a.localeCompare(b, "pt-BR")
    );
  }, [parcelasExistentes]);

  function handleDataCompraChange(novaData: string) {
    setDataCompra(novaData);
    if (!inicioEditadoManualmente) {
      setInicioCobranca(somarMeses(novaData, 1));
    }
  }

  const gruposDisponiveis = config.grupos;
  const compDisponiveis = config.comp.filter((c) => c.ativo !== false);
  const dataCompraEfetiva = ocultarDataCompra ? inicioCobranca : dataCompra;

  function calcularValorTotal(): number {
    const digitado = paraNumero(valorTotal);
    if (!valorPorParcela) return digitado;
    const parcelas = contaFixa ? 1 : Number(parcelaTotal) || 1;
    return digitado * parcelas;
  }

  function encontrarDuplicata(valor: number): boolean {
    const credorNormalizado = credor.trim().toLowerCase();
    return parcelasExistentes.some(
      (p) =>
        p.credor.trim().toLowerCase() === credorNormalizado &&
        p.dataCompra === dataCompraEfetiva &&
        p.valorTotal === valor
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro("");
    setSucesso(false);

    const valor = calcularValorTotal();
    const parcelas = Number(parcelaTotal);

    if (!credor || !dataCompraEfetiva || !inicioCobranca || !grupo || !aplicacao) {
      setErro("Preencha todos os campos obrigatórios.");
      return;
    }
    if (!valor || valor <= 0) {
      setErro("Informe um valor total válido.");
      return;
    }
    if (!contaFixa && (!parcelas || parcelas < 1)) {
      setErro("O número de parcelas deve ser pelo menos 1.");
      return;
    }

    if (!pularVerificacaoDuplicata && !contaFixa && encontrarDuplicata(valor)) {
      setDuplicataDetectada(true);
      return;
    }

    await salvarLancamento();
  }

  async function salvarLancamento() {
    const valor = calcularValorTotal();
    const parcelas = Number(parcelaTotal);

    setDuplicataDetectada(false);
    setEnviando(true);
    setErro("");
    try {
      await onSalvar({
        contaFixa,
        dados: {
          credor,
          dataCompra: dataCompraEfetiva,
          inicioCobranca,
          observacao,
          valorTotal: valor,
          parcelaTotal: parcelas,
          comp,
          grupo,
          aplicacao,
          provisao,
        },
      });
      setSucesso(true);
      setCredor("");
      setObservacao("");
      setValorTotal("");
      setValorPorParcela(false);
      setParcelaTotal("1");
      setComp("");
      if (!grupoFixo) setGrupo("");
      setAplicacao("");
      setContaFixa(false);
      setProvisao(false);
      setInicioEditadoManualmente(false);
    } catch (err) {
      setErro(
        err instanceof Error && err.message ? err.message : "Não foi possível salvar o lançamento. Tente novamente."
      );
    } finally {
      setEnviando(false);
    }
  }

  if (confirmarCancelar) {
    return (
      <div className={`mx-auto max-w-md ${CLASSE_CARD} flex flex-col gap-3`}>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Deseja realmente cancelar a renegociação? Nada foi salvo ainda — ao confirmar, você volta para a tela
          de Renegociação sem nenhuma alteração.
        </p>
        <button
          onClick={onCancelar}
          className="w-full rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Sim, cancelar
        </button>
        <button
          onClick={() => setConfirmarCancelar(false)}
          className="text-center text-sm text-slate-500 dark:text-slate-400"
        >
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <form onSubmit={handleSubmit} className={`${CLASSE_CARD} flex flex-col gap-4`}>
        <CampoCredor
          id="credor"
          label="Credor *"
          value={credor}
          onChange={setCredor}
          opcoes={credoresConhecidos}
          ativo={config.sugestaoCredor}
          required
        />

        <div className="grid grid-cols-2 gap-3">
          {!ocultarDataCompra && (
            <div>
              <label className="block text-sm font-medium mb-1">Data da compra *</label>
              <input
                type="date"
                required
                value={dataCompra}
                onChange={(e) => handleDataCompraChange(e.target.value)}
                className={CLASSE_INPUT}
              />
            </div>
          )}
          <div className={ocultarDataCompra ? "col-span-2" : undefined}>
            <label className="block text-sm font-medium mb-1">Início da cobrança *</label>
            <input
              type="date"
              required
              value={inicioCobranca}
              onChange={(e) => {
                setInicioCobranca(e.target.value);
                setInicioEditadoManualmente(true);
              }}
              className={CLASSE_INPUT}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <label
            className={`flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 ${
              desabilitarContaFixaEProvisao ? "opacity-50" : ""
            }`}
          >
            <input
              type="checkbox"
              checked={contaFixa}
              disabled={desabilitarContaFixaEProvisao}
              onChange={(e) => setContaFixa(e.target.checked)}
              className="h-4 w-4 accent-indigo-600"
            />
            Conta fixa (recorrente)
          </label>
          <label
            className={`flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 ${
              desabilitarContaFixaEProvisao ? "opacity-50" : ""
            }`}
          >
            <input
              type="checkbox"
              checked={provisao}
              disabled={desabilitarContaFixaEProvisao}
              onChange={(e) => setProvisao(e.target.checked)}
              className="h-4 w-4 accent-amber-500"
            />
            Provisão
          </label>
        </div>
        {contaFixa && (
          <p className="-mt-2 text-xs text-slate-500 dark:text-slate-400">
            O valor será lançado todo mês a partir da data de início da cobrança, até você encerrar a
            recorrência.
          </p>
        )}
        {provisao && (
          <p className="-mt-2 text-xs text-slate-500 dark:text-slate-400">
            Os lançamentos classificados como &quot;Provisão&quot; permitem a exclusão e a edição do valor
            lançado.
          </p>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Observação</label>
          <input
            type="text"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            className={CLASSE_INPUT}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <label className="block text-sm font-medium">
                {valorPorParcela ? "Valor da parcela (R$) *" : "Valor total (R$) *"}
              </label>
              <button
                type="button"
                role="switch"
                aria-checked={valorPorParcela}
                title="Alternar entre valor total e valor da parcela"
                onClick={() => setValorPorParcela((v) => !v)}
                className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${
                  valorPorParcela ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-600"
                }`}
              >
                <span
                  className="absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white transition-transform"
                  style={{ transform: valorPorParcela ? "translateX(12px)" : "translateX(0)" }}
                />
              </button>
            </div>
            <CampoValorMonetario
              required
              value={valorTotal}
              onChange={setValorTotal}
              className={CLASSE_INPUT}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Parcelas *</label>
            <input
              type="number"
              min={1}
              required
              disabled={contaFixa}
              value={contaFixa ? 1 : parcelaTotal}
              onChange={(e) => setParcelaTotal(e.target.value)}
              className={`${CLASSE_INPUT} disabled:cursor-not-allowed disabled:opacity-50`}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Forma de pagamento *</label>
          <select
            required
            disabled={!!grupoFixo}
            value={grupo}
            onChange={(e) => setGrupo(e.target.value)}
            className={`${CLASSE_INPUT} disabled:cursor-not-allowed disabled:opacity-70`}
          >
            <option value="" disabled>
              Selecione...
            </option>
            {gruposDisponiveis.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Aplicação *</label>
          <select
            required
            value={aplicacao}
            onChange={(e) => setAplicacao(e.target.value)}
            className={CLASSE_INPUT}
          >
            <option value="" disabled>
              Selecione...
            </option>
            {config.aplicacoes.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        {compDisponiveis.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-1">Reembolso</label>
            <select value={comp} onChange={(e) => setComp(e.target.value)} className={CLASSE_INPUT}>
              <option value="">Nenhum</option>
              {compDisponiveis.map((c) => (
                <option key={c.nome} value={c.nome}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
        )}

        {erro && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}
        {sucesso && <p className="text-sm text-green-600 dark:text-green-400">Lançamento salvo!</p>}

        <button type="submit" disabled={enviando} className={CLASSE_BOTAO_PRIMARIO}>
          {enviando ? "Salvando..." : textoBotaoSalvar}
        </button>
        {onCancelar && (
          <button
            type="button"
            onClick={() => setConfirmarCancelar(true)}
            disabled={enviando}
            className="text-center text-sm text-slate-500 hover:underline dark:text-slate-400"
          >
            Cancelar
          </button>
        )}
      </form>

      <Modal
        aberto={duplicataDetectada}
        onFechar={() => setDuplicataDetectada(false)}
        titulo="Lançamento possivelmente duplicado"
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Já existe um lançamento para <span className="font-medium">{credor}</span> com a mesma
            data da compra e o mesmo valor. Deseja continuar mesmo assim?
          </p>
          <button
            onClick={() => setDuplicataDetectada(false)}
            className="w-full rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Cancelar
          </button>
          <button onClick={salvarLancamento} disabled={enviando} className={CLASSE_BOTAO_PRIMARIO}>
            {enviando ? "Salvando..." : "Continuar mesmo assim"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
