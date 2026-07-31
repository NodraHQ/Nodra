// ==================================================================
// SHOW DOWN — host.js
//
// Fluxo: host cria a sala (define pacote, tempo por pergunta e
// quantidade de perguntas) → jogadores entram e ficam numa sala de
// espera → host aperta "Iniciar" → pergunta 1 aparece pra todo mundo
// ao mesmo tempo, com timer → tempo acaba (ou host encerra antes) →
// tela de resultado com ranking parcial → host avança → repete até
// a última pergunta → ranking final.
//
// O estado da partida (pergunta atual, status) vive na própria linha
// da sala no Supabase. O host escreve nela, os jogadores ficam
// inscritos nela via Realtime e reagem sozinhos, sem precisar de F5.
// ==================================================================

import questionPacks from './questions/questions-manifest.js';
import translations from './i18n/translations.js';
import themes from './branding/branding-manifest.js';

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
    populatePackSelect();
    updatePreviewStatus();
}

document.getElementById('lang-pt').addEventListener('click', () => changeLanguage('pt'));
document.getElementById('lang-en').addEventListener('click', () => changeLanguage('en'));
setActiveLanguageButton();

// --------------------------------------------------------
// Referências DOM
// --------------------------------------------------------

const screenConfig = document.getElementById('screen-config');
const screenWaiting = document.getElementById('screen-waiting');
const screenQuestion = document.getElementById('screen-question-host');
const screenResults = document.getElementById('screen-results-host');
const screenFinal = document.getElementById('screen-final-host');

const hostNameInput = document.getElementById('host-name-input');
const packSelect = document.getElementById('pack-select');
const themeSelect = document.getElementById('theme-select');
const logoImg = document.getElementById('logo-img');
const questionSecondsInput = document.getElementById('question-seconds-input');
const numQuestionsInput = document.getElementById('num-questions-input');
const configError = document.getElementById('config-error');
const createRoomBtn = document.getElementById('create-room-btn');

const roomCodeText = document.getElementById('room-code-text');
const roomQrImg = document.getElementById('room-qr-img');
const roomLinkText = document.getElementById('room-link-text');
const copyLinkBtn = document.getElementById('copy-link-btn');
const closeRoomBtn = document.getElementById('close-room-btn');
const closeRoomBtnFinal = document.getElementById('close-room-btn-final');

const waitingEmpty = document.getElementById('waiting-empty');
const waitingPlayersList = document.getElementById('waiting-players-list');
const startQuizBtn = document.getElementById('start-quiz-btn');

const questionIndexLabel = document.getElementById('question-index-label');
const timerFill = document.getElementById('timer-fill');
const timerSeconds = document.getElementById('timer-seconds');
const hostQuestionText = document.getElementById('host-question-text');
const hostAnswersGrid = document.getElementById('host-answers-grid');
const endQuestionBtn = document.getElementById('end-question-btn');

const resultsIndexLabel = document.getElementById('results-index-label');
const resultsCorrectAnswer = document.getElementById('results-correct-answer');
const resultsRankingList = document.getElementById('results-ranking-list');
const nextQuestionBtn = document.getElementById('next-question-btn');

const finalRankingList = document.getElementById('final-ranking-list');
const playAgainBtn = document.getElementById('play-again-btn');

const customQuestionsPanel = document.getElementById('custom-questions-panel');
const bulkTextarea = document.getElementById('bulk-textarea');
const downloadTemplateBtn = document.getElementById('download-template-btn');
const fileUploadInput = document.getElementById('file-upload');
const parseBtn = document.getElementById('parse-btn');
const parseErrorsBox = document.getElementById('parse-errors');
const previewStatus = document.getElementById('preview-status');
const previewList = document.getElementById('preview-list');

function showScreen(el) {
    [screenConfig, screenWaiting, screenQuestion, screenResults, screenFinal].forEach((s) => { s.hidden = true; });
    el.hidden = false;
}

// --------------------------------------------------------
// Popular pacotes de perguntas
// --------------------------------------------------------

function populatePackSelect() {
    const previousValue = packSelect.value;
    packSelect.innerHTML = '';

    questionPacks.forEach((pack, index) => {
        const option = document.createElement('option');
        option.value = String(index);
        option.textContent = pack.name[currentLanguage] || pack.name.pt;
        packSelect.appendChild(option);
    });

    const customOption = document.createElement('option');
    customOption.value = 'custom';
    customOption.textContent = t('pack.customOption');
    packSelect.appendChild(customOption);

    if (previousValue) {
        packSelect.value = previousValue;
    }
}

populatePackSelect();

packSelect.addEventListener('change', () => {
    const isCustom = packSelect.value === 'custom';
    customQuestionsPanel.hidden = !isCustom;
    numQuestionsInput.disabled = isCustom;
});

// --------------------------------------------------------
// Tema de marca (white label) — mesmo sistema do Quest Drop,
// cópia própria do branding/, arquivo independente. O tema
// escolhido é aplicado aqui na tela do host e também salvo na
// sala, pra o jogador (em outro aparelho) aplicar o mesmo tema
// assim que entrar.
// --------------------------------------------------------

function populateThemeSelect() {
    themeSelect.innerHTML = '';
    themes.forEach((theme, index) => {
        const option = document.createElement('option');
        option.value = String(index);
        option.textContent = theme.name;
        themeSelect.appendChild(option);
    });
}

populateThemeSelect();

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
  src: url('${file.path}') format('woff2');
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
        logoImg.src = theme.logo;
    }
}

// --------------------------------------------------------
// Minhas Próprias Perguntas — mesmo formato do Quest Drop /
// Time Attack, cópia própria da lógica de parsing.
// --------------------------------------------------------

let customQuestions = [];
updatePreviewStatus();

const CUSTOM_TEMPLATE_TEXT = `PERGUNTA: Qual é a capital do Brasil?
RESPOSTAS: Brasília; São Paulo; Rio de Janeiro; Salvador
CORRETA: 1
---
PERGUNTA: O que é uma stablecoin?
RESPOSTAS: Uma moeda que nunca muda de dono; Um token que tenta manter valor estável; Uma carteira offline; Um tipo de NFT
CORRETA: 2
`;

downloadTemplateBtn.addEventListener('click', () => {
    const blob = new Blob([CUSTOM_TEMPLATE_TEXT], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo-perguntas-show-down.txt';
    a.click();
    URL.revokeObjectURL(url);
});

fileUploadInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { bulkTextarea.value = reader.result; };
    reader.readAsText(file, 'utf-8');
});

function parseCustomBulkText(text) {
    const blocks = text.split(/\n\s*---\s*\n/).map((b) => b.trim()).filter(Boolean);
    const parsed = [];
    const errors = [];

    blocks.forEach((block, i) => {
        const label = `Pergunta ${i + 1}`;
        const data = {};
        block.split('\n').forEach((line) => {
            const match = line.match(/^([^:]+):\s*(.+)$/);
            if (match) data[match[1].trim().toUpperCase()] = match[2].trim();
        });

        const questionText = data['PERGUNTA'];
        if (!questionText) {
            errors.push(`${label}: faltou PERGUNTA.`);
            return;
        }

        const answersRaw = data['RESPOSTAS'];
        if (!answersRaw) {
            errors.push(`${label}: faltou RESPOSTAS.`);
            return;
        }

        const answers = answersRaw.split(';').map((a) => a.trim()).filter(Boolean);
        if (answers.length !== 4) {
            errors.push(`${label}: precisa ter exatamente 4 respostas separadas por ";" (encontrei ${answers.length}).`);
            return;
        }

        const correctRaw = Number(data['CORRETA']);
        if (!correctRaw || correctRaw < 1 || correctRaw > 4) {
            errors.push(`${label}: CORRETA precisa ser um número de 1 a 4.`);
            return;
        }

        parsed.push({
            question: { pt: questionText, en: questionText },
            answers: { pt: answers, en: answers },
            correct: correctRaw - 1
        });
    });

    if (parsed.length > 50) {
        errors.push(`Máximo de 50 perguntas por sala (encontrei ${parsed.length}).`);
    }

    return { parsed, errors };
}

function updatePreviewStatus() {
    if (customQuestions.length === 0) {
        previewStatus.textContent = t('customQuestions.noneYet');
    } else {
        previewStatus.textContent = t('customQuestions.someProcessed', { n: customQuestions.length });
    }
}

function renderPreview(parsed, errors) {
    if (errors.length > 0) {
        parseErrorsBox.hidden = false;
        parseErrorsBox.innerHTML = `<strong>Encontrei ${errors.length} problema(s):</strong><ul>${errors.map((e) => `<li>${e}</li>`).join('')}</ul>`;
    } else {
        parseErrorsBox.hidden = true;
    }

    previewList.innerHTML = '';
    parsed.forEach((q) => {
        const item = document.createElement('div');
        item.className = 'preview-item';
        item.textContent = q.question.pt;
        previewList.appendChild(item);
    });

    customQuestions = parsed;
    updatePreviewStatus();
}

parseBtn.addEventListener('click', () => {
    const { parsed, errors } = parseCustomBulkText(bulkTextarea.value);
    renderPreview(parsed, errors);
});

// --------------------------------------------------------
// Código de sala (curto, fácil de digitar, sem caracteres
// ambíguos como 0/O ou 1/I)
// --------------------------------------------------------

function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i += 1) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

function shuffleArray(array) {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

function buildFlatPool(pack) {
    return [
        ...(pack.questions.easy || []),
        ...(pack.questions.medium || []),
        ...(pack.questions.hard || [])
    ];
}

function buildQuestionsForPack(packSlug, numQuestionsWanted) {

    if (packSlug === 'custom') {
        if (customQuestions.length === 0) {
            return { questions: null, errorKey: 'errors.customQuestionsRequired' };
        }
        let questions = customQuestions.map((q) => ({
            question: q.question,
            answers: { pt: shuffleArray(q.answers.pt), en: q.answers.en },
            correct: q.correct
        }));
        // Pra manter pt/en com a mesma ordem embaralhada quando o
        // texto é igual nos dois idiomas (caso comum do formulário
        // de perguntas próprias), reaplica a mesma ordem em "en".
        questions = questions.map((q, i) => {
            const originalPt = customQuestions[i].answers.pt;
            const correctTextPt = originalPt[customQuestions[i].correct];
            const newCorrectIndex = q.answers.pt.indexOf(correctTextPt);
            return { ...q, correct: newCorrectIndex, answers: { pt: q.answers.pt, en: q.answers.pt } };
        });
        return { questions, errorKey: null };
    }

    const packIndex = Number(packSlug);
    const pack = questionPacks[packIndex];
    if (!pack) {
        return { questions: null, errorKey: 'errors.roomCreateFailed' };
    }
    const pool = buildFlatPool(pack);
    if (pool.length < numQuestionsWanted) {
        return { questions: null, errorKey: 'errors.notEnoughQuestions' };
    }
    const shuffledPool = shuffleArray(pool);
    const picked = shuffledPool.slice(0, numQuestionsWanted);
    const questions = picked.map((q) => {
        const correctTextPt = q.answers.pt[q.correct];
        const answersEnSource = q.answers.en || q.answers.pt;
        // Embaralha pt uma vez e espelha a mesma posição em en,
        // pareando pelo texto correspondente de cada idioma.
        const shuffledPt = shuffleArray(q.answers.pt);
        const shuffledEn = shuffledPt.map((ptText) => {
            const idx = q.answers.pt.indexOf(ptText);
            return answersEnSource[idx];
        });
        return {
            question: q.question,
            answers: { pt: shuffledPt, en: shuffledEn },
            correct: shuffledPt.indexOf(correctTextPt)
        };
    });
    return { questions, errorKey: null };
}

// --------------------------------------------------------
// Criar sala
// --------------------------------------------------------

let activeRoomId = null;
let selectedQuestions = [];
let numQuestionsTotal = 0;
let questionSecondsValue = 30;
let currentQuestionIndex = -1;
let questionTimerInterval = null;
let playersRealtimeChannel = null;
let currentPackSlug = null;

createRoomBtn.addEventListener('click', async () => {

    configError.textContent = '';

    const hostName = hostNameInput.value.trim();
    if (!hostName) {
        configError.textContent = t('errors.hostNameRequired');
        return;
    }

    const questionSeconds = Number(questionSecondsInput.value);
    const numQuestionsWanted = Number(numQuestionsInput.value);

    if (!questionSeconds || questionSeconds <= 0 || !numQuestionsWanted || numQuestionsWanted <= 0) {
        configError.textContent = t('errors.invalidValues');
        return;
    }

    const packSlug = packSelect.value;

    const { questions, errorKey } = buildQuestionsForPack(packSlug, numQuestionsWanted);
    if (errorKey) {
        configError.textContent = t(errorKey);
        return;
    }

    if (themes.length === 0) {
        configError.textContent = t('errors.noThemes');
        return;
    }

    const selectedTheme = themes[Number(themeSelect.value)];

    createRoomBtn.disabled = true;

    const roomCode = generateRoomCode();

    const roomPayload = {
        room_code: roomCode,
        host_name: hostName,
        pack_slug: packSlug,
        question_seconds: questionSeconds,
        num_questions: questions.length,
        questions,
        status: 'waiting',
        current_question_index: -1,
        theme_name: selectedTheme.name
    };

    const { data, error } = await window.ndquestSupabase
        .from('showdown_rooms')
        .insert(roomPayload)
        .select()
        .single();

    createRoomBtn.disabled = false;

    if (error || !data) {
        configError.textContent = t('errors.roomCreateFailed');
        console.error('Show Down create room error:', error);
        return;
    }

    currentPackSlug = packSlug;
    activeRoomId = data.id;
    selectedQuestions = data.questions;
    numQuestionsTotal = data.num_questions;
    questionSecondsValue = data.question_seconds;

    applyTheme(selectedTheme);
    showWaitingScreen(roomCode);
});

// --------------------------------------------------------
// Tela de espera: código, QR, lista de jogadores
// --------------------------------------------------------

function showWaitingScreen(roomCode) {

    showScreen(screenWaiting);

    roomCodeText.textContent = roomCode;

    const baseUrl = `${window.location.origin}${window.location.pathname.replace('index.html', '')}play/index.html`;
    const publicPlayUrl = `${baseUrl}?room=${roomCode}`;
    roomLinkText.textContent = publicPlayUrl;

    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(publicPlayUrl)}`;
    roomQrImg.src = qrApiUrl;

    document.querySelectorAll('.room-mini-code').forEach((el) => { el.textContent = roomCode; });
    document.querySelectorAll('.room-mini-qr').forEach((el) => { el.src = qrApiUrl; });

    subscribeToPlayers(activeRoomId);
}

function renderWaitingPlayers(players) {
    if (players.length === 0) {
        waitingEmpty.hidden = false;
        waitingPlayersList.innerHTML = '';
        return;
    }

    waitingEmpty.hidden = true;
    waitingPlayersList.innerHTML = players
        .map((p) => `<span class="player-chip">${p.nickname}</span>`)
        .join('');
}

async function loadPlayers(roomId) {
    const { data, error } = await window.ndquestSupabase
        .from('showdown_players')
        .select('id, nickname, total_score')
        .eq('room_id', roomId)
        .order('joined_at', { ascending: true });

    if (error) {
        console.error('Show Down load players error:', error);
        return [];
    }
    return data || [];
}

function subscribeToPlayers(roomId) {
    loadPlayers(roomId).then(renderWaitingPlayers);

    if (playersRealtimeChannel) {
        window.ndquestSupabase.removeChannel(playersRealtimeChannel);
    }

    playersRealtimeChannel = window.ndquestSupabase
        .channel(`show-down-players-${roomId}`)
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'showdown_players', filter: `room_id=eq.${roomId}` },
            () => loadPlayers(roomId).then(renderWaitingPlayers)
        )
        .subscribe();
}

// --------------------------------------------------------
// Iniciar quiz / avançar pergunta
// --------------------------------------------------------

async function goToQuestion(index) {

    currentQuestionIndex = index;
    const startedAt = new Date().toISOString();

    const { error } = await window.ndquestSupabase
        .from('showdown_rooms')
        .update({
            status: 'question',
            current_question_index: index,
            question_started_at: startedAt
        })
        .eq('id', activeRoomId);

    if (error) {
        console.error('Show Down go to question error:', error);
        return;
    }

    renderQuestionScreen(index, startedAt);
}

startQuizBtn.addEventListener('click', () => {
    goToQuestion(0);
});

function renderQuestionScreen(index, startedAtISO) {

    showScreen(screenQuestion);

    questionIndexLabel.textContent = t('question.indexLabel', { current: index + 1, total: numQuestionsTotal });

    const q = selectedQuestions[index];
    const answers = q.answers[currentLanguage] || q.answers.pt;

    hostQuestionText.textContent = q.question[currentLanguage] || q.question.pt;
    hostAnswersGrid.innerHTML = '';
    answers.forEach((answerText) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'answer-btn';
        btn.textContent = answerText;
        btn.disabled = true;
        hostAnswersGrid.appendChild(btn);
    });

    startQuestionTimer(startedAtISO);
}

function startQuestionTimer(startedAtISO) {

    if (questionTimerInterval) {
        clearInterval(questionTimerInterval);
    }

    const startedAtMs = new Date(startedAtISO).getTime();

    function tick() {
        const elapsedSeconds = (Date.now() - startedAtMs) / 1000;
        const remaining = Math.max(0, questionSecondsValue - elapsedSeconds);
        const ratio = Math.max(0, Math.min(1, remaining / questionSecondsValue));

        timerFill.style.width = `${ratio * 100}%`;
        timerFill.classList.toggle('is-low', remaining <= 5);
        timerSeconds.textContent = String(Math.ceil(remaining));

        if (remaining <= 0) {
            clearInterval(questionTimerInterval);
            questionTimerInterval = null;
            endCurrentQuestion();
        }
    }

    tick();
    questionTimerInterval = setInterval(tick, 200);
}

endQuestionBtn.addEventListener('click', () => {
    if (questionTimerInterval) {
        clearInterval(questionTimerInterval);
        questionTimerInterval = null;
    }
    endCurrentQuestion();
});

async function endCurrentQuestion() {

    const { error } = await window.ndquestSupabase
        .from('showdown_rooms')
        .update({ status: 'results' })
        .eq('id', activeRoomId);

    if (error) {
        console.error('Show Down end question error:', error);
    }

    await renderResultsScreen(currentQuestionIndex);
}

async function renderResultsScreen(index) {

    showScreen(screenResults);

    resultsIndexLabel.textContent = t('question.indexLabel', { current: index + 1, total: numQuestionsTotal });

    const q = selectedQuestions[index];
    const answers = q.answers[currentLanguage] || q.answers.pt;
    resultsCorrectAnswer.textContent = answers[q.correct];

    const players = await loadPlayers(activeRoomId);
    renderRankingList(resultsRankingList, players);

    const isLastQuestion = index >= numQuestionsTotal - 1;
    nextQuestionBtn.textContent = isLastQuestion ? t('buttons.seeFinalRanking') : t('buttons.nextQuestion');
}

function renderRankingList(container, players) {
    const sorted = [...players].sort((a, b) => b.total_score - a.total_score);
    container.innerHTML = sorted
        .map((p, i) => `
            <div class="leaderboard-row">
                <span class="leaderboard-row__rank">#${i + 1}</span>
                <span class="leaderboard-row__name">${p.nickname}</span>
                <span class="leaderboard-row__score">${p.total_score} ${t('ranking.pointsLabel')}</span>
            </div>
        `)
        .join('');
}

nextQuestionBtn.addEventListener('click', async () => {
    const nextIndex = currentQuestionIndex + 1;
    if (nextIndex >= numQuestionsTotal) {
        await finishGame();
    } else {
        goToQuestion(nextIndex);
    }
});

async function finishGame() {

    const { error } = await window.ndquestSupabase
        .from('showdown_rooms')
        .update({ status: 'finished' })
        .eq('id', activeRoomId);

    if (error) {
        console.error('Show Down finish game error:', error);
    }

    showScreen(screenFinal);
    const players = await loadPlayers(activeRoomId);
    renderRankingList(finalRankingList, players);
}

// --------------------------------------------------------
// Jogar de novo: mesma sala, mesmo código, mesmos jogadores —
// só sorteia um novo conjunto de perguntas e zera o placar.
// --------------------------------------------------------

playAgainBtn.addEventListener('click', async () => {

    playAgainBtn.disabled = true;

    const { questions, errorKey } = buildQuestionsForPack(currentPackSlug, numQuestionsTotal);
    if (errorKey) {
        // Não deveria acontecer (mesmo pacote que já funcionou antes),
        // mas se acontecer, mantém a tela como está em vez de travar.
        console.error('Show Down play again error:', errorKey);
        playAgainBtn.disabled = false;
        return;
    }

    // Limpa as respostas da partida anterior: sem isso, a trava de
    // "uma resposta por pergunta por jogador" (unique de player_id +
    // question_index) impediria qualquer um de responder de novo,
    // já que os números das perguntas se repetem entre uma partida
    // e outra na mesma sala.
    await window.ndquestSupabase
        .from('showdown_answers')
        .delete()
        .eq('room_id', activeRoomId);

    await window.ndquestSupabase
        .from('showdown_players')
        .update({ total_score: 0 })
        .eq('room_id', activeRoomId);

    const { error } = await window.ndquestSupabase
        .from('showdown_rooms')
        .update({
            questions,
            num_questions: questions.length,
            status: 'waiting',
            current_question_index: -1,
            question_started_at: null
        })
        .eq('id', activeRoomId);

    playAgainBtn.disabled = false;

    if (error) {
        console.error('Show Down play again error:', error);
        return;
    }

    selectedQuestions = questions;
    currentQuestionIndex = -1;

    const roomCode = roomCodeText.textContent;
    showWaitingScreen(roomCode);
});

// --------------------------------------------------------
// Copiar link / encerrar sala
// --------------------------------------------------------

copyLinkBtn.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(roomLinkText.textContent);
        const originalLabel = copyLinkBtn.textContent;
        copyLinkBtn.textContent = t('buttons.linkCopied');
        copyLinkBtn.classList.add('is-copied');
        setTimeout(() => {
            copyLinkBtn.textContent = originalLabel;
            copyLinkBtn.classList.remove('is-copied');
        }, 1800);
    } catch (err) {
        console.error('Show Down copy link error:', err);
    }
});

async function closeRoom() {
    if (!activeRoomId) return;

    await window.ndquestSupabase
        .from('showdown_rooms')
        .update({ status: 'closed' })
        .eq('id', activeRoomId);

    if (playersRealtimeChannel) {
        window.ndquestSupabase.removeChannel(playersRealtimeChannel);
    }

    [closeRoomBtn, closeRoomBtnFinal].forEach((btn) => {
        if (!btn) return;
        btn.textContent = t('room.closedMessage');
        btn.disabled = true;
    });
}

closeRoomBtn.addEventListener('click', closeRoom);
closeRoomBtnFinal.addEventListener('click', closeRoom);
