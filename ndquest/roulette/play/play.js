// ==================================================================
// ROULETTE — play/play.js
//
// Bem mais simples que os outros jogos: não tem partida nenhuma
// pro jogador jogar. Ele só entra com o nome, e a partir daí o
// sorteio inteiro acontece na tela do host.
// ==================================================================

import translations from '../i18n/translations.js';
import themes from '../branding/branding-manifest.js';

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
}

document.getElementById('lang-pt').addEventListener('click', () => changeLanguage('pt'));
document.getElementById('lang-en').addEventListener('click', () => changeLanguage('en'));
setActiveLanguageButton();

// --------------------------------------------------------
// Referências DOM
// --------------------------------------------------------

const screenJoin = document.getElementById('screen-join');
const screenJoined = document.getElementById('screen-joined');
const logoImg = document.getElementById('logo-img');

const roomCodeInput = document.getElementById('room-code-input');
const nicknameInput = document.getElementById('nickname-input');
const joinError = document.getElementById('join-error');
const joinRoomBtn = document.getElementById('join-room-btn');

function showScreen(el) {
    [screenJoin, screenJoined].forEach((s) => { s.hidden = true; });
    el.hidden = false;
}

const urlParams = new URLSearchParams(window.location.search);
const roomFromUrl = urlParams.get('room');
if (roomFromUrl) {
    roomCodeInput.value = roomFromUrl.toUpperCase();
}

// --------------------------------------------------------
// Entrar na sala
// --------------------------------------------------------

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
        .from('roulette_rooms')
        .select('*')
        .eq('room_code', roomCode)
        .maybeSingle();

    joinRoomBtn.disabled = false;

    if (error || !data) {
        joinError.textContent = t('errors.roomNotFound');
        return;
    }

    const { error: playerError } = await window.ndquestSupabase
        .from('roulette_players')
        .insert({ room_id: data.id, nickname });

    if (playerError) {
        joinError.textContent = t('errors.roomNotFound');
        console.error('Roulette join room error:', playerError);
        return;
    }

    const roomTheme = themes.find((th) => th.name === data.theme_name) || themes[0];
    applyTheme(roomTheme);

    showScreen(screenJoined);
});

// --------------------------------------------------------
// Tema de marca (white label) — lido da sala, só aplicado.
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
