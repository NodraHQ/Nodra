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
import { getStaticThemes, loadRemoteThemes } from './branding/branding-manifest.js';

const FREE_MONTHLY_ROOM_LIMIT = 10;

// Mesma checagem de inatividade usada em play.js - precisa existir
// aqui também porque host.js é um arquivo separado, sem escopo
// compartilhado (self-contained, mesmo padrão dos 4 jogos).
const ROOM_INACTIVITY_TIMEOUT_MINUTES = 30;
function isRoomStale(updatedAt) {
    if (!updatedAt) return false;
    const cutoff = Date.now() - ROOM_INACTIVITY_TIMEOUT_MINUTES * 60 * 1000;
    return new Date(updatedAt).getTime() < cutoff;
}

// Começa só com o tema padrão (mesma aparência de sempre, na hora),
// depois é substituído pela lista completa (padrão + Supabase) assim
// que a busca terminar - ver a chamada de loadRemoteThemes logo
// abaixo de populateThemeSelect().
let themes = getStaticThemes();

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

// Mesmo padrão do Show Down/Time Attack - chama Edge Function com o
// token de quem estiver logado, ou a chave anônima se ninguém estiver
// (jogar sem login é um caminho válido).
// Bug real reportado ao vivo: se a Edge Function não estiver
// deployada (ou a URL vier undefined por algum motivo), o servidor
// devolve uma página de erro HTML, não JSON - response.json() explode
// sem avisar direito, e quem chamou nunca fica sabendo que falhou.
// Sempre devolve { error } em vez de deixar a exceção subir crua.
async function callGameFunction(name, payload) {
    try {
        const { data: { session } } = await window.ndquestSupabase.auth.getSession();
        const token = session?.access_token || window.ndquestSupabaseAnonKey;

        const response = await fetch(`${window.ndquestSupabaseUrl}/functions/v1/${name}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const text = await response.text().catch(() => '');
            console.error(`Tap Rush: ${name} devolveu ${response.status}`, text.slice(0, 200));
            return { error: `Erro ${response.status} ao chamar ${name}` };
        }

        return await response.json();
    } catch (err) {
        console.error(`Tap Rush: erro de rede chamando ${name}`, err);
        return { error: 'Erro de rede' };
    }
}

// Cache por user_id, com validade de 60s (não pra sempre) -
// reportado ao vivo: um cache sem validade mostrava dado velho se a
// pessoa mudasse a curadoria dos próprios badges no meio da partida
// depois que essa tela já tinha guardado os badges antigos.
const playerBadgeCache = new Map(); // user_id -> { badges: [...], cachedAt: number }
const BADGE_CACHE_TTL_MS = 60 * 1000;

async function loadPlayerBadgeMap(userIds) {
    const validIds = [...new Set(userIds.filter(Boolean))];
    const now = Date.now();
    const uncached = validIds.filter((id) => {
        const cached = playerBadgeCache.get(id);
        return !cached || now - cached.cachedAt > BADGE_CACHE_TTL_MS;
    });

    if (uncached.length > 0) {
        const [{ data: profiles }, { data: userBadgeRows }] = await Promise.all([
            window.ndquestSupabase.from('profiles_public').select('id, featured_badge_ids').in('id', uncached),
            window.ndquestSupabase
                .from('user_badges')
                .select('user_id, badge_id, badges(name_pt, background_color, icon, icon_color, image_url, badge_shape)')
                .in('user_id', uncached),
        ]);

        const featuredById = new Map((profiles || []).map((p) => [p.id, new Set(p.featured_badge_ids || [])]));
        uncached.forEach((id) => playerBadgeCache.set(id, { badges: [], cachedAt: now }));

        (userBadgeRows || []).forEach((row) => {
            const featuredSet = featuredById.get(row.user_id);
            const isFeatured = featuredSet && featuredSet.has(row.badge_id);
            if (!isFeatured) return;

            const entry = playerBadgeCache.get(row.user_id) || { badges: [], cachedAt: now };
            if (entry.badges.length >= 3) return;
            entry.badges.push(row.badges);
            playerBadgeCache.set(row.user_id, entry);
        });
    }

    const map = new Map();
    validIds.forEach((id) => map.set(id, playerBadgeCache.get(id)?.badges || []));
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
const closeOldRoomsBtn = document.getElementById('close-old-rooms-btn');
let pendingBlockingRooms = [];

closeOldRoomsBtn.addEventListener('click', async () => {
    closeOldRoomsBtn.disabled = true;
    await Promise.all(
        pendingBlockingRooms.map(({ table, id }) =>
            window.ndquestSupabase.from(table).update({ status: 'closed' }).eq('id', id),
        ),
    );
    pendingBlockingRooms = [];
    closeOldRoomsBtn.hidden = true;
    closeOldRoomsBtn.disabled = false;
    configError.textContent = t('errors.oldRoomsClosedRetry');
});
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
    // Preserva a seleção atual, se a pessoa já tiver escolhido algo -
    // repopular a lista (depois que os temas do Supabase chegam) não
    // deveria voltar pro padrão sem avisar.
    const previouslySelectedName = themes[Number(themeSelect.value)]?.name;

    themeSelect.innerHTML = '';
    themes.forEach((theme, index) => {
        const option = document.createElement('option');
        option.value = String(index);
        option.textContent = theme.name;
        themeSelect.appendChild(option);
    });

    if (previouslySelectedName) {
        const matchIndex = themes.findIndex((t) => t.name === previouslySelectedName);
        if (matchIndex >= 0) themeSelect.value = String(matchIndex);
    }
}

populateThemeSelect();

// Busca temas do Supabase (públicos + os do próprio host logado) por
// cima do padrão - não bloqueia nada, o jogo já está usável com só o
// padrão enquanto isso carrega.
loadRemoteThemes(window.ndquestSupabase).then((allThemes) => {
    themes = allThemes;
    populateThemeSelect();
});

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

// Mesma corrida real confirmada no Show Down: recriar um canal com o
// MESMO nome do anterior (mesma sala, rodada nova) não espera o
// removeChannel() terminar de verdade antes de assinar de novo - o
// SDK às vezes ainda "lembra" do nome antigo e a nova inscrição não
// pega, sem erro nenhum aparecendo. Sufixo crescente em cada nome de
// canal evita a colisão de raiz.
let realtimeChannelCounter = 0;

createRoomBtn.addEventListener('click', async () => {

    configError.textContent = '';

    // Bug real reportado ao vivo: criar uma sala nova sem recarregar
    // a página deixava o card "Rodadas Anteriores" com o resquício
    // da sala testada antes - o array só é limpo aqui, na criação,
    // nunca sozinho.
    previousRounds = [];
    renderPreviousRounds();

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

    const hostUserId = await getCurrentUserId();

    // 1 partida ativa por conta ao mesmo tempo, em QUALQUER um dos 4
    // jogos - reportado ao vivo: "impediria o compartilhamento de
    // contas vips".
    if (hostUserId) {
        const roomTables = ['showdown_rooms', 'time_attack_rooms', 'roulette_rooms', 'tap_rush_rooms'];
        const checks = await Promise.all(
            roomTables.map((table) =>
                window.ndquestSupabase
                    .from(table)
                    .select('id, updated_at')
                    .eq('host_id', hostUserId)
                    .not('status', 'eq', 'closed')
                    .then(({ data }) => ({ table, rows: data || [] })),
            ),
        );

        // Sala "ativa" só de status, sem checar se ainda está viva
        // de verdade, é o bug real reportado ao vivo: aviso de
        // partida ativa numa sala de ontem que ninguém nunca tentou
        // entrar de novo (o mecanismo de inatividade só rodava na
        // hora de ENTRAR numa sala específica). Agora fecha de
        // verdade no banco qualquer sala parada há mais de 30
        // minutos encontrada aqui, em vez de só ignorar.
        const stillActive = [];
        for (const { table, rows } of checks) {
            for (const row of rows) {
                if (isRoomStale(row.updated_at)) {
                    await window.ndquestSupabase.from(table).update({ status: 'closed' }).eq('id', row.id);
                } else {
                    stillActive.push({ table, id: row.id });
                }
            }
        }

        if (stillActive.length > 0) {
            // Reportado ao vivo: "preciso que ao sair da sala, todos
            // os botões encerrem a sala, ou ali no erro tenha um
            // atalho de encerrar" - rede de segurança que não
            // depende de detectar saída nenhuma.
            configError.textContent = t('errors.activeRoomExists');
            pendingBlockingRooms = stillActive;
            closeOldRoomsBtn.hidden = false;
            return;
        }
    }

    if (hostUserId) {
        const { data: hostProfile } = await window.ndquestSupabase
            .from('profiles')
            .select('is_vip')
            .eq('id', hostUserId)
            .maybeSingle();

        if (!hostProfile?.is_vip) {
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
            const { count: roomsThisMonth } = await window.ndquestSupabase
                .from('match_history')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', hostUserId)
                .eq('role', 'host')
                .gte('created_at', thirtyDaysAgo);

            if ((roomsThisMonth || 0) >= FREE_MONTHLY_ROOM_LIMIT) {
                configError.textContent = t('errors.monthlyRoomLimitReached');
                return;
            }
        }
    }

    createRoomBtn.disabled = true;

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

// Mesmo padrão do Show Down/Time Attack: qualquer mudança busca a
// lista inteira de novo, sem acumular estado em memória por conta
// própria. O Tap Rush tinha uma versão "otimizada" (mesclava direto
// da notificação, sem rebuscar) pra aguentar toque rápido sem
// sobrecarregar - mas essa mesma esperteza é a fonte mais provável
// do bug real reportado ao vivo: sala 1 certa, sala 2 só o guest
// aparecia, sala 3 sumiu todo mundo - degradando a cada rodada nova,
// clássico de estado acumulado em memória que nunca fica
// perfeitamente sincronizado com o banco entre uma rodada e outra.
// Correto importa mais que rápido aqui - o batching por
// requestAnimationFrame (scheduleRenderFromLatestPlayers) continua
// evitando redesenhar o DOM a cada notificação, só a BUSCA que
// deixou de ser esperta.
function subscribeToPlayers(roomId) {

    function refreshPlayers() {
        loadPlayers(roomId).then((players) => {
            latestPlayers = players;
            scheduleRenderFromLatestPlayers();
        });
    }

    refreshPlayers();

    if (playersRealtimeChannel) {
        window.ndquestSupabase.removeChannel(playersRealtimeChannel);
    }

    playersRealtimeChannel = window.ndquestSupabase
        .channel(`tap-rush-players-${roomId}-${++realtimeChannelCounter}`)
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'tap_rush_players', filter: `room_id=eq.${roomId}` },
            refreshPlayers
        )
        .subscribe();

    // Rede de segurança: se o Realtime não estiver ativado na tabela,
    // isso garante que a lista e a pista/corda sempre acabam
    // atualizando, só um pouco mais devagar (a cada 1.5s).
    if (playersPollInterval) clearInterval(playersPollInterval);
    playersPollInterval = setInterval(refreshPlayers, 1500);
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
                            <span>${p.nickname}</span>
                            <span>${p.tap_count}</span>
                        </div>
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

// Guarda o resultado da última rodada renderizada, pra arquivar em
// previousRounds quando o host clicar "Jogar de Novo" - captura aqui
// (quando o resultado já está fechado) em vez de reconsultar o banco
// depois, porque playAgainBtn já reseta tap_count antes de qualquer
// outra coisa poder ler esse número de novo.
let lastRoundResult = null;

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
        lastRoundResult = { mode: roundConfig.mode, sorted };

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
        // winnerTeam já vem calculado e gravado por endRound (fonte
        // única, ver comentário lá) - não recalcula aqui.
        resultsWinnerName.textContent = winnerTeam
            ? `${t('results.teamWinnerLabel')} ${t(winnerTeam === 'A' ? 'active.teamA' : 'active.teamB')}`
            : '🤝';

        const sorted = [...players].sort((a, b) => b.tap_count - a.tap_count);

        lastRankingForCopy = sorted.map((p) => `${p.nickname} (${p.team}) - ${p.tap_count}`);
        lastRoundResult = { mode: roundConfig.mode, sorted, winnerTeam };

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
// Rodadas anteriores - mesmo padrão visual do Time Attack, Roulette
// e Show Down (card "Rodada 1 / Rodada 2", mais recente primeiro).
// Só pra tela ao vivo do host nesta sessão - o histórico de verdade
// já fica gravado em match_history/guest_participants por rodada
// (ver play.js).
// --------------------------------------------------------

let previousRounds = [];

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

    [...previousRounds].reverse().forEach((round) => {

        const block = document.createElement('div');
        block.className = 'previous-round-block';

        const title = document.createElement('p');
        title.className = 'previous-round-title';
        title.textContent = `${t('results.roundLabel')} ${round.roundNumber}`;
        block.appendChild(title);

        round.result.sorted.forEach((player) => {
            const row = document.createElement('div');
            row.className = 'previous-round-row';
            const nameSuffix = round.result.mode === 'tugofwar' ? ` (${player.team})` : '';
            row.innerHTML = `<span>${player.nickname}${nameSuffix}</span><span>${player.tap_count}</span>`;
            block.appendChild(row);
        });

        list.appendChild(block);

    });

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

    // Trava contra duplo clique - bug real reportado ao vivo: sem
    // desabilitar o botão, dois cliques rápidos disparavam duas
    // execuções em paralelo, cada uma lendo o mesmo round_number
    // antigo e arquivando a MESMA rodada duas vezes no card (mesmo
    // placar duplicado). A leitura de round_number continua "segura"
    // contra outra pessoa mexendo na sala ao mesmo tempo - o risco
    // real era o próprio host clicando duas vezes, que isso aqui
    // fecha.
    if (playAgainBtn.disabled) return;
    playAgainBtn.disabled = true;

    // Arquiva o resultado da rodada que está fechando, e sobe
    // round_number na sala - é isso que play.js lê pra saber qual
    // rodada gravar no histórico de cada jogador (ver
    // docs/MATCH_HISTORY_ARCHITECTURE.md e o mesmo padrão já usado
    // no Time Attack e no Show Down).
    const { data: currentRoomData, error: fetchRoundError } = await window.ndquestSupabase
        .from('tap_rush_rooms')
        .select('round_number')
        .eq('id', activeRoomId)
        .maybeSingle();

    if (fetchRoundError) console.error('Tap Rush: erro ao buscar round_number atual', fetchRoundError);

    const roundBeingClosed = currentRoomData?.round_number || 1;
    const nextRound = roundBeingClosed + 1;

    // Zera tap_count via Edge Function com chave de serviço, não
    // direto daqui - mesmo motivo do Show Down (ver
    // showdown-reset-round): chamada direta do navegador do host
    // depende dele ter permissão de RLS pra mexer em linhas que não
    // são dele, e se não tiver, falha calada, contaminando o
    // ranking da rodada nova com pontos da anterior. Roda ANTES de
    // arquivar a rodada - bug real reportado ao vivo: arquivar
    // primeiro e resetar depois deixava uma "rodada fantasma" no
    // card sempre que o reset falhava (a rodada nunca de fato
    // avançava, mas ficava registrada como se tivesse).
    const resetResult = await callGameFunction('tap-rush-reset-round', { room_id: activeRoomId });
    if (resetResult.error) {
        console.error('Tap Rush play again error (reset):', resetResult.error);
        playAgainBtn.disabled = false;
        return;
    }

    if (lastRoundResult) {
        previousRounds.push({ roundNumber: roundBeingClosed, result: lastRoundResult });
        renderPreviousRounds();
    }

    const { data, error } = await window.ndquestSupabase
        .from('tap_rush_rooms')
        .update({ status: 'waiting', round_started_at: null, round_number: nextRound })
        .eq('id', activeRoomId)
        .select()
        .single();

    playAgainBtn.disabled = false;

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

// Fecha a sala sozinho se o host sair de qualquer jeito - ver
// explicação completa no Show Down (mesmo mecanismo, reportado ao
// vivo).
let cachedAccessToken = null;
window.ndquestSupabase.auth.getSession().then(({ data }) => {
    cachedAccessToken = data?.session?.access_token || null;
});
window.ndquestSupabase.auth.onAuthStateChange((_event, session) => {
    cachedAccessToken = session?.access_token || null;
});

window.addEventListener('pagehide', () => {
    if (!activeRoomId || !cachedAccessToken) return;
    fetch(`${window.ndquestSupabaseUrl}/rest/v1/tap_rush_rooms?id=eq.${activeRoomId}`, {
        method: 'PATCH',
        keepalive: true,
        headers: {
            'Content-Type': 'application/json',
            'apikey': window.ndquestSupabaseAnonKey,
            'Authorization': `Bearer ${cachedAccessToken}`,
        },
        body: JSON.stringify({ status: 'closed' }),
    });
});
