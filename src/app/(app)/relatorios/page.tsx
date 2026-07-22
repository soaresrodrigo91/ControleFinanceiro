"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Tab, Tabs } from "@/components/Tabs";
import RelatorioModeloI from "@/components/RelatorioModeloI";
import RelatorioModeloII from "@/components/RelatorioModeloII";

type Aba = "modeloI" | "modeloII";

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
      </Tabs>

      {aba === "modeloI" ? <RelatorioModeloI uid={usuario.uid} /> : <RelatorioModeloII uid={usuario.uid} />}
    </div>
  );
}
