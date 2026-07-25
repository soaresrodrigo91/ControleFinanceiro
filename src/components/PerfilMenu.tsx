"use client";

import { useEffect, useRef, useState } from "react";
import { assinarPerfil, atualizarPerfil, uploadFotoPerfil } from "@/lib/perfil";
import { formatarTelefone } from "@/lib/mascara";
import { CLASSE_BOTAO_PRIMARIO, CLASSE_INPUT } from "@/lib/estilos";
import { usePlano } from "@/contexts/PlanoContext";
import Avatar from "@/components/Avatar";
import type { Perfil } from "@/lib/types";

export default function PerfilMenu({
  uid,
  variante = "topo",
}: {
  uid: string;
  variante?: "topo" | "barraLateral";
}) {
  const { plano } = usePlano();
  const [perfil, setPerfil] = useState<Perfil>({
    nome: "",
    sobrenome: "",
    telefone: "",
    fotoUrl: null,
  });
  const [aberto, setAberto] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return assinarPerfil(uid, setPerfil);
  }, [uid]);

  useEffect(() => {
    function handleClickFora(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    if (aberto) document.addEventListener("mousedown", handleClickFora);
    return () => document.removeEventListener("mousedown", handleClickFora);
  }, [aberto]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setAberto((v) => !v)}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <Avatar
          fotoUrl={perfil.fotoUrl}
          nome={perfil.nome}
          sobrenome={perfil.sobrenome}
          premium={plano?.tipo === "premium"}
        />
        {`${perfil.nome} ${perfil.sobrenome}`.trim() || "Perfil"}
      </button>

      {aberto && (
        <div
          className={`absolute z-40 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-700 dark:bg-slate-800 ${
            variante === "barraLateral" ? "bottom-full left-0 mb-2" : "top-full right-0 mt-2"
          }`}
        >
          <PerfilFormulario uid={uid} perfil={perfil} onSalvar={() => setAberto(false)} />
        </div>
      )}
    </div>
  );
}

function PerfilFormulario({
  uid,
  perfil,
  onSalvar,
}: {
  uid: string;
  perfil: Perfil;
  onSalvar: () => void;
}) {
  const { plano } = usePlano();
  const [nome, setNome] = useState(perfil.nome);
  const [sobrenome, setSobrenome] = useState(perfil.sobrenome);
  const [telefone, setTelefone] = useState(perfil.telefone);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setErro("");
    setEnviandoFoto(true);
    try {
      await uploadFotoPerfil(uid, arquivo);
    } catch {
      setErro("Não foi possível enviar a foto. Tente novamente.");
    } finally {
      setEnviandoFoto(false);
    }
  }

  async function handleSalvar() {
    setErro("");
    setSalvando(true);
    try {
      await atualizarPerfil(uid, { nome, sobrenome, telefone });
      onSalvar();
    } catch {
      setErro("Não foi possível salvar. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Avatar
          fotoUrl={perfil.fotoUrl}
          nome={nome}
          sobrenome={sobrenome}
          tamanho={56}
          premium={plano?.tipo === "premium"}
        />
        <label className="cursor-pointer text-sm font-medium text-indigo-600 hover:text-indigo-700">
          {enviandoFoto ? "Enviando..." : "Alterar foto"}
          <input
            type="file"
            accept="image/*"
            onChange={handleFoto}
            disabled={enviandoFoto}
            className="hidden"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Nome</label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className={CLASSE_INPUT}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Sobrenome</label>
          <input
            type="text"
            value={sobrenome}
            onChange={(e) => setSobrenome(e.target.value)}
            className={CLASSE_INPUT}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Telefone</label>
        <input
          type="tel"
          value={telefone}
          onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
          placeholder="(00) 00000-0000"
          className={CLASSE_INPUT}
        />
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <button onClick={handleSalvar} disabled={salvando} className={CLASSE_BOTAO_PRIMARIO}>
        {salvando ? "Salvando..." : "Salvar"}
      </button>
    </div>
  );
}
