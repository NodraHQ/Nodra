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
