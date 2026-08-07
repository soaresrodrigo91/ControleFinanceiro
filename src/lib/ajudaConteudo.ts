export type MarcadorImagem = {
  numero: number;
  xPct: number;
  yPct: number;
  texto: string;
};

export type ArtigoAjuda = {
  id: string;
  categoria: string;
  titulo: string;
  resumo: string;
  regras: string[];
  validacoes: string[];
  imagem: string;
  imagemAlt: string;
  marcadores: MarcadorImagem[];
};

export const ARTIGOS_AJUDA: ArtigoAjuda[] = [
  {
    id: "login",
    categoria: "Conta",
    titulo: "Entrar",
    resumo:
      "Tela de entrada do sistema. Depois de logar, o navegador guarda a sessão automaticamente — não é preciso entrar de novo a cada visita, a menos que você clique em \"Sair\".",
    regras: [
      "A sessão fica salva no navegador até você clicar em \"Sair\" explicitamente.",
      "Depois de entrar com sucesso, o sistema verifica se você já escolheu um plano: se não, leva para Escolher Plano; se sim, leva direto para Início.",
    ],
    validacoes: [
      "E-mail e senha são obrigatórios.",
      "Credenciais inválidas mostram uma mensagem específica (e-mail não encontrado, senha incorreta, etc.).",
      "Clicar em \"Esqueci minha senha\" sem preencher o e-mail primeiro mostra um aviso pedindo para digitar o e-mail e tentar novamente.",
    ],
    imagem: "/ajuda/login.png",
    imagemAlt: "Tela de login do Controle Financeiro",
    marcadores: [
      { numero: 1, xPct: 50, yPct: 50.4, texto: "E-mail cadastrado na conta." },
      { numero: 2, xPct: 50, yPct: 60.6, texto: "Senha de acesso." },
      { numero: 3, xPct: 50, yPct: 68, texto: "Confirma o login e entra no sistema." },
      { numero: 4, xPct: 50, yPct: 73.5, texto: "Envia um e-mail para redefinir a senha." },
      { numero: 5, xPct: 54, yPct: 79, texto: "Leva para a tela de criação de conta." },
    ],
  },
  {
    id: "cadastro",
    categoria: "Conta",
    titulo: "Criar conta",
    resumo:
      "Cadastro de uma nova conta com nome, sobrenome, e-mail e senha. Depois de criar a conta, o sistema segue automaticamente para a escolha de plano.",
    regras: [
      "Nome e sobrenome informados aqui já preenchem automaticamente o seu perfil.",
      "Na primeira vez, o sistema cria automaticamente as listas padrão (grupos, aplicações) para a conta nova.",
      "Logo no primeiro acesso, aparece uma mensagem de boas-vindas — some depois de fechada e não volta a aparecer nos próximos acessos.",
    ],
    validacoes: [
      "Todos os campos (nome, sobrenome, e-mail, senha) são obrigatórios.",
      "A senha precisa ter no mínimo 6 caracteres.",
      "E-mail já cadastrado anteriormente mostra uma mensagem de erro específica.",
    ],
    imagem: "/ajuda/cadastro.png",
    imagemAlt: "Tela de criação de conta",
    marcadores: [
      { numero: 1, xPct: 50, yPct: 44, texto: "Nome e sobrenome — usados no seu perfil dentro do app." },
      { numero: 2, xPct: 50, yPct: 56.3, texto: "E-mail que você vai usar para entrar." },
      { numero: 3, xPct: 50, yPct: 66.5, texto: "Senha — mínimo de 6 caracteres." },
      { numero: 4, xPct: 50, yPct: 76.4, texto: "Cria a conta e segue para a escolha de plano." },
    ],
  },
  {
    id: "inicio",
    categoria: "Início",
    titulo: "Início",
    resumo:
      "Tela inicial: totalizadores do mês, filtro por grupo, Janela de 10 meses (com link para os lançamentos) e um mini-dashboard dos grupos marcados.",
    regras: [
      "Os valores ficam ocultos por padrão a cada novo login, por privacidade — clique no ícone de olho para mostrar ou esconder. Essa preferência e os filtros de grupo marcados ficam salvos durante a sessão do navegador.",
      "Contas do grupo \"Provisões\" marcadas como pagas contam como R$ 0 no total do mês — a lógica assume que esse dinheiro já foi separado/reservado antes.",
      "Contas fixas (recorrentes) aparecem automaticamente todo mês, mesmo antes de serem pagas. Elas só viram um lançamento de verdade no banco de dados quando você marca como paga ou edita algum dado daquele mês.",
      "Quando a conta tem um reembolso configurado (uma pessoa que divide a despesa com você), o sistema calcula automaticamente quanto você recebe de volta e cria um recebimento correspondente em Contas a Receber.",
      "Marcar uma conta fixa de Provisões como paga remove automaticamente o reembolso pendente dela (o valor efetivo virou zero); desmarcar o pagamento recria esse reembolso.",
      "A Janela de 10 meses substitui a antiga lista de lançamentos individuais: cada linha é um grupo, com um link direto para os lançamentos filtrados em Contas a Pagar e o selo Pago/Parcial/Pendente. A baixa em massa (marcar/desmarcar todos os lançamentos do grupo de uma vez) fica só na tela de Contas a Pagar.",
      "Ao final das linhas de grupo, duas linhas discretas de subtotal podem fechar a janela: \"Subtotal\" (soma dos grupos marcados — bate com o \"Total de gastos no mês\" quando todas estiverem marcadas) e \"Provisão Líquido\" (tudo que já está lançado a receber no mês, mesmo o que ainda não foi marcado como recebido, menos esse subtotal — é uma projeção, não o líquido já efetivado). As duas seguem o mesmo ícone de olho que mostra/oculta os totalizadores do topo, mas só aparecem se a opção \"Subtotal e Provisão na tela de Início\" estiver ativada em Configurações → Geral I (desativada por padrão).",
      "A \"Provisão Líquido\" já considera contas fixas a receber e reembolsos de contas fixas a pagar com reembolso configurado, mesmo em meses futuros que você ainda não visitou — não depende de abrir aquele mês específico para o valor materializar.",
      "A primeira coluna da Janela de 10 meses é sempre o mês selecionado na tela (não necessariamente o mês atual de verdade) e as outras 9 colunas seguem em sequência a partir dele. Os títulos dos meses na janela são só para visualização — para mudar o mês selecionado, use as setas ou o seletor de mês/ano no canto superior direito da tela.",
      "Abaixo da janela, um mini-dashboard mostra, só para os grupos marcados nos filtros, o valor por grupo, a quantidade de lançamentos por grupo e a distribuição por aplicação no mês — em pizza ou em barras. Mostrar/ocultar esse mini-dashboard e escolher entre pizza ou barras agora fica em Configurações → Geral I, não mais aqui na Início.",
      "Em telas de computador (a partir de aprox. 1024px de largura): só os totalizadores do mês, o filtro por grupo e a Janela de 10 meses ficam fixos no topo da tela; o mini-dashboard abaixo se ajusta exatamente ao espaço disponível — as listas dentro de cada quadro (e também do Dashboard analítico) é que ficam roláveis individualmente quando não cabe tudo, passando o scroll do mouse por cima da lista, sem barra de rolagem visível. Em monitores muito baixos, o mini-dashboard nunca fica menor que um tamanho mínimo legível — se não sobrar espaço suficiente na tela, a própria página passa a rolar (barra de rolagem normal do navegador) até revelar o dashboard por completo.",
      "Em celular (telas estreitas): a Janela de 10 meses mostra só a coluna do mês selecionado (em vez das 10 colunas), evitando cortar informação — arraste o dedo para o lado sobre a janela para ver o mês anterior/seguinte, como um carrossel (mesmo efeito das setas do seletor de mês). O mini-dashboard mostra os três quadros empilhados, um abaixo do outro em vez de lado a lado, cada um com sua altura normal, e a página inteira rola para revelar tudo.",
      "O rodapé mostra a versão atual do sistema, que é atualizada a cada alteração ou correção feita.",
    ],
    validacoes: [],
    imagem: "/ajuda/inicio.png",
    imagemAlt: "Tela Início com totalizadores, Janela de 10 meses e mini-dashboard",
    marcadores: [
      { numero: 1, xPct: 16.6, yPct: 11.8, texto: "Totalizadores do mês: gastos, recebimentos, pago, pendente e líquido." },
      { numero: 2, xPct: 82.9, yPct: 11.8, texto: "Mostra/oculta os valores e navega entre os meses." },
      {
        numero: 3,
        xPct: 19,
        yPct: 16.8,
        texto:
          "Filtro por grupo — marque para revelar cada grupo. O botão \"Marcar todos\"/\"Desmarcar todos\" ao lado alterna todas de uma vez.",
      },
      {
        numero: 4,
        xPct: 16,
        yPct: 29.5,
        texto:
          "Cada linha: status do grupo (Pago/Parcial/Pendente) e link para ver os lançamentos daquele grupo, já filtrados, em Contas a Pagar.",
      },
      {
        numero: 5,
        xPct: 44.6,
        yPct: 25,
        texto: "Só para visualização — a navegação entre meses é pelo seletor no canto superior direito.",
      },
      { numero: 6, xPct: 89.2, yPct: 20.7, texto: "Oculta ou mostra a Janela de 10 meses." },
      {
        numero: 7,
        xPct: 47.8,
        yPct: 70.8,
        texto:
          "Mini-dashboard: valor, quantidade de lançamentos e aplicações dos grupos marcados. Mostrar/ocultar e escolher pizza ou barras agora fica em Configurações → Geral I.",
      },
    ],
  },
  {
    id: "lancar-form",
    categoria: "Contas a Pagar",
    titulo: "Contas a Pagar · Novo lançamento",
    resumo:
      "Formulário para lançar uma conta a pagar: única, parcelada ou fixa (recorrente todo mês).",
    regras: [
      "Marcar \"Conta fixa (recorrente)\" transforma o lançamento em uma recorrência mensal (sem número de parcelas), que se repete todo mês a partir da data de início até ser encerrada.",
      "Se não for fixa, o valor total é dividido igualmente entre as parcelas — eventuais centavos de arredondamento vão para a primeira parcela.",
      "Uma chave discreta ao lado do campo de valor alterna entre \"Valor total\" e \"Valor da parcela\": com a chave desligada (padrão), o valor digitado é o total e o sistema divide pelas parcelas; com a chave ligada, o valor digitado é o de cada parcela e o sistema multiplica pelo número de parcelas para obter o total. Ex.: R$ 1.000,00 com 2 parcelas e a chave desligada lança 2x de R$ 500,00; com a chave ligada, lança 2x de R$ 1.000,00.",
      "Ao marcar \"Conta fixa (recorrente)\", a chave é travada em \"Valor da parcela\", já que uma conta fixa não tem \"total\" a dividir — o valor digitado é sempre o lançado em cada mês.",
      "O campo de valor tem máscara de R$: os dígitos digitados formam a parte inteira (ex.: 1, 10, 100... vira 1.000,00), e a vírgula abre a edição dos centavos.",
      "Se um reembolso (pessoa) for selecionado e ela tiver um modo configurado (100% ou 50%), o sistema já cria automaticamente o(s) recebimento(s) correspondente(s) em Contas a Receber.",
      "Em telas maiores, o formulário se organiza em duas colunas, separadas por uma linha divisória discreta (credor, datas, valor/parcelas, conta fixa/provisão e observação à esquerda; grupo, aplicação e reembolso à direita) para aproveitar melhor o espaço horizontal e exigir menos rolagem — em celular, os campos continuam empilhados em uma coluna só.",
      "O botão \"Cancelar\" ao lado de \"Salvar\" limpa todos os campos do formulário (voltando credor, datas, valor, parcelas, observação e demais campos ao estado inicial), sem sair da tela — útil para recomeçar o preenchimento do zero.",
      "A Observação é obrigatória nesta tela (diferente de outras telas que reaproveitam o mesmo formulário, como a Renegociação, onde ela continua opcional).",
      "Ao salvar com sucesso, aparece uma mensagem verde \"Lançamento salvo com sucesso!\" (igual à do app mobile), que some sozinha após 3 segundos — o formulário já é limpo na hora, pronto para um novo lançamento.",
    ],
    validacoes: [
      "Credor, data da compra, início da cobrança, valor total (ou valor da parcela, conforme a chave), parcelas, grupo, aplicação e observação são obrigatórios — mensagem: \"Preencha todos os campos obrigatórios.\"",
      "O valor total precisa ser um número válido maior que zero — mensagem: \"Informe um valor total válido.\"",
      "O número de parcelas precisa ser no mínimo 1 — mensagem: \"O número de parcelas deve ser pelo menos 1.\"",
      "Erro de gravação (rede, permissão etc.): \"Não foi possível salvar o lançamento. Tente novamente.\"",
    ],
    imagem: "/ajuda/lancar-form.png",
    imagemAlt: "Formulário de novo lançamento em Contas a Pagar",
    marcadores: [
      { numero: 1, xPct: 50, yPct: 27, texto: "Nome do credor — sugere nomes já usados antes." },
      { numero: 2, xPct: 50, yPct: 37.3, texto: "Data da compra e início da cobrança (1ª parcela)." },
      { numero: 3, xPct: 34, yPct: 43, texto: "Vira uma recorrência mensal em vez de um lançamento único." },
      { numero: 4, xPct: 50, yPct: 62.3, texto: "Valor (total ou por parcela, conforme a chave) e número de parcelas — a divisão é automática." },
      { numero: 5, xPct: 50, yPct: 72.4, texto: "Grupo e aplicação — usadas nos filtros e relatórios." },
      { numero: 6, xPct: 50, yPct: 92.6, texto: "Se preenchido, gera um recebimento automático para quem divide a conta." },
    ],
  },
  {
    id: "lancar-lista",
    categoria: "Contas a Pagar",
    titulo: "Contas a Pagar · Lançamentos",
    resumo:
      "Lista, busca, filtra, edita e exclui os lançamentos já feitos, mês a mês.",
    regras: [
      "É preciso marcar ao menos uma opção em Grupo para a lista aparecer — evita mostrar tudo de uma vez sem querer. Os filtros Aplicação, Reembolso, Provisão e Valor ficam sempre visíveis, mas só ficam ativos depois de marcar algum grupo (Aplicação e Reembolso desativam de novo se \"Provisão\" for marcado, já que provisão não usa esses filtros). Se todos os grupos forem desmarcados, \"Provisão\" também é desmarcado automaticamente, para não ficar um filtro marcado sem nenhum grupo selecionado.",
      "Os filtros de múltipla escolha (Grupo, Aplicação, Reembolso) mostram um rodapé fixo com o total de opções da lista, mesmo quando é preciso rolar para ver todas — assim fica claro que não falta nada, só está rolável.",
      "Contas fixas ainda não pagas no mês aparecem na lista mesmo sem ter um registro \"real\" no banco de dados ainda; editar ou excluir cria esse registro quando necessário.",
      "Excluir uma conta fixa oferece três alcances: apenas este mês, deste mês em diante, ou a recorrência inteira (com aviso extra, porque é irreversível).",
      "Excluir uma conta com reembolso vinculado também remove o(s) recebimento(s) gerado(s) por ela.",
      "Editar credor, grupo, aplicação ou observação de um lançamento parcelado pergunta se a alteração vale só para esta parcela ou para todas as parcelas do lançamento; para conta fixa, a mesma edição pergunta o alcance (apenas este mês, deste mês em diante, ou tudo, desde o início). Valor e vencimento continuam sempre específicos de cada parcela/mês, sem propagar.",
      "O filtro Valor aceita o valor exato do lançamento, já com máscara de R$ (separador de milhar e centavos automáticos).",
      "A coluna Aplicação aparece logo depois de Observação, mostrando a aplicação de cada lançamento sem precisar abrir para editar. A descrição abaixo do nome do credor mostra só o grupo (a aplicação já está na sua própria coluna, então não se repete ali).",
      "Lançamentos criados pelo app mobile mostram um ícone discreto de celular com a palavra \"Mobile\" ao lado do grupo, abaixo do nome do credor.",
      "O checkbox do cabeçalho marca/desmarca todos os lançamentos como pago na página atual; a setinha ao lado dele abre um menu só com \"Todas as páginas\" (marcar a página atual já é o próprio checkbox) — essa opção pede confirmação antes de aplicar, por afetar itens que nem estão visíveis na tela.",
      "Lançamentos com o selo \"Renegociação\" vieram de uma renegociação e não podem ser editados ou excluídos por aqui — veja a aba Renegociação.",
      "Lançamentos com reembolso configurado têm um botão extra (avião de papel) depois do de excluir — só aparece com \"Compartilhar Lançamentos\" ativo em Configurações. Ele NÃO envia nada diretamente: só restaura a pendência de envio em Lançamentos Compartilhados caso ela tenha sido removida de lá (veja \"Excluir pendência\" nessa outra tela); por isso fica inativo sempre que já existe uma pendência ativa, o lançamento já foi enviado, ou o reembolso não tem e-mail vinculado — nesses casos não há nada para restaurar. Quando ativo, ao clicar pergunta o alcance: apenas este mês, este mês e os futuros, ou todos desde o início.",
      "Os botões de editar, excluir e reenviar mostram uma descrição ao passar o mouse por cima, explicando o que cada um faz.",
    ],
    validacoes: [
      "Tentar excluir uma conta já marcada como paga é bloqueado, com mensagem explicando que é preciso desmarcar o pagamento antes.",
    ],
    imagem: "/ajuda/lancar-lista.png",
    imagemAlt: "Lista de lançamentos de Contas a Pagar com filtros",
    marcadores: [
      { numero: 1, xPct: 10, yPct: 22.8, texto: "Filtros por grupo, aplicação, reembolso, provisão e valor." },
      { numero: 2, xPct: 84.4, yPct: 22.8, texto: "Navega entre os meses." },
      { numero: 3, xPct: 12, yPct: 30.3, texto: "Quantidade de resultados e soma dos valores filtrados." },
      {
        numero: 4,
        xPct: 12.5,
        yPct: 35.1,
        texto: "Marcar todos como pago: só nesta página, ou todos os resultados de todas as páginas (com confirmação).",
      },
      { numero: 5, xPct: 87.4, yPct: 41.2, texto: "Editar, excluir ou (re)enviar o lançamento (reembolso)." },
    ],
  },
  {
    id: "lancamentos-compartilhados",
    categoria: "Contas a Pagar",
    titulo: "Contas a Pagar · Lançamentos Compartilhados",
    resumo:
      "Compartilha lançamentos do tipo reembolso com outro usuário do sistema, e lança na sua conta o que outra pessoa compartilhou com você. Só aparece no menu quando \"Compartilhar Lançamentos\" está ativo em Configurações.",
    regras: [
      "Para usar, ative \"Compartilhar Lançamentos\" em Configurações → Geral II e vincule um e-mail a um reembolso já cadastrado. Só flui lançamento entre duas contas quando as DUAS têm, cada uma na própria conta, um reembolso vinculado ao e-mail da outra (vínculo mútuo) — vincular só do seu lado não é suficiente.",
      "Um lançamento só aparece como pendência em Envios se o reembolso usado nele já tiver um e-mail vinculado; sem vínculo, o lançamento fica só no fluxo normal de Contas a Pagar, sem nada em Lançamentos Compartilhados.",
      "Toda a área do topo fica dentro de um quadro destacado dividido em duas faixas, deixando claro que esse bloco é um submenu dentro da tela: a faixa de cima tem a chave \"Lançamentos Recebidos\"/\"Lançamentos Enviados\" (submenu) e o seletor de mês/ano; a faixa de baixo, com fundo levemente diferente, tem os filtros de visualização à esquerda e os botões de ação (Excluir, Enviar/Lançar) à direita.",
      "A chave \"Lançamentos Recebidos\"/\"Lançamentos Enviados\" alterna entre os lançamentos seus, do mês selecionado, com reembolso vinculado a alguém (\"Lançamentos Enviados\", chamado de Envios no restante desta ajuda) e os que outra pessoa compartilhou com você (\"Lançamentos Recebidos\") — só um dos dois fica marcado por vez. Ao abrir a aba \"Lançamentos Compartilhados\", \"Lançamentos Recebidos\" vem marcado por padrão; clicar numa notificação de lançamento recebido também leva direto para cá.",
      "Em Envios, a faixa de baixo tem o filtro \"Status: Pendentes/Já Enviados\" (\"Pendentes\" por padrão) — propositalmente sem repetir a palavra \"Enviados\" sozinha, pra não parecer contraditório ao lado do botão \"Lançamentos Enviados\" já selecionado. Esse filtro só controla o que aparece na lista, não muda nenhuma regra: em \"Pendentes\" aparecem os lançamentos com selo \"Não enviado\"; em \"Já Enviados\" aparecem os já enviados, com selo \"Enviado\" (não é possível reenviar por aqui, mas dá pra selecionar e excluir). As colunas são Credor, Observação, Aplicação, Parcela, Reembolso, Data, Valor do lançamento (valor cheio), Valor do Reembolso (já com o percentual aplicado, 100% ou 50% conforme o modo configurado) e Status.",
      "Os botões \"Excluir\", \"Enviar\" (em Recebidos, \"Lançar\") ficam sempre visíveis na faixa de baixo, mas desativados até você marcar pelo menos um lançamento na lista — ao marcar, eles ficam ativos e mostram a quantidade selecionada entre parênteses.",
      "Para conta fixa, a coluna Data mostra o vencimento daquela ocorrência do mês (não a data de início da conta fixa).",
      "Selecione os lançamentos \"Pendentes\" e clique em Enviar para compartilhar — mostra uma confirmação com o nome de quem vai receber antes de enviar de verdade. Se o lançamento for parcelado, enviar uma parcela compartilha automaticamente TODAS as parcelas daquele lançamento ainda não enviadas, não só a do mês selecionado; se for conta fixa, gera de uma vez as parcelas dos próximos 10 meses (mesma janela usada na tela Início) — não é preciso enviar mês a mês.",
      "Tanto um lançamento \"Não enviado\" quanto um já \"Enviado\" podem ser excluídos direto na linha (botão de lixeira) ou em lote, marcando vários e clicando no botão \"Excluir\" da faixa de baixo (funciona com uma mistura de pendentes e já enviados ao mesmo tempo, cada um tratado da forma certa). Em ambos os casos sai da lista de Envios e não volta a aparecer sozinho como pendência depois — nem no mês excluído, nem, ao escolher \"este mês e os futuros\"/\"todos\", nos meses seguintes de uma conta fixa (mesmo os que nunca chegaram a ser enviados); o lançamento e o reembolso configurado nele continuam intactos em Contas a Pagar. Para voltar a enviar, use o botão \"Reenviar\" na tela Contas a Pagar → Lançamentos. A exclusão (individual ou em lote) pergunta o alcance: apenas este mês, este mês e os futuros, ou todos desde o início (mesma mensagem já usada para excluir contas fixas em Contas a Pagar) — quando é em lote, o alcance escolhido vale para todos os selecionados.",
      "Para enviar de novo um lançamento que já foi excluído (ou nunca foi vinculado), use o botão de reenvio (avião de papel) na tela Contas a Pagar → Lançamentos, ao lado do lançamento — ele pergunta o alcance (mês/futuros/tudo) e gera a pendência direto aqui em Envios.",
      "O checkbox do cabeçalho marca/desmarca os itens visíveis na página atual (conforme o filtro Status selecionado); a setinha ao lado abre um menu só com \"Todas as páginas\", valendo para todos os itens do mês, também conforme o filtro Status. Só os itens \"Pendentes\" selecionados entram no envio; qualquer item selecionado (pendente ou já enviado) entra na exclusão em lote.",
      "Se a outra pessoa ainda não tiver \"Compartilhar Lançamentos\" ativo (ou o vínculo mútuo não existir), nada de financeiro é enviado: ela recebe uma notificação (sino) convidando a ativar, e você também recebe uma notificação avisando que está aguardando ela ativar/configurar o recebimento. Os lançamentos que você tentou enviar continuam em Envios com o selo \"Não enviado\".",
      "Em Recebidos só aparecem os lançamentos ainda \"Não Lançado\" (o sistema não guarda histórico do que já foi lançado) — a lista também traz as colunas Credor, Observação, Aplicação, Parcela (ex.: \"1/3\" ou \"Fixa\") e Reembolso, com as mesmas informações do lançamento original do outro usuário. O cabeçalho tem o mesmo checkbox com setinha (\"Todas as páginas\") usado em Envios, e o mesmo botão \"Excluir\" para excluir vários recebidos de uma vez. Para conta fixa, a coluna Data mostra o vencimento daquela ocorrência do mês, já que conta fixa não tem \"data da compra\".",
      "Ao Lançar, o sistema respeita a estrutura original: se era uma conta fixa, cria uma conta fixa na sua conta (cobrindo os meses seguintes automaticamente, sem precisar lançar mês a mês); se era parcelado, cria um lançamento com o mesmo número de parcelas de uma vez. Nos dois casos, todas as ocorrências daquele lançamento saem da lista de Recebidos de uma vez, já que passam a existir como um lançamento comum em Contas a Pagar.",
      "Ao lançar um recebido: o Credor vem travado com o nome de quem enviou (abreviado se for muito longo), a observação é copiada do lançamento original, e o lançamento nunca é do tipo Provisão nem tem reembolso associado — por isso a Provisão não aparece nas opções de grupo desse fluxo.",
      "Selecionar vários recebidos e clicar em Lançar abre um processo sequencial: um lançamento de origem por vez (mesmo que ele tenha várias parcelas), mostrando \"Lançamento X de Y\", o credor e o valor total daquele lançamento. Para cada um você escolhe o grupo e a aplicação (a aplicação já vem pré-selecionada com a sugestão de quem enviou, se ela já existir na sua lista, ou com a primeira da sua lista) e clica em \"Lançar e ir para o próximo\" — só nesse clique aquele item específico é efetivamente gravado em Contas a Pagar; os demais continuam esperando sua vez. O grupo escolhido fica marcado como padrão para o próximo item, pra não precisar reselecionar toda hora.",
      "Quando a aplicação sugerida por quem enviou ainda não existe na sua lista, aparece um link \"Criar aplicação '...' e usar aqui\" abaixo do seletor; ao clicar, a aplicação é criada na sua lista de Configurações (com esse nome exato) e já fica selecionada para aquele lançamento — não é preciso ir até Configurações separadamente.",
      "Fechar o processo no meio (botão \"Parar por aqui\", ou \"Cancelar\" se ainda estiver no primeiro item) é seguro: os lançamentos já confirmados nos passos anteriores continuam lançados normalmente (já saíram de Recebidos), e os que ainda não chegaram a ser confirmados voltam a aparecer como pendência em Recebidos, ainda selecionados — basta clicar em Lançar de novo para retomar de onde parou.",
      "Enquanto um recebido ainda não foi lançado, dá para excluí-lo (parcela única, fixo ou parcelado) — a exclusão pergunta o alcance: apenas este mês, este mês e os futuros, ou todos desde o início (mesma mensagem já usada para excluir contas fixas em Contas a Pagar). Tanto lançar quanto excluir um recebido são definitivos: quem enviou não volta a ver aquilo como pendência de envio depois.",
      "Se você editar o valor de uma conta fixa já compartilhada (\"deste mês em diante\" ou \"tudo\"), quem recebeu é avisado por notificação — os itens ainda \"Não Lançado\" já são atualizados com o novo valor; o que a pessoa já lançou não muda sozinho (já virou uma despesa independente na conta dela).",
      "Desativar \"Compartilhar Lançamentos\" em Configurações com itens enviados/recebidos existentes pede confirmação: a aba some do menu e novos lançamentos param de alimentar o fluxo, mas o que já existe continua acessível se você reativar depois.",
      "O sino (no canto superior direito, ou no rodapé do menu lateral quando o menu está no modo Vertical) avisa sobre lançamentos recebidos, convites e atualizações de valor: o número em vermelho é a quantidade de notificações ainda não vistas. Clicar numa notificação de lançamento recebido ou de atualização de valor leva direto para a aba Recebidos, já no mês da primeira parcela; clicar num convite só mostra a mensagem. Em todos os casos, a notificação some da lista depois de aberta uma vez.",
      "As notificações também podem ser excluídas manualmente: passe o mouse sobre uma notificação no sino para ver o \"x\" de exclusão individual, ou use o link \"Limpar tudo\" no topo da lista para apagar todas de uma vez (pede confirmação antes de excluir).",
    ],
    validacoes: [],
    imagem: "/ajuda/lancamentos-compartilhados.png",
    imagemAlt: "Aba Lançamentos Compartilhados com a chave Envios/Recebidos",
    marcadores: [
      { numero: 1, xPct: 13.6, yPct: 29.3, texto: "Chave: alterna entre os lançamentos que você enviou e os que recebeu de outra pessoa." },
      {
        numero: 2,
        xPct: 9.6,
        yPct: 38.4,
        texto: "Excluir os selecionados em lote, ou Enviar (Envios) / Lançar (Recebidos) — sempre com confirmação antes.",
      },
      { numero: 3, xPct: 87.3, yPct: 38.4, texto: "Navega entre os meses — filtra tanto Envios quanto Recebidos." },
      {
        numero: 4,
        xPct: 22.9,
        yPct: 45.9,
        texto: "Lista única com o selo Enviado/Não enviado (Envios) ou Não Lançado (Recebidos).",
      },
    ],
  },
  {
    id: "renegociacao",
    categoria: "Contas a Pagar",
    titulo: "Contas a Pagar · Renegociação",
    resumo:
      "Encerra os lançamentos de um grupo (à vista ou fixo) e os substitui por um novo lançamento — útil quando você renegocia uma dívida ou troca as condições de um parcelamento.",
    regras: [
      "Escolha um único grupo por vez — o sistema mostra o total já lançado dele no mês.",
      "Duas opções de alcance: \"apenas o mês atual\" (só os lançamentos/parcelas deste mês) ou \"valores atuais e futuros\" (inclui os meses seguintes e contas fixas, que passam a valer a partir do novo lançamento, mesmo as que só começam depois do mês escolhido).",
      "Em seguida, o sistema pergunta se os recebimentos de reembolso vinculados aos lançamentos substituídos também devem ser excluídos: \"Sim\" apaga esses recebimentos junto (comportamento tradicional); \"Não\" mantém esses recebimentos intactos em Contas a Receber, mesmo com o lançamento de origem tendo sido substituído.",
      "Depois de responder sobre os recebimentos, abre o formulário de novo lançamento com o grupo travado e os campos \"Conta fixa\"/\"Provisão\"/\"Data da compra\" desabilitados — o valor mostrado no topo é o total que está sendo renegociado, junto com a escolha feita sobre os recebimentos.",
      "Só ao clicar em \"Salvar Renegociação\" é que os lançamentos antigos são apagados (e os recebimentos, se essa opção foi escolhida) e o novo é criado; cancelar não grava nada.",
      "Cada renegociação recebe um número sequencial (001, 002...) e fica registrada no histórico, junto com o grupo, o alcance, o mês de referência e se os recebimentos foram excluídos ou mantidos.",
      "Lançamentos e recebimentos gerados por uma renegociação ganham o selo \"Renegociação\" e não podem ser editados ou excluídos diretamente em Contas a Pagar/Receber.",
      "Excluir uma renegociação no histórico desfaz tudo: restaura os lançamentos originais exatamente como estavam (e os recebimentos também, caso a opção de excluí-los tenha sido usada) e remove o que foi criado por ela. Uma renegociação mais recente que já substituiu essa não pode ser desfeita fora de ordem.",
    ],
    validacoes: [
      "Tentar marcar um segundo grupo no filtro mostra um aviso de que só é possível renegociar um por vez.",
    ],
    imagem: "/ajuda/renegociacao.png",
    imagemAlt: "Aba Renegociação com filtro de grupo, total e histórico",
    marcadores: [
      { numero: 1, xPct: 17, yPct: 37, texto: "Grupo a renegociar — seleção única." },
      { numero: 2, xPct: 18, yPct: 55, texto: "Total já lançado desse grupo no mês (ou nos meses futuros, conforme o alcance)." },
      { numero: 3, xPct: 86, yPct: 55, texto: "Escolhe o alcance e abre o formulário do novo lançamento." },
      {
        numero: 4,
        xPct: 12,
        yPct: 85,
        texto: "Histórico de renegociações — número, alcance e mês, com opção de desfazer (Excluir).",
      },
    ],
  },
  {
    id: "receber-novo",
    categoria: "Contas a Receber",
    titulo: "Contas a Receber · Novo recebimento",
    resumo: "Formulário para lançar uma entrada manual — salário, venda, reembolso avulso, etc.",
    regras: [
      "Assim como em Contas a Pagar, marcar \"Conta fixa (recorrente)\" transforma o lançamento em uma recorrência mensal.",
      "Uma chave discreta acima do campo de valor alterna entre \"Valor total\" e \"Valor da parcela\" (o rótulo do campo muda junto): com a chave desligada (padrão), o valor digitado é dividido igualmente entre as parcelas — eventuais centavos de arredondamento vão para a primeira; com a chave ligada, o valor digitado é lançado integralmente em cada parcela/mês. Ex.: R$ 1.000,00 com 2 parcelas e a chave desligada lança 2x de R$ 500,00; com a chave ligada, lança 2x de R$ 1.000,00.",
      "Ao marcar \"Conta fixa (recorrente)\", a chave é travada em \"Valor da parcela\", pelo mesmo motivo de Contas a Pagar.",
      "O campo de valor também tem máscara de R$, igual ao de Contas a Pagar.",
      "O botão \"Cancelar\" ao lado de \"Salvar\" limpa todos os campos do formulário, sem sair da tela — útil para recomeçar o preenchimento do zero.",
    ],
    validacoes: [
      "Origem, valor, data e parcelas são obrigatórios.",
      "As mesmas mensagens de valor/parcela inválidos do formulário de Contas a Pagar se aplicam aqui.",
    ],
    imagem: "/ajuda/receber-novo.png",
    imagemAlt: "Formulário de novo recebimento em Contas a Receber",
    marcadores: [
      { numero: 1, xPct: 50, yPct: 27, texto: "De onde vem o dinheiro (empresa, pessoa, etc.)." },
      { numero: 2, xPct: 50, yPct: 37.3, texto: "Valor, número de parcelas e data do 1º recebimento." },
      { numero: 3, xPct: 34, yPct: 43, texto: "Vira uma recorrência mensal (ex.: salário)." },
    ],
  },
  {
    id: "receber-lista",
    categoria: "Contas a Receber",
    titulo: "Contas a Receber · Recebimentos",
    resumo:
      "Lista os recebimentos do mês — manuais, fixos e gerados automaticamente por reembolso — com os totais \"Total a receber no mês\" e \"Recebido\".",
    regras: [
      "Recebimentos originados de um reembolso de Contas a Pagar não podem ser editados ou excluídos diretamente aqui — é preciso alterar o lançamento original em Contas a Pagar.",
      "Qualquer outro recebimento lançado por você (avulso, parcelado ou fixo) pode ter o valor editado por aqui, inclusive individualmente por parcela/mês — a única exceção é o recebimento vindo de reembolso, que continua bloqueado.",
      "Contas fixas de recebimento (ex.: salário) seguem a mesma lógica de recorrência do Contas a Pagar: aparecem todo mês automaticamente.",
      "O total \"Recebido\" só soma os itens marcados com o checkbox — o quadradinho \"Recebimentos do mês\" da tela Início usa esse mesmo critério.",
      "O filtro Valor aceita o valor exato do recebimento, já com máscara de R$.",
      "O checkbox do cabeçalho marca/desmarca como recebido na página atual; a setinha ao lado abre um menu só com \"Todas as páginas\" — pede confirmação antes de aplicar.",
      "Recebimentos com o selo \"Renegociação\" vieram de uma renegociação em Contas a Pagar e não podem ser editados ou excluídos por aqui.",
      "Recebimentos criados pelo app mobile mostram um ícone discreto de celular com a palavra \"Mobile\" abaixo da origem, junto do grupo (quando houver).",
    ],
    validacoes: [
      "Tentar editar ou excluir um recebimento de reembolso é bloqueado, com mensagem explicativa e botão \"Entendi\".",
    ],
    imagem: "/ajuda/receber-lista.png",
    imagemAlt: "Lista de recebimentos do mês com totais",
    marcadores: [
      { numero: 1, xPct: 31.9, yPct: 20.7, texto: "Filtro por origem, reembolso, grupo e valor." },
      { numero: 2, xPct: 84.4, yPct: 20.7, texto: "Navega entre os meses." },
      { numero: 3, xPct: 15, yPct: 20.7, texto: "Total previsto para o mês, considerando as origens marcadas." },
      { numero: 4, xPct: 24, yPct: 20.7, texto: "Soma apenas do que já foi marcado como recebido." },
      { numero: 5, xPct: 12, yPct: 28.8, texto: "Quantidade de origens e soma dos valores da lista." },
      {
        numero: 6,
        xPct: 12.5,
        yPct: 33.4,
        texto: "Marcar todos como recebido: só nesta página, ou todos os resultados de todas as páginas (com confirmação).",
      },
      { numero: 7, xPct: 11.3, yPct: 45.5, texto: "Marque quando o dinheiro cair na conta." },
    ],
  },
  {
    id: "relatorio-modelo-i",
    categoria: "Relatórios",
    titulo: "Relatórios · Modelo I",
    resumo:
      "Relatório do mês selecionado com totais por grupo, por aplicação e por reembolso, além da lista completa de lançamentos (na impressão/PDF). Recurso do plano Premium.",
    regras: [
      "O reembolso é calculado ao vivo, a partir das contas do mês e da configuração de cada pessoa — por isso é sempre a referência \"correta\" para conferir os valores, mesmo que a tela de Recebimentos ainda não tenha os lançamentos gerados.",
      "\"Compartilhar\" gera um PDF e tenta abrir o menu nativo de compartilhamento do dispositivo (WhatsApp, e-mail, etc.); se o navegador não suportar, o PDF é baixado diretamente.",
      "A lista completa de lançamentos só aparece na versão impressa/PDF, não na tela.",
    ],
    validacoes: [],
    imagem: "/ajuda/relatorio-modelo-i.png",
    imagemAlt: "Relatório Modelo I com totais por grupo, aplicação e reembolso",
    marcadores: [
      { numero: 1, xPct: 28, yPct: 22, texto: "Filtros por grupo, aplicação e reembolso." },
      { numero: 2, xPct: 55.5, yPct: 22, texto: "Gera o PDF do relatório para imprimir ou compartilhar." },
      { numero: 3, xPct: 90, yPct: 22, texto: "Navega entre os meses do relatório." },
      { numero: 4, xPct: 82, yPct: 34.5, texto: "Quanto você recebe de volta de cada pessoa que divide as contas." },
      { numero: 5, xPct: 69, yPct: 48.7, texto: "Total geral e total do reembolso somado." },
    ],
  },
  {
    id: "relatorio-modelo-ii",
    categoria: "Relatórios",
    titulo: "Relatórios · Modelo II",
    resumo:
      "Igual ao Modelo I, mas com período customizável (De/Até) e busca por nome de credor. Recurso do plano Premium.",
    regras: [
      "Os mesmos cálculos do Modelo I são aplicados ao intervalo de datas escolhido, em vez de um único mês fixo.",
      "Por padrão, o período já abre preenchido com o mês atual inteiro.",
    ],
    validacoes: [
      "As datas devem estar no formato dd/mm/aaaa; sair do campo, clicar em Imprimir ou em Compartilhar sem uma data válida preenchida mostra mensagem de erro e bloqueia a ação.",
      "A data final não pode ser anterior à data inicial.",
    ],
    imagem: "/ajuda/relatorio-modelo-ii.png",
    imagemAlt: "Relatório Modelo II com período customizável e busca por credor",
    marcadores: [
      { numero: 1, xPct: 8.7, yPct: 24.7, texto: "Busca por nome de um credor específico." },
      { numero: 2, xPct: 69, yPct: 21.7, texto: "Data inicial e final do período do relatório." },
      { numero: 3, xPct: 5.5, yPct: 31, texto: "Gera o PDF do relatório para imprimir ou compartilhar." },
    ],
  },
  {
    id: "relatorio-modelo-iii",
    categoria: "Relatórios",
    titulo: "Relatórios · Modelo III",
    resumo:
      "Igual ao Modelo I, mas sem o filtro de aplicação e mostrando só os lançamentos ainda não pagos do mês selecionado. Recurso do plano Premium.",
    regras: [
      "Um aviso no topo da tela deixa explícito que este relatório traz apenas os lançamentos não pagos do mês — os totais e a lista de lançamentos seguem esse mesmo recorte.",
      "Não existe filtro de Aplicação aqui (diferente do Modelo I); é possível filtrar só por Grupo e Reembolso.",
      "Os resumos (por grupo, por aplicação e por reembolso) e a lista completa de lançamentos na impressão/PDF seguem a mesma lógica do Modelo I, mas sempre restritos ao que ainda está pendente no mês.",
      "\"Compartilhar\" gera um PDF e tenta abrir o menu nativo de compartilhamento do dispositivo (WhatsApp, e-mail, etc.); se o navegador não suportar, o PDF é baixado diretamente.",
    ],
    validacoes: [],
    imagem: "/ajuda/relatorio-modelo-iii.png",
    imagemAlt: "Relatório Modelo III com aviso de lançamentos não pagos do mês",
    marcadores: [
      { numero: 1, xPct: 15.9, yPct: 18.5, texto: "Filtros por grupo e reembolso — sem filtro de aplicação." },
      { numero: 2, xPct: 36.2, yPct: 18.5, texto: "Gera o PDF do relatório para imprimir ou compartilhar." },
      { numero: 3, xPct: 85.3, yPct: 18.5, texto: "Navega entre os meses do relatório." },
      { numero: 4, xPct: 23.3, yPct: 22.7, texto: "Aviso de que o relatório traz só os lançamentos não pagos do mês." },
      { numero: 5, xPct: 23, yPct: 33.7, texto: "Totais calculados só com os lançamentos ainda não pagos do mês selecionado." },
    ],
  },
  {
    id: "relatorio-modelo-iv",
    categoria: "Relatórios",
    titulo: "Relatórios · Modelo IV",
    resumo:
      "Igual ao Modelo I, mas com um Top 10 dos lançamentos mais caros do mês logo abaixo dos totais. Recurso do plano Premium.",
    regras: [
      "Os filtros (Grupo, Aplicação, Reembolso), os totais por grupo/aplicação/reembolso e a lista completa de lançamentos na impressão/PDF seguem exatamente a mesma lógica do Modelo I — por padrão todos os itens de cada filtro vêm selecionados.",
      "Logo abaixo dos quadrados de totais aparece o \"Top 10 · Lançamentos mais caros\": os até 10 lançamentos de maior valor dentro dos filtros e do mês selecionados, ordenados do mais caro para o mais barato — diferente da lista completa, este Top 10 aparece direto na tela, não só na impressão/PDF.",
      "Cada linha do Top 10 mostra Credor, Observação, Aplicação, Parcela, Reembolso e Valor do lançamento.",
      "As três primeiras posições exibem uma medalha (ouro, prata e bronze) centralizada entre o número de colocação e o nome do credor; da 4ª à 10ª posição esse espaço fica vazio.",
      "\"Compartilhar\" gera um PDF e tenta abrir o menu nativo de compartilhamento do dispositivo (WhatsApp, e-mail, etc.); se o navegador não suportar, o PDF é baixado diretamente.",
    ],
    validacoes: [],
    imagem: "/ajuda/relatorio-modelo-iv.png",
    imagemAlt: "Relatório Modelo IV com Top 10 dos lançamentos mais caros do mês",
    marcadores: [
      { numero: 1, xPct: 19.1, yPct: 20, texto: "Filtros por grupo, aplicação e reembolso, iguais ao Modelo I." },
      { numero: 2, xPct: 39.5, yPct: 20, texto: "Gera o PDF do relatório para imprimir ou compartilhar." },
      { numero: 3, xPct: 84.8, yPct: 20, texto: "Navega entre os meses do relatório." },
      { numero: 4, xPct: 16.3, yPct: 56.9, texto: "Top 10 dos lançamentos mais caros do mês, já considerando os filtros selecionados." },
      { numero: 5, xPct: 14.6, yPct: 65.3, texto: "1º, 2º e 3º lugares aparecem com medalha de ouro, prata e bronze entre o número e o credor." },
    ],
  },
  {
    id: "dashboard",
    categoria: "Dashboard",
    titulo: "Dashboard",
    resumo:
      "Visão gráfica com filtros, alternância entre Contas a Pagar e Contas a Receber, e quatro gráficos (grupo, aplicação, tipo de reembolso e lançamentos parcelados) em pizza ou barras. Recurso do plano Premium.",
    regras: [
      "Alterna entre a visão de Contas a Pagar e Contas a Receber usando o mesmo conjunto de filtros.",
      "Os cartões do topo (Total filtrado, Pago, Pendente, Lançamentos) refletem os filtros e o mês selecionados.",
      "Pizza é o formato padrão ao abrir a tela — cada fatia mostra o valor e o percentual numa lista ao lado, sem sobrepor rótulos. Barras usa o mesmo conjunto de dados.",
      "Em telas de computador: cada quadro se ajusta ao espaço disponível na tela — quando a lista de itens cabe inteira, não aparece barra de rolagem; quando não cabe, só aquele quadro fica rolável (passando o scroll do mouse por cima dele), sem rolar a página inteira. Em monitores muito baixos, os quatro quadros nunca ficam menores que um tamanho mínimo legível, e a própria página passa a rolar se faltar espaço. Em celular, os quatro quadros ficam empilhados um abaixo do outro (em vez de em grade), cada um com sua altura normal, e a página inteira rola para revelar todos.",
      "\"Tipo de reembolso\" agrupa pelos nomes cadastrados em Configurações (e por \"(sem reembolso)\" quando não há divisão). \"Lançamentos parcelados\" separa quanto do total do mês é parcelado e quanto é à vista.",
    ],
    validacoes: [],
    imagem: "/ajuda/dashboard.png",
    imagemAlt: "Dashboard analítico com gráficos de grupo, aplicação, reembolso e parcelamento",
    marcadores: [
      { numero: 1, xPct: 15.9, yPct: 12.4, texto: "Filtros por grupo, reembolso e aplicação." },
      { numero: 2, xPct: 73, yPct: 12.4, texto: "Alterna entre Contas a Pagar e Contas a Receber." },
      { numero: 3, xPct: 19.8, yPct: 21.4, texto: "Total filtrado, pago, pendente e quantidade de lançamentos do mês." },
      { numero: 4, xPct: 86.1, yPct: 30.2, texto: "Alterna o tipo de gráfico entre pizza (padrão) e barras." },
      { numero: 5, xPct: 11.7, yPct: 36.1, texto: "Distribuição por grupo." },
      { numero: 6, xPct: 51.2, yPct: 36.1, texto: "Distribuição por aplicação." },
      { numero: 7, xPct: 11.7, yPct: 62.4, texto: "Distribuição por tipo de reembolso." },
      { numero: 8, xPct: 51.2, yPct: 62.4, texto: "Quanto do total do mês é parcelado e quanto é à vista." },
    ],
  },
  {
    id: "configuracoes-geral",
    categoria: "Configurações",
    titulo: "Configurações · Geral I",
    resumo:
      "Personalização das listas usadas nos formulários (grupos e aplicações) e preferências gerais: resumos do relatório, sugestão de credor, itens por página, menu, mini-dashboard da Início e tema.",
    regras: [
      "\"Fixas\" e \"Provisões\" são grupos protegidos pelo sistema e não podem ser removidos — eles sustentam as regras de recorrência e de zeragem de Provisões pagas.",
      "Um item (grupo ou aplicação) que já está em uso em algum lançamento não pode ser removido — desative-o em vez de excluir, para preservar o histórico.",
      "Cada grupo e cada aplicação pode ter uma observação própria (ícone de balão) — só um lembrete visível ao editar o item, não aparece nos lançamentos.",
      "Todo grupo pode ser inativado (botão \"Inativar\"), pedindo o mês a partir do qual ele deixa de valer. O sistema bloqueia a inativação se já houver lançamento avulso a partir daquele mês, ou recorrência (conta fixa) do grupo que ainda não tinha encerrado antes dele — mesmo que essa recorrência só comece depois do mês escolhido. Enquanto inativo, o grupo some do formulário de novo lançamento e de todos os filtros por grupo (Lançamentos, Renegociação, Relatórios, Dashboard, Início) — os lançamentos que já existem nesse grupo não são alterados nem excluídos. O botão \"Ativar\" reverte na hora, sem pedir mês, e o grupo volta a aparecer normalmente em tudo.",
      "O tema escuro é exclusivo do plano Premium.",
      "O menu do sistema pode ser Horizontal (padrão, barra no topo) ou Vertical (menu lateral recolhível, com Perfil e Sair no rodapé) — a mudança vale para todas as telas. No modo Vertical, o sino de notificações também fica no rodapé do menu lateral (em vez do canto superior direito) e abre para cima.",
      "O card \"Mini-dashboard na tela de Início\" controla o mini-dashboard de grupos que aparece no final da tela Início: a chave liga/desliga a exibição dele lá, e os botões escolhem entre pizza ou barras nos três gráficos. Cada quadro fica do tamanho do gráfico (a lista de nomes rola com o mouse dentro do próprio quadro, sem cortar linha). Em monitores com pouca altura de tela, ele se adapta automaticamente: primeiro troca os gráficos por uma lista simples com os mesmos valores e, se ainda faltar espaço, a Janela de 10 meses deixa de ficar fixa e passa a rolar junto — só os totalizadores e os filtros de grupo continuam fixos no topo — garantindo que o mini-dashboard sempre possa ser alcançado rolando a tela.",
      "O card \"Subtotal e Provisão na tela de Início\" liga/desliga as linhas \"Subtotal\" e \"Provisão Líquido\" ao final da Janela de 10 meses, na tela Início — desativado por padrão para novas contas.",
    ],
    validacoes: [
      "Item duplicado ao adicionar: \"Este item já existe na lista.\"",
      "Tentativa de remover item em uso: mensagem citando o nome do item e explicando que ele está em uso.",
      "Tentativa de remover \"Fixas\" ou \"Provisões\": mensagem específica de item protegido do sistema.",
      "Tentativa de inativar um grupo com lançamento a partir do mês escolhido: mensagem citando o nome do grupo e o mês.",
    ],
    imagem: "/ajuda/configuracoes-geral.png",
    imagemAlt: "Aba Geral I das Configurações, com listas editáveis e preferências",
    marcadores: [
      { numero: 1, xPct: 11.6, yPct: 29.5, texto: "Quais resumos aparecem nos Relatórios." },
      { numero: 2, xPct: 31.3, yPct: 29.5, texto: "Ativa/desativa a sugestão de credores já usados." },
      { numero: 3, xPct: 49.4, yPct: 29.5, texto: "Quantos itens aparecem por página nas listagens." },
      { numero: 4, xPct: 68.7, yPct: 29.5, texto: "Menu horizontal (padrão) ou vertical." },
      { numero: 5, xPct: 88.4, yPct: 29.5, texto: "Tema claro/escuro (escuro é Premium)." },
      { numero: 6, xPct: 25.6, yPct: 53.7, texto: "Grupos — itens com cadeado são protegidos; balão edita a observação." },
      { numero: 7, xPct: 74.3, yPct: 53.7, texto: "Aplicações usadas para categorizar cada conta." },
    ],
  },
  {
    id: "configuracoes-geral-ii",
    categoria: "Configurações",
    titulo: "Configurações · Geral II",
    resumo:
      "Reembolsos (pessoas com quem você divide contas) e a integração de Compartilhar Lançamentos com outro usuário do sistema.",
    regras: [
      "Reembolso tem três modos: \"Recebo 100% do valor\", \"Recebo 50% do valor\" e \"Não gera valor a receber\".",
      "Ao escolher o modo \"Recebo 100% do valor\" ou \"Recebo 50% do valor\", o sistema acrescenta automaticamente o percentual ao final do nome (ex.: \"Gustavo\" vira \"Gustavo 100%\"); voltando para \"Não gera valor a receber\", o percentual é removido do nome. Essa troca de nome é propagada automaticamente para os lançamentos que já usam esse reembolso.",
      "Um reembolso já em uso em algum lançamento não pode ser removido — desative-o em vez de excluir, para preservar o histórico.",
      "O card \"Compartilhar Lançamentos\" ativa a integração com outro usuário do sistema: vincule um e-mail a cada reembolso cadastrado ao lado — um check verde confirma que o e-mail existe no sistema; se não existir, aparece um aviso. O mesmo e-mail pode ser vinculado a mais de um reembolso (útil quando a mesma pessoa tem percentuais diferentes, ex.: \"Cônjuge 50%\" e \"Cônjuge Aluguel 100%\"). Veja Contas a Pagar → Lançamentos Compartilhados para o restante do fluxo.",
      "Desativar \"Compartilhar Lançamentos\" com itens já enviados ou recebidos pede confirmação antes de aplicar (ver artigo de Lançamentos Compartilhados).",
    ],
    validacoes: [
      "Tentativa de remover um reembolso em uso: mensagem citando o nome do item e explicando que ele está em uso.",
    ],
    imagem: "/ajuda/configuracoes-geral-ii.png",
    imagemAlt: "Aba Geral II das Configurações, com Reembolsos e Compartilhar Lançamentos",
    marcadores: [
      { numero: 1, xPct: 11, yPct: 30, texto: "Reembolsos cadastrados — mesmo conteúdo que já existia em Geral." },
      { numero: 2, xPct: 95, yPct: 30, texto: "Ativa/desativa o compartilhamento de lançamentos com outro usuário." },
      { numero: 3, xPct: 74, yPct: 49, texto: "Vincule cada reembolso a um e-mail cadastrado no sistema — o check verde confirma que ele existe." },
    ],
  },
  {
    id: "configuracoes-seguranca",
    categoria: "Configurações",
    titulo: "Configurações · Segurança",
    resumo: "Alteração de senha da conta.",
    regras: ["O e-mail de login não pode ser alterado."],
    validacoes: [
      "A nova senha precisa ter no mínimo 6 caracteres.",
      "A confirmação precisa ser idêntica à nova senha.",
      "Senha atual incorreta gera uma mensagem de erro específica.",
    ],
    imagem: "/ajuda/configuracoes-seguranca.png",
    imagemAlt: "Aba Segurança das Configurações, com formulário de troca de senha",
    marcadores: [
      { numero: 1, xPct: 20, yPct: 30, texto: "E-mail de login — não pode ser alterado." },
      { numero: 2, xPct: 20, yPct: 42.6, texto: "Sua senha atual, para confirmar que é você." },
      { numero: 3, xPct: 20, yPct: 52.5, texto: "Nova senha desejada." },
      { numero: 4, xPct: 20, yPct: 69, texto: "Confirma a troca de senha." },
    ],
  },
  {
    id: "plano",
    categoria: "Plano",
    titulo: "Plano",
    resumo:
      "Mostra o plano atual (Free ou Premium), desde quando está ativo, a forma de pagamento e a periodicidade, com opção de alterar.",
    regras: [
      "Recursos Premium (Relatórios, Dashboard, tema escuro) ficam bloqueados no plano Free — ao tentar acessá-los, o sistema redireciona de volta para Início.",
    ],
    validacoes: [],
    imagem: "/ajuda/plano.png",
    imagemAlt: "Tela do plano atual da conta",
    marcadores: [
      { numero: 1, xPct: 66, yPct: 16, texto: "Selo indicando se o plano é Free ou Premium." },
      { numero: 2, xPct: 35, yPct: 24, texto: "Desde quando o plano atual está ativo, forma de pagamento e periodicidade." },
      { numero: 3, xPct: 50, yPct: 35, texto: "Abre o fluxo para trocar de plano." },
    ],
  },
];

export function buscarArtigos(termo: string): ArtigoAjuda[] {
  const q = termo.trim().toLowerCase();
  if (!q) return ARTIGOS_AJUDA;
  return ARTIGOS_AJUDA.filter((a) => {
    const alvo = [
      a.titulo,
      a.categoria,
      a.resumo,
      ...a.regras,
      ...a.validacoes,
      ...a.marcadores.map((m) => m.texto),
    ]
      .join(" ")
      .toLowerCase();
    return alvo.includes(q);
  });
}
