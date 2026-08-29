// ==================================================================
// TAP RUSH - host.js
//
// Dois modos, mesma sala:
//   "race"     - cada jogador toca por si, primeiro a bater a meta
//                de toques vence (com um tempo máximo de segurança
//                caso ninguém bata a meta).
//   "tugofwar" - dividido em Time A / Time B (por ordem de entrada,
//                automático), dura um tempo fixo, time com mais
//                toques no total vence.
//
// Os toques não vão um por um pro banco - cada celular acumula
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

// --------------------------------------------------------
// Badges do jogador - mini-card evoluído do "quadrinho simples só
// com nome", pedido ao vivo: até 3 badges pequenos que a pessoa
// escolheu destacar. Cópia própria desta pasta (mesma lógica dos
// outros jogos), MAS com cache - a pista de corrida (race-lane)
// atualiza a cada toque, muito rápido pra buscar badge de novo toda
// vez (desperdiça rede e pode travar a animação). Badge não muda no
// meio de uma partida, então cachear por user_id é seguro.
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

const playerBadgeCache = new Map(); // user_id -> array de badges (ou [])

async function loadPlayerBadgeMap(userIds) {
    const validIds = [...new Set(userIds.filter(Boolean))];
    const uncached = validIds.filter((id) => !playerBadgeCache.has(id));

    if (uncached.length > 0) {
        const [{ data: profiles }, { data: userBadgeRows }] = await Promise.all([
            window.ndquestSupabase.from('profiles').select('id, featured_badge_ids').in('id', uncached),
            window.ndquestSupabase
                .from('user_badges')
                .select('user_id, badge_id, badges(background_color, icon, icon_color, image_url)')
                .in('user_id', uncached),
        ]);

        const featuredById = new Map((profiles || []).map((p) => [p.id, new Set(p.featured_badge_ids || [])]));
        uncached.forEach((id) => playerBadgeCache.set(id, [])); // garante entrada mesmo pra quem não tem badge nenhum

        (userBadgeRows || []).forEach((row) => {
            const featuredSet = featuredById.get(row.user_id);
            const isFeatured = featuredSet && featuredSet.size > 0 ? featuredSet.has(row.badge_id) : true;
            if (!isFeatured) return;

            const list = playerBadgeCache.get(row.user_id) || [];
            if (list.length >= 3) return;
            list.push(row.badges);
            playerBadgeCache.set(row.user_id, list);
        });
    }

    const map = new Map();
    validIds.forEach((id) => map.set(id, playerBadgeCache.get(id) || []));
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

// Leitura síncrona do cache - pra usar dentro do loop de renderização
// da pista de corrida (que roda a cada toque, não pode esperar rede).
// Devolve [] se ainda não tiver sido aquecido pra essa pessoa - o
// badge simplesmente aparece um instante depois, quando o cache
// aquecer, sem travar a corrida em si.
function getBadgesFromCacheSync(userId) {
    if (!userId) return [];
    return playerBadgeCache.get(userId) || [];
}

// --------------------------------------------------------
// Identidade - se a pessoa estiver logada, host_id fica registrado
// junto da sala (ver docs/MATCH_HISTORY_ARCHITECTURE.md). Deslogado,
// fica null - hosteia normal, só não entra no histórico.
// --------------------------------------------------------

// Bug real confirmado ao vivo: antes isso guardava o resultado em
// cache pra sempre depois da primeira checagem - numa aba que fica
// aberta por horas, ou depois de trocar de conta sem recarregar a
// página, esse valor guardado ficava desatualizado, e o servidor
// rejeitava porque o host_id/user_id enviado não batia mais com quem
// a pessoa realmente é agora. getSession() é uma leitura local e
// barata do Supabase (não faz chamada de rede), então nunca precisou
// desse cache - checa fresco toda vez.
async function getCurrentUserId() {
    const { data: { session } } = await window.ndquestSupabase.auth.getSession();
    return session?.user?.id ?? null;
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

    const hostUserId = await getCurrentUserId();
    roomPayload.host_id = hostUserId;

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

    if (hostUserId) {
        window.ndquestSupabase
            .from('match_history')
            .insert({
                user_id: hostUserId,
                role: 'host',
                game: 'tap_rush',
                room_code: data.room_code
            })
            .then(({ error: historyError }) => {
                if (historyError) console.error('Tap Rush host history error:', historyError);
            });
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
        .select('id, user_id, nickname, team, tap_count, last_seen_at')
        .eq('room_id', roomId)
        .order('joined_at', { ascending: true });

    if (error) {
        console.error('Tap Rush load players error:', error);
        return [];
    }
    return data || [];
}

const STALE_THRESHOLD_MS = 30000;

function isPlayerStale(player) {
    if (!player.last_seen_at) return true;
    return (Date.now() - new Date(player.last_seen_at).getTime()) > STALE_THRESHOLD_MS;
}

let latestPlayers = [];

function renderWaitingPlayers(players) {
    latestPlayers = players;

    const activePlayers = players.filter((p) => !isPlayerStale(p));

    if (activePlayers.length === 0) {
        waitingEmpty.hidden = false;
        waitingPlayersList.innerHTML = '';
        return;
    }
    waitingEmpty.hidden = true;
    waitingPlayersList.innerHTML = activePlayers
        .map((p) => {
            const teamTag = p.team ? ` (${p.team})` : '';
            return `<span class="player-chip">${p.nickname}${teamTag}</span>`;
        })
        .join('');

    loadPlayerBadgeMap(activePlayers.map((p) => p.user_id)).then((badgeMap) => {
        waitingPlayersList.innerHTML = activePlayers
            .map((p) => {
                const teamTag = p.team ? ` (${p.team})` : '';
                return `<span class="player-chip">${p.nickname}${teamTag}${buildMiniBadgeRow(badgeMap.get(p.user_id))}</span>`;
            })
            .join('');
    });
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
                // disparava uma busca completa da tabela inteira - com
                // 3-4 pessoas tocando rápido isso empilhava pedidos e
                // travava a tela por um tempo.
                if (payload.eventType === 'INSERT') {
                    latestPlayers = [...latestPlayers, payload.new];
                } else if (payload.eventType === 'UPDATE') {
                    // Mescla em vez de substituir - bug real já
                    // confirmado ao vivo em outro jogo: o pacote de
                    // UPDATE às vezes só traz os campos que mudaram,
                    // não a linha inteira. Substituir por completo
                    // apagaria nickname/team/tap_count sempre que só
                    // last_seen_at mudasse (o sinal de vida do
                    // jogador, a cada 10s).
                    latestPlayers = latestPlayers.map((p) => (p.id === payload.new.id ? { ...p, ...payload.new } : p));
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

    // 3 segundos de contagem regressiva a partir de agora - host e
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
        // meta nenhuma - a barra de cada um escala em relação a quem
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
                        <div class="race-lane__label">
                            <span class="race-lane__name-block"><span>${p.nickname}</span>${buildMiniBadgeRow(getBadgesFromCacheSync(p.user_id))}</span>
                            <span>${p.tap_count}</span>
                        </div>
                        <div class="race-lane__finish"></div>
                    </div>
                `;
            })
            .join('');

        // Aquece o cache em segundo plano - a corrida em si nunca
        // espera essa chamada, o badge só aparece assim que estiver
        // pronto, na próxima atualização (que já vai acontecer sozinha
        // no próximo toque de qualquer jogador).
        loadPlayerBadgeMap(players.map((p) => p.user_id));
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
    // os próprios números - se dois jogadores ficassem com cliques
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

async function renderResults(players, winnerPlayerId, winnerTeam) {

    showScreen(screenResults);

    resultsRoomCodeValue.textContent = activeRoomCode;

    if (roundConfig.mode === 'race' || roundConfig.mode === 'infinite') {
        const sorted = [...players].sort((a, b) => b.tap_count - a.tap_count);
        const winner = winnerPlayerId
            ? players.find((p) => p.id === winnerPlayerId)
            : sorted[0];

        resultsWinnerName.textContent = winner ? `${t('results.winnerLabel')} ${winner.nickname}` : '';

        lastRankingForCopy = sorted.map((p) => `${p.nickname} - ${p.tap_count}`);

        const badgeMap = await loadPlayerBadgeMap(sorted.map((p) => p.user_id));

        resultsRankingList.innerHTML = sorted
            .map((p, i) => `
                <div class="leaderboard-row">
                    <span class="leaderboard-row__rank">#${i + 1}</span>
                    <span class="leaderboard-row__name-block">
                        <span class="leaderboard-row__name">${p.nickname}</span>
                        ${buildMiniBadgeRow(badgeMap.get(p.user_id))}
                    </span>
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

        lastRankingForCopy = sorted.map((p) => `${p.nickname} (${p.team}) - ${p.tap_count}`);

        const badgeMap = await loadPlayerBadgeMap(sorted.map((p) => p.user_id));

        resultsRankingList.innerHTML = sorted
            .map((p, i) => `
                <div class="leaderboard-row">
                    <span class="leaderboard-row__rank">#${i + 1}</span>
                    <span class="leaderboard-row__name-block">
                        <span class="leaderboard-row__name">${p.nickname} (${p.team})</span>
                        ${buildMiniBadgeRow(badgeMap.get(p.user_id))}
                    </span>
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
