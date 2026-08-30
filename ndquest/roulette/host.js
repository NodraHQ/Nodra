// ==================================================================
// ROULETTE - host.js
//
// Três formas de montar a lista de nomes:
//   1. "import"  - puxa quem já jogou Time Attack ou Show Down numa
//                  sala anterior (consulta direta nas tabelas desses
//                  jogos, mesmo projeto Supabase - não é import de
//                  arquivo, é leitura de dado em tempo de execução).
//   2. "qr"      - cria uma sala própria da Roleta, código/QR, quem
//                  entra só digita o nome.
//   3. "paste"   - cola uma lista pronta, um nome por linha.
//
// Depois de montada a lista, a tela muda pra roda. Cada giro sorteia
// um nome, soma na lista de ganhadores, e (se o host deixar marcado)
// remove esse nome da roda pro próximo giro.
// ==================================================================

import translations from './i18n/translations.js';
import themes from './branding/branding-manifest.js';

// --------------------------------------------------------
// Idioma
// --------------------------------------------------------

let currentLanguage = localStorage.getItem('roulette:language') || 'pt';

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
// escolheu destacar, ao lado do nome na lista de participantes.
// Cópia própria desta pasta (mesma lógica dos outros jogos).
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
        window.ndquestSupabase.from('profiles_public').select('id, featured_badge_ids').in('id', validIds),
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

// Nome clicável, indo pro perfil público de quem tem conta -
// reportado ao vivo: "quero clicar no nome no ranking/dentro da
// rodada e ir pro card de perfil, pro host conseguir ver e dar a
// recompensa". Sem username (jogador convidado, sem conta), mostra
// só o texto puro, sem link nenhum.
function buildPlayerNameLink(name, username) {
    const safeName = name.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    if (!username) return safeName;
    const profileUrl = `../../account/perfil.html?u=${encodeURIComponent(username)}`;
    return `<a href="${profileUrl}" target="_blank" rel="noopener" class="player-name-link">${safeName}</a>`;
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
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (translations[currentLanguage] && translations[currentLanguage][key] !== undefined) {
            el.placeholder = translations[currentLanguage][key];
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
    localStorage.setItem('roulette:language', lang);
    applyTranslations();
    setActiveLanguageButton();
    populateThemeSelect();
}

document.getElementById('lang-pt').addEventListener('click', () => changeLanguage('pt'));
document.getElementById('lang-en').addEventListener('click', () => changeLanguage('en'));
setActiveLanguageButton();

// --------------------------------------------------------
// Referências DOM
// --------------------------------------------------------

const screenConfig = document.getElementById('screen-config');
const screenWheel = document.getElementById('screen-wheel');

const hostNameInput = document.getElementById('host-name-input');
const themeSelect = document.getElementById('theme-select');
const logoImg = document.getElementById('logo-img');
const configError = document.getElementById('config-error');
const continueBtn = document.getElementById('continue-btn');

const methodTabs = document.querySelectorAll('.method-tab');
const methodPanelImport = document.getElementById('method-panel-import');
const methodPanelQr = document.getElementById('method-panel-qr');
const methodPanelPaste = document.getElementById('method-panel-paste');

const importGameSelect = document.getElementById('import-game-select');
const importRoomCodeInput = document.getElementById('import-room-code-input');
const importFetchBtn = document.getElementById('import-fetch-btn');
const importError = document.getElementById('import-error');
const importStatus = document.getElementById('import-status');

const qrBeforeCreate = document.getElementById('qr-before-create');
const qrAfterCreate = document.getElementById('qr-after-create');
const qrCreateBtn = document.getElementById('qr-create-btn');
const qrError = document.getElementById('qr-error');
const qrRoomCodeText = document.getElementById('qr-room-code-text');
const qrRoomQrImg = document.getElementById('qr-room-qr-img');
const qrEmpty = document.getElementById('qr-empty');
const qrPlayersList = document.getElementById('qr-players-list');

const pasteTextarea = document.getElementById('paste-textarea');
const pasteParseBtn = document.getElementById('paste-parse-btn');
const pasteStatus = document.getElementById('paste-status');

const winnerBanner = document.getElementById('winner-banner');
const winnerBannerName = document.getElementById('winner-banner-name');
const wheelStage = document.querySelector('.wheel-stage');
const wheelHub = document.querySelector('.wheel-hub');
const wheelSvg = document.getElementById('wheel-svg');
const spinBtn = document.getElementById('spin-btn');
const removeWinnerToggle = document.getElementById('remove-winner-toggle');
const winnersEmpty = document.getElementById('winners-empty');
const winnersList = document.getElementById('winners-list');
const copyWinnersBtn = document.getElementById('copy-winners-btn');
const spinAgainBtn = document.getElementById('spin-again-btn');
const changeNamesLink = document.getElementById('change-names-link');

function showScreen(el) {
    [screenConfig, screenWheel].forEach((s) => { s.hidden = true; });
    el.hidden = false;
}

// --------------------------------------------------------
// Tema de marca (white label) - mesmo sistema dos outros jogos.
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
// Abas de método
// --------------------------------------------------------

const methodPanels = {
    import: methodPanelImport,
    qr: methodPanelQr,
    paste: methodPanelPaste
};

methodTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
        const method = tab.dataset.method;
        methodTabs.forEach((tb) => tb.classList.toggle('is-active', tb === tab));
        Object.entries(methodPanels).forEach(([key, panel]) => {
            panel.hidden = key !== method;
        });
        activeMethod = method;
    });
});

let activeMethod = 'import';
let namesPool = [];
let nicknameToUserId = new Map();

// --------------------------------------------------------
// Método 1: importar de uma sala do Time Attack / Show Down
// --------------------------------------------------------

const IMPORT_TABLES = {
    'time-attack': { rooms: 'time_attack_rooms', players: 'time_attack_players' },
    'show-down': { rooms: 'showdown_rooms', players: 'showdown_players' },
    'tap-rush': { rooms: 'tap_rush_rooms', players: 'tap_rush_players' }
};

importFetchBtn.addEventListener('click', async () => {

    importError.textContent = '';
    importStatus.textContent = '';

    const game = importGameSelect.value;
    const roomCode = importRoomCodeInput.value.trim().toUpperCase();

    if (!roomCode) {
        importError.textContent = t('errors.roomCodeRequired');
        return;
    }

    const tables = IMPORT_TABLES[game];

    importFetchBtn.disabled = true;

    const { data: room, error: roomError } = await window.ndquestSupabase
        .from(tables.rooms)
        .select('id')
        .eq('room_code', roomCode)
        .maybeSingle();

    if (roomError || !room) {
        importFetchBtn.disabled = false;
        importError.textContent = t('errors.importRoomNotFound');
        return;
    }

    const { data: players, error: playersError } = await window.ndquestSupabase
        .from(tables.players)
        .select('nickname')
        .eq('room_id', room.id);

    importFetchBtn.disabled = false;

    if (playersError || !players || players.length === 0) {
        importError.textContent = t('errors.importNoPlayers');
        return;
    }

    namesPool = players.map((p) => p.nickname);
    importStatus.textContent = t('import.foundCount', { n: namesPool.length });
});

// --------------------------------------------------------
// Método 2: sala própria com QR/código
// --------------------------------------------------------

function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i += 1) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

let qrRoomId = null;
let qrRoomCode = null;
let qrRealtimeChannel = null;

qrCreateBtn.addEventListener('click', async () => {

    qrError.textContent = '';

    const hostName = hostNameInput.value.trim();
    if (!hostName) {
        qrError.textContent = t('errors.hostNameRequired');
        return;
    }

    const selectedTheme = themes[Number(themeSelect.value)];

    qrCreateBtn.disabled = true;

    const roomCode = generateRoomCode();
    const hostUserId = await getCurrentUserId();

    const { data, error } = await window.ndquestSupabase
        .from('roulette_rooms')
        .insert({
            room_code: roomCode,
            host_name: hostName,
            status: 'open',
            theme_name: selectedTheme.name,
            host_id: hostUserId
        })
        .select()
        .single();

    qrCreateBtn.disabled = false;

    if (error || !data) {
        qrError.textContent = t('errors.roomCreateFailed');
        console.error('Roulette create room error:', error);
        return;
    }

    if (hostUserId) {
        window.ndquestSupabase
            .from('match_history')
            .insert({
                user_id: hostUserId,
                role: 'host',
                game: 'roulette',
                room_code: roomCode
            })
            .then(({ error: historyError }) => {
                if (historyError) console.error('Roulette host history error:', historyError);
            });
    }

    qrRoomId = data.id;
    qrRoomCode = roomCode;

    qrBeforeCreate.hidden = true;
    qrAfterCreate.hidden = false;

    qrRoomCodeText.textContent = roomCode;
    const baseUrl = `${window.location.origin}${window.location.pathname.replace('index.html', '')}play/index.html`;
    const publicPlayUrl = `${baseUrl}?room=${roomCode}`;
    qrRoomQrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(publicPlayUrl)}`;
    qrRoomLinkText.textContent = publicPlayUrl;

    subscribeToQrPlayers(qrRoomId);
});

const qrRoomLinkText = document.getElementById('qr-room-link-text');
const qrCopyLinkBtn = document.getElementById('qr-copy-link-btn');
qrCopyLinkBtn?.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(qrRoomLinkText.textContent);
        const originalLabel = qrCopyLinkBtn.textContent;
        qrCopyLinkBtn.textContent = t('buttons.linkCopied');
        qrCopyLinkBtn.classList.add('is-copied');
        setTimeout(() => {
            qrCopyLinkBtn.textContent = originalLabel;
            qrCopyLinkBtn.classList.remove('is-copied');
        }, 1800);
    } catch (err) {
        console.error('Roulette: erro ao copiar o link', err);
    }
});

async function loadQrPlayers(roomId) {
    const { data, error } = await window.ndquestSupabase
        .from('roulette_players')
        .select('nickname, user_id')
        .eq('room_id', roomId);

    if (error) {
        console.error('Roulette load players error:', error);
        return [];
    }
    return data || [];
}

function renderQrPlayers(players) {
    namesPool = players.map((p) => p.nickname);

    // Guarda nome -> user_id - usado depois pra achar o badge de
    // quem ganhar (o pool da roda só tem os nomes, não o user_id de
    // cada um).
    nicknameToUserId = new Map(players.map((p) => [p.nickname, p.user_id]));

    if (players.length === 0) {
        qrEmpty.hidden = false;
        qrPlayersList.innerHTML = '';
        return;
    }
    qrEmpty.hidden = true;
    qrPlayersList.innerHTML = players.map((p) => `<span class="player-chip">${p.nickname}</span>`).join('');

    loadPlayerBadgeMap(players.map((p) => p.user_id)).then((badgeMap) => {
        qrPlayersList.innerHTML = players
            .map((p) => `<span class="player-chip">${p.nickname}${buildMiniBadgeRow(badgeMap.get(p.user_id))}</span>`)
            .join('');
    });
}

function subscribeToQrPlayers(roomId) {
    loadQrPlayers(roomId).then(renderQrPlayers);

    qrRealtimeChannel = window.ndquestSupabase
        .channel(`roulette-players-${roomId}`)
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'roulette_players', filter: `room_id=eq.${roomId}` },
            () => loadQrPlayers(roomId).then(renderQrPlayers)
        )
        .subscribe();
}

// --------------------------------------------------------
// Método 3: colar lista pronta
// --------------------------------------------------------

pasteParseBtn.addEventListener('click', () => {
    const names = pasteTextarea.value
        .split('\n')
        .map((n) => n.trim())
        .filter(Boolean);

    namesPool = names;
    pasteStatus.textContent = t('paste.foundCount', { n: names.length });
});

// --------------------------------------------------------
// Ir pra roda
// --------------------------------------------------------

continueBtn.addEventListener('click', () => {

    configError.textContent = '';

    const hostName = hostNameInput.value.trim();
    if (!hostName) {
        configError.textContent = t('errors.hostNameRequired');
        return;
    }

    if (namesPool.length < 2) {
        configError.textContent = t('errors.notEnoughNames');
        return;
    }

    const selectedTheme = themes[Number(themeSelect.value)];
    applyTheme(selectedTheme);

    if (qrRealtimeChannel) {
        window.ndquestSupabase.removeChannel(qrRealtimeChannel);
        qrRealtimeChannel = null;
    }

    originalPool = [...namesPool];
    currentPool = [...namesPool];
    winners = [];
    renderWinners();
    buildWheel(currentPool, true);
    syncPoolToRoom();
    showScreen(screenWheel);
});

// --------------------------------------------------------
// A roda: construção do SVG
// --------------------------------------------------------

let originalPool = [];
let currentPool = [];
let winners = [];
let currentRotationDeg = 0;
let isSpinning = false;

const WHEEL_CENTER = 150;
const WHEEL_RADIUS = 145;

function wheelPoint(angleDeg, radius) {
    const rad = (angleDeg * Math.PI) / 180;
    return {
        x: WHEEL_CENTER + radius * Math.sin(rad),
        y: WHEEL_CENTER - radius * Math.cos(rad)
    };
}

// Sincroniza a lista de nomes da roda pro banco - reportado ao vivo:
// o jogador nunca via a roleta girando, só "você está dentro". Só
// faz sentido pro modo "sala própria" (QR/código) - o modo
// "importar" sorteia nomes de outro jogo, não existe sala de roleta
// de verdade por trás pra sincronizar com ninguém.
async function syncPoolToRoom() {
    if (!qrRoomId) return;
    const { error } = await window.ndquestSupabase
        .from('roulette_rooms')
        .update({ current_pool: currentPool, spin_status: 'idle' })
        .eq('id', qrRoomId);
    if (error) {
        console.error('Roulette: erro ao sincronizar a roda pro banco (jogador não vai ver a roda atualizar)', error);
    }
}

function buildWheel(pool, resetRotation) {

    const svgNS = 'http://www.w3.org/2000/svg';

    wheelSvg.innerHTML = '';

    // Com 1 nome só, uma "fatia" de 360° é um caso degenerado pro
    // caminho de arco SVG (o ponto de início e fim é o mesmo ponto,
    // o que faz o arco desenhar quase nada). Desenha um círculo
    // cheio de verdade em vez disso, do mesmo tamanho da roda normal.
    if (pool.length === 1) {
        wheelHub.style.display = 'none';

        const circle = document.createElementNS(svgNS, 'circle');
        circle.setAttribute('cx', String(WHEEL_CENTER));
        circle.setAttribute('cy', String(WHEEL_CENTER));
        circle.setAttribute('r', String(WHEEL_RADIUS));
        circle.setAttribute('fill', 'var(--color-gold)');
        circle.setAttribute('stroke', 'var(--color-bg)');
        circle.setAttribute('stroke-width', '2');
        wheelSvg.appendChild(circle);

        const text = document.createElementNS(svgNS, 'text');
        text.setAttribute('x', String(WHEEL_CENTER));
        text.setAttribute('y', String(WHEEL_CENTER));
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        text.setAttribute('font-size', '16');
        const soleName = pool[0];
        text.textContent = soleName.length > 14 ? `${soleName.slice(0, 13)}…` : soleName;
        wheelSvg.appendChild(text);

        if (resetRotation) {
            wheelSvg.style.transition = 'none';
            currentRotationDeg = 0;
            wheelSvg.style.transform = 'rotate(0deg)';
            wheelSvg.classList.add('is-idle');
            void wheelSvg.offsetWidth;
            wheelSvg.style.transition = '';
        }
        return;
    }

    wheelHub.style.display = '';

    const sliceAngle = 360 / pool.length;

    const fontSize = Math.max(8, Math.min(14, 160 / pool.length + 6));

    pool.forEach((name, index) => {
        const startAngle = index * sliceAngle;
        const endAngle = (index + 1) * sliceAngle;
        const midAngle = (startAngle + endAngle) / 2;

        const p1 = wheelPoint(startAngle, WHEEL_RADIUS);
        const p2 = wheelPoint(endAngle, WHEEL_RADIUS);
        const largeArc = sliceAngle > 180 ? 1 : 0;

        const path = document.createElementNS(svgNS, 'path');
        path.setAttribute(
            'd',
            `M ${WHEEL_CENTER},${WHEEL_CENTER} L ${p1.x},${p1.y} A ${WHEEL_RADIUS},${WHEEL_RADIUS} 0 ${largeArc},1 ${p2.x},${p2.y} Z`
        );
        path.setAttribute('fill', index % 2 === 0 ? 'var(--color-gold)' : 'var(--color-gold-light)');
        path.setAttribute('stroke', 'var(--color-bg)');
        path.setAttribute('stroke-width', '2');
        wheelSvg.appendChild(path);

        const textPoint = wheelPoint(midAngle, WHEEL_RADIUS * 0.66);
        const text = document.createElementNS(svgNS, 'text');
        text.setAttribute('x', String(textPoint.x));
        text.setAttribute('y', String(textPoint.y));
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        text.setAttribute('font-size', String(fontSize));
        text.setAttribute('transform', `rotate(${midAngle}, ${textPoint.x}, ${textPoint.y})`);
        const label = name.length > 12 ? `${name.slice(0, 11)}…` : name;
        text.textContent = label;
        wheelSvg.appendChild(text);
    });

    if (resetRotation) {
        wheelSvg.style.transition = 'none';
        currentRotationDeg = 0;
        wheelSvg.style.transform = 'rotate(0deg)';
        wheelSvg.classList.add('is-idle');
        // força reflow antes de permitir transições de novo
        void wheelSvg.offsetWidth;
        wheelSvg.style.transition = '';
    }
}

// --------------------------------------------------------
// Girar
// --------------------------------------------------------

spinBtn.addEventListener('click', () => {

    if (isSpinning || currentPool.length === 0) return;

    isSpinning = true;
    spinBtn.disabled = true;
    spinBtn.textContent = t('wheel.spinning');
    winnerBanner.hidden = true;

    wheelSvg.classList.remove('is-idle');

    const sliceAngle = 360 / currentPool.length;
    const winnerIndex = Math.floor(Math.random() * currentPool.length);
    const winnerName = currentPool[winnerIndex];
    const winnerMidAngle = (winnerIndex + 0.5) * sliceAngle;
    const jitter = (Math.random() - 0.5) * sliceAngle * 0.6;

    const targetMod = ((360 - winnerMidAngle + jitter) % 360 + 360) % 360;
    const currentMod = ((currentRotationDeg % 360) + 360) % 360;
    let delta = targetMod - currentMod;
    if (delta <= 0) delta += 360;

    const extraSpins = 6 * 360;
    currentRotationDeg += extraSpins + delta;

    // Sincroniza pro banco - reportado ao vivo: jogador nunca via a
    // roleta girando. Não precisa sincronizar o ângulo exato (cada
    // tela calcula a própria animação a partir do próprio zero) - só
    // precisa saber QUEM ganhou e QUANDO começou, pra cada jogador
    // montar a própria animação de giro chegando no mesmo resultado.
    if (qrRoomId) {
        window.ndquestSupabase
            .from('roulette_rooms')
            .update({
                spin_status: 'spinning',
                spin_started_at: new Date().toISOString(),
                current_winner_index: winnerIndex,
                current_winner_name: winnerName,
            })
            .eq('id', qrRoomId)
            .then(({ error }) => {
                if (error) console.error('Roulette: erro ao sincronizar início do giro pro banco', error);
            });
    }

    // Remover a classe "is-idle" e já mandar a transição no mesmo
    // instante às vezes faz o navegador não perceber a virada de
    // estado (a transição simplesmente não dispara, sem erro
    // nenhum). Forçar um reflow e esperar o próximo frame garante
    // que o "ponto de partida" (parado, sem a animação de idle)
    // seja de fato renderizado antes de pedir a transição.
    wheelSvg.style.transition = 'none';
    void wheelSvg.offsetWidth;

    requestAnimationFrame(() => {
        wheelSvg.style.transition = 'transform 4.5s cubic-bezier(.12,.72,.14,1)';
        wheelSvg.style.transform = `rotate(${currentRotationDeg}deg)`;

        wheelSvg.addEventListener('transitionend', function onEnd() {
            wheelSvg.removeEventListener('transitionend', onEnd);
            onSpinComplete(winnerIndex, winnerName);
        }, { once: true });
    });
});

async function onSpinComplete(winnerIndex, winnerName) {

    isSpinning = false;
    spinBtn.disabled = false;
    spinBtn.textContent = t('wheel.spinBtn');

    const winnerUserId = nicknameToUserId.get(winnerName) || null;
    let winnerUsername = null;
    if (winnerUserId) {
        const { data: profileData } = await window.ndquestSupabase
            .from('profiles_public')
            .select('username')
            .eq('id', winnerUserId)
            .maybeSingle();
        winnerUsername = profileData?.username || null;
    }

    winners.push({ name: winnerName, userId: winnerUserId, username: winnerUsername });
    await renderWinners();

    winnerBannerName.innerHTML = buildPlayerNameLink(winnerName, winnerUsername);
    winnerBanner.hidden = false;

    if (qrRoomId) {
        window.ndquestSupabase
            .from('roulette_rooms')
            .update({ spin_status: 'finished' })
            .eq('id', qrRoomId)
            .then(({ error }) => {
                if (error) console.error('Roulette: erro ao sincronizar fim do giro pro banco', error);
            });
    }

    // Grava o resultado de verdade - antes o sorteio só vivia na
    // tela do host, o histórico do jogador registrava só que ele
    // entrou, nunca quem ganhou. Só faz sentido pro modo "sala
    // própria" (QR/código) - o modo "importar" sorteia nomes de OUTRO
    // jogo, não existe sala de roleta de verdade por trás pra gravar.
    if (qrRoomId && qrRoomCode) {
        recordWinnerInHistory(qrRoomId, qrRoomCode, winnerName, winners.length);
    }

    if (removeWinnerToggle.checked) {
        currentPool.splice(winnerIndex, 1);
        if (currentPool.length === 0) {
            spinBtn.disabled = true;
            spinBtn.textContent = t('wheel.everyoneWon');
        } else {
            buildWheel(currentPool, true);
            syncPoolToRoom();
        }
    }
}

// Encontra a linha real do vencedor (via roulette_players, que tem o
// user_id confiável) e marca o resultado no lugar certo - logado vai
// pro match_history (via política nova, host só mexe em roleta que
// ele mesmo hospedou), anônimo vai pro guest_participants. placement
// é a ordem em que a pessoa foi sorteada, não uma posição de "1º
// lugar" única - múltiplos sorteios na mesma sala geram várias
// posições (1, 2, 3...).
async function recordWinnerInHistory(roomId, roomCode, winnerName, placement) {

    const { data: winnerPlayerRow, error: playerLookupError } = await window.ndquestSupabase
        .from('roulette_players')
        .select('user_id, nickname')
        .eq('room_id', roomId)
        .eq('nickname', winnerName)
        .maybeSingle();

    if (playerLookupError || !winnerPlayerRow) {
        console.error('Roulette: não achou a linha do vencedor pra gravar o resultado', playerLookupError);
        return;
    }

    if (winnerPlayerRow.user_id) {
        const { error } = await window.ndquestSupabase
            .from('match_history')
            .update({ placement })
            .eq('user_id', winnerPlayerRow.user_id)
            .eq('game', 'roulette')
            .eq('room_code', roomCode)
            .eq('role', 'player');

        if (error) console.error('Roulette: erro ao gravar vencedor logado no histórico', error);
    } else {
        const { error } = await window.ndquestSupabase
            .from('guest_participants')
            .update({ placement })
            .eq('nickname', winnerPlayerRow.nickname)
            .eq('game', 'roulette')
            .eq('room_code', roomCode);

        if (error) console.error('Roulette: erro ao gravar vencedor guest no histórico', error);
    }

}

// --------------------------------------------------------
// Lista de ganhadores
// --------------------------------------------------------

async function renderWinners() {
    if (winners.length === 0) {
        winnersEmpty.hidden = false;
        winnersList.innerHTML = '';
        return;
    }
    winnersEmpty.hidden = true;

    const allWinnerIds = winners.map((w) => w.userId).filter(Boolean);
    const badgeMap = await loadPlayerBadgeMap(allWinnerIds);

    winnersList.innerHTML = winners
        .map((w, i) => `
            <div class="winner-row">
                <span class="winner-row__position">#${i + 1}</span>
                <span class="winner-row__name-block">
                    <span class="winner-row__name">${buildPlayerNameLink(w.name, w.username)}</span>
                    ${buildMiniBadgeRow(w.userId ? badgeMap.get(w.userId) : null)}
                </span>
            </div>
        `)
        .join('');
}

copyWinnersBtn.addEventListener('click', async () => {
    const text = winners.map((w, i) => `${i + 1}. ${w.name}`).join('\n');
    try {
        await navigator.clipboard.writeText(text);
        const original = copyWinnersBtn.textContent;
        copyWinnersBtn.textContent = t('wheel.copied');
        setTimeout(() => { copyWinnersBtn.textContent = original; }, 1800);
    } catch (err) {
        console.error('Roulette copy winners error:', err);
    }
});

// --------------------------------------------------------
// Sortear de novo (mesmos nomes) / trocar a lista de nomes
// --------------------------------------------------------

let previousRounds = [];
let roundCounter = 1;

function renderPreviousRounds() {
    const card = document.getElementById('previous-rounds-card');
    const list = document.getElementById('previous-rounds-list');
    if (!card || !list) return;

    if (previousRounds.length === 0) {
        card.hidden = true;
        return;
    }

    card.hidden = false;
    list.innerHTML = '';

    // Mais recente primeiro - mesmo padrão do Time Attack.
    [...previousRounds].reverse().forEach((round) => {
        const block = document.createElement('div');
        block.className = 'previous-round-block';

        const title = document.createElement('p');
        title.className = 'previous-round-title';
        title.textContent = `${t('wheel.roundLabel')} ${round.roundNumber}`;
        block.appendChild(title);

        round.results.forEach((winner) => {
            const row = document.createElement('div');
            row.className = 'previous-round-row';
            row.innerHTML = buildPlayerNameLink(winner.name, winner.username);
            block.appendChild(row);
        });

        list.appendChild(block);
    });
}

spinAgainBtn.addEventListener('click', () => {
    // Arquiva a rodada que está fechando, em vez de só apagar -
    // reportado ao vivo: "quero esse esquema de rodada 1, rodada 2
    // que tem no Time Attack, aqui também".
    if (winners.length > 0) {
        previousRounds.push({ roundNumber: roundCounter, results: [...winners] });
        roundCounter += 1;
        renderPreviousRounds();
    }

    currentPool = [...originalPool];
    winners = [];
    winnerBanner.hidden = true;
    renderWinners();
    buildWheel(currentPool, true);
    syncPoolToRoom();
    spinBtn.disabled = false;
    spinBtn.textContent = t('wheel.spinBtn');
});

changeNamesLink.addEventListener('click', (event) => {
    event.preventDefault();

    namesPool = [];
    currentPool = [];
    originalPool = [];
    winners = [];
    previousRounds = [];
    roundCounter = 1;
    qrRoomId = null;
    qrRoomCode = null;

    if (qrRealtimeChannel) {
        window.ndquestSupabase.removeChannel(qrRealtimeChannel);
        qrRealtimeChannel = null;
    }

    qrBeforeCreate.hidden = false;
    qrAfterCreate.hidden = true;
    document.getElementById('previous-rounds-card').hidden = true;
    importStatus.textContent = '';
    pasteStatus.textContent = '';
    pasteTextarea.value = '';
    importRoomCodeInput.value = '';

    showScreen(screenConfig);
});
