"use client";

import { useRef, type ChangeEvent, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "inputMode"> & {
  value: string;
  onChange: (valor: string) => void;
};

// Monta "1.234,56" a partir só dos dígitos ("123456") — máscara estilo caixa registradora:
// os dígitos entram pela direita, sempre com 2 casas de centavos (3350 → 33,50).
function formatarCentavos(digitos: string): string {
  const limpos = digitos.replace(/\D/g, "").replace(/^0+/, "");
  if (limpos === "") return "";
  const completos = limpos.padStart(3, "0");
  const inteiro = completos.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${inteiro},${completos.slice(-2)}`;
}

export default function CampoValorMonetario({ value, onChange, placeholder = "0,00", ...props }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const inputType = (e.nativeEvent as InputEvent).inputType ?? "";
    const apagou = inputType === "deleteContentBackward" || inputType === "deleteContentForward";
    let digitos = e.target.value.replace(/\D/g, "");
    const digitosAntes = value.replace(/\D/g, "").replace(/^0+/, "");
    // Apagar só a vírgula ou um ponto não tira dígito nenhum: nesse caso remove o último.
    if (apagou && digitos.replace(/^0+/, "") === digitosAntes) digitos = digitosAntes.slice(0, -1);
    onChange(formatarCentavos(digitos));
    // O cursor fica sempre no fim, já que os dígitos entram pela direita.
    queueMicrotask(() => {
      const input = inputRef.current;
      if (input) input.setSelectionRange(input.value.length, input.value.length);
    });
  }

  return (
    <input
      {...props}
      ref={inputRef}
      type="text"
      inputMode="numeric"
      placeholder={placeholder}
      value={value}
      onChange={handleChange}
    />
  );
}

export function paraNumero(valorMascarado: string): number {
  return Number(valorMascarado.replace(/\./g, "").replace(",", "."));
}

// Número → texto no formato do campo (1234.5 → "1.234,50"; 0 → "").
export function paraTextoMonetario(valor: number): string {
  return formatarCentavos(Math.round(valor * 100).toString());
}
