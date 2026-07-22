"use client";

import { useRef, useState, type ChangeEvent, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "inputMode"> & {
  value: string;
  onChange: (valor: string) => void;
};

type EstadoValor = { digitosInteiros: string; decimais: string | null };

function limparInteiros(valor: string): string {
  return valor.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
}

function formatarExibicao({ digitosInteiros, decimais }: EstadoValor): string {
  if (digitosInteiros === "" && decimais === null) return "";
  const inteiro = (digitosInteiros || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  if (decimais === null) return `${inteiro},00`;
  return `${inteiro},${(decimais + "00").slice(0, 2)}`;
}

function interpretarValorExterno(valor: string): EstadoValor {
  const posVirgula = valor.indexOf(",");
  if (posVirgula === -1) return { digitosInteiros: limparInteiros(valor), decimais: null };
  return {
    digitosInteiros: limparInteiros(valor.slice(0, posVirgula)),
    decimais: valor.slice(posVirgula + 1).replace(/\D/g, "").slice(0, 2),
  };
}

export default function CampoValorMonetario({ value, onChange, placeholder = "0,00", ...props }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [estado, setEstado] = useState<EstadoValor>(() => interpretarValorExterno(value));
  const [ultimoValorConhecido, setUltimoValorConhecido] = useState(value);

  if (value !== ultimoValorConhecido) {
    setUltimoValorConhecido(value);
    setEstado(interpretarValorExterno(value));
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const posCursor = e.target.selectionStart ?? raw.length;
    const inputType = (e.nativeEvent as InputEvent).inputType ?? "";
    const apagou = inputType === "deleteContentBackward" || inputType === "deleteContentForward";

    let novoEstado: EstadoValor;

    if (Math.abs(raw.length - ultimoValorConhecido.length) > 1) {
      // edição em massa (colar, cortar, selecionar-tudo-e-digitar): reinterpreta o texto inteiro
      novoEstado = interpretarValorExterno(raw);
    } else {
      const posVirgulaBruta = raw.lastIndexOf(",");

      if (posVirgulaBruta === -1) {
        novoEstado =
          apagou && estado.decimais !== null
            ? { digitosInteiros: estado.digitosInteiros, decimais: null }
            : { digitosInteiros: limparInteiros(raw), decimais: null };
      } else {
        const acabouDeDigitarVirgula = !apagou && posCursor > 0 && raw[posCursor - 1] === ",";
        const editandoDecimais = acabouDeDigitarVirgula || posCursor > posVirgulaBruta;
        const digitosInteiros = limparInteiros(raw.slice(0, posVirgulaBruta));

        if (!editandoDecimais) {
          novoEstado = { digitosInteiros, decimais: estado.decimais };
        } else {
          const baseDecimais = estado.decimais ?? "";
          if (apagou) {
            novoEstado = { digitosInteiros, decimais: baseDecimais.slice(0, -1) };
          } else {
            const charDigitado = posCursor > 0 ? raw[posCursor - 1] : "";
            novoEstado = {
              digitosInteiros,
              decimais: /\d/.test(charDigitado) && baseDecimais.length < 2 ? baseDecimais + charDigitado : baseDecimais,
            };
          }
        }
      }
    }

    const formatado = formatarExibicao(novoEstado);
    setUltimoValorConhecido(formatado);
    setEstado(novoEstado);
    onChange(formatado);

    queueMicrotask(() => {
      const input = inputRef.current;
      if (!input) return;
      const posVirgulaFormatada = formatado.indexOf(",");
      const novaPos =
        posVirgulaFormatada === -1
          ? formatado.length
          : novoEstado.decimais === null
            ? posVirgulaFormatada
            : posVirgulaFormatada + 1 + novoEstado.decimais.length;
      input.setSelectionRange(novaPos, novaPos);
    });
  }

  return (
    <input
      {...props}
      ref={inputRef}
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      value={value}
      onChange={handleChange}
    />
  );
}

export function paraNumero(valorMascarado: string): number {
  return Number(valorMascarado.replace(/\./g, "").replace(",", "."));
}
