/* =========================================================
   TRADUÇÕES DA INTERFACE (PT / EN)

   Este arquivo cobre só o texto de INTERFACE (labels, botões,
   mensagens de erro, textos fixos das telas). O conteúdo das
   perguntas de cada pacote é traduzido dentro do próprio
   arquivo de pacote (questions/*.js), não aqui.

   Para adicionar um texto novo:
   1. Crie a chave nos dois idiomas (pt e en).
   2. Use `data-i18n="chave"` no HTML (texto), ou
      `data-i18n-placeholder="chave"` (placeholder de input), ou
      `data-i18n-aria-label="chave"` (aria-label), OU use a
      função `t('chave')` dentro do script.js para texto gerado
      dinamicamente.
   ========================================================= */
const translations = {
  pt: {
    'app.title': 'Quest\u00A0Drop',

    'config.eyebrow': 'Configuração do Jogo',
    'config.subtitle': 'Defina o orçamento e a quantidade de envelopes para preparar a mesa de prêmios.',
    'config.section.event': 'Evento',
    'config.section.content': 'Conteúdo',
    'config.section.difficulty': 'Dificuldade e orçamento',

    'labels.budget': 'Orçamento total',
    'placeholders.budget': 'Ex: 300 ou 1.5',

    'labels.envelopeCount': 'Quantidade de envelopes',
    'placeholders.envelopeCount': 'Ex: 6',

    'labels.pack': 'Pacote de perguntas',
    'labels.theme': 'Tema da empresa',

    'labels.unit': 'Unidade do prêmio',
    'unit.other': 'Outro...',
    'labels.unitCustom': 'Unidade personalizada',
    'placeholders.unitCustom': 'Ex: POINTS, XP, SATS...',

    'labels.difficultyDistribution': 'Distribuição das dificuldades (%)',
    'labels.budgetDistribution': 'Distribuição do orçamento (%)',
    'percent.easy': '🟢 Fácil',
    'percent.medium': '🟡 Médio',
    'percent.hard': '🔴 Difícil',

    'difficulty.easy': 'Fácil',
    'difficulty.medium': 'Médio',
    'difficulty.hard': 'Difícil',

    'buttons.start': 'Iniciar',

    'envelopes.backAriaLabel': 'Voltar à configuração',
    'envelopes.title': 'Escolha um envelope',
    'envelopes.finishedBadge': '✓ Evento finalizado',

    'question.eyebrow': 'Pergunta',
    'modal.closeAriaLabel': 'Fechar',

    'result.successTitle': 'Parabéns!',
    'buttons.continue': 'Continuar',
    'result.failTitle': 'Resposta incorreta',
    'buttons.backToEnvelopes': 'Voltar aos envelopes',

    'finished.eyebrow': 'Fim de jogo',
    'finished.title': 'Evento finalizado',
    'finished.subtitle': 'Todos os envelopes foram conquistados. Obrigado por participar!',
    'buttons.viewResult': 'Ver Resultado',
    'buttons.newEvent': 'Novo Evento',
    'buttons.close': 'Fechar',

    'errors.invalidBudget': 'Informe um orçamento válido.',
    'errors.invalidCount': 'Informe a quantidade de envelopes.',
    'errors.noPacks': 'Nenhum pacote de perguntas encontrado em /questions.',
    'errors.noThemes': 'Nenhum tema de marca encontrado em /branding.',
    'errors.difficultySum': 'A distribuição das dificuldades deve somar 100%.',
    'errors.budgetSum': 'A distribuição do orçamento deve somar 100%.',
    'errors.customUnit': 'Informe a unidade personalizada do prêmio.',
    'errors.insufficientBudget': 'O orçamento distribuído para uma das dificuldades é insuficiente para a quantidade de envelopes daquele nível. Ajuste os percentuais ou o orçamento total.',

    'question.none': 'Nenhuma pergunta disponível para este nível no momento.',
    'result.wonPrefix': 'Você ganhou',
    'confirm.cancelEvent': 'Cancelar o evento atual e voltar para a configuração?',

    'pack.customOption': '✎ Minhas Próprias Perguntas (não salva)',
    'pack.customHint': 'Cole ou envie suas perguntas, clique em "Processar", e comece o evento. Nada disso fica salvo — some quando a sessão terminar.',
    'pack.modalEyebrow': 'Minhas Próprias Perguntas',
    'pack.noneYet': 'Nenhuma pergunta ainda.',
    'pack.someProcessed': '{n} pergunta(s) processada(s) ✓',
    'pack.openEditor': '✎ Abrir editor de perguntas',
    'pack.doneBtn': 'Concluído',
    'pack.downloadTemplate': '⭳ Baixar modelo (.txt)',
    'pack.uploadLabel': 'Ou envie um arquivo .txt',
    'pack.parseBtn': 'Processar Perguntas',
    'errors.customPackNotProcessed': 'Processe suas perguntas (sem erros) antes de iniciar.',
    'labels.prizeMode': 'Modo de prêmio',
    'prizeMode.budget': 'Orçamento simples (1 unidade, calculado automaticamente)',
    'prizeMode.list': 'Lista de prêmios personalizada (itens diferentes por dificuldade)',
    'prizeList.noneYet': 'Nenhum prêmio configurado ainda.',
    'prizeList.someConfigured': '{n} prêmio(s) configurado(s) ✓',
    'prizeList.openEditor': '🎁 Configurar prêmios',
    'prizeList.modalEyebrow': 'Lista de Prêmios',
    'prizeList.hint': 'Defina o estoque de prêmios de cada dificuldade. Cada envelope respondido corretamente sorteia um item do estoque daquela dificuldade e desconta 1 unidade — não é mais "1 item = 1 envelope".',
    'prizeList.pasteHint': 'Um prêmio por linha, no formato "Nome; Quantidade"',
    'prizeList.parseBtn': 'Processar Lista',
    'prizeList.totalSummary': 'Estoque — Fácil: {easy} · Médio: {medium} · Difícil: {hard} · Total: {total}',
    'errors.noPrizesConfigured': 'Configure ao menos um prêmio antes de iniciar.',
    'errors.tierMissingStock': 'Alguma dificuldade tem envelopes mas nenhum prêmio no estoque. Configure ao menos 1 prêmio pra cada dificuldade usada.',
    'prizeList.soldOut': 'Esgotado',
    'result.soldOutMessage': 'Você acertou! Mas os prêmios desse nível já esgotaram.',
    'difficulty.usingDefault': 'Usando a divisão padrão (33% / 33% / 34%) entre fácil, médio e difícil.',
    'difficulty.customSummary': 'Fácil {easy}% · Médio {medium}% · Difícil {hard}%',
    'difficulty.openEditor': '⚖️ Ajustar distribuição',
    'difficulty.hint': 'O padrão (33% / 33% / 34%) funciona bem pra maioria dos eventos — só mexa aqui se quiser um evento com mais perguntas de um nível específico.',
  },

  en: {
    'app.title': 'Quest\u00A0Drop',

    'config.eyebrow': 'Game Setup',
    'config.subtitle': 'Set the budget and number of envelopes to prepare the prize table.',
    'config.section.event': 'Event',
    'config.section.content': 'Content',
    'config.section.difficulty': 'Difficulty and budget',

    'labels.budget': 'Total budget',
    'placeholders.budget': 'E.g.: 300 or 1.5',

    'labels.envelopeCount': 'Number of envelopes',
    'placeholders.envelopeCount': 'E.g.: 6',

    'labels.pack': 'Question pack',
    'labels.theme': 'Company theme',

    'labels.unit': 'Prize unit',
    'unit.other': 'Other...',
    'labels.unitCustom': 'Custom unit',
    'placeholders.unitCustom': 'E.g.: POINTS, XP, SATS...',

    'labels.difficultyDistribution': 'Difficulty distribution (%)',
    'labels.budgetDistribution': 'Budget distribution (%)',
    'percent.easy': '🟢 Easy',
    'percent.medium': '🟡 Medium',
    'percent.hard': '🔴 Hard',

    'difficulty.easy': 'Easy',
    'difficulty.medium': 'Medium',
    'difficulty.hard': 'Hard',

    'buttons.start': 'Start',

    'envelopes.backAriaLabel': 'Back to configuration',
    'envelopes.title': 'Choose an envelope',
    'envelopes.finishedBadge': '✓ Event finished',

    'question.eyebrow': 'Question',
    'modal.closeAriaLabel': 'Close',

    'result.successTitle': 'Congratulations!',
    'buttons.continue': 'Continue',
    'result.failTitle': 'Incorrect answer',
    'buttons.backToEnvelopes': 'Back to envelopes',

    'finished.eyebrow': 'Game over',
    'finished.title': 'Event finished',
    'finished.subtitle': 'All envelopes have been claimed. Thanks for participating!',
    'buttons.viewResult': 'View Result',
    'buttons.newEvent': 'New Event',
    'buttons.close': 'Close',

    'errors.invalidBudget': 'Enter a valid budget.',
    'errors.invalidCount': 'Enter the number of envelopes.',
    'errors.noPacks': 'No question pack found in /questions.',
    'errors.noThemes': 'No brand theme found in /branding.',
    'errors.difficultySum': 'The difficulty distribution must add up to 100%.',
    'errors.budgetSum': 'The budget distribution must add up to 100%.',
    'errors.customUnit': 'Enter the custom prize unit.',
    'errors.insufficientBudget': 'The budget allocated to one of the difficulties is not enough for the number of envelopes at that level. Adjust the percentages or the total budget.',

    'question.none': 'No question available for this level right now.',
    'result.wonPrefix': 'You won',
    'confirm.cancelEvent': 'Cancel the current event and go back to configuration?',

    'pack.customOption': '✎ My Own Questions (not saved)',
    'pack.customHint': 'Paste or upload your questions, click "Process", and start the event. None of this is saved — it disappears when the session ends.',
    'pack.modalEyebrow': 'My Own Questions',
    'pack.noneYet': 'No questions yet.',
    'pack.someProcessed': '{n} question(s) processed ✓',
    'pack.openEditor': '✎ Open question editor',
    'pack.doneBtn': 'Done',
    'pack.downloadTemplate': '⭳ Download template (.txt)',
    'pack.uploadLabel': 'Or upload a .txt file',
    'pack.parseBtn': 'Process Questions',
    'errors.customPackNotProcessed': 'Process your questions (with no errors) before starting.',
    'labels.prizeMode': 'Prize mode',
    'prizeMode.budget': 'Simple budget (1 unit, calculated automatically)',
    'prizeMode.list': 'Custom prize list (different items per difficulty)',
    'prizeList.noneYet': 'No prizes configured yet.',
    'prizeList.someConfigured': '{n} prize(s) configured ✓',
    'prizeList.openEditor': '🎁 Configure prizes',
    'prizeList.modalEyebrow': 'Prize List',
    'prizeList.hint': "Define the prize stock for each difficulty. Every correctly answered envelope draws one item from that difficulty's stock and subtracts 1 unit — it's no longer \"1 item = 1 envelope\".",
    'prizeList.pasteHint': 'One prize per line, in the format "Name; Quantity"',
    'prizeList.parseBtn': 'Process List',
    'prizeList.totalSummary': 'Stock — Easy: {easy} · Medium: {medium} · Hard: {hard} · Total: {total}',
    'errors.noPrizesConfigured': 'Configure at least one prize before starting.',
    'errors.tierMissingStock': 'Some difficulty has envelopes but no prizes in stock. Configure at least 1 prize for each difficulty in use.',
    'prizeList.soldOut': 'Sold out',
    'result.soldOutMessage': "You got it right! But the prizes for this level are all gone.",
    'difficulty.usingDefault': 'Using the default split (33% / 33% / 34%) between easy, medium and hard.',
    'difficulty.customSummary': 'Easy {easy}% · Medium {medium}% · Hard {hard}%',
    'difficulty.openEditor': '⚖️ Adjust distribution',
    'difficulty.hint': "The default (33% / 33% / 34%) works well for most events — only change this if you want an event with more questions from a specific level.",
  }
};

export default translations;
