// ==================================================================
// TIME ATTACK - host.js
// ==================================================================

import translations from './i18n/translations.js';
import themes from './branding/branding-manifest.js';

// --------------------------------------------------------
// Idioma
// --------------------------------------------------------

let currentLanguage = localStorage.getItem('time-attack:language') || 'pt';

function t(key) {
    const dict = translations[currentLanguage] || translations.pt;
    return dict[key] !== undefined ? dict[key] : key;
}

// --------------------------------------------------------
// Badges do jogador - mini-card evoluído do "quadrinho simples só
// com nome", pedido ao vivo: pega o card de perfil, resume (sem
// redes sociais, sem bio), mostra só os badges que a pessoa escolheu
// destacar. Cópia própria desta pasta, mesmo padrão de sempre -
// mesmos ícones/cores usados na tela de criar badge (account/).
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

// Busca os badges em destaque de vários jogadores de uma vez só -
// mesma regra do perfil público: se a pessoa já escolheu quais
// destacar, mostra só esses; se ainda não escolheu nenhum, mostra
// todos (até o limite de 3 aqui, por causa do espaço apertado).
// Cache por user_id - reportado ao vivo: o placar atualiza toda hora
// (sinal de vida dos jogadores, não só quando alguém termina), e sem
// cache isso disparava uma busca de rede nova a cada atualização,
// mesmo sem nada mudar nos badges de ninguém.
//
// Guarda com validade de 60s (não pra sempre) - reportado ao vivo:
// um cache sem validade mostrava dado velho se a pessoa mudasse a
// curadoria dos próprios badges NO MEIO da partida (escolher quais
// mostrar) depois que essa tela já tinha guardado os badges antigos.
// 60s é tempo suficiente pra evitar buscar de novo a cada
// atualização rápida seguida, mas curto o bastante pra não ficar
// preso a dado desatualizado por muito tempo.
const playerBadgeCache = new Map();
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
                .select('user_id, badge_id, badges(background_color, icon, icon_color, image_url)')
                .in('user_id', uncached),
        ]);

        const featuredById = new Map((profiles || []).map((p) => [p.id, new Set(p.featured_badge_ids || [])]));
        uncached.forEach((id) => playerBadgeCache.set(id, { badges: [], cachedAt: now }));

        (userBadgeRows || []).forEach((row) => {
            const featuredSet = featuredById.get(row.user_id);
            const isFeatured = featuredSet && featuredSet.size > 0 ? featuredSet.has(row.badge_id) : true;
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
            if (b.image_url) {
                return `<span class="mini-badge"><img src="${b.image_url}" alt=""></span>`;
            }
            const color = b.icon_color || b.background_color || '#888';
            return `<span class="mini-badge" style="background:${b.background_color || '#333'};color:${color};">${b.icon ? buildMiniIconSvg(b.icon) : ''}</span>`;
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

// --------------------------------------------------------
// Referências DOM
// --------------------------------------------------------

const screenConfig = document.getElementById('screen-config');
const screenRoom = document.getElementById('screen-room');

const hostNameInput = document.getElementById('host-name-input');
const packSelect = document.getElementById('pack-select');
const themeSelect = document.getElementById('theme-select');
const logoImg = document.getElementById('logo-img');
const timeStartInput = document.getElementById('time-start-input');
const timeCapInput = document.getElementById('time-cap-input');
const timeBonusInput = document.getElementById('time-bonus-input');
const timePenaltyInput = document.getElementById('time-penalty-input');
const configError = document.getElementById('config-error');
const createRoomBtn = document.getElementById('create-room-btn');

const roomCodeText = document.getElementById('room-code-text');
const roomQrImg = document.getElementById('room-qr-img');
const roomLinkText = document.getElementById('room-link-text');
const copyLinkBtn = document.getElementById('copy-link-btn');
const roomSummary = document.getElementById('room-summary');
const leaderboardList = document.getElementById('leaderboard-list');
const leaderboardEmpty = document.getElementById('leaderboard-empty');
const leaderboardPlayingNow = document.getElementById('leaderboard-playing-now');
const playAsHostLink = document.getElementById('play-as-host-link');
const closeRoomBtn = document.getElementById('close-room-btn');
const allowNewRoundBtn = document.getElementById('allow-new-round-btn');

const customQuestionsPanel = document.getElementById('custom-questions-panel');
const bulkTextarea = document.getElementById('bulk-textarea');
const downloadTemplateBtn = document.getElementById('download-template-btn');
const fileUploadInput = document.getElementById('file-upload');
const parseBtn = document.getElementById('parse-btn');
const parseErrorsBox = document.getElementById('parse-errors');
const previewStatus = document.getElementById('preview-status');
const previewList = document.getElementById('preview-list');

// --------------------------------------------------------
// Popular pacotes de perguntas - agora vem do banco (tabela
// question_packs), não mais de um arquivo local. Ver
// docs/BADGE_INTEGRITY_ARCHITECTURE.md (Mecanismo B): as perguntas
// em si (com a resposta certa) NUNCA chegam nesta tela nem em
// nenhuma outra do lado do cliente - só nome e slug do pacote, que
// não são sigilosos. Só filtra 'official' por enquanto; os outros
// níveis (pacote pessoal de VIP, temporário, etc.) entram aqui
// depois, quando essa parte for construída.
// --------------------------------------------------------

let availablePacks = [];

async function populatePackSelect() {
    const previousValue = packSelect.value;

    const { data, error } = await window.ndquestSupabase
        .from('question_packs')
        .select('slug, name_pt, name_en')
        .eq('tier', 'official')
        .order('name_pt');

    if (error) {
        console.error('Time Attack: erro ao carregar pacotes', error);
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
    customQuestionsPanel.hidden = packSelect.value !== 'custom';
});

// --------------------------------------------------------
// Tema de marca (white label) - mesmo sistema do Quest Drop,
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
// Troca de idioma
// --------------------------------------------------------

function setActiveLanguageButton() {
    document.getElementById('lang-pt').classList.toggle('is-active', currentLanguage === 'pt');
    document.getElementById('lang-en').classList.toggle('is-active', currentLanguage === 'en');
}

function changeLanguage(lang) {
    currentLanguage = lang;
    localStorage.setItem('time-attack:language', lang);
    applyTranslations();
    setActiveLanguageButton();
    populatePackSelect();
    updatePreviewStatus();
}

document.getElementById('lang-pt').addEventListener('click', () => changeLanguage('pt'));
document.getElementById('lang-en').addEventListener('click', () => changeLanguage('en'));
setActiveLanguageButton();

// --------------------------------------------------------
// Código de sala (curto, fácil de digitar, sem caracteres
// ambíguos como 0/O ou 1/I)
// --------------------------------------------------------

// --------------------------------------------------------
// Minhas Próprias Perguntas - cola/envia, processa, usa só
// nesta sala (fica guardado na própria sala no banco, porque os
// jogadores estão em aparelhos diferentes do host, diferente do
// Quest Drop que fica tudo local no mesmo navegador).
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
    a.download = 'modelo-perguntas-time-attack.txt';
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
        previewStatus.textContent = t('customQuestions.someProcessed').replace('{n}', String(customQuestions.length));
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
}

parseBtn.addEventListener('click', () => {
    const { parsed, errors } = parseCustomBulkText(bulkTextarea.value);
    customQuestions = errors.length === 0 ? parsed : [];
    renderPreview(parsed, errors);
    updatePreviewStatus();
});

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
let realtimeChannel = null;
let leaderboardStalenessInterval = null;

createRoomBtn.addEventListener('click', async () => {

    configError.textContent = '';

    const hostName = hostNameInput.value.trim();
    if (!hostName) {
        configError.textContent = t('errors.hostNameRequired');
        return;
    }

    const timeStart = Number(timeStartInput.value);
    const timeCap = Number(timeCapInput.value);
    const timeBonus = Number(timeBonusInput.value);
    const timePenalty = Number(timePenaltyInput.value);

    if (!timeStart || timeStart <= 0 || !timeCap || timeCap <= 0 || !timeBonus || timeBonus <= 0 || !timePenalty || timePenalty <= 0) {
        configError.textContent = t('errors.invalidTimeValues');
        return;
    }

    const packSlug = packSelect.value;

    if (packSlug === 'custom' && customQuestions.length === 0) {
        configError.textContent = t('errors.customQuestionsRequired');
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

    const roomPayload = {
        room_code: roomCode,
        host_name: hostName,
        pack_slug: packSlug,
        time_bank_start: timeStart,
        time_bonus_correct: timeBonus,
        time_penalty_wrong: timePenalty,
        time_cap_seconds: timeCap,
        theme_name: selectedTheme.name,
        host_id: hostUserId
    };

    if (packSlug === 'custom') {
        roomPayload.custom_questions = customQuestions;
    }

    const { data, error } = await window.ndquestSupabase
        .from('time_attack_rooms')
        .insert(roomPayload)
        .select()
        .single();

    createRoomBtn.disabled = false;

    if (error || !data) {
        configError.textContent = t('errors.roomCreateFailed');
        console.error('Time Attack create room error:', error);
        return;
    }

    // Histórico de "hosteou uma sala" - só grava se logado. Registra
    // já na criação (não existe um "fim de sala" único e confiável do
    // lado do host pra esperar por ele - o host pode fechar a aba a
    // qualquer momento).
    if (hostUserId) {
        window.ndquestSupabase
            .from('match_history')
            .insert({
                user_id: hostUserId,
                role: 'host',
                game: 'time_attack',
                room_code: roomCode
            })
            .then(({ error: historyError }) => {
                if (historyError) console.error('Time Attack host history error:', historyError);
            });
    }

    activeRoomId = data.id;
    activeRoomCode = roomCode;
    applyTheme(selectedTheme);
    showRoomScreen(roomCode, data, hostName);
});

// --------------------------------------------------------
// Tela da sala: código, QR, placar ao vivo
// --------------------------------------------------------

function showRoomScreen(roomCode, roomData, hostName) {

    screenConfig.hidden = true;
    screenRoom.hidden = false;

    roomCodeText.textContent = roomCode;

    const pack = availablePacks.find((p) => p.slug === roomData.pack_slug);
    const packName = roomData.pack_slug === 'custom'
        ? t('pack.customOption')
        : (pack ? (currentLanguage === 'en' ? pack.name_en : pack.name_pt) : roomData.pack_slug);

    roomSummary.innerHTML = `
        <span class="room-summary__chip"><strong>${packName}</strong></span>
        <span class="room-summary__chip">${t('labels.timeBankStart')}: <strong>${roomData.time_bank_start}s</strong></span>
        <span class="room-summary__chip">${t('labels.timeBonusCorrect')}: <strong>+${roomData.time_bonus_correct}s</strong></span>
        <span class="room-summary__chip">${t('labels.timePenaltyWrong')}: <strong>-${roomData.time_penalty_wrong}s</strong></span>
        <span class="room-summary__chip">${t('labels.timeCapSeconds')}: <strong>${roomData.time_cap_seconds}s</strong></span>
    `;

    const baseUrl = `${window.location.origin}${window.location.pathname.replace('index.html', '')}play/index.html`;

    // Link/QR público, sem nome nenhum - é o que qualquer jogador vê e usa.
    const publicPlayUrl = `${baseUrl}?room=${roomCode}`;
    roomLinkText.textContent = publicPlayUrl;

    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(publicPlayUrl)}`;
    roomQrImg.src = qrApiUrl;

    // Link só do botão "Jogar também", privado, já leva o nome do host
    // (que ele já digitou aqui na configuração) e pula direto pra tela
    // de pronto, sem pedir o nome de novo.
    const hostPlayUrl = `${baseUrl}?room=${roomCode}&nickname=${encodeURIComponent(hostName)}&autojoin=1`;
    playAsHostLink.href = hostPlayUrl;

    subscribeToLeaderboard(roomData.id);
}

async function renderLeaderboard(players) {

    // Sessão abandonada - reportado ao vivo: se a pessoa fecha a aba
    // no meio do jogo, a linha dela fica pra sempre sem finished_at,
    // e aparecia como "jogando agora" indefinidamente, mesmo horas
    // depois. last_seen_at é um sinal de vida que o próprio jogador
    // atualiza periodicamente (ver play.js) - se isso não chega há
    // mais de 30s, trata como abandonada, não como "ainda jogando".
    const STALE_THRESHOLD_MS = 30000;
    const now = Date.now();

    const isStale = (player) => {
        if (player.finished_at) return false;
        if (!player.last_seen_at) return true; // nunca mandou sinal nenhum, trata como abandonada
        return (now - new Date(player.last_seen_at).getTime()) > STALE_THRESHOLD_MS;
    };

    const finished = players.filter((p) => p.finished_at !== null);
    const stillActive = players.filter((p) => p.finished_at === null && !isStale(p));
    const playingCount = stillActive.length;

    if (playingCount > 0) {
        leaderboardPlayingNow.hidden = false;
        leaderboardPlayingNow.textContent = t('leaderboard.playingNow').replace('{n}', String(playingCount));
    } else {
        leaderboardPlayingNow.hidden = true;
    }

    if (finished.length === 0) {
        leaderboardList.innerHTML = '';
        leaderboardEmpty.hidden = false;
        return;
    }

    leaderboardEmpty.hidden = true;

    const sorted = [...finished].sort((a, b) => {
        if (b.correct_answers !== a.correct_answers) {
            return b.correct_answers - a.correct_answers;
        }
        return new Date(a.finished_at) - new Date(b.finished_at);
    });

    // Busca os badges ANTES de mexer na tela - reportado ao vivo:
    // limpar a lista e só depois esperar a busca (que é uma chamada
    // de rede) fazia a tela "piscar vazia" toda vez que atualizava,
    // já que essa função roda a cada sinal de vida dos jogadores
    // (bem frequente). Agora só limpa e redesenha de uma vez, depois
    // que os dados já estão prontos.
    const badgeMap = await loadPlayerBadgeMap(sorted.map((p) => p.user_id));

    leaderboardList.innerHTML = '';

    sorted.forEach((player, index) => {
        const row = document.createElement('div');
        row.className = 'leaderboard-row';
        row.innerHTML = `
            <span class="leaderboard-row__rank">#${index + 1}</span>
            <span class="leaderboard-row__name-block">
                <span class="leaderboard-row__name">${player.nickname}</span>
                ${buildMiniBadgeRow(badgeMap.get(player.user_id))}
            </span>
            <span class="leaderboard-row__score">${player.correct_answers}</span>
        `;
        leaderboardList.appendChild(row);
    });
}

async function loadLeaderboard(roomId) {
    const { data, error } = await window.ndquestSupabase
        .from('time_attack_players')
        .select('user_id, nickname, correct_answers, finished_at, last_seen_at')
        .eq('room_id', roomId);

    if (error) {
        console.error('Time Attack load leaderboard error:', error);
        return;
    }

    renderLeaderboard(data || []);
}

function subscribeToLeaderboard(roomId) {

    loadLeaderboard(roomId);

    realtimeChannel = window.ndquestSupabase
        .channel(`time-attack-room-${roomId}`)
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'time_attack_players', filter: `room_id=eq.${roomId}` },
            () => loadLeaderboard(roomId)
        )
        .subscribe();

    // Re-checa a cada 10s mesmo sem nenhuma mudança nova no banco -
    // sem isso, uma sessão que fica "velha" (ninguém mais manda sinal
    // de vida) só seria detectada se algum OUTRO evento disparasse
    // uma atualização, o que podia nunca acontecer numa sala parada.
    if (leaderboardStalenessInterval) clearInterval(leaderboardStalenessInterval);
    leaderboardStalenessInterval = setInterval(() => loadLeaderboard(roomId), 10000);

}

// --------------------------------------------------------
// Encerrar sala
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
        console.error('Time Attack copy link error:', err);
    }
});

closeRoomBtn.addEventListener('click', async () => {

    if (!activeRoomId) return;

    closeRoomBtn.disabled = true;

    await recordFinalRanking(activeRoomId, activeRoomCode);

    await window.ndquestSupabase
        .from('time_attack_rooms')
        .update({ status: 'closed' })
        .eq('id', activeRoomId);

    closeRoomBtn.disabled = false;
    closeRoomBtn.textContent = t('room.closedMessage');
    closeRoomBtn.disabled = true;

    if (realtimeChannel) {
        window.ndquestSupabase.removeChannel(realtimeChannel);
    }

    if (leaderboardStalenessInterval) {
        clearInterval(leaderboardStalenessInterval);
        leaderboardStalenessInterval = null;
    }
});

// Libera uma nova rodada pra sala inteira - reportado ao vivo: "não
// dá pra esperar o jogador ficar recomeçando infinito sozinho, tem
// que ser o host permitindo, igual no Show Down". Incrementa
// round_number (o jogador escuta essa mudança em tempo real e só
// destrava o botão "Jogar de novo" quando o número aumentar) e zera
// o progresso de todo mundo, pra ninguém começar a nova rodada já na
// frente por causa da rodada anterior.
allowNewRoundBtn.addEventListener('click', async () => {

    if (!activeRoomId) return;

    allowNewRoundBtn.disabled = true;

    // supabase-js não expõe um jeito simples de "incrementar" via
    // update direto sem RPC - busca o valor atual e escreve +1, é
    // seguro aqui porque só o host clica nisso, sem concorrência real
    // (não é um contador de visitas que várias pessoas mexem ao
    // mesmo tempo).
    const { data: currentRoomData, error: fetchError } = await window.ndquestSupabase
        .from('time_attack_rooms')
        .select('round_number')
        .eq('id', activeRoomId)
        .maybeSingle();

    if (fetchError) console.error('Time Attack: erro ao buscar round_number atual', fetchError);

    const roundBeingClosed = currentRoomData?.round_number || 1;
    const nextRound = roundBeingClosed + 1;

    // Captura o placar ANTES de resetar - reportado ao vivo: "quero
    // ver os ganhadores das rodadas anteriores, não só a atual".
    // Guarda em memória (não no banco - isso é só pra tela ao vivo
    // desta sessão, o histórico de verdade já fica salvo em
    // match_history/guest_participants por rodada, isso aqui é
    // conveniência visual pro host acompanhar sem sair da tela).
    const { data: finishedPlayers } = await window.ndquestSupabase
        .from('time_attack_players')
        .select('nickname, correct_answers')
        .eq('room_id', activeRoomId)
        .not('finished_at', 'is', null);

    if (finishedPlayers && finishedPlayers.length > 0) {
        const sorted = [...finishedPlayers].sort((a, b) => (b.correct_answers || 0) - (a.correct_answers || 0));
        previousRounds.push({ roundNumber: roundBeingClosed, results: sorted });
        renderPreviousRounds();
    }

    const { error: roundUpdateError } = await window.ndquestSupabase
        .from('time_attack_rooms')
        .update({ round_number: nextRound })
        .eq('id', activeRoomId);

    if (roundUpdateError) console.error('Time Attack: erro ao liberar nova rodada', roundUpdateError);

    const { error: resetError } = await window.ndquestSupabase
        .from('time_attack_players')
        .update({ correct_answers: 0, finished_at: null })
        .eq('room_id', activeRoomId);

    if (resetError) console.error('Time Attack: erro ao resetar jogadores pra nova rodada', resetError);

    allowNewRoundBtn.disabled = false;

});

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

    // Mais recente primeiro
    [...previousRounds].reverse().forEach((round) => {

        const block = document.createElement('div');
        block.className = 'previous-round-block';

        const title = document.createElement('p');
        title.className = 'previous-round-title';
        title.textContent = `${t('leaderboard.roundLabel')} ${round.roundNumber}`;
        block.appendChild(title);

        round.results.forEach((player, index) => {
            const row = document.createElement('div');
            row.className = 'previous-round-row';
            row.innerHTML = `<span>#${index + 1} ${player.nickname}</span><span>${player.correct_answers}</span>`;
            block.appendChild(row);
        });

        list.appendChild(block);

    });

}

// Calcula a posição de cada jogador comparando os acertos de todo
// mundo na sala, e grava isso no lugar certo (match_history pra
// logado, guest_participants pra anônimo) - reportado ao vivo: o
// histórico do Time Attack mostrava a contagem de acertos crua em
// vez da posição, diferente dos outros 3 jogos, porque nunca existia
// comparação nenhuma entre os jogadores, só a pontuação individual
// de cada um. Só dá pra calcular isso quando a sala encerra, porque
// antes disso as pessoas ainda podem estar jogando.
async function recordFinalRanking(roomId, roomCode) {

    const { data: roomData } = await window.ndquestSupabase
        .from('time_attack_rooms')
        .select('round_number')
        .eq('id', roomId)
        .maybeSingle();

    const roundNumber = roomData?.round_number || 1;

    const { data: players, error } = await window.ndquestSupabase
        .from('time_attack_players')
        .select('user_id, nickname, correct_answers')
        .eq('room_id', roomId);

    if (error || !players || players.length === 0) {
        if (error) console.error('Time Attack: erro ao buscar jogadores pro ranking', error);
        return;
    }

    const sorted = [...players].sort((a, b) => (b.correct_answers || 0) - (a.correct_answers || 0));

    for (let i = 0; i < sorted.length; i++) {
        const player = sorted[i];
        const placement = i + 1;

        if (player.user_id) {
            const { error: historyError } = await window.ndquestSupabase
                .from('match_history')
                .update({ placement })
                .eq('user_id', player.user_id)
                .eq('game', 'time_attack')
                .eq('room_code', roomCode)
                .eq('role', 'player')
                .eq('round_number', roundNumber);

            if (historyError) console.error('Time Attack: erro ao gravar posição (logado)', historyError);
        } else {
            const { error: guestError } = await window.ndquestSupabase
                .from('guest_participants')
                .update({ placement })
                .eq('nickname', player.nickname)
                .eq('game', 'time_attack')
                .eq('room_code', roomCode)
                .eq('round_number', roundNumber);

            if (guestError) console.error('Time Attack: erro ao gravar posição (guest)', guestError);
        }
    }

}
