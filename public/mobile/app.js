import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, doc, getDoc, addDoc, writeBatch, updateDoc, deleteDoc, onSnapshot,
  query, where, orderBy, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyA-6Afn4S8LLByN2wiR4O23cgemPJhpMFM",
  authDomain: "controlefinanceiro-4239f.firebaseapp.com",
  projectId: "controlefinanceiro-4239f",
  messagingSenderId: "1081542365165",
  appId: "1:1081542365165:web:de6eb03a98ce0de68ee1e4",
};

/* ---------- datas / dinheiro (mesma lógica de src/lib/date.ts e src/lib/dinheiro.ts) ---------- */
function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function mesAtualYM() {
  return hojeISO().slice(0, 7);
}
function somarMeses(dataISO, meses) {
  const [ano, mes, dia] = dataISO.split("-").map(Number);
  const data = new Date(ano, mes - 1 + meses, dia);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}
function somarMesesYM(ym, meses) {
  const [ano, mes] = ym.split("-").map(Number);
  const data = new Date(ano, mes - 1 + meses, 1);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
}
function formatarDataBR(dataISO) {
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}/${ano}`;
}
function formatarMesAno(ym) {
  const [ano, mes] = ym.split("-").map(Number);
  const nomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  return `${nomes[mes - 1]} ${String(ano).slice(2)}`;
}
function formatarMoeda(valor) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function dividirValor(valorTotal, parcelaTotal) {
  const centavos = Math.round(valorTotal * 100);
  const porParcela = Math.floor(centavos / parcelaTotal);
  const valores = new Array(parcelaTotal).fill(porParcela);
  const resto = centavos - porParcela * parcelaTotal;
  valores[valores.length - 1] += resto;
  return valores.map((c) => c / 100);
}
function paraNumero(texto) {
  const n = Number(String(texto).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
function formatarTelefone(valor) {
  const digitos = valor.replace(/\D/g, "").slice(0, 11);
  if (digitos.length === 0) return "";
  if (digitos.length <= 2) return `(${digitos}`;
  if (digitos.length <= 7) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
}
function esc(s) {
  return (s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---------- recorrências / contas fixas (mesma lógica de src/lib/recorrencias.ts) ---------- */
function ativaNoMes(r, ymAlvo) {
  if (ymAlvo < r.inicio.slice(0, 7)) return false;
  if (r.fim && ymAlvo > r.fim.slice(0, 7)) return false;
  if (r.mesesExcluidos?.includes(ymAlvo)) return false;
  return true;
}
function valorNoMes(r, ymAlvo) {
  const fimDoMes = `${ymAlvo}-31`;
  let valor = r.valorAtual;
  for (const h of [...r.historicoValores].sort((a, b) => a.desde.localeCompare(b.desde))) {
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
  const idsJaMaterializados = new Set(
    parcelasReaisDoMes.filter((p) => p.recorrenciaId).map((p) => p.recorrenciaId)
  );
  const virtuais = recorrencias
    .filter((r) => ativaNoMes(r, ymAlvo) && !idsJaMaterializados.has(r.id))
    .map((r) => ({
      id: `virtual:${r.id}:${ymAlvo}`,
      lancamentoId: r.id,
      recorrenciaId: r.id,
      credor: r.credor,
      dataCompra: r.inicio,
      observacao: r.observacao,
      valorTotal: valorNoMes(r, ymAlvo),
      parcelaNum: 1,
      parcelaTotal: 1,
      valorParcela: valorNoMes(r, ymAlvo),
      comp: r.comp ?? null,
      grupo: r.grupo ?? "Fixas",
      aplicacao: r.aplicacao ?? "Outros",
      vencimento: vencimentoNoMes(r, ymAlvo),
      pago: false,
      pagoEm: null,
      virtual: true,
      provisao: r.provisao ?? false,
    }));
  return [...parcelasReaisDoMes, ...virtuais].sort((a, b) => a.vencimento.localeCompare(b.vencimento));
}

const $ = (s) => document.querySelector(s);

/* ---------- estado ---------- */
let auth = null, bd = null, usuario = null;
let ym = mesAtualYM();
let configListas = { grupos: [], aplicacoes: [], comp: [], modoTotalizador: "todos" };
let parcelasAtuais = [];
let recebimentosAtuais = [];
let unsubParcelas = null, unsubRecebimentos = null;
let filtroGrupoPagar = null;
let filtroOrigemReceber = null;
let telaAnterior = "inicio";
let notificacoesAtuais = [];
let unsubNotificacoes = null;
let recorrenciasPagarAtuais = [];
let recorrenciasReceberAtuais = [];
let unsubRecorrenciasPagar = null, unsubRecorrenciasReceber = null;
let filtrosDashboardAtuais = {};

/* ---------- inicialização ---------- */
window.addEventListener("DOMContentLoaded", () => {
  const app = initializeApp(FIREBASE_CONFIG);
  auth = getAuth(app);
  bd = getFirestore(app);

  onAuthStateChanged(auth, async (u) => {
    if (u) {
      usuario = u;
      assinarPerfilUsuario();
      assinarNotificacoesUsuario();
      assinarRecorrenciasContasFixas();
      await carregarConfig();
      assinarMes();
      atualizarLabelsMes();
      irParaTela("inicio");
      $("#carregando").classList.add("hidden");
      $("#tela-login").classList.add("hidden");
      $("#app").classList.remove("hidden");
    } else {
      usuario = null;
      if (unsubParcelas) unsubParcelas();
      if (unsubRecebimentos) unsubRecebimentos();
      if (unsubPerfil) unsubPerfil();
      if (unsubNotificacoes) unsubNotificacoes();
      $("#carregando").classList.add("hidden");
      $("#app").classList.add("hidden");
      $("#tela-login").classList.remove("hidden");
    }
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/mobile/sw.js").catch(() => {});
  }

  ligarEventos();
  observarSaudacao();
});

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

/* ---------- perfil (mesmos dados do site: nome, sobrenome, telefone, foto) ---------- */
let perfilAtual = { nome: "", sobrenome: "", telefone: "", fotoUrl: null };
let unsubPerfil = null;

function iniciaisPerfil() {
  const primeira = perfilAtual.nome.trim().charAt(0);
  const segunda = perfilAtual.sobrenome.trim().charAt(0);
  const iniciais = (primeira + segunda).toUpperCase();
  if (iniciais) return iniciais;
  if (usuario?.email) return usuario.email[0].toUpperCase();
  return "U";
}

function atualizarAvatarTopbar() {
  const el = $("#topbar-avatar");
  el.innerHTML = perfilAtual.fotoUrl
    ? `<img src="${perfilAtual.fotoUrl}" alt="Foto de perfil">`
    : iniciaisPerfil();
}

function atualizarSaudacao() {
  $("#saudacao-nome").textContent = perfilAtual.nome ? `Olá, ${perfilAtual.nome}!` : "Olá!";
}

function assinarPerfilUsuario() {
  if (unsubPerfil) unsubPerfil();
  unsubPerfil = onSnapshot(doc(bd, "usuarios", usuario.uid), (snap) => {
    const d = snap.data();
    perfilAtual = {
      nome: d?.nome ?? "",
      sobrenome: d?.sobrenome ?? "",
      telefone: d?.telefone ?? "",
      fotoUrl: d?.fotoUrl ?? null,
    };
    filtrosDashboardAtuais = d?.filtrosDashboard ?? {};
    atualizarAvatarTopbar();
    atualizarSaudacao();
    if (!$("#tela-perfil").classList.contains("hidden")) preencherFormPerfil();
    renderInicio();
  });
}

// Formas de pagamento marcadas/desmarcadas no mini-dashboard do site (Contas a pagar) e
// contas fixas (recorrências): usadas para reproduzir com fidelidade o Subtotal/Provisão
// Líquido da Janela de 10 meses do site na tela Início do app.
function assinarRecorrenciasContasFixas() {
  if (unsubRecorrenciasPagar) unsubRecorrenciasPagar();
  const qPagar = query(collection(bd, "usuarios", usuario.uid, "recorrencias"), where("tipo", "==", "pagar"));
  unsubRecorrenciasPagar = onSnapshot(qPagar, (snap) => {
    recorrenciasPagarAtuais = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderInicio();
  });

  if (unsubRecorrenciasReceber) unsubRecorrenciasReceber();
  const qReceber = query(collection(bd, "usuarios", usuario.uid, "recorrencias"), where("tipo", "==", "receber"));
  unsubRecorrenciasReceber = onSnapshot(qReceber, (snap) => {
    recorrenciasReceberAtuais = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderInicio();
  });
}

function preencherFormPerfil() {
  $("#pf-nome").value = perfilAtual.nome;
  $("#pf-sobrenome").value = perfilAtual.sobrenome;
  $("#pf-telefone").value = perfilAtual.telefone;
  $("#pf-avatar").innerHTML = perfilAtual.fotoUrl
    ? `<img src="${perfilAtual.fotoUrl}" alt="Foto de perfil">`
    : iniciaisPerfil();
  mostrarMsg("#msg-perfil", "", "");
}

async function salvarPerfil() {
  const nome = $("#pf-nome").value.trim();
  const sobrenome = $("#pf-sobrenome").value.trim();
  const telefone = $("#pf-telefone").value.trim();

  $("#btn-salvar-perfil").disabled = true;
  try {
    await updateDoc(doc(bd, "usuarios", usuario.uid), { nome, sobrenome, telefone });
    irParaTela(telaAnterior);
  } catch {
    mostrarMsg("#msg-perfil", "Não foi possível salvar. Tente novamente.", "erro");
  }
  $("#btn-salvar-perfil").disabled = false;
}

async function redimensionarFotoPerfil(arquivo) {
  const bitmap = await createImageBitmap(arquivo);
  const TAMANHO_MAX = 256;
  const escala = Math.min(1, TAMANHO_MAX / Math.max(bitmap.width, bitmap.height));
  const largura = Math.round(bitmap.width * escala);
  const altura = Math.round(bitmap.height * escala);

  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const contexto = canvas.getContext("2d");
  contexto.drawImage(bitmap, 0, 0, largura, altura);
  return canvas.toDataURL("image/jpeg", 0.8);
}

async function salvarFotoPerfil(arquivo) {
  const texto = $("#pf-label-foto-texto");
  texto.textContent = "Enviando...";
  try {
    const dataUrl = await redimensionarFotoPerfil(arquivo);
    await updateDoc(doc(bd, "usuarios", usuario.uid), { fotoUrl: dataUrl });
  } catch {
    mostrarMsg("#msg-perfil", "Não foi possível enviar a foto. Tente novamente.", "erro");
  }
  texto.textContent = "Alterar foto";
}

/* ---------- notificações (mesmas do sistema web: lançamentos compartilhados/solicitações) ---------- */
// Só leitura no mobile: ver e excluir. Sem aceitar/recusar (isso continua só no site).
function formatarQuandoNotificacao(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutos = Math.floor(diffMs / 60000);
  if (minutos < 1) return "agora";
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas}h`;
  const dias = Math.floor(horas / 24);
  return `há ${dias}d`;
}

function assinarNotificacoesUsuario() {
  if (unsubNotificacoes) unsubNotificacoes();
  const q = query(collection(bd, "notificacoes"), where("uidDestino", "==", usuario.uid));
  unsubNotificacoes = onSnapshot(q, (snap) => {
    notificacoesAtuais = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
    renderNotificacoes();
  });
}

function renderNotificacoes() {
  const naoLidas = notificacoesAtuais.filter((n) => !n.lida).length;
  const badge = $("#badge-sino");
  badge.textContent = naoLidas > 9 ? "9+" : String(naoLidas);
  badge.classList.toggle("hidden", naoLidas === 0);

  const lista = $("#lista-notificacoes");
  if (notificacoesAtuais.length === 0) {
    lista.innerHTML = `<div class="notif-vazio">Nenhuma notificação.</div>`;
    return;
  }
  lista.innerHTML = notificacoesAtuais
    .map(
      (n) => `
    <div class="notif-item ${n.lida ? "" : "nao-lida"}" data-id="${n.id}">
      <div class="notif-corpo">
        <div class="notif-msg">${esc(n.mensagem)}</div>
        <div class="notif-quando">${formatarQuandoNotificacao(n.criadoEm)}</div>
      </div>
      <button type="button" class="btn-excluir-notif" data-acao="excluir" aria-label="Excluir notificação">✕</button>
    </div>`
    )
    .join("");
  lista.querySelectorAll(".btn-excluir-notif").forEach((btn) => {
    btn.onclick = () => {
      const id = btn.closest(".notif-item").dataset.id;
      deleteDoc(doc(bd, "notificacoes", id));
    };
  });
}

async function limparTodasNotificacoes() {
  const batch = writeBatch(bd);
  notificacoesAtuais.forEach((n) => batch.delete(doc(bd, "notificacoes", n.id)));
  await batch.commit();
}

/* ---------- config (grupos / aplicações) ---------- */
// Mesmos valores padrão de CONFIG_PADRAO em src/lib/config.ts: se o documento de
// configuração do usuário não tiver grupos/aplicações definidos (ou não existir
// ainda), o site usa esses valores-semente — o mobile precisa fazer o mesmo,
// senão os campos ficam com o <select> vazio (parecendo que "sumiram").
const GRUPOS_PADRAO = ["Fixas", "Cartão de Crédito", "Provisões", "Outros"];
const APLICACOES_PADRAO = ["Alimentação", "Moradia", "Transporte", "Saúde", "Lazer", "Assinaturas", "Parcelamentos", "Outros"];

async function carregarConfig() {
  try {
    const snap = await getDoc(doc(bd, "usuarios", usuario.uid, "config", "listas"));
    const d = snap.exists() ? snap.data() : {};
    configListas = {
      grupos: d.grupos ?? GRUPOS_PADRAO,
      aplicacoes: d.aplicacoes ?? APLICACOES_PADRAO,
      comp: d.comp ?? [],
      modoTotalizador: d.modoTotalizador ?? "todos",
    };
  } catch {
    configListas = { grupos: GRUPOS_PADRAO, aplicacoes: APLICACOES_PADRAO, comp: [], modoTotalizador: "todos" };
  }
  renderInicio();
  $("#fp-grupo").innerHTML = configListas.grupos.map((g) => `<option value="${esc(g)}">${esc(g)}</option>`).join("");
  $("#fp-aplicacao").innerHTML = configListas.aplicacoes.map((a) => `<option value="${esc(a)}">${esc(a)}</option>`).join("");

  const compDisponiveis = configListas.comp.filter((c) => c.ativo !== false);
  $("#fp-comp-wrap").classList.toggle("hidden", compDisponiveis.length === 0);
  $("#fp-comp").innerHTML =
    `<option value="">Nenhum</option>` +
    compDisponiveis.map((c) => `<option value="${esc(c.nome)}">${esc(c.nome)}</option>`).join("");
}

/* ---------- assinatura do mês (parcelas + recebimentos) ---------- */
function assinarMes() {
  if (unsubParcelas) unsubParcelas();
  if (unsubRecebimentos) unsubRecebimentos();

  const qParcelas = query(
    collection(bd, "usuarios", usuario.uid, "parcelas"),
    where("vencimento", ">=", `${ym}-01`),
    where("vencimento", "<=", `${ym}-31`),
    orderBy("vencimento")
  );
  unsubParcelas = onSnapshot(qParcelas, (snap) => {
    parcelasAtuais = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderInicio();
    renderPagar();
  });

  const qRecebimentos = query(
    collection(bd, "usuarios", usuario.uid, "recebimentos"),
    where("recebimento", ">=", `${ym}-01`),
    where("recebimento", "<=", `${ym}-31`),
    orderBy("recebimento")
  );
  unsubRecebimentos = onSnapshot(qRecebimentos, (snap) => {
    recebimentosAtuais = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderInicio();
    renderReceber();
  });
}

function mudarMes(delta) {
  ym = somarMesesYM(ym, delta);
  atualizarLabelsMes();
  assinarMes();
}

function irParaMesEscolhido(novoYm) {
  if (!novoYm || novoYm === ym) return;
  ym = novoYm;
  atualizarLabelsMes();
  assinarMes();
}

function atualizarLabelsMes() {
  const label = formatarMesAno(ym);
  ["inicio", "pagar", "receber"].forEach((t) => {
    $(`#mes-atual-${t}`).textContent = label;
  });
}

/* ---------- seletor de mês/ano (customizado, sem depender do calendário do aparelho) ---------- */
const NOMES_MESES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];
let anoNoSeletor = new Date().getFullYear();

function renderSeletorMes() {
  $("#ano-atual").textContent = String(anoNoSeletor);
  const [anoSelecionado, mesSelecionado] = ym.split("-").map(Number);
  $("#grade-meses").innerHTML = NOMES_MESES.map((nome, indice) => {
    const selecionado = anoNoSeletor === anoSelecionado && indice + 1 === mesSelecionado;
    return `<button type="button" class="${selecionado ? "mes-selecionado" : ""}" data-mes="${indice + 1}">${nome}</button>`;
  }).join("");
  $("#grade-meses").querySelectorAll("button").forEach((btn) => {
    btn.onclick = () => {
      const mes = String(btn.dataset.mes).padStart(2, "0");
      irParaMesEscolhido(`${anoNoSeletor}-${mes}`);
      fecharSeletorMes();
    };
  });
}

function abrirSeletorMes() {
  anoNoSeletor = Number(ym.split("-")[0]);
  renderSeletorMes();
  $("#overlay-mes").classList.remove("hidden");
}

function fecharSeletorMes() {
  $("#overlay-mes").classList.add("hidden");
}

/* ---------- resumo (Início) ---------- */
// Mesmas cores de status do site (src/app/(app)/inicio/page.tsx):
// total sempre vermelho, pago sempre verde, pendente sempre vermelho,
// recebimentos verde (ou âmbar se ainda falta receber) e líquido conforme o sinal.
let valoresVisiveis = false;

function mascarar(texto) {
  return valoresVisiveis ? texto : "••••••";
}

function renderInicio() {
  // Reproduz src/app/(app)/inicio/page.tsx: os cartões (Total/Pago/Pendente/Líquido) e a
  // linha "Provisão Líquido" da Janela de 10 meses do site contam também as contas fixas
  // (recorrências) ainda não materializadas no mês, não só os lançamentos reais já gravados.
  const parcelasMescladas = mesclarComRecorrencias(parcelasAtuais, recorrenciasPagarAtuais, ym);
  const parcelasVisiveis = parcelasMescladas.filter((p) => filtrosDashboardAtuais[p.grupo] !== false);
  const baseTotais = configListas.modoTotalizador === "visiveis" ? parcelasVisiveis : parcelasMescladas;

  const total = baseTotais.reduce((s, p) => s + p.valorParcela, 0);
  const pago = baseTotais.filter((p) => p.pago).reduce((s, p) => s + p.valorParcela, 0);
  const pendente = total - pago;
  const totalAReceber = recebimentosAtuais.reduce((s, r) => s + r.valor, 0);
  const totalRecebido = recebimentosAtuais.filter((r) => r.recebido).reduce((s, r) => s + r.valor, 0);
  const liquido = totalRecebido - total;
  const faltaReceber = totalRecebido < totalAReceber;

  const elTotal = $("#r-total");
  elTotal.textContent = mascarar(formatarMoeda(total));
  elTotal.className = "valor negativo";

  const elRecebido = $("#r-recebido");
  elRecebido.textContent = mascarar(formatarMoeda(totalRecebido));
  elRecebido.className = `valor ${faltaReceber ? "amber" : "positivo"}`;

  const elPago = $("#r-pago");
  elPago.textContent = mascarar(formatarMoeda(pago));
  elPago.className = "valor positivo";

  const elPendente = $("#r-pendente");
  elPendente.textContent = mascarar(formatarMoeda(pendente));
  elPendente.className = "valor negativo";

  const elLiquido = $("#r-liquido");
  elLiquido.textContent = mascarar(formatarMoeda(liquido));
  elLiquido.className = `valor ${liquido < 0 ? "negativo" : liquido === 0 ? "" : "positivo"}`;

  // Provisão Líquido: mesma conta da linha "Provisão Líquido" na Janela de 10 meses do site
  // (aReceberPorMes - subtotalGastosPorMes) — sempre considera só as formas de pagamento
  // visíveis no dashboard, mais a projeção de recebimentos recorrentes e reembolsos de
  // contas fixas com reembolso configurado que ainda não viraram lançamentos reais.
  const subtotalGastosVisiveis = parcelasVisiveis.reduce((s, p) => s + p.valorParcela, 0);

  const idsReembolsoJaMaterializado = new Set(
    recebimentosAtuais.filter((r) => r.origemComp).map((r) => r.lancamentoId)
  );
  const idsRecorrenciaReceberMaterializada = new Set(
    recebimentosAtuais.filter((r) => r.recorrenciaId).map((r) => r.recorrenciaId)
  );
  const modoPorNomeComp = Object.fromEntries((configListas.comp ?? []).map((c) => [c.nome, c.modo]));

  let aReceberProjetado = totalAReceber;
  for (const rec of recorrenciasReceberAtuais) {
    if (ativaNoMes(rec, ym) && !idsRecorrenciaReceberMaterializada.has(rec.id)) {
      aReceberProjetado += valorNoMes(rec, ym);
    }
  }
  for (const rec of recorrenciasPagarAtuais) {
    if (!rec.comp || !ativaNoMes(rec, ym)) continue;
    if (idsReembolsoJaMaterializado.has(rec.id)) continue;
    const modo = modoPorNomeComp[rec.comp];
    if (!modo || modo === "nenhum") continue;
    const valor = valorNoMes(rec, ym);
    aReceberProjetado += modo === "metade" ? valor / 2 : valor;
  }

  const provisaoLiquido = aReceberProjetado - subtotalGastosVisiveis;
  const elProvisaoLiquido = $("#r-provisao-liquido");
  elProvisaoLiquido.textContent = mascarar(formatarMoeda(provisaoLiquido));
  elProvisaoLiquido.className = `valor ${provisaoLiquido < 0 ? "negativo" : provisaoLiquido === 0 ? "" : "positivo"}`;

  $("#card-dashboard-aplicacoes").classList.toggle("hidden", !valoresVisiveis);

  renderDashboardAplicacoes(parcelasVisiveis);
}

/* ---------- dashboard: aplicações dos lançamentos ---------- */
// Mesma paleta e mesma lógica de atribuição de cor (por posição na lista
// configurada de aplicações) usadas em DashboardFormaPagamento.tsx no site,
// para que cada aplicação sempre apareça com a mesma cor nos dois lugares.
const PALETA_CATEGORICA_DARK = [
  "#3987e5", "#008300", "#d55181", "#c98500",
  "#199e70", "#d95926", "#9085e9", "#e66767",
];

function montarItensAplicacao(soma, ordem) {
  const copia = new Map(soma);
  const itens = [];
  let indice = 0;

  ordem.forEach((nome) => {
    const valor = copia.get(nome);
    if (!valor) return;
    itens.push({ nome, valor, cor: PALETA_CATEGORICA_DARK[indice % PALETA_CATEGORICA_DARK.length] });
    indice++;
    copia.delete(nome);
  });

  for (const [nome, valor] of copia) {
    itens.push({ nome, valor, cor: PALETA_CATEGORICA_DARK[indice % PALETA_CATEGORICA_DARK.length] });
    indice++;
  }

  return itens.sort((a, b) => b.valor - a.valor);
}

function renderDashboardAplicacoes(parcelas) {
  const barra = $("#barra-aplicacoes");
  const lista = $("#lista-aplicacoes");

  const soma = new Map();
  for (const p of parcelas) {
    soma.set(p.aplicacao, (soma.get(p.aplicacao) || 0) + p.valorParcela);
  }
  const itens = montarItensAplicacao(soma, configListas.aplicacoes);

  if (itens.length === 0) {
    barra.innerHTML = "";
    lista.innerHTML = `<div class="dash-vazio">Nenhum lançamento neste mês.</div>`;
    return;
  }

  const total = itens.reduce((s, i) => s + i.valor, 0);

  barra.innerHTML = itens
    .map((i) => `<span style="width:${total > 0 ? (i.valor / total) * 100 : 0}%; background:${i.cor}"></span>`)
    .join("");

  lista.innerHTML = itens
    .map(
      (i) => `
    <div class="item-aplicacao">
      <span class="dot" style="background:${i.cor}"></span>
      <span class="nome">${esc(i.nome)}</span>
      <span class="valor">${formatarMoeda(i.valor)}</span>
      <span class="percentual">${total > 0 ? Math.round((i.valor / total) * 100) : 0}%</span>
    </div>`
    )
    .join("");
}

/* ---------- filtros (chips de seleção única) ---------- */
function renderChips(seletorContainer, valores, valorAtivo, aoSelecionar) {
  const cont = $(seletorContainer);
  if (valores.length < 2) {
    cont.innerHTML = "";
    return;
  }
  cont.innerHTML = valores
    .map((v) => `<button class="chip ${v === valorAtivo ? "ativo" : ""}" data-valor="${esc(v)}">${esc(v)}</button>`)
    .join("");
  cont.querySelectorAll(".chip").forEach((btn) => {
    btn.onclick = () => aoSelecionar(btn.dataset.valor === valorAtivo ? null : btn.dataset.valor);
  });
}

/* ---------- lista Pagar ---------- */
function renderPagar() {
  const gruposDoMes = [...new Set(parcelasAtuais.map((p) => p.grupo))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  renderChips("#filtros-pagar", gruposDoMes, filtroGrupoPagar, (valor) => {
    filtroGrupoPagar = valor;
    renderPagar();
  });

  const itens = filtroGrupoPagar ? parcelasAtuais.filter((p) => p.grupo === filtroGrupoPagar) : parcelasAtuais;

  const somaItens = itens.reduce((s, p) => s + p.valorParcela, 0);
  $("#resumo-pagar").textContent = itens.length
    ? `${itens.length} lançamento${itens.length > 1 ? "s" : ""} · ${formatarMoeda(somaItens)}`
    : "";

  const lista = $("#lista-pagar");
  if (!itens.length) {
    lista.innerHTML = `<div class="vazio">Nenhum lançamento neste mês.</div>`;
    return;
  }
  lista.innerHTML = itens
    .map(
      (p) => `
    <div class="item ${p.pago ? "pago" : ""}" data-id="${p.id}">
      <div class="info">
        <div class="nome">${esc(p.credor)}</div>
        <div class="detalhe"><span>${formatarDataBR(p.vencimento)}</span><span>·</span><span>${esc(p.grupo)}</span>${p.parcelaTotal > 1 ? `<span>· ${p.parcelaNum}/${p.parcelaTotal}</span>` : ""}</div>
      </div>
      <div class="valor">${formatarMoeda(p.valorParcela)}</div>
      <button class="chk" data-acao="pagar">✓</button>
    </div>`
    )
    .join("");
  lista.querySelectorAll(".chk").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const id = btn.closest(".item").dataset.id;
      const parcela = parcelasAtuais.find((p) => p.id === id);
      marcarPago(parcela);
    };
  });
  lista.querySelectorAll(".item").forEach((el) => {
    el.onclick = () => {
      const parcela = parcelasAtuais.find((p) => p.id === el.dataset.id);
      abrirDetalhePagar(parcela);
    };
  });
}

async function marcarPago(parcela) {
  const novoValor = !parcela.pago;
  await updateDoc(doc(bd, "usuarios", usuario.uid, "parcelas", parcela.id), {
    pago: novoValor,
    pagoEm: novoValor ? hojeISO() : null,
  });
}

/* ---------- lista Receber ---------- */
function renderReceber() {
  const origensDoMes = [...new Set(recebimentosAtuais.map((r) => r.origem))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  renderChips("#filtros-receber", origensDoMes, filtroOrigemReceber, (valor) => {
    filtroOrigemReceber = valor;
    renderReceber();
  });

  const itens = filtroOrigemReceber ? recebimentosAtuais.filter((r) => r.origem === filtroOrigemReceber) : recebimentosAtuais;

  const somaItens = itens.reduce((s, r) => s + r.valor, 0);
  $("#resumo-receber").textContent = itens.length
    ? `${itens.length} recebimento${itens.length > 1 ? "s" : ""} · ${formatarMoeda(somaItens)}`
    : "";

  const lista = $("#lista-receber");
  if (!itens.length) {
    lista.innerHTML = `<div class="vazio">Nenhum recebimento neste mês.</div>`;
    return;
  }
  lista.innerHTML = itens
    .map(
      (r) => `
    <div class="item ${r.recebido ? "recebido" : ""}" data-id="${r.id}">
      <div class="info">
        <div class="nome">${esc(r.origem)}</div>
        <div class="detalhe"><span>${formatarDataBR(r.recebimento)}</span>${r.qtdParcelas > 1 ? `<span>· ${esc(r.parcela)}</span>` : ""}</div>
      </div>
      <div class="valor">${formatarMoeda(r.valor)}</div>
      <button class="chk" data-acao="receber">✓</button>
    </div>`
    )
    .join("");
  lista.querySelectorAll(".chk").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const id = btn.closest(".item").dataset.id;
      const receb = recebimentosAtuais.find((r) => r.id === id);
      marcarRecebido(receb);
    };
  });
  lista.querySelectorAll(".item").forEach((el) => {
    el.onclick = () => {
      const receb = recebimentosAtuais.find((r) => r.id === el.dataset.id);
      abrirDetalheReceber(receb);
    };
  });
}

async function marcarRecebido(receb) {
  await updateDoc(doc(bd, "usuarios", usuario.uid, "recebimentos", receb.id), {
    recebido: !receb.recebido,
  });
}

/* ---------- chave (valor total / valor da parcela) ---------- */
function ligarChave(idBotao, idLabel) {
  const botao = $(idBotao);
  botao.onclick = () => {
    const ligada = botao.getAttribute("aria-checked") !== "true";
    botao.setAttribute("aria-checked", String(ligada));
    botao.classList.toggle("ligada", ligada);
    $(idLabel).textContent = ligada ? "Valor da parcela *" : "Valor total *";
  };
}
function chaveLigada(idBotao) {
  return $(idBotao).getAttribute("aria-checked") === "true";
}
function resetarChave(idBotao, idLabel) {
  const botao = $(idBotao);
  botao.setAttribute("aria-checked", "false");
  botao.classList.remove("ligada");
  $(idLabel).textContent = "Valor total *";
}

/* ---------- recorrências (conta fixa) — mesma lógica de src/lib/recorrencias.ts ---------- */
async function criarRecorrencia(uid, dados) {
  const [, , dia] = dados.inicio.split("-").map(Number);
  await addDoc(collection(bd, "usuarios", uid, "recorrencias"), {
    tipo: dados.tipo,
    credor: dados.credor,
    observacao: dados.observacao || null,
    valorAtual: dados.valor,
    comp: dados.comp || null,
    grupo: dados.grupo || null,
    aplicacao: dados.aplicacao || null,
    diaVencimento: dia,
    inicio: dados.inicio,
    fim: null,
    historicoValores: [{ valor: dados.valor, desde: dados.inicio }],
    provisao: dados.provisao === true,
  });
}

/* ---------- reembolso — mesma lógica de sincronizarReembolso em src/lib/recebimentos.ts ---------- */
async function sincronizarReembolso(uid, dados) {
  if (!dados.compNome) return;

  const configSnap = await getDoc(doc(bd, "usuarios", uid, "config", "listas"));
  const itemComp = (configSnap.data()?.comp || []).find((c) => c.nome === dados.compNome);
  if (!itemComp || itemComp.modo === "nenhum") return;

  const valorReembolso = itemComp.modo === "metade" ? dados.valorTotal / 2 : dados.valorTotal;
  const valores = dividirValor(valorReembolso, dados.parcelaTotal);

  const batch = writeBatch(bd);
  const recebimentosRef = collection(bd, "usuarios", uid, "recebimentos");
  valores.forEach((valorParcela, indice) => {
    const ref = doc(recebimentosRef);
    batch.set(ref, {
      lancamentoId: dados.lancamentoId,
      origem: dados.compNome,
      valor: valorParcela,
      recebimento: somarMeses(dados.dataInicio, indice),
      qtdParcelas: dados.parcelaTotal,
      parcela: `${indice + 1}/${dados.parcelaTotal}`,
      observacao: dados.observacao,
      recebido: false,
      origemComp: true,
      formaPagamentoOrigem: dados.grupoOrigem,
      provisao: dados.provisao === true,
      criadoEm: serverTimestamp(),
    });
  });
  await batch.commit();
}

/* ---------- criar lançamento (Pagar) ---------- */
async function salvarLancamento() {
  const credor = $("#fp-credor").value.trim();
  const dataCompra = $("#fp-data").value || hojeISO();
  const inicioCobranca = $("#fp-inicio").value || somarMeses(hojeISO(), 1);
  const valorDigitado = paraNumero($("#fp-valor").value);
  const contaFixa = $("#fp-conta-fixa").checked;
  const provisao = $("#fp-provisao").checked;
  const parcelaTotal = contaFixa ? 1 : Math.max(1, parseInt($("#fp-parcelas").value || "1", 10));
  const valorPorParcela = chaveLigada("#fp-chave-valor");
  const valorTotal = valorPorParcela ? valorDigitado * parcelaTotal : valorDigitado;
  const grupo = $("#fp-grupo").value;
  const aplicacao = $("#fp-aplicacao").value;
  const comp = $("#fp-comp").value || null;
  const observacao = $("#fp-observacao").value.trim();

  // Mesmas obrigatoriedades do site (FormularioLancamento.tsx com observacaoObrigatoria em /lancar).
  if (!credor || !dataCompra || !inicioCobranca || !observacao) {
    return mostrarMsg("#msg-pagar", "Preencha todos os campos obrigatórios.", "erro");
  }
  if (!grupo || !aplicacao) return mostrarMsg("#msg-pagar", "Configure grupos e categorias pelo site primeiro.", "erro");
  if (!(valorTotal > 0)) return mostrarMsg("#msg-pagar", "Informe um valor total válido.", "erro");
  if (!contaFixa && !(parcelaTotal >= 1)) return mostrarMsg("#msg-pagar", "O número de parcelas deve ser pelo menos 1.", "erro");

  $("#btn-salvar-pagar").disabled = true;
  try {
    if (contaFixa) {
      await criarRecorrencia(usuario.uid, {
        tipo: "pagar",
        credor,
        observacao,
        valor: valorTotal,
        grupo,
        aplicacao,
        inicio: inicioCobranca,
        provisao,
      });
    } else {
      const lancamentoId = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
      const valores = valorPorParcela ? new Array(parcelaTotal).fill(valorDigitado) : dividirValor(valorTotal, parcelaTotal);
      const batch = writeBatch(bd);
      const colecao = collection(bd, "usuarios", usuario.uid, "parcelas");
      valores.forEach((valorParcela, i) => {
        const ref = doc(colecao);
        batch.set(ref, {
          lancamentoId,
          credor,
          dataCompra,
          observacao: observacao || null,
          valorTotal,
          parcelaNum: i + 1,
          parcelaTotal,
          valorParcela,
          comp,
          grupo,
          aplicacao,
          vencimento: somarMeses(inicioCobranca, i),
          pago: false,
          pagoEm: null,
          provisao,
          criadoEm: serverTimestamp(),
        });
      });
      await batch.commit();
      await sincronizarReembolso(usuario.uid, {
        lancamentoId,
        compNome: comp,
        observacao: observacao || null,
        valorTotal,
        parcelaTotal,
        dataInicio: inicioCobranca,
        grupoOrigem: grupo,
        provisao,
      });
    }
    irParaTela(telaAnterior);
    limparFormularioPagar();
  } catch {
    mostrarMsg("#msg-pagar", "Não foi possível salvar. Tente novamente.", "erro");
  }
  $("#btn-salvar-pagar").disabled = false;
}

function limparFormularioPagar() {
  $("#fp-credor").value = "";
  $("#fp-data").value = "";
  $("#fp-inicio").value = "";
  $("#fp-valor").value = "";
  $("#fp-parcelas").value = "1";
  $("#fp-observacao").value = "";
  resetarChave("#fp-chave-valor", "#fp-valor-label");
  $("#fp-conta-fixa").checked = false;
  $("#fp-provisao").checked = false;
  $("#fp-parcelas").disabled = false;
  $("#fp-legenda-conta-fixa").classList.add("hidden");
  $("#fp-legenda-provisao").classList.add("hidden");
  $("#fp-comp").value = "";
  mostrarMsg("#msg-pagar", "", "");
}

/* ---------- criar recebimento (Receber) ---------- */
async function salvarRecebimento() {
  const origem = $("#fr-origem").value.trim();
  const valor = paraNumero($("#fr-valor").value);
  const contaFixa = $("#fr-conta-fixa").checked;
  const parcelaTotal = contaFixa ? 1 : Math.max(1, parseInt($("#fr-parcelas").value || "1", 10));
  const valorPorParcela = chaveLigada("#fr-chave-valor");
  const dataRecebimento = $("#fr-data").value || hojeISO();
  const observacao = $("#fr-observacao").value.trim();

  // Mesmas obrigatoriedades do site (src/app/(app)/receber/page.tsx): Origem, Valor,
  // Parcelas e 1ª data são obrigatórios; Observação é opcional.
  if (!origem || !dataRecebimento) return mostrarMsg("#msg-receber", "Preencha origem e data.", "erro");
  if (!(valor > 0)) return mostrarMsg("#msg-receber", "Informe um valor total válido.", "erro");
  if (!contaFixa && !(parcelaTotal >= 1)) return mostrarMsg("#msg-receber", "O número de parcelas deve ser pelo menos 1.", "erro");

  $("#btn-salvar-receber").disabled = true;
  try {
    if (contaFixa) {
      await criarRecorrencia(usuario.uid, {
        tipo: "receber",
        credor: origem,
        observacao,
        valor,
        inicio: dataRecebimento,
      });
    } else {
      const lancamentoId = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
      const valores = valorPorParcela ? new Array(parcelaTotal).fill(valor) : dividirValor(valor, parcelaTotal);
      const batch = writeBatch(bd);
      const colecao = collection(bd, "usuarios", usuario.uid, "recebimentos");
      valores.forEach((valorParcela, i) => {
        const ref = doc(colecao);
        batch.set(ref, {
          lancamentoId,
          origem,
          valor: valorParcela,
          recebimento: somarMeses(dataRecebimento, i),
          qtdParcelas: parcelaTotal,
          parcela: `${i + 1}/${parcelaTotal}`,
          observacao: observacao || null,
          recebido: false,
          criadoEm: serverTimestamp(),
        });
      });
      await batch.commit();
    }
    irParaTela(telaAnterior);
    limparFormularioReceber();
  } catch {
    mostrarMsg("#msg-receber", "Não foi possível salvar. Tente novamente.", "erro");
  }
  $("#btn-salvar-receber").disabled = false;
}

function limparFormularioReceber() {
  $("#fr-origem").value = "";
  $("#fr-valor").value = "";
  $("#fr-parcelas").value = "1";
  resetarChave("#fr-chave-valor", "#fr-valor-label");
  $("#fr-conta-fixa").checked = false;
  $("#fr-parcelas").disabled = false;
  $("#fr-legenda-conta-fixa").classList.add("hidden");
  $("#fr-data").value = "";
  $("#fr-observacao").value = "";
  mostrarMsg("#msg-receber", "", "");
}

/* ---------- navegação / painel ---------- */
const TODAS_AS_TELAS = [
  "inicio", "pagar", "receber", "detalhe", "configuracoes",
  "novo-pagar", "novo-receber", "perfil", "notificacoes",
];

function telaAtualPrincipal() {
  for (const t of ["inicio", "pagar", "receber", "configuracoes"]) {
    if (!$(`#tela-${t}`).classList.contains("hidden")) return t;
  }
  return "inicio";
}

const TITULOS_TELA_PRINCIPAL = {
  inicio: "Início",
  pagar: "Lançamentos",
  receber: "Recebimentos",
  configuracoes: "Configurações",
};

function irParaTela(nome) {
  TODAS_AS_TELAS.forEach((t) => {
    $(`#tela-${t}`).classList.toggle("hidden", t !== nome);
  });
  document.querySelectorAll(".menu-item").forEach((item) => {
    item.classList.toggle("ativa", item.dataset.tela === nome);
  });
  $("#topbar-titulo").textContent = TITULOS_TELA_PRINCIPAL[nome] ?? "Início";
  $("#btn-menu").classList.remove("modo-voltar");
}

// Telas cheias que se abrem "por cima" (detalhe, novo lançamento/recebimento):
// guardam de onde vieram em telaAnterior e mostram a seta de voltar na topbar.
function mostrarTelaCheia(nome, titulo) {
  TODAS_AS_TELAS.forEach((t) => {
    $(`#tela-${t}`).classList.toggle("hidden", t !== nome);
  });
  $("#topbar-titulo").textContent = titulo;
  $("#btn-menu").classList.add("modo-voltar");
}

/* ---------- tela de detalhes (lançamento ou recebimento) ---------- */
function linhaDetalhe(rotulo, valor) {
  return `<div class="detalhe-linha"><span class="rotulo">${esc(rotulo)}</span><span class="valor-detalhe">${esc(String(valor))}</span></div>`;
}

function abrirDetalhePagar(p) {
  telaAnterior = "pagar";
  $("#detalhe-conteudo").innerHTML =
    `<div class="detalhe-titulo-credor">${esc(p.credor)}</div>` +
    [
      ["Valor da parcela", formatarMoeda(p.valorParcela)],
      ["Valor total", formatarMoeda(p.valorTotal)],
      ["Parcela", p.parcelaTotal > 1 ? `${p.parcelaNum}/${p.parcelaTotal}` : "Única"],
      ["Vencimento", formatarDataBR(p.vencimento)],
      ["Forma de pagamento", p.grupo],
      ["Categoria", p.aplicacao],
      ["Status", p.pago ? "Pago" : "Pendente"],
      ["Observação", p.observacao || "—"],
    ]
      .map(([rotulo, valor]) => linhaDetalhe(rotulo, valor))
      .join("");
  mostrarTelaCheia("detalhe", "Detalhes");
}

function abrirDetalheReceber(r) {
  telaAnterior = "receber";
  $("#detalhe-conteudo").innerHTML =
    `<div class="detalhe-titulo-credor">${esc(r.origem)}</div>` +
    [
      ["Valor", formatarMoeda(r.valor)],
      ["Parcela", r.qtdParcelas > 1 ? r.parcela : "Única"],
      ["Data do recebimento", formatarDataBR(r.recebimento)],
      ["Status", r.recebido ? "Recebido" : "Pendente"],
      ["Observação", r.observacao || "—"],
    ]
      .map(([rotulo, valor]) => linhaDetalhe(rotulo, valor))
      .join("");
  mostrarTelaCheia("detalhe", "Detalhes");
}

/* ---------- telas novo lançamento / novo recebimento (tela cheia) ---------- */
function abrirTelaNovoPagar(origem) {
  telaAnterior = origem;
  if (!$("#fp-data").value) {
    $("#fp-data").value = hojeISO();
    $("#fp-inicio").value = somarMeses(hojeISO(), 1);
  }
  mostrarTelaCheia("novo-pagar", "Novo lançamento");
}

function abrirTelaNovoReceber(origem) {
  telaAnterior = origem;
  if (!$("#fr-data").value) {
    $("#fr-data").value = hojeISO();
  }
  mostrarTelaCheia("novo-receber", "Novo recebimento");
}

function abrirMenu() {
  $("#menu-lateral").classList.add("aberto");
  $("#overlay-menu").classList.remove("hidden");
}
function fecharMenu() {
  $("#menu-lateral").classList.remove("aberto");
  $("#overlay-menu").classList.add("hidden");
}

/* ---------- mini-menu do "+" na tela Início (escolher pagar ou receber) ---------- */
function alternarFabInicio() {
  const aberto = $("#fab-inicio-dial").classList.toggle("aberto");
  $("#fab-inicio").classList.toggle("aberto", aberto);
  $("#fab-inicio-overlay").classList.toggle("hidden", !aberto);
}
function fecharFabInicio() {
  $("#fab-inicio-dial").classList.remove("aberto");
  $("#fab-inicio").classList.remove("aberto");
  $("#fab-inicio-overlay").classList.add("hidden");
}

/* ---------- tema escuro (opcional, ligado em Configurações) ---------- */
function aplicarTema(escuro) {
  if (escuro) document.documentElement.setAttribute("data-tema", "escuro");
  else document.documentElement.removeAttribute("data-tema");
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", escuro ? "#0e1220" : "#f5f6fa");
}

function abrirPerfil() {
  telaAnterior = telaAtualPrincipal();
  preencherFormPerfil();
  mostrarTelaCheia("perfil", "Meu perfil");
}
function abrirNotificacoes() {
  telaAnterior = telaAtualPrincipal();
  mostrarTelaCheia("notificacoes", "Notificações");
}

// Ao rolar a tela de Início, some suavemente só a saudação — o restante
// (mês/ano, olhinho, cartões) continua visível normalmente. A saudação
// vive dentro do <main> (é ele quem realmente rola), então o observer
// usa o próprio <main> como root em vez da viewport.
function observarSaudacao() {
  const saudacao = document.querySelector("#tela-inicio .saudacao");
  const raiz = document.querySelector("#tela-inicio main");
  if (!saudacao || !raiz || !("IntersectionObserver" in window)) return;
  const observador = new IntersectionObserver(
    ([entrada]) => {
      saudacao.style.opacity = entrada.intersectionRatio < 0.4 ? "0" : "1";
    },
    { root: raiz, threshold: [0, 0.2, 0.4, 0.6, 0.8, 1] }
  );
  observador.observe(saudacao);
}

function ligarEventos() {
  $("#btn-entrar").onclick = entrar;
  $("#login-senha").addEventListener("keydown", (e) => {
    if (e.key === "Enter") entrar();
  });
  $("#btn-esqueci").onclick = esqueciSenha;

  ["inicio", "pagar", "receber"].forEach((t) => {
    $(`#mes-anterior-${t}`).onclick = () => mudarMes(-1);
    $(`#mes-proximo-${t}`).onclick = () => mudarMes(1);
    $(`#mes-atual-${t}`).onclick = abrirSeletorMes;
  });

  $("#ano-anterior").onclick = () => {
    anoNoSeletor--;
    renderSeletorMes();
  };
  $("#ano-proximo").onclick = () => {
    anoNoSeletor++;
    renderSeletorMes();
  };
  $("#overlay-mes").addEventListener("click", (e) => {
    if (e.target.id === "overlay-mes") fecharSeletorMes();
  });

  $("#btn-menu").onclick = () => {
    if ($("#btn-menu").classList.contains("modo-voltar")) {
      irParaTela(telaAnterior);
    } else {
      abrirMenu();
    }
  };
  $("#overlay-menu").onclick = fecharMenu;
  document.querySelectorAll(".menu-item").forEach((item) => {
    item.onclick = () => {
      irParaTela(item.dataset.tela);
      fecharMenu();
    };
  });
  $("#card-total-gastos").onclick = () => irParaTela("pagar");
  $("#card-recebimentos").onclick = () => irParaTela("receber");
  $("#btn-topbar-inicio").onclick = () => irParaTela("inicio");

  const ICONE_OLHO_ABERTO =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="17" height="17"><path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
  const ICONE_OLHO_FECHADO =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="17" height="17"><path d="M3 3l18 18"/><path d="M10.6 5.2A10.6 10.6 0 0 1 12 5c7 0 10.5 7 10.5 7a13.4 13.4 0 0 1-3 3.9M6.5 6.4C3.7 8.1 1.5 12 1.5 12s3.5 7 10.5 7a10.4 10.4 0 0 0 4.6-1"/><path d="M9.9 10a3 3 0 0 0 4.2 4.2"/></svg>';
  $("#btn-olho").onclick = () => {
    valoresVisiveis = !valoresVisiveis;
    $("#btn-olho").innerHTML = valoresVisiveis ? ICONE_OLHO_ABERTO : ICONE_OLHO_FECHADO;
    $("#btn-olho").setAttribute("aria-label", valoresVisiveis ? "Ocultar valores" : "Mostrar valores");
    renderInicio();
  };
  $("#btn-sair").onclick = () => {
    if (confirm("Tem certeza que deseja sair da sua conta?")) {
      fecharMenu();
      signOut(auth);
    }
  };

  $("#fab-pagar").onclick = () => abrirTelaNovoPagar("pagar");
  $("#fab-receber").onclick = () => abrirTelaNovoReceber("receber");
  $("#topbar-avatar").onclick = abrirPerfil;

  $("#fab-inicio").onclick = alternarFabInicio;
  $("#fab-inicio-overlay").onclick = fecharFabInicio;
  document.querySelectorAll(".fab-opcao").forEach((btn) => {
    btn.onclick = () => {
      fecharFabInicio();
      if (btn.dataset.tipo === "pagar") abrirTelaNovoPagar("inicio");
      else abrirTelaNovoReceber("inicio");
    };
  });
  $("#btn-cancelar-pagar").onclick = () => irParaTela(telaAnterior);
  $("#btn-cancelar-receber").onclick = () => irParaTela(telaAnterior);
  $("#btn-cancelar-perfil").onclick = () => irParaTela(telaAnterior);

  $("#topbar-sino").onclick = abrirNotificacoes;
  $("#btn-limpar-notificacoes").onclick = limparTodasNotificacoes;

  const chaveTema = $("#chave-tema-escuro");
  const temaEscuroSalvo = document.documentElement.getAttribute("data-tema") === "escuro";
  chaveTema.setAttribute("aria-checked", String(temaEscuroSalvo));
  chaveTema.classList.toggle("ligada", temaEscuroSalvo);
  chaveTema.onclick = () => {
    const escuro = chaveTema.getAttribute("aria-checked") !== "true";
    chaveTema.setAttribute("aria-checked", String(escuro));
    chaveTema.classList.toggle("ligada", escuro);
    try {
      localStorage.setItem("temaEscuro", String(escuro));
    } catch {
      /* localStorage indisponível (modo privado); tema não será lembrado */
    }
    aplicarTema(escuro);
  };

  $("#btn-salvar-pagar").onclick = salvarLancamento;
  $("#btn-salvar-receber").onclick = salvarRecebimento;
  $("#btn-salvar-perfil").onclick = salvarPerfil;

  $("#pf-telefone").addEventListener("input", (e) => {
    e.target.value = formatarTelefone(e.target.value);
  });
  $("#pf-foto-input").addEventListener("change", (e) => {
    const arquivo = e.target.files?.[0];
    if (arquivo) salvarFotoPerfil(arquivo);
  });

  ligarChave("#fp-chave-valor", "#fp-valor-label");
  ligarChave("#fr-chave-valor", "#fr-valor-label");

  $("#fp-data").addEventListener("change", (e) => {
    $("#fp-inicio").value = somarMeses(e.target.value, 1);
  });

  $("#fp-conta-fixa").addEventListener("change", (e) => {
    $("#fp-legenda-conta-fixa").classList.toggle("hidden", !e.target.checked);
    $("#fp-parcelas").disabled = e.target.checked;
    if (e.target.checked) $("#fp-parcelas").value = "1";
  });
  $("#fp-provisao").addEventListener("change", (e) => {
    $("#fp-legenda-provisao").classList.toggle("hidden", !e.target.checked);
  });
  $("#fr-conta-fixa").addEventListener("change", (e) => {
    $("#fr-legenda-conta-fixa").classList.toggle("hidden", !e.target.checked);
    $("#fr-parcelas").disabled = e.target.checked;
    if (e.target.checked) $("#fr-parcelas").value = "1";
  });
}
