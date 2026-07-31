// ==================================================================
// SHOW DOWN — play/play.js
//
// Diferente do Time Attack (onde cada jogador roda sua própria
// partida sozinho), aqui quem manda na pergunta atual é o host. O
// jogador fica inscrito na linha da sala via Supabase Realtime: toda
// vez que o host muda o status ou avança a pergunta, essa inscrição
// dispara sozinha e a tela troca, sem precisar de F5.
// ==================================================================

import translations from '../i18n/translations.js';
import themes from '../branding/branding-manifest.js';

// --------------------------------------------------------
// Idioma
// --------------------------------------------------------

let currentLanguage = localStorage.getItem('show-down:language') || 'pt';

function t(key, vars) {
    const dict = translations[currentLanguage] || translations.pt;
    let text = dict[key] !== undefined ? dict[key] : key;
    if (vars) {
        Object.keys(vars).forEach((k) => {
            text = text.replace(`{${k}}`, String(vars[k]));
        });
    }
    return text;
}

function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
        const key = el.getAttribute('data-i18n');
        if (translations[currentLanguage] && translations[currentLanguage][key] !== undefined) {
            el.textContent = translations[currentLanguage][key];
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
    localStorage.setItem('show-down:language', lang);
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
const screenWaitingPlayer = document.getElementById('screen-waiting-player');
const screenQuestion = document.getElementById('screen-question');
const screenResults = document.getElementById('screen-results');
const screenFinal = document.getElementById('screen-final');
const logoImg = document.getElementById('logo-img');

const roomCodeInput = document.getElementById('room-code-input');
const nicknameInput = document.getElementById('nickname-input');
const joinError = document.getElementById('join-error');
const joinRoomBtn = document.getElementById('join-room-btn');

const questionIndexLabel = document.getElementById('question-index-label');
const timerFill = document.getElementById('timer-fill');
const timerSeconds = document.getElementById('timer-seconds');
const questionText = document.getElementById('question-text');
const answersGrid = document.getElementById('answers-grid');
const answerSentMsg = document.getElementById('answer-sent-msg');

const resultsBadge = document.getElementById('results-badge');
const resultsPoints = document.getElementById('results-points');
const resultsRankingList = document.getElementById('results-ranking-list');

const finalYourPosition = document.getElementById('final-your-position');
const finalRankingList = document.getElementById('final-ranking-list');

function showScreen(el) {
    [screenJoin, screenWaitingPlayer, screenQuestion, screenResults, screenFinal].forEach((s) => { s.hidden = true; });
    el.hidden = false;
}

// --------------------------------------------------------
// Pré-preencher código da sala se veio por link/QR (?room=XXXX)
// --------------------------------------------------------

const urlParams = new URLSearchParams(window.location.search);
const roomFromUrl = urlParams.get('room');
if (roomFromUrl) {
    roomCodeInput.value = roomFromUrl.toUpperCase();
}

// --------------------------------------------------------
// Entrar na sala
// --------------------------------------------------------

let currentRoom = null;
let currentPlayerId = null;
let roomRealtimeChannel = null;
let questionTimerInterval = null;
let renderedQuestionIndex = -1;
let hasAnsweredThisQuestion = false;

joinRoomBtn.addEventListener('click', async () => {

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
        .from('showdown_rooms')
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

    const { data: playerRow, error: playerError } = await window.ndquestSupabase
        .from('showdown_players')
        .insert({ room_id: currentRoom.id, nickname, total_score: 0 })
        .select()
        .single();

    if (playerError || !playerRow) {
        joinError.textContent = t('errors.roomCreateFailed');
        console.error('Show Down join room error:', playerError);
        return;
    }

    currentPlayerId = playerRow.id;

    const roomTheme = themes.find((th) => th.name === currentRoom.theme_name) || themes[0];
    applyTheme(roomTheme);

    subscribeToRoom(currentRoom.id);
    reactToRoomState(currentRoom);
});

// --------------------------------------------------------
// Tema de marca (white label) — mesmo sistema do Quest Drop,
// cópia própria do branding/. O jogador não escolhe: o tema é
// lido da própria sala (salvo pelo host na criação) e só
// aplicado, garantindo que os dois aparelhos mostrem a mesma
// marca.
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

// --------------------------------------------------------
// Inscrição em tempo real na linha da sala
// --------------------------------------------------------

function subscribeToRoom(roomId) {
    roomRealtimeChannel = window.ndquestSupabase
        .channel(`show-down-room-${roomId}`)
        .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'showdown_rooms', filter: `id=eq.${roomId}` },
            (payload) => {
                currentRoom = payload.new;
                reactToRoomState(currentRoom);
            }
        )
        .subscribe();
}

function reactToRoomState(room) {

    if (room.status === 'waiting') {
        renderedQuestionIndex = -1;
        hasAnsweredThisQuestion = false;
        showScreen(screenWaitingPlayer);
        return;
    }

    if (room.status === 'question') {
        if (room.current_question_index !== renderedQuestionIndex) {
            renderedQuestionIndex = room.current_question_index;
            hasAnsweredThisQuestion = false;
            renderQuestion(room);
        }
        return;
    }

    if (room.status === 'results') {
        if (questionTimerInterval) {
            clearInterval(questionTimerInterval);
            questionTimerInterval = null;
        }
        renderResults(room);
        return;
    }

    if (room.status === 'finished') {
        renderFinal(room);
        return;
    }

    if (room.status === 'closed') {
        joinError.textContent = t('errors.roomClosed');
        showScreen(screenJoin);
    }
}

// --------------------------------------------------------
// Tela de pergunta
// --------------------------------------------------------

function renderQuestion(room) {

    showScreen(screenQuestion);

    answerSentMsg.hidden = true;
    answersGrid.hidden = false;

    const index = room.current_question_index;
    const q = room.questions[index];
    const answers = q.answers[currentLanguage] || q.answers.pt;
    const correctText = answers[q.correct];

    questionIndexLabel.textContent = t('question.indexLabel', { current: index + 1, total: room.num_questions });
    questionText.textContent = q.question[currentLanguage] || q.question.pt;

    answersGrid.innerHTML = '';
    answers.forEach((answerText) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'answer-btn';
        btn.textContent = answerText;
        btn.addEventListener('click', () => submitAnswer(room, index, answerText === correctText, btn));
        answersGrid.appendChild(btn);
    });

    startQuestionTimer(room.question_started_at, room.question_seconds);
}

function startQuestionTimer(startedAtISO, questionSeconds) {

    if (questionTimerInterval) {
        clearInterval(questionTimerInterval);
    }

    const startedAtMs = new Date(startedAtISO).getTime();

    function tick() {
        const elapsedSeconds = (Date.now() - startedAtMs) / 1000;
        const remaining = Math.max(0, questionSeconds - elapsedSeconds);
        const ratio = Math.max(0, Math.min(1, remaining / questionSeconds));

        timerFill.style.width = `${ratio * 100}%`;
        timerFill.classList.toggle('is-low', remaining <= 5);
        timerSeconds.textContent = String(Math.ceil(remaining));

        if (remaining <= 0) {
            clearInterval(questionTimerInterval);
            questionTimerInterval = null;
            if (!hasAnsweredThisQuestion) {
                Array.from(answersGrid.children).forEach((b) => { b.disabled = true; });
                timerSeconds.textContent = t('game.timeUp');
            }
        }
    }

    tick();
    questionTimerInterval = setInterval(tick, 200);
}

function calcPoints(elapsedMs, questionSeconds) {
    const elapsedSeconds = elapsedMs / 1000;
    if (elapsedSeconds <= 3) return 1000;
    if (elapsedSeconds >= questionSeconds) return 300;
    const ratio = (elapsedSeconds - 3) / (questionSeconds - 3);
    return Math.round(1000 - ratio * (1000 - 300));
}

async function submitAnswer(room, questionIndex, isCorrect, btnEl) {

    if (hasAnsweredThisQuestion) return;
    hasAnsweredThisQuestion = true;

    Array.from(answersGrid.children).forEach((b) => { b.disabled = true; });
    btnEl.classList.add('is-selected');

    const elapsedMs = Date.now() - new Date(room.question_started_at).getTime();
    const points = isCorrect ? calcPoints(elapsedMs, room.question_seconds) : 0;

    answersGrid.hidden = true;
    answerSentMsg.hidden = false;

    const { error: answerError } = await window.ndquestSupabase
        .from('showdown_answers')
        .insert({
            room_id: room.id,
            player_id: currentPlayerId,
            question_index: questionIndex,
            is_correct: isCorrect,
            points_earned: points
        });

    if (answerError) {
        console.error('Show Down submit answer error:', answerError);
        return;
    }

    if (points > 0) {
        const { data: playerRow } = await window.ndquestSupabase
            .from('showdown_players')
            .select('total_score')
            .eq('id', currentPlayerId)
            .single();

        const newScore = (playerRow ? playerRow.total_score : 0) + points;

        await window.ndquestSupabase
            .from('showdown_players')
            .update({ total_score: newScore })
            .eq('id', currentPlayerId);
    }
}

// --------------------------------------------------------
// Tela de resultado da pergunta
// --------------------------------------------------------

async function renderResults(room) {

    showScreen(screenResults);

    const index = room.current_question_index;

    const { data: myAnswer } = await window.ndquestSupabase
        .from('showdown_answers')
        .select('is_correct, points_earned')
        .eq('player_id', currentPlayerId)
        .eq('question_index', index)
        .maybeSingle();

    resultsBadge.classList.remove('is-correct', 'is-wrong');

    if (!myAnswer) {
        resultsBadge.textContent = t('results.noAnswer');
        resultsBadge.classList.add('is-wrong');
        resultsPoints.textContent = t('results.zeroPoints');
    } else if (myAnswer.is_correct) {
        resultsBadge.textContent = t('results.correct');
        resultsBadge.classList.add('is-correct');
        resultsPoints.textContent = t('results.pointsEarned', { n: myAnswer.points_earned });
    } else {
        resultsBadge.textContent = t('results.wrong');
        resultsBadge.classList.add('is-wrong');
        resultsPoints.textContent = t('results.zeroPoints');
    }

    const players = await loadPlayers(room.id);
    renderRankingList(resultsRankingList, players);
}

async function loadPlayers(roomId) {
    const { data, error } = await window.ndquestSupabase
        .from('showdown_players')
        .select('id, nickname, total_score')
        .eq('room_id', roomId);

    if (error) {
        console.error('Show Down load players error:', error);
        return [];
    }
    return data || [];
}

function renderRankingList(container, players) {
    const sorted = [...players].sort((a, b) => b.total_score - a.total_score);
    container.innerHTML = sorted
        .map((p, i) => `
            <div class="leaderboard-row ${p.id === currentPlayerId ? 'is-selected' : ''}">
                <span class="leaderboard-row__rank">#${i + 1}</span>
                <span class="leaderboard-row__name">${p.nickname}</span>
                <span class="leaderboard-row__score">${p.total_score} ${t('ranking.pointsLabel')}</span>
            </div>
        `)
        .join('');
}

// --------------------------------------------------------
// Tela de ranking final
// --------------------------------------------------------

async function renderFinal(room) {

    showScreen(screenFinal);

    const players = await loadPlayers(room.id);
    const sorted = [...players].sort((a, b) => b.total_score - a.total_score);
    const myPosition = sorted.findIndex((p) => p.id === currentPlayerId) + 1;

    finalYourPosition.textContent = myPosition > 0
        ? t('finalRanking.yourPosition', { n: myPosition })
        : '';

    renderRankingList(finalRankingList, players);

    // A inscrição em tempo real continua ativa de propósito (não
    // remove o canal aqui): se o host apertar "Jogar de Novo", a
    // sala volta pro status "waiting" e o jogador precisa continuar
    // ouvindo essa mudança sem precisar recarregar a página. Só sai
    // de fato ao clicar em "Sair da sala" ou "Voltar pro NDQuest",
    // que navegam pra outra página e derrubam a conexão sozinhos.
}
