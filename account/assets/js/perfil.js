// ==================================================================
// PERFIL PÚBLICO - perfil.js
//
// Mostra o perfil público de qualquer usuário via ?u=username.
// Precisa estar logado pra ver (mesma regra da view profiles_public,
// que só concede select pra authenticated). Mostra: avatar,
// username, bio, VIP, redes sociais, badges, e a wallet - reportado
// ao vivo: "é o mais importante", pra quem tem que mandar recompensa
// de verdade pra essa pessoa conseguir ver o endereço.
// ==================================================================

const supabaseClient = window.nodraSupabase;

const sections = {
    loading: document.getElementById("perfil-loading"),
    signedOut: document.getElementById("perfil-signed-out"),
    notFound: document.getElementById("perfil-not-found"),
    found: document.getElementById("perfil-found"),
};

function showSection(name) {
    Object.entries(sections).forEach(([key, el]) => {
        if (!el) return;
        el.hidden = key !== name;
    });
}

function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
}

const SOCIAL_ICON_SVGS = {
    x: '<svg viewBox="0 0 24 24"><path d="M18.9 2H22l-7.6 8.7L23 22h-6.9l-5.4-6.9L4.4 22H1.3l8.1-9.3L1 2h7l4.9 6.3L18.9 2zm-1.2 18h1.9L7.4 4H5.4l12.3 16z"/></svg>',
    telegram:
        '<svg viewBox="0 0 24 24"><path d="M21.9 4.3c.3-1-.7-1.9-1.6-1.5L2.5 10.1c-1 .4-1 1.8.1 2.1l4.4 1.4 1.7 5.4c.2.7 1.1.9 1.6.4l2.5-2.4 4.5 3.3c.7.5 1.7.1 1.9-.7l3.7-15.3zM8.5 13.6l9.3-6.3c.2-.1.4.1.2.3l-7.7 7.3c-.3.3-.5.7-.6 1.1l-.3 2.2-1.5-4.1c-.1-.2 0-.4.2-.5z"/></svg>',
    instagram:
        '<svg viewBox="0 0 24 24"><path d="M12 2c-2.7 0-3.1 0-4.1.1-1.1.1-1.8.2-2.5.5-.7.3-1.2.6-1.8 1.2-.6.6-.9 1.1-1.2 1.8-.3.7-.4 1.4-.5 2.5C2 9.1 2 9.5 2 12.2s0 3.1.1 4.1c.1 1.1.2 1.8.5 2.5.3.7.6 1.2 1.2 1.8.6.6 1.1.9 1.8 1.2.7.3 1.4.4 2.5.5 1 .1 1.4.1 4.1.1s3.1 0 4.1-.1c1.1-.1 1.8-.2 2.5-.5.7-.3 1.2-.6 1.8-1.2.6-.6.9-1.1 1.2-1.8.3-.7.4-1.4.5-2.5.1-1 .1-1.4.1-4.1s0-3.1-.1-4.1c-.1-1.1-.2-1.8-.5-2.5-.3-.7-.6-1.2-1.2-1.8-.6-.6-1.1-.9-1.8-1.2-.7-.3-1.4-.4-2.5-.5C15.1 2 14.7 2 12 2zm0 1.8c2.7 0 3 0 4 .1 1 0 1.5.2 1.9.4.5.2.8.4 1.1.7.3.3.5.6.7 1.1.2.4.3.9.4 1.9.1 1 .1 1.3.1 4s0 3-.1 4c0 1-.2 1.5-.4 1.9-.2.5-.4.8-.7 1.1-.3.3-.6.5-1.1.7-.4.2-.9.3-1.9.4-1 .1-1.3.1-4 .1s-3 0-4-.1c-1 0-1.5-.2-1.9-.4-.5-.2-.8-.4-1.1-.7-.3-.3-.5-.6-.7-1.1-.2-.4-.3-.9-.4-1.9-.1-1-.1-1.3-.1-4s0-3 .1-4c0-1 .2-1.5.4-1.9.2-.5.4-.8.7-1.1.3-.3.6-.5 1.1-.7.4-.2.9-.3 1.9-.4 1-.1 1.3-.1 4-.1zM12 7a5 5 0 100 10 5 5 0 000-10zm0 1.8a3.2 3.2 0 110 6.4 3.2 3.2 0 010-6.4zm5.2-2a1.2 1.2 0 100 2.4 1.2 1.2 0 000-2.4z"/></svg>',
};

function handleToUrl(kind, handle) {
    const clean = handle.replace(/^@/, "").trim();
    if (!clean) return null;
    if (kind === "x") return `https://x.com/${clean}`;
    if (kind === "telegram") return `https://t.me/${clean}`;
    if (kind === "instagram") return `https://instagram.com/${clean}`;
    return null;
}

function renderSocialIcons(profile) {
    const container = document.getElementById("perfil-social-icons");
    if (!container) return;
    container.innerHTML = "";

    const entries = [
        ["x", profile.x_handle],
        ["telegram", profile.telegram_handle],
        ["instagram", profile.instagram_handle],
    ];

    for (const [kind, handle] of entries) {
        if (!handle) continue;
        const url = handleToUrl(kind, handle);
        if (!url) continue;

        const link = document.createElement("a");
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.setAttribute("aria-label", kind);
        link.innerHTML = SOCIAL_ICON_SVGS[kind];
        container.appendChild(link);
    }
}

function renderAvatar(profile) {
    const container = document.getElementById("perfil-avatar-display");
    if (!container) return;
    container.innerHTML = "";

    if (profile.avatar_url) {
        const img = document.createElement("img");
        img.src = profile.avatar_url;
        img.alt = "";
        container.appendChild(img);
    } else {
        container.textContent = (profile.username || "?").charAt(0).toUpperCase();
    }
}

function renderSocialList(profile) {
    const container = document.getElementById("perfil-social-list");
    const emptyEl = document.getElementById("perfil-social-empty");
    if (!container) return;
    container.innerHTML = "";

    const entries = [
        ["x", "X (Twitter)", profile.x_handle],
        ["telegram", "Telegram", profile.telegram_handle],
        ["instagram", "Instagram", profile.instagram_handle],
    ];

    let anyShown = false;

    entries.forEach(([kind, label, handle]) => {
        if (!handle) return;
        const url = handleToUrl(kind, handle);
        if (!url) return;
        anyShown = true;

        const row = document.createElement("a");
        row.className = "perfil-social-row";
        row.href = url;
        row.target = "_blank";
        row.rel = "noopener noreferrer";

        const iconSpan = document.createElement("span");
        iconSpan.className = "perfil-social-row-icon";
        // Fixo, definido no código - nunca depende de texto do usuário.
        iconSpan.innerHTML = SOCIAL_ICON_SVGS[kind];

        // Handle é texto livre digitado pela pessoa - sempre via
        // createTextNode, nunca innerHTML com esse valor.
        const textSpan = document.createElement("span");
        textSpan.className = "perfil-social-row-text";
        const labelStrong = document.createElement("strong");
        labelStrong.textContent = label;
        textSpan.appendChild(labelStrong);
        textSpan.appendChild(document.createTextNode(`: ${handle}`));

        row.appendChild(iconSpan);
        row.appendChild(textSpan);
        container.appendChild(row);
    });

    if (emptyEl) emptyEl.hidden = anyShown;
}

async function boot() {
    const params = new URLSearchParams(window.location.search);
    const usernameParam = (params.get("u") || "").trim();

    const {
        data: { session },
    } = await supabaseClient.auth.getSession();

    if (!session) {
        showSection("signedOut");
        return;
    }

    if (!usernameParam) {
        showSection("notFound");
        return;
    }

    const { data: profile, error } = await supabaseClient
        .from("profiles_public")
        .select("*")
        .ilike("username", usernameParam)
        .maybeSingle();

    if (error || !profile) {
        showSection("notFound");
        return;
    }

    document.getElementById("perfil-username-display").textContent = profile.username;
    document.title = `${profile.username} - Nodra`;

    const bioEl = document.getElementById("perfil-bio-display");
    if (profile.bio) {
        bioEl.textContent = profile.bio;
        bioEl.removeAttribute("data-i18n");
    } else {
        bioEl.dataset.i18n = "profile.noBioYet";
        bioEl.textContent =
            window.nodraTranslator?.translations?.["profile.noBioYet"] || "No bio yet.";
    }

    const vipBadge = document.getElementById("perfil-vip-badge");
    if (vipBadge) vipBadge.hidden = !profile.is_vip;

    const walletCard = document.getElementById("perfil-wallet-card");
    const walletAddressEl = document.getElementById("perfil-wallet-address");
    if (walletCard && walletAddressEl) {
        if (profile.wallet_evm) {
            walletCard.hidden = false;
            walletAddressEl.textContent = profile.wallet_evm;
        } else {
            walletCard.hidden = true;
        }
    }

    renderAvatar(profile);
    renderSocialIcons(profile);
    renderSocialList(profile);
    loadAndRenderBadges(profile.id, profile.featured_badge_ids);

    showSection("found");
}

// Badges de verdade - antes era só um "em breve" fixo. Reaproveita
// as mesmas classes CSS que a tela do VIP já usa pra desenhar o
// escudo (badge) e a legenda (badge-card-title/desc), versão
// pequena (--small).
// Mesmos ícones da tela de criar (account.js) - cópia própria deste
// arquivo, mesma convenção de todo o projeto. badge.icon guarda a
// CHAVE (ex: "trophy"), não o SVG pronto, então cada tela que exibe
// badge precisa saber montar o SVG a partir dela.
const PERFIL_BADGE_ICONS = {
    trophy: '<path d="M10 14.66V17a1 1 0 0 1-1 1 2 2 0 0 0-2 2v2"/><path d="M14 14.66V17a1 1 0 0 0 1 1 2 2 0 0 1 2 2v2"/><path d="M17.916 10H19.5A2.5 2.5 0 0 0 22 7.5V5a1 1 0 0 0-1-1h-3"/><path d="M4 22h16"/><path d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z"/><path d="M6.084 10H4.5A2.5 2.5 0 0 1 2 7.5V5a1 1 0 0 1 1-1h3"/>',
    award: '<path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526"/><circle cx="12" cy="8" r="6"/>',
    medal: '<path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15"/><path d="M11 12 5.12 2.2"/><path d="m13 12 5.88-9.8"/><path d="M8 7h8"/><circle cx="12" cy="17" r="5"/><path d="M12 18v-2h-.5"/>',
    crown: '<path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"/><path d="M5 21h14"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
    star: '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
    gem: '<path d="M10.5 3 8 9l4 13 4-13-2.5-6"/><path d="M17 3a2 2 0 0 1 1.6.8l3 4a2 2 0 0 1 .013 2.382l-7.99 10.986a2 2 0 0 1-3.247 0l-7.99-10.986A2 2 0 0 1 2.4 7.8l2.998-3.997A2 2 0 0 1 7 3z"/><path d="M2 9h20"/>',
    flag: '<path d="M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528"/>',
};

function buildPerfilIconSvg(iconKey) {
    const inner = PERFIL_BADGE_ICONS[iconKey];
    if (!inner) return "";
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}

async function loadAndRenderBadges(userId, featuredIds) {
    const { data, error } = await supabaseClient
        .from("user_badges")
        .select(
            "badge_id, note, granted_at, badges(slug, name_pt, name_en, description_pt, description_en, badge_shape, background_color, image_url, icon, icon_color, icon_size)",
        )
        .eq("user_id", userId)
        .order("granted_at", { ascending: false });

    const listEl = document.getElementById("perfil-badges-list");
    const emptyEl = document.getElementById("perfil-badges-empty");
    if (!listEl || !emptyEl) return;

    if (error) {
        console.error("Erro ao carregar badges:", error);
    }

    if (error || !data || data.length === 0) {
        emptyEl.hidden = false;
        listEl.innerHTML = "";
        return;
    }

    // Curadoria - só mostra os badges marcados como destaque pela
    // própria pessoa. Se ela ainda não escolheu nenhum (lista vazia,
    // ex: acabou de ganhar o primeiro badge e nunca abriu a tela de
    // curadoria), mostra todos - evita o card ficar vazio por padrão
    // só porque a curadoria nunca foi feita.
    const featuredSet = new Set(featuredIds || []);
    const rowsToShow =
        featuredSet.size > 0 ? data.filter((row) => featuredSet.has(row.badge_id)) : data;

    if (rowsToShow.length === 0) {
        emptyEl.hidden = false;
        listEl.innerHTML = "";
        return;
    }

    emptyEl.hidden = true;
    listEl.innerHTML = "";

    const lang = document.documentElement.lang === "en" ? "en" : "pt";

    rowsToShow.forEach((row) => {
        const badge = row.badges;
        if (!badge) return;

        const card = document.createElement("div");
        card.className = "badge-card badge-card--small";

        const badgeEl = document.createElement("div");
        badgeEl.className = `badge badge--small badge--${badge.badge_shape}`;
        // Fundo sempre é a cor de fundo escolhida - os dois (fundo e
        // cor do ícone) são independentes agora, cada um com o
        // próprio valor gravado no banco.
        badgeEl.style.background = badge.background_color;

        // Imagem enviada e ícone genérico são mutuamente exclusivos
        // (mesma regra da tela de criar) - nunca os dois juntos, e
        // um badge só de cor não tem nenhum dos dois.
        if (badge.image_url) {
            const img = document.createElement("img");
            img.src = badge.image_url;
            img.alt = "";
            badgeEl.appendChild(img);
        } else if (badge.icon) {
            const iconSpan = document.createElement("span");
            iconSpan.className = "badge-icon";
            iconSpan.innerHTML = buildPerfilIconSvg(badge.icon);
            iconSpan.style.color = badge.icon_color || badge.background_color;
            const iconSizePct = badge.icon_size || 35;
            const sizePx = Math.round(56 * (iconSizePct / 100)); // 56px = tamanho do escudo pequeno usado aqui
            iconSpan.style.width = `${sizePx}px`;
            iconSpan.style.height = `${sizePx}px`;
            badgeEl.appendChild(iconSpan);
        }

        const title = document.createElement("span");
        title.className = "badge-card-title";
        title.textContent = lang === "en" ? badge.name_en : badge.name_pt;

        const desc = document.createElement("span");
        desc.className = "badge-card-desc";
        desc.textContent = (lang === "en" ? badge.description_en : badge.description_pt) || "";

        card.appendChild(badgeEl);
        card.appendChild(title);
        if (desc.textContent) card.appendChild(desc);
        listEl.appendChild(card);
    });
}

boot();

document.getElementById("perfil-wallet-copy-btn")?.addEventListener("click", async (event) => {
    const btn = event.currentTarget;
    const address = document.getElementById("perfil-wallet-address").textContent;
    try {
        await navigator.clipboard.writeText(address);
        const original = btn.textContent;
        btn.textContent =
            window.nodraTranslator?.translations?.["perfil.walletCopied"] || "✓ Copiado!";
        setTimeout(() => { btn.textContent = original; }, 1800);
    } catch (err) {
        console.error("Erro ao copiar wallet:", err);
    }
});
