// ==================================================================
// account/claim-display.html — claim-display.js
//
// Tela feita pra ficar aberta num evento (TV, projetor, ou até
// impressa) - só mostra o QR grande e a badge, sem interação
// nenhuma. De propósito NÃO carrega a biblioteca inteira do Supabase
// aqui - essa tela só faz uma leitura pública (get-badge-claim-info),
// não precisa de login nem de escrita, então uma chamada fetch
// direta já basta e a página fica mais leve e com menos
// dependência de CDN externo pra ficar de pé confiável durante um
// evento ao vivo.
// ==================================================================

const SUPABASE_URL = "https://tndiyjitylqjajtlneyi.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_LNbUGyVXxa9Z-j4uFjWhxQ_5LONKXqI";

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

function buildIconSvg(iconKey) {
    const inner = BADGE_ICONS[iconKey];
    if (!inner) return "";
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}

function renderBadgePreview(badge) {
    const el = document.getElementById("display-badge-preview");
    el.innerHTML = "";

    const badgeEl = document.createElement("div");
    if (badge.image_url) {
        badgeEl.className = "badge badge--image";
        const img = document.createElement("img");
        img.src = badge.image_url;
        img.alt = "";
        badgeEl.appendChild(img);
    } else {
        badgeEl.className = `badge badge--${badge.badge_shape}`;
        badgeEl.style.background = badge.background_color;
        if (badge.icon) {
            const iconSpan = document.createElement("span");
            iconSpan.className = "badge-icon";
            iconSpan.innerHTML = buildIconSvg(badge.icon);
            iconSpan.style.color = badge.icon_color || badge.background_color;
            const sizePx = Math.round(64 * ((badge.icon_size || 35) / 100));
            iconSpan.style.width = `${sizePx}px`;
            iconSpan.style.height = `${sizePx}px`;
            badgeEl.appendChild(iconSpan);
        }
    }

    el.appendChild(badgeEl);
}

function getLang() {
    return document.documentElement.lang === "en" ? "en" : "pt";
}

async function main() {
    const code = new URLSearchParams(window.location.search).get("code");
    const titleEl = document.getElementById("display-title");
    const hintEl = document.getElementById("display-hint");
    const qrWrap = document.getElementById("display-qr-wrap");
    const badgeRow = document.getElementById("display-badge-row");

    if (!code) {
        titleEl.textContent = "Invalid link";
        hintEl.textContent = "This display link is missing its code.";
        return;
    }

    const infoResponse = await fetch(`${SUPABASE_URL}/functions/v1/get-badge-claim-info?code=${encodeURIComponent(code)}`, {
        headers: {
            "apikey": SUPABASE_PUBLISHABLE_KEY,
            "Authorization": `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        },
    });
    const info = await infoResponse.json().catch(() => ({}));

    if (!infoResponse.ok || !info.badge) {
        titleEl.textContent = "Code not found";
        hintEl.textContent = info.error || "This claim code doesn't exist.";
        return;
    }

    if (!info.valid) {
        const reasons = {
            paused: "This code is currently paused.",
            expired: "This code has expired.",
            exhausted: "This code has reached its usage limit.",
        };
        titleEl.textContent = "No longer available";
        hintEl.textContent = reasons[info.reason] || "This code is no longer valid.";
        qrWrap.innerHTML = "";
        return;
    }

    const lang = getLang();
    renderBadgePreview(info.badge);
    document.getElementById("display-badge-name").textContent = lang === "en" ? info.badge.name_en : info.badge.name_pt;
    document.getElementById("display-badge-description").textContent = (lang === "en" ? info.badge.description_en : info.badge.description_pt) || "";
    badgeRow.hidden = false;

    // Aponta pra tela CLARA de resgate (claim.html), não direto pra
    // dentro da conta - mesma tela que já resolve login e resgate
    // sozinha, só que a pessoa chega nela escaneando aqui, em vez de
    // clicar num link recebido por mensagem.
    const claimUrl = `${window.location.origin}${window.location.pathname.replace(/claim-display\.html$/, "")}claim.html?code=${encodeURIComponent(code)}`;
    qrWrap.innerHTML = `<img class="display-qr" src="https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(claimUrl)}" alt="QR code">`;
}

main();
