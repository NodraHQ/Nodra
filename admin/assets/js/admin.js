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
    const loaded = { rooms: true, users: false, badges: false, analytics: false };

    tabs.forEach((tab) => {
        tab.addEventListener("click", () => {

            const target = tab.dataset.tab;

            tabs.forEach((t) => t.classList.toggle("is-active", t === tab));
            panels.forEach((p) => p.classList.toggle("is-active", p.id === `tab-${target}`));

            if (!loaded[target]) {
                loaded[target] = true;
                if (target === "users") loadUsers();
                if (target === "badges") loadAllBadges();
                if (target === "analytics") loadAnalytics();
            }

        });
    });

}

// ==================================================================
// SALAS AO VIVO
// ==================================================================

document.getElementById("rooms-refresh-btn")?.addEventListener("click", loadRooms);

async function loadRooms() {

    const tbody = document.getElementById("rooms-tbody");
    const emptyEl = document.getElementById("rooms-empty");

    try {

        const { rooms } = await callAdminFunction("admin-list-rooms");

        tbody.innerHTML = "";
        emptyEl.hidden = rooms.length > 0;

        for (const room of rooms) {
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

    } catch (err) {
        console.error("Falha ao carregar salas:", err);
    }

}

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
            tr.innerHTML = `
                <td>${escapeHtml(user.username || "-")}</td>
                <td class="admin-wallet-cell">${escapeHtml(user.wallet_evm || "-")}</td>
                <td>${user.is_vip ? '<span class="admin-vip-badge">VIP</span>' : "-"}</td>
                <td>${formatDate(user.created_at)}</td>
                <td></td>
            `;
            const actionCell = tr.lastElementChild;
            const vipBtn = document.createElement("button");
            vipBtn.className = "btn btn-secondary";
            vipBtn.textContent = user.is_vip
                ? (window.nodraTranslator?.translations?.["users.revokeVip"] || "Revoke VIP")
                : (window.nodraTranslator?.translations?.["users.grantVip"] || "Grant VIP");
            vipBtn.addEventListener("click", () => toggleVip(user.id, !user.is_vip));
            actionCell.appendChild(vipBtn);
            tbody.appendChild(tr);
        }

    } catch (err) {
        console.error("Falha ao carregar usuários:", err);
    }

}

async function toggleVip(targetUserId, grant) {
    try {
        await callAdminFunction("admin-grant-vip", {
            method: "POST",
            body: JSON.stringify({ targetUserId, grant }),
        });
        loadUsers(document.getElementById("users-search")?.value.trim() || "");
    } catch (err) {
        console.error("Falha ao conceder/revogar VIP:", err);
        alert(err.message);
    }
}

// ==================================================================
// ANALYTICS
// ==================================================================

async function loadAnalytics() {

    try {

        const stats = await callAdminFunction("admin-analytics");

        document.getElementById("stat-total-users").textContent = stats.totalUsers;
        document.getElementById("stat-total-rooms").textContent = stats.totalRooms;
        document.getElementById("stat-badges-minted").textContent = stats.badgesMinted;

        renderSignupsChart(stats.signupsByDay);

    } catch (err) {
        console.error("Falha ao carregar analytics:", err);
    }

}

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

    const vipDays = Number(document.getElementById("vip-code-days").value) || 30;
    const maxUses = Number(document.getElementById("vip-code-max-uses").value) || 1;
    const expiresInDaysRaw = document.getElementById("vip-code-expires-in").value;
    const expiresInDays = expiresInDaysRaw ? Number(expiresInDaysRaw) : undefined;
    const note = document.getElementById("vip-code-note").value.trim() || undefined;

    try {
        const result = await callAdminFunction("admin-generate-vip-code", {
            method: "POST",
            body: JSON.stringify({ vipDays, maxUses, expiresInDays, note }),
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

const METHOD_LABELS = { payment: "Pagamento", code: "Código" };

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
            activations.forEach((a) => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>${escapeHtml(a.username)}</td>
                    <td>${METHOD_LABELS[a.method] || a.method}</td>
                    <td>${escapeHtml(a.detail)}</td>
                    <td>${formatDate(a.date)}</td>
                `;
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

                const tr = document.createElement("tr");
                if (c.paused) tr.style.opacity = "0.5";

                tr.innerHTML = `
                    <td style="font-family:monospace;">${escapeHtml(c.code)}</td>
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

loadVipActivity();

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

            const holders = document.createElement("div");
            holders.className = "admin-badge-holders";
            holders.textContent =
                badge.holders.length > 0
                    ? `${badge.holders.length} pessoa(s): ${badge.holders.join(", ")}`
                    : "Ninguém tem esse badge ainda.";

            const deleteBtn = document.createElement("button");
            deleteBtn.type = "button";
            deleteBtn.className = "btn btn-secondary admin-badge-delete-btn";
            deleteBtn.textContent = "Delete";
            deleteBtn.addEventListener("click", () => confirmDeleteBadge(badge, card));

            card.appendChild(swatch);
            card.appendChild(name);
            card.appendChild(meta);
            card.appendChild(holders);
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
