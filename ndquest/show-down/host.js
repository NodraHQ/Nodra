// ==================================================================
// SHOW DOWN - host.js
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

import translations from './i18n/translations.js';
import { getStaticThemes, loadRemoteThemes } from './branding/branding-manifest.js';

// Começa só com o tema padrão (mesma aparência de sempre, na hora),
// depois é substituído pela lista completa (padrão + Supabase) assim
// que a busca terminar - ver a chamada de loadRemoteThemes logo
// abaixo de populateThemeSelect().
let themes = getStaticThemes();

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

// --------------------------------------------------------
// Badges do jogador - mini-card evoluído do "quadrinho simples só
// com nome", pedido ao vivo: até 3 badges pequenos que a pessoa
// escolheu destacar, ao lado do nome, na sala de espera e no
// ranking. Cópia própria desta pasta (mesma lógica dos outros jogos).
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
            .select('user_id, badge_id, badges(name_pt, background_color, icon, icon_color, image_url, badge_shape)')
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
// Popular pacotes de perguntas - vem do banco agora (tabela
// question_packs), não mais de um arquivo local. Ver
// docs/BADGE_INTEGRITY_ARCHITECTURE.md (Mecanismo B). Mesmo pacotes
// que o Time Attack usa (applicable_games inclui os dois jogos),
// evita conteúdo duplicado.
// --------------------------------------------------------

let availablePacks = [];

async function populatePackSelect() {
    const previousValue = packSelect.value;

    const { data, error } = await window.ndquestSupabase
        .from('question_packs')
        .select('slug, name_pt, name_en')
        .eq('tier', 'official')
        .contains('applicable_games', ['show_down'])
        .order('name_pt');

    if (error) {
        console.error('Show Down: erro ao carregar pacotes', error);
        availablePacks = [];
    } else {
        availablePacks = data || [];
    }

    packSelect.innerHTML = '';

    availablePacks.forEach((pack) => {
        const option = document.createElement('option');
        option.value = pack.slug;
        option.textContent = currentLanguage === 'en' ? pack.name_en : pack.name_pt;
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
// Tema de marca (white label) - mesmo sistema do Quest Drop,
// cópia própria do branding/, arquivo independente. O tema
// escolhido é aplicado aqui na tela do host e também salvo na
// sala, pra o jogador (em outro aparelho) aplicar o mesmo tema
// assim que entrar.
// --------------------------------------------------------

function populateThemeSelect() {
    // Preserva a seleção atual, se a pessoa já tiver escolhido algo -
    // repopular a lista (depois que os temas do Supabase chegam) não
    // deveria voltar pro padrão sem avisar, no raro caso de alguém
    // escolher rápido o suficiente pra isso importar.
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
// Minhas Próprias Perguntas - mesmo formato do Quest Drop /
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

// Bug real reportado ao vivo (no Tap Rush, mesmo padrão aqui): se a
// Edge Function não estiver deployada, o servidor devolve uma página
// de erro HTML, não JSON - response.json() explode sem avisar
// direito. Sempre devolve { error } em vez de deixar a exceção subir
// crua.
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
            console.error(`Show Down: ${name} devolveu ${response.status}`, text.slice(0, 200));
            return { error: `Erro ${response.status} ao chamar ${name}` };
        }

        return await response.json();
    } catch (err) {
        console.error(`Show Down: erro de rede chamando ${name}`, err);
        return { error: 'Erro de rede' };
    }
}

async function buildQuestionsForPack(packSlug, numQuestionsWanted) {

    if (packSlug === 'custom') {
        if (customQuestions.length === 0) {
            return { questionIds: null, customQuestions: null, errorKey: 'errors.customQuestionsRequired' };
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
        return { questionIds: null, customQuestions: questions, errorKey: null };
    }

    // Pacote oficial - as perguntas em si (com a resposta certa)
    // nunca chegam neste arquivo. Só pede à Edge Function pra
    // sortear N IDs do pacote; o conteúdo é buscado depois, pergunta
    // por pergunta, também via Edge Function. Ver
    // docs/BADGE_INTEGRITY_ARCHITECTURE.md (Mecanismo B).
    const result = await callGameFunction('showdown-pick-questions', {
        pack_slug: packSlug,
        count: numQuestionsWanted,
    });

    if (result.error || !Array.isArray(result.question_ids)) {
        return { questionIds: null, customQuestions: null, errorKey: 'errors.notEnoughQuestions' };
    }

    return { questionIds: result.question_ids, customQuestions: null, errorKey: null };

}

// --------------------------------------------------------
// Criar sala
// --------------------------------------------------------

let activeRoomId = null;
let selectedQuestions = [];
let selectedQuestionIds = [];
let numQuestionsTotal = 0;
let questionSecondsValue = 30;
let currentQuestionIndex = -1;
let questionTimerInterval = null;
let playersRealtimeChannel = null;

// Corrida real confirmada: recriar um canal com o MESMO nome do
// anterior (mesma sala, rodada nova) não espera o removeChannel()
// terminar de verdade antes de assinar de novo - o SDK às vezes
// ainda "lembra" do nome antigo e a nova inscrição não pega, sem
// erro nenhum aparecendo. Sufixo crescente em cada nome de canal
// evita a colisão de raiz, em vez de tentar acertar o timing do
// fechamento. Usado tanto pra players quanto pra answers.
let realtimeChannelCounter = 0;
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

    const { questionIds, customQuestions: builtCustomQuestions, errorKey } = await buildQuestionsForPack(packSlug, numQuestionsWanted);
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
    const hostUserId = await getCurrentUserId();

    // Modo custom continua guardando o conteúdo na própria sala
    // (escopo menor de propósito - só afeta a sala do próprio host,
    // ver mesma decisão tomada no Time Attack). Pacote oficial agora
    // guarda só os IDs sorteados (selected_question_ids), nunca mais
    // o conteúdo com resposta certa - antes ficava tudo em
    // `questions`, incluindo o gabarito, visível pra qualquer um que
    // entrasse na sala.
    const roomPayload = {
        room_code: roomCode,
        host_name: hostName,
        pack_slug: packSlug,
        question_seconds: questionSeconds,
        num_questions: builtCustomQuestions ? builtCustomQuestions.length : questionIds.length,
        questions: builtCustomQuestions || null,
        selected_question_ids: builtCustomQuestions ? null : questionIds,
        status: 'waiting',
        current_question_index: -1,
        theme_name: selectedTheme.name,
        host_id: hostUserId
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

    if (hostUserId) {
        window.ndquestSupabase
            .from('match_history')
            .insert({
                user_id: hostUserId,
                role: 'host',
                game: 'show_down',
                room_code: roomCode
            })
            .then(({ error: historyError }) => {
                if (historyError) console.error('Show Down host history error:', historyError);
            });
    }

    currentPackSlug = packSlug;
    activeRoomId = data.id;
    selectedQuestions = data.questions;
    selectedQuestionIds = data.selected_question_ids;
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
    subscribeToAnswers(activeRoomId);
}

function renderWaitingPlayers(players) {
    const activePlayers = players.filter((p) => !isPlayerStale(p));

    if (activePlayers.length === 0) {
        waitingEmpty.hidden = false;
        waitingPlayersList.innerHTML = '';
        return;
    }

    waitingEmpty.hidden = true;
    waitingPlayersList.innerHTML = activePlayers
        .map((p) => `<span class="player-chip">${p.nickname}</span>`)
        .join('');

    loadPlayerBadgeMap(activePlayers.map((p) => p.user_id)).then((badgeMap) => {
        waitingPlayersList.innerHTML = activePlayers
            .map((p) => `<span class="player-chip">${p.nickname}${buildMiniBadgeRow(badgeMap.get(p.user_id))}</span>`)
            .join('');
    });
}

async function loadPlayers(roomId) {
    const { data, error } = await window.ndquestSupabase
        .from('showdown_players')
        .select('id, user_id, nickname, total_score, last_seen_at')
        .eq('room_id', roomId)
        .order('joined_at', { ascending: true });

    if (error) {
        console.error('Show Down load players error:', error);
        return [];
    }
    return data || [];
}

// Sessão abandonada - mesmo problema já visto no Time Attack, mas
// aqui tem uma consequência funcional a mais: sem isso, "encerra
// sozinho quando todo mundo responde" (checkIfEveryoneAnswered)
// ficaria travado pra sempre esperando alguém que já fechou a aba.
const STALE_THRESHOLD_MS = 30000;

function isPlayerStale(player) {
    if (!player.last_seen_at) return true;
    return (Date.now() - new Date(player.last_seen_at).getTime()) > STALE_THRESHOLD_MS;
}

function subscribeToPlayers(roomId) {
    loadPlayers(roomId).then(renderWaitingPlayers);

    if (playersRealtimeChannel) {
        window.ndquestSupabase.removeChannel(playersRealtimeChannel);
    }

    playersRealtimeChannel = window.ndquestSupabase
        .channel(`show-down-players-${roomId}-${++realtimeChannelCounter}`)
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
    questionEndingInProgress = false;
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

async function renderQuestionScreen(index, startedAtISO) {

    showScreen(screenQuestion);

    questionIndexLabel.textContent = t('question.indexLabel', { current: index + 1, total: numQuestionsTotal });

    // Limpa o conteúdo da pergunta anterior JÁ, antes de qualquer
    // busca assíncrona - sem isso, quem tem pacote oficial (não
    // custom) via a pergunta antiga travada na tela durante o tempo
    // que leva pra buscar a nova (reportado ao vivo: "tem um delay
    // que carrega a pergunta anterior antes").
    hostQuestionText.textContent = '';
    hostAnswersGrid.innerHTML = '';

    if (selectedQuestions) {
        // Modo custom - conteúdo já está local, sem precisar de rede.
        const q = selectedQuestions[index];
        const answers = q.answers[currentLanguage] || q.answers.pt;
        hostQuestionText.textContent = q.question[currentLanguage] || q.question.pt;
        renderHostAnswerButtons(answers);
    } else {
        // Pacote oficial - busca da Edge Function, sem resposta certa
        // incluída (não precisa dela aqui, só mostra a pergunta).
        const data = await callGameFunction('showdown-get-question', { room_id: activeRoomId });
        if (data.error) {
            console.error('Show Down: erro ao buscar pergunta pro host', data.error);
            return;
        }
        const text = currentLanguage === 'en' ? data.question_en : data.question_pt;
        const answers = shuffleArray(data.options).map((opt) => currentLanguage === 'en' ? opt.en : opt.pt);
        hostQuestionText.textContent = text;
        renderHostAnswerButtons(answers);
    }

    startQuestionTimer(startedAtISO);
}

function renderHostAnswerButtons(answers) {
    hostAnswersGrid.innerHTML = '';
    answers.forEach((answerText) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'answer-btn';
        btn.textContent = answerText;
        btn.disabled = true;
        hostAnswersGrid.appendChild(btn);
    });
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

let questionEndingInProgress = false;

async function endCurrentQuestion() {

    // Trava contra disparo duplo - pode acontecer do temporizador
    // estourar bem no mesmo instante que o último jogador responde
    // (auto-encerrar por "todo mundo já respondeu"), os dois tentando
    // fechar a pergunta ao mesmo tempo.
    if (questionEndingInProgress) return;
    questionEndingInProgress = true;

    const { error } = await window.ndquestSupabase
        .from('showdown_rooms')
        .update({ status: 'results' })
        .eq('id', activeRoomId);

    if (error) {
        console.error('Show Down end question error:', error);
    }

    await renderResultsScreen(currentQuestionIndex);
}

// Encerra a pergunta sozinho assim que todo mundo já respondeu, sem
// precisar esperar o tempo estourar nem o host clicar em nada.
// Escuta cada resposta chegando (showdown_answers) e compara com o
// total de jogadores da sala.
let answersRealtimeChannel = null;

function subscribeToAnswers(roomId) {

    if (answersRealtimeChannel) {
        window.ndquestSupabase.removeChannel(answersRealtimeChannel);
    }

    answersRealtimeChannel = window.ndquestSupabase
        .channel(`show-down-answers-${roomId}-${++realtimeChannelCounter}`)
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'showdown_answers', filter: `room_id=eq.${roomId}` },
            () => checkIfEveryoneAnswered(roomId)
        )
        .subscribe();

}

async function checkIfEveryoneAnswered(roomId) {

    // Só faz sentido checar durante a pergunta em si - se a sala já
    // não está mais em 'question' (encerrou por outro caminho, ou
    // ainda nem começou), não tem o que auto-encerrar.
    if (questionTimerInterval === null) return;

    // Só conta quem realmente ainda está por aqui - sem isso, uma
    // pessoa que abandonou no meio da pergunta travaria o
    // auto-encerramento pra sempre, esperando uma resposta que nunca
    // vai chegar.
    const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MS).toISOString();

    const [{ count: totalPlayers }, { count: totalAnswers }] = await Promise.all([
        window.ndquestSupabase
            .from('showdown_players')
            .select('id', { count: 'exact', head: true })
            .eq('room_id', roomId)
            .gte('last_seen_at', staleThreshold),
        window.ndquestSupabase
            .from('showdown_answers')
            .select('id', { count: 'exact', head: true })
            .eq('room_id', roomId)
            .eq('question_index', currentQuestionIndex),
    ]);

    if (totalPlayers !== null && totalAnswers !== null && totalPlayers > 0 && totalAnswers >= totalPlayers) {
        if (questionTimerInterval) {
            clearInterval(questionTimerInterval);
            questionTimerInterval = null;
        }
        endCurrentQuestion();
    }

}

async function renderResultsScreen(index) {

    showScreen(screenResults);

    resultsIndexLabel.textContent = t('question.indexLabel', { current: index + 1, total: numQuestionsTotal });

    if (selectedQuestions) {
        const q = selectedQuestions[index];
        const answers = q.answers[currentLanguage] || q.answers.pt;
        resultsCorrectAnswer.textContent = answers[q.correct];
    } else {
        // Pacote oficial - a Edge Function só inclui correct_index se
        // a sala já estiver com status 'results' (checado no
        // servidor, não confia em quando o cliente pede).
        const data = await callGameFunction('showdown-get-question', { room_id: activeRoomId });
        if (data.error || data.correct_index === undefined) {
            console.error('Show Down: erro ao buscar resposta certa pro resultado', data.error);
        } else {
            const correctOption = data.options.find((opt) => opt.index === data.correct_index);
            resultsCorrectAnswer.textContent = correctOption ? (currentLanguage === 'en' ? correctOption.en : correctOption.pt) : '';
        }
    }

    const players = await loadPlayers(activeRoomId);
    renderRankingList(resultsRankingList, players);

    const isLastQuestion = index >= numQuestionsTotal - 1;
    nextQuestionBtn.textContent = isLastQuestion ? t('buttons.seeFinalRanking') : t('buttons.nextQuestion');
}

async function renderRankingList(container, players) {
    const sorted = [...players].sort((a, b) => b.total_score - a.total_score);
    const badgeMap = await loadPlayerBadgeMap(sorted.map((p) => p.user_id));
    container.innerHTML = sorted
        .map((p, i) => `
            <div class="leaderboard-row">
                <span class="leaderboard-row__rank">#${i + 1}</span>
                <span class="leaderboard-row__name-block">
                    <span class="leaderboard-row__name">${p.nickname}</span>
                    ${buildMiniBadgeRow(badgeMap.get(p.user_id))}
                </span>
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
// Rodadas anteriores - mesmo padrão visual do Time Attack e do
// Roulette (card "Rodada 1 / Rodada 2", mais recente primeiro).
// Guardado em memória, só pra tela ao vivo do host nesta sessão -
// o histórico de verdade já fica gravado em match_history/
// guest_participants por rodada (ver play.js), isso aqui é
// conveniência visual, igual nos outros dois jogos.
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
        title.textContent = `${t('finalRanking.roundLabel')} ${round.roundNumber}`;
        block.appendChild(title);

        round.results.forEach((player, index) => {
            const row = document.createElement('div');
            row.className = 'previous-round-row';
            row.innerHTML = `<span>#${index + 1} ${player.nickname}</span><span>${player.total_score} ${t('ranking.pointsLabel')}</span>`;
            block.appendChild(row);
        });

        list.appendChild(block);

    });

}

// --------------------------------------------------------
// Jogar de novo: mesma sala, mesmo código, mesmos jogadores -
// só sorteia um novo conjunto de perguntas e zera o placar.
// --------------------------------------------------------

playAgainBtn.addEventListener('click', async () => {

    playAgainBtn.disabled = true;

    // Arquiva o placar da rodada que está fechando, e sobe
    // round_number na sala - é isso que play.js lê pra saber qual
    // rodada gravar no histórico de cada jogador (ver
    // docs/MATCH_HISTORY_ARCHITECTURE.md e o mesmo padrão já usado
    // no Time Attack). Busca o número atual em vez de confiar numa
    // variável local, mesma razão do Time Attack: seguro aqui porque
    // só o host clica nisso, sem concorrência real.
    const { data: currentRoomData, error: fetchRoundError } = await window.ndquestSupabase
        .from('showdown_rooms')
        .select('round_number')
        .eq('id', activeRoomId)
        .maybeSingle();

    if (fetchRoundError) console.error('Show Down: erro ao buscar round_number atual', fetchRoundError);

    const roundBeingClosed = currentRoomData?.round_number || 1;
    const nextRound = roundBeingClosed + 1;

    const { data: finishedPlayers } = await window.ndquestSupabase
        .from('showdown_players')
        .select('nickname, total_score')
        .eq('room_id', activeRoomId);

    const { questionIds, customQuestions: builtCustomQuestions, errorKey } = await buildQuestionsForPack(currentPackSlug, numQuestionsTotal);
    if (errorKey) {
        // Não deveria acontecer (mesmo pacote que já funcionou antes),
        // mas se acontecer, mantém a tela como está em vez de travar.
        console.error('Show Down play again error:', errorKey);
        playAgainBtn.disabled = false;
        return;
    }

    // Limpa as respostas da partida anterior via Edge Function com
    // chave de serviço, não direto daqui - sem isso, a trava de "uma
    // resposta por pergunta por jogador" (unique de player_id +
    // question_index) impediria qualquer um de responder de novo, já
    // que os números das perguntas se repetem entre uma partida e
    // outra na mesma sala. Ver showdown-reset-round: se essa limpeza
    // falhasse calada por RLS (chamada direta do navegador do host,
    // que não é o dono dessas linhas), era exatamente isso que
    // travava o auto-encerramento a partir da 2ª rodada.
    const resetResult = await callGameFunction('showdown-reset-round', { room_id: activeRoomId });
    if (resetResult.error) {
        console.error('Show Down play again error (reset):', resetResult.error);
        playAgainBtn.disabled = false;
        return;
    }

    // Só arquiva a rodada DEPOIS do reset confirmado - bug real
    // reportado ao vivo (no Tap Rush, mesmo padrão aqui): arquivar
    // antes e resetar depois deixava uma "rodada fantasma" no card
    // toda vez que o reset falhava (a rodada nunca de fato avançava,
    // mas ficava registrada como se tivesse).
    if (finishedPlayers && finishedPlayers.length > 0) {
        const sorted = [...finishedPlayers].sort((a, b) => (b.total_score || 0) - (a.total_score || 0));
        previousRounds.push({ roundNumber: roundBeingClosed, results: sorted });
        renderPreviousRounds();
    }

    const newNumQuestions = builtCustomQuestions ? builtCustomQuestions.length : questionIds.length;

    const { error } = await window.ndquestSupabase
        .from('showdown_rooms')
        .update({
            questions: builtCustomQuestions || null,
            selected_question_ids: builtCustomQuestions ? null : questionIds,
            num_questions: newNumQuestions,
            status: 'waiting',
            current_question_index: -1,
            question_started_at: null,
            round_number: nextRound
        })
        .eq('id', activeRoomId);

    playAgainBtn.disabled = false;

    if (error) {
        console.error('Show Down play again error:', error);
        return;
    }

    selectedQuestions = builtCustomQuestions;
    selectedQuestionIds = questionIds;
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
