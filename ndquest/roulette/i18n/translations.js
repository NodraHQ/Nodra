/* =========================================================
   ROULETTE — i18n/translations.js
   Mesmo padrão dos outros jogos do NDQuest (objeto plano, pt/en),
   arquivo independente.
   ========================================================= */

const translations = {

  pt: {
    'meta.title': 'Roleta: NDQuest',
    'nav.back': '← NDQuest',

    'host.eyebrow': 'Roleta',
    'host.title': 'Montar a Roleta',
    'host.subtitle': 'Junte os nomes de um jeito, gire, sorteie. Sem pergunta, sem pontuação, só o prêmio.',
    'host.joinExisting': 'Já tem um código? Entrar numa sala →',
    'labels.hostName': 'Seu nome',
    'labels.theme': 'Tema da empresa',

    'method.import': 'Buscar de uma Sala',
    'method.qr': 'QR / Código',
    'method.paste': 'Colar Lista',

    'import.hint': 'Puxa a lista de quem já jogou Time Attack ou Show Down nessa mesma sala, sem precisar ninguém digitar o nome de novo.',
    'import.gameLabel': 'Jogo',
    'import.gameTimeAttack': 'Time Attack',
    'import.gameShowdown': 'Show Down',
    'import.gameTapRush': 'Tap Rush',
    'import.roomCodeLabel': 'Código da sala',
    'import.fetchBtn': 'Buscar Nomes',
    'import.foundCount': '{n} nome(s) encontrado(s) ✓',
    'errors.importRoomNotFound': 'Não achei uma sala com esse código nesse jogo.',
    'errors.importNoPlayers': 'Essa sala não tem nenhum jogador ainda.',

    'qr.hint': 'Cria uma sala própria da Roleta: quem escanear o QR ou digitar o código já entra, só com o nome.',
    'room.codeLabel': 'Código da sala',
    'qr.createBtn': 'Criar Sala da Roleta',
    'qr.waitingTitle': 'Esperando o Time',
    'qr.waitingSubtitle': 'Assim que a galera entrar, o nome já aparece aqui embaixo.',
    'qr.empty': 'Ninguém entrou ainda.',

    'paste.hint': 'Cole um nome por linha.',
    'paste.placeholder': 'Ana\nBeto\nCarla',
    'paste.parseBtn': 'Processar Lista',
    'paste.foundCount': '{n} nome(s) processado(s) ✓',

    'buttons.continueToWheel': 'Ir pra Roleta →',
    'errors.notEnoughNames': 'Precisa de pelo menos 2 nomes pra girar a roleta.',
    'errors.hostNameRequired': 'Preencha seu nome antes de continuar.',
    'errors.noThemes': 'Nenhum tema de marca encontrado em /branding.',
    'errors.roomCreateFailed': 'Não foi possível criar a sala. Tente novamente.',

    'wheel.spinBtn': 'Girar 🎡',
    'wheel.spinning': 'Girando...',
    'wheel.removeWinnerLabel': 'Remover vencedor da roleta depois de sortear',
    'wheel.winnersTitle': 'Ganhadores',
    'wheel.winnersEmpty': 'Ninguém sorteado ainda.',
    'wheel.copyList': '📋 Copiar',
    'wheel.spinAgain': 'Sortear de Novo, Mesmos Nomes →',
    'wheel.changeNames': 'Trocar a lista de nomes →',
    'wheel.copied': '✓ Copiado!',
    'wheel.winnerBanner': 'Ganhou:',
    'wheel.everyoneWon': 'Todo mundo já foi sorteado!',

    'join.eyebrow': 'Roleta',
    'join.title': 'Entrar na Roleta',
    'join.subtitle': 'Digite o código que o host te passou.',
    'labels.roomCode': 'Código da sala',
    'labels.nickname': 'Seu nome',
    'buttons.joinRoom': 'Entrar',
    'errors.roomCodeRequired': 'Preencha o código da sala.',
    'errors.nicknameRequired': 'Preencha seu nome.',
    'errors.roomNotFound': 'Sala não encontrada. Confira o código.',

    'joined.eyebrow': 'Você Está Dentro',
    'joined.title': 'Você está na roleta! 🎉',
    'joined.subtitle': 'Fica de olho na tela do host, é lá que o sorteio acontece.'
  },

  en: {
    'meta.title': 'Roulette: NDQuest',
    'nav.back': '← NDQuest',

    'host.eyebrow': 'Roulette',
    'host.title': 'Set Up the Roulette',
    'host.subtitle': 'Gather names one way or another, spin, draw a winner. No question, no score, just the prize.',
    'host.joinExisting': 'Already have a code? Join a room →',
    'labels.hostName': 'Your name',
    'labels.theme': 'Company theme',

    'method.import': 'Pull From a Room',
    'method.qr': 'QR / Code',
    'method.paste': 'Paste List',

    'import.hint': "Pulls the list of who already played Time Attack or Show Down in that same room, without anyone typing their name again.",
    'import.gameLabel': 'Game',
    'import.gameTimeAttack': 'Time Attack',
    'import.gameShowdown': 'Show Down',
    'import.gameTapRush': 'Tap Rush',
    'import.roomCodeLabel': 'Room code',
    'import.fetchBtn': 'Fetch Names',
    'import.foundCount': '{n} name(s) found ✓',
    'errors.importRoomNotFound': "Couldn't find a room with that code in that game.",
    'errors.importNoPlayers': "That room doesn't have any players yet.",

    'qr.hint': 'Creates a Roulette-only room: anyone who scans the QR or types the code joins with just their name.',
    'room.codeLabel': 'Room code',
    'qr.createBtn': 'Create Roulette Room',
    'qr.waitingTitle': 'Waiting for the Crew',
    'qr.waitingSubtitle': 'As soon as people join, their name shows up here.',
    'qr.empty': 'No one has joined yet.',

    'paste.hint': 'Paste one name per line.',
    'paste.placeholder': 'Ana\nBeto\nCarla',
    'paste.parseBtn': 'Process List',
    'paste.foundCount': '{n} name(s) processed ✓',

    'buttons.continueToWheel': 'Go to Wheel →',
    'errors.notEnoughNames': 'You need at least 2 names to spin the wheel.',
    'errors.hostNameRequired': 'Fill in your name before continuing.',
    'errors.noThemes': 'No brand theme found in /branding.',
    'errors.roomCreateFailed': 'Could not create the room. Try again.',

    'wheel.spinBtn': 'Spin 🎡',
    'wheel.spinning': 'Spinning...',
    'wheel.removeWinnerLabel': 'Remove winner from the wheel after drawing',
    'wheel.winnersTitle': 'Winners',
    'wheel.winnersEmpty': 'No one drawn yet.',
    'wheel.copyList': '📋 Copy',
    'wheel.spinAgain': 'Spin Again, Same Names →',
    'wheel.changeNames': 'Change the name list →',
    'wheel.copied': '✓ Copied!',
    'wheel.winnerBanner': 'Winner:',
    'wheel.everyoneWon': 'Everyone has already won!',

    'join.eyebrow': 'Roulette',
    'join.title': 'Join the Roulette',
    'join.subtitle': 'Enter the code the host gave you.',
    'labels.roomCode': 'Room code',
    'labels.nickname': 'Your name',
    'buttons.joinRoom': 'Join',
    'errors.roomCodeRequired': 'Fill in the room code.',
    'errors.nicknameRequired': 'Fill in your name.',
    'errors.roomNotFound': 'Room not found. Check the code.',

    'joined.eyebrow': "You're In",
    'joined.title': "You're in the roulette! 🎉",
    'joined.subtitle': "Keep an eye on the host's screen, that's where the draw happens."
  }

};

export default translations;
