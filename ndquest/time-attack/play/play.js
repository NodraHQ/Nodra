// ==================================================================
// TIME ATTACK - play/play.js
// ==================================================================

import translations from '../i18n/translations.js';
import themes from '../branding/branding-manifest.js';

// --------------------------------------------------------
// Idioma
// --------------------------------------------------------

let currentLanguage = localStorage.getItem('time-attack:language') || 'pt';

function t(key) {
    const dict = translations[currentLanguage] || translations.pt;
    return dict[key] !== undefined ? dict[key] : key;
}

// --------------------------------------------------------
// Badges do jogador - mini-card evoluído do "quadrinho simples só
// com nome", pedido ao vivo: mostra até 3 badges pequenos que a
// pessoa escolheu destacar, direto no ranking. Cópia própria desta
// pasta (mesma lógica usada em host.js e nos outros jogos).
// --------------------------------------------------------

const BADGE_ICONS = {
    trophy: '<path d="M10 14.66V17a1 1 0 0 1-1 1 2 2 0 0 0-2 2v2"/><path d="M14 14.66V17a1 1 0 0 0 1 1 2 2 0 0 1 2 2v2"/><path d="M17.916 10H19.5A2.5 2.5 0 0 0 22 7.5V5a1 1 0 0 0-1-1h-3"/><path d="M4 22h16"/><path d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z"/><path d="M6.084 10H4.5A2.5 2.5 0 0 1 2 7.5V5a1 1 0 0 1 1-1h3"/>',
    award: '<path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526"/><circle cx="12" cy="8" r="6"/>',
    medal: '<path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15"/><path d="M11 12 5.12 2.2"/><path d="m13 12 5.88-9.8"/><path d="M8 7h8"/><circle cx="12" cy="17" r="5"/><path d="M12 18v-2h-.5"/>',
    crown: '<path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"/><path d="M5 21h14"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
    star: '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
    gem: '<path d="M10.5 3 8 9l4 13 4-13-2.5-6"/><path d="M17 3a2 2 0 0 1 1.6.8l3 4a2 2 0 0 1 .013 2.382l-7.99 10.986a2 2 0 0 1-3.247 0l-7.99-10.986A2 2 0 0 1 2.4 7.8l2.998-3.997A2 2 0 0 1 7 3z"/><path d="M2 9h20"/>',
    flag: '<path d="M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528"/>',
};

function buildMiniIconSvg(iconKey) {
    const inner = BADGE_ICONS[iconKey];
    if (!inner) return '';
    return `<svg class="mini-badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}

async function loadPlayerBadgeMap(userIds) {
    const validIds = [...new Set(userIds.filter(Boolean))];
    if (validIds.length === 0) return new Map();

    const [{ data: profiles }, { data: userBadgeRows }] = await Promise.all([
        window.ndquestSupabase.from('profiles').select('id, featured_badge_ids').in('id', validIds),
        window.ndquestSupabase
            .from('user_badges')
            .select('user_id, badge_id, badges(background_color, icon, icon_color, image_url)')
            .in('user_id', validIds),
    ]);

    const featuredById = new Map((profiles || []).map((p) => [p.id, new Set(p.featured_badge_ids || [])]));
    const map = new Map();

    (userBadgeRows || []).forEach((row) => {
        const featuredSet = featuredById.get(row.user_id);
        const isFeatured = featuredSet && featuredSet.size > 0 ? featuredSet.has(row.badge_id) : true;
        if (!isFeatured) return;

        const list = map.get(row.user_id) || [];
        if (list.length >= 3) return;
        list.push(row.badges);
        map.set(row.user_id, list);
    });

    return map;
}

function buildMiniBadgeRow(badges) {
    if (!badges || badges.length === 0) return '';
    const chips = badges
        .map((b) => {
            if (b.image_url) {
                return `<span class="mini-badge"><img src="${b.image_url}" alt=""></span>`;
            }
            const color = b.icon_color || b.background_color || '#888';
            return `<span class="mini-badge" style="background:${b.background_color || '#333'};color:${color};">${b.icon ? buildMiniIconSvg(b.icon) : ''}</span>`;
        })
        .join('');
    return `<div class="mini-badge-row">${chips}</div>`;
}

// --------------------------------------------------------
// Identidade - se a pessoa estiver logada, host_id/user_id ficam
// registrados junto da sala/jogador (ver docs/MATCH_HISTORY_ARCHITECTURE.md).
// Deslogado, fica null - joga normal, só não entra no histórico.
// --------------------------------------------------------

// Bug real confirmado ao vivo: antes isso guardava o resultado em
// cache pra sempre depois da primeira checagem - numa aba que fica
// aberta por horas, ou depois de trocar de conta sem recarregar a
// página, esse valor guardado ficava desatualizado, e o servidor
// rejeitava porque o host_id/user_id enviado não batia mais com quem
// a pessoa realmente é agora. getSession() é uma leitura local e
// barata do Supabase (não faz chamada de rede), então nunca precisou
// desse cache - checa fresco toda vez.
let historyRecordedThisGame = false; // trava contra endGame disparar mais de uma vez (setInterval + setTimeouts independentes)

async function getCurrentUserId() {
    const { data: { session } } = await window.ndquestSupabase.auth.getSession();
    return session?.user?.id ?? null;
}

function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
        if (translations[currentLanguage] && translations[currentLanguage][el.getAttribute('data-i18n')] !== undefined) {
            el.textContent = translations[currentLanguage][el.getAttribute('data-i18n')];
        }
    });
    document.documentElement.lang = currentLanguage;
}

applyTranslations();

function setActiveLanguageButton() {
    document.getElementById('lang-pt').classList.toggle('is-active', currentLanguage === 'pt');
    document.getElementById('lang-en').classList.toggle('is-active', currentLanguage === 'en');
}

function changeLanguage(lang) {
    currentLanguage = lang;
    localStorage.setItem('time-attack:language', lang);
    applyTranslations();
    setActiveLanguageButton();
}

document.getElementById('lang-pt').addEventListener('click', () => changeLanguage('pt'));
document.getElementById('lang-en').addEventListener('click', () => changeLanguage('en'));
setActiveLanguageButton();

// --------------------------------------------------------
// Referências DOM
// --------------------------------------------------------

const screenJoin = document.getElementById('screen-join');
const screenReady = document.getElementById('screen-ready');
const screenGame = document.getElementById('screen-game');
const screenFinished = document.getElementById('screen-finished');
const logoImg = document.getElementById('logo-img');

const roomCodeInput = document.getElementById('room-code-input');
const nicknameInput = document.getElementById('nickname-input');
const joinError = document.getElementById('join-error');
const joinRoomBtn = document.getElementById('join-room-btn');

const playBtn = document.getElementById('play-btn');

const timeBankValue = document.getElementById('time-bank-value');
const scoreValue = document.getElementById('score-value');
const questionText = document.getElementById('question-text');
const answersGrid = document.getElementById('answers-grid');

const finalScore = document.getElementById('final-score');
const playAgainBtn = document.getElementById('play-again-btn');

function showScreen(el) {
    [screenJoin, screenReady, screenGame, screenFinished].forEach((s) => { s.hidden = true; });
    el.hidden = false;
}

// --------------------------------------------------------
// Pré-preencher código da sala se veio por link/QR (?room=XXXX)
// --------------------------------------------------------

const urlParams = new URLSearchParams(window.location.search);
const roomFromUrl = urlParams.get('room');
const nicknameFromUrl = urlParams.get('nickname');
const autojoinFromUrl = urlParams.get('autojoin') === '1';

if (roomFromUrl) {
    roomCodeInput.value = roomFromUrl.toUpperCase();
}
if (nicknameFromUrl) {
    nicknameInput.value = nicknameFromUrl;
}

// --------------------------------------------------------
// Entrar na sala
// --------------------------------------------------------

let currentRoom = null;
let currentNickname = '';

// --------------------------------------------------------
// Checagem de nome - usada tanto ao entrar na sala quanto ao clicar
// em Jogar (dois pontos de checagem, ver playBtn mais abaixo pra
// entender por quê). Guest NUNCA tem prioridade: perde pra qualquer
// linha já existente na sala, e também não pode usar um nome que já
// é username de alguma conta real, mesmo que essa conta nunca tenha
// entrado nesta sala - prioridade é de quem tem conta, sempre.
// Logado só perde pra OUTRA conta logada de verdade, nunca pra um
// guest. Bug real reportado ao vivo: sem essa prioridade, valia só
// "quem clica Jogar primeiro fica com o nome", e dava pra um guest
// tomar o nome de uma conta de verdade se chegasse primeiro.
// --------------------------------------------------------

async function isNicknameTaken(nickname, roomId, checkUserId) {

    const { data: existingWithName } = await window.ndquestSupabase
        .from('time_attack_players')
        .select('id, user_id')
        .eq('room_id', roomId)
        .ilike('nickname', nickname);

    const takenInRoom = (existingWithName || []).some((p) => {
        if (!checkUserId) return true;
        return !!p.user_id && p.user_id !== checkUserId;
    });

    if (takenInRoom) return true;

    if (!checkUserId) {
        const { data: isRegisteredUsername } = await window.ndquestSupabase
            .rpc('username_is_taken', { check_username: nickname });
        if (isRegisteredUsername) return true;
    }

    return false;
}

async function attemptJoinRoom() {

    joinError.textContent = '';

    const roomCode = roomCodeInput.value.trim().toUpperCase();
    const nickname = nicknameInput.value.trim();

    if (!roomCode) {
        joinError.textContent = t('errors.roomCodeRequired');
        return;
    }

    if (!nickname) {
        joinError.textContent = t('errors.nicknameRequired');
        return;
    }

    joinRoomBtn.disabled = true;

    const { data, error } = await window.ndquestSupabase
        .from('time_attack_rooms')
        .select('*')
        .eq('room_code', roomCode)
        .maybeSingle();

    joinRoomBtn.disabled = false;

    if (error || !data) {
        joinError.textContent = t('errors.roomNotFound');
        return;
    }

    if (data.status === 'closed') {
        joinError.textContent = t('errors.roomClosed');
        return;
    }

    currentRoom = data;
    currentNickname = nickname;

    // Impede nome repetido dentro da mesma sala - vale tanto pra quem
    // está logado quanto pra quem entra sem login. Não bloqueia a
    // própria pessoa reconectando com o nome dela mesma (checa pelo
    // user_id, quando existe).
    const joinCheckUserId = await getCurrentUserId();
    const nameTaken = await isNicknameTaken(nickname, data.id, joinCheckUserId);

    if (nameTaken) {
        joinError.textContent = t('errors.nicknameTaken');
        return;
    }

    const roomTheme = themes.find((th) => th.name === data.theme_name) || themes[0];
    applyTheme(roomTheme);

    subscribeToRoomUpdates(currentRoom.id);

    showScreen(screenReady);
}

// Escuta mudanças na sala em tempo real - não existia antes (Time
// Attack nunca precisou disso, cada um joga no seu próprio ritmo).
// Passou a precisar pro replay controlado pelo host: quando ele
// libera nova rodada (round_number sobe), o jogador precisa saber
// disso pra destravar o botão "Jogar de novo".
let roomUpdatesChannel = null;

function subscribeToRoomUpdates(roomId) {
    roomUpdatesChannel = window.ndquestSupabase
        .channel(`time-attack-room-updates-${roomId}`)
        .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'time_attack_rooms', filter: `id=eq.${roomId}` },
            (payload) => {
                // Mescla em vez de substituir - bug real já visto antes
                // no Show Down: o pacote de UPDATE às vezes só traz os
                // campos que mudaram, não a sala inteira. Substituir
                // currentRoom por inteiro perderia campos como
                // pack_slug/host_id/room_code que não mudaram nesse
                // evento específico, mas que o resto do código ainda
                // precisa.
                currentRoom = { ...currentRoom, ...payload.new };
                updatePlayAgainButtonState();
            }
        )
        .subscribe();
}

function updatePlayAgainButtonState() {
    if (!playAgainBtn) return;
    const canReplay = playedRoundNumber === null || (currentRoom.round_number || 1) > playedRoundNumber;
    playAgainBtn.disabled = !canReplay;

    const hint = document.getElementById('waiting-host-hint');
    if (hint) hint.hidden = canReplay;
}

// --------------------------------------------------------
// Tema de marca (white label) - mesmo sistema do Quest Drop,
// cópia própria do branding/. Aqui o tema não é escolhido pelo
// jogador: ele é lido da própria sala (salvo pelo host na
// criação) e só aplicado, garantindo que os dois aparelhos
// mostrem a mesma marca.
// --------------------------------------------------------

function hexToRgbChannels(hex) {
    const clean = hex.replace('#', '');
    const value = parseInt(clean, 16);
    return `${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}`;
}

let themeFontStyleEl = null;

function applyThemeFonts(theme) {
    if (themeFontStyleEl) {
        themeFontStyleEl.remove();
        themeFontStyleEl = null;
    }

    if (theme.fonts.files.length > 0) {
        const rules = theme.fonts.files
            .map((file) => `
@font-face {
  font-family: '${file.family}';
  src: url('../${file.path}') format('woff2');
  font-weight: ${file.weight || '400'};
  font-style: ${file.style || 'normal'};
  font-display: swap;
}`)
            .join('\n');

        themeFontStyleEl = document.createElement('style');
        themeFontStyleEl.setAttribute('data-theme-fonts', '');
        themeFontStyleEl.textContent = rules;
        document.head.appendChild(themeFontStyleEl);
    }

    const root = document.documentElement;
    root.style.setProperty('--font-display', theme.fonts.display);
    root.style.setProperty('--font-body', theme.fonts.body);
}

const THEME_CSS_PROPERTIES = [
    '--color-gold', '--color-gold-light', '--color-gold-rgb',
    '--color-bg', '--color-bg-alt', '--color-bg-rgb',
    '--color-surface', '--color-surface-border',
    '--color-text', '--color-text-muted',
    '--color-success', '--color-error',
    '--color-paper', '--color-paper-dark', '--color-paper-shadow',
    '--font-display', '--font-body'
];

function applyTheme(theme) {
    const root = document.documentElement;

    THEME_CSS_PROPERTIES.forEach((prop) => root.style.removeProperty(prop));

    root.style.setProperty('--color-gold', theme.colors.primary);
    root.style.setProperty('--color-gold-light', theme.colors.primaryLight);
    root.style.setProperty('--color-gold-rgb', hexToRgbChannels(theme.colors.primary));

    root.style.setProperty('--color-bg', theme.colors.background);
    root.style.setProperty('--color-bg-alt', theme.colors.backgroundAlt);
    root.style.setProperty('--color-bg-rgb', hexToRgbChannels(theme.colors.background));

    root.style.setProperty('--color-surface', theme.colors.surface);
    root.style.setProperty('--color-surface-border', theme.colors.surfaceBorder);

    root.style.setProperty('--color-text', theme.colors.text);
    root.style.setProperty('--color-text-muted', theme.colors.textMuted);

    root.style.setProperty('--color-success', theme.colors.success);
    root.style.setProperty('--color-error', theme.colors.error);

    root.style.setProperty('--color-paper', theme.colors.paper);
    root.style.setProperty('--color-paper-dark', theme.colors.paperDark);
    root.style.setProperty('--color-paper-shadow', theme.colors.paperShadow);

    applyThemeFonts(theme);

    if (logoImg && theme.logo) {
        logoImg.src = `../${theme.logo}`;
    }
}

joinRoomBtn.addEventListener('click', attemptJoinRoom);

// Veio do botão "Jogar também" do host: código e nome já preenchidos,
// pula direto pra tela de pronto sem pedir nada de novo.
if (autojoinFromUrl && roomFromUrl && nicknameFromUrl) {
    attemptJoinRoom();
}

// --------------------------------------------------------
// Jogo: banco de tempo, perguntas, pontuação
// --------------------------------------------------------

let timeBank = 0;
let correctCount = 0;
let sessionStartTime = 0;
let gameInterval = null;
let heartbeatInterval = null; // "estou vivo" periódico - sem isso, sessão abandonada (fecha a aba no meio do jogo) fica pra sempre marcada como "jogando agora" na tela do host, mesmo horas depois

// isCustomMode/customQuestionsPool: caminho antigo, só pra perguntas
// digitadas pelo próprio host (escopo menor, fica de fora desta
// migração de propósito - ver comentário em playBtn mais abaixo).
let isCustomMode = false;
let customQuestionsPool = [];
let usedCustomIndexes = [];

// Caminho novo (pacote oficial) - Mecanismo B, ver
// docs/BADGE_INTEGRITY_ARCHITECTURE.md. Nenhuma pergunta com a
// resposta certa chega aqui - currentQuestionData só tem o que veio
// da Edge Function get-question, que nunca inclui correct_index.
let currentPackSlug = null;
let usedQuestionIds = [];
let currentQuestionData = null;

async function callGameFunction(name, payload) {
    const { data: { session } } = await window.ndquestSupabase.auth.getSession();

    // Toda chamada de Edge Function precisa de ALGUM token válido pro
    // Supabase liberar a requisição, mesmo antes dela chegar no
    // código da function - não é escolha minha, é o gateway deles.
    // Sem login, não tem session.access_token, mas a própria chave
    // pública (publishable) já serve como token válido; sem ela, dá
    // 401 sempre pra quem não estiver logado. Bug real reportado ao
    // vivo: perguntas nunca apareciam pra ninguém jogando sem conta.
    const token = session?.access_token || window.ndquestSupabaseAnonKey;

    const response = await fetch(`${window.ndquestSupabaseUrl}/functions/v1/${name}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
    });

    return response.json();
}

async function fetchNextQuestionFromServer() {
    const data = await callGameFunction('time-attack-get-question', {
        pack_slug: currentPackSlug,
        excluded_question_ids: usedQuestionIds,
    });

    // Não confia só em "data.error" - uma falha no próprio gateway do
    // Supabase (ex: 401 antes de chegar no código da function) pode
    // vir num formato totalmente diferente do que a function normal
    // devolve. Bug real reportado ao vivo: isso quebrava mais na
    // frente tentando ler .options de uma resposta que nunca teve
    // esse campo. Qualquer resposta sem question_id/options é tratada
    // como falha, seja qual for o formato exato do erro.
    if (data.error || !data.question_id || !Array.isArray(data.options)) {
        if (!data.done) {
            console.error('Time Attack: erro ao buscar pergunta', data);
        }
        if (data.done) {
            usedQuestionIds = [];
            return fetchNextQuestionFromServer();
        }
        return null;
    }

    usedQuestionIds.push(data.question_id);
    return data;
}

function pickNextCustomQuestion() {
    if (customQuestionsPool.length === 0) return null;

    if (usedCustomIndexes.length >= customQuestionsPool.length) {
        usedCustomIndexes = [];
    }

    let index;
    do {
        index = Math.floor(Math.random() * customQuestionsPool.length);
    } while (usedCustomIndexes.includes(index));

    usedCustomIndexes.push(index);
    return customQuestionsPool[index];
}

function shuffleArray(array) {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

function renderTimeBank() {
    timeBankValue.textContent = String(Math.max(0, Math.ceil(timeBank)));
    timeBankValue.classList.toggle('is-low', timeBank <= 10);
}

// Pré-carregamento - dispara a busca da PRÓXIMA pergunta assim que a
// atual é mostrada, aproveitando o tempo que a pessoa já gasta lendo
// e pensando (naturalmente maior que a ida e volta de rede) pra
// esconder a demora. Reportado ao vivo: sem isso, o jogo ficou
// perceptivelmente mais lento que antes, já que cada pergunta hoje
// depende de rede em vez de só ler um array na memória.
let prefetchedQuestionPromise = null;

function prefetchNextQuestion() {
    if (isCustomMode) return; // modo custom nunca precisou disso, é tudo local
    prefetchedQuestionPromise = fetchNextQuestionFromServer();
}

async function showNextQuestion() {

    if (isCustomMode) {

        const question = pickNextCustomQuestion();
        if (!question) {
            endGame('noQuestions');
            return;
        }

        const answers = question.answers[currentLanguage] || question.answers.pt;
        const correctText = answers[question.correct];

        currentQuestionData = { mode: 'custom', correctText };

        questionText.textContent = question.question[currentLanguage] || question.question.pt;
        renderAnswerButtons(shuffleArray(answers.map((text) => ({ text }))));
        return;

    }

    // Se já tem uma pergunta pré-carregada (do ciclo anterior),
    // reaproveita em vez de pedir de novo - na prática, quase sempre
    // já vai estar pronta, porque o pedido começou lá atrás, enquanto
    // a pessoa via se tinha acertado.
    const data = prefetchedQuestionPromise
        ? await prefetchedQuestionPromise
        : await fetchNextQuestionFromServer();
    prefetchedQuestionPromise = null;

    if (!data) {
        endGame('noQuestions');
        return;
    }

    currentQuestionData = { mode: 'official', question_id: data.question_id };

    questionText.textContent = currentLanguage === 'en' ? data.question_en : data.question_pt;

    // options já vem sem indicar qual é a certa (Mecanismo B) - o
    // índice aqui é só a posição real no banco, necessária pra
    // avisar a Edge Function qual foi escolhida depois.
    const displayOptions = data.options.map((opt) => ({
        index: opt.index,
        text: currentLanguage === 'en' ? opt.en : opt.pt,
    }));

    renderAnswerButtons(shuffleArray(displayOptions));

    // Já sai pedindo a de depois, sem esperar a pessoa responder essa.
    prefetchNextQuestion();

}

function renderAnswerButtons(options) {
    answersGrid.innerHTML = '';

    options.forEach((opt) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'answer-btn';
        btn.textContent = opt.text;
        btn.addEventListener('click', () => handleAnswer(opt, btn));
        answersGrid.appendChild(btn);
    });
}

async function handleAnswer(selectedOption, btnEl) {

    Array.from(answersGrid.children).forEach((b) => { b.disabled = true; });

    // Feedback imediato no clique, antes de saber se acertou -
    // reportado ao vivo: sem isso, o clique parecia não ter feito
    // nada até a Edge Function responder. Não dá pra revelar
    // certo/errado antes da resposta do servidor (é justamente o que
    // o Mecanismo B impede), mas dá pra reconhecer o clique na hora.
    btnEl.classList.add('is-selected');

    let isCorrect;

    if (currentQuestionData.mode === 'custom') {

        // Modo custom - sem validação de servidor, escopo menor de
        // propósito (ver comentário em playBtn). Continua confiando
        // no que o próprio navegador decide, igual sempre foi.
        isCorrect = selectedOption.text === currentQuestionData.correctText;

    } else {

        // Modo oficial - quem decide acertou ou não é a Edge
        // Function, nunca o navegador (Mecanismo B). Ela também já
        // grava o placar sozinha; o navegador só reflete o resultado
        // na tela.
        const result = await callGameFunction('time-attack-submit-answer', {
            question_id: currentQuestionData.question_id,
            selected_index: selectedOption.index,
            player_row_id: currentPlayerRowId,
        });

        if (result.error) {
            console.error('Time Attack: erro ao enviar resposta', result.error);
            isCorrect = false;
        } else {
            isCorrect = result.correct;
        }

    }

    btnEl.classList.remove('is-selected');
    btnEl.classList.add(isCorrect ? 'is-correct' : 'is-wrong');

    if (isCorrect) {
        correctCount += 1;
        timeBank += currentRoom.time_bonus_correct;
        scoreValue.textContent = String(correctCount);
    } else {
        timeBank -= currentRoom.time_penalty_wrong;
    }

    renderTimeBank();

    if (timeBank <= 0) {
        setTimeout(() => endGame('bank'), 400);
        return;
    }

    setTimeout(showNextQuestion, 400);

}

let currentPlayerRowId = null;
let playedRoundNumber = null; // qual round_number da sala eu já joguei - controla o replay liberado pelo host

playBtn.addEventListener('click', async () => {

    if (currentRoom.pack_slug === 'custom') {

        isCustomMode = true;
        customQuestionsPool = currentRoom.custom_questions || [];
        usedCustomIndexes = [];

        if (customQuestionsPool.length === 0) {
            joinError.textContent = t('errors.roomNotFound');
            showScreen(screenJoin);
            return;
        }

    } else {

        // Não precisa mais checar se o pacote existe aqui - a própria
        // Edge Function já faz essa checagem no primeiro pedido de
        // pergunta. Tirar essa consulta redundante corta uma ida e
        // volta de rede inteira do momento de clicar em "Jogar".
        isCustomMode = false;
        usedQuestionIds = [];
        currentPackSlug = currentRoom.pack_slug;

        // Dispara a busca da primeira pergunta JÁ, em paralelo com a
        // criação da linha do jogador logo abaixo - antes rodava uma
        // coisa depois da outra (linha do jogador -> só então buscar
        // pergunta), cortando o tempo total de espera quase pela
        // metade. Reportado ao vivo: "clicou em começar já laga
        // tudo".
        prefetchNextQuestion();

    }

    // Cria (ou reaproveita) a linha do jogador ANTES de liberar o
    // jogo pra começar - bug real confirmado com dado de produção:
    // antes isso rodava em paralelo, sem esperar, e numa rodada
    // rápida o endGame() conseguia terminar antes dessa criação
    // assíncrona resolver, fazendo os dois caminhos decidirem "não
    // existe linha ainda" ao mesmo tempo e criar duas. Custa um
    // instante de espera aqui, mas garante só uma linha por pessoa.
    //
    // Se ESTA sessão do navegador já jogou nesta sala antes
    // (currentPlayerRowId já setado de um "Jogar novamente"),
    // reaproveita direto - sem checar nome de novo. Bug real
    // reportado ao vivo: sem isso, quem não estava logado nunca
    // conseguia jogar de novo na mesma sala, porque a checagem de
    // nome duplicado não tem como diferenciar "sou eu de novo" de
    // "é outra pessoa com nome igual" sem um user_id - e por isso
    // sempre bloqueava, até a própria pessoa. Agora replay funciona
    // igual pra quem loga e pra quem não loga, como devia ser.
    playBtn.disabled = true;

    playedRoundNumber = currentRoom.round_number || 1;

    const startUserId = await getCurrentUserId();

    if (!currentPlayerRowId) {

        if (startUserId) {
            const { data: existing } = await window.ndquestSupabase
                .from('time_attack_players')
                .select('id')
                .eq('room_id', currentRoom.id)
                .eq('user_id', startUserId)
                .maybeSingle();

            if (existing) {
                currentPlayerRowId = existing.id;
            }
        }

        if (!currentPlayerRowId) {

            // Checagem de nome duplicado tem que acontecer AQUI, não só
            // na hora de entrar na sala - bug estrutural real: entrar e
            // jogar são passos separados no Time Attack, então na hora de
            // entrar a tabela podia estar vazia mesmo com outra pessoa já
            // tendo entrado (ela também ainda não tinha clicado "Jogar").
            // Mesma função de prioridade usada no join (isNicknameTaken).
            const nameTaken = await isNicknameTaken(currentNickname, currentRoom.id, startUserId);

            if (nameTaken) {
                playBtn.disabled = false;
                joinError.textContent = t('errors.nicknameTaken');
                showScreen(screenJoin);
                return;
            }

            const { data, error } = await window.ndquestSupabase
                .from('time_attack_players')
                .insert({
                    room_id: currentRoom.id,
                    nickname: currentNickname,
                    correct_answers: 0,
                    finished_at: null,
                    user_id: startUserId
                })
                .select()
                .single();

            if (error) {
                console.error('Time Attack start play error:', error);
            } else {
                currentPlayerRowId = data.id;
            }
        }
    }

    playBtn.disabled = false;

    usedCustomIndexes = [];
    timeBank = currentRoom.time_bank_start;
    correctCount = 0;
    sessionStartTime = Date.now();
    historyRecordedThisGame = false;

    scoreValue.textContent = '0';
    renderTimeBank();
    showScreen(screenGame);
    showNextQuestion();

    gameInterval = setInterval(() => {
        const elapsedSeconds = (Date.now() - sessionStartTime) / 1000;

        if (elapsedSeconds >= currentRoom.time_cap_seconds) {
            endGame('cap');
            return;
        }

        timeBank -= 1;
        renderTimeBank();

        if (timeBank <= 0) {
            endGame('bank');
        }
    }, 1000);

    // Sinal de vida - a cada 10s, marca que ainda está por aqui. O
    // host trata como "abandonada" qualquer sessão que fica mais de
    // 30s sem mandar isso (ver renderLeaderboard em host.js). Roda
    // solto, sem esperar resposta nem travar nada - se falhar uma
    // vez, tenta de novo no próximo ciclo, sem problema.
    if (currentPlayerRowId) {
        heartbeatInterval = setInterval(() => {
            window.ndquestSupabase
                .from('time_attack_players')
                .update({ last_seen_at: new Date().toISOString() })
                .eq('id', currentPlayerRowId)
                .then(({ error }) => {
                    if (error) console.error('Time Attack: erro no sinal de vida', error);
                });
        }, 10000);
    }

});

// Ranking completo na tela de resultado do jogador - reportado ao
// vivo: até agora o jogador só via a própria pontuação, e o texto
// literalmente mandava ele "conferir o placar na tela do host" em
// vez de mostrar pra ele mesmo. Busca todo mundo que jogou essa
// MESMA rodada (round_number), ordena, destaca a própria linha.
async function renderFinishedRanking(roomId) {
    const listEl = document.getElementById('finished-ranking-list');
    const positionEl = document.getElementById('finished-position');
    if (!listEl) return;

    // time_attack_players não guarda round_number (só time_attack_rooms
    // tem essa coluna) - reportado ao vivo: filtrar por uma coluna que
    // não existe na tabela dava erro 400, o ranking nunca aparecia. O
    // host também não filtra por rodada nessa mesma tabela (ver
    // loadLeaderboard), então segue o mesmo padrão aqui.
    const { data: players, error } = await window.ndquestSupabase
        .from('time_attack_players')
        .select('user_id, nickname, correct_answers, finished_at')
        .eq('room_id', roomId)
        .not('finished_at', 'is', null);

    if (error) {
        console.error('Time Attack: erro ao carregar ranking pro jogador', error);
    }

    if (error || !players || players.length === 0) {
        listEl.innerHTML = '';
        if (positionEl) positionEl.textContent = '';
        return;
    }

    const sorted = [...players].sort((a, b) => {
        if (b.correct_answers !== a.correct_answers) return b.correct_answers - a.correct_answers;
        return new Date(a.finished_at) - new Date(b.finished_at);
    });

    const myIndex = sorted.findIndex((p) => p.nickname === currentNickname);
    if (positionEl && myIndex >= 0) {
        positionEl.textContent = t('finished.yourPosition').replace('{n}', String(myIndex + 1));
    }

    const badgeMap = await loadPlayerBadgeMap(sorted.map((p) => p.user_id));

    listEl.innerHTML = sorted
        .map((p, i) => `
            <div class="leaderboard-row ${p.nickname === currentNickname ? 'is-selected' : ''}">
                <span class="leaderboard-row__rank">#${i + 1}</span>
                <span class="leaderboard-row__name-block">
                    <span class="leaderboard-row__name">${p.nickname}</span>
                    ${buildMiniBadgeRow(badgeMap.get(p.user_id))}
                </span>
                <span class="leaderboard-row__score">${p.correct_answers}</span>
            </div>
        `)
        .join('');
}

async function endGame(reason) {

    // Trava contra endGame ser chamado mais de uma vez pra mesma
    // partida - precisa ficar ANTES de qualquer await na função. Bug
    // real confirmado com dado de produção: duas linhas de histórico
    // pra mesma sala, quase no mesmo segundo. A trava antiga
    // (lá embaixo, depois de esperar o banco salvar a pontuação) tinha
    // uma corrida: duas chamadas de endGame() passavam pelo await e
    // chegavam na checagem antes de qualquer uma marcar a flag.
    if (historyRecordedThisGame) return;
    historyRecordedThisGame = true;

    if (gameInterval) {
        clearInterval(gameInterval);
        gameInterval = null;
    }

    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }

    finalScore.textContent = String(correctCount);

    const titleEl = document.getElementById('finished-title');
    if (titleEl) {
        titleEl.textContent = reason === 'cap' ? t('finished.titleCap') : t('finished.title');
    }

    showScreen(screenFinished);
    updatePlayAgainButtonState();

    renderFinishedRanking(currentRoom.id);

    const userId = await getCurrentUserId();

    // No modo oficial, correct_answers já foi gravado pela Edge
    // Function a cada resposta certa (Mecanismo B) - reescrever aqui
    // com a contagem local do navegador anularia essa proteção
    // inteira, já que essa contagem local ainda é algo que dá pra
    // adulterar via console. Só o modo custom (perguntas do próprio
    // host, sem validação de servidor) ainda usa a contagem local -
    // é o único lugar onde não tem outra fonte de verdade.
    const updatePayload = isCustomMode
        ? { correct_answers: correctCount, finished_at: new Date().toISOString() }
        : { finished_at: new Date().toISOString() };

    if (currentPlayerRowId) {
        const { error } = await window.ndquestSupabase
            .from('time_attack_players')
            .update(updatePayload)
            .eq('id', currentPlayerRowId);

        if (error) {
            console.error('Time Attack save score error:', error);
        }
    } else {
        // Caso raro: o registro de "começou a jogar" ainda não tinha
        // voltado do banco quando o jogo já terminou (partida muito
        // curta). Insere direto com o resultado final, em vez de
        // perder a pontuação. No modo oficial, correct_answers começa
        // em 0 aqui de propósito - se esse caso realmente acontecer,
        // as respostas certas já foram perdidas (a linha nem existia
        // pra Edge Function incrementar), mas isso não abre brecha:
        // não tem como um cliente malicioso forçar esse caminho, e
        // ele grava só 0, nunca um valor forjado.
        const { error } = await window.ndquestSupabase
            .from('time_attack_players')
            .insert({
                room_id: currentRoom.id,
                nickname: currentNickname,
                correct_answers: isCustomMode ? correctCount : 0,
                finished_at: new Date().toISOString(),
                user_id: userId
            });

        if (error) {
            console.error('Time Attack save score (fallback) error:', error);
        }
    }

    // Histórico de partida - logado vai pro match_history (público,
    // ver docs/MATCH_HISTORY_ARCHITECTURE.md). Sem login, se a sala
    // tem host logado, vai pro guest_participants - só o host daquela
    // sala vê, guarda o nome que a pessoa digitou (pode ser o @ de
    // outra rede, como combinado). Sem host logado, não tem pra quem
    // mostrar depois, não grava nada mesmo. A trava contra chamada
    // duplicada já foi feita no topo da função.
    //
    // Sempre insere uma linha NOVA, uma por rodada - bug real
    // reportado ao vivo: se 5 pessoas jogam 5 rodadas na mesma sala,
    // o histórico precisa ter as 5 partidas, não só a última (e
    // muito menos somadas). round_number (a rodada que essa pessoa
    // realmente jogou, não a atual da sala - podem ser diferentes se
    // ela ainda não clicou em jogar de novo) é o que diferencia cada
    // linha da mesma sala.
    if (userId) {

        const { error: historyError } = await window.ndquestSupabase
            .from('match_history')
            .insert({
                user_id: userId,
                role: 'player',
                game: 'time_attack',
                room_code: currentRoom.room_code,
                round_number: playedRoundNumber,
                details: { correct_answers: correctCount },
                placement: null,
            });

        if (historyError) {
            console.error('Time Attack match history error:', historyError);
        }

    } else if (currentRoom.host_id) {

        const { error: guestError } = await window.ndquestSupabase
            .from('guest_participants')
            .insert({
                host_id: currentRoom.host_id,
                game: 'time_attack',
                room_code: currentRoom.room_code,
                round_number: playedRoundNumber,
                nickname: currentNickname,
                details: { correct_answers: correctCount },
                placement: null,
            });

        if (guestError) {
            console.error('Time Attack guest participant error:', guestError);
        }

    }

    // Recalcula o ranking da rodada assim que EU termino - sem
    // depender de host nenhum clicar em nada. Idempotente (chamar de
    // novo só recalcula com o dado mais atual), então é seguro cada
    // jogador disparar isso ao seu próprio término, sem pisar no que
    // os outros também estão disparando. Escopado por round_number
    // agora - sem isso, o ranking misturaria resultados de rodadas
    // diferentes da mesma sala como se fosse tudo uma coisa só.
    callGameFunction('time-attack-update-ranking', {
        room_id: currentRoom.id,
        room_code: currentRoom.room_code,
        round_number: playedRoundNumber,
    }).catch((err) => console.error('Time Attack: erro ao recalcular ranking', err));

}

playAgainBtn.addEventListener('click', () => {
    showScreen(screenReady);
});
