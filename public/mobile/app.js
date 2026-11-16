import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, doc, onSnapshot, query, where, orderBy,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyA-6Afn4S8LLByN2wiR4O23cgemPJhpMFM",
  authDomain: "controlefinanceiro-4239f.firebaseapp.com",
  projectId: "controlefinanceiro-4239f",
  messagingSenderId: "1081542365165",
  appId: "1:1081542365165:web:de6eb03a98ce0de68ee1e4",
};

// App mobile = visão do Plano Financeiro no celular: um card por Aplicação com o gasto do
// mês (só a parte própria, reembolsos descontados) comparado ao limite configurado, e uma aba
// com a distribuição configurada. Mesmas regras de src/lib/planoFinanceiro.ts e da tela
// src/app/(app)/plano-financeiro/page.tsx — ao mudar a regra lá, mude aqui também.

const APLICACOES_PADRAO = [
  "Alimentação", "Moradia", "Carro e Transporte", "Saúde", "Lazer", "Assinaturas", "Parcelamentos", "Outros",
];

/* ---------- datas / dinheiro ---------- */
function mesAtualYM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function somarMesesYM(ym, meses) {
  const [ano, mes] = ym.split("-").map(Number);
  const data = new Date(ano, mes - 1 + meses, 1);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
}
const NOMES_MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
function formatarMesAno(ym) {
  const [ano, mes] = ym.split("-").map(Number);
  return `${NOMES_MESES[mes - 1]} ${ano}`;
}
function formatarDiaMes(dataISO) {
  const [, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}`;
}
function formatarMoeda(valor) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function formatarPercentual(valor) {
  return `${arredondar2(valor).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}
function arredondar2(valor) {
  return Math.round(valor * 100) / 100;
}
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function compararNomes(a, b) {
  return a.localeCompare(b, "pt-BR", { sensitivity: "base" });
}

/* ---------- recorrências (mesma lógica de src/lib/recorrencias.ts) ---------- */
function ativaNoMes(r, ymAlvo) {
  if (ymAlvo < r.inicio.slice(0, 7)) return false;
  if (r.fim && ymAlvo > r.fim.slice(0, 7)) return false;
  if (r.mesesExcluidos?.includes(ymAlvo)) return false;
  return true;
}
function valorNoMes(r, ymAlvo) {
  const fimDoMes = `${ymAlvo}-31`;
  let valor = r.valorAtual;
  for (const h of [...(r.historicoValores ?? [])].sort((a, b) => a.desde.localeCompare(b.desde))) {
    if (h.desde <= fimDoMes) valor = h.valor;
  }
  return valor;
}
function vencimentoNoMes(r, ymAlvo) {
  const [ano, mes] = ymAlvo.split("-").map(Number);
  const ultimoDiaDoMes = new Date(ano, mes, 0).getDate();
  const dia = Math.min(r.diaVencimento, ultimoDiaDoMes);
  return `${ymAlvo}-${String(dia).padStart(2, "0")}`;
}
function mesclarComRecorrencias(parcelasReaisDoMes, recorrencias, ymAlvo) {
  const idsJaMaterializados = new Set(parcelasReaisDoMes.filter((p) => p.recorrenciaId).map((p) => p.recorrenciaId));
  const virtuais = recorrencias
    .filter((r) => ativaNoMes(r, ymAlvo) && !idsJaMaterializados.has(r.id))
    .map((r) => ({
      id: `virtual:${r.id}:${ymAlvo}`,
      recorrenciaId: r.id,
      credor: r.credor,
      observacao: r.observacao,
      parcelaNum: 1,
      parcelaTotal: 1,
      valorParcela: valorNoMes(r, ymAlvo),
      comp: r.comp ?? null,
      grupo: r.grupo ?? "Fixas",
      aplicacao: r.aplicacao ?? "Outros",
      vencimento: vencimentoNoMes(r, ymAlvo),
      pago: false,
      virtual: true,
    }));
  return [...parcelasReaisDoMes, ...virtuais].sort((a, b) => a.vencimento.localeCompare(b.vencimento));
}

/* ---------- regras do Plano Financeiro (src/lib/planoFinanceiro.ts) ---------- */
// Valor a receber que é do próprio usuário: recebimentos lançados (sem os reembolsos) +
// recorrências a receber ainda não materializadas no mês.
function calcularAReceberProprio(recebimentosDoMes, recorrenciasReceber, ymAlvo) {
  const proprios = recebimentosDoMes.filter((r) => !r.origemComp);
  let total = proprios.reduce((s, r) => s + r.valor, 0);
  const idsJaMaterializados = new Set(proprios.filter((r) => r.recorrenciaId).map((r) => r.recorrenciaId));
  for (const rec of recorrenciasReceber) {
    if (ativaNoMes(rec, ymAlvo) && !idsJaMaterializados.has(rec.id)) total += valorNoMes(rec, ymAlvo);
  }
  return total;
}

// Parte do lançamento que é do usuário: reembolso "total" não é dele, "metade" só metade.
function valorProprio(p, modoPorNomeComp) {
  const modo = p.comp ? modoPorNomeComp[p.comp] : undefined;
  if (modo === "total") return 0;
  if (modo === "metade") return p.valorParcela / 2;
  return p.valorParcela;
}

function limiteNoMes(modo, configurado, aReceberNoMes) {
  return modo === "percentual" ? arredondar2((aReceberNoMes * configurado) / 100) : configurado;
}

// Aplicação de reserva (nome começando com "Reserva"): dinheiro depositado para si mesmo —
// verde ao atingir a meta, vermelho abaixo dela.
function ehReserva(aplicacao) {
  return aplicacao.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().startsWith("reserva");
}

/* ---------- estado ---------- */
const $ = (s) => document.querySelector(s);

let auth = null, bd = null, usuario = null;
let ym = mesAtualYM();
let abaAtual = "aplicacoes";
let config = { aplicacoes: APLICACOES_PADRAO, comp: [], planoFinanceiro: { modo: "valor", distribuicao: {} } };
let parcelasDoMes = [];
let recebimentosDoMes = [];
let recorrenciasPagar = [];
let recorrenciasReceber = [];
let aplicacaoAberta = null;
let perfil = { nome: "", sobrenome: "", fotoUrl: null };
// Filtro dos cards: "todos" (padrão ao abrir o app), "verdes" ou "vermelhos".
let filtroStatus = "todos";
const unsubs = { perfil: null, config: null, parcelas: null, recebimentos: null, recPagar: null, recReceber: null };

function cancelarAssinaturas(chaves = Object.keys(unsubs)) {
  for (const k of chaves) {
    if (unsubs[k]) unsubs[k]();
    unsubs[k] = null;
  }
}

/* ---------- inicialização ---------- */
window.addEventListener("DOMContentLoaded", () => {
  const app = initializeApp(FIREBASE_CONFIG);
  auth = getAuth(app);
  bd = getFirestore(app);

  onAuthStateChanged(auth, (u) => {
    $("#carregando").classList.add("hidden");
    if (u) {
      usuario = u;
      assinarDadosFixos();
      assinarMes();
      atualizarMes();
      $("#tela-login").classList.add("hidden");
      $("#app").classList.remove("hidden");
    } else {
      usuario = null;
      cancelarAssinaturas();
      $("#app").classList.add("hidden");
      $("#tela-login").classList.remove("hidden");
    }
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/mobile/sw.js").catch(() => {});
  }

  ligarEventos();
});

function assinarDadosFixos() {
  cancelarAssinaturas(["perfil", "config", "recPagar", "recReceber"]);
  // Mesmo perfil do site (nome, sobrenome e foto) para o avatar do canto superior direito.
  unsubs.perfil = onSnapshot(doc(bd, "usuarios", usuario.uid), (snap) => {
    const d = snap.data();
    perfil = { nome: d?.nome ?? "", sobrenome: d?.sobrenome ?? "", fotoUrl: d?.fotoUrl ?? null };
    renderAvatar();
  });
  unsubs.config = onSnapshot(doc(bd, "usuarios", usuario.uid, "config", "listas"), (snap) => {
    const d = snap.exists() ? snap.data() : {};
    config = {
      aplicacoes: d.aplicacoes ?? APLICACOES_PADRAO,
      comp: d.comp ?? [],
      planoFinanceiro: d.planoFinanceiro ?? { modo: "valor", distribuicao: {} },
    };
    render();
  });
  const recs = collection(bd, "usuarios", usuario.uid, "recorrencias");
  unsubs.recPagar = onSnapshot(query(recs, where("tipo", "==", "pagar")), (snap) => {
    recorrenciasPagar = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    render();
  });
  unsubs.recReceber = onSnapshot(query(recs, where("tipo", "==", "receber")), (snap) => {
    recorrenciasReceber = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    render();
  });
}

function assinarMes() {
  cancelarAssinaturas(["parcelas", "recebimentos"]);
  parcelasDoMes = [];
  recebimentosDoMes = [];
  const ymAssinado = ym;
  unsubs.parcelas = onSnapshot(
    query(
      collection(bd, "usuarios", usuario.uid, "parcelas"),
      where("vencimento", ">=", `${ym}-01`),
      where("vencimento", "<=", `${ym}-31`),
      orderBy("vencimento")
    ),
    (snap) => {
      if (ymAssinado !== ym) return;
      parcelasDoMes = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      render();
    }
  );
  unsubs.recebimentos = onSnapshot(
    query(
      collection(bd, "usuarios", usuario.uid, "recebimentos"),
      where("recebimento", ">=", `${ym}-01`),
      where("recebimento", "<=", `${ym}-31`),
      orderBy("recebimento")
    ),
    (snap) => {
      if (ymAssinado !== ym) return;
      recebimentosDoMes = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      render();
    }
  );
}

/* ---------- eventos ---------- */
function ligarEventos() {
  $("#btn-entrar").addEventListener("click", entrar);
  $("#login-senha").addEventListener("keydown", (e) => { if (e.key === "Enter") entrar(); });
  $("#btn-esqueci").addEventListener("click", esqueciSenha);
  $("#btn-sair").addEventListener("click", () => {
    fecharMenuUsuario();
    signOut(auth);
  });
  $("#btn-tema").addEventListener("click", alternarTema);
  $("#btn-avatar").addEventListener("click", () => {
    if ($("#menu-usuario").classList.contains("hidden")) abrirMenuUsuario();
    else fecharMenuUsuario();
  });
  $("#menu-usuario-fundo").addEventListener("click", fecharMenuUsuario);
  $("#btn-inicio").addEventListener("click", irParaInicio);
  $("#filtro-status").addEventListener("click", (e) => {
    const botao = e.target.closest("[data-filtro]");
    if (!botao) return;
    filtroStatus = botao.dataset.filtro;
    document.querySelectorAll("#filtro-status [data-filtro]").forEach((b) => {
      const ativo = b.dataset.filtro === filtroStatus;
      b.classList.toggle("ativo", ativo);
      b.setAttribute("aria-checked", String(ativo));
    });
    render();
  });

  $("#mes-anterior").addEventListener("click", () => mudarMes(-1));
  $("#mes-proximo").addEventListener("click", () => mudarMes(1));
  $("#mes-atual").addEventListener("click", () => {
    if (ym !== mesAtualYM()) irParaMes(mesAtualYM());
  });

  document.querySelectorAll(".aba").forEach((b) => b.addEventListener("click", () => trocarAba(b.dataset.aba)));

  $("#grade-cards").addEventListener("click", (e) => {
    const card = e.target.closest("[data-aplicacao]");
    if (card) abrirLancamentos(card.dataset.aplicacao);
  });
  $("#btn-fechar-folha").addEventListener("click", () => history.back());
  window.addEventListener("popstate", () => fecharLancamentos());

  // Arrastar para o lado troca o mês (fora da folha de lançamentos).
  let inicioX = null, inicioY = null;
  const area = $("#conteudo");
  area.addEventListener("touchstart", (e) => {
    inicioX = e.touches[0].clientX;
    inicioY = e.touches[0].clientY;
  }, { passive: true });
  area.addEventListener("touchend", (e) => {
    if (inicioX === null) return;
    const dx = e.changedTouches[0].clientX - inicioX;
    const dy = e.changedTouches[0].clientY - inicioY;
    inicioX = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    mudarMes(dx < 0 ? 1 : -1);
  }, { passive: true });
}

function mudarMes(delta) {
  irParaMes(somarMesesYM(ym, delta));
}
function irParaMes(novoYm) {
  ym = novoYm;
  atualizarMes();
  assinarMes();
  render();
}
function atualizarMes() {
  $("#mes-atual").textContent = formatarMesAno(ym);
  $("#mes-atual").classList.toggle("fora-do-atual", ym !== mesAtualYM());
}

function trocarAba(aba) {
  abaAtual = aba;
  document.querySelectorAll(".aba").forEach((b) => b.classList.toggle("ativa", b.dataset.aba === aba));
  $("#aba-aplicacoes").classList.toggle("hidden", aba !== "aplicacoes");
  $("#aba-distribuicao").classList.toggle("hidden", aba !== "distribuicao");
  $("#conteudo").scrollTop = 0;
  render();
}

function alternarTema() {
  const escuro = document.documentElement.getAttribute("data-tema") !== "escuro";
  if (escuro) document.documentElement.setAttribute("data-tema", "escuro");
  else document.documentElement.removeAttribute("data-tema");
  try { localStorage.setItem("temaEscuro", String(escuro)); } catch {}
  atualizarTextoTema();
}
function atualizarTextoTema() {
  const escuro = document.documentElement.getAttribute("data-tema") === "escuro";
  $("#texto-tema").textContent = escuro ? "Tema claro" : "Tema escuro";
}

// Casinha: de qualquer tela volta para o início (aba Aplicações, lista no topo).
function irParaInicio() {
  fecharMenuUsuario();
  if (aplicacaoAberta) history.back();
  trocarAba("aplicacoes");
}

/* ---------- usuário (avatar + menu) ---------- */
function iniciaisPerfil() {
  const iniciais = (perfil.nome.trim().charAt(0) + perfil.sobrenome.trim().charAt(0)).toUpperCase();
  if (iniciais) return iniciais;
  return usuario?.email ? usuario.email[0].toUpperCase() : "U";
}
function conteudoAvatar() {
  return perfil.fotoUrl ? `<img src="${esc(perfil.fotoUrl)}" alt="">` : esc(iniciaisPerfil());
}
function renderAvatar() {
  $("#btn-avatar").innerHTML = conteudoAvatar();
  $("#menu-avatar").innerHTML = conteudoAvatar();
  const nomeCompleto = `${perfil.nome} ${perfil.sobrenome}`.trim();
  $("#menu-nome").textContent = nomeCompleto || "Usuário";
  $("#menu-email").textContent = usuario?.email ?? "";
}
function abrirMenuUsuario() {
  atualizarTextoTema();
  $("#menu-usuario").classList.remove("hidden");
  $("#menu-usuario-fundo").classList.remove("hidden");
  $("#btn-avatar").setAttribute("aria-expanded", "true");
}
function fecharMenuUsuario() {
  $("#menu-usuario").classList.add("hidden");
  $("#menu-usuario-fundo").classList.add("hidden");
  $("#btn-avatar").setAttribute("aria-expanded", "false");
}

/* ---------- login ---------- */
function mostrarMsg(seletor, texto, tipo) {
  const el = $(seletor);
  el.textContent = texto;
  el.className = texto ? `aviso ${tipo || ""}` : "";
}
async function entrar() {
  const email = $("#login-email").value.trim();
  const senha = $("#login-senha").value;
  if (!email || !senha) {
    mostrarMsg("#msg-login", "Preencha e-mail e senha.", "erro");
    return;
  }
  $("#btn-entrar").disabled = true;
  $("#btn-entrar").textContent = "Aguarde...";
  try {
    await signInWithEmailAndPassword(auth, email, senha);
    mostrarMsg("#msg-login", "", "");
  } catch (e) {
    const mapa = {
      "auth/invalid-credential": "E-mail não cadastrado ou senha incorreta.",
      "auth/user-not-found": "Este e-mail não está cadastrado.",
      "auth/wrong-password": "Senha incorreta.",
      "auth/invalid-email": "E-mail inválido.",
      "auth/too-many-requests": "Muitas tentativas. Aguarde um pouco e tente de novo.",
    };
    mostrarMsg("#msg-login", mapa[e.code] || `Erro: ${e.code}`, "erro");
  }
  $("#btn-entrar").disabled = false;
  $("#btn-entrar").textContent = "Entrar";
}
async function esqueciSenha() {
  const email = $("#login-email").value.trim();
  if (!email) {
    mostrarMsg("#msg-login", "Digite seu e-mail no campo acima primeiro.", "erro");
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    mostrarMsg("#msg-login", "Enviamos um link de redefinição para seu e-mail.", "ok");
  } catch {
    mostrarMsg("#msg-login", "Não foi possível enviar. Confira o e-mail digitado.", "erro");
  }
}

/* ---------- cálculo do mês ---------- */
function calcularMes() {
  const modoPorNomeComp = Object.fromEntries(config.comp.map((c) => [c.nome, c.modo]));
  const { modo, distribuicao } = config.planoFinanceiro;
  const aReceber = calcularAReceberProprio(recebimentosDoMes, recorrenciasReceber, ym);
  const lancamentos = mesclarComRecorrencias(parcelasDoMes, recorrenciasPagar, ym);

  const porAplicacao = new Map();
  for (const p of lancamentos) {
    const item = porAplicacao.get(p.aplicacao) ?? { gasto: 0, lancamentos: [] };
    item.gasto += valorProprio(p, modoPorNomeComp);
    item.lancamentos.push(p);
    porAplicacao.set(p.aplicacao, item);
  }

  // Cards do mês: Aplicações com lançamento no mês, mais a reserva com meta configurada (é
  // justamente sem depósito que ela precisa aparecer em vermelho). Ordem alfabética.
  const nomes = new Set([...porAplicacao.keys()]);
  for (const a of config.aplicacoes) {
    if (ehReserva(a) && (distribuicao[a] ?? 0) > 0) nomes.add(a);
  }
  const cards = [...nomes].sort(compararNomes).map((aplicacao) => {
    const item = porAplicacao.get(aplicacao) ?? { gasto: 0, lancamentos: [] };
    const gasto = arredondar2(item.gasto);
    const configurado = distribuicao[aplicacao] ?? 0;
    const limite = limiteNoMes(modo, configurado, aReceber);
    const reserva = ehReserva(aplicacao);
    const saldo = arredondar2(limite - gasto);
    return {
      aplicacao,
      gasto,
      limite,
      reserva,
      // Mesma regra do nome em laranja no Plano Financeiro do site: tem gasto, mas nenhum
      // valor configurado na distribuição (olha o % / R$ configurado, não o limite do mês).
      semLimite: configurado <= 0 && gasto > 0,
      saldo,
      ruim: reserva ? saldo > 0 : saldo < 0,
      lancamentos: item.lancamentos,
      foraDaLista: !config.aplicacoes.includes(aplicacao),
    };
  });

  return { aReceber, cards, modoPorNomeComp };
}

/* ---------- render ---------- */
function render() {
  if (!usuario) return;
  const mes = calcularMes();
  if (abaAtual === "aplicacoes") renderAplicacoes(mes);
  else renderDistribuicao(mes);
  if (aplicacaoAberta) renderLancamentos(mes);
}

function textoQtd(n) {
  return `${n} ${n === 1 ? "lançamento" : "lançamentos"}`;
}

function linhaSaldo(c) {
  if (c.reserva) {
    return c.ruim
      ? `Faltam ${formatarMoeda(c.saldo)}`
      : c.saldo < 0 ? `Meta + ${formatarMoeda(-c.saldo)}` : "Meta atingida";
  }
  if (c.semLimite) return "Sem limite configurado";
  return c.ruim ? `Estourou ${formatarMoeda(-c.saldo)}` : `Sobram ${formatarMoeda(c.saldo)}`;
}

function renderAplicacoes({ aReceber, cards }) {
  const gastoTotal = arredondar2(cards.filter((c) => !c.reserva).reduce((s, c) => s + c.gasto, 0));
  const reservado = arredondar2(cards.filter((c) => c.reserva).reduce((s, c) => s + c.gasto, 0));
  const saldo = arredondar2(aReceber - gastoTotal - reservado);
  // Situação dos cards separada por motivo, para ficar claro por que cada um está vermelho.
  const qtdDentro = cards.filter((c) => !c.ruim && !c.semLimite).length;
  const qtdAcima = cards.filter((c) => c.ruim && !c.reserva && !c.semLimite).length;
  const nomesSemLimite = cards.filter((c) => c.semLimite).map((c) => esc(c.aplicacao));
  const situacoes = [
    qtdDentro && `<span class="pilula verde">${qtdDentro} dentro do limite</span>`,
    qtdAcima && `<span class="pilula vermelho">${qtdAcima} acima do limite</span>`,
    nomesSemLimite.length &&
      `<span class="pilula laranja">Sem limite configurado: ${nomesSemLimite.join(", ")}</span>`,
  ].filter(Boolean);

  $("#resumo-mes").innerHTML = `
    <div class="resumo-item">
      <span class="rotulo">A receber</span>
      <span class="valor">${formatarMoeda(aReceber)}</span>
    </div>
    <div class="resumo-item">
      <span class="rotulo">Gasto${reservado > 0 ? " + reserva" : ""}</span>
      <span class="valor">${formatarMoeda(gastoTotal + reservado)}</span>
    </div>
    <div class="resumo-item">
      <span class="rotulo">Saldo</span>
      <span class="valor ${saldo < 0 ? "vermelho" : saldo > 0 ? "verde" : ""}">${formatarMoeda(saldo)}</span>
    </div>
  `;
  // Contagem por situação fica no fim da tela, depois dos cards, para não tomar espaço no topo.
  $("#status-cards").innerHTML = situacoes.join("");

  if (!cards.length) {
    $("#grade-cards").innerHTML = `<div class="vazio">Nenhum lançamento em Contas a Pagar em ${esc(formatarMesAno(ym))}.</div>`;
    return;
  }

  // Filtro: Todos / No limite (cards verdes) / Fora do limite (cards vermelhos).
  const visiveis = cards.filter((c) =>
    filtroStatus === "verdes" ? !c.ruim : filtroStatus === "vermelhos" ? c.ruim : true
  );
  if (!visiveis.length) {
    $("#grade-cards").innerHTML = `<div class="vazio">Nenhuma Aplicação ${
      filtroStatus === "verdes" ? "no limite" : "fora do limite"
    } em ${esc(formatarMesAno(ym))}.</div>`;
    return;
  }

  $("#grade-cards").innerHTML = visiveis.map((c) => {
    const base = c.limite > 0 ? c.limite : c.gasto;
    const pct = base > 0 ? Math.min(100, (c.gasto / base) * 100) : 0;
    const status = c.ruim ? "vermelho" : "verde";
    return `
      <button class="card ${status}" data-aplicacao="${esc(c.aplicacao)}">
        <span class="card-topo">
          <span class="card-nome ${c.semLimite ? "laranja" : ""}">${esc(c.aplicacao)}</span>
          ${c.reserva ? `<span class="tag">Reserva</span>` : ""}
        </span>
        <span class="card-valor ${status}">${formatarMoeda(c.gasto)}</span>
        <span class="card-limite">${c.reserva ? "Meta" : "Limite"}: ${c.limite > 0 ? formatarMoeda(c.limite) : "—"}</span>
        <span class="barra"><span class="barra-preenchida ${status}" style="width:${pct.toFixed(1)}%"></span></span>
        <span class="card-rodape">
          <span class="card-saldo ${status}">${linhaSaldo(c)}</span>
          <span class="card-qtd">${textoQtd(c.lancamentos.length)}</span>
        </span>
      </button>`;
  }).join("");
}

function renderDistribuicao({ aReceber }) {
  const { modo, distribuicao } = config.planoFinanceiro;
  const aplicacoes = [...config.aplicacoes].sort(compararNomes);
  const total = arredondar2(aplicacoes.reduce((s, a) => s + (distribuicao[a] ?? 0), 0));
  const limiteTotal = modo === "percentual" ? 100 : arredondar2(aReceber);
  const restante = arredondar2(limiteTotal - total);
  const fmt = (v) => (modo === "percentual" ? formatarPercentual(v) : formatarMoeda(v));
  const corSaldo = restante < 0 ? "vermelho" : restante > 0 ? "verde" : "";

  $("#distrib-cabecalho").innerHTML = `
    <div class="distrib-modo">Distribuição em <strong>${modo === "percentual" ? "percentual (%)" : "valor (R$)"}</strong></div>
    <div class="distrib-totais">
      <div><span class="rotulo">A receber em ${esc(formatarMesAno(ym))}</span><span class="valor">${formatarMoeda(aReceber)}</span></div>
      <div><span class="rotulo">Distribuído</span><span class="valor ${corSaldo}">${fmt(total)} <small>de ${fmt(limiteTotal)}</small></span></div>
    </div>
    <p class="distrib-saldo ${corSaldo}">${
      restante < 0 ? `Passou ${fmt(-restante)} do limite` : restante > 0 ? `Falta distribuir ${fmt(restante)}` : "Tudo distribuído"
    }</p>
  `;

  if (!aplicacoes.length) {
    $("#distrib-lista").innerHTML = `<div class="vazio">Nenhuma Aplicação cadastrada.</div>`;
    return;
  }

  $("#distrib-lista").innerHTML = aplicacoes.map((a) => {
    const valor = distribuicao[a] ?? 0;
    const emReais = limiteNoMes(modo, valor, aReceber);
    const fatia = aReceber > 0 ? Math.min(100, (emReais / aReceber) * 100) : 0;
    const equivalente =
      modo === "percentual" ? formatarMoeda(emReais) : aReceber > 0 ? formatarPercentual((valor / aReceber) * 100) : "—";
    return `
      <div class="distrib-item ${valor > 0 ? "" : "sem-valor"}">
        <div class="distrib-linha">
          <span class="distrib-nome">${esc(a)}${ehReserva(a) ? ` <span class="tag">Reserva</span>` : ""}</span>
          <span class="distrib-valor">${valor > 0 ? fmt(valor) : "—"}</span>
        </div>
        <div class="barra fina"><span class="barra-preenchida indigo" style="width:${fatia.toFixed(1)}%"></span></div>
        <div class="distrib-equivalente">${valor > 0 ? `= ${equivalente} ${modo === "percentual" ? "neste mês" : "do valor a receber"}` : "Sem valor configurado"}</div>
      </div>`;
  }).join("");
}

/* ---------- lançamentos de uma Aplicação ---------- */
function abrirLancamentos(aplicacao) {
  aplicacaoAberta = aplicacao;
  history.pushState({ folha: true }, "");
  $("#folha-lancamentos").classList.remove("hidden");
  $("#folha-lista").scrollTop = 0;
  render();
}
function fecharLancamentos() {
  aplicacaoAberta = null;
  $("#folha-lancamentos").classList.add("hidden");
}

function renderLancamentos({ cards, modoPorNomeComp }) {
  const c = cards.find((x) => x.aplicacao === aplicacaoAberta);
  $("#folha-titulo").textContent = aplicacaoAberta;
  $("#folha-subtitulo").textContent = `${formatarMesAno(ym)} · ${textoQtd(c ? c.lancamentos.length : 0)}`;

  if (!c) {
    $("#folha-resumo").innerHTML = "";
    $("#folha-lista").innerHTML = `<div class="vazio">Nenhum lançamento nesta Aplicação em ${esc(formatarMesAno(ym))}.</div>`;
    return;
  }

  const status = c.ruim ? "vermelho" : "verde";
  $("#folha-resumo").innerHTML = `
    <div><span class="rotulo">${c.reserva ? "Depositado" : "Gasto"}</span><span class="valor ${status}">${formatarMoeda(c.gasto)}</span></div>
    <div><span class="rotulo">${c.reserva ? "Meta" : "Limite"}</span><span class="valor">${c.limite > 0 ? formatarMoeda(c.limite) : "—"}</span></div>
    <div><span class="rotulo">Situação</span><span class="valor ${status}">${linhaSaldo(c)}</span></div>
  `;

  if (!c.lancamentos.length) {
    $("#folha-lista").innerHTML = `<div class="vazio">Nada depositado em ${esc(formatarMesAno(ym))} ainda.</div>`;
    return;
  }

  $("#folha-lista").innerHTML = c.lancamentos.map((p) => {
    const proprio = valorProprio(p, modoPorNomeComp);
    const modoComp = p.comp ? modoPorNomeComp[p.comp] : undefined;
    const temReembolso = p.comp && (modoComp === "total" || modoComp === "metade");
    const detalhes = [
      `Venc. ${formatarDiaMes(p.vencimento)}`,
      esc(p.grupo),
      p.virtual || p.recorrenciaId ? "Conta fixa" : p.parcelaTotal > 1 ? `${p.parcelaNum}/${p.parcelaTotal}` : null,
    ].filter(Boolean).join(" · ");
    return `
      <div class="lanc">
        <div class="lanc-info">
          <span class="lanc-credor">${esc(p.credor)}</span>
          ${p.observacao ? `<span class="lanc-obs">${esc(p.observacao)}</span>` : ""}
          <span class="lanc-detalhes">${detalhes}</span>
          ${temReembolso ? `<span class="lanc-reembolso">Reembolso ${esc(p.comp)} (${modoComp === "total" ? "100%" : "50%"})</span>` : ""}
        </div>
        <div class="lanc-valores">
          <span class="lanc-valor">${formatarMoeda(p.valorParcela)}</span>
          ${temReembolso ? `<span class="lanc-proprio">sua parte ${formatarMoeda(proprio)}</span>` : ""}
          <span class="lanc-status ${p.pago ? "pago" : ""}">${p.pago ? "Pago" : "Pendente"}</span>
        </div>
      </div>`;
  }).join("");
}
