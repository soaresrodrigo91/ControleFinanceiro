/**
 * Importa os dados migrados da planilha Controle_Fin_2026.xlsm para o Firestore,
 * dentro do espaço de UM usuário específico (modelo multiusuário isolado).
 *
 * Pré-requisitos:
 *   1. Projeto criado no Firebase com Firestore ativado.
 *   2. Conta do dono da planilha já criada pelo app (tela /cadastro).
 *   3. Service account: Console Firebase > Configurações do projeto >
 *      Contas de serviço > Gerar nova chave privada > salvar como serviceAccount.json
 *      nesta pasta (NUNCA commitar esse arquivo — adicionar ao .gitignore).
 *   4. npm install firebase-admin
 *
 * Uso:  node importar-firestore.mjs <UID>
 *       (o UID aparece no console do Firebase em Authentication > Users)
 *
 * Idempotência: IDs determinísticos — rodar duas vezes não duplica dados.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const uid = process.argv[2];
if (!uid) {
  console.error('Uso: node importar-firestore.mjs <UID do usuário>');
  console.error('O UID aparece no console do Firebase em Authentication > Users.');
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync('./serviceAccount.json', 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const pagar = JSON.parse(readFileSync('./contas_pagar.json', 'utf8'));
const receber = JSON.parse(readFileSync('./contas_receber.json', 'utf8'));
const config = JSON.parse(readFileSync('./configuracoes.json', 'utf8'));

const base = db.collection('usuarios').doc(uid);
const id = (...parts) =>
  createHash('md5').update(parts.join('|')).digest('hex').slice(0, 20);

async function commitInChunks(ops) {
  // Firestore limita 500 operações por batch
  for (let i = 0; i < ops.length; i += 450) {
    const batch = db.batch();
    ops.slice(i, i + 450).forEach(({ ref, data }) => batch.set(ref, data));
    await batch.commit();
    console.log(`  gravadas ${Math.min(i + 450, ops.length)}/${ops.length}`);
  }
}

async function main() {
  const userDoc = await base.get();
  if (!userDoc.exists) {
    console.error(`Nenhum documento em usuarios/${uid}.`);
    console.error('Crie a conta pelo app (tela /cadastro) antes de importar.');
    process.exit(1);
  }

  const ops = [];

  // ---- Configurações (listas mestras da planilha substituem o seed padrão) ----
  ops.push({
    ref: base.collection('config').doc('listas'),
    data: {
      aplicacoes: config.aplicacoes,
      grupos: config.grupos,
      comp: config.comp.map((nome) => ({ nome, modo: 'nenhum' })),
      modoTotalizador: 'todos', // Configuração 6 — padrão da planilha
    },
  });

  // ---- Contas a pagar ----
  // fixa: true  -> vira recorrência (a planilha guardava 1 linha por conta fixa)
  // fixa: false -> vira documento em parcelas
  let nParcelas = 0, nRecorrencias = 0;
  for (const p of pagar) {
    if (p.fixa) {
      const venc = p.vencimento ? new Date(p.vencimento + 'T00:00:00') : null;
      ops.push({
        ref: base.collection('recorrencias').doc(id('pagar', p.credor, p.observacao, p.grupo, p.aplicacao)),
        data: {
          tipo: 'pagar',
          credor: p.credor,
          observacao: p.observacao ?? null,
          valorAtual: p.valorParcela,
          comp: p.comp ?? null,
          grupo: p.grupo,
          aplicacao: p.aplicacao,
          diaVencimento: venc ? venc.getDate() : 1,
          inicio: p.vencimento ?? p.dataCompra ?? null,
          fim: null,
          historicoValores: [{ valor: p.valorParcela, desde: p.vencimento ?? p.dataCompra ?? null }],
        },
      });
      nRecorrencias++;
    } else {
      ops.push({
        ref: base.collection('parcelas').doc(id(p.lancamentoId, p.parcelaNum ?? 1)),
        data: {
          lancamentoId: p.lancamentoId,
          credor: p.credor,
          dataCompra: p.dataCompra ?? null,
          observacao: p.observacao ?? null,
          valorTotal: p.valorTotal,
          parcelaNum: p.parcelaNum ?? 1,
          parcelaTotal: p.parcelaTotal ?? 1,
          valorParcela: p.valorParcela,
          comp: p.comp ?? null,
          grupo: p.grupo,
          aplicacao: p.aplicacao,
          vencimento: p.vencimento ?? null,
          pago: p.pago === true,
          pagoEm: null, // a planilha não guardava a data do pagamento
          criadoEm: FieldValue.serverTimestamp(),
        },
      });
      nParcelas++;
    }
  }

  // ---- Contas a receber ----
  let nReceber = 0;
  for (const r of receber) {
    if (r.fixo) {
      const rec = r.recebimento ? new Date(r.recebimento + 'T00:00:00') : null;
      ops.push({
        ref: base.collection('recorrencias').doc(id('receber', r.origem, r.observacao)),
        data: {
          tipo: 'receber',
          credor: r.origem,
          observacao: r.observacao ?? null,
          valorAtual: r.valor,
          diaVencimento: rec ? rec.getDate() : 1,
          inicio: r.recebimento ?? r.data ?? null,
          fim: null,
          historicoValores: [{ valor: r.valor, desde: r.recebimento ?? r.data ?? null }],
        },
      });
    } else {
      ops.push({
        ref: base.collection('recebimentos').doc(id('rec', r.origem, r.recebimento, r.valor)),
        data: {
          origem: r.origem,
          valor: r.valor,
          recebimento: r.recebimento ?? null,
          qtdParcelas: r.qtdParcelas ?? 1,
          parcela: r.parcela ?? '1/1',
          observacao: r.observacao ?? null,
          recebido: false,
        },
      });
    }
    nReceber++;
  }

  console.log(`Importando para usuarios/${uid}:`);
  console.log(`  ${nParcelas} parcelas, ${nRecorrencias} recorrências de pagamento, ${nReceber} itens a receber, 1 doc de configurações...`);
  await commitInChunks(ops);
  console.log('Importação concluída.');
}

main().catch((e) => { console.error(e); process.exit(1); });
