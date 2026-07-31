/* =========================================================
   SHOW DOWN — i18n/translations.js
   Mesmo padrão do Quest Drop e do Time Attack (objeto plano,
   pt/en), arquivo independente. Cobre as telas do host e do
   jogador.
   ========================================================= */

const translations = {

  pt: {
    'meta.title': 'Show Down: NDQuest',
    'nav.back': '← NDQuest',

    // TELA DO HOST — configuração
    'host.eyebrow': 'Show Down',
    'host.title': 'Criar Sala',
    'host.subtitle': 'Configure o quiz uma vez, você controla o ritmo, todo mundo responde a mesma pergunta ao mesmo tempo.',
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
    'labels.questionSeconds': 'Tempo por pergunta (segundos)',
    'labels.numQuestions': 'Quantidade de perguntas',
    'buttons.createRoom': 'Criar Sala',
    'errors.hostNameRequired': 'Preencha seu nome antes de criar a sala.',
    'errors.invalidValues': 'Confira os valores acima, todos precisam ser maiores que zero.',
    'errors.roomCreateFailed': 'Não foi possível criar a sala. Tente novamente.',
    'errors.notEnoughQuestions': 'O pacote escolhido não tem perguntas suficientes pra essa quantidade.',

    // TELA DO HOST — sala aberta, esperando jogadores
    'room.codeLabel': 'Código da sala',
    'room.qrHint': 'Escaneie o QR ou digite o código pra entrar',
    'buttons.copyLink': '📋 Copiar Link',
    'buttons.linkCopied': '✓ Copiado!',
    'buttons.closeRoom': 'Encerrar Sala',
    'room.closedMessage': 'Sala encerrada',
    'waiting.title': 'Esperando o Time',
    'waiting.subtitle': 'Os jogadores entram pelo código ou QR. Quando o time estiver pronto, aperte "Iniciar".',
    'waiting.empty': 'Ninguém entrou ainda.',
    'buttons.startQuiz': 'Iniciar Quiz →',

    // TELA DO HOST — pergunta em andamento / resultado
    'question.indexLabel': 'Pergunta {current} de {total}',
    'buttons.endQuestion': 'Encerrar Pergunta',
    'results.correctAnswerLabel': 'Resposta certa',
    'results.rankingSoFar': 'Ranking Parcial',
    'buttons.nextQuestion': 'Próxima Pergunta →',
    'buttons.seeFinalRanking': 'Ver Ranking Final →',
    'buttons.playAgain': 'Jogar de Novo →',

    // TELA DO HOST — ranking final
    'finalRanking.title': 'Fim de Jogo',
    'finalRanking.subtitle': 'Esse foi o resultado do time.',

    // TELA DO JOGADOR — entrar
    'join.eyebrow': 'Show Down',
    'join.title': 'Entrar na Sala',
    'join.subtitle': 'Digite o código que o host te passou.',
    'join.createInstead': 'Quer criar uma sala? Clique aqui →',
    'labels.roomCode': 'Código da sala',
    'labels.nickname': 'Seu apelido',
    'buttons.joinRoom': 'Entrar',
    'buttons.leaveRoom': '← Sair da sala',
    'errors.roomCodeRequired': 'Preencha o código da sala.',
    'errors.nicknameRequired': 'Preencha seu apelido.',
    'errors.roomNotFound': 'Sala não encontrada. Confira o código.',
    'errors.roomClosed': 'Essa sala já foi encerrada.',

    // TELA DO JOGADOR — esperando o host iniciar
    'waitingPlayer.eyebrow': 'Você Está Dentro',
    'waitingPlayer.title': 'Esperando o Host Iniciar',
    'waitingPlayer.subtitle': 'Fique de olho na tela, a pergunta aparece assim que o host começar.',

    // TELA DO JOGADOR — jogando
    'game.answerSent': 'Resposta enviada, aguardando os outros...',
    'game.timeUp': 'Tempo esgotado!',

    // TELA DO JOGADOR — resultado da pergunta
    'results.correct': 'Você Acertou!',
    'results.wrong': 'Não Foi Dessa Vez',
    'results.noAnswer': 'Você Não Respondeu',
    'results.pointsEarned': '+{n} pontos',
    'results.zeroPoints': '+0 pontos',
    'results.waitingHost': 'Aguardando o host avançar...',

    // TELA DO JOGADOR — ranking final
    'finalRanking.yourPosition': 'Sua posição: #{n}',
    'buttons.backToNdquest': '← Voltar pro NDQuest',

    // Ranking / placar (compartilhado host + jogador)
    'ranking.rankLabel': 'Pos.',
    'ranking.pointsLabel': 'pts'
  },

  en: {
    'meta.title': 'Show Down: NDQuest',
    'nav.back': '← NDQuest',

    // HOST SCREEN — setup
    'host.eyebrow': 'Show Down',
    'host.title': 'Create Room',
    'host.subtitle': 'Set up the quiz once, you control the pace, everyone answers the same question at the same time.',
    'host.joinExisting': 'Already have a code? Join a room →',
    'labels.hostName': 'Your name',
    'labels.pack': 'Question pack',
    'labels.theme': 'Company theme',
    'errors.noThemes': 'No brand theme found in /branding.',
    'pack.customOption': '✎ My Own Questions',
    'customQuestions.hint': 'Paste your questions, click "Process", and create the room. None of this is saved for other uses, it only applies to this room.',
    'customQuestions.downloadTemplate': '⭳ Download template (.txt)',
    'customQuestions.uploadLabel': 'Or upload a .txt file',
    'customQuestions.parseBtn': 'Process Questions',
    'customQuestions.noneYet': 'No questions processed yet.',
    'customQuestions.someProcessed': '{n} question(s) processed ✓',
    'errors.customQuestionsRequired': 'Process your questions (with no errors) before creating the room.',
    'labels.questionSeconds': 'Time per question (seconds)',
    'labels.numQuestions': 'Number of questions',
    'buttons.createRoom': 'Create Room',
    'errors.hostNameRequired': 'Fill in your name before creating the room.',
    'errors.invalidValues': 'Check the values above, they all need to be greater than zero.',
    'errors.roomCreateFailed': 'Could not create the room. Try again.',
    'errors.notEnoughQuestions': 'The chosen pack does not have enough questions for that amount.',

    // HOST SCREEN — room open, waiting for players
    'room.codeLabel': 'Room code',
    'room.qrHint': 'Scan the QR code or type the code to join',
    'buttons.copyLink': '📋 Copy Link',
    'buttons.linkCopied': '✓ Copied!',
    'buttons.closeRoom': 'Close Room',
    'room.closedMessage': 'Room closed',
    'waiting.title': 'Waiting for the Crew',
    'waiting.subtitle': 'Players join with the code or QR code. When the crew is ready, hit "Start".',
    'waiting.empty': 'No one has joined yet.',
    'buttons.startQuiz': 'Start Quiz →',

    // HOST SCREEN — question in progress / results
    'question.indexLabel': 'Question {current} of {total}',
    'buttons.endQuestion': 'End Question',
    'results.correctAnswerLabel': 'Correct answer',
    'results.rankingSoFar': 'Ranking So Far',
    'buttons.nextQuestion': 'Next Question →',
    'buttons.seeFinalRanking': 'See Final Ranking →',
    'buttons.playAgain': 'Play Again →',

    // HOST SCREEN — final ranking
    'finalRanking.title': 'Game Over',
    'finalRanking.subtitle': "That's how the crew did.",

    // PLAYER SCREEN — join
    'join.eyebrow': 'Show Down',
    'join.title': 'Join Room',
    'join.subtitle': 'Enter the code the host gave you.',
    'join.createInstead': 'Want to create a room instead? Click here →',
    'labels.roomCode': 'Room code',
    'labels.nickname': 'Your nickname',
    'buttons.joinRoom': 'Join',
    'buttons.leaveRoom': '← Leave room',
    'errors.roomCodeRequired': 'Fill in the room code.',
    'errors.nicknameRequired': 'Fill in your nickname.',
    'errors.roomNotFound': 'Room not found. Check the code.',
    'errors.roomClosed': 'This room has already been closed.',

    // PLAYER SCREEN — waiting for host to start
    'waitingPlayer.eyebrow': "You're In",
    'waitingPlayer.title': 'Waiting for the Host to Start',
    'waitingPlayer.subtitle': 'Keep an eye on the screen, the question shows up as soon as the host starts.',

    // PLAYER SCREEN — playing
    'game.answerSent': 'Answer sent, waiting for the others...',
    'game.timeUp': "Time's up!",

    // PLAYER SCREEN — question result
    'results.correct': 'You Got It Right!',
    'results.wrong': 'Not This Time',
    'results.noAnswer': "You Didn't Answer",
    'results.pointsEarned': '+{n} points',
    'results.zeroPoints': '+0 points',
    'results.waitingHost': 'Waiting for the host to move on...',

    // PLAYER SCREEN — final ranking
    'finalRanking.yourPosition': 'Your position: #{n}',
    'buttons.backToNdquest': '← Back to NDQuest',

    // Ranking / leaderboard (shared host + player)
    'ranking.rankLabel': 'Rank',
    'ranking.pointsLabel': 'pts'
  }

};

export default translations;
