// ==================================================================
// ROULETTE — host.js
//
// Três formas de montar a lista de nomes:
//   1. "import"  — puxa quem já jogou Time Attack ou Show Down numa
//                  sala anterior (consulta direta nas tabelas desses
//                  jogos, mesmo projeto Supabase — não é import de
//                  arquivo, é leitura de dado em tempo de execução).
//   2. "qr"      — cria uma sala própria da Roleta, código/QR, quem
//                  entra só digita o nome.
//   3. "paste"   — cola uma lista pronta, um nome por linha.
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
// Tema de marca (white label) — mesmo sistema dos outros jogos.
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

    const { data, error } = await window.ndquestSupabase
        .from('roulette_rooms')
        .insert({
            room_code: roomCode,
            host_name: hostName,
            status: 'open',
            theme_name: selectedTheme.name
        })
        .select()
        .single();

    qrCreateBtn.disabled = false;

    if (error || !data) {
        qrError.textContent = t('errors.roomCreateFailed');
        console.error('Roulette create room error:', error);
        return;
    }

    qrRoomId = data.id;

    qrBeforeCreate.hidden = true;
    qrAfterCreate.hidden = false;

    qrRoomCodeText.textContent = roomCode;
    const baseUrl = `${window.location.origin}${window.location.pathname.replace('index.html', '')}play/index.html`;
    const publicPlayUrl = `${baseUrl}?room=${roomCode}`;
    qrRoomQrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(publicPlayUrl)}`;

    subscribeToQrPlayers(qrRoomId);
});

async function loadQrPlayers(roomId) {
    const { data, error } = await window.ndquestSupabase
        .from('roulette_players')
        .select('nickname')
        .eq('room_id', roomId);

    if (error) {
        console.error('Roulette load players error:', error);
        return [];
    }
    return data || [];
}

function renderQrPlayers(players) {
    namesPool = players.map((p) => p.nickname);

    if (players.length === 0) {
        qrEmpty.hidden = false;
        qrPlayersList.innerHTML = '';
        return;
    }
    qrEmpty.hidden = true;
    qrPlayersList.innerHTML = players.map((p) => `<span class="player-chip">${p.nickname}</span>`).join('');
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

function onSpinComplete(winnerIndex, winnerName) {

    isSpinning = false;
    spinBtn.disabled = false;
    spinBtn.textContent = t('wheel.spinBtn');

    winners.push(winnerName);
    renderWinners();

    winnerBannerName.textContent = winnerName;
    winnerBanner.hidden = false;

    if (removeWinnerToggle.checked) {
        currentPool.splice(winnerIndex, 1);
        if (currentPool.length === 0) {
            spinBtn.disabled = true;
            spinBtn.textContent = t('wheel.everyoneWon');
        } else {
            buildWheel(currentPool, true);
        }
    }
}

// --------------------------------------------------------
// Lista de ganhadores
// --------------------------------------------------------

function renderWinners() {
    if (winners.length === 0) {
        winnersEmpty.hidden = false;
        winnersList.innerHTML = '';
        return;
    }
    winnersEmpty.hidden = true;
    winnersList.innerHTML = winners
        .map((name, i) => `
            <div class="winner-row">
                <span class="winner-row__position">#${i + 1}</span>
                <span class="winner-row__name">${name}</span>
            </div>
        `)
        .join('');
}

copyWinnersBtn.addEventListener('click', async () => {
    const text = winners.map((name, i) => `${i + 1}. ${name}`).join('\n');
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

spinAgainBtn.addEventListener('click', () => {
    currentPool = [...originalPool];
    winners = [];
    winnerBanner.hidden = true;
    renderWinners();
    buildWheel(currentPool, true);
    spinBtn.disabled = false;
    spinBtn.textContent = t('wheel.spinBtn');
});

changeNamesLink.addEventListener('click', (event) => {
    event.preventDefault();

    namesPool = [];
    currentPool = [];
    originalPool = [];
    winners = [];
    qrRoomId = null;

    if (qrRealtimeChannel) {
        window.ndquestSupabase.removeChannel(qrRealtimeChannel);
        qrRealtimeChannel = null;
    }

    qrBeforeCreate.hidden = false;
    qrAfterCreate.hidden = true;
    importStatus.textContent = '';
    pasteStatus.textContent = '';
    pasteTextarea.value = '';
    importRoomCodeInput.value = '';

    showScreen(screenConfig);
});
