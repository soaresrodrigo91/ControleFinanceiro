import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, doc, getDoc, writeBatch, updateDoc, onSnapshot,
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
function esc(s) {
  return (s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const $ = (s) => document.querySelector(s);

/* ---------- estado ---------- */
let auth = null, bd = null, usuario = null;
let ym = mesAtualYM();
let configListas = { grupos: [], aplicacoes: [] };
let parcelasAtuais = [];
let recebimentosAtuais = [];
let unsubParcelas = null, unsubRecebimentos = null;

/* ---------- inicialização ---------- */
window.addEventListener("DOMContentLoaded", () => {
  const app = initializeApp(FIREBASE_CONFIG);
  auth = getAuth(app);
  bd = getFirestore(app);

  onAuthStateChanged(auth, async (u) => {
    if (u) {
      usuario = u;
      await carregarConfig();
      assinarMes();
      atualizarLabelsMes();
      $("#carregando").classList.add("hidden");
      $("#tela-login").classList.add("hidden");
      $("#app").classList.remove("hidden");
    } else {
      usuario = null;
      if (unsubParcelas) unsubParcelas();
      if (unsubRecebimentos) unsubRecebimentos();
      $("#carregando").classList.add("hidden");
      $("#app").classList.add("hidden");
      $("#tela-login").classList.remove("hidden");
    }
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/mobile/sw.js").catch(() => {});
  }

  ligarEventos();
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

/* ---------- config (grupos / aplicações) ---------- */
async function carregarConfig() {
  try {
    const snap = await getDoc(doc(bd, "usuarios", usuario.uid, "config", "listas"));
    if (snap.exists()) {
      const d = snap.data();
      configListas = { grupos: d.grupos || [], aplicacoes: d.aplicacoes || [] };
    } else {
      configListas = { grupos: [], aplicacoes: [] };
    }
  } catch {
    configListas = { grupos: [], aplicacoes: [] };
  }
  $("#fp-grupo").innerHTML = configListas.grupos.map((g) => `<option value="${esc(g)}">${esc(g)}</option>`).join("");
  $("#fp-aplicacao").innerHTML = configListas.aplicacoes.map((a) => `<option value="${esc(a)}">${esc(a)}</option>`).join("");
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

function atualizarLabelsMes() {
  const label = formatarMesAno(ym);
  $("#mes-atual-inicio").textContent = label;
  $("#mes-atual-pagar").textContent = label;
  $("#mes-atual-receber").textContent = label;
}

/* ---------- resumo (Início) ---------- */
function renderInicio() {
  const total = parcelasAtuais.reduce((s, p) => s + p.valorParcela, 0);
  const pago = parcelasAtuais.filter((p) => p.pago).reduce((s, p) => s + p.valorParcela, 0);
  const pendente = total - pago;
  const totalRecebido = recebimentosAtuais.filter((r) => r.recebido).reduce((s, r) => s + r.valor, 0);
  const liquido = totalRecebido - total;

  $("#r-total").textContent = formatarMoeda(total);
  $("#r-recebido").textContent = formatarMoeda(totalRecebido);
  $("#r-pago").textContent = formatarMoeda(pago);
  $("#r-pendente").textContent = formatarMoeda(pendente);
  const elLiquido = $("#r-liquido");
  elLiquido.textContent = formatarMoeda(liquido);
  elLiquido.className = `valor ${liquido >= 0 ? "positivo" : "negativo"}`;
}

/* ---------- lista Pagar ---------- */
function renderPagar() {
  const lista = $("#lista-pagar");
  if (!parcelasAtuais.length) {
    lista.innerHTML = `<div class="vazio">Nenhum lançamento neste mês.</div>`;
    return;
  }
  lista.innerHTML = parcelasAtuais
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
    btn.onclick = () => {
      const id = btn.closest(".item").dataset.id;
      const parcela = parcelasAtuais.find((p) => p.id === id);
      marcarPago(parcela);
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
  const lista = $("#lista-receber");
  if (!recebimentosAtuais.length) {
    lista.innerHTML = `<div class="vazio">Nenhum recebimento neste mês.</div>`;
    return;
  }
  lista.innerHTML = recebimentosAtuais
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
    btn.onclick = () => {
      const id = btn.closest(".item").dataset.id;
      const receb = recebimentosAtuais.find((r) => r.id === id);
      marcarRecebido(receb);
    };
  });
}

async function marcarRecebido(receb) {
  await updateDoc(doc(bd, "usuarios", usuario.uid, "recebimentos", receb.id), {
    recebido: !receb.recebido,
  });
}

/* ---------- criar lançamento (Pagar) ---------- */
async function salvarLancamento() {
  const credor = $("#fp-credor").value.trim();
  const dataCompra = $("#fp-data").value || hojeISO();
  const inicioCobranca = $("#fp-inicio").value || somarMeses(hojeISO(), 1);
  const valorTotal = paraNumero($("#fp-valor").value);
  const parcelaTotal = Math.max(1, parseInt($("#fp-parcelas").value || "1", 10));
  const grupo = $("#fp-grupo").value;
  const aplicacao = $("#fp-aplicacao").value;
  const observacao = $("#fp-observacao").value.trim();

  if (!credor) return mostrarMsg("#msg-pagar", "Informe o credor.", "erro");
  if (!(valorTotal > 0)) return mostrarMsg("#msg-pagar", "Informe um valor válido.", "erro");
  if (!grupo || !aplicacao) return mostrarMsg("#msg-pagar", "Configure grupos e categorias pelo site primeiro.", "erro");

  $("#btn-salvar-pagar").disabled = true;
  try {
    const lancamentoId = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    const valores = dividirValor(valorTotal, parcelaTotal);
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
        comp: null,
        grupo,
        aplicacao,
        vencimento: somarMeses(inicioCobranca, i),
        pago: false,
        pagoEm: null,
        provisao: false,
        criadoEm: serverTimestamp(),
      });
    });
    await batch.commit();
    fecharPainel();
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
  mostrarMsg("#msg-pagar", "", "");
}

/* ---------- criar recebimento (Receber) ---------- */
async function salvarRecebimento() {
  const origem = $("#fr-origem").value.trim();
  const valor = paraNumero($("#fr-valor").value);
  const parcelaTotal = Math.max(1, parseInt($("#fr-parcelas").value || "1", 10));
  const valorPorParcela = $("#fr-valor-por-parcela").checked;
  const dataRecebimento = $("#fr-data").value || hojeISO();
  const observacao = $("#fr-observacao").value.trim();

  if (!origem) return mostrarMsg("#msg-receber", "Informe a origem.", "erro");
  if (!(valor > 0)) return mostrarMsg("#msg-receber", "Informe um valor válido.", "erro");

  $("#btn-salvar-receber").disabled = true;
  try {
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
    fecharPainel();
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
  $("#fr-valor-por-parcela").checked = false;
  $("#fr-valor-label").textContent = "Valor total";
  $("#fr-data").value = "";
  $("#fr-observacao").value = "";
  mostrarMsg("#msg-receber", "", "");
}

/* ---------- navegação / painel ---------- */
function irParaTela(nome) {
  ["inicio", "pagar", "receber"].forEach((t) => {
    $(`#tela-${t}`).classList.toggle("hidden", t !== nome);
    $(`#nav-${t}`).classList.toggle("ativa", t === nome);
  });
}

function abrirPainel(folha) {
  $("#folha-pagar").classList.toggle("hidden", folha !== "pagar");
  $("#folha-receber").classList.toggle("hidden", folha !== "receber");
  $("#painel").classList.remove("hidden");
  if (folha === "pagar" && !$("#fp-data").value) {
    $("#fp-data").value = hojeISO();
    $("#fp-inicio").value = somarMeses(hojeISO(), 1);
  }
  if (folha === "receber" && !$("#fr-data").value) {
    $("#fr-data").value = hojeISO();
  }
}
function fecharPainel() {
  $("#painel").classList.add("hidden");
}

function ligarEventos() {
  $("#btn-entrar").onclick = entrar;
  $("#login-senha").addEventListener("keydown", (e) => {
    if (e.key === "Enter") entrar();
  });
  $("#btn-esqueci").onclick = esqueciSenha;

  ["inicio", "pagar", "receber"].forEach((t) => {
    $(`#btn-sair-${t}`).onclick = () => signOut(auth);
    $(`#mes-anterior-${t}`).onclick = () => mudarMes(-1);
    $(`#mes-proximo-${t}`).onclick = () => mudarMes(1);
  });

  $("#nav-inicio").onclick = () => irParaTela("inicio");
  $("#nav-pagar").onclick = () => irParaTela("pagar");
  $("#nav-receber").onclick = () => irParaTela("receber");

  $("#fab-pagar").onclick = () => abrirPainel("pagar");
  $("#fab-receber").onclick = () => abrirPainel("receber");
  $("#btn-cancelar-pagar").onclick = fecharPainel;
  $("#btn-cancelar-receber").onclick = fecharPainel;
  $("#painel").addEventListener("click", (e) => {
    if (e.target.id === "painel") fecharPainel();
  });

  $("#btn-salvar-pagar").onclick = salvarLancamento;
  $("#btn-salvar-receber").onclick = salvarRecebimento;

  $("#fr-valor-por-parcela").addEventListener("change", (e) => {
    $("#fr-valor-label").textContent = e.target.checked ? "Valor de cada parcela" : "Valor total";
  });

  $("#fp-data").addEventListener("change", (e) => {
    $("#fp-inicio").value = somarMeses(e.target.value, 1);
  });
}
