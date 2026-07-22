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
      "Na primeira vez, o sistema cria automaticamente as listas padrão (formas de pagamento, aplicações) para a conta nova.",
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
      "Tela inicial: totalizadores do mês, filtro por forma de pagamento, Janela de 10 meses (com baixa em massa e link para os lançamentos) e um mini-dashboard das formas de pagamento marcadas.",
    regras: [
      "Os valores ficam ocultos por padrão a cada novo login, por privacidade — clique no ícone de olho para mostrar ou esconder. Essa preferência e os filtros de forma de pagamento marcados ficam salvos durante a sessão do navegador.",
      "Contas do grupo \"Provisões\" marcadas como pagas contam como R$ 0 no total do mês — a lógica assume que esse dinheiro já foi separado/reservado antes.",
      "Contas fixas (recorrentes) aparecem automaticamente todo mês, mesmo antes de serem pagas. Elas só viram um lançamento de verdade no banco de dados quando você marca como paga ou edita algum dado daquele mês.",
      "Quando a conta tem um reembolso configurado (uma pessoa que divide a despesa com você), o sistema calcula automaticamente quanto você recebe de volta e cria um recebimento correspondente em Contas a Receber.",
      "Marcar uma conta fixa de Provisões como paga remove automaticamente o reembolso pendente dela (o valor efetivo virou zero); desmarcar o pagamento recria esse reembolso.",
      "A Janela de 10 meses substitui a antiga lista de lançamentos individuais: cada linha é uma forma de pagamento, com um checkbox para marcar/desmarcar todos os lançamentos daquele grupo no mês de uma vez, um link direto para os lançamentos filtrados em Contas a Pagar, e o selo Pago/Parcial/Pendente.",
      "Abaixo da janela, um mini-dashboard mostra, só para as formas de pagamento marcadas nos filtros, o valor por forma de pagamento, a quantidade de lançamentos por forma de pagamento e a distribuição por aplicação no mês — em pizza ou em barras.",
      "O rodapé mostra a versão atual do sistema, que é atualizada a cada alteração ou correção feita.",
    ],
    validacoes: [],
    imagem: "/ajuda/inicio.png",
    imagemAlt: "Tela Início com totalizadores, Janela de 10 meses e mini-dashboard",
    marcadores: [
      { numero: 1, xPct: 16.6, yPct: 11.8, texto: "Totalizadores do mês: gastos, recebimentos, pago, pendente e líquido." },
      { numero: 2, xPct: 82.9, yPct: 11.8, texto: "Mostra/oculta os valores e navega entre os meses." },
      { numero: 3, xPct: 19, yPct: 16.8, texto: "Filtro por forma de pagamento — marque para revelar cada grupo." },
      {
        numero: 4,
        xPct: 16,
        yPct: 29.5,
        texto:
          "Cada linha: status do grupo (Pago/Parcial/Pendente), checkbox para dar baixa em todos os lançamentos daquele grupo no mês, e link para vê-los em Contas a Pagar.",
      },
      { numero: 5, xPct: 44.6, yPct: 25, texto: "Navega entre os 10 meses da janela." },
      { numero: 6, xPct: 89.2, yPct: 20.7, texto: "Oculta ou mostra a Janela de 10 meses." },
      { numero: 7, xPct: 86.1, yPct: 46.8, texto: "Alterna entre pizza e barras, ou oculta o mini-dashboard." },
      {
        numero: 8,
        xPct: 47.8,
        yPct: 70.8,
        texto: "Mini-dashboard: valor, quantidade de lançamentos e aplicações das formas de pagamento marcadas.",
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
      "O campo Valor total tem máscara de R$: os dígitos digitados formam a parte inteira (ex.: 1, 10, 100... vira 1.000,00), e a vírgula abre a edição dos centavos.",
      "Se um reembolso (pessoa) for selecionado e ela tiver um modo configurado (100% ou 50%), o sistema já cria automaticamente o(s) recebimento(s) correspondente(s) em Contas a Receber.",
    ],
    validacoes: [
      "Credor, data da compra, início da cobrança, valor total, parcelas, forma de pagamento e aplicação são obrigatórios — mensagem: \"Preencha todos os campos obrigatórios.\"",
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
      { numero: 4, xPct: 50, yPct: 62.3, texto: "Valor total e número de parcelas — a divisão é automática." },
      { numero: 5, xPct: 50, yPct: 72.4, texto: "Forma de pagamento e aplicação — usadas nos filtros e relatórios." },
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
      "É preciso marcar ao menos uma opção em Pagamento, Aplicação ou Reembolso para a lista aparecer — evita mostrar tudo de uma vez sem querer.",
      "Contas fixas ainda não pagas no mês aparecem na lista mesmo sem ter um registro \"real\" no banco de dados ainda; editar ou excluir cria esse registro quando necessário.",
      "Excluir uma conta fixa oferece três alcances: apenas este mês, deste mês em diante, ou a recorrência inteira (com aviso extra, porque é irreversível).",
      "Excluir uma conta com reembolso vinculado também remove o(s) recebimento(s) gerado(s) por ela.",
      "O filtro Valor aceita o valor exato do lançamento, já com máscara de R$ (separador de milhar e centavos automáticos).",
      "O checkbox do cabeçalho marca/desmarca todos os lançamentos como pago só na página atual; ao lado dele, um segundo checkbox marca/desmarca todos os resultados de todas as páginas — esse pede confirmação antes de aplicar, por afetar itens que nem estão visíveis na tela.",
      "Lançamentos com o selo \"Renegociação\" vieram de uma renegociação e não podem ser editados ou excluídos por aqui — veja a aba Renegociação.",
    ],
    validacoes: [
      "Tentar excluir uma conta já marcada como paga é bloqueado, com mensagem explicando que é preciso desmarcar o pagamento antes.",
    ],
    imagem: "/ajuda/lancar-lista.png",
    imagemAlt: "Lista de lançamentos de Contas a Pagar com filtros",
    marcadores: [
      { numero: 1, xPct: 17.2, yPct: 22.8, texto: "Busca por nome do credor." },
      { numero: 2, xPct: 44.6, yPct: 22.8, texto: "Filtros por forma de pagamento, aplicação, reembolso e valor." },
      { numero: 3, xPct: 84.4, yPct: 22.8, texto: "Navega entre os meses." },
      { numero: 4, xPct: 12, yPct: 30.3, texto: "Quantidade de resultados e soma dos valores filtrados." },
      {
        numero: 5,
        xPct: 12.5,
        yPct: 35.1,
        texto: "Marcar todos como pago: só nesta página, ou todos os resultados de todas as páginas (com confirmação).",
      },
      { numero: 6, xPct: 87.4, yPct: 41.2, texto: "Editar ou excluir o lançamento." },
    ],
  },
  {
    id: "renegociacao",
    categoria: "Contas a Pagar",
    titulo: "Contas a Pagar · Renegociação",
    resumo:
      "Encerra os lançamentos de uma forma de pagamento (à vista ou fixa) e os substitui por um novo lançamento — útil quando você renegocia uma dívida ou troca as condições de um parcelamento.",
    regras: [
      "Escolha uma única forma de pagamento por vez — o sistema mostra o total já lançado dela no mês.",
      "Duas opções de alcance: \"apenas o mês atual\" (só os lançamentos/parcelas deste mês) ou \"valores atuais e futuros\" (inclui os meses seguintes e contas fixas, que passam a valer a partir do novo lançamento).",
      "Depois de escolher o alcance, abre o formulário de novo lançamento com a forma de pagamento travada e os campos \"Conta fixa\"/\"Provisão\"/\"Data da compra\" desabilitados — o valor mostrado no topo é o total que está sendo renegociado.",
      "Só ao clicar em \"Salvar Renegociação\" é que os lançamentos antigos são apagados e o novo é criado; cancelar não grava nada.",
      "Cada renegociação recebe um número sequencial (001, 002...) e fica registrada no histórico, junto com a forma de pagamento, o alcance e o mês de referência.",
      "Lançamentos e recebimentos gerados por uma renegociação ganham o selo \"Renegociação\" e não podem ser editados ou excluídos diretamente em Contas a Pagar/Receber.",
      "Excluir uma renegociação no histórico desfaz tudo: restaura os lançamentos e recebimentos originais exatamente como estavam e remove o que foi criado por ela. Uma renegociação mais recente que já substituiu essa não pode ser desfeita fora de ordem.",
    ],
    validacoes: [
      "Tentar marcar uma segunda forma de pagamento no filtro mostra um aviso de que só é possível renegociar uma por vez.",
    ],
    imagem: "/ajuda/renegociacao.png",
    imagemAlt: "Aba Renegociação com filtro de forma de pagamento, total e histórico",
    marcadores: [
      { numero: 1, xPct: 17, yPct: 37, texto: "Forma de pagamento a renegociar — seleção única." },
      { numero: 2, xPct: 18, yPct: 55, texto: "Total já lançado dessa forma de pagamento no mês (ou nos meses futuros, conforme o alcance)." },
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
      "Se não for fixo, o valor é dividido igualmente entre as parcelas informadas.",
      "O campo Valor também tem máscara de R$, igual ao de Contas a Pagar.",
    ],
    validacoes: [
      "Origem, valor, data e parcelas são obrigatórios.",
      "As mesmas mensagens de valor/parcela inválidos do formulário de Contas a Pagar se aplicam aqui.",
    ],
    imagem: "/ajuda/receber-novo.png",
    imagemAlt: "Formulário de novo recebimento em Contas a Receber",
    marcadores: [
      { numero: 1, xPct: 50, yPct: 27, texto: "De onde vem o dinheiro (empresa, pessoa, etc.)." },
      { numero: 2, xPct: 50, yPct: 37.3, texto: "Valor, data do 1º recebimento e número de parcelas." },
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
      "Contas fixas de recebimento (ex.: salário) seguem a mesma lógica de recorrência do Contas a Pagar: aparecem todo mês automaticamente.",
      "O total \"Recebido\" só soma os itens marcados com o checkbox — o quadradinho \"Recebimentos do mês\" da tela Início usa esse mesmo critério.",
      "O filtro Valor aceita o valor exato do recebimento, já com máscara de R$.",
      "O checkbox do cabeçalho marca/desmarca como recebido só na página atual; o segundo checkbox faz o mesmo para todos os resultados de todas as páginas, com confirmação antes de aplicar.",
      "Recebimentos com o selo \"Renegociação\" vieram de uma renegociação em Contas a Pagar e não podem ser editados ou excluídos por aqui.",
    ],
    validacoes: [
      "Tentar editar ou excluir um recebimento de reembolso é bloqueado, com mensagem explicativa e botão \"Entendi\".",
    ],
    imagem: "/ajuda/receber-lista.png",
    imagemAlt: "Lista de recebimentos do mês com totais",
    marcadores: [
      { numero: 1, xPct: 31.9, yPct: 20.7, texto: "Filtro por origem, reembolso, forma de pagamento e valor." },
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
      "Relatório do mês selecionado com totais por forma de pagamento, por aplicação e por reembolso, além da lista completa de lançamentos (na impressão/PDF). Recurso do plano Premium.",
    regras: [
      "O reembolso é calculado ao vivo, a partir das contas do mês e da configuração de cada pessoa — por isso é sempre a referência \"correta\" para conferir os valores, mesmo que a tela de Recebimentos ainda não tenha os lançamentos gerados.",
      "\"Compartilhar\" gera um PDF e tenta abrir o menu nativo de compartilhamento do dispositivo (WhatsApp, e-mail, etc.); se o navegador não suportar, o PDF é baixado diretamente.",
      "A lista completa de lançamentos só aparece na versão impressa/PDF, não na tela.",
    ],
    validacoes: [],
    imagem: "/ajuda/relatorio-modelo-i.png",
    imagemAlt: "Relatório Modelo I com totais por forma de pagamento, aplicação e reembolso",
    marcadores: [
      { numero: 1, xPct: 28, yPct: 22, texto: "Filtros por forma de pagamento, aplicação e reembolso." },
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
    id: "dashboard",
    categoria: "Dashboard",
    titulo: "Dashboard",
    resumo:
      "Visão gráfica com filtros, alternância entre Contas a Pagar e Contas a Receber, e quatro gráficos (forma de pagamento, aplicação, tipo de reembolso e lançamentos parcelados) em pizza ou barras. Recurso do plano Premium.",
    regras: [
      "Alterna entre a visão de Contas a Pagar e Contas a Receber usando o mesmo conjunto de filtros.",
      "Os cartões do topo (Total filtrado, Pago, Pendente, Lançamentos) refletem os filtros e o mês selecionados.",
      "Pizza é o formato padrão ao abrir a tela — cada fatia mostra o valor e o percentual numa lista ao lado, sem sobrepor rótulos. Barras usa o mesmo conjunto de dados, com rolagem interna quando há muitos itens.",
      "\"Tipo de reembolso\" agrupa pelos nomes cadastrados em Configurações (e por \"(sem reembolso)\" quando não há divisão). \"Lançamentos parcelados\" separa quanto do total do mês é parcelado e quanto é à vista.",
    ],
    validacoes: [],
    imagem: "/ajuda/dashboard.png",
    imagemAlt: "Dashboard analítico com gráficos de forma de pagamento, aplicação, reembolso e parcelamento",
    marcadores: [
      { numero: 1, xPct: 15.9, yPct: 12.4, texto: "Filtros por forma de pagamento, reembolso e aplicação." },
      { numero: 2, xPct: 73, yPct: 12.4, texto: "Alterna entre Contas a Pagar e Contas a Receber." },
      { numero: 3, xPct: 19.8, yPct: 21.4, texto: "Total filtrado, pago, pendente e quantidade de lançamentos do mês." },
      { numero: 4, xPct: 86.1, yPct: 30.2, texto: "Alterna o tipo de gráfico entre pizza (padrão) e barras." },
      { numero: 5, xPct: 11.7, yPct: 36.1, texto: "Distribuição por forma de pagamento." },
      { numero: 6, xPct: 51.2, yPct: 36.1, texto: "Distribuição por aplicação." },
      { numero: 7, xPct: 11.7, yPct: 62.4, texto: "Distribuição por tipo de reembolso." },
      { numero: 8, xPct: 51.2, yPct: 62.4, texto: "Quanto do total do mês é parcelado e quanto é à vista." },
    ],
  },
  {
    id: "configuracoes-geral",
    categoria: "Configurações",
    titulo: "Configurações · Geral",
    resumo:
      "Personalização das listas usadas nos formulários (formas de pagamento, aplicações, reembolsos), preferências de relatório, sugestão de credor e tema.",
    regras: [
      "\"Fixas\" e \"Provisões\" são formas de pagamento protegidas pelo sistema e não podem ser removidas — elas sustentam as regras de recorrência e de zeragem de Provisões pagas.",
      "Um item (forma de pagamento, aplicação ou reembolso) que já está em uso em algum lançamento não pode ser removido — desative-o em vez de excluir, para preservar o histórico.",
      "Cada forma de pagamento e cada aplicação pode ter uma observação própria (ícone de balão) — só um lembrete visível ao editar o item, não aparece nos lançamentos.",
      "Reembolso tem três modos: \"Recebo 100% do valor\", \"Recebo 50% do valor\" e \"Não gera valor a receber\".",
      "O tema escuro é exclusivo do plano Premium.",
      "O menu do sistema pode ser Horizontal (padrão, barra no topo) ou Vertical (menu lateral recolhível, com Perfil e Sair no rodapé) — a mudança vale para todas as telas.",
    ],
    validacoes: [
      "Item duplicado ao adicionar: \"Este item já existe na lista.\"",
      "Tentativa de remover item em uso: mensagem citando o nome do item e explicando que ele está em uso.",
      "Tentativa de remover \"Fixas\" ou \"Provisões\": mensagem específica de item protegido do sistema.",
    ],
    imagem: "/ajuda/configuracoes-geral.png",
    imagemAlt: "Aba Geral das Configurações, com listas editáveis e preferências",
    marcadores: [
      { numero: 1, xPct: 17.7, yPct: 21.2, texto: "Quais resumos aparecem nos Relatórios." },
      { numero: 2, xPct: 33.8, yPct: 21.2, texto: "Ativa/desativa a sugestão de credores já usados." },
      { numero: 3, xPct: 49.9, yPct: 21.2, texto: "Quantos itens aparecem por página nas listagens." },
      { numero: 4, xPct: 66, yPct: 21.2, texto: "Menu horizontal (padrão) ou vertical." },
      { numero: 5, xPct: 82.1, yPct: 21.2, texto: "Tema claro/escuro (escuro é Premium)." },
      { numero: 6, xPct: 8.5, yPct: 47, texto: "Formas de pagamento — itens com cadeado são protegidos; balão edita a observação." },
      { numero: 7, xPct: 50, yPct: 47, texto: "Aplicações usadas para categorizar cada conta." },
      { numero: 8, xPct: 82, yPct: 44, texto: "Pessoas com quem você divide contas e o quanto recebe de volta." },
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
