# Controle Financeiro — Especificação do App Web

Migração da planilha `Controle_Fin_2026.xlsm` (Excel + VBA) para um app web **multiusuário com dados isolados por conta**: cada pessoa se cadastra com o próprio e-mail e senha e enxerga exclusivamente os próprios lançamentos, configurações e relatórios. Este documento é a fonte de verdade para o desenvolvimento e substitui a aba "Regras da Planilha".

## 1. Stack

- **Frontend:** Next.js (App Router) + React, mobile-first, PWA (instalável no celular)
- **Autenticação:** Firebase Authentication (e-mail/senha)
- **Banco:** Cloud Firestore
- **Hospedagem:** Vercel, deploy automático via GitHub
- **Gráficos:** Recharts (ou similar leve)

Planos gratuitos (Firebase Spark + Vercel Hobby) são suficientes para dezenas de usuários com uso pessoal.

## 2. Usuários e isolamento de dados

**Não há papéis nem permissões entre usuários.** O modelo é de espaços totalmente separados (multi-tenant):

- Qualquer pessoa cria conta em **/cadastro** (nome, e-mail, senha) e já entra com acesso imediato ao **próprio espaço, vazio**.
- Tudo que o usuário cria — lançamentos, recorrências, recebimentos, listas mestras, preferências — pertence apenas a ele. Nenhum usuário vê ou toca nos dados de outro, garantido por Security Rules no servidor.
- No primeiro login, o app **semeia as configurações padrão** do usuário (listas mestras iniciais — ver 3.4) para ele não começar do zero; depois cada um personaliza as suas.
- "Esqueci minha senha" via recurso nativo do Firebase Auth (e-mail de redefinição).
- Exclusão de conta (LGPD): opção em Configurações que apaga a conta e todos os dados do usuário.

Consequência consciente desta decisão: um controle financeiro compartilhado por duas pessoas vive dentro de **uma** conta (cujo acesso as duas pessoas combinam entre si). Compartilhamento de espaço entre contas distintas (convites) fica como possível evolução futura, fora do escopo atual.

## 3. Modelo de dados (Firestore)

Todos os dados vivem em **subcoleções do usuário** — o isolamento faz parte da estrutura:

```
usuarios/{uid}
  ├── (campos do perfil — ver 3.5)
  ├── parcelas/{id}
  ├── recorrencias/{id}
  ├── recebimentos/{id}
  └── config/listas        (documento único)
```

### 3.1 `usuarios/{uid}/parcelas` (substitui a aba "Contas a Pagar")

Um documento por parcela. Campos (ver `contas_pagar.json` para dados reais):

```
lancamentoId: string     // agrupa parcelas do mesmo lançamento
credor: string
dataCompra: string       // ISO YYYY-MM-DD
observacao: string|null
valorTotal: number       // valor total da compra
parcelaNum: number       // 2 (de "2/4")
parcelaTotal: number     // 4 (de "2/4")
valorParcela: number
comp: string|null        // compartilhamento (lista mestra do usuário)
grupo: string            // lista mestra do usuário
aplicacao: string        // lista mestra do usuário
vencimento: string       // ISO YYYY-MM-DD (substitui Dia/Mês/Ano separados)
pago: boolean
pagoEm: string|null      // data do pagamento (ISO)
criadoEm: timestamp
```

(`pagoPor`/`criadoPor` da versão anterior foram removidos: num espaço de dono único não fazem sentido.)

### 3.2 `usuarios/{uid}/recorrencias` (modela as contas fixas)

A planilha tratava conta fixa como 1 linha replicada por fórmula. No app, cada conta fixa vira uma recorrência:

```
tipo: "pagar" | "receber"
credor, observacao, valorAtual, comp, grupo ("Fixas"), aplicacao
diaVencimento: number        // dia do mês
inicio: string               // ISO, primeiro mês de cobrança
fim: string|null             // null = ativa; preenchido = encerrada
historicoValores: [{valor, desde}]  // reajustes preservam histórico
```

Materialização: ao abrir um mês no Dashboard, o app gera virtualmente as parcelas das recorrências ativas naquele mês. Marcar como paga grava uma parcela real vinculada à recorrência.

### 3.3 `usuarios/{uid}/recebimentos` (substitui "Contas a Receber")

```
origem: string, valor: number, recebimento: string (ISO),
qtdParcelas, parcela, observacao, recebido: boolean
```

Receita fixa (ex.: salário) usa `recorrencias` com `tipo: "receber"`.

### 3.4 `usuarios/{uid}/config/listas` (documento único, por usuário)

```
aplicacoes: string[]
grupos: string[]
comp: string[]
modoTotalizador: "todos" | "visiveis"   // Configuração 6 da planilha
```

**Seed no primeiro login** com valores padrão genéricos definidos em código, ex.:
`grupos: ["Fixas", "Cartão de Crédito", "Provisões", "Outros"]`,
`aplicacoes: ["Alimentação", "Moradia", "Transporte", "Saúde", "Lazer", "Assinaturas", "Parcelamentos", "Outros"]`, `comp: []`.
Cada usuário adiciona/remove itens livremente (item em uso em algum lançamento não pode ser removido — validar). O grupo **"Provisões"** tem comportamento especial (ver 4.1-2) e, se renomeado/removido, o comportamento acompanha um flag `ehProvisao: true` por grupo em vez do nome fixo.

### 3.5 `usuarios/{uid}` (campos do perfil)

```
nome: string, email: string, criadoEm: timestamp,
filtrosDashboard: { [grupo]: boolean }   // filtro persistido
```

## 4. Regras de negócio

### 4.1 Fiéis à planilha (preservar exatamente)

1. **Parcelamento:** lançamento de N parcelas gera N documentos em `parcelas`, valores divididos (última parcela absorve arredondamento — ex.: 149,96/3 = 49,99 + 49,99 + 49,98). Vencimento da parcela 1 = mês seguinte à data da compra (mesmo dia informado); parcelas seguintes de mês em mês.
2. **Regra de Provisões:** parcela de grupo marcado como provisão, quando paga, tem valor **zerado nos totalizadores** (o dinheiro já estava provisionado). Continua visível na lista, mas não soma.
3. **Configuração 6:** o Líquido Mensal e totais gerais têm dois modos — "somar todos os grupos" (ignora filtros) ou "somar apenas grupos visíveis" (respeita filtros do Dashboard). Toggle em Configurações.
4. **Horizonte de 13 meses:** Dashboard e projeções cobrem o mês corrente + 12 seguintes.
5. **Líquido Mensal** = receitas do mês − despesas do mês (conforme modo da Configuração 6).
6. **Status visual por grupo:** ✓ verde (pago), ! amarelo (parcial), ✗ vermelho (pendente) — sempre **calculado** a partir das parcelas do grupo no mês, nunca digitado.

### 4.2 Melhorias em relação à planilha

1. **Pagamento com data:** marcar paga grava `pagoEm`; desmarcar limpa.
2. **Editar/excluir:** o usuário pode editar ou excluir uma parcela isolada ou o lançamento inteiro (todas as parcelas do `lancamentoId`), com confirmação explícita no caso do lançamento inteiro.
3. **Recorrências encerráveis e reajustáveis** (ver 3.2).
4. **Alerta de duplicata (não bloqueante):** ao lançar, se já existir parcela com mesmo credor + valor total + mês, exibir "Já existe um lançamento parecido neste mês — confirmar mesmo assim?".
5. **Vencimento como data ISO única** (fim das colunas Dia/Mês/Ano).
6. **Autocomplete de credor** no formulário, com resumo do último lançamento daquele credor (grupo, aplicação, valor) — dentro dos dados do próprio usuário.
7. **Auto-formatação de data:** digitação `08072026` → `08/07/2026`.
8. **"Fixo = Sim" trava o grupo em "Fixas"**; lançamento não-fixo não pode usar o grupo "Fixas".

### 4.3 O que NÃO migra da planilha

- Tabela de usuários/senhas, senha "2877", ocultação de abas, níveis ADM/CONSULTA — substituídos pelo isolamento por conta.
- Aba `MarcasP_Registro` e a identidade composta — cada parcela tem ID próprio.
- Macros VBA — todo comportamento vira código do app.

## 5. Telas

1. **/login** — e-mail/senha, link para /cadastro e "Esqueci minha senha".
2. **/cadastro** — nome, e-mail, senha. Ao concluir: cria `usuarios/{uid}`, semeia `config/listas` padrão e entra direto no Dashboard (vazio, com um estado de boas-vindas orientando o primeiro lançamento).
3. **/dashboard** (home) — seletor de mês; cards por grupo com total do mês e status calculado (✓/!/✗); filtro de grupos (persistido); lista de parcelas do mês com toggle de pago; totalizadores: total geral, Líquido Mensal, projeção 13 meses; **gráficos:** linha do Líquido Mensal (13 meses) e pizza por aplicação no mês.
4. **/lancar** — formulário contas a pagar: credor (autocomplete + resumo), data, início da cobrança, observação, fixo?, valor total, parcelas, comp. (opcional), grupo, aplicação. Validação de obrigatórios idêntica à planilha; alerta de duplicata.
5. **/receber** — lista + formulário de contas a receber.
6. **/relatorios** — visão mensal completa (todos os grupos), navegação por mês, agrupamento por aplicação, botão imprimir (CSS de impressão, paisagem).
7. **/configuracoes** — listas mestras do usuário, modo do totalizador, recorrências ativas/encerradas, excluir conta.

Navegação mobile: bottom tabs (Dashboard, Lançar, Relatórios, Config).

## 6. Security Rules

O isolamento inteiro em uma regra — o usuário só acessa a própria subárvore:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /usuarios/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
      match /{subcolecao}/{doc=**} {
        allow read, write: if request.auth != null && request.auth.uid == uid;
      }
    }
  }
}
```

Nada além disso é necessário: não existe dado compartilhado.

## 7. Migração dos dados da planilha

Os dados da planilha original serão importados **para dentro da conta do dono da planilha**, depois que ele se cadastrar no app:

- `contas_pagar.json` — 216 parcelas (111 lançamentos; as 17 fixas viram `recorrencias`; 20 pagas → `pago: true`)
- `contas_receber.json` — 1 registro (receita fixa → recorrência `tipo: "receber"`)
- `configuracoes.json` — listas mestras da planilha (substituem o seed padrão na conta dele)

Script `importar-firestore.mjs` incluído. Uso: `node importar-firestore.mjs <UID>` — o UID da conta aparece no console do Firebase em Authentication > Users. O script grava tudo nas subcoleções de `usuarios/{UID}`.

## 8. Fases

1. **MVP:** login + cadastro com seed de configurações, lançar contas a pagar, dashboard do mês com pagar/pago e totalizadores, importação dos dados da planilha.
2. **Fase 2:** recorrências completas, contas a receber, relatórios com impressão, configurações completas (listas, modo, excluir conta).
3. **Fase 3:** gráficos, alerta de duplicata, filtros persistidos, PWA/instalável, exportação CSV/Excel.
