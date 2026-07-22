# Controle Financeiro

Migração do controle financeiro pessoal (antes em planilha Excel) para um app web multiusuário. Veja `ESPECIFICACAO.md` para a especificação completa do produto.

## Stack

Next.js (App Router) + Firebase Authentication (e-mail/senha) + Cloud Firestore.

## Rodando localmente

```bash
npm install
npm run dev
```

Abra http://localhost:3000. É necessário um arquivo `.env.local` com as credenciais do Firebase (veja `.env.local.example`) — pegue os valores em Firebase Console > Project settings > Your apps.

Antes de usar, no Firebase Console:
1. Authentication > Sign-in method > ative Email/Password.
2. Firestore Database > crie o banco (modo produção).
3. Firestore Database > Rules > cole o conteúdo de `firestore.rules` > Publish.

## Migrando os dados da planilha

Depois de criar sua conta pelo app (tela `/cadastro`), rode:

```bash
node importar-firestore.mjs <SEU_UID>
```

O UID aparece em Authentication > Users no console do Firebase. É necessário o arquivo `serviceAccount.json` (Project settings > Service accounts > Generate new private key) na raiz do projeto — nunca commitado.

## Status

Fase 1 (MVP) implementada: login/cadastro, isolamento de dados por usuário, seed de configurações padrão, lançamento de contas a pagar parceladas, dashboard mensal com totalizadores. Próximas fases em `ESPECIFICACAO.md`.
