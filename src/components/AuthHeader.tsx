function IconCarteira(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <path
        d="M3.5 8.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-9Z"
        strokeLinejoin="round"
      />
      <path d="M3.5 8.5V6a2 2 0 0 1 2-2h9" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16" cy="13" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default function AuthHeader() {
  return (
    <div className="mb-6 flex flex-col items-center gap-2">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-950">
        <IconCarteira className="h-7 w-7" />
      </div>
      <p className="text-xl font-semibold text-slate-900 dark:text-slate-100">Controle Financeiro</p>
      <p className="text-sm text-slate-500 dark:text-slate-400">O jeito simples de cuidar das finanças</p>
    </div>
  );
}
