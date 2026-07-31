/* =========================================================
   TIME ATTACK — i18n/translations.js
   Mesmo padrão do Quest Drop (objeto plano, pt/en), arquivo
   independente, cobre as duas telas: host e jogador.
   ========================================================= */

const translations = {

  pt: {
    'meta.title': 'Time Attack: NDQuest',
    'nav.back': '← NDQuest',

    // TELA DO HOST — configuração
    'host.eyebrow': 'Time Attack',
    'host.title': 'Criar Sala',
    'host.subtitle': 'Configure o jogo uma vez, todo mundo que entrar na sala joga com essas regras.',
    'host.joinExisting': 'Já tem um código? Entrar numa sala →',
    'labels.hostName': 'Seu nome',
    'labels.pack': 'Pacote de perguntas',
    'labels.theme': 'Tema da empresa',
    'errors.noThemes': 'Nenhum tema de marca encontrado em /branding.',
    'pack.customOption': '✎ Minhas Próprias Perguntas',
    'customQuestions.hint': 'Cole suas perguntas, clique em "Processar", e crie a sala. Nada disso fica salvo pra outros usos, só vale pra essa sala.',
    'customQuestions.downloadTemplate': '⭳ Baixar modelo (.txt)',
    'customQuestions.uploadLabel': 'Ou envie um arquivo .txt',
    'customQuestions.parseBtn': 'Processar Perguntas',
    'customQuestions.noneYet': 'Nenhuma pergunta processada ainda.',
    'customQuestions.someProcessed': '{n} pergunta(s) processada(s) ✓',
    'errors.customQuestionsRequired': 'Processe suas perguntas (sem erros) antes de criar a sala.',
    'labels.timeBankStart': 'Tempo inicial (segundos)',
    'labels.timeBonusCorrect': 'Bônus por acerto (segundos)',
    'labels.timePenaltyWrong': 'Penalidade por erro (segundos)',
    'labels.timeCapSeconds': 'Tempo máximo de partida (segundos)',
    'buttons.createRoom': 'Criar Sala',
    'errors.hostNameRequired': 'Preencha seu nome antes de criar a sala.',
    'errors.invalidTimeValues': 'Confira os valores de tempo, todos precisam ser maiores que zero.',
    'errors.roomCreateFailed': 'Não foi possível criar a sala. Tente novamente.',

    // TELA DO HOST — sala criada, placar ao vivo
    'room.codeLabel': 'Código da sala',
    'buttons.copyLink': '📋 Copiar Link',
    'buttons.linkCopied': '✓ Copiado!',
    'room.qrHint': 'Escaneie o QR ou digite o código pra entrar',
    'room.linkHint': 'Link direto:',
    'leaderboard.title': 'Placar ao Vivo',
    'leaderboard.playingNow': '🎮 {n} jogando agora',
    'leaderboard.empty': 'Nenhum jogador terminou ainda.',
    'buttons.playAsHost': 'Jogar também →',
    'buttons.closeRoom': 'Encerrar Sala',
    'room.closedMessage': 'Sala encerrada. Obrigado por jogar!',

    // TELA DO JOGADOR — entrar
    'join.eyebrow': 'Time Attack',
    'join.title': 'Entrar na Sala',
    'join.subtitle': 'Digite o código que o host te passou.',
    'join.createInstead': 'Quer criar uma sala? Clique aqui →',
    'labels.roomCode': 'Código da sala',
    'labels.nickname': 'Seu apelido',
    'buttons.joinRoom': 'Entrar',
    'errors.nicknameRequired': 'Preencha um apelido antes de entrar.',
    'errors.roomCodeRequired': 'Preencha o código da sala.',
    'errors.roomNotFound': 'Sala não encontrada. Confira o código.',
    'errors.roomClosed': 'Essa sala já foi encerrada.',

    // TELA DO JOGADOR — pronto pra jogar
    'ready.eyebrow': 'Pronto?',
    'ready.title': 'Teste seu conhecimento',
    'ready.subtitle': 'Cada acerto some tempo ao seu relógio, cada erro tira. Acabou quando o tempo zerar ou bater o limite da partida.',
    'buttons.play': 'Jogar',

    // TELA DO JOGADOR — jogando
    'game.timeLabel': 'Tempo',
    'game.scorePrefix': 'Acertos:',

    // TELA DO JOGADOR — resultado final
    'finished.eyebrow': 'Fim de Jogo',
    'finished.title': 'Tempo esgotado!',
    'finished.titleCap': 'Partida encerrada!',
    'finished.scoreLabel': 'Você acertou',
    'finished.subtitle': 'Sua pontuação já foi enviada pro host. Confira o placar na tela dele.',
    'buttons.playAgain': 'Jogar de Novo'
  },

  en: {
    'meta.title': 'Time Attack: NDQuest',
    'nav.back': '← NDQuest',

    'host.eyebrow': 'Time Attack',
    'host.title': 'Create Room',
    'host.subtitle': 'Set up the game once, everyone who joins the room plays by these rules.',
    'host.joinExisting': 'Already have a code? Join a room →',
    'labels.hostName': 'Your name',
    'labels.pack': 'Question pack',
    'labels.theme': 'Company theme',
    'errors.noThemes': 'No brand theme found in /branding.',
    'pack.customOption': '✎ My Own Questions',
    'customQuestions.hint': 'Paste your questions, click "Process", and create the room. None of this is saved anywhere else, it only applies to this room.',
    'customQuestions.downloadTemplate': '⭳ Download template (.txt)',
    'customQuestions.uploadLabel': 'Or upload a .txt file',
    'customQuestions.parseBtn': 'Process Questions',
    'customQuestions.noneYet': 'No questions processed yet.',
    'customQuestions.someProcessed': '{n} question(s) processed ✓',
    'errors.customQuestionsRequired': 'Process your questions (with no errors) before creating the room.',
    'labels.timeBankStart': 'Starting time (seconds)',
    'labels.timeBonusCorrect': 'Bonus per correct answer (seconds)',
    'labels.timePenaltyWrong': 'Penalty per wrong answer (seconds)',
    'labels.timeCapSeconds': 'Maximum match length (seconds)',
    'buttons.createRoom': 'Create Room',
    'errors.hostNameRequired': 'Fill in your name before creating the room.',
    'errors.invalidTimeValues': 'Check the time values, all of them need to be greater than zero.',
    'errors.roomCreateFailed': 'Could not create the room. Please try again.',

    'room.codeLabel': 'Room code',
    'buttons.copyLink': '📋 Copy Link',
    'buttons.linkCopied': '✓ Copied!',
    'room.qrHint': 'Scan the QR code or type the code to join',
    'room.linkHint': 'Direct link:',
    'leaderboard.title': 'Live Leaderboard',
    'leaderboard.playingNow': '🎮 {n} playing now',
    'leaderboard.empty': 'No players have finished yet.',
    'buttons.playAsHost': 'Play too →',
    'buttons.closeRoom': 'Close Room',
    'room.closedMessage': 'Room closed. Thanks for playing!',

    'join.eyebrow': 'Time Attack',
    'join.title': 'Join Room',
    'join.subtitle': 'Type the code the host gave you.',
    'join.createInstead': 'Want to create a room? Click here →',
    'labels.roomCode': 'Room code',
    'labels.nickname': 'Your nickname',
    'buttons.joinRoom': 'Join',
    'errors.nicknameRequired': 'Fill in a nickname before joining.',
    'errors.roomCodeRequired': 'Fill in the room code.',
    'errors.roomNotFound': 'Room not found. Check the code.',
    'errors.roomClosed': 'This room has already closed.',

    'ready.eyebrow': 'Ready?',
    'ready.title': 'Test your knowledge',
    'ready.subtitle': "Every correct answer adds time to your clock, every wrong one takes time away. It ends when your time hits zero or the match limit is reached.",
    'buttons.play': 'Play',

    'game.timeLabel': 'Time',
    'game.scorePrefix': 'Correct:',

    'finished.eyebrow': 'Game Over',
    'finished.title': "Time's up!",
    'finished.titleCap': 'Match ended!',
    'finished.scoreLabel': 'You got',
    'finished.subtitle': "Your score has been sent to the host. Check their screen for the leaderboard.",
    'buttons.playAgain': 'Play Again'
  }

};

export default translations;
