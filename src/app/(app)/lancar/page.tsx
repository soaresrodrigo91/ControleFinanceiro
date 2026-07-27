"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { assinarConfigListas, CONFIG_PADRAO } from "@/lib/config";
import { assinarTodasParcelas, criarLancamento } from "@/lib/parcelas";
import { criarRecorrencia } from "@/lib/recorrencias";
import BuscaParcelas from "@/components/BuscaParcelas";
import RenegociacaoParcelas from "@/components/RenegociacaoParcelas";
import LancamentosCompartilhados from "@/components/LancamentosCompartilhados";
import FormularioLancamento from "@/components/FormularioLancamento";
import { IconBuscar } from "@/components/action-icons";
import { Tab, Tabs } from "@/components/Tabs";
import { useAlturaSticky } from "@/lib/useAlturaSticky";
import type { ConfigListas, NovoLancamento, Parcela } from "@/lib/types";

type Aba = "novo" | "buscar" | "compartilhados" | "renegociacao";

export default function LancarPage() {
  return (
    <Suspense fallback={null}>
      <LancarConteudo />
    </Suspense>
  );
}

function LancarConteudo() {
  const { usuario } = useAuth();
  const searchParams = useSearchParams();
  const { ref: tabsRef, altura: tabsAltura } = useAlturaSticky<HTMLDivElement>();
  const abaUrl = searchParams.get("aba");
  const [aba, setAba] = useState<Aba>(
    abaUrl === "buscar" ? "buscar" : abaUrl === "compartilhados" ? "compartilhados" : "novo"
  );
  const grupoInicial = searchParams.get("grupo") ?? undefined;
  const modoCompartilhadosInicial = searchParams.get("modo") === "enviados" ? "enviados" : "recebidos";
  const [config, setConfig] = useState<ConfigListas>(CONFIG_PADRAO);
  const [parcelasExistentes, setParcelasExistentes] = useState<Parcela[]>([]);

  useEffect(() => {
    if (!usuario) return;
    return assinarConfigListas(usuario.uid, setConfig);
  }, [usuario]);

  useEffect(() => {
    if (!usuario) return;
    return assinarTodasParcelas(usuario.uid, setParcelasExistentes);
  }, [usuario]);

  async function handleSalvarNovoLancamento({
    contaFixa,
    dados,
  }: {
    contaFixa: boolean;
    dados: NovoLancamento;
  }) {
    if (!usuario) return;
    if (contaFixa) {
      await criarRecorrencia(usuario.uid, {
        tipo: "pagar",
        credor: dados.credor,
        observacao: dados.observacao,
        valor: dados.valorTotal,
        comp: dados.comp,
        grupo: dados.grupo,
        aplicacao: dados.aplicacao,
        inicio: dados.inicioCobranca,
        provisao: dados.provisao,
      });
    } else {
      await criarLancamento(usuario.uid, dados);
    }
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 md:px-8">
      <div ref={tabsRef} className="sticky top-0 z-20 bg-background print:static">
        <Tabs>
          <Tab ativo={aba === "novo"} onClick={() => setAba("novo")}>
            Novo lançamento
          </Tab>
          <Tab ativo={aba === "buscar"} onClick={() => setAba("buscar")} icone={<IconBuscar className="h-4 w-4" />}>
            Lançamentos
          </Tab>
          {config.compartilharLancamentos && (
            <Tab ativo={aba === "compartilhados"} onClick={() => setAba("compartilhados")}>
              Lançamentos Compartilhados
            </Tab>
          )}
          <Tab ativo={aba === "renegociacao"} onClick={() => setAba("renegociacao")}>
            Renegociação
          </Tab>
        </Tabs>
      </div>

      {aba === "buscar" ? (
        usuario && (
          <BuscaParcelas uid={usuario.uid} stickyTop={tabsAltura} grupoInicial={grupoInicial} />
        )
      ) : aba === "compartilhados" && config.compartilharLancamentos ? (
        usuario && (
          <LancamentosCompartilhados
            uid={usuario.uid}
            email={usuario.email ?? ""}
            config={config}
            stickyTop={tabsAltura}
            modoInicial={modoCompartilhadosInicial}
          />
        )
      ) : aba === "renegociacao" ? (
        usuario && (
          <RenegociacaoParcelas
            uid={usuario.uid}
            config={config}
            parcelasExistentes={parcelasExistentes}
            stickyTop={tabsAltura}
          />
        )
      ) : (
        <FormularioLancamento
          config={config}
          parcelasExistentes={parcelasExistentes}
          observacaoObrigatoria
          textoBotaoSalvar="Salvar"
          onSalvar={handleSalvarNovoLancamento}
        />
      )}
    </div>
  );
}
