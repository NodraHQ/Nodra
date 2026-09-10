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

// Mesmo padrão do Show Down/Time Attack/Tap Rush - chama Edge
// Function com o token de quem estiver logado, ou a chave anônima se
// ninguém estiver. Nunca deixa uma exceção subir crua (bug real
// reportado ao vivo no Tap Rush: se a resposta não for JSON válido,
// response.json() explode sem avisar direito).
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
            console.error(`Roulette: ${name} devolveu ${response.status}`, text.slice(0, 200));
            return { error: `Erro ${response.status} ao chamar ${name}` };
        }

        return await response.json();
    } catch (err) {
        console.error(`Roulette: erro de rede chamando ${name}`, err);
        return { error: 'Erro de rede' };
    }
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
    qrError.textContent = t('errors.oldRoomsClosedRetry');
});
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
let namesPoolUserIds = new Map();
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
        .select('nickname, user_id')
        .eq('room_id', room.id);

    importFetchBtn.disabled = false;

    if (playersError || !players || players.length === 0) {
        importError.textContent = t('errors.importNoPlayers');
        return;
    }

    namesPool = players.map((p) => p.nickname);

    // Guarda o user_id de quem foi importado, pra não aparecer como
    // "convidado" no histórico da roleta sendo que era conta de
    // verdade no jogo original - reportado ao vivo: "isso é meio
    // estético, mas não sei se é o ideal aparecer assim". Só faz
    // sentido pra importar (a origem tem essa informação); colar
    // lista continua sempre convidado, porque nome digitado à mão
    // não tem como confirmar identidade nenhuma.
    namesPoolUserIds = new Map(players.map((p) => [p.nickname, p.user_id || null]));

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

// Fecha a sala sozinho se o host sair de qualquer jeito - ver
// explicação completa no Show Down (mesmo mecanismo, reportado ao
// vivo). Roleta não tinha nem um botão de fechar antes disso - esse
// é o único jeito da sala QR ao vivo encerrar de propósito hoje,
// fora o timer de inatividade.
let cachedAccessToken = null;
window.ndquestSupabase.auth.getSession().then(({ data }) => {
    cachedAccessToken = data?.session?.access_token || null;
});
window.ndquestSupabase.auth.onAuthStateChange((_event, session) => {
    cachedAccessToken = session?.access_token || null;
});

window.addEventListener('pagehide', () => {
    if (!qrRoomId || !cachedAccessToken) return;
    fetch(`${window.ndquestSupabaseUrl}/rest/v1/roulette_rooms?id=eq.${qrRoomId}`, {
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
let qrRoomHostId = null;
let qrRealtimeChannel = null;

qrCreateBtn.addEventListener('click', async () => {

    qrError.textContent = '';

    const hostName = hostNameInput.value.trim();
    if (!hostName) {
        qrError.textContent = t('errors.hostNameRequired');
        return;
    }

    const selectedTheme = themes[Number(themeSelect.value)];

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
            qrError.textContent = t('errors.activeRoomExists');
            pendingBlockingRooms = stillActive;
            closeOldRoomsBtn.hidden = false;
            return;
        }
    }

    // Limite mensal de sala pro Free (10/mês) - só o modo QR ao vivo
    // conta pra isso (colar lista/puxar sala nunca abrem uma sala de
    // verdade, não pesam em nada).
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
                qrError.textContent = t('errors.monthlyRoomLimitReached');
                return;
            }
        }
    }

    qrCreateBtn.disabled = true;

    const roomCode = generateRoomCode();

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
    qrRoomHostId = data.host_id;

    qrBeforeCreate.hidden = true;
    qrAfterCreate.hidden = false;

    qrRoomCodeText.textContent = roomCode;
    const baseUrl = `${window.location.origin}${window.location.pathname.replace('index.html', '')}play/index.html`;
    const publicPlayUrl = `${baseUrl}?room=${roomCode}`;
    qrRoomQrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(publicPlayUrl)}`;
    qrRoomLinkText.textContent = publicPlayUrl;

    subscribeToQrPlayers(qrRoomId);
    subscribeToPresence(qrRoomId);
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

let onlineNicknames = new Set();

function subscribeToPresence(roomId) {
    // Mesmo NOME de canal que o jogador usa em play.js
    // (roulette-room-updates-ROOMID) - Presence é por canal, então
    // precisa ser exatamente o mesmo nome dos dois lados pra
    // enxergar a mesma lista de quem está de verdade conectado.
    // Reportado ao vivo: "tem como saber se a pessoa tá acompanhando
    // ou se fechou a tela?".
    const presenceChannel = window.ndquestSupabase
        .channel(`roulette-room-updates-${roomId}`)
        .on('presence', { event: 'sync' }, () => {
            const state = presenceChannel.presenceState();
            onlineNicknames = new Set(Object.values(state).flat().map((p) => p.nickname));
            renderQrPlayers(namesPool.map((nickname) => ({ nickname, user_id: nicknameToUserId.get(nickname) })));
        })
        .subscribe();
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
    qrPlayersList.innerHTML = players.map((p) => {
        const isOnline = onlineNicknames.has(p.nickname);
        const dot = isOnline ? '<span class="player-chip-dot is-online" title="Acompanhando agora"></span>' : '';
        return `<span class="player-chip">${dot}${p.nickname}</span>`;
    }).join('');

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
    namesPoolUserIds = new Map(); // texto digitado à mão, sem identidade nenhuma pra preservar
    pasteStatus.textContent = t('paste.foundCount', { n: names.length });
});

// --------------------------------------------------------
// Ir pra roda
// --------------------------------------------------------

continueBtn.addEventListener('click', async () => {

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

    // Cria uma sala de verdade por trás mesmo pro modo colar lista e
    // importar - bug real reportado ao vivo: "quando usei a opção de
    // puxar o nome dos players... essa roleta não salvou no
    // histórico, nem a que cola lista, só a que entra por QR". A
    // gravação de vencedor (recordWinnerInHistory) exige uma sala e
    // jogadores de verdade no banco pra achar quem ganhou - sem sala
    // nenhuma criada aqui antes, não tinha em cima do que gravar.
    // Isso NÃO reintroduz o custo de conexão que motivou esses 2
    // modos serem "leves" - criar linha no banco é só uma escrita,
    // o gasto de conexão em tempo real só acontece quando alguém
    // conecta ao vivo via QR pra acompanhar, o que nenhum dos 2
    // modos jamais faz.
    if (!qrRoomId) {
        const roomCode = generateRoomCode();
        const hostUserId = await getCurrentUserId();

        const { data, error } = await window.ndquestSupabase
            .from('roulette_rooms')
            .insert({
                room_code: roomCode,
                host_name: hostName,
                status: 'open',
                theme_name: selectedTheme.name,
                host_id: hostUserId,
            })
            .select()
            .single();

        if (error || !data) {
            configError.textContent = t('errors.roomCreateFailed');
            console.error('Roulette create room error (colar/importar):', error);
            return;
        }

        qrRoomId = data.id;
        qrRoomCode = roomCode;

        const { error: playersError } = await window.ndquestSupabase
            .from('roulette_players')
            .insert(namesPool.map((nickname) => ({ room_id: qrRoomId, nickname })));

        if (playersError) {
            console.error('Roulette: erro ao registrar jogadores (colar/importar)', playersError);
        }

        if (hostUserId) {
            window.ndquestSupabase
                .from('match_history')
                .insert({
                    user_id: hostUserId,
                    role: 'host',
                    game: 'roulette',
                    room_code: roomCode,
                })
                .then(({ error: historyError }) => {
                    if (historyError) console.error('Roulette host history error (colar/importar):', historyError);
                });
        }
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
        recordWinnerInHistory(qrRoomId, qrRoomCode, winnerName, winners.length, roundCounter);
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

// Grava o resultado via Edge Function com chave de serviço, não
// direto daqui - bug real reportado ao vivo: quem faz a chamada
// direta é a sessão do HOST, não do vencedor, e a política de
// segurança do match_history só deixa gravar uma linha sobre você
// mesmo. Host gravando em nome de outra conta era bloqueado, calado
// (a pessoa via o resultado certinho na tela ao vivo, mas o histórico
// dela nunca recebia). Ver docs em roulette-record-winner. placement
// é a ordem em que a pessoa foi sorteada NAQUELA rodada, não uma
// posição de "1º lugar" única - múltiplos sorteios na mesma rodada
// geram várias posições (1, 2, 3...).
async function recordWinnerInHistory(roomId, roomCode, winnerName, placement, roundNumber) {
    const result = await callGameFunction('roulette-record-winner', {
        room_id: roomId,
        room_code: roomCode,
        winner_name: winnerName,
        placement,
        round_number: roundNumber,
    });

    if (result.error) {
        console.error('Roulette: erro ao gravar vencedor no histórico', result.error);
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

spinAgainBtn.addEventListener('click', async () => {
    // Arquiva a rodada que está fechando, em vez de só apagar -
    // reportado ao vivo: "quero esse esquema de rodada 1, rodada 2
    // que tem no Time Attack, aqui também". round_number sobe junto
    // na sala (mesmo padrão do Time Attack e do Show Down) - é o que
    // faz cada vitória gravada em recordWinnerInHistory saber de qual
    // rodada ela é.
    if (winners.length > 0) {
        previousRounds.push({ roundNumber: roundCounter, results: [...winners] });
        roundCounter += 1;
        renderPreviousRounds();

        if (qrRoomId) {
            const { error: roundUpdateError } = await window.ndquestSupabase
                .from('roulette_rooms')
                .update({ round_number: roundCounter })
                .eq('id', qrRoomId);

            if (roundUpdateError) console.error('Roulette: erro ao atualizar round_number da sala', roundUpdateError);
        }
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
    qrRoomHostId = null;

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
