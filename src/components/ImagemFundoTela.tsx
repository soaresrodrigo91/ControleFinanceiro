export default function ImagemFundoTela() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full text-indigo-600/[0.1] dark:text-indigo-400/[0.14]"
      preserveAspectRatio="xMidYMid slice"
      viewBox="0 0 1200 900"
    >
      {/* linhas de tendencia cruzando a tela */}
      <path
        d="M-40 620 L160 520 L320 590 L480 420 L640 480 L820 280 L1000 360 L1240 180"
        fill="none"
        stroke="currentColor"
        strokeWidth={7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M-40 760 L200 700 L360 730 L520 650 L700 690 L880 580 L1060 620 L1240 540"
        fill="none"
        stroke="currentColor"
        strokeWidth={7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* pequeno detalhe de cifrao, no canto */}
      <path
        d="M1135 58v54M1149 70a13 13 0 0 0-12-7c-8 0-13 5-13 11s6 9 13 11c8 2 13 5 13 11s-6 11-13 11a13 13 0 0 1-12-7"
        fill="none"
        stroke="currentColor"
        strokeWidth={3.5}
        strokeLinecap="round"
      />

      {/* barras ascendentes no canto oposto */}
      <path
        d="M60 850v-120M140 850v-190M220 850v-260M300 850v-160"
        fill="none"
        stroke="currentColor"
        strokeWidth={22}
        strokeLinecap="round"
        opacity={0.85}
      />
    </svg>
  );
}
