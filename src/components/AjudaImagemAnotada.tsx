import type { MarcadorImagem } from "@/lib/ajudaConteudo";

export default function AjudaImagemAnotada({
  src,
  alt,
  marcadores,
}: {
  src: string;
  alt: string;
  marcadores: MarcadorImagem[];
}) {
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_auto]">
      <div className="relative w-full self-start overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
        {/* eslint-disable-next-line @next/next/no-img-element -- cada captura de tela tem uma proporção própria; <Image> forçaria um aspect-ratio fixo e desalinharia os marcadores percentuais. */}
        <img src={src} alt={alt} className="block h-auto w-full" />
        {marcadores.map((m) => (
          <span
            key={m.numero}
            className="absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-indigo-600 text-xs font-bold text-white shadow"
            style={{ left: `${m.xPct}%`, top: `${m.yPct}%` }}
          >
            {m.numero}
          </span>
        ))}
      </div>
      <ol className="flex min-w-[220px] flex-col gap-2 text-sm md:max-w-xs">
        {marcadores.map((m) => (
          <li key={m.numero} className="flex gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-bold text-white">
              {m.numero}
            </span>
            <span className="text-slate-600 dark:text-slate-300">{m.texto}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
