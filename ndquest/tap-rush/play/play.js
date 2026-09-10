// ==================================================================
// TAP RUSH - play/play.js
//
// O jogador só toca. O total de toques não é mandado um por um pro
// banco (ia sobrecarregar rápido com gente tocando várias vezes por
// segundo) - acumula um contador local e manda o total atualizado
// pro Supabase a cada ~150ms, só se tiver mudado.
// ==================================================================

import translations from '../i18n/translations.js';
import themes from '../branding/branding-manifest.js';

// Sala sem nenhuma atualização por mais de 30 minutos é considerada
// abandonada - reportado ao vivo, mesma ideia repetida nos 4 jogos
// (self-contained, sem importar de arquivo comum entre eles).
const ROOM_INACTIVITY_TIMEOUT_MINUTES = 30;
function isRoomStale(updatedAt) {
    if (!updatedAt) return false;
    const cutoff = Date.now() - ROOM_INACTIVITY_TIMEOUT_MINUTES * 60 * 1000;
    return new Date(updatedAt).getTime() < cutoff;
}

const ROOM_PLAYER_CAPS = { bronze: 100, prata: 250, gold: 1000 };
const FREE_ROOM_PLAYER_CAP = 30;

async function getRoomPlayerCap(hostId) {
    if (!hostId) return FREE_ROOM_PLAYER_CAP;
    const { data: hostProfile } = await window.ndquestSupabase
        .from('profiles')
        .select('is_vip, vip_tier')
        .eq('id', hostId)
        .maybeSingle();
    if (!hostProfile?.is_vip) return FREE_ROOM_PLAYER_CAP;
    return ROOM_PLAYER_CAPS[hostProfile.vip_tier] || FREE_ROOM_PLAYER_CAP;
}

const PLATFORM_AGGREGATE_BLOCK_THRESHOLD = 420;

async function isPlatformNearCapacity() {
    const { data, error } = await window.ndquestSupabase.rpc('count_active_platform_players');
    if (error) {
        console.error('Erro ao conferir agregado da plataforma:', error);
        return false;
    }
    return (data || 0) >= PLATFORM_AGGREGATE_BLOCK_THRESHOLD;
}

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
// escolheu destacar, no ranking. Cópia própria desta pasta (mesma
// lógica dos outros jogos).
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
    zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
    sparkles: '<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>',
    heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.5 4.04 3 5.5l7 7Z"/>',
    "book-open": '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
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
            .select('user_id, badge_id, badges(name_pt, background_color, icon, icon_color, image_url, badge_shape)')
            .in('user_id', validIds),
    ]);

    const featuredById = new Map((profiles || []).map((p) => [p.id, new Set(p.featured_badge_ids || [])]));
    const map = new Map();

    (userBadgeRows || []).forEach((row) => {
        const featuredSet = featuredById.get(row.user_id);
        const isFeatured = featuredSet && featuredSet.has(row.badge_id);
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
            // Respeita a forma de verdade da badge (hex, coin, square...)
            // em vez de sempre forçar círculo - bug real reportado ao
            // vivo: "não pode cortar, qual o sentido disso?" - uma arte
            // desenhada pro formato hexagonal (pontas, número no topo)
            // ficava com as pontas cortadas quando o mini-badge sempre
            // recortava em círculo, não importa a forma escolhida na
            // criação. Mesmas classes/recortes que a badge em tamanho
            // grande já usa (ver account.css .badge--*), só que na
            // escala pequena - ver .mini-badge--* no CSS deste jogo.
            // Imagem própria já vem com forma e fundo desenhados nela
            // mesma - sem recorte extra, sem cor de fundo por trás
            // (mesma correção aplicada na badge em tamanho grande, ver
            // account.css .badge--image - senão sobra um "anel" da cor
            // de fundo em volta da arte, onde o recorte daqui não bate
            // pixel a pixel com o hexágono já desenhado na imagem).
            const shapeClass = b.image_url ? 'mini-badge--image' : `mini-badge--${b.badge_shape || 'circle'}`;

            if (b.image_url) {
                return `<span class="mini-badge ${shapeClass}"><img src="${b.image_url}" alt=""></span>`;
            }
            const color = b.icon_color || b.background_color || '#888';
            // Badge sem ícone e sem imagem é uma opção válida na hora de
            // criar (só forma+cor) - sem isso, ficava um círculo vazio
            // (reportado ao vivo: "só aparece um quadradinho azul"). Cai
            // pra inicial do nome, mesmo espírito de um avatar sem foto.
            // Checa o SVG de verdade, não só se b.icon existe - segunda
            // rodada do mesmo bug reportada ao vivo: um ícone com valor
            // que não bate com nenhuma chave conhecida (fora dos 8 que
            // o sistema reconhece) também gera SVG vazio, e só olhar
            // "b.icon existe" não pegava esse caso.
            const iconSvg = b.icon ? buildMiniIconSvg(b.icon) : '';
            // Cor do texto fixa em branco, não herdada de b.icon_color -
            // bug real reportado ao vivo: badge sem ícone também não tem
            // icon_color (não faz sentido ter cor de ícone sem ícone), e
            // "color" acima cai pro MESMO background_color do fundo -
            // letra invisível, escondida na própria cor do círculo.
            const fallback = iconSvg || `<span class="mini-badge__initial" style="color:#fff;">${(b.name_pt || '?').charAt(0).toUpperCase()}</span>`;
            return `<span class="mini-badge ${shapeClass}" style="background:${b.background_color || '#333'};color:${color};">${fallback}</span>`;
        })
        .join('');
    return `<div class="mini-badge-row">${chips}</div>`;
}

// --------------------------------------------------------
// Identidade - se a pessoa estiver logada, user_id fica registrado
// junto do jogador (ver docs/MATCH_HISTORY_ARCHITECTURE.md).
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
async function getCurrentUserId() {
    const { data: { session } } = await window.ndquestSupabase.auth.getSession();
    if (session?.user?.id) return session.user.id;

    // Sem sessão nenhuma - entra anônimo em vez de ficar sem
    // identidade. Fecha um furo real: RLS precisava de "user_id IS
    // NULL OR user_id = auth.uid()" pra deixar convidado jogar sem
    // login, e isso na prática deixava QUALQUER visitante mexer na
    // linha de QUALQUER convidado, não só a própria (user_id nulo
    // "casa" com todo mundo, não só com quem entrou de verdade).
    // Com sessão anônima, até quem não logou ganha um auth.uid()
    // de verdade, único daquele navegador - a mesma trava "só o
    // dono mexe" que já protege conta normal passa a proteger
    // convidado também, sem pedir email nem senha de ninguém.
    const { data, error } = await window.ndquestSupabase.auth.signInAnonymously();
    if (error) {
        console.error('Erro ao entrar anonimamente:', error);
        return null;
    }
    return data?.user?.id ?? null;
}

// Diferente de getCurrentUserId (que agora SEMPRE retorna um id,
// mesmo pra convidado, de propósito - ver comentário acima) - essa
// função aqui existe só pra decisão de "esse resultado vai pro
// histórico público ou fica privado com o host". Bug real reportado
// ao vivo: "no histórico, o usuário guest aparece só uma '?'" -
// depois da sessão anônima, getCurrentUserId nunca mais retorna
// null pra convidado, então o código que decidia "tem id = vai pro
// match_history" passou a mandar convidado pro lugar errado (sem
// username de verdade pra mostrar, vira "?"). is_anonymous é um
// campo que o próprio Supabase expõe especificamente pra separar
// "tem sessão" de "é uma conta de verdade, com nome".
async function isAnonymousSession() {
    const { data: { session } } = await window.ndquestSupabase.auth.getSession();
    return session?.user?.is_anonymous ?? true;
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
// Tema de marca - lido da sala, só aplicado.
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

    // try/finally garante que o botão só reabilita no fim de tudo -
    // mesmo bug de corrida corrigido no Show Down: antes reabilitava
    // logo depois da busca da sala, com a criação da linha do
    // jogador ainda rodando por baixo, abrindo brecha pra clique
    // duplo criar duas linhas pra mesma conta.
    try {

        const { data, error } = await window.ndquestSupabase
            .from('tap_rush_rooms')
            .select('*')
            .eq('room_code', roomCode)
            .maybeSingle();

        if (error || !data) {
            joinError.textContent = t('errors.roomNotFound');
            return;
        }

        if (data.status === 'closed') {
            joinError.textContent = t('errors.roomClosed');
            return;
        }

        if (isRoomStale(data.updated_at)) {
            await window.ndquestSupabase.from('tap_rush_rooms').update({ status: 'closed' }).eq('id', data.id);
            joinError.textContent = t('errors.roomClosed');
            return;
        }

        currentRoom = data;

        const joinUserId = await getCurrentUserId();

        // Se a pessoa está logada e já tem uma linha nessa sala, reaproveita
        // em vez de duplicar (mesma correção do Time Attack) - inclusive o
        // time já sorteado antes, não recalcula.
        let playerRow = null;
        let playerError = null;
        let team = null;

        if (joinUserId) {
            const { data: existing } = await window.ndquestSupabase
                .from('tap_rush_players')
                .select('*')
                .eq('room_id', data.id)
                .eq('user_id', joinUserId)
                .maybeSingle();

            if (existing) {
                playerRow = existing;
                myTeam = existing.team;
                team = existing.team;
            }
        }

        if (!playerRow) {

            // Limite de jogador por sala, de acordo com o tier do
            // host - só entra aqui pra quem é REALMENTE novo na sala.
            const roomCap = await getRoomPlayerCap(data.host_id);
            const { count: currentPlayerCount } = await window.ndquestSupabase
                .from('tap_rush_players')
                .select('id', { count: 'exact', head: true })
                .eq('room_id', data.id);
            if ((currentPlayerCount || 0) >= roomCap) {
                joinError.textContent = t('errors.roomFull');
                return;
            }
            if (await isPlatformNearCapacity()) {
                joinError.textContent = t('errors.platformAtCapacity');
                return;
            }

            // Impede nome repetido dentro da mesma sala - vale pra
            // logado e pra quem entra sem login. Não bloqueia a própria
            // pessoa reconectando (checa pelo user_id, quando existe).
            const { data: existingWithName } = await window.ndquestSupabase
                .from('tap_rush_players')
                .select('id, user_id')
                .eq('room_id', data.id)
                .ilike('nickname', nickname);

            const nameTaken = (existingWithName || []).some((p) => {
                if (!joinUserId) return true;
                return !!p.user_id && p.user_id !== joinUserId;
            });

            let finalNameTaken = nameTaken;

            // Guest também não pode usar um nome que já é username de
            // alguma conta real, mesmo que essa conta nunca tenha entrado
            // nesta sala - prioridade é de quem tem conta, sempre.
            if (!finalNameTaken && !joinUserId) {
                const { data: isRegisteredUsername } = await window.ndquestSupabase
                    .rpc('username_is_taken', { check_username: nickname });
                if (isRegisteredUsername) finalNameTaken = true;
            }

            if (finalNameTaken) {
                joinError.textContent = t('errors.nicknameTaken');
                return;
            }

            let teamCandidate = null;
            if (data.mode === 'tugofwar') {
                const { data: existingPlayers } = await window.ndquestSupabase
                    .from('tap_rush_players')
                    .select('id')
                    .eq('room_id', data.id);
                const count = existingPlayers ? existingPlayers.length : 0;
                teamCandidate = count % 2 === 0 ? 'A' : 'B';
                myTeam = teamCandidate;
            }
            team = teamCandidate;

            const result = await window.ndquestSupabase
                .from('tap_rush_players')
                .insert({ room_id: data.id, nickname, team, tap_count: 0, user_id: joinUserId })
                .select()
                .single();
            playerRow = result.data;
            playerError = result.error;
        }

        if (playerError || !playerRow) {
            joinError.textContent = t('errors.joinFailed');
            console.error('Tap Rush join room error:', playerError);
            return;
        }

        currentPlayerId = playerRow.id;
        startHeartbeat();

        const roomTheme = themes.find((th) => th.name === currentRoom.theme_name) || themes[0];
        applyTheme(roomTheme);

        if (team) {
            teamBadgeWrap.hidden = false;
            teamBadge.textContent = `${t('active.' + (team === 'A' ? 'teamA' : 'teamB'))}`;
            teamBadge.className = `team-badge team-badge--${team.toLowerCase()}`;
        }

        subscribeToRoom(currentRoom.id);
        reactToRoomState(currentRoom);

    } finally {
        joinRoomBtn.disabled = false;
    }

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

    startRoomPoll(roomId);
}

// Rede de segurança: se o Realtime não estiver ativado na tabela
// (passo manual no painel do Supabase, fácil de esquecer), o jogador
// ficaria preso pra sempre esperando. Essa checagem por fora garante
// que o jogo sempre avança, só um pouco mais devagar (a cada 2s) do
// que o Realtime de verdade. Função própria (em vez de só inline em
// subscribeToRoom) porque precisa ser chamada de novo quando a sala
// volta pra 'waiting' numa rodada nova - ver reactToRoomState.
function startRoomPoll(roomId) {
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
let heartbeatInterval = null;

// Sinal de vida - mesmo problema já visto no Time Attack e no Show
// Down: sem isso, uma sessão abandonada (fecha a aba no meio do
// jogo) fica pra sempre marcada como ativa na tela do host.
function startHeartbeat() {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(() => {
        if (!currentPlayerId) return;
        window.ndquestSupabase
            .from('tap_rush_players')
            .update({ last_seen_at: new Date().toISOString() })
            .eq('id', currentPlayerId)
            .then(({ error }) => {
                if (error) console.error('Tap Rush: erro no sinal de vida', error);
            });
    }, 10000);
}
let lastHandledStatus = null;

function reactToRoomState(room) {

    if (room.status === 'waiting') {
        stopTapLoop();
        // Bug real reportado ao vivo (versão 2 desse mesmo problema):
        // reactToRoomState('waiting') dispara MAIS de uma vez seguida
        // (o próprio poll de segurança de 2s chama de novo, e o
        // Realtime também pode reprocessar). Antes, cada disparo
        // chamava startHeartbeat()/startRoomPoll() incondicionalmente,
        // matando e recriando o intervalo do sinal de vida (10s) toda
        // vez - como o poll reseta ele a cada ~2s, o sinal de vida
        // NUNCA sobrevivia tempo suficiente pra bater uma vez sequer
        // enquanto a sala ficava esperando. Só religa se não tiver um
        // já rodando, em vez de sempre matar e recriar.
        if (!heartbeatInterval) startHeartbeat();
        if (!roomPollInterval) startRoomPoll(room.id);
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
        if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; }
        if (roomPollInterval) { clearInterval(roomPollInterval); roomPollInterval = null; }
        lastHandledStatus = 'finished';
        renderResults(room);
        return;
    }

    if (room.status === 'closed') {
        stopTapLoop();
        if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; }
        if (roomPollInterval) { clearInterval(roomPollInterval); roomPollInterval = null; }
        joinError.textContent = t('errors.roomClosed');
        showScreen(screenJoin);
        // Só fecha a conexão aqui, nunca no 'finished' - o Tap Rush
        // tem "jogar de novo" que reseta status de volta pra 'waiting'
        // depois de 'finished'. Fechar cedo demais quebraria isso.
        if (roomRealtimeChannel) {
            window.ndquestSupabase.removeChannel(roomRealtimeChannel);
            roomRealtimeChannel = null;
        }
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

    const { error } = await window.ndquestSupabase
        .from('tap_rush_players')
        .update({ tap_count: toSync })
        .eq('id', currentPlayerId);

    if (error) {
        // Não avança lastSyncedCount aqui de propósito - se a
        // sincronização falhou (ex: o gatilho de taxa no banco
        // rejeitou por parecer rápido demais, mesmo que raro com uma
        // pessoa jogando rápido de verdade), a próxima tentativa
        // precisa tentar de novo com o valor real, não achar que já
        // está tudo em dia. Sem isso, o placar gravado ficaria pra
        // trás do que a pessoa realmente fez, pra sempre.
        console.error('Tap Rush sync tap count error:', error);
        return;
    }

    lastSyncedCount = toSync;
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
        .select('id, user_id, nickname, team, tap_count')
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
        // Lê o vencedor gravado pelo host (room.winner_team), em vez de
        // recalcular a soma dos times aqui - mesma razão do host já ter
        // parado de deixar cada jogador decidir sozinho quem venceu a
        // corrida (ver comentário em host.js/endRound): se dois clientes
        // lessem tap_count em instantes levemente diferentes, cada tela
        // podia "decidir" um time vencedor diferente. Agora só existe
        // uma resposta certa, gravada uma vez, e todo mundo lê ela.
        iWon = room.winner_team !== null && myTeam === room.winner_team;
    }

    resultsBadge.textContent = iWon ? t('results.youWon') : t('results.youLost');
    resultsBadge.classList.add(iWon ? 'is-correct' : 'is-wrong');

    const sorted = [...all].sort((a, b) => b.tap_count - a.tap_count);
    const badgeMap = await loadPlayerBadgeMap(sorted.map((p) => p.user_id));
    resultsRankingList.innerHTML = sorted
        .map((p, i) => `
            <div class="leaderboard-row ${p.id === currentPlayerId ? 'is-selected' : ''}">
                <span class="leaderboard-row__rank">#${i + 1}</span>
                <span class="leaderboard-row__name-block">
                    <span class="leaderboard-row__name">${p.nickname}${p.team ? ` (${p.team})` : ''}</span>
                    ${buildMiniBadgeRow(badgeMap.get(p.user_id))}
                </span>
                <span class="leaderboard-row__score">${p.tap_count} ${t('results.tapsLabel')}</span>
            </div>
        `)
        .join('');

    // Histórico de partida - só grava se a pessoa estiver logada (ver
    // docs/MATCH_HISTORY_ARCHITECTURE.md). A trava lastHandledStatus
    // (acima, em reactToRoomState) já garante que renderResults só
    // roda uma vez por partida, então não precisa de trava extra aqui.
    const historyUserId = await getCurrentUserId();
    const myRow = sorted.find((p) => p.id === currentPlayerId);

    // No cabo de guerra, placement reflete o TIME, não o toque
    // individual - 1 pra quem estava no time vencedor, 2 pra quem
    // estava no time perdedor, independente de quantos toques cada
    // um deu dentro do próprio time. Empate (winner_team null) não
    // tem vencedor, então não grava posição nenhuma. Corrida e
    // Clique Infinito continuam com o ranking individual por toques,
    // sem mudança.
    const myPlacement = room.mode === 'tugofwar'
        ? (room.winner_team === null ? null : (myTeam === room.winner_team ? 1 : 2))
        : (sorted.findIndex((p) => p.id === currentPlayerId) + 1 || null);

    if (historyUserId && !(await isAnonymousSession())) {
        const { error: historyError } = await window.ndquestSupabase
            .from('match_history')
            .insert({
                user_id: historyUserId,
                role: 'player',
                game: 'tap_rush',
                room_code: currentRoom.room_code,
                round_number: currentRoom.round_number || 1,
                placement: myPlacement,
                details: { tap_count: myTaps, mode: room.mode, won: iWon }
            });

        if (historyError) {
            console.error('Tap Rush match history error:', historyError);
        }
    } else if (room.host_id) {
        const { error: guestError } = await window.ndquestSupabase
            .from('guest_participants')
            .insert({
                host_id: room.host_id,
                game: 'tap_rush',
                room_code: currentRoom.room_code,
                round_number: currentRoom.round_number || 1,
                nickname: myRow ? myRow.nickname : '',
                placement: myPlacement,
                details: { tap_count: myTaps, mode: room.mode, won: iWon }
            });

        if (guestError) {
            console.error('Tap Rush guest participant error:', guestError);
        }
    }
}
