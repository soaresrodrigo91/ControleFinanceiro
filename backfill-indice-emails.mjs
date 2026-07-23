/**
 * Preenche a coleção indiceEmails/{email} para contas já existentes.
 *
 * garantirUsuarioSemeado (src/lib/config.ts) só escreve em indiceEmails no
 * primeiro login/cadastro de cada usuário — contas criadas antes da feature
 * de Lançamentos Compartilhados nunca passam por ali de novo, então precisam
 * desse backfill manual, uma única vez, antes de liberar a feature.
 *
 * Pré-requisitos: mesmos de importar-firestore.mjs (serviceAccount.json na
 * raiz, nunca commitar).
 *
 * Uso: node backfill-indice-emails.mjs
 *
 * Idempotência: usa o e-mail normalizado como doc ID e sempre faz set() —
 * rodar mais de uma vez não duplica nem corrompe nada.
 */
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const serviceAccount = JSON.parse(readFileSync("./serviceAccount.json", "utf8"));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const usuariosSnap = await db.collection("usuarios").get();

let gravados = 0;
let ignorados = 0;

for (const usuarioDoc of usuariosSnap.docs) {
  const dados = usuarioDoc.data();
  const email = typeof dados.email === "string" ? dados.email.trim().toLowerCase() : "";
  if (!email) {
    console.warn(`Usuário ${usuarioDoc.id} sem e-mail cadastrado — ignorado.`);
    ignorados++;
    continue;
  }
  await db
    .collection("indiceEmails")
    .doc(email)
    .set({ uid: usuarioDoc.id, nome: dados.nome ?? "", sobrenome: dados.sobrenome ?? "" });
  gravados++;
}

console.log(`Concluído: ${gravados} e-mails indexados, ${ignorados} ignorados.`);
