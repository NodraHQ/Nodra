// ==================================================================
// ADMIN - admin.js
//
// Todo dado sensível (wallet de usuário, conceder VIP, listar salas
// de todos os jogos) passa por Edge Function - nunca lido/escrito
// direto com a chave pública. Ver docs/ADMIN_ARCHITECTURE.md.
// ==================================================================

const supabaseClient = window.nodraSupabase;

// Mesmo guard de resiliência do account/account.js: se o SDK não
// carregar (CDN fora do ar, etc.), avisa em vez de travar quieto.
if (!supabaseClient) {
    const loadingEl = document.getElementById("state-loading");
    if (loadingEl) {
        loadingEl.removeAttribute("data-i18n");
        loadingEl.textContent = "Couldn't load the login system. Check your connection and reload the page.";
    }
    throw new Error("window.nodraSupabase is undefined - Supabase SDK failed to load from CDN.");
}

const FUNCTIONS_BASE_URL = `${window.nodraSupabaseUrl}/functions/v1`;

const states = {
    loading: document.getElementById("state-loading"),
    signedOut: document.getElementById("state-signed-out"),
    notAdmin: document.getElementById("state-not-admin"),
    panel: document.getElementById("panel"),
};

function showState(name) {
    Object.entries(states).forEach(([key, el]) => {
        if (el) el.hidden = key !== name;
    });
}

// ==================================================================
// CHAMADA ÀS EDGE FUNCTIONS
// ==================================================================

async function callAdminFunction(name, options = {}) {

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) throw new Error("Not signed in");

    const response = await fetch(`${FUNCTIONS_BASE_URL}/${name}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
            ...(options.headers || {}),
        },
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(body.error || `Request to ${name} failed (${response.status})`);
    }

    return body;

}

// ==================================================================
// BOOT: confere sessão, depois status de admin
// ==================================================================

(async function boot() {

    const { data: { session } } = await supabaseClient.auth.getSession();

    if (!session) {
        showState("signedOut");
        return;
    }

    let isAdmin = false;
    try {
        const result = await callAdminFunction("admin-check-status");
        isAdmin = result.isAdmin === true;
    } catch (err) {
        console.error("Falha ao checar status de admin:", err);
    }

    if (!isAdmin) {
        showState("notAdmin");
        return;
    }

    showState("panel");
    initTabs();
    loadRooms();

})();

// ==================================================================
// TABS
// ==================================================================

function initTabs() {

    const tabs = document.querySelectorAll(".admin-tab");
    const panels = document.querySelectorAll(".admin-tab-panel");
    const loaded = { rooms: true, users: false, badges: false, packs: false, themes: false, analytics: false };

    tabs.forEach((tab) => {
        tab.addEventListener("click", () => {

            const target = tab.dataset.tab;

            tabs.forEach((t) => t.classList.toggle("is-active", t === tab));
            panels.forEach((p) => p.classList.toggle("is-active", p.id === `tab-${target}`));

            if (!loaded[target]) {
                loaded[target] = true;
                if (target === "users") loadUsers();
                if (target === "vip-activity") loadVipActivity();
                if (target === "badges") loadAllBadges();
                if (target === "packs") loadSubmittedPacks();
                if (target === "themes") loadSubmittedThemes();
                if (target === "support") loadSupportAdminTickets();
                if (target === "analytics") loadAnalytics();
            }

        });
    });

}

// ==================================================================
// SALAS AO VIVO
// ==================================================================

document.getElementById("rooms-refresh-btn")?.addEventListener("click", loadRooms);

let allRoomsCache = [];

async function loadRooms() {

    const tbody = document.getElementById("rooms-tbody");
    const emptyEl = document.getElementById("rooms-empty");

    try {

        const { rooms } = await callAdminFunction("admin-list-rooms");
        allRoomsCache = rooms;
        renderFilteredRooms();

    } catch (err) {
        console.error("Falha ao carregar salas:", err);
    }

}

// Filtro de jogo/status/jogador - reportado ao vivo: "poder filtrar
// as partidas no live rooms por jogo, aberta ou fechada, e poder
// pesquisar o nome de player". Busca tudo uma vez só (até 100 salas
// por jogo, já vem com os jogadores) e filtra aqui no navegador -
// não justifica ida e volta no servidor pra um volume desse tamanho.
function renderFilteredRooms() {

    const tbody = document.getElementById("rooms-tbody");
    const emptyEl = document.getElementById("rooms-empty");

    const gameFilter = document.getElementById("rooms-game-filter").value;
    const statusFilter = document.getElementById("rooms-status-filter").value;
    const playerSearch = document.getElementById("rooms-player-search").value.trim().toLowerCase();

    const filtered = allRoomsCache.filter((room) => {
        if (gameFilter && room.game !== gameFilter) return false;
        if (statusFilter === "closed" && room.status !== "closed") return false;
        if (statusFilter === "open" && room.status === "closed") return false;
        if (playerSearch) {
            const hostMatches = (room.host_name || "").toLowerCase().includes(playerSearch);
            const playerMatches = (room.players || []).some((p) => (p || "").toLowerCase().includes(playerSearch));
            if (!hostMatches && !playerMatches) return false;
        }
        return true;
    });

    tbody.innerHTML = "";
    emptyEl.hidden = filtered.length > 0;

    for (const room of filtered) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${escapeHtml(room.game)}</td>
            <td>${escapeHtml(room.room_code)}</td>
            <td>${escapeHtml(room.host_name)}</td>
            <td>${escapeHtml(room.status)}</td>
            <td>${formatDate(room.created_at)}</td>
        `;
        tbody.appendChild(tr);
    }

}

document.getElementById("rooms-game-filter")?.addEventListener("change", renderFilteredRooms);
document.getElementById("rooms-status-filter")?.addEventListener("change", renderFilteredRooms);

let roomsSearchTimeout = null;
document.getElementById("rooms-player-search")?.addEventListener("input", () => {
    clearTimeout(roomsSearchTimeout);
    roomsSearchTimeout = setTimeout(renderFilteredRooms, 250);
});

// ==================================================================
// USUÁRIOS
// ==================================================================

let usersSearchTimeout = null;

document.getElementById("users-search")?.addEventListener("input", (event) => {
    clearTimeout(usersSearchTimeout);
    usersSearchTimeout = setTimeout(() => loadUsers(event.target.value.trim()), 300);
});

async function loadUsers(search = "") {

    const tbody = document.getElementById("users-tbody");
    const emptyEl = document.getElementById("users-empty");

    try {

        const query = search ? `?search=${encodeURIComponent(search)}` : "";
        const { users } = await callAdminFunction(`admin-list-users${query}`);

        tbody.innerHTML = "";
        emptyEl.hidden = users.length > 0;

        for (const user of users) {
            const tr = document.createElement("tr");
            const tierLabel = user.is_vip && user.vip_tier
                ? ` · ${user.vip_tier.charAt(0).toUpperCase()}${user.vip_tier.slice(1)}`
                : "";
            tr.innerHTML = `
                <td>${escapeHtml(user.username || "-")}</td>
                <td class="admin-wallet-cell">${escapeHtml(user.wallet_evm || "-")}</td>
                <td>${user.is_vip ? `<span class="admin-vip-badge">VIP${escapeHtml(tierLabel)}</span>` : "-"}</td>
                <td>${formatDate(user.created_at)}</td>
                <td></td>
            `;
            const actionCell = tr.lastElementChild;

            // Seletor de tier + botão que serve pra dois casos: dar
            // VIP pela primeira vez, OU trocar o tier de quem já é
            // VIP (upgrade/downgrade sem precisar revogar e conceder
            // de novo). Bug real reportado ao vivo: essa tela nunca
            // deixou escolher tier nenhum - toda concessão ficava com
            // vip_tier null, e não tinha como saber qual tier cada
            // VIP tinha só olhando a tabela.
            const tierSelect = document.createElement("select");
            tierSelect.className = "admin-tier-select";
            ["bronze", "prata", "gold"].forEach((tierValue) => {
                const option = document.createElement("option");
                option.value = tierValue;
                option.textContent = tierValue.charAt(0).toUpperCase() + tierValue.slice(1);
                if (tierValue === (user.vip_tier || "bronze")) option.selected = true;
                tierSelect.appendChild(option);
            });
            actionCell.appendChild(tierSelect);

            const vipBtn = document.createElement("button");
            vipBtn.className = "btn btn-secondary";
            vipBtn.textContent = user.is_vip
                ? (window.nodraTranslator?.translations?.["users.updateTier"] || "Update tier")
                : (window.nodraTranslator?.translations?.["users.grantVip"] || "Grant VIP");
            vipBtn.addEventListener("click", () => toggleVip(user.id, true, tierSelect.value));
            actionCell.appendChild(vipBtn);

            if (user.is_vip) {
                const revokeBtn = document.createElement("button");
                revokeBtn.className = "btn btn-secondary";
                revokeBtn.textContent = window.nodraTranslator?.translations?.["users.revokeVip"] || "Revoke VIP";
                revokeBtn.addEventListener("click", () => toggleVip(user.id, false));
                actionCell.appendChild(revokeBtn);
            }

            // Botão separado, sempre disponível (mesmo pra quem ainda
            // não é VIP) - a Edge Function é quem barra com uma
            // mensagem clara se a conta não for VIP ainda, em vez do
            // botão simplesmente não aparecer sem explicação nenhuma.
            const themeBtn = document.createElement("button");
            themeBtn.className = "btn btn-secondary";
            themeBtn.textContent = window.nodraTranslator?.translations?.["users.grantThemeBtn"] || "Create theme";
            themeBtn.addEventListener("click", () => openGrantThemePanel(user.id, user.username || user.id));
            actionCell.appendChild(themeBtn);

            const packBtn = document.createElement("button");
            packBtn.className = "btn btn-secondary";
            packBtn.textContent = window.nodraTranslator?.translations?.["users.grantPackBtn"] || "Create pack";
            packBtn.addEventListener("click", () => openGrantPackPanel(user.id, user.username || user.id));
            actionCell.appendChild(packBtn);

            tbody.appendChild(tr);
        }

    } catch (err) {
        console.error("Falha ao carregar usuários:", err);
    }

}

async function toggleVip(targetUserId, grant, tier) {
    try {
        await callAdminFunction("admin-grant-vip", {
            method: "POST",
            body: JSON.stringify({ targetUserId, grant, ...(grant ? { tier } : {}) }),
        });
        loadUsers(document.getElementById("users-search")?.value.trim() || "");
    } catch (err) {
        console.error("Falha ao conceder/revogar VIP:", err);
        alert(err.message);
    }
}

// ==================================================================
// CRIAR TEMA PRA OUTRA CONTA (admin-grant-theme)
//
// Pedido ao vivo: "em vez do usuário criar o tema, eu como admin
// crio um e jogo pra ele ter acesso como se fosse um tema simples
// criado por ele". Painel único (não um por linha da tabela) que
// aparece/some conforme o botão clicado, guardando o alvo atual em
// grantThemeTargetUserId - mesmo padrão de "um estado só, reaproveita
// os mesmos campos" que o resto do admin.js já usa.
// ==================================================================

const grantThemePanel = document.getElementById("admin-grant-theme-panel");
const grantThemeForm = document.getElementById("admin-grant-theme-form");
const grantThemeTargetNameEl = document.getElementById("admin-grant-theme-target-name");
const grantThemeStatus = document.getElementById("admin-grant-theme-status");
let grantThemeTargetUserId = null;

function openGrantThemePanel(targetUserId, targetUsername) {
    grantThemeTargetUserId = targetUserId;
    grantThemeTargetNameEl.textContent = targetUsername;
    grantThemeForm.reset();
    pendingGrantThemeLogoFile = null;
    adminThemePrimaryHex = "#3a7bd5";
    adminThemeBackgroundHex = "#0f1420";
    adminThemeColorOverrides = {};
    updateAdminThemePreview();
    grantThemeStatus.textContent = "";
    grantThemeStatus.className = "vip-badge-status";
    grantThemePanel.hidden = false;
    grantThemePanel.scrollIntoView({ behavior: "smooth", block: "center" });
}

function closeGrantThemePanel() {
    grantThemeTargetUserId = null;
    pendingGrantThemeLogoFile = null;
    grantThemePanel.hidden = true;
}

document.getElementById("admin-grant-theme-cancel")?.addEventListener("click", closeGrantThemePanel);

// ------------------------------------------------------------------
// Mesma matemática de derivação de cor do vip-create-theme/
// admin-grant-theme (HSL a partir de primary+background) - roda aqui
// no cliente só pra preview em tempo real. A fonte de verdade
// continua sendo a Edge Function, que recalcula do zero no servidor;
// isso aqui é só UX, pra pessoa ver o resultado antes de enviar.
// ------------------------------------------------------------------

function hexToRgbAdmin(hex) {
    const clean = hex.replace("#", "");
    const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
    const num = parseInt(full, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function rgbToHslAdmin(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    const d = max - min;
    if (d !== 0) {
        s = d / (1 - Math.abs(2 * l - 1));
        switch (max) {
            case r: h = ((g - b) / d) % 6; break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h *= 60;
        if (h < 0) h += 360;
    }
    return [h, s * 100, l * 100];
}

function hslToHexAdmin(h, s, l) {
    s = Math.max(0, Math.min(100, s)) / 100;
    l = Math.max(0, Math.min(100, l)) / 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; } else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
    const toHex = (v) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function clampAdmin(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

function deriveThemeColorsAdmin(primaryHex, backgroundHex) {
    const [pr, pg, pb] = hexToRgbAdmin(primaryHex);
    const [ph, ps] = rgbToHslAdmin(pr, pg, pb);
    const [br, bg, bb] = hexToRgbAdmin(backgroundHex);
    const [bh, bs, bl] = rgbToHslAdmin(br, bg, bb);
    const isDark = bl < 50;

    const primaryLight = hslToHexAdmin(ph, clampAdmin(ps + 5, 0, 100), clampAdmin(ps > 0 ? (isDark ? 62 : 55) : 70, 0, 92));
    const surface = hslToHexAdmin(bh, bs, clampAdmin(bl + (isDark ? 8 : -6), 0, 100));
    const text = isDark ? hslToHexAdmin(0, 0, 96) : hslToHexAdmin(0, 0, 12);
    const paperTint = Math.min(ps * 0.15, 12);
    const paper = hslToHexAdmin(ph, paperTint, 94);

    return { primary: primaryHex, primaryLight, background: backgroundHex, surface, text, paper };
}

// Estado das duas cores-base e das sobrescritas manuais - mesmo
// modelo do account.js (themePrimaryHex/themeBackgroundHex/
// themeColorOverrides): só entra em color_overrides o que a pessoa
// realmente clicou pra ajustar; o resto vem sempre do cálculo em
// cima das duas cores-base, recalculado a cada mudança nelas.
let adminThemePrimaryHex = "#3a7bd5";
let adminThemeBackgroundHex = "#0f1420";
let adminThemeColorOverrides = {};

function updateAdminThemePreview() {
    document.getElementById("admin-theme-primary-swatch").style.background = adminThemePrimaryHex;
    document.getElementById("admin-theme-primary-value").textContent = adminThemePrimaryHex;
    document.getElementById("admin-theme-background-swatch").style.background = adminThemeBackgroundHex;
    document.getElementById("admin-theme-background-value").textContent = adminThemeBackgroundHex;

    const derived = deriveThemeColorsAdmin(adminThemePrimaryHex, adminThemeBackgroundHex);
    const colors = { ...derived, ...adminThemeColorOverrides };

    ["primaryLight", "surface", "text", "paper"].forEach((key) => {
        const el = document.getElementById(`admin-theme-swatch-${key}`);
        if (el) el.style.background = colors[key];
    });

    return colors;
}

document.getElementById("admin-theme-primary-trigger")?.addEventListener("click", () => {
    openAdminColorPicker(adminThemePrimaryHex, (hex) => {
        adminThemePrimaryHex = hex;
        // Trocar a cor-base depois de já ter ajustado swatch
        // individual invalidaria essas sobrescritas de forma confusa
        // (mesma decisão do account.js) - mais simples e previsível
        // é limpar tudo e recalcular do zero.
        adminThemeColorOverrides = {};
        updateAdminThemePreview();
    });
});

document.getElementById("admin-theme-background-trigger")?.addEventListener("click", () => {
    openAdminColorPicker(adminThemeBackgroundHex, (hex) => {
        adminThemeBackgroundHex = hex;
        adminThemeColorOverrides = {};
        updateAdminThemePreview();
    });
});

// Clicar num swatch individual abre o mesmo seletor, só pra aquela
// cor específica.
document.querySelectorAll("#admin-theme-swatches .vip-theme-swatch-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
        const key = btn.dataset.colorKey;
        const currentColors = updateAdminThemePreview();
        openAdminColorPicker(currentColors[key], (hex) => {
            adminThemeColorOverrides[key] = hex;
            updateAdminThemePreview();
        });
    });
});

// ------------------------------------------------------------------
// SELETOR DE COR PRÓPRIO - idêntico ao de account.js (quadrado de
// saturação/luminosidade + barra de matiz + hex + paletas prontas).
// Não é o <input type="color"> nativo do navegador de propósito: ele
// tem uma ferramenta de "pegar cor de qualquer pixel da tela, até
// fora do site", achado invasivo. Um único popover compartilhado,
// reaproveitado pros três lugares que abrem seletor aqui (principal,
// fundo, swatch individual) - guarda qual callback chamar em
// onAdminPickerApply.
// ------------------------------------------------------------------

const ADMIN_PALETTE_COLORS = [
    "#1a2942", "#7c3aed", "#c084fc", "#ef4444", "#f59e0b",
    "#22c55e", "#0ea5e9", "#ec4899", "#64748b", "#0f172a",
];

function hsvToHexAdmin(h, s, v) {
    s /= 100; v /= 100;
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; } else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
    const toHex = (val) => Math.round((val + m) * 255).toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function normalizeHexInputAdmin(value) {
    let v = (value || "").trim();
    if (v && !v.startsWith("#")) v = `#${v}`;
    return v;
}

function hexToHsvAdmin(hex) {
    const clean = normalizeHexInputAdmin(hex).replace("#", "");
    const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
    const num = parseInt(full, 16) || 0;
    const r = ((num >> 16) & 255) / 255, g = ((num >> 8) & 255) / 255, b = (num & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0;
    if (d !== 0) {
        if (max === r) h = ((g - b) / d) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h *= 60;
        if (h < 0) h += 360;
    }
    const s = max === 0 ? 0 : (d / max) * 100;
    const v = max * 100;
    return { h, s, v };
}

const adminThemeColorPicker = document.getElementById("admin-theme-color-picker");
const adminThemePickerSv = document.getElementById("admin-theme-picker-sv");
const adminThemePickerSvCursor = document.getElementById("admin-theme-picker-sv-cursor");
const adminThemePickerHue = document.getElementById("admin-theme-picker-hue");
const adminThemePickerHueCursor = document.getElementById("admin-theme-picker-hue-cursor");
const adminThemePickerHex = document.getElementById("admin-theme-picker-hex");
const adminThemePickerPalette = document.getElementById("admin-theme-picker-palette");
const adminThemePickerDone = document.getElementById("admin-theme-picker-done");
const adminThemeColorPickerBackdrop = document.getElementById("admin-theme-color-picker-backdrop");

let adminPickerState = { h: 0, s: 0, v: 0 };
let onAdminPickerApply = null;

function adminPickerCurrentHex() {
    return hsvToHexAdmin(adminPickerState.h, adminPickerState.s, adminPickerState.v);
}

function renderAdminPickerCursors() {
    const svRect = adminThemePickerSv.getBoundingClientRect();
    adminThemePickerSvCursor.style.left = `${(adminPickerState.s / 100) * (svRect.width || 248)}px`;
    adminThemePickerSvCursor.style.top = `${(1 - adminPickerState.v / 100) * (svRect.height || 160)}px`;
    adminThemePickerHueCursor.style.left = `${(adminPickerState.h / 360) * (adminThemePickerHue.getBoundingClientRect().width || 248)}px`;
    adminThemePickerSv.style.background = `hsl(${adminPickerState.h}, 100%, 50%)`;
}

function renderAdminPickerHex() {
    adminThemePickerHex.value = adminPickerCurrentHex().replace("#", "").toUpperCase();
}

function renderAdminColorPalette() {
    adminThemePickerPalette.innerHTML = "";
    ADMIN_PALETTE_COLORS.forEach((color) => {
        const swatch = document.createElement("button");
        swatch.type = "button";
        swatch.className = "vip-color-swatch";
        swatch.style.background = color;
        swatch.setAttribute("aria-label", color);
        swatch.addEventListener("click", () => {
            adminPickerState = hexToHsvAdmin(color);
            renderAdminPickerCursors();
            renderAdminPickerHex();
        });
        adminThemePickerPalette.appendChild(swatch);
    });
}

function openAdminColorPicker(initialHex, onApply) {
    adminPickerState = hexToHsvAdmin(initialHex);
    onAdminPickerApply = onApply;
    adminThemeColorPicker.hidden = false;
    renderAdminPickerCursors();
    renderAdminPickerHex();
    renderAdminColorPalette();
}

function closeAdminColorPicker() {
    adminThemeColorPicker.hidden = true;
    onAdminPickerApply = null;
}

function setAdminPickerFromPointer(clientX, clientY) {
    const rect = adminThemePickerSv.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, clientY - rect.top));
    adminPickerState.s = (x / rect.width) * 100;
    adminPickerState.v = (1 - y / rect.height) * 100;
    renderAdminPickerCursors();
    renderAdminPickerHex();
}

function setAdminPickerHueFromPointer(clientX) {
    const rect = adminThemePickerHue.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    adminPickerState.h = (x / rect.width) * 360;
    renderAdminPickerCursors();
    renderAdminPickerHex();
}

function wireAdminDrag(el, onMove) {
    let dragging = false;
    const move = (e) => {
        if (!dragging) return;
        const point = e.touches ? e.touches[0] : e;
        onMove(point.clientX, point.clientY);
    };
    const start = (e) => {
        dragging = true;
        move(e);
    };
    const stop = () => { dragging = false; };

    el.addEventListener("mousedown", start);
    el.addEventListener("touchstart", start, { passive: true });
    window.addEventListener("mousemove", move);
    window.addEventListener("touchmove", move, { passive: true });
    window.addEventListener("mouseup", stop);
    window.addEventListener("touchend", stop);
}

wireAdminDrag(adminThemePickerSv, (x, y) => setAdminPickerFromPointer(x, y));
wireAdminDrag(adminThemePickerHue, (x) => setAdminPickerHueFromPointer(x));

adminThemePickerHex?.addEventListener("input", () => {
    const value = normalizeHexInputAdmin(`#${adminThemePickerHex.value}`);
    if (/^#[0-9a-fA-F]{6}$/.test(value)) {
        adminPickerState = hexToHsvAdmin(value);
        renderAdminPickerCursors();
    }
});

adminThemePickerDone?.addEventListener("click", () => {
    const hex = adminPickerCurrentHex();
    if (onAdminPickerApply) onAdminPickerApply(hex);
    closeAdminColorPicker();
});

adminThemeColorPickerBackdrop?.addEventListener("click", closeAdminColorPicker);
document.getElementById("admin-theme-picker-close-btn")?.addEventListener("click", closeAdminColorPicker);

let pendingGrantThemeLogoFile = null;

document.getElementById("admin-grant-theme-logo")?.addEventListener("change", (event) => {
    pendingGrantThemeLogoFile = event.target.files?.[0] || null;
});

// Lê o arquivo escolhido como base64, pra mandar dentro do corpo JSON
// da requisição - o upload em si acontece DENTRO da Edge Function
// (service role, ignora RLS do bucket), não aqui no navegador. Bucket
// theme-logos provavelmente só deixa cada pessoa subir arquivo com o
// próprio ID no nome (mesmo padrão de outros buckets do projeto);
// admin tentando subir em nome de outra conta direto do navegador
// provavelmente seria barrado por essa RLS.
function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result;
            // "data:image/png;base64,AAAA..." - só a parte depois da vírgula
            resolve(result.split(",")[1] || "");
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

grantThemeForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!grantThemeTargetUserId) return;

    const applicableGames = [...document.querySelectorAll(".admin-grant-theme-game-check:checked")].map(
        (cb) => cb.value,
    );

    if (applicableGames.length === 0) {
        grantThemeStatus.textContent =
            window.nodraTranslator?.translations?.["vip.themeGamesLabel"] || "Choose at least one game";
        grantThemeStatus.className = "vip-badge-status is-error";
        return;
    }

    const submitBtn = grantThemeForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    grantThemeStatus.textContent = "";
    grantThemeStatus.className = "vip-badge-status";

    try {
        let logoBase64 = null;
        let logoExt = null;
        if (pendingGrantThemeLogoFile) {
            logoBase64 = await readFileAsBase64(pendingGrantThemeLogoFile);
            logoExt = pendingGrantThemeLogoFile.name.split(".").pop() || "png";
        }

        const result = await callAdminFunction("admin-grant-theme", {
            method: "POST",
            body: JSON.stringify({
                target_user_id: grantThemeTargetUserId,
                name: document.getElementById("admin-grant-theme-name").value.trim(),
                primary_color: adminThemePrimaryHex,
                background_color: adminThemeBackgroundHex,
                color_overrides: adminThemeColorOverrides,
                logo_base64: logoBase64,
                logo_ext: logoExt,
                slogan_pt: document.getElementById("admin-grant-theme-slogan-pt").value.trim() || null,
                slogan_en: document.getElementById("admin-grant-theme-slogan-en").value.trim() || null,
                applicable_games: applicableGames,
            }),
        });

        if (result.error) throw new Error(result.error);

        grantThemeStatus.textContent =
            window.nodraTranslator?.translations?.["users.grantThemeSuccess"] || "Theme created and granted!";
        grantThemeStatus.className = "vip-badge-status is-success";
        setTimeout(closeGrantThemePanel, 1200);
    } catch (err) {
        console.error("Falha ao conceder tema:", err);
        grantThemeStatus.textContent = err.message;
        grantThemeStatus.className = "vip-badge-status is-error";
    } finally {
        submitBtn.disabled = false;
    }
});

// ==================================================================
// CRIAR PACOTE DE PERGUNTAS PRA OUTRA CONTA (admin-grant-pack)
//
// Mesmo padrão do painel de tema acima. O parser de texto em lote
// (PERGUNTA/RESPOSTAS/CORRETA) é o mesmo que account.js usa - copiado
// aqui porque essa tela é self-contained, sem importar de outro
// arquivo.
// ==================================================================

const grantPackPanel = document.getElementById("admin-grant-pack-panel");
const grantPackForm = document.getElementById("admin-grant-pack-form");
const grantPackTargetNameEl = document.getElementById("admin-grant-pack-target-name");
const grantPackStatus = document.getElementById("admin-grant-pack-status");
let grantPackTargetUserId = null;

function openGrantPackPanel(targetUserId, targetUsername) {
    grantPackTargetUserId = targetUserId;
    grantPackTargetNameEl.textContent = targetUsername;
    grantPackForm.reset();
    document.getElementById("admin-grant-pack-game-showdown").checked = true;
    document.getElementById("admin-grant-pack-questdrop-note").hidden = true;
    grantPackStatus.textContent = "";
    grantPackStatus.className = "vip-badge-status";
    grantPackPanel.hidden = false;
    grantPackPanel.scrollIntoView({ behavior: "smooth", block: "center" });
}

function closeGrantPackPanel() {
    grantPackTargetUserId = null;
    grantPackPanel.hidden = true;
}

document.getElementById("admin-grant-pack-cancel")?.addEventListener("click", closeGrantPackPanel);

document.getElementById("admin-grant-pack-game-questdrop")?.addEventListener("change", (event) => {
    document.getElementById("admin-grant-pack-questdrop-note").hidden = !event.target.checked;
});

// Parser idêntico ao parseFlatBulkQuestions de account.js - ver o
// comentário lá pra entender as regras (DIFICULDADE opcional com ou
// sem acento, RESPOSTAS separado por ";", CORRETA de 1 a 4).
function parseFlatBulkQuestionsAdmin(text) {
    const blocks = text.split(/\n\s*---\s*\n/).map((b) => b.trim()).filter(Boolean);
    const parsed = [];
    const errors = [];

    const difficultyAliases = {
        facil: "easy", "fácil": "easy", easy: "easy",
        medio: "medium", "médio": "medium", medium: "medium",
        dificil: "hard", "difícil": "hard", hard: "hard",
    };

    blocks.forEach((block, i) => {
        const label = `Pergunta ${i + 1}`;
        const data = {};
        block.split("\n").forEach((line) => {
            const match = line.match(/^([^:]+):\s*(.+)$/);
            if (match) data[match[1].trim().toUpperCase()] = match[2].trim();
        });

        const questionText = data["PERGUNTA"];
        if (!questionText) {
            errors.push(`${label}: faltou PERGUNTA.`);
            return;
        }
        const answersRaw = data["RESPOSTAS"];
        if (!answersRaw) {
            errors.push(`${label}: faltou RESPOSTAS.`);
            return;
        }
        const answers = answersRaw.split(";").map((a) => a.trim()).filter(Boolean);
        if (answers.length !== 4) {
            errors.push(`${label}: precisa ter exatamente 4 respostas separadas por ";" (encontrei ${answers.length}).`);
            return;
        }
        const correctRaw = Number(data["CORRETA"]);
        if (!correctRaw || correctRaw < 1 || correctRaw > 4) {
            errors.push(`${label}: CORRETA precisa ser um número de 1 a 4.`);
            return;
        }

        const difficultyRaw = (data["DIFICULDADE"] || "").toLowerCase();
        const difficulty = difficultyAliases[difficultyRaw] || null;

        parsed.push({
            question: { pt: questionText, en: questionText },
            answers: { pt: answers, en: answers },
            correct: correctRaw - 1,
            ...(difficulty ? { difficulty } : {}),
        });
    });

    return { parsed, errors };
}

grantPackForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!grantPackTargetUserId) return;

    grantPackStatus.textContent = "";
    grantPackStatus.className = "vip-badge-status";

    const games = [];
    if (document.getElementById("admin-grant-pack-game-showdown").checked) games.push("show-down");
    if (document.getElementById("admin-grant-pack-game-timeattack").checked) games.push("time-attack");
    if (document.getElementById("admin-grant-pack-game-questdrop").checked) games.push("quest-drop");

    if (games.length === 0) {
        grantPackStatus.textContent =
            window.nodraTranslator?.translations?.["vip.newPackGameRequired"] || "Pick at least one game.";
        grantPackStatus.className = "vip-badge-status is-error";
        return;
    }

    const name = document.getElementById("admin-grant-pack-name").value.trim();
    if (!name) {
        grantPackStatus.textContent =
            window.nodraTranslator?.translations?.["vip.newPackNameRequired"] || "Give the pack a name.";
        grantPackStatus.className = "vip-badge-status is-error";
        return;
    }

    const bulkText = document.getElementById("admin-grant-pack-bulk-textarea").value;
    const { parsed, errors } = parseFlatBulkQuestionsAdmin(bulkText);

    if (errors.length > 0) {
        grantPackStatus.textContent = errors.join(" ");
        grantPackStatus.className = "vip-badge-status is-error";
        return;
    }
    if (parsed.length === 0) {
        grantPackStatus.textContent =
            window.nodraTranslator?.translations?.["vip.newPackNoQuestions"] || "Add at least one question.";
        grantPackStatus.className = "vip-badge-status is-error";
        return;
    }

    const submitBtn = grantPackForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
        const result = await callAdminFunction("admin-grant-pack", {
            method: "POST",
            body: JSON.stringify({
                target_user_id: grantPackTargetUserId,
                games,
                name,
                questions: parsed,
            }),
        });

        if (result.error) throw new Error(result.error);

        grantPackStatus.textContent =
            window.nodraTranslator?.translations?.["users.grantPackSuccess"] || "Pack created and granted!";
        grantPackStatus.className = "vip-badge-status is-success";
        setTimeout(closeGrantPackPanel, 1200);
    } catch (err) {
        console.error("Falha ao conceder pacote:", err);
        grantPackStatus.textContent = err.message;
        grantPackStatus.className = "vip-badge-status is-error";
    } finally {
        submitBtn.disabled = false;
    }
});

// ==================================================================
// ANALYTICS
// ==================================================================

async function loadAnalytics() {

    try {

        const stats = await callAdminFunction("admin-analytics");

        document.getElementById("stat-total-users").textContent = stats.totalUsers;
        document.getElementById("stat-total-rooms").textContent = stats.totalRooms;
        document.getElementById("stat-match-history").textContent = stats.matchHistoryCount;

        const activePlayersEl = document.getElementById("stat-active-players");
        const activePlayersCard = document.getElementById("stat-active-players-card");
        activePlayersEl.textContent = stats.activePlayersCount;
        // Aviso aos 350 (70% do teto), vermelho aos 420 (bloqueio de
        // verdade nos jogos) - reportado ao vivo: "vamos implementar
        // sim, isso é super importante".
        activePlayersCard.style.borderColor = stats.activePlayersCount >= 420
            ? "#ff5e7a"
            : stats.activePlayersCount >= 350
                ? "#ffc857"
                : "";

        document.getElementById("stat-active-vips").textContent = stats.activeVips;
        document.getElementById("stat-active-vips-bronze").textContent = stats.activeVipsBronze;
        document.getElementById("stat-active-vips-prata").textContent = stats.activeVipsPrata;
        document.getElementById("stat-active-vips-gold").textContent = stats.activeVipsGold;
        document.getElementById("stat-vips-purchased").textContent = stats.vipsPurchasedCount;
        document.getElementById("stat-vips-purchased-bronze").textContent = stats.vipsPurchasedBronze;
        document.getElementById("stat-vips-purchased-prata").textContent = stats.vipsPurchasedPrata;
        document.getElementById("stat-vips-purchased-gold").textContent = stats.vipsPurchasedGold;
        document.getElementById("stat-vip-codes-redeemed").textContent = stats.vipCodesRedeemedCount;

        document.getElementById("stat-badges-created").textContent = stats.badgesCreatedCount;
        document.getElementById("stat-badges-granted").textContent = stats.badgesGrantedCount;
        document.getElementById("stat-academy-graduates").textContent = stats.academyGraduatesCount;
        document.getElementById("stat-badges-minted").textContent = stats.badgesMintedOnchain;

        document.getElementById("stat-public-themes").textContent = stats.publicThemesCount;
        document.getElementById("stat-private-themes").textContent = stats.privateThemesCount;
        document.getElementById("stat-pending-themes").textContent = stats.pendingThemesCount;

        document.getElementById("stat-private-packs").textContent = stats.privatePacksCount;
        document.getElementById("stat-approved-packs").textContent = stats.approvedPacksCount;
        document.getElementById("stat-pending-packs").textContent = stats.pendingPacksCount;

        document.getElementById("stat-tickets-open").textContent = stats.supportTicketsOpenCount;
        document.getElementById("stat-tickets-closed").textContent = stats.supportTicketsClosedCount;

        const generatedLabel = window.nodraTranslator?.translations?.["analytics.generatedAt"] || "Report generated:";
        document.getElementById("analytics-generated-at").textContent =
            `${generatedLabel} ${formatDate(stats.generatedAt)}`;

        renderSignupsChart(stats.signupsByDay);

    } catch (err) {
        console.error("Falha ao carregar analytics:", err);
    }

}

document.getElementById("analytics-refresh-btn")?.addEventListener("click", loadAnalytics);

// Exportar relatório - reportado ao vivo: "uma forma simples de
// salvar como pdf ou algo fácil de usar como provas". Em vez de
// gerar PDF por biblioteca (mais uma dependência, mais peso, mais
// chance de formatar estranho), usa o "Imprimir" nativo do
// navegador - todo navegador já sabe salvar isso como PDF sozinho, e
// o CSS de impressão (ver admin.css, @media print) esconde a navbar
// e as abas, deixando só o relatório limpo.
document.getElementById("analytics-export-btn")?.addEventListener("click", () => {
    window.print();
});

function renderSignupsChart(signupsByDay) {

    const container = document.getElementById("signups-chart");
    container.innerHTML = "";

    const days = [];
    for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push(d.toISOString().slice(0, 10));
    }

    const maxCount = Math.max(1, ...days.map((day) => signupsByDay[day] || 0));

    for (const day of days) {
        const count = signupsByDay[day] || 0;
        const bar = document.createElement("div");
        bar.className = "admin-bar";
        bar.style.height = `${(count / maxCount) * 100}%`;
        bar.dataset.tooltip = `${day}: ${count}`;
        container.appendChild(bar);
    }

}

// ==================================================================
// HELPERS
// ==================================================================

function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
}

function formatDate(isoString) {
    if (!isoString) return "-";
    return new Date(isoString).toLocaleDateString(document.documentElement.dataset.lang === "pt" ? "pt-BR" : "en-US");
}

// --------------------------------------------------------
// Código de convite pra VIP - gera um código compartilhável por
// fora, que qualquer pessoa logada resgata sozinha depois (Edge
// Function redeem-vip-code). Diferente do botão VIP na tabela de
// usuários (que liga/desliga direto numa conta específica).
// --------------------------------------------------------

document.getElementById("generate-vip-code-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const resultEl = document.getElementById("vip-code-result");
    resultEl.textContent = "...";

    const tier = document.getElementById("vip-code-tier").value;
    const vipDays = Number(document.getElementById("vip-code-days").value) || 30;
    const maxUses = Number(document.getElementById("vip-code-max-uses").value) || 1;
    const expiresInDaysRaw = document.getElementById("vip-code-expires-in").value;
    const expiresInDays = expiresInDaysRaw ? Number(expiresInDaysRaw) : undefined;
    const note = document.getElementById("vip-code-note").value.trim() || undefined;

    try {
        const result = await callAdminFunction("admin-generate-vip-code", {
            method: "POST",
            body: JSON.stringify({ tier, vipDays, maxUses, expiresInDays, note }),
        });

        resultEl.textContent = `${result.code} (${result.vipDays} dias, ${result.maxUses} uso${result.maxUses > 1 ? "s" : ""})`;
        loadVipActivity(); // recarrega as duas tabelas, o código novo já aparece na lista
    } catch (err) {
        console.error("Erro ao gerar código de VIP:", err);
        resultEl.textContent = "Erro ao gerar - confere o console.";
    }
});

// --------------------------------------------------------
// Histórico de ativações de VIP e de códigos - pagamento e código
// misturados numa lista só (mais recente primeiro), e todo código já
// gerado com quem resgatou, quantos usos restam.
// --------------------------------------------------------

const METHOD_LABELS = { payment: "Pagamento VIP", code: "Código", theme_payment: "Pagamento de Tema" };

async function loadVipActivity() {

    const activationsBody = document.getElementById("vip-activations-tbody");
    const activationsEmpty = document.getElementById("vip-activations-empty");
    const codesBody = document.getElementById("vip-codes-tbody");
    const codesEmpty = document.getElementById("vip-codes-empty");
    if (!activationsBody || !codesBody) return;

    try {
        const { activations, codes } = await callAdminFunction("admin-list-vip-activity", { method: "GET" });

        activationsBody.innerHTML = "";
        if (!activations || activations.length === 0) {
            activationsEmpty.hidden = false;
        } else {
            activationsEmpty.hidden = true;
            const tierLabels = { bronze: "Bronze", prata: "Prata", gold: "Gold" };
            activations.forEach((a) => {
                const tr = document.createElement("tr");
                const shortHash = a.txHash ? `${a.txHash.slice(0, 10)}...${a.txHash.slice(-6)}` : "-";
                tr.innerHTML = `
                    <td>${escapeHtml(a.username)}</td>
                    <td>${METHOD_LABELS[a.method] || a.method}</td>
                    <td>${a.tier ? (tierLabels[a.tier] || escapeHtml(a.tier)) : "-"}</td>
                    <td>${escapeHtml(a.detail)}</td>
                    <td></td>
                    <td>${escapeHtml(a.network || "-")}</td>
                    <td>${formatDate(a.date)}</td>
                `;

                // Hash completo pra copiar, não só truncado no hover -
                // reportado ao vivo: "não mostra inteira, então não
                // dá pra traquear" (não dá pra colar o hash inteiro
                // num explorador de blocos só com o hover).
                const hashCell = tr.children[4];
                if (a.txHash) {
                    const hashBtn = document.createElement("button");
                    hashBtn.type = "button";
                    hashBtn.className = "admin-hash-copy-btn";
                    hashBtn.textContent = shortHash;
                    hashBtn.title = a.txHash;
                    hashBtn.addEventListener("click", async () => {
                        try {
                            await navigator.clipboard.writeText(a.txHash);
                            const original = hashBtn.textContent;
                            hashBtn.textContent = "Copiado!";
                            setTimeout(() => { hashBtn.textContent = original; }, 1200);
                        } catch (err) {
                            console.error("Erro ao copiar hash:", err);
                        }
                    });
                    hashCell.appendChild(hashBtn);
                } else {
                    hashCell.textContent = "-";
                }

                activationsBody.appendChild(tr);
            });
        }

        codesBody.innerHTML = "";
        if (!codes || codes.length === 0) {
            codesEmpty.hidden = false;
        } else {
            codesEmpty.hidden = true;
            codes.forEach((c) => {
                const usesLeft = c.maxUses - c.usesCount;
                const usesLabel = `${c.usesCount}/${c.maxUses}${usesLeft > 0 ? "" : " (esgotado)"}${c.paused ? " (pausado)" : ""}`;
                const redeemedByLabel = c.redeemedBy.length > 0 ? c.redeemedBy.map(escapeHtml).join(", ") : "-";

                const tierLabels = { bronze: "Bronze", prata: "Prata", gold: "Gold" };
                const tr = document.createElement("tr");
                if (c.paused) tr.style.opacity = "0.5";

                tr.innerHTML = `
                    <td style="font-family:monospace;">${escapeHtml(c.code)}</td>
                    <td>${tierLabels[c.tier] || "Bronze"}</td>
                    <td>${usesLabel}</td>
                    <td>${redeemedByLabel}</td>
                    <td>${c.expiresAt ? formatDate(c.expiresAt) : "-"}</td>
                    <td>${formatDate(c.createdAt)}</td>
                `;

                const actionsTd = document.createElement("td");
                actionsTd.style.display = "flex";
                actionsTd.style.gap = "6px";

                const pauseBtn = document.createElement("button");
                pauseBtn.type = "button";
                pauseBtn.className = "btn btn-secondary";
                pauseBtn.style.padding = "4px 10px";
                pauseBtn.style.fontSize = "12px";
                pauseBtn.textContent = c.paused ? "Resume" : "Pause";
                pauseBtn.addEventListener("click", () =>
                    manageVipCode(c.id, c.paused ? "resume" : "pause"),
                );

                const deleteBtn = document.createElement("button");
                deleteBtn.type = "button";
                deleteBtn.className = "btn btn-secondary";
                deleteBtn.style.padding = "4px 10px";
                deleteBtn.style.fontSize = "12px";
                deleteBtn.style.borderColor = "#b5544a";
                deleteBtn.style.color = "#e08a80";
                deleteBtn.textContent = "Delete";
                deleteBtn.addEventListener("click", () => manageVipCode(c.id, "delete", c.code));

                actionsTd.appendChild(pauseBtn);
                actionsTd.appendChild(deleteBtn);
                tr.appendChild(actionsTd);

                codesBody.appendChild(tr);
            });
        }
    } catch (err) {
        console.error("Erro ao carregar atividade de VIP:", err);
    }

}

// Pausa/retoma/apaga um código de convite - pausar é reversível
// (só liga/desliga uma flag), apagar é definitivo (avisa antes).
async function manageVipCode(codeId, action, codeLabel) {
    if (action === "delete") {
        const ok = window.confirm(
            `Apagar o código "${codeLabel}"? Essa ação não pode ser desfeita. Quem já resgatou continua com o VIP, só o código em si deixa de existir.`,
        );
        if (!ok) return;
    }

    try {
        await callAdminFunction("admin-manage-vip-code", {
            method: "POST",
            body: JSON.stringify({ codeId, action }),
        });
        loadVipActivity();
    } catch (err) {
        console.error("Erro ao gerenciar código de VIP:", err);
        window.alert("Erro ao processar - confere o console.");
    }
}

document.getElementById("vip-activity-refresh-btn")?.addEventListener("click", loadVipActivity);
document.getElementById("users-refresh-btn")?.addEventListener("click", () => loadUsers());

// --------------------------------------------------------
// Badges - todo badge já criado (de qualquer VIP), quem tem cada um,
// e apagar daqui se precisar. Representação visual simples (não
// replica o sistema inteiro de escudo/ícone SVG da tela do VIP aqui)
// - essa tela é funcional, pra gestão rápida, não uma vitrine.
// --------------------------------------------------------

document.getElementById("badges-refresh-btn")?.addEventListener("click", loadAllBadges);

async function loadAllBadges() {

    const gridEl = document.getElementById("admin-badges-grid");
    const emptyEl = document.getElementById("admin-badges-empty");
    if (!gridEl || !emptyEl) return;

    try {
        const { badges } = await callAdminFunction("admin-list-all-badges", { method: "GET" });

        gridEl.innerHTML = "";
        if (!badges || badges.length === 0) {
            emptyEl.hidden = false;
            return;
        }
        emptyEl.hidden = true;

        badges.forEach((badge) => {
            const card = document.createElement("div");
            card.className = "admin-badge-card";

            const swatch = document.createElement("div");
            swatch.className = "admin-badge-swatch";
            if (badge.imageUrl) {
                const img = document.createElement("img");
                img.src = badge.imageUrl;
                img.alt = "";
                swatch.appendChild(img);
            } else {
                swatch.style.background = badge.backgroundColor || "#333";
                if (badge.icon) swatch.textContent = badge.icon.slice(0, 1).toUpperCase();
            }

            const name = document.createElement("div");
            name.className = "admin-badge-name";
            name.textContent = badge.namePt || badge.slug;

            const meta = document.createElement("div");
            meta.className = "admin-badge-meta";
            meta.textContent = `${escapeHtml(badge.createdBy)} . ${badge.source} . ${formatDate(badge.createdAt)}`;

            const holdersLabel = document.createElement("div");
            holdersLabel.className = "admin-badge-holders-label";
            holdersLabel.textContent = badge.holders.length > 0
                ? `${badge.holders.length} pessoa(s):`
                : "Ninguém tem esse badge ainda.";

            const holdersList = document.createElement("div");
            holdersList.className = "admin-badge-holders-list";
            badge.holders.forEach((holder) => {
                const chip = document.createElement("span");
                chip.className = "admin-badge-holder-chip";
                chip.textContent = holder.username;

                const removeBtn = document.createElement("button");
                removeBtn.type = "button";
                removeBtn.className = "admin-badge-holder-remove";
                removeBtn.textContent = "✕";
                removeBtn.title = "Remove this badge from this person";
                removeBtn.addEventListener("click", async () => {
                    if (!confirm(`Remove this badge from ${holder.username}? They can be granted it again later.`)) return;
                    try {
                        await callAdminFunction("admin-revoke-badge", {
                            method: "POST",
                            body: JSON.stringify({ badgeId: badge.id, userId: holder.userId }),
                        });
                        chip.remove();
                    } catch (err) {
                        console.error("Erro ao remover badge de usuário:", err);
                    }
                });

                chip.appendChild(removeBtn);
                holdersList.appendChild(chip);
            });

            const deleteBtn = document.createElement("button");
            deleteBtn.type = "button";
            deleteBtn.className = "btn btn-secondary admin-badge-delete-btn";
            deleteBtn.textContent = "Delete";
            deleteBtn.addEventListener("click", () => confirmDeleteBadge(badge, card));

            card.appendChild(swatch);
            card.appendChild(name);
            card.appendChild(meta);
            card.appendChild(holdersLabel);
            card.appendChild(holdersList);
            card.appendChild(deleteBtn);
            gridEl.appendChild(card);
        });
    } catch (err) {
        console.error("Erro ao carregar badges:", err);
    }

}

async function confirmDeleteBadge(badge, cardEl) {

    // Confirmação de verdade antes de apagar - ação destrutiva, e
    // pode afetar várias contas de uma vez (todo mundo que tinha
    // esse badge perde ele).
    const holderCount = badge.holders.length;
    const warningMsg =
        holderCount > 0
            ? `Apagar "${badge.namePt}"? ${holderCount} pessoa(s) vão perder esse badge. Essa ação não pode ser desfeita.`
            : `Apagar "${badge.namePt}"? Essa ação não pode ser desfeita.`;

    if (!window.confirm(warningMsg)) return;

    try {
        const result = await callAdminFunction("admin-delete-badge", {
            method: "POST",
            body: JSON.stringify({ badgeId: badge.id }),
        });
        console.log(`Badge apagado - ${result.holdersLost} concessão(ões) removida(s) junto.`);
        cardEl.remove();
    } catch (err) {
        console.error("Erro ao apagar badge:", err);
        window.alert("Erro ao apagar - confere o console.");
    }

}

// --------------------------------------------------------
// Pacotes enviados - reconstruído do zero. Reportado ao vivo: o
// desenho anterior (submitted_packs, sem vínculo de usuário) deixava
// QUALQUER VIP ver e aprovar o envio de qualquer pessoa, inclusive o
// próprio. Agora lê de vip_saved_packs com submission_status =
// 'pending' - só o admin acessa essa fila, nenhum VIP vê o envio de
// outra pessoa em lugar nenhum.
// --------------------------------------------------------

document.getElementById("packs-refresh-btn")?.addEventListener("click", loadSubmittedPacks);

async function loadSubmittedPacks() {

    const listEl = document.getElementById("admin-packs-list");
    const emptyEl = document.getElementById("admin-packs-empty");
    if (!listEl || !emptyEl) return;

    try {
        const { packs } = await callAdminFunction("admin-list-pack-submissions", { method: "GET" });

        listEl.innerHTML = "";
        if (!packs || packs.length === 0) {
            emptyEl.hidden = false;
            return;
        }
        emptyEl.hidden = true;

        packs.forEach((pack) => {
            const item = document.createElement("div");
            item.className = "admin-pack-item";

            const name = document.createElement("div");
            name.className = "admin-pack-name";
            name.textContent = pack.name;

            const meta = document.createElement("div");
            meta.className = "admin-pack-meta";
            const questionsLabel = window.nodraTranslator?.translations?.["packs.questionsLabel"] || "questions";
            meta.textContent = `${escapeHtml(pack.ownerUsername)} . ${escapeHtml((pack.games || []).join(", "))} . ${pack.questionCount} ${questionsLabel} . ${formatDate(pack.createdAt)}`;

            const detail = document.createElement("div");
            detail.className = "admin-pack-questions";
            detail.hidden = true;
            (pack.questions || []).forEach((q, i) => {
                const qEl = document.createElement("p");
                qEl.textContent = `${i + 1}. ${q.question?.pt || q.question?.en || ""}`;
                detail.appendChild(qEl);
            });

            const toggleBtn = document.createElement("button");
            toggleBtn.type = "button";
            toggleBtn.className = "btn btn-secondary";
            toggleBtn.textContent = window.nodraTranslator?.translations?.["packs.viewQuestionsBtn"] || "View questions";
            toggleBtn.addEventListener("click", () => { detail.hidden = !detail.hidden; });

            const actions = document.createElement("div");
            actions.className = "admin-pack-actions";

            const approveBtn = document.createElement("button");
            approveBtn.type = "button";
            approveBtn.className = "btn btn-primary";
            approveBtn.textContent = window.nodraTranslator?.translations?.["packs.approveBtn"] || "Approve";
            approveBtn.addEventListener("click", () => reviewSubmittedPack(pack.id, "approve", item));

            const rejectBtn = document.createElement("button");
            rejectBtn.type = "button";
            rejectBtn.className = "btn btn-secondary";
            rejectBtn.textContent = window.nodraTranslator?.translations?.["packs.rejectBtn"] || "Reject";
            rejectBtn.addEventListener("click", () => reviewSubmittedPack(pack.id, "reject", item));

            actions.appendChild(toggleBtn);
            actions.appendChild(approveBtn);
            actions.appendChild(rejectBtn);

            const status = document.createElement("p");
            status.className = "admin-pack-status";

            item.appendChild(name);
            item.appendChild(meta);
            item.appendChild(actions);
            item.appendChild(status);
            item.appendChild(detail);
            listEl.appendChild(item);
        });
    } catch (err) {
        console.error("Erro ao carregar pacotes enviados:", err);
    }

}

async function reviewSubmittedPack(packId, action, itemEl) {
    const buttons = itemEl.querySelectorAll("button");
    const statusEl = itemEl.querySelector(".admin-pack-status");

    let reason = null;
    if (action === "reject") {
        reason = prompt(window.nodraTranslator?.translations?.["packs.rejectReasonPrompt"] || "Reason for rejecting (shown to the person who submitted it):") || null;
    }

    buttons.forEach((b) => (b.disabled = true));
    statusEl.textContent = "";
    statusEl.className = "admin-pack-status";

    try {
        await callAdminFunction("admin-review-pack-submission", {
            method: "POST",
            body: JSON.stringify({ packId, action, reason }),
        });

        const successKey = action === "approve" ? "packs.approveSuccess" : "packs.rejectSuccess";
        const fallback = action === "approve" ? "Approved! Pack is now live." : "Rejected.";
        statusEl.textContent = window.nodraTranslator?.translations?.[successKey] || fallback;
        statusEl.className = "admin-pack-status is-success";

        setTimeout(() => itemEl.remove(), 1800);
    } catch (err) {
        console.error("Erro ao revisar pacote enviado:", err);
        statusEl.textContent = err.message || "Erro ao processar";
        statusEl.className = "admin-pack-status is-error";
        buttons.forEach((b) => (b.disabled = false));
    }

}

document.getElementById("themes-refresh-btn")?.addEventListener("click", loadSubmittedThemes);

async function loadSubmittedThemes() {

    const listEl = document.getElementById("admin-themes-list");
    const emptyEl = document.getElementById("admin-themes-empty");
    if (!listEl || !emptyEl) return;

    try {
        const { themes } = await callAdminFunction("admin-list-submitted-themes", { method: "GET" });

        listEl.innerHTML = "";
        if (!themes || themes.length === 0) {
            emptyEl.hidden = false;
            return;
        }
        emptyEl.hidden = true;

        const lang = document.documentElement.dataset.lang === "en" ? "en" : "pt";

        themes.forEach((theme) => {
            const item = document.createElement("div");
            item.className = "admin-pack-item";

            const header = document.createElement("div");
            header.style.display = "flex";
            header.style.alignItems = "center";
            header.style.gap = "8px";

            const swatch = document.createElement("span");
            swatch.style.cssText = `display:inline-block;width:16px;height:16px;border-radius:50%;background:${theme.colors?.primary || "#888"};flex-shrink:0;`;

            const name = document.createElement("span");
            name.className = "admin-pack-name";
            name.textContent = theme.name;

            header.appendChild(swatch);
            header.appendChild(name);

            const meta = document.createElement("div");
            meta.className = "admin-pack-meta";
            const sloganText = lang === "en" ? theme.sloganEn : theme.sloganPt;
            meta.textContent = `${escapeHtml(theme.ownerUsername)} . ${(theme.applicableGames || []).join(", ")} . ${formatDate(theme.createdAt)}${sloganText ? ` . "${escapeHtml(sloganText)}"` : ""}`;

            if (theme.logoUrl) {
                const logoImg = document.createElement("img");
                logoImg.src = theme.logoUrl;
                logoImg.alt = "";
                logoImg.style.cssText = "height:28px;max-width:120px;object-fit:contain;margin-top:8px;display:block;";
                item.appendChild(header);
                item.appendChild(meta);
                item.appendChild(logoImg);
            } else {
                item.appendChild(header);
                item.appendChild(meta);
            }

            const notesInput = document.createElement("textarea");
            notesInput.placeholder =
                window.nodraTranslator?.translations?.["themes.rejectNotesPlaceholder"] ||
                "Reason (required to reject)";
            notesInput.className = "admin-pack-meta";
            notesInput.style.cssText = "width:100%;margin-top:10px;min-height:50px;font-family:inherit;padding:6px;border-radius:6px;";

            const actions = document.createElement("div");
            actions.className = "admin-pack-actions";

            const approveBtn = document.createElement("button");
            approveBtn.type = "button";
            approveBtn.className = "btn btn-primary";
            approveBtn.textContent = window.nodraTranslator?.translations?.["packs.approveBtn"] || "Approve";
            approveBtn.addEventListener("click", () => reviewSubmittedTheme(theme.id, "approve", item, notesInput));

            const rejectBtn = document.createElement("button");
            rejectBtn.type = "button";
            rejectBtn.className = "btn btn-secondary";
            rejectBtn.textContent = window.nodraTranslator?.translations?.["packs.rejectBtn"] || "Reject";
            rejectBtn.addEventListener("click", () => reviewSubmittedTheme(theme.id, "reject", item, notesInput));

            actions.appendChild(approveBtn);
            actions.appendChild(rejectBtn);

            const status = document.createElement("p");
            status.className = "admin-pack-status";

            item.appendChild(notesInput);
            item.appendChild(actions);
            item.appendChild(status);
            listEl.appendChild(item);
        });
    } catch (err) {
        console.error("Erro ao carregar temas enviados:", err);
    }

}

// ==================================================================
// SUB-ABAS — Pacotes e Temas agora têm duas visões: a fila de
// submissão pública (já existia) e a lista completa (privado +
// público) com botão de apagar. Reportado ao vivo: "adiciona uma
// função pra eu poder ver os pacotes privados dos VIPs também...
// e também poder deletar os que estão como públicos".
// ==================================================================

let vipPacksLoaded = false;
let catalogPacksLoaded = false;
let allThemesLoaded = false;

document.querySelectorAll("[data-packs-subtab]").forEach((btn) => {
    btn.addEventListener("click", () => {
        const target = btn.dataset.packsSubtab;
        document.querySelectorAll("[data-packs-subtab]").forEach((b) => b.classList.toggle("is-active", b === btn));
        document.querySelectorAll("[data-packs-subtab-panel]").forEach((p) => {
            p.hidden = p.dataset.packsSubtabPanel !== target;
        });
        if (target === "vip" && !vipPacksLoaded) {
            vipPacksLoaded = true;
            loadVipPacks();
        }
        if (target === "catalog" && !catalogPacksLoaded) {
            catalogPacksLoaded = true;
            loadCatalogPacks();
        }
    });
});

document.querySelectorAll("[data-themes-subtab]").forEach((btn) => {
    btn.addEventListener("click", () => {
        const target = btn.dataset.themesSubtab;
        document.querySelectorAll("[data-themes-subtab]").forEach((b) => b.classList.toggle("is-active", b === btn));
        document.querySelectorAll("[data-themes-subtab-panel]").forEach((p) => {
            p.hidden = p.dataset.themesSubtabPanel !== target;
        });
        if (target === "all" && !allThemesLoaded) {
            allThemesLoaded = true;
            loadAllThemes();
        }
    });
});

document.getElementById("vip-packs-refresh-btn")?.addEventListener("click", loadVipPacks);
document.getElementById("all-themes-refresh-btn")?.addEventListener("click", loadAllThemes);

// --------------------------------------------------------
// Pacotes salvos de VIP - listar e apagar
// --------------------------------------------------------

async function loadVipPacks() {

    const listEl = document.getElementById("admin-vip-packs-list");
    const emptyEl = document.getElementById("admin-vip-packs-empty");
    if (!listEl || !emptyEl) return;

    try {
        const { packs } = await callAdminFunction("admin-list-vip-packs", { method: "GET" });

        listEl.innerHTML = "";
        if (!packs || packs.length === 0) {
            emptyEl.hidden = false;
            return;
        }
        emptyEl.hidden = true;

        const questionsLabel = window.nodraTranslator?.translations?.["packs.questionsLabel"] || "questions";
        const deleteLabel = window.nodraTranslator?.translations?.["packs.deleteBtn"] || "Delete";
        const deleteConfirmMsg = window.nodraTranslator?.translations?.["packs.deleteConfirm"] || "Delete this pack? This can't be undone.";

        packs.forEach((pack) => {
            const item = document.createElement("div");
            item.className = "admin-pack-item";

            const name = document.createElement("div");
            name.className = "admin-pack-name";
            name.textContent = pack.name;

            const meta = document.createElement("div");
            meta.className = "admin-pack-meta";
            meta.textContent = `${escapeHtml(pack.ownerUsername)} . ${escapeHtml((pack.games || []).join(", "))} . ${pack.questionCount} ${questionsLabel} . ${formatDate(pack.createdAt)}`;

            // Perguntas de verdade, escondidas até clicar - reportado
            // ao vivo: "as perguntas não aparecem", só mostrava a
            // contagem antes, nunca o conteúdo.
            const detail = document.createElement("div");
            detail.className = "admin-pack-questions";
            detail.hidden = true;
            (pack.questions || []).forEach((q, i) => {
                const qEl = document.createElement("p");
                qEl.textContent = `${i + 1}. ${q.question?.pt || q.question?.en || ""}`;
                detail.appendChild(qEl);
            });

            const toggleBtn = document.createElement("button");
            toggleBtn.type = "button";
            toggleBtn.className = "btn btn-secondary";
            const viewLabel = window.nodraTranslator?.translations?.["packs.viewQuestionsBtn"] || "View questions";
            toggleBtn.textContent = viewLabel;
            toggleBtn.addEventListener("click", () => {
                detail.hidden = !detail.hidden;
            });

            const actions = document.createElement("div");
            actions.className = "admin-pack-actions";

            const deleteBtn = document.createElement("button");
            deleteBtn.type = "button";
            deleteBtn.className = "btn btn-danger";
            deleteBtn.textContent = deleteLabel;
            deleteBtn.addEventListener("click", async () => {
                if (!confirm(deleteConfirmMsg)) return;
                deleteBtn.disabled = true;
                try {
                    await callAdminFunction("admin-delete-vip-pack", {
                        method: "POST",
                        body: JSON.stringify({ id: pack.id }),
                    });
                    item.remove();
                    if (!listEl.children.length) emptyEl.hidden = false;
                } catch (err) {
                    console.error("Erro ao apagar pacote salvo de VIP:", err);
                    deleteBtn.disabled = false;
                }
            });

            actions.appendChild(toggleBtn);
            actions.appendChild(deleteBtn);

            item.appendChild(name);
            item.appendChild(meta);
            item.appendChild(actions);
            item.appendChild(detail);
            listEl.appendChild(item);
        });

    } catch (err) {
        console.error("Erro ao carregar pacotes salvos de VIP:", err);
    }

}

// --------------------------------------------------------
// Catálogo oficial (question_packs) - o que os jogos usam de
// verdade pra buscar pergunta. Reportado ao vivo: pacote aprovado
// (mesmo o auto-aprovado, antes da trava existir) some da fila de
// "Pacotes Enviados" assim que vira catálogo, sem lugar nenhum pra
// limpar depois - essa aba resolve isso.
// --------------------------------------------------------

async function loadCatalogPacks() {

    const listEl = document.getElementById("admin-catalog-packs-list");
    const emptyEl = document.getElementById("admin-catalog-packs-empty");
    if (!listEl || !emptyEl) return;

    try {
        const { packs } = await callAdminFunction("admin-list-question-packs", { method: "GET" });

        listEl.innerHTML = "";
        if (!packs || packs.length === 0) {
            emptyEl.hidden = false;
            return;
        }
        emptyEl.hidden = true;

        const questionsLabel = window.nodraTranslator?.translations?.["packs.questionsLabel"] || "questions";
        const deleteLabel = window.nodraTranslator?.translations?.["packs.deleteBtn"] || "Delete";
        const deleteConfirmMsg = window.nodraTranslator?.translations?.["packs.deleteCatalogConfirm"] || "Delete this pack from the catalog? Games will no longer be able to use it. This can't be undone.";

        packs.forEach((pack) => {
            const item = document.createElement("div");
            item.className = "admin-pack-item";

            const name = document.createElement("div");
            name.className = "admin-pack-name";
            name.textContent = pack.namePt;

            const meta = document.createElement("div");
            meta.className = "admin-pack-meta";
            meta.textContent = `${escapeHtml(pack.slug)} . ${(pack.applicableGames || []).join(", ")} . ${pack.questionCount} ${questionsLabel} . ${formatDate(pack.createdAt)}`;

            const actions = document.createElement("div");
            actions.className = "admin-pack-actions";

            const deleteBtn = document.createElement("button");
            deleteBtn.type = "button";
            deleteBtn.className = "btn btn-danger";
            deleteBtn.textContent = deleteLabel;
            deleteBtn.addEventListener("click", async () => {
                if (!confirm(deleteConfirmMsg)) return;
                deleteBtn.disabled = true;
                try {
                    await callAdminFunction("admin-delete-question-pack", {
                        method: "POST",
                        body: JSON.stringify({ packId: pack.id }),
                    });
                    item.remove();
                    if (!listEl.children.length) emptyEl.hidden = false;
                } catch (err) {
                    console.error("Erro ao apagar pacote do catálogo:", err);
                    deleteBtn.disabled = false;
                }
            });

            actions.appendChild(deleteBtn);

            item.appendChild(name);
            item.appendChild(meta);
            item.appendChild(actions);
            listEl.appendChild(item);
        });

    } catch (err) {
        console.error("Erro ao carregar catálogo de pacotes:", err);
    }

}

document.getElementById("catalog-packs-refresh-btn")?.addEventListener("click", loadCatalogPacks);

// --------------------------------------------------------
// Todos os temas (privado + público + rejeitado) - listar e apagar
// --------------------------------------------------------

async function loadAllThemes() {

    const listEl = document.getElementById("admin-all-themes-list");
    const emptyEl = document.getElementById("admin-all-themes-empty");
    if (!listEl || !emptyEl) return;

    try {
        const { themes } = await callAdminFunction("admin-list-all-themes", { method: "GET" });

        listEl.innerHTML = "";
        if (!themes || themes.length === 0) {
            emptyEl.hidden = false;
            return;
        }
        emptyEl.hidden = true;

        const deleteLabel = window.nodraTranslator?.translations?.["packs.deleteBtn"] || "Delete";
        const deleteConfirmMsg = window.nodraTranslator?.translations?.["themes.deleteConfirm"] || "Delete this theme? This can't be undone.";
        const statusLabels = {
            private: window.nodraTranslator?.translations?.["themes.statusPrivate"] || "Private",
            pending_review: window.nodraTranslator?.translations?.["themes.statusPending"] || "Pending review",
            public: window.nodraTranslator?.translations?.["themes.statusPublic"] || "Public",
            rejected: window.nodraTranslator?.translations?.["themes.statusRejected"] || "Rejected",
        };

        themes.forEach((theme) => {
            const item = document.createElement("div");
            item.className = "admin-pack-item";

            const name = document.createElement("div");
            name.className = "admin-pack-name";
            name.textContent = theme.name;

            const meta = document.createElement("div");
            meta.className = "admin-pack-meta";
            const statusLabel = statusLabels[theme.status] || theme.status;
            meta.textContent = `${escapeHtml(theme.ownerUsername)} . ${statusLabel} . ${(theme.applicableGames || []).join(", ")} . ${formatDate(theme.createdAt)}`;

            const actions = document.createElement("div");
            actions.className = "admin-pack-actions";

            const deleteBtn = document.createElement("button");
            deleteBtn.type = "button";
            deleteBtn.className = "btn btn-danger";
            deleteBtn.textContent = deleteLabel;
            deleteBtn.addEventListener("click", async () => {
                if (!confirm(deleteConfirmMsg)) return;
                deleteBtn.disabled = true;
                try {
                    await callAdminFunction("admin-delete-theme", {
                        method: "POST",
                        body: JSON.stringify({ id: theme.id }),
                    });
                    item.remove();
                    if (!listEl.children.length) emptyEl.hidden = false;
                } catch (err) {
                    console.error("Erro ao apagar tema:", err);
                    deleteBtn.disabled = false;
                }
            });

            actions.appendChild(deleteBtn);

            item.appendChild(name);
            item.appendChild(meta);
            item.appendChild(actions);
            listEl.appendChild(item);
        });

    } catch (err) {
        console.error("Erro ao carregar todos os temas:", err);
    }

}

// Aprova (vira tema público de verdade, visível em qualquer sala
// contanto que o dono continue VIP) ou rejeita (some da fila, o VIP
// vê o motivo na própria área dele e pode corrigir e reenviar de
// graça) um tema submetido - mesmo padrão de reviewSubmittedPack.
async function reviewSubmittedTheme(themeId, action, itemEl, notesInput) {
    const buttons = itemEl.querySelectorAll("button");
    const statusEl = itemEl.querySelector(".admin-pack-status");

    if (action === "reject" && !notesInput.value.trim()) {
        statusEl.textContent =
            window.nodraTranslator?.translations?.["themes.rejectNotesRequired"] ||
            "A reason is required to reject.";
        statusEl.className = "admin-pack-status is-error";
        return;
    }

    buttons.forEach((b) => (b.disabled = true));
    statusEl.textContent = "";
    statusEl.className = "admin-pack-status";

    try {
        await callAdminFunction("admin-review-submitted-theme", {
            method: "POST",
            body: JSON.stringify({ themeId, action, notes: notesInput.value.trim() || undefined }),
        });

        const successKey = action === "approve" ? "packs.approveSuccess" : "packs.rejectSuccess";
        const fallback = action === "approve" ? "Approved! Theme is now live." : "Rejected.";
        statusEl.textContent = window.nodraTranslator?.translations?.[successKey] || fallback;
        statusEl.className = "admin-pack-status is-success";

        setTimeout(() => itemEl.remove(), 1800);
    } catch (err) {
        console.error("Erro ao revisar tema enviado:", err);
        statusEl.textContent = err.message || "Erro ao processar";
        statusEl.className = "admin-pack-status is-error";
        buttons.forEach((b) => (b.disabled = false));
    }

}

// ==================================================================
// SUPORTE (admin) - lista todo ticket de todo usuário, abre a
// conversa e responde. Só o admin usa Edge Function pra isso - o
// usuário lê/escreve na própria conta direto via RLS (ver
// account.js), mas o admin precisa ver a conversa de todo mundo, o
// que RLS comum não permite sem uma policy especial - mais simples
// e consistente com o resto do painel passar por Edge Function
// (service role, ignora RLS).
// ==================================================================

let currentSupportAdminTicketId = null;
let supportAdminRealtimeChannel = null;

async function loadSupportAdminTickets() {
    const listEl = document.getElementById("admin-support-tickets-list");
    const emptyEl = document.getElementById("admin-support-tickets-empty");
    if (!listEl || !emptyEl) return;

    try {
        const { tickets } = await callAdminFunction("admin-list-support-tickets", { method: "GET" });

        listEl.innerHTML = "";

        if (!tickets || tickets.length === 0) {
            emptyEl.hidden = false;
            return;
        }
        emptyEl.hidden = true;

        tickets.forEach((ticket) => {
            const item = document.createElement("div");
            item.className = "admin-pack-item";
            item.style.cursor = "pointer";
            if (ticket.isPriority) item.style.borderLeft = "3px solid #ffc857";

            const name = document.createElement("div");
            name.className = "admin-pack-name";
            const priorityTag = ticket.isPriority ? "⭐ " : "";
            name.textContent = `${priorityTag}${ticket.subject} - ${ticket.username}`;

            const meta = document.createElement("div");
            meta.className = "admin-pack-meta";
            const preview = ticket.lastMessage ? `${ticket.lastMessageFrom === "admin" ? "You" : ticket.username}: ${ticket.lastMessage.slice(0, 60)}` : "";
            meta.textContent = `${ticket.status} . ${formatDate(ticket.updatedAt)} . ${preview}`;

            item.appendChild(name);
            item.appendChild(meta);
            item.addEventListener("click", () => openSupportAdminTicket(ticket.id));
            listEl.appendChild(item);
        });

    } catch (err) {
        console.error("Erro ao carregar tickets de suporte:", err);
    }
}

document.getElementById("support-refresh-btn")?.addEventListener("click", loadSupportAdminTickets);

function renderSupportAdminMessage(container, msg) {
    const bubble = document.createElement("div");
    bubble.className = `support-bubble support-bubble--${msg.sender_type}`;
    bubble.textContent = msg.message;
    container.appendChild(bubble);
}

async function openSupportAdminTicket(ticketId) {
    currentSupportAdminTicketId = ticketId;

    document.getElementById("support-admin-list-view").hidden = true;
    document.getElementById("support-admin-chat-view").hidden = false;

    const messagesEl = document.getElementById("support-admin-chat-messages");
    messagesEl.innerHTML = "";

    try {
        const { ticket, messages } = await callAdminFunction(`admin-get-support-ticket?ticketId=${ticketId}`, { method: "GET" });

        document.getElementById("support-admin-chat-subject").textContent = `${ticket.subject} - ${ticket.username}`;
        document.getElementById("support-admin-status-select").value = ticket.status;

        (messages || []).forEach((msg) => renderSupportAdminMessage(messagesEl, msg));
        messagesEl.scrollTop = messagesEl.scrollHeight;

    } catch (err) {
        console.error("Erro ao carregar conversa de suporte:", err);
        return;
    }

    if (supportAdminRealtimeChannel) {
        supabaseClient.removeChannel(supportAdminRealtimeChannel);
    }
    supportAdminRealtimeChannel = supabaseClient
        .channel(`support-admin-ticket-${ticketId}`)
        .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "support_messages", filter: `ticket_id=eq.${ticketId}` },
            (payload) => {
                if (payload.new.sender_type === "user") {
                    renderSupportAdminMessage(messagesEl, payload.new);
                    messagesEl.scrollTop = messagesEl.scrollHeight;
                }
            },
        )
        .subscribe();
}

document.getElementById("support-admin-back-btn")?.addEventListener("click", () => {
    document.getElementById("support-admin-chat-view").hidden = true;
    document.getElementById("support-admin-list-view").hidden = false;
    if (supportAdminRealtimeChannel) {
        supabaseClient.removeChannel(supportAdminRealtimeChannel);
        supportAdminRealtimeChannel = null;
    }
    currentSupportAdminTicketId = null;
    loadSupportAdminTickets();
});

document.getElementById("support-admin-reply-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentSupportAdminTicketId) return;

    const input = document.getElementById("support-admin-reply-input");
    const message = input.value.trim();
    if (!message) return;

    input.value = "";

    const messagesEl = document.getElementById("support-admin-chat-messages");
    renderSupportAdminMessage(messagesEl, { sender_type: "admin", message });
    messagesEl.scrollTop = messagesEl.scrollHeight;

    try {
        await callAdminFunction("admin-send-support-message", {
            method: "POST",
            body: JSON.stringify({ ticketId: currentSupportAdminTicketId, message }),
        });
    } catch (err) {
        console.error("Erro ao enviar resposta de suporte:", err);
    }
});

document.getElementById("support-admin-status-select")?.addEventListener("change", async (event) => {
    if (!currentSupportAdminTicketId) return;
    try {
        await callAdminFunction("admin-update-ticket-status", {
            method: "POST",
            body: JSON.stringify({ ticketId: currentSupportAdminTicketId, status: event.target.value }),
        });
    } catch (err) {
        console.error("Erro ao atualizar status do ticket:", err);
    }
});
