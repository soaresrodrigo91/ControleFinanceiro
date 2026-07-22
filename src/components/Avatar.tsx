function iniciais(nome: string, sobrenome: string): string {
  const primeira = nome.trim().charAt(0);
  const segunda = sobrenome.trim().charAt(0);
  return (primeira + segunda).toUpperCase() || "?";
}

export default function Avatar({
  fotoUrl,
  nome,
  sobrenome,
  tamanho = 36,
  premium = false,
}: {
  fotoUrl: string | null;
  nome: string;
  sobrenome: string;
  tamanho?: number;
  premium?: boolean;
}) {
  const estilo = { width: tamanho, height: tamanho };
  const tamanhoEstrela = Math.max(Math.round(tamanho * 0.4), 12);

  return (
    <span className="relative inline-flex shrink-0" style={estilo}>
      {fotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={fotoUrl}
          alt="Foto de perfil"
          style={estilo}
          className="shrink-0 rounded-full object-cover"
        />
      ) : (
        <span
          style={estilo}
          className="flex shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300"
        >
          {iniciais(nome, sobrenome)}
        </span>
      )}
      {premium && (
        <span
          title="Premium"
          className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full bg-white text-amber-500 ring-1 ring-white dark:bg-slate-900 dark:ring-slate-900"
          style={{ width: tamanhoEstrela, height: tamanhoEstrela, fontSize: tamanhoEstrela * 0.75 }}
        >
          ★
        </span>
      )}
    </span>
  );
}
