// ==================================================================
// TAP RUSH — play/play.js
//
// O jogador só toca. O total de toques não é mandado um por um pro
// banco (ia sobrecarregar rápido com gente tocando várias vezes por
// segundo) — acumula um contador local e manda o total atualizado
// pro Supabase a cada ~150ms, só se tiver mudado.
// ==================================================================

import translations from '../i18n/translations.js';
import themes from '../branding/branding-manifest.js';

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
}

document.getElementById('lang-pt').addEventListener('click', () => changeLanguage('pt'));
document.getElementById('lang-en').addEventListener('click', () => changeLanguage('en'));
setActiveLanguageButton();

// --------------------------------------------------------
// Referências DOM
// --------------------------------------------------------

const screenJoin = document.getElementById('screen-join');
const screenWaitingPlayer = document.getElementById('screen-waiting-player');
const screenCountdown = document.getElementById('screen-countdown-player');
const screenActive = document.getElementById('screen-active-player');
const screenResults = document.getElementById('screen-results-player');
const logoImg = document.getElementById('logo-img');

const roomCodeInput = document.getElementById('room-code-input');
const nicknameInput = document.getElementById('nickname-input');
const joinError = document.getElementById('join-error');
const joinRoomBtn = document.getElementById('join-room-btn');

const teamBadgeWrap = document.getElementById('team-badge-wrap');
const teamBadge = document.getElementById('team-badge');

const countdownNumberPlayer = document.getElementById('countdown-number-player');

const activeTimerPlayer = document.getElementById('active-timer-player');
const tapButton = document.getElementById('tap-button');
const tapCountValue = document.getElementById('tap-count-value');

const resultsBadge = document.getElementById('results-badge');
const resultsYourTaps = document.getElementById('results-your-taps');
const resultsRankingList = document.getElementById('results-ranking-list');

function showScreen(el) {
    [screenJoin, screenWaitingPlayer, screenCountdown, screenActive, screenResults].forEach((s) => { s.hidden = true; });
    el.hidden = false;
}

const urlParams = new URLSearchParams(window.location.search);
const roomFromUrl = urlParams.get('room');
if (roomFromUrl) {
    roomCodeInput.value = roomFromUrl.toUpperCase();
}

// --------------------------------------------------------
// Tema de marca — lido da sala, só aplicado.
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
// Entrar na sala
// --------------------------------------------------------

let currentRoom = null;
let currentPlayerId = null;
let myTeam = null;
let roomRealtimeChannel = null;

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
        .from('tap_rush_rooms')
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

    let team = null;
    if (data.mode === 'tugofwar') {
        const { data: existingPlayers } = await window.ndquestSupabase
            .from('tap_rush_players')
            .select('id')
            .eq('room_id', data.id);
        const count = existingPlayers ? existingPlayers.length : 0;
        team = count % 2 === 0 ? 'A' : 'B';
        myTeam = team;
    }

    const { data: playerRow, error: playerError } = await window.ndquestSupabase
        .from('tap_rush_players')
        .insert({ room_id: data.id, nickname, team, tap_count: 0 })
        .select()
        .single();

    if (playerError || !playerRow) {
        joinError.textContent = t('errors.joinFailed');
        console.error('Tap Rush join room error:', playerError);
        return;
    }

    currentPlayerId = playerRow.id;

    const roomTheme = themes.find((th) => th.name === currentRoom.theme_name) || themes[0];
    applyTheme(roomTheme);

    if (team) {
        teamBadgeWrap.hidden = false;
        teamBadge.textContent = `${t('active.' + (team === 'A' ? 'teamA' : 'teamB'))}`;
        teamBadge.className = `team-badge team-badge--${team.toLowerCase()}`;
    }

    subscribeToRoom(currentRoom.id);
    reactToRoomState(currentRoom);
});

// --------------------------------------------------------
// Inscrição em tempo real na sala
// --------------------------------------------------------

function subscribeToRoom(roomId) {
    roomRealtimeChannel = window.ndquestSupabase
        .channel(`tap-rush-room-${roomId}`)
        .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'tap_rush_rooms', filter: `id=eq.${roomId}` },
            (payload) => {
                currentRoom = payload.new;
                reactToRoomState(currentRoom);
            }
        )
        .subscribe();

    // Rede de segurança: se o Realtime não estiver ativado na tabela
    // (passo manual no painel do Supabase, fácil de esquecer), o
    // jogador ficaria preso pra sempre esperando. Essa checagem por
    // fora garante que o jogo sempre avança, só um pouco mais devagar
    // (a cada 2s) do que o Realtime de verdade.
    if (roomPollInterval) clearInterval(roomPollInterval);
    roomPollInterval = setInterval(async () => {
        const { data } = await window.ndquestSupabase
            .from('tap_rush_rooms')
            .select('*')
            .eq('id', roomId)
            .maybeSingle();
        if (data) {
            currentRoom = data;
            reactToRoomState(currentRoom);
        }
    }, 2000);
}

let roomPollInterval = null;
let lastHandledStatus = null;

function reactToRoomState(room) {

    if (room.status === 'waiting') {
        stopTapLoop();
        showScreen(screenWaitingPlayer);
        lastHandledStatus = 'waiting';
        return;
    }

    if (room.status === 'active') {
        if (lastHandledStatus !== 'active') {
            lastHandledStatus = 'active';
            beginCountdownAndRound(room);
        }
        return;
    }

    if (room.status === 'finished') {
        if (lastHandledStatus === 'finished') return;
        stopTapLoop();
        if (roomPollInterval) { clearInterval(roomPollInterval); roomPollInterval = null; }
        lastHandledStatus = 'finished';
        renderResults(room);
        return;
    }

    if (room.status === 'closed') {
        stopTapLoop();
        if (roomPollInterval) { clearInterval(roomPollInterval); roomPollInterval = null; }
        joinError.textContent = t('errors.roomClosed');
        showScreen(screenJoin);
    }
}

// --------------------------------------------------------
// Contagem regressiva + rodada
// --------------------------------------------------------

let countdownInterval = null;
let tapTimerInterval = null;
let syncInterval = null;
let localTapCount = 0;
let lastSyncedCount = 0;

function beginCountdownAndRound(room) {

    const startedAtMs = new Date(room.round_started_at).getTime();
    const msUntilStart = startedAtMs - Date.now();

    localTapCount = 0;
    lastSyncedCount = 0;
    tapCountValue.textContent = '0';
    tapButton.disabled = false;

    if (msUntilStart > 0) {
        showScreen(screenCountdown);
        if (countdownInterval) clearInterval(countdownInterval);
        countdownInterval = setInterval(() => {
            const left = startedAtMs - Date.now();
            if (left <= 0) {
                clearInterval(countdownInterval);
                countdownInterval = null;
                beginTapping(room, startedAtMs);
                return;
            }
            countdownNumberPlayer.textContent = String(Math.ceil(left / 1000));
        }, 100);
    } else {
        beginTapping(room, startedAtMs);
    }
}

function beginTapping(room, startedAtMs) {

    showScreen(screenActive);

    const totalSeconds = room.mode === 'race' ? room.max_seconds : room.duration_seconds;

    if (tapTimerInterval) clearInterval(tapTimerInterval);
    tapTimerInterval = setInterval(() => {
        const elapsed = (Date.now() - startedAtMs) / 1000;
        const remaining = Math.max(0, totalSeconds - elapsed);
        activeTimerPlayer.textContent = String(Math.ceil(remaining));
        if (remaining <= 0) {
            tapButton.disabled = true;
            clearInterval(tapTimerInterval);
            tapTimerInterval = null;
        }
    }, 200);

    if (syncInterval) clearInterval(syncInterval);
    syncInterval = setInterval(syncTapCount, 150);
}

function stopTapLoop() {
    if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
    if (tapTimerInterval) { clearInterval(tapTimerInterval); tapTimerInterval = null; }
    if (syncInterval) { clearInterval(syncInterval); syncInterval = null; }
}

tapButton.addEventListener('click', () => {
    if (tapButton.disabled) return;
    localTapCount += 1;
    tapCountValue.textContent = String(localTapCount);
});

async function syncTapCount() {
    if (localTapCount === lastSyncedCount || !currentPlayerId) return;
    const toSync = localTapCount;
    lastSyncedCount = toSync;

    const { error } = await window.ndquestSupabase
        .from('tap_rush_players')
        .update({ tap_count: toSync })
        .eq('id', currentPlayerId);

    if (error) {
        console.error('Tap Rush sync tap count error:', error);
    }
}

// --------------------------------------------------------
// Resultado
// --------------------------------------------------------

async function renderResults(room) {

    showScreen(screenResults);

    // manda o ultimo total antes de mostrar o resultado, garantindo
    // que o proprio placar bata com o que a pessoa realmente tocou
    await syncTapCount();

    const { data: players } = await window.ndquestSupabase
        .from('tap_rush_players')
        .select('id, nickname, team, tap_count')
        .eq('room_id', room.id);

    const all = players || [];
    const me = all.find((p) => p.id === currentPlayerId);
    const myTaps = me ? me.tap_count : localTapCount;

    resultsYourTaps.textContent = t('results.yourTaps', { n: myTaps });

    resultsBadge.classList.remove('is-correct', 'is-wrong');

    let iWon = false;
    if (room.mode === 'race' || room.mode === 'infinite') {
        const winner = [...all].sort((a, b) => b.tap_count - a.tap_count)[0];
        iWon = winner && winner.id === currentPlayerId;
    } else {
        const teamA = all.filter((p) => p.team === 'A').reduce((s, p) => s + p.tap_count, 0);
        const teamB = all.filter((p) => p.team === 'B').reduce((s, p) => s + p.tap_count, 0);
        const winningTeam = teamA === teamB ? null : (teamA > teamB ? 'A' : 'B');
        iWon = winningTeam !== null && myTeam === winningTeam;
    }

    resultsBadge.textContent = iWon ? t('results.youWon') : t('results.youLost');
    resultsBadge.classList.add(iWon ? 'is-correct' : 'is-wrong');

    const sorted = [...all].sort((a, b) => b.tap_count - a.tap_count);
    resultsRankingList.innerHTML = sorted
        .map((p, i) => `
            <div class="leaderboard-row ${p.id === currentPlayerId ? 'is-selected' : ''}">
                <span class="leaderboard-row__rank">#${i + 1}</span>
                <span class="leaderboard-row__name">${p.nickname}${p.team ? ` (${p.team})` : ''}</span>
                <span class="leaderboard-row__score">${p.tap_count} ${t('results.tapsLabel')}</span>
            </div>
        `)
        .join('');
}
