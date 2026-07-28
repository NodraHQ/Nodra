// ==================================================================
// TIME ATTACK — play/play.js
// ==================================================================

import questionPacks from '../questions/questions-manifest.js';
import translations from '../i18n/translations.js';

// --------------------------------------------------------
// Idioma
// --------------------------------------------------------

let currentLanguage = localStorage.getItem('time-attack:language') || 'pt';

function t(key) {
    const dict = translations[currentLanguage] || translations.pt;
    return dict[key] !== undefined ? dict[key] : key;
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

    showScreen(screenReady);
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
let usedQuestionIndexes = [];
let flatQuestionPool = [];

function buildFlatPool(pack) {
    return [
        ...(pack.questions.easy || []),
        ...(pack.questions.medium || []),
        ...(pack.questions.hard || [])
    ];
}

function pickRandomQuestion() {
    if (flatQuestionPool.length === 0) return null;

    if (usedQuestionIndexes.length >= flatQuestionPool.length) {
        // Mesma correção aplicada no Quest Drop: melhor repetir
        // pergunta do que travar o jogo no meio de uma partida.
        usedQuestionIndexes = [];
    }

    let index;
    do {
        index = Math.floor(Math.random() * flatQuestionPool.length);
    } while (usedQuestionIndexes.includes(index));

    usedQuestionIndexes.push(index);
    return flatQuestionPool[index];
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

function showNextQuestion() {
    const question = pickRandomQuestion();
    if (!question) {
        endGame('noQuestions');
        return;
    }

    const answers = question.answers[currentLanguage] || question.answers.pt;
    const correctText = answers[question.correct];
    const shuffled = shuffleArray(answers);

    questionText.textContent = question.question[currentLanguage] || question.question.pt;
    answersGrid.innerHTML = '';

    shuffled.forEach((answerText) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'answer-btn';
        btn.textContent = answerText;
        btn.addEventListener('click', () => handleAnswer(answerText === correctText, btn));
        answersGrid.appendChild(btn);
    });
}

function handleAnswer(isCorrect, btnEl) {

    Array.from(answersGrid.children).forEach((b) => { b.disabled = true; });
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

playBtn.addEventListener('click', () => {

    if (currentRoom.pack_slug === 'custom') {
        flatQuestionPool = currentRoom.custom_questions || [];
    } else {
        const packIndex = Number(currentRoom.pack_slug);
        const pack = questionPacks[packIndex];

        if (!pack) {
            joinError.textContent = t('errors.roomNotFound');
            showScreen(screenJoin);
            return;
        }

        flatQuestionPool = buildFlatPool(pack);
    }

    if (flatQuestionPool.length === 0) {
        joinError.textContent = t('errors.roomNotFound');
        showScreen(screenJoin);
        return;
    }

    usedQuestionIndexes = [];
    timeBank = currentRoom.time_bank_start;
    correctCount = 0;
    sessionStartTime = Date.now();

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

    // Registra que essa pessoa começou a jogar AGORA (finished_at
    // null), pra o host conseguir ver "X jogando agora" no placar, não
    // só quem já terminou. Roda em paralelo, sem travar o início do
    // jogo esperando o banco responder — a pessoa já está jogando
    // antes disso terminar. Atualiza essa mesma linha no final, em
    // vez de criar uma nova.
    window.ndquestSupabase
        .from('time_attack_players')
        .insert({
            room_id: currentRoom.id,
            nickname: currentNickname,
            correct_answers: 0,
            finished_at: null
        })
        .select()
        .single()
        .then(({ data, error }) => {
            if (error) {
                console.error('Time Attack start play error:', error);
                return;
            }
            currentPlayerRowId = data.id;
        });

});

async function endGame(reason) {

    if (gameInterval) {
        clearInterval(gameInterval);
        gameInterval = null;
    }

    finalScore.textContent = String(correctCount);

    const titleEl = document.getElementById('finished-title');
    if (titleEl) {
        titleEl.textContent = reason === 'cap' ? t('finished.titleCap') : t('finished.title');
    }

    showScreen(screenFinished);

    if (currentPlayerRowId) {
        const { error } = await window.ndquestSupabase
            .from('time_attack_players')
            .update({
                correct_answers: correctCount,
                finished_at: new Date().toISOString()
            })
            .eq('id', currentPlayerRowId);

        if (error) {
            console.error('Time Attack save score error:', error);
        }
    } else {
        // Caso raro: o registro de "começou a jogar" ainda não tinha
        // voltado do banco quando o jogo já terminou (partida muito
        // curta). Insere direto com o resultado final, em vez de
        // perder a pontuação.
        const { error } = await window.ndquestSupabase
            .from('time_attack_players')
            .insert({
                room_id: currentRoom.id,
                nickname: currentNickname,
                correct_answers: correctCount,
                finished_at: new Date().toISOString()
            });

        if (error) {
            console.error('Time Attack save score (fallback) error:', error);
        }
    }
}

playAgainBtn.addEventListener('click', () => {
    showScreen(screenReady);
});
