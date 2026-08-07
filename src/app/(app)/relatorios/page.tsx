"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Tab, Tabs } from "@/components/Tabs";
import RelatorioModeloI from "@/components/RelatorioModeloI";
import RelatorioModeloII from "@/components/RelatorioModeloII";
import RelatorioModeloIII from "@/components/RelatorioModeloIII";
import RelatorioModeloIV from "@/components/RelatorioModeloIV";

type Aba = "modeloI" | "modeloII" | "modeloIII" | "modeloIV";

export default function RelatoriosPage() {
  const { usuario } = useAuth();
  const [aba, setAba] = useState<Aba>("modeloI");

  if (!usuario) return null;

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 md:px-8">
      <Tabs>
        <Tab ativo={aba === "modeloI"} onClick={() => setAba("modeloI")}>
          Modelo I
        </Tab>
        <Tab ativo={aba === "modeloII"} onClick={() => setAba("modeloII")}>
          Modelo II
        </Tab>
        <Tab ativo={aba === "modeloIII"} onClick={() => setAba("modeloIII")}>
          Modelo III
        </Tab>
        <Tab ativo={aba === "modeloIV"} onClick={() => setAba("modeloIV")}>
          Modelo IV
        </Tab>
      </Tabs>

      {aba === "modeloI" && <RelatorioModeloI uid={usuario.uid} />}
      {aba === "modeloII" && <RelatorioModeloII uid={usuario.uid} />}
      {aba === "modeloIII" && <RelatorioModeloIII uid={usuario.uid} />}
      {aba === "modeloIV" && <RelatorioModeloIV uid={usuario.uid} />}
    </div>
  );
}
