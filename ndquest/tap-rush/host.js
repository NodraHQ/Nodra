// ==================================================================
// TAP RUSH — host.js
//
// Dois modos, mesma sala:
//   "race"     — cada jogador toca por si, primeiro a bater a meta
//                de toques vence (com um tempo máximo de segurança
//                caso ninguém bata a meta).
//   "tugofwar" — dividido em Time A / Time B (por ordem de entrada,
//                automático), dura um tempo fixo, time com mais
//                toques no total vence.
//
// Os toques não vão um por um pro banco — cada celular acumula
// localmente e manda o total atualizado a cada ~150ms. O host fica
// inscrito nos jogadores via Realtime e só desenha a tela com o que
// chega. O início da rodada usa um timestamp no FUTURO
// (round_started_at) como ponto de referência compartilhado: tanto
// o host quanto os jogadores calculam a contagem regressiva e o
// cronômetro a partir da mesma marca, sem precisar de um estado
// "countdown" separado no banco.
// ==================================================================

import translations from './i18n/translations.js';
import themes from './branding/branding-manifest.js';

// --------------------------------------------------------
// Idioma
// --------------------------------------------------------

let currentLanguage = localStorage.getItem('tap-rush:language') || 'pt';

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
    localStorage.setItem('tap-rush:language', lang);
    applyTranslations();
    setActiveLanguageButton();
    populateThemeSelect();
    updateWaitingSubtitle();
}

document.getElementById('lang-pt').addEventListener('click', () => changeLanguage('pt'));
document.getElementById('lang-en').addEventListener('click', () => changeLanguage('en'));
setActiveLanguageButton();

// --------------------------------------------------------
// Referências DOM
// --------------------------------------------------------

const screenConfig = document.getElementById('screen-config');
const screenWaiting = document.getElementById('screen-waiting-host');
const screenCountdown = document.getElementById('screen-countdown-host');
const screenActive = document.getElementById('screen-active-host');
const screenResults = document.getElementById('screen-results-host');

const hostNameInput = document.getElementById('host-name-input');
const themeSelect = document.getElementById('theme-select');
const logoImg = document.getElementById('logo-img');
const configError = document.getElementById('config-error');
const createRoomBtn = document.getElementById('create-room-btn');

const modeCardRace = document.getElementById('mode-card-race');
const modeCardInfinite = document.getElementById('mode-card-infinite');
const modeCardTug = document.getElementById('mode-card-tugofwar');
const raceFields = document.getElementById('race-fields');
const durationFields = document.getElementById('duration-fields');
const targetTapsInput = document.getElementById('target-taps-input');
const maxSecondsInput = document.getElementById('max-seconds-input');
const durationSecondsInput = document.getElementById('duration-seconds-input');

const roomCodeText = document.getElementById('room-code-text');
const roomQrImg = document.getElementById('room-qr-img');
const roomLinkText = document.getElementById('room-link-text');
const copyLinkBtn = document.getElementById('copy-link-btn');
const closeRoomBtn = document.getElementById('close-room-btn');
const closeRoomBtnFinal = document.getElementById('close-room-btn-final');

const waitingSubtitle = document.getElementById('waiting-subtitle');
const waitingEmpty = document.getElementById('waiting-empty');
const waitingPlayersList = document.getElementById('waiting-players-list');
const startRoundBtn = document.getElementById('start-round-btn');

const countdownNumberHost = document.getElementById('countdown-number-host');

const activeTimerHost = document.getElementById('active-timer-host');
const raceView = document.getElementById('race-view');
const raceTrack = document.getElementById('race-track');
const tugView = document.getElementById('tug-view');
const tugScoreA = document.getElementById('tug-score-a');
const tugScoreB = document.getElementById('tug-score-b');
const tugKnot = document.getElementById('tug-knot');

const resultsWinnerName = document.getElementById('results-winner-name');
const resultsRankingList = document.getElementById('results-ranking-list');
const copyRankingBtn = document.getElementById('copy-ranking-btn');
const resultsRoomCodeValue = document.getElementById('results-room-code-value');
const copyResultsCodeBtn = document.getElementById('copy-results-code-btn');
const playAgainBtn = document.getElementById('play-again-btn');

function showScreen(el) {
    [screenConfig, screenWaiting, screenCountdown, screenActive, screenResults].forEach((s) => { s.hidden = true; });
    el.hidden = false;
}

// --------------------------------------------------------
// Tema de marca (white label)
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
// Seletor de modo
// --------------------------------------------------------

let selectedMode = 'race';

function selectMode(mode) {
    selectedMode = mode;
    modeCardRace.classList.toggle('is-selected', mode === 'race');
    modeCardInfinite.classList.toggle('is-selected', mode === 'infinite');
    modeCardTug.classList.toggle('is-selected', mode === 'tugofwar');
    raceFields.hidden = mode !== 'race';
    durationFields.hidden = mode === 'race';
    updateWaitingSubtitle();
}

modeCardRace.addEventListener('click', () => selectMode('race'));
modeCardInfinite.addEventListener('click', () => selectMode('infinite'));
modeCardTug.addEventListener('click', () => selectMode('tugofwar'));

function updateWaitingSubtitle() {
    waitingSubtitle.textContent = selectedMode === 'tugofwar' ? t('waiting.subtitleTug') : t('waiting.subtitleRace');
}

// --------------------------------------------------------
// Código de sala
// --------------------------------------------------------

function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i += 1) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

// --------------------------------------------------------
// Criar sala
// --------------------------------------------------------

let activeRoomId = null;
let activeRoomCode = null;
let roundConfig = {};
let playersRealtimeChannel = null;

createRoomBtn.addEventListener('click', async () => {

    configError.textContent = '';

    const hostName = hostNameInput.value.trim();
    if (!hostName) {
        configError.textContent = t('errors.hostNameRequired');
        return;
    }

    if (themes.length === 0) {
        configError.textContent = t('errors.noThemes');
        return;
    }

    const roomPayload = {
        room_code: generateRoomCode(),
        host_name: hostName,
        mode: selectedMode,
        status: 'waiting',
        theme_name: themes[Number(themeSelect.value)].name
    };

    if (selectedMode === 'race') {
        const targetTaps = Number(targetTapsInput.value);
        const maxSeconds = Number(maxSecondsInput.value);
        if (!targetTaps || targetTaps <= 0 || !maxSeconds || maxSeconds <= 0) {
            configError.textContent = t('errors.invalidValues');
            return;
        }
        roomPayload.target_taps = targetTaps;
        roomPayload.max_seconds = maxSeconds;
    } else {
        const durationSeconds = Number(durationSecondsInput.value);
        if (!durationSeconds || durationSeconds <= 0) {
            configError.textContent = t('errors.invalidValues');
            return;
        }
        roomPayload.duration_seconds = durationSeconds;
    }

    createRoomBtn.disabled = true;

    const { data, error } = await window.ndquestSupabase
        .from('tap_rush_rooms')
        .insert(roomPayload)
        .select()
        .single();

    createRoomBtn.disabled = false;

    if (error || !data) {
        configError.textContent = t('errors.roomCreateFailed');
        console.error('Tap Rush create room error:', error);
        return;
    }

    activeRoomId = data.id;
    activeRoomCode = data.room_code;
    roundConfig = data;

    applyTheme(themes[Number(themeSelect.value)]);

    showWaitingScreen(data.room_code);
});

// --------------------------------------------------------
// Tela de espera
// --------------------------------------------------------

function showWaitingScreen(roomCode) {

    updateWaitingSubtitle();
    showScreen(screenWaiting);

    roomCodeText.textContent = roomCode;

    const baseUrl = `${window.location.origin}${window.location.pathname.replace('index.html', '')}play/index.html`;
    const publicPlayUrl = `${baseUrl}?room=${roomCode}`;
    roomLinkText.textContent = publicPlayUrl;
    roomQrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(publicPlayUrl)}`;

    subscribeToPlayers(activeRoomId);
}

async function loadPlayers(roomId) {
    const { data, error } = await window.ndquestSupabase
        .from('tap_rush_players')
        .select('id, nickname, team, tap_count')
        .eq('room_id', roomId)
        .order('joined_at', { ascending: true });

    if (error) {
        console.error('Tap Rush load players error:', error);
        return [];
    }
    return data || [];
}

let latestPlayers = [];

function renderWaitingPlayers(players) {
    latestPlayers = players;

    if (players.length === 0) {
        waitingEmpty.hidden = false;
        waitingPlayersList.innerHTML = '';
        return;
    }
    waitingEmpty.hidden = true;
    waitingPlayersList.innerHTML = players
        .map((p) => {
            const teamTag = p.team ? ` (${p.team})` : '';
            return `<span class="player-chip">${p.nickname}${teamTag}</span>`;
        })
        .join('');
}

function subscribeToPlayers(roomId) {
    loadPlayers(roomId).then((players) => {
        latestPlayers = players;
        renderWaitingPlayers(players);
    });

    if (playersRealtimeChannel) {
        window.ndquestSupabase.removeChannel(playersRealtimeChannel);
    }

    playersRealtimeChannel = window.ndquestSupabase
        .channel(`tap-rush-players-${roomId}`)
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'tap_rush_players', filter: `room_id=eq.${roomId}` },
            (payload) => {
                // Aplica a mudança direto em memória a partir do que já
                // vem na notificação, sem buscar tudo de novo no banco.
                // Antes, cada toque de cada jogador (a cada ~150ms)
                // disparava uma busca completa da tabela inteira — com
                // 3-4 pessoas tocando rápido isso empilhava pedidos e
                // travava a tela por um tempo.
                if (payload.eventType === 'INSERT') {
                    latestPlayers = [...latestPlayers, payload.new];
                } else if (payload.eventType === 'UPDATE') {
                    latestPlayers = latestPlayers.map((p) => (p.id === payload.new.id ? payload.new : p));
                } else if (payload.eventType === 'DELETE') {
                    latestPlayers = latestPlayers.filter((p) => p.id !== payload.old.id);
                }
                scheduleRenderFromLatestPlayers();
            }
        )
        .subscribe();

    // Rede de segurança: se o Realtime não estiver ativado na tabela,
    // isso garante que a lista e a pista/corda sempre acabam
    // atualizando, só um pouco mais devagar (a cada 1.5s).
    if (playersPollInterval) clearInterval(playersPollInterval);
    playersPollInterval = setInterval(() => {
        loadPlayers(roomId).then((players) => {
            latestPlayers = players;
            scheduleRenderFromLatestPlayers();
        });
    }, 1500);
}

let playersPollInterval = null;
let renderFrameRequested = false;

// Agrupa várias atualizações que cheguem no mesmo instante numa única
// renderização por frame, em vez de redesenhar a cada notificação.
function scheduleRenderFromLatestPlayers() {
    if (renderFrameRequested) return;
    renderFrameRequested = true;
    requestAnimationFrame(() => {
        renderFrameRequested = false;
        handlePlayersUpdate(latestPlayers);
    });
}

function handlePlayersUpdate(players) {
    if (!screenWaiting.hidden) {
        renderWaitingPlayers(players);
    }
    if (!screenActive.hidden) {
        renderActiveView(players);
        checkRaceWinner(players);
    }
}

// --------------------------------------------------------
// Iniciar rodada
// --------------------------------------------------------

let countdownInterval = null;
let roundEndTimeout = null;
let roundStartedAtMs = null;
let roundEnded = false;

startRoundBtn.addEventListener('click', async () => {

    // 3 segundos de contagem regressiva a partir de agora — host e
    // jogadores calculam a mesma coisa a partir desse timestamp
    // compartilhado, sem precisar de um estado "countdown" à parte.
    const startsAt = new Date(Date.now() + 3000).toISOString();

    const { error } = await window.ndquestSupabase
        .from('tap_rush_rooms')
        .update({ status: 'active', round_started_at: startsAt })
        .eq('id', activeRoomId);

    if (error) {
        console.error('Tap Rush start round error:', error);
        return;
    }

    roundConfig.round_started_at = startsAt;
    roundConfig.status = 'active';
    beginCountdownAndRound();
});

function beginCountdownAndRound() {

    roundEnded = false;
    roundStartedAtMs = new Date(roundConfig.round_started_at).getTime();

    showScreen(screenCountdown);

    if (countdownInterval) clearInterval(countdownInterval);

    countdownInterval = setInterval(() => {
        const msLeft = roundStartedAtMs - Date.now();
        if (msLeft <= 0) {
            clearInterval(countdownInterval);
            countdownInterval = null;
            beginActiveRound();
            return;
        }
        countdownNumberHost.textContent = String(Math.ceil(msLeft / 1000));
    }, 100);
}

function beginActiveRound() {

    showScreen(screenActive);

    raceView.hidden = roundConfig.mode === 'tugofwar';
    tugView.hidden = roundConfig.mode !== 'tugofwar';

    renderActiveView(latestPlayers);

    const totalSeconds = roundConfig.mode === 'race' ? roundConfig.max_seconds : roundConfig.duration_seconds;

    function tick() {
        const elapsed = (Date.now() - roundStartedAtMs) / 1000;
        const remaining = Math.max(0, totalSeconds - elapsed);
        activeTimerHost.textContent = String(Math.ceil(remaining));

        if (remaining <= 0 && !roundEnded) {
            endRound(null);
            return;
        }
        if (!roundEnded) {
            roundEndTimeout = setTimeout(tick, 200);
        }
    }
    tick();
}

function checkRaceWinner(players) {
    if (roundEnded || roundConfig.mode !== 'race') return;

    const winner = players.find((p) => p.tap_count >= roundConfig.target_taps);
    if (winner) {
        endRound(winner.id);
    }
}

function renderActiveView(players) {

    if (roundConfig.mode === 'race' || roundConfig.mode === 'infinite') {
        // Corrida tem meta fixa (target_taps). Clique Infinito não tem
        // meta nenhuma — a barra de cada um escala em relação a quem
        // está na frente no momento, pra sempre dar pra ver quem lidera
        // mesmo sem um número alvo definido.
        const target = roundConfig.mode === 'race'
            ? (roundConfig.target_taps || 1)
            : Math.max(1, ...players.map((p) => p.tap_count));

        raceTrack.innerHTML = players
            .map((p) => {
                const pct = Math.min(100, (p.tap_count / target) * 100);
                return `
                    <div class="race-lane">
                        <div class="race-lane__fill" style="width:${pct}%"></div>
                        <div class="race-lane__label"><span>${p.nickname}</span><span>${p.tap_count}</span></div>
                        <div class="race-lane__finish"></div>
                    </div>
                `;
            })
            .join('');
    } else {
        const teamA = players.filter((p) => p.team === 'A').reduce((sum, p) => sum + p.tap_count, 0);
        const teamB = players.filter((p) => p.team === 'B').reduce((sum, p) => sum + p.tap_count, 0);
        tugScoreA.textContent = `${t('active.teamA')}: ${teamA}`;
        tugScoreB.textContent = `${t('active.teamB')}: ${teamB}`;

        const total = teamA + teamB;
        const ratio = total === 0 ? 0 : (teamA - teamB) / total; // -1 (B domina) a 1 (A domina)
        const clamped = Math.max(-0.85, Math.min(0.85, ratio));
        const percentFromLeft = 50 + clamped * 40;
        tugKnot.style.left = `${percentFromLeft}%`;
    }
}

// --------------------------------------------------------
// Encerrar rodada
// --------------------------------------------------------

async function endRound(winnerPlayerIdFromRace) {

    if (roundEnded) return;
    roundEnded = true;

    if (roundEndTimeout) {
        clearTimeout(roundEndTimeout);
        roundEndTimeout = null;
    }

    const players = await loadPlayers(activeRoomId);

    let winnerPlayerId = winnerPlayerIdFromRace;
    let winnerTeam = null;

    if (roundConfig.mode === 'tugofwar') {
        const teamA = players.filter((p) => p.team === 'A').reduce((sum, p) => sum + p.tap_count, 0);
        const teamB = players.filter((p) => p.team === 'B').reduce((sum, p) => sum + p.tap_count, 0);
        winnerTeam = teamA === teamB ? null : (teamA > teamB ? 'A' : 'B');
    } else if (!winnerPlayerId) {
        // Clique Infinito, ou Corrida que chegou no tempo máximo sem
        // ninguém bater a meta: vencedor é quem tiver mais cliques
        // no momento em que a rodada fecha.
        const sorted = [...players].sort((a, b) => b.tap_count - a.tap_count);
        winnerPlayerId = sorted.length ? sorted[0].id : null;
    }

    // O vencedor é decidido AQUI, uma única vez, e gravado na sala.
    // Antes, cada jogador calculava "quem ganhou" sozinho comparando
    // os próprios números — se dois jogadores ficassem com cliques
    // parecidos bem na hora que a rodada fecha (o botão de cada um
    // não trava no exato mesmo instante), cada tela podia "decidir"
    // um vencedor diferente. Agora só existe uma resposta certa, e
    // todo mundo lê ela, ninguém recalcula.
    await window.ndquestSupabase
        .from('tap_rush_rooms')
        .update({ status: 'finished', winner_player_id: winnerPlayerId, winner_team: winnerTeam })
        .eq('id', activeRoomId);

    renderResults(players, winnerPlayerId, winnerTeam);
}

function renderResults(players, winnerPlayerId, winnerTeam) {

    showScreen(screenResults);

    resultsRoomCodeValue.textContent = activeRoomCode;

    if (roundConfig.mode === 'race' || roundConfig.mode === 'infinite') {
        const sorted = [...players].sort((a, b) => b.tap_count - a.tap_count);
        const winner = winnerPlayerId
            ? players.find((p) => p.id === winnerPlayerId)
            : sorted[0];

        resultsWinnerName.textContent = winner ? `${t('results.winnerLabel')} ${winner.nickname}` : '';

        lastRankingForCopy = sorted.map((p) => `${p.nickname} — ${p.tap_count}`);

        resultsRankingList.innerHTML = sorted
            .map((p, i) => `
                <div class="leaderboard-row">
                    <span class="leaderboard-row__rank">#${i + 1}</span>
                    <span class="leaderboard-row__name">${p.nickname}</span>
                    <span class="leaderboard-row__score">${p.tap_count} ${t('results.tapsLabel')}</span>
                </div>
            `)
            .join('');
    } else {
        const teamA = players.filter((p) => p.team === 'A').reduce((sum, p) => sum + p.tap_count, 0);
        const teamB = players.filter((p) => p.team === 'B').reduce((sum, p) => sum + p.tap_count, 0);
        const winningTeam = teamA === teamB ? null : (teamA > teamB ? 'A' : 'B');

        resultsWinnerName.textContent = winningTeam
            ? `${t('results.teamWinnerLabel')} ${t(winningTeam === 'A' ? 'active.teamA' : 'active.teamB')}`
            : '🤝';

        const sorted = [...players].sort((a, b) => b.tap_count - a.tap_count);

        lastRankingForCopy = sorted.map((p) => `${p.nickname} (${p.team}) — ${p.tap_count}`);

        resultsRankingList.innerHTML = sorted
            .map((p, i) => `
                <div class="leaderboard-row">
                    <span class="leaderboard-row__rank">#${i + 1}</span>
                    <span class="leaderboard-row__name">${p.nickname} (${p.team})</span>
                    <span class="leaderboard-row__score">${p.tap_count} ${t('results.tapsLabel')}</span>
                </div>
            `)
            .join('');
    }
}

// --------------------------------------------------------
// Jogar de novo
// --------------------------------------------------------

let lastRankingForCopy = [];

copyResultsCodeBtn.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(activeRoomCode);
        const original = copyResultsCodeBtn.textContent;
        copyResultsCodeBtn.textContent = t('buttons.copied');
        setTimeout(() => { copyResultsCodeBtn.textContent = original; }, 1800);
    } catch (err) {
        console.error('Tap Rush copy code error:', err);
    }
});

copyRankingBtn.addEventListener('click', async () => {
    const text = lastRankingForCopy.map((line, i) => `${i + 1}. ${line}`).join('\n');
    try {
        await navigator.clipboard.writeText(text);
        const original = copyRankingBtn.textContent;
        copyRankingBtn.textContent = t('buttons.copied');
        setTimeout(() => { copyRankingBtn.textContent = original; }, 1800);
    } catch (err) {
        console.error('Tap Rush copy ranking error:', err);
    }
});

playAgainBtn.addEventListener('click', async () => {

    await window.ndquestSupabase
        .from('tap_rush_players')
        .update({ tap_count: 0 })
        .eq('room_id', activeRoomId);

    const { data, error } = await window.ndquestSupabase
        .from('tap_rush_rooms')
        .update({ status: 'waiting', round_started_at: null })
        .eq('id', activeRoomId)
        .select()
        .single();

    if (error) {
        console.error('Tap Rush play again error:', error);
        return;
    }

    roundConfig = data;
    showWaitingScreen(activeRoomCode);
});

// --------------------------------------------------------
// Copiar link / encerrar sala
// --------------------------------------------------------

copyLinkBtn.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(roomLinkText.textContent);
        const originalLabel = copyLinkBtn.textContent;
        copyLinkBtn.textContent = t('buttons.linkCopied');
        setTimeout(() => { copyLinkBtn.textContent = originalLabel; }, 1800);
    } catch (err) {
        console.error('Tap Rush copy link error:', err);
    }
});

async function closeRoom() {
    if (!activeRoomId) return;

    await window.ndquestSupabase
        .from('tap_rush_rooms')
        .update({ status: 'closed' })
        .eq('id', activeRoomId);

    if (playersRealtimeChannel) {
        window.ndquestSupabase.removeChannel(playersRealtimeChannel);
    }
    if (playersPollInterval) {
        clearInterval(playersPollInterval);
        playersPollInterval = null;
    }

    [closeRoomBtn, closeRoomBtnFinal].forEach((btn) => {
        if (!btn) return;
        btn.textContent = t('room.closedMessage');
        btn.disabled = true;
    });

    setTimeout(() => {
        [closeRoomBtn, closeRoomBtnFinal].forEach((btn) => {
            if (!btn) return;
            btn.textContent = t('buttons.closeRoom');
            btn.disabled = false;
        });
        activeRoomId = null;
        activeRoomCode = null;
        showScreen(screenConfig);
    }, 900);
}

closeRoomBtn.addEventListener('click', closeRoom);
closeRoomBtnFinal.addEventListener('click', closeRoom);
