/* =========================================================
   TAP RUSH — i18n/translations.js
   Mesmo padrão dos outros jogos do NDQuest (objeto plano, pt/en),
   arquivo independente.
   ========================================================= */

const translations = {

  pt: {
    'meta.title': 'Tap Rush: NDQuest',
    'nav.back': '← NDQuest',

    'host.eyebrow': 'Tap Rush',
    'host.title': 'Criar Sala',
    'host.subtitle': 'Ninguém precisa saber nada, só clicar rápido. Escolha o modo e crie a sala.',
    'host.joinExisting': 'Já tem um código? Entrar numa sala →',
    'labels.hostName': 'Seu nome',
    'labels.theme': 'Tema da empresa',

    'mode.race': 'Corrida',
    'mode.raceDescription': 'Cada um clica por si. Quem bater a meta de cliques primeiro, cruza a linha de chegada.',
    'mode.infinite': 'Clique Infinito',
    'mode.infiniteDescription': 'Cada um clica por si, sem meta fixa. Quando o tempo acabar, quem tiver mais cliques vence.',
    'mode.tugofwar': 'Cabo de Guerra',
    'mode.tugofwarDescription': 'Time A contra Time B. Quem clicar mais durante o tempo, puxa a corda pro seu lado.',

    'labels.targetTaps': 'Meta de cliques pra vencer',
    'labels.maxSeconds': 'Tempo máximo de segurança (segundos)',
    'labels.durationSeconds': 'Duração da rodada (segundos)',

    'buttons.createRoom': 'Criar Sala',
    'errors.hostNameRequired': 'Preencha seu nome antes de criar a sala.',
    'errors.invalidValues': 'Confira os valores acima, todos precisam ser maiores que zero.',
    'errors.roomCreateFailed': 'Não foi possível criar a sala. Tente novamente.',
    'errors.noThemes': 'Nenhum tema de marca encontrado em /branding.',

    'room.codeLabel': 'Código da sala',
    'room.qrHint': 'Escaneie o QR ou digite o código pra entrar',
    'buttons.copyLink': '📋 Copiar Link',
    'buttons.linkCopied': '✓ Copiado!',
    'buttons.closeRoom': 'Encerrar Sala',
    'room.closedMessage': 'Sala encerrada',
    'waiting.title': 'Esperando o Time',
    'waiting.subtitleRace': 'Os jogadores entram pelo código ou QR. Quando estiver pronto, aperte "Iniciar".',
    'waiting.subtitleTug': 'Cada jogador que entra é dividido automaticamente entre Time A e Time B.',
    'waiting.empty': 'Ninguém entrou ainda.',
    'buttons.startRound': 'Iniciar →',

    'countdown.getReady': 'Preparar...',
    'countdown.go': 'JÁ!',

    'active.timeLeft': 'Tempo restante',
    'active.teamA': 'Time A',
    'active.teamB': 'Time B',

    'results.title': 'Fim de Rodada',
    'results.rankingTitle': 'Ranking',
    'results.winnerLabel': 'Venceu:',
    'results.teamWinnerLabel': 'Time vencedor:',
    'results.tapsLabel': 'cliques',
    'buttons.playAgain': 'Jogar de Novo →',
    'buttons.copyRanking': '📋 Copiar',
    'buttons.copyCode': '📋 Copiar',
    'results.roomCodeHint': 'Código da sala',
    'buttons.copied': '✓ Copiado!',

    'join.eyebrow': 'Tap Rush',
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
    'errors.joinFailed': 'Não foi possível entrar na sala. Tente de novo.',

    'waitingPlayer.eyebrow': 'Você Está Dentro',
    'waitingPlayer.title': 'Esperando o Host Iniciar',
    'waitingPlayer.subtitleRace': 'Fique de olho, o botão de clique aparece assim que o host começar.',
    'waitingPlayer.yourTeam': 'Seu time:',

    'game.tapButton': 'CLICA!',
    'game.yourTaps': 'Seus cliques',

    'results.yourTaps': 'Você clicou {n} vezes',
    'results.youWon': 'Você venceu! 🎉',
    'results.youLost': 'Não foi dessa vez',
    'buttons.backToNdquest': '← Voltar pro NDQuest'
  },

  en: {
    'meta.title': 'Tap Rush: NDQuest',
    'nav.back': '← NDQuest',

    'host.eyebrow': 'Tap Rush',
    'host.title': 'Create Room',
    'host.subtitle': "No one needs to know anything, just tap fast. Pick a mode and create the room.",
    'host.joinExisting': 'Already have a code? Join a room →',
    'labels.hostName': 'Your name',
    'labels.theme': 'Company theme',

    'mode.race': 'Race',
    'mode.raceDescription': 'Everyone taps for themselves. First to hit the tap target crosses the finish line.',
    'mode.infinite': 'Endless Tap',
    'mode.infiniteDescription': "Everyone taps for themselves, no fixed target. When time's up, whoever has the most taps wins.",
    'mode.tugofwar': 'Tug of War',
    'mode.tugofwarDescription': 'Team A vs Team B. Whoever taps more during the round pulls the rope their way.',

    'labels.targetTaps': 'Tap target to win',
    'labels.maxSeconds': 'Max safety time (seconds)',
    'labels.durationSeconds': 'Round duration (seconds)',

    'buttons.createRoom': 'Create Room',
    'errors.hostNameRequired': 'Fill in your name before creating the room.',
    'errors.invalidValues': 'Check the values above, they all need to be greater than zero.',
    'errors.roomCreateFailed': 'Could not create the room. Try again.',
    'errors.noThemes': 'No brand theme found in /branding.',

    'room.codeLabel': 'Room code',
    'room.qrHint': 'Scan the QR code or type the code to join',
    'buttons.copyLink': '📋 Copy Link',
    'buttons.linkCopied': '✓ Copied!',
    'buttons.closeRoom': 'Close Room',
    'room.closedMessage': 'Room closed',
    'waiting.title': 'Waiting for the Crew',
    'waiting.subtitleRace': 'Players join with the code or QR code. When ready, hit "Start".',
    'waiting.subtitleTug': 'Each player who joins is automatically split between Team A and Team B.',
    'waiting.empty': 'No one has joined yet.',
    'buttons.startRound': 'Start →',

    'countdown.getReady': 'Get Ready...',
    'countdown.go': 'GO!',

    'active.timeLeft': 'Time left',
    'active.teamA': 'Team A',
    'active.teamB': 'Team B',

    'results.title': 'Round Over',
    'results.rankingTitle': 'Ranking',
    'results.winnerLabel': 'Winner:',
    'results.teamWinnerLabel': 'Winning team:',
    'results.tapsLabel': 'taps',
    'buttons.playAgain': 'Play Again →',
    'buttons.copyRanking': '📋 Copy',
    'buttons.copyCode': '📋 Copy',
    'results.roomCodeHint': 'Room code',
    'buttons.copied': '✓ Copied!',

    'join.eyebrow': 'Tap Rush',
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
    'errors.joinFailed': 'Could not join the room. Try again.',

    'waitingPlayer.eyebrow': "You're In",
    'waitingPlayer.title': 'Waiting for the Host to Start',
    'waitingPlayer.subtitleRace': 'Keep an eye out, the tap button shows up as soon as the host starts.',
    'waitingPlayer.yourTeam': 'Your team:',

    'game.tapButton': 'TAP!',
    'game.yourTaps': 'Your taps',

    'results.yourTaps': 'You tapped {n} times',
    'results.youWon': 'You won! 🎉',
    'results.youLost': 'Not this time',
    'buttons.backToNdquest': '← Back to NDQuest'
  }

};

export default translations;
