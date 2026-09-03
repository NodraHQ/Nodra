// ==================================================================
// ACCOUNT - account.js
//
// Login (email/senha ou Google) + perfil completo: bio, avatar
// customizado, redes sociais, wallet EVM, medidor de perfil
// completo. Ver docs/LOGIN_WALLET_ARCHITECTURE.md.
//
// Estados da página, mostrados/escondidos por seção:
// #auth-loading -> checando sessão existente
// #auth-section -> deslogado: formulário de entrar/criar conta
// #username-section -> logado, mas ainda sem username definido
// #logged-in-section -> logado, com username definido (perfil)
// ==================================================================

const supabaseClient = window.nodraSupabase;

// Se o SDK do Supabase (carregado via CDN) falhar por qualquer motivo
// - CDN fora do ar, bloqueador de anúncio, rede instável - o cliente
// nunca é criado, e sem esse guard a página ficava travada pra sempre
// na tela de "Loading...", sem avisar nada. Isso foi um bug real
// encontrado ao testar, não uma suposição.
if (!supabaseClient) {
    const loadingEl = document.getElementById("auth-loading");
    if (loadingEl) {
        loadingEl.removeAttribute("data-i18n");
        loadingEl.textContent =
            "Couldn't load the login system. Check your connection and reload the page.";
    }
    throw new Error("window.nodraSupabase is undefined - Supabase SDK failed to load from CDN.");
}

const sections = {
    loading: document.getElementById("auth-loading"),
    auth: document.getElementById("auth-section"),
    username: document.getElementById("username-section"),
    loggedIn: document.getElementById("logged-in-section"),
};

function showSection(name) {
    Object.entries(sections).forEach(([key, el]) => {
        if (!el) return;
        el.hidden = key !== name;
    });
}

function setMessage(el, key, fallback) {
    if (!el) return;
    if (!key && !fallback) {
        el.hidden = true;
        el.textContent = "";
        return;
    }
    const translated = key ? window.nodraTranslator?.translations?.[key] : null;
    el.textContent = translated || fallback || key;
    el.hidden = false;
}

// Bug real reportado ao vivo: salvar bio/redes sociais não dava
// nenhum retorno visível de sucesso - só dava pra confirmar dando F5.
// Isso pisca o botão pra "Saved ✓" por um instante, em qualquer save
// que não tenha outro jeito óbvio de mostrar que funcionou (a wallet
// já tem o endereço aparecendo na tela, então não precisa disso).
function flashSaved(button) {
    if (!button) return;
    const original = button.textContent;
    button.textContent =
        window.nodraTranslator?.translations?.["profile.savedConfirm"] || "Saved ✓";
    button.disabled = true;
    setTimeout(() => {
        button.textContent = original;
        button.disabled = false;
    }, 1500);
}

// Selo verde de check que aparece por um instante no canto do
// card que acabou de ser salvo - confirmação visual mais forte que
// só o texto do botão mudando. Usado em toda ação de salvar (bio,
// redes sociais, wallet, avatar, username).
function showSavedCheckmark(container) {
    if (!container) return;

    const existing = container.querySelector(".save-checkmark");
    if (existing) existing.remove();

    const badge = document.createElement("div");
    badge.className = "save-checkmark";
    badge.innerHTML =
        '<svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>';
    container.appendChild(badge);

    requestAnimationFrame(() => badge.classList.add("is-visible"));

    setTimeout(() => {
        badge.classList.remove("is-visible");
        setTimeout(() => badge.remove(), 300);
    }, 1400);
}

// Perfil atual em memória - atualizado a cada save, evita re-buscar
// tudo do banco só pra recalcular o medidor de completude.
let currentProfile = null;
let vipNavLabelListenersInitialized = false;
let currentUserId = null;

// ==================================================================
// FORMULÁRIO DE ENTRAR / CRIAR CONTA
// ==================================================================

const authForm = document.getElementById("auth-form");
const authEmailInput = document.getElementById("auth-email");
const authPasswordInput = document.getElementById("auth-password");
const authSubmitBtn = document.getElementById("auth-submit-btn");
const authToggleBtn = document.getElementById("auth-toggle-mode");
const authTogglePrompt = document.getElementById("auth-toggle-prompt");
const authErrorEl = document.getElementById("auth-error");
const googleBtn = document.getElementById("auth-google-btn");

let isSignUpMode = false;

function updateAuthModeUI() {
    const submitKey = isSignUpMode ? "auth.createAccountBtn" : "auth.signInBtn";
    const toggleKey = isSignUpMode ? "auth.toggleToSignIn" : "auth.toggleToSignUp";
    const promptKey = isSignUpMode ? "auth.toggleToSignInPrompt" : "auth.toggleToSignUpPrompt";
    if (authSubmitBtn) authSubmitBtn.dataset.i18n = submitKey;
    if (authToggleBtn) authToggleBtn.dataset.i18n = toggleKey;
    if (authTogglePrompt) authTogglePrompt.dataset.i18n = promptKey;
    window.nodraTranslator?.translatePage();
}

authToggleBtn?.addEventListener("click", () => {
    isSignUpMode = !isSignUpMode;
    setMessage(authErrorEl, null);
    updateAuthModeUI();
});

authForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage(authErrorEl, null);

    const email = authEmailInput.value.trim();
    const password = authPasswordInput.value;

    if (!email || !password) return;

    authSubmitBtn.disabled = true;

    try {
        const { error } = isSignUpMode
            ? await supabaseClient.auth.signUp({ email, password })
            : await supabaseClient.auth.signInWithPassword({ email, password });

        if (error) {
            setMessage(authErrorEl, null, error.message);
        } else if (isSignUpMode) {
            const { data } = await supabaseClient.auth.getSession();
            if (!data.session) {
                setMessage(authErrorEl, "auth.checkEmailToConfirm");
            }
        }
    } catch (err) {
        setMessage(authErrorEl, null, err.message);
    } finally {
        authSubmitBtn.disabled = false;
    }
});

googleBtn?.addEventListener("click", async () => {
    setMessage(authErrorEl, null);
    const cleanRedirectUrl = window.location.origin + window.location.pathname;
    const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: cleanRedirectUrl },
    });
    if (error) setMessage(authErrorEl, null, error.message);
});

// ==================================================================
// ESCOLHA DE USERNAME (primeira vez logado)
// ==================================================================

const usernameForm = document.getElementById("username-form");
const usernameInput = document.getElementById("username-input");
const usernameErrorEl = document.getElementById("username-error");

usernameForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage(usernameErrorEl, null);

    const desired = usernameInput.value.trim();
    const submitBtn = usernameForm.querySelector("button[type=submit]");

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(desired)) {
        setMessage(usernameErrorEl, "auth.usernameFormatError");
        return;
    }

    submitBtn.disabled = true;

    const {
        data: { user },
    } = await supabaseClient.auth.getUser();

    const { data: updated, error } = await supabaseClient
        .from("profiles")
        .update({ username: desired })
        .eq("id", user.id)
        .select()
        .single();

    submitBtn.disabled = false;

    if (error) {
        if (error.code === "23505") {
            setMessage(usernameErrorEl, "auth.usernameTakenError");
        } else {
            setMessage(usernameErrorEl, null, error.message);
        }
        return;
    }

    currentUserId = user.id;
    showLoggedInState(updated, user);
});

// ==================================================================
// LOGOUT
// ==================================================================

document.getElementById("logout-btn")?.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
});

// ==================================================================
// GARANTIR QUE O PERFIL EXISTE, E DECIDIR QUAL ESTADO MOSTRAR
// ==================================================================

async function ensureProfileAndRoute(user) {
    // Limpa só sobra de redirect de login (o Supabase anexa
    // access_token/refresh_token/etc no hash da URL depois do OAuth
    // do Google) - um hash normal nosso, tipo #history (lembra qual
    // aba estava ativa), precisa sobreviver a essa limpeza. Bug real
    // reportado ao vivo: dar F5 na aba de Histórico voltava sempre
    // pro Perfil, porque isso aqui limpava QUALQUER hash, sem
    // distinguir sobra de OAuth de aba de verdade.
    const isOAuthHashJunk = /access_token=|refresh_token=|provider_token=|error_description=/.test(
        window.location.hash,
    );

    if (window.location.search || isOAuthHashJunk) {
        const cleanHash = isOAuthHashJunk ? "" : window.location.hash;
        window.history.replaceState(null, "", window.location.pathname + cleanHash);
    }

    currentUserId = user.id;

    let { data: profile, error } = await supabaseClient
        .from("profiles")
        .select(
            "username, bio, avatar_url, x_handle, telegram_handle, instagram_handle, wallet_evm, is_vip, featured_badge_ids, vip_expires_at",
        )
        .eq("id", user.id)
        .maybeSingle();

    if (error) {
        console.error("Falha ao carregar perfil:", error);
        return;
    }

    if (!profile) {
        const { data: created, error: insertError } = await supabaseClient
            .from("profiles")
            .insert({ id: user.id })
            .select(
                "username, bio, avatar_url, x_handle, telegram_handle, instagram_handle, wallet_evm, is_vip, featured_badge_ids, vip_expires_at",
            )
            .single();

        if (insertError) {
            console.error("Falha ao criar perfil:", insertError);
            return;
        }

        profile = created;
    }

    if (profile.username) {
        showLoggedInState(profile, user);
    } else {
        currentProfile = profile;
        showSection("username");
    }
}

// ==================================================================
// PERFIL - cabeçalho (avatar/nome/bio), medidor de completude
// ==================================================================

const profileUsernameDisplay = document.getElementById("profile-username-display");
const profileVipBadge = document.getElementById("profile-vip-badge");
const profileBioDisplay = document.getElementById("profile-bio-display");
const profileAvatarDisplay = document.getElementById("profile-avatar-display");

function showLoggedInState(profile, user) {
    currentProfile = profile;

    if (profileUsernameDisplay) profileUsernameDisplay.textContent = profile.username;
    if (profileVipBadge) profileVipBadge.hidden = !profile.is_vip;

    const vipTab = document.getElementById("navbar-tab-vip");
    if (vipTab) {
        // Sempre visível agora, não só pra quem já é VIP - reportado
        // ao vivo: era ali (na navbar) que devia aparecer "Seja VIP"
        // pra quem ainda não é, virando "Área VIP" depois.
        vipTab.hidden = false;
        vipTab.textContent = profile.is_vip
            ? window.nodraTranslator?.translations?.["vip.navTabActive"] || "Vip Area"
            : window.nodraTranslator?.translations?.["vip.navTabInactive"] || "Become Vip";
    }
    renderVipPanelState(profile.is_vip);

    // Reaplica o rótulo dinâmico da aba VIP depois de trocar de
    // idioma - o sistema de tradução geral reescreve todo elemento
    // [data-i18n], mas essa aba não usa mais isso de propósito (o
    // texto dela depende do status de VIP, não é uma tradução fixa).
    // Guarda com trava - sem isso, cada vez que showLoggedInState
    // rodasse de novo (reautenticação, etc) empilhava mais um
    // ouvinte, disparando várias vezes por clique.
    if (!vipNavLabelListenersInitialized) {
        vipNavLabelListenersInitialized = true;
        ["lang-en", "lang-pt"].forEach((id) => {
            document.getElementById(id)?.addEventListener("click", () => {
                setTimeout(() => {
                    const tab = document.getElementById("navbar-tab-vip");
                    if (tab) {
                        tab.textContent = currentProfile?.is_vip
                            ? window.nodraTranslator?.translations?.["vip.navTabActive"] || "Vip Area"
                            : window.nodraTranslator?.translations?.["vip.navTabInactive"] || "Become Vip";
                    }
                }, 100);
            });
        });
    }

    updateBioDisplay(profile.bio);
    updateAvatarDisplay(profile.avatar_url, user?.user_metadata?.avatar_url, profile.username);

    if (bioInput) bioInput.value = profile.bio || "";
    if (xHandleInput) xHandleInput.value = profile.x_handle || "";
    if (telegramHandleInput) telegramHandleInput.value = profile.telegram_handle || "";
    if (instagramHandleInput) instagramHandleInput.value = profile.instagram_handle || "";

    updateCompletionMeter();
    updateSocialIcons();

    showSection("loggedIn");
    initWalletBlock();
    initProfileTopTabs();
    initProfileToc();
    loadMatchHistory();
    loadOwnBadges(user.id, profile.featured_badge_ids || []);
    renderVipMembershipStatus(profile.is_vip, profile.vip_expires_at);
    toggleNavbarProfileTabs(true);
}

function updateBioDisplay(bio) {
    if (!profileBioDisplay) return;
    if (bio) {
        profileBioDisplay.textContent = bio;
        profileBioDisplay.removeAttribute("data-i18n");
    } else {
        profileBioDisplay.dataset.i18n = "profile.noBioYet";
        profileBioDisplay.textContent =
            window.nodraTranslator?.translations?.["profile.noBioYet"] || "No bio yet.";
    }
}

function updateAvatarDisplay(customAvatarUrl, googleAvatarUrl, username) {
    if (!profileAvatarDisplay) return;
    const src = customAvatarUrl || googleAvatarUrl;
    profileAvatarDisplay.innerHTML = "";
    if (src) {
        // Constrói o <img> via DOM em vez de template string - se
        // avatar_url algum dia contiver algo malicioso (ex.: alguém
        // editando a própria linha direto pela API, contornando a
        // UI), inserir via innerHTML quebraria pra fora do atributo
        // src e executaria script. Via DOM, o valor nunca é
        // interpretado como HTML.
        const img = document.createElement("img");
        img.src = src;
        img.alt = "";
        profileAvatarDisplay.appendChild(img);
    } else {
        const initial = (username || "?").charAt(0).toUpperCase();
        profileAvatarDisplay.textContent = initial;
    }
}

// ==================================================================
// ÍCONES DE REDE SOCIAL NO CANTO DO CABEÇALHO - só aparece o ícone
// de quem a pessoa realmente preencheu, cada um clicável levando pro
// perfil de verdade.
// ==================================================================

const SOCIAL_ICON_SVGS = {
    x: '<svg viewBox="0 0 24 24"><path d="M18.9 2H22l-7.6 8.7L23 22h-6.9l-5.4-6.9L4.4 22H1.3l8.1-9.3L1 2h7l4.9 6.3L18.9 2zm-1.2 18h1.9L7.4 4H5.4l12.3 16z"/></svg>',
    telegram:
        '<svg viewBox="0 0 24 24"><path d="M21.9 4.3c.3-1-.7-1.9-1.6-1.5L2.5 10.1c-1 .4-1 1.8.1 2.1l4.4 1.4 1.7 5.4c.2.7 1.1.9 1.6.4l2.5-2.4 4.5 3.3c.7.5 1.7.1 1.9-.7l3.7-15.3zM8.5 13.6l9.3-6.3c.2-.1.4.1.2.3l-7.7 7.3c-.3.3-.5.7-.6 1.1l-.3 2.2-1.5-4.1c-.1-.2 0-.4.2-.5z"/></svg>',
    instagram:
        '<svg viewBox="0 0 24 24"><path d="M12 2c-2.7 0-3.1 0-4.1.1-1.1.1-1.8.2-2.5.5-.7.3-1.2.6-1.8 1.2-.6.6-.9 1.1-1.2 1.8-.3.7-.4 1.4-.5 2.5C2 9.1 2 9.5 2 12.2s0 3.1.1 4.1c.1 1.1.2 1.8.5 2.5.3.7.6 1.2 1.2 1.8.6.6 1.1.9 1.8 1.2.7.3 1.4.4 2.5.5 1 .1 1.4.1 4.1.1s3.1 0 4.1-.1c1.1-.1 1.8-.2 2.5-.5.7-.3 1.2-.6 1.8-1.2.6-.6.9-1.1 1.2-1.8.3-.7.4-1.4.5-2.5.1-1 .1-1.4.1-4.1s0-3.1-.1-4.1c-.1-1.1-.2-1.8-.5-2.5-.3-.7-.6-1.2-1.2-1.8-.6-.6-1.1-.9-1.8-1.2-.7-.3-1.4-.4-2.5-.5C15.1 2 14.7 2 12 2zm0 1.8c2.7 0 3 0 4 .1 1 0 1.5.2 1.9.4.5.2.8.4 1.1.7.3.3.5.6.7 1.1.2.4.3.9.4 1.9.1 1 .1 1.3.1 4s0 3-.1 4c0 1-.2 1.5-.4 1.9-.2.5-.4.8-.7 1.1-.3.3-.6.5-1.1.7-.4.2-.9.3-1.9.4-1 .1-1.3.1-4 .1s-3 0-4-.1c-1 0-1.5-.2-1.9-.4-.5-.2-.8-.4-1.1-.7-.3-.3-.5-.6-.7-1.1-.2-.4-.3-.9-.4-1.9-.1-1-.1-1.3-.1-4s0-3 .1-4c0-1 .2-1.5.4-1.9.2-.5.4-.8.7-1.1.3-.3.6-.5 1.1-.7.4-.2.9-.3 1.9-.4 1-.1 1.3-.1 4-.1zM12 7a5 5 0 100 10 5 5 0 000-10zm0 1.8a3.2 3.2 0 110 6.4 3.2 3.2 0 010-6.4zm5.2-2a1.2 1.2 0 100 2.4 1.2 1.2 0 000-2.4z"/></svg>',
};

// Remove um @ inicial se a pessoa digitou (ex.: "@alice" -> "alice")
// - o link final não deve ter @ duplicado.
function handleToUrl(kind, handle) {
    const clean = handle.replace(/^@/, "").trim();
    if (!clean) return null;
    if (kind === "x") return `https://x.com/${clean}`;
    if (kind === "telegram") return `https://t.me/${clean}`;
    if (kind === "instagram") return `https://instagram.com/${clean}`;
    return null;
}

function updateSocialIcons() {
    const container = document.getElementById("profile-social-icons");
    if (!container || !currentProfile) return;

    container.innerHTML = "";

    const entries = [
        ["x", currentProfile.x_handle],
        ["telegram", currentProfile.telegram_handle],
        ["instagram", currentProfile.instagram_handle],
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

// ==================================================================
// TROCAR USERNAME (depois de já ter escolhido um)
// ==================================================================

const usernameEditBtn = document.getElementById("username-edit-btn");
const usernameEditForm = document.getElementById("username-edit-form");
const usernameEditInput = document.getElementById("username-edit-input");
const usernameEditCancelBtn = document.getElementById("username-edit-cancel-btn");
const usernameEditErrorEl = document.getElementById("username-edit-error");

usernameEditBtn?.addEventListener("click", () => {
    usernameEditInput.value = currentProfile?.username || "";
    setMessage(usernameEditErrorEl, null);
    usernameEditForm.hidden = false;
    usernameEditBtn.hidden = true;
    usernameEditInput.focus();
});

usernameEditCancelBtn?.addEventListener("click", () => {
    usernameEditForm.hidden = true;
    usernameEditBtn.hidden = false;
    setMessage(usernameEditErrorEl, null);
});

usernameEditForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage(usernameEditErrorEl, null);

    const desired = usernameEditInput.value.trim();
    const submitBtn = usernameEditForm.querySelector("button[type=submit]");

    // Mesma regra de formato do primeiro cadastro de username - ver
    // auth.usernameFormatError logo acima no arquivo.
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(desired)) {
        setMessage(usernameEditErrorEl, "auth.usernameFormatError");
        return;
    }

    if (desired === currentProfile.username) {
        usernameEditForm.hidden = true;
        usernameEditBtn.hidden = false;
        return;
    }

    submitBtn.disabled = true;

    const { error } = await supabaseClient
        .from("profiles")
        .update({ username: desired })
        .eq("id", currentUserId);

    submitBtn.disabled = false;

    if (error) {
        if (error.code === "23505") {
            setMessage(usernameEditErrorEl, "auth.usernameTakenError");
        } else {
            setMessage(usernameEditErrorEl, null, error.message);
        }
        return;
    }

    currentProfile.username = desired;
    if (profileUsernameDisplay) profileUsernameDisplay.textContent = desired;
    updateAvatarDisplay(currentProfile.avatar_url, null, desired); // iniciais do fallback usam o username

    usernameEditForm.hidden = true;
    usernameEditBtn.hidden = false;
    showSavedCheckmark(document.querySelector(".profile-header"));
});

// Campos considerados na % de completude. Username não entra - é
// obrigatório pra sequer chegar nesta tela, não é um "opcional
// completado".
const COMPLETION_FIELDS = [
    "bio",
    "avatar_url",
    "x_handle",
    "telegram_handle",
    "instagram_handle",
    "wallet_evm",
];

function updateCompletionMeter() {
    const fillEl = document.getElementById("completion-fill");
    const percentEl = document.getElementById("completion-percent");
    const hintEl = document.getElementById("completion-hint");

    if (!currentProfile || !fillEl) return;

    const filledCount = COMPLETION_FIELDS.filter((key) => !!currentProfile[key]).length;
    const percent = Math.round((filledCount / COMPLETION_FIELDS.length) * 100);

    fillEl.style.width = `${percent}%`;
    if (percentEl) percentEl.textContent = `${percent}%`;

    if (hintEl) {
        if (percent === 100) {
            hintEl.textContent =
                window.nodraTranslator?.translations?.["profile.completionFull"] ||
                "Your profile is complete.";
        } else {
            const template =
                window.nodraTranslator?.translations?.["profile.completionHint"] ||
                "{count} of {total} completed.";
            hintEl.textContent = template
                .replace("{count}", filledCount)
                .replace("{total}", COMPLETION_FIELDS.length);
        }
    }
}

// ==================================================================
// AVATAR - upload pro Supabase Storage (bucket público "avatars")
// ==================================================================

const avatarInput = document.getElementById("avatar-input");
const avatarErrorEl = document.getElementById("avatar-error");

const MAX_AVATAR_BYTES = 3 * 1024 * 1024; // 3MB

avatarInput?.addEventListener("change", async () => {
    setMessage(avatarErrorEl, null);

    const file = avatarInput.files?.[0];
    if (!file) return;

    if (file.size > MAX_AVATAR_BYTES) {
        setMessage(avatarErrorEl, "profile.avatarTooLarge");
        avatarInput.value = "";
        return;
    }

    const ext = file.name.split(".").pop();
    const path = `${currentUserId}/avatar.${ext}`;

    const { error: uploadError } = await supabaseClient.storage
        .from("avatars")
        .upload(path, file, { upsert: true, cacheControl: "3600" });

    if (uploadError) {
        setMessage(avatarErrorEl, null, uploadError.message);
        avatarInput.value = "";
        return;
    }

    const { data: publicUrlData } = supabaseClient.storage.from("avatars").getPublicUrl(path);
    // Cache-buster: o mesmo caminho é reaproveitado a cada troca
    // (upsert), então sem isso o navegador poderia continuar
    // mostrando a imagem antiga em cache.
    const publicUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

    const { error: updateError } = await supabaseClient
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", currentUserId);

    if (updateError) {
        setMessage(avatarErrorEl, null, updateError.message);
        return;
    }

    currentProfile.avatar_url = publicUrl;
    updateAvatarDisplay(publicUrl, null, currentProfile.username);
    updateCompletionMeter();
    showSavedCheckmark(document.querySelector(".profile-header"));
});

// ==================================================================
// BIO
// ==================================================================

const bioInput = document.getElementById("bio-input");
const bioErrorEl = document.getElementById("bio-error");

document.getElementById("bio-save-btn")?.addEventListener("click", async (event) => {
    setMessage(bioErrorEl, null);

    const bio = bioInput.value.trim();

    const { error } = await supabaseClient
        .from("profiles")
        .update({ bio: bio || null })
        .eq("id", currentUserId);

    if (error) {
        setMessage(bioErrorEl, null, error.message);
        return;
    }

    currentProfile.bio = bio || null;
    updateBioDisplay(currentProfile.bio);
    updateCompletionMeter();
    flashSaved(event.currentTarget);
    showSavedCheckmark(document.getElementById("profile-about"));
});

// ==================================================================
// REDES SOCIAIS
// ==================================================================

const xHandleInput = document.getElementById("x-handle-input");
const telegramHandleInput = document.getElementById("telegram-handle-input");
const instagramHandleInput = document.getElementById("instagram-handle-input");
const socialErrorEl = document.getElementById("social-error");

document.getElementById("social-save-btn")?.addEventListener("click", async (event) => {
    setMessage(socialErrorEl, null);

    const payload = {
        x_handle: xHandleInput.value.trim() || null,
        telegram_handle: telegramHandleInput.value.trim() || null,
        instagram_handle: instagramHandleInput.value.trim() || null,
    };

    const { error } = await supabaseClient.from("profiles").update(payload).eq("id", currentUserId);

    if (error) {
        setMessage(socialErrorEl, null, error.message);
        return;
    }

    Object.assign(currentProfile, payload);
    updateCompletionMeter();
    updateSocialIcons();
    flashSaved(event.currentTarget);
    showSavedCheckmark(document.getElementById("profile-social"));
});

// ==================================================================
// WALLET (Reown AppKit)
// ==================================================================

const walletConnectedAddressEl = document.getElementById("wallet-connected-address");
const walletInput = document.getElementById("wallet-input");
const walletForm = document.getElementById("wallet-form");
const walletErrorEl = document.getElementById("wallet-error");
const appkitButtonEl = document.querySelector("appkit-button");
const walletDividerEl = document.getElementById("wallet-divider");

const EVM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

let walletBlockInitialized = false;

function initWalletBlock() {
    updateWalletDisplay(currentProfile?.wallet_evm);

    if (walletBlockInitialized) return;
    walletBlockInitialized = true;

    if (!window.nodraAppKitModal) {
        // AppKit não inicializou (Project ID não configurado, CDN
        // fora do ar, etc). Esconde o botão E o divisor "or" junto -
        // sem isso, o "or" ficava sozinho, sem nada acima dele,
        // reportado ao vivo como um buraco estranho no card.
        if (appkitButtonEl) appkitButtonEl.hidden = true;
        if (walletDividerEl) walletDividerEl.hidden = true;
    } else {
        // Bug real reportado ao vivo, em duas partes:
        // 1) getIsConnected() retorna undefined na versão real do
        // SDK (não true/false como a documentação sugeria) - por
        // isso checkAndSaveConnectedWallet agora confia só num
        // endereço válido, não em isConnected.
        // 2) subscribeProvider NÃO existe como função nesta versão do
        // SDK - chamar direto travava com erro não capturado, o
        // que impedia até o walletForm.addEventListener logo
        // abaixo de ser registrado (o erro interrompe o resto da
        // função). Por isso agora só tenta se realmente existir, e
        // dentro de try/catch - nunca mais pode derrubar o resto
        // do bloco de wallet.
        checkAndSaveConnectedWallet();
        setTimeout(checkAndSaveConnectedWallet, 1500);

        try {
            if (typeof window.nodraAppKitModal.subscribeProvider === "function") {
                window.nodraAppKitModal.subscribeProvider((state) => {
                    console.log("[Nodra] AppKit subscribeProvider:", state);
                    if (state?.address) saveWalletAddress(state.address);
                });
            } else {
                console.warn(
                    "[Nodra] subscribeProvider não existe nesta versão do AppKit - contando só com getAddress() (checagem inicial + clique no botão).",
                );
            }
        } catch (err) {
            console.error("[Nodra] subscribeProvider falhou, ignorando sem travar o resto:", err);
        }

        // Reforço adicional: como subscribeProvider não é confiável,
        // qualquer clique no botão do próprio Reown (o usuário
        // conectando durante a sessão, não só sessão já restaurada)
        // dispara uma checagem logo depois, dando tempo do SDK
        // processar a conexão.
        appkitButtonEl?.addEventListener("click", () => {
            setTimeout(checkAndSaveConnectedWallet, 2000);
            setTimeout(checkAndSaveConnectedWallet, 4000);
        });
    }

    walletForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        setMessage(walletErrorEl, null);

        const address = walletInput.value.trim();

        if (!EVM_ADDRESS_REGEX.test(address)) {
            setMessage(walletErrorEl, "wallet.formatError");
            return;
        }

        await saveWalletAddress(address);
    });
}

// Checagem direta do estado do AppKit, independente do evento de
// subscribeProvider - chamada tanto na hora de iniciar o bloco de
// wallet quanto de novo depois de um instante, como reforço.
function checkAndSaveConnectedWallet() {
    try {
        const address = window.nodraAppKitModal.getAddress?.();
        console.log("[Nodra] checkAndSaveConnectedWallet address:", address);
        // Confia só num endereço válido de verdade - getIsConnected()
        // retornou undefined na versão real do SDK ao vivo, então
        // depender dele rejeitava um endereço correto.
        if (address && EVM_ADDRESS_REGEX.test(address) && address !== currentProfile?.wallet_evm) {
            saveWalletAddress(address);
        }
    } catch (err) {
        console.error("[Nodra] Falha ao checar wallet já conectada:", err);
    }
}

async function saveWalletAddress(address) {
    setMessage(walletErrorEl, null);

    const { error } = await supabaseClient
        .from("profiles")
        .update({ wallet_evm: address })
        .eq("id", currentUserId);

    if (error) {
        setMessage(walletErrorEl, null, error.message);
        return;
    }

    currentProfile.wallet_evm = address;
    updateWalletDisplay(address);
    updateCompletionMeter();
    showSavedCheckmark(document.getElementById("profile-wallet"));
}

function updateWalletDisplay(address) {
    if (address) {
        walletConnectedAddressEl.textContent = address;
        walletConnectedAddressEl.hidden = false;
        if (walletInput) walletInput.value = address;
    } else {
        walletConnectedAddressEl.hidden = true;
    }
}

// ==================================================================
// ABA DE TOPO - "Perfil" (sumário lateral com scroll-spy, como era)
// e "Histórico" (painel separado, simples). Agora vivem dentro da
// própria navbar, no lugar de Ecosystem/GitHub - toggleNavbarProfileTabs
// faz essa troca quando loga/desloga.
// ==================================================================

let profileTopTabsInitialized = false;

function initProfileTopTabs() {
    if (profileTopTabsInitialized) return;
    profileTopTabsInitialized = true;

    const tabs = Array.from(document.querySelectorAll(".navbar-tab"));
    const panels = Array.from(document.querySelectorAll(".profile-toptab-panel"));

    if (!tabs.length || !panels.length) return;

    function activateTab(target, updateHash) {
        const matchingTab = tabs.find((t) => t.dataset.toptab === target);
        if (!matchingTab) return;

        tabs.forEach((t) => t.classList.remove("is-active"));
        matchingTab.classList.add("is-active");

        panels.forEach((panel) => {
            panel.hidden = panel.dataset.toptabPanel !== target;
        });

        if (updateHash) {
            history.replaceState(null, "", `#${target}`);
        }

        // Inicialização da aba VIP roda AQUI, não só num listener de
        // clique - reportado ao vivo: entrar direto em #vip pela URL
        // (recarregar a página, ou voltar por um link salvo) pulava
        // o clique inteiramente, deixando a paleta de cores vazia e
        // o <select> de "Conceder Badge" sem nenhum badge carregado
        // (por isso "grant badge nunca funcionou" - o formulário
        // tentava enviar sem nenhuma opção selecionada de verdade).
        // activateTab roda pros dois casos, clique ou restauração via
        // hash, então fica correto nos dois. As quatro funções são
        // declaradas com "function" (hoisted), por isso dá pra
        // chamar aqui mesmo definidas mais abaixo no arquivo.
        if (target === "vip") {
            renderColorPalette();
            renderIconPalette();
            renderIconColorPalette();
            updateBadgePreview();
            loadBadgesIntoGrantSelect();
            initVipSubTabs();
        }
    }

    tabs.forEach((tab) => {
        tab.addEventListener("click", () => activateTab(tab.dataset.toptab, true));
    });

    // Lê a aba certa da URL ao carregar - reportado ao vivo: dar F5
    // na aba de Histórico voltava pro Perfil, porque a aba ativa só
    // existia na memória do navegador, nunca na URL. Também reage a
    // navegação por trás/avançar do navegador (voltar depois de ter
    // trocado de aba).
    function activateFromHash() {
        const hash = window.location.hash.replace("#", "");
        const validHash = tabs.some((t) => t.dataset.toptab === hash) ? hash : "profile";
        activateTab(validHash, false);
    }

    activateFromHash();
    window.addEventListener("hashchange", activateFromHash);
}

// Troca Ecosystem/GitHub pelas abas Perfil/Histórico na navbar - só
// faz sentido mostrar essas abas quando tem perfil pra navegar.
// Reportado ao vivo: a barra de abas separada (antes vivia embaixo
// da navbar) sumia ao rolar a página e não ficava centralizada -
// botando na navbar (que é fixed) resolve os dois de graça.
function toggleNavbarProfileTabs(show) {
    const ecosystemLink = document.getElementById("nav-link-ecosystem");
    const githubLink = document.getElementById("nav-link-github");
    const profileTab = document.getElementById("navbar-tab-profile");
    const historyTab = document.getElementById("navbar-tab-history");

    if (ecosystemLink) ecosystemLink.hidden = show;
    if (githubLink) githubLink.hidden = show;
    if (profileTab) profileTab.hidden = !show;
    if (historyTab) historyTab.hidden = !show;
}

// ==================================================================
// SUMÁRIO LATERAL - scroll-spy dos itens dentro da aba "Perfil"
// (Overview, About, Social, Wallet). Mesmo padrão dos módulos da
// Academy (.toc / .toc__indicator via IntersectionObserver).
// ==================================================================

let profileTocInitialized = false;

function initProfileToc() {
    if (profileTocInitialized) return;
    profileTocInitialized = true;

    const sections = Array.from(document.querySelectorAll(".profile-toc-section[id]"));
    const tocLinks = Array.from(document.querySelectorAll("#profileTocList a[href^='#']"));
    const indicator = document.getElementById("profileTocIndicator");
    const listWrap = document.getElementById("profileTocListWrap");
    const sidebar = document.getElementById("profileSidebar");

    if (!sections.length || !tocLinks.length) return;

    const linkBySectionId = {};
    tocLinks.forEach((link) => {
        const id = link.getAttribute("href").replace("#", "");
        linkBySectionId[id] = link;
    });

    let currentActiveId = null;
    let suppressObserverUntil = 0;

    function setActive(id) {
        if (!id || id === currentActiveId || !linkBySectionId[id]) return;
        currentActiveId = id;

        tocLinks.forEach((link) => link.classList.remove("is-active"));
        const activeLink = linkBySectionId[id];
        activeLink.classList.add("is-active");

        moveIndicator(activeLink);
        scrollSidebarToActive(activeLink);
    }

    function moveIndicator(activeLink) {
        if (!indicator || !listWrap) return;
        const wrapRect = listWrap.getBoundingClientRect();
        const linkRect = activeLink.getBoundingClientRect();
        const offsetTop = linkRect.top - wrapRect.top + listWrap.scrollTop;

        indicator.style.transform = `translateY(${offsetTop}px)`;
        indicator.style.height = `${linkRect.height}px`;
        listWrap.classList.add("is-tracking");
    }

    function scrollSidebarToActive(activeLink) {
        if (!sidebar || window.matchMedia("(min-width: 901px)").matches) return;
        activeLink.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }

    const observer = new IntersectionObserver(
        (entries) => {
            if (Date.now() < suppressObserverUntil) return;

            const visible = entries
                .filter((entry) => entry.isIntersecting)
                .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

            if (visible.length > 0) {
                setActive(visible[0].target.id);
            }
        },
        {
            rootMargin: "-15% 0px -55% 0px",
            threshold: [0, 0.25, 0.5, 0.75, 1],
        },
    );

    sections.forEach((section) => observer.observe(section));
    setActive(sections[0].id);

    // Clicar no sumário marca a seção como ativa na hora, e SUSPENDE
    // o observer por um instante - sem isso, o observer costuma
    // "corrigir de volta" a seção errada logo depois do clique, perto
    // do fim da página. Ver histórico desta correção em versões
    // anteriores deste arquivo se precisar entender o motivo a fundo.
    tocLinks.forEach((link) => {
        link.addEventListener("click", () => {
            const id = link.getAttribute("href").replace("#", "");
            suppressObserverUntil = Date.now() + 1000;
            setActive(id);
        });
    });

    window.addEventListener("resize", () => {
        if (currentActiveId && linkBySectionId[currentActiveId]) {
            moveIndicator(linkBySectionId[currentActiveId]);
        }
    });
}

// ==================================================================
// HISTÓRICO DE PARTIDAS - busca em match_history (própria conta,
// como jogador e como host), filtrável por jogo. Ver
// docs/MATCH_HISTORY_ARCHITECTURE.md.
// ==================================================================

const GAME_DISPLAY_NAMES = {
    time_attack: "Time Attack",
    show_down: "Show Down",
    tap_rush: "Tap Rush",
    roulette: "Roulette",
};

let historyRows = [];
let historyFilter = "all";
let historyRoleFilter = "all";

async function loadMatchHistory() {
    const { data, error } = await supabaseClient
        .from("match_history")
        .select("*")
        .eq("user_id", currentUserId)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Erro ao carregar histórico:", error);
        return;
    }

    historyRows = data || [];
    renderHistoryList();
}

function formatHistoryDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
}

function renderHistoryList() {
    const container = document.getElementById("history-list");
    const emptyEl = document.getElementById("history-empty");
    if (!container) return;

    const filtered = historyRows.filter((r) => {
        const matchesGame = historyFilter === "all" || r.game === historyFilter;
        const matchesRole = historyRoleFilter === "all" || r.role === historyRoleFilter;
        return matchesGame && matchesRole;
    });

    container.innerHTML = "";

    if (filtered.length === 0) {
        if (emptyEl) emptyEl.hidden = false;
        return;
    }
    if (emptyEl) emptyEl.hidden = true;

    // Agrupa por sala (jogo + room_code) - reportado ao vivo: com
    // várias rodadas na mesma sala (replay controlado pelo host,
    // Time Attack), cada rodada virou uma linha própria de histórico,
    // e listar tudo solto ficava uma bagunça com vários jogadores.
    // Cada grupo vira UMA linha na tela, expandindo pra ver o
    // detalhe - mesmo padrão que já existia pra Host, agora também
    // pra várias rodadas de jogador na mesma sala.
    const groups = new Map();
    filtered.forEach((row) => {
        const key = `${row.game}:${row.room_code}`;
        if (!groups.has(key))
            groups.set(key, {
                game: row.game,
                room_code: row.room_code,
                hostRow: null,
                playerRows: [],
            });
        const group = groups.get(key);
        if (row.role === "host") {
            group.hostRow = row;
        } else {
            group.playerRows.push(row);
        }
    });

    const sortedGroups = [...groups.values()].sort((a, b) => {
        const aLatest = Math.max(
            ...[a.hostRow, ...a.playerRows]
                .filter(Boolean)
                .map((r) => new Date(r.created_at).getTime()),
        );
        const bLatest = Math.max(
            ...[b.hostRow, ...b.playerRows]
                .filter(Boolean)
                .map((r) => new Date(r.created_at).getTime()),
        );
        return bLatest - aLatest;
    });

    sortedGroups.forEach((group) => {
        group.playerRows.sort((a, b) => (a.round_number || 0) - (b.round_number || 0));
        renderHistoryGroup(container, group);
    });
}

function renderHistoryGroup(container, group) {
    const { game, room_code, hostRow, playerRows } = group;
    const gameName = GAME_DISPLAY_NAMES[game] || game;
    const isMultiRound = playerRows.length > 1;
    const isExpandable = !!hostRow || isMultiRound;

    const latestRow = [hostRow, ...playerRows]
        .filter(Boolean)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

    const item = document.createElement("div");
    item.className = "profile-history-item";

    const el = document.createElement("div");
    el.className = "profile-history-row";
    if (isExpandable) el.className += " is-clickable";

    const icon = document.createElement("div");
    icon.className = "profile-history-row-icon";
    icon.textContent = hostRow ? "H" : "P";

    const main = document.createElement("div");
    main.className = "profile-history-row-main";

    const gameEl = document.createElement("div");
    gameEl.className = "profile-history-row-game";
    gameEl.textContent = gameName;

    const roleLabel = hostRow
        ? window.nodraTranslator?.translations?.["profile.historyRoleHost"] || "Host"
        : window.nodraTranslator?.translations?.["profile.historyRolePlayer"] || "Player";

    const metaEl = document.createElement("div");
    metaEl.className = "profile-history-row-meta";
    const roundsSuffix = isMultiRound
        ? ` · ${playerRows.length} ${window.nodraTranslator?.translations?.["profile.historyRoundsCount"] || "rounds"}`
        : "";
    metaEl.textContent = `${roleLabel} · ${room_code} · ${formatHistoryDate(latestRow.created_at)}${roundsSuffix}`;

    main.appendChild(gameEl);
    main.appendChild(metaEl);

    const resultEl = document.createElement("div");
    resultEl.className = "profile-history-row-result";
    // Resultado único só faz sentido mostrar direto quando não é nem
    // host nem várias rodadas - o caso normal de 1 rodada só.
    if (!hostRow && !isMultiRound) {
        const resultText = formatResultText(playerRows[0]);
        if (resultText) {
            const strong = document.createElement("strong");
            strong.textContent = resultText;
            resultEl.appendChild(strong);
        }
    }

    el.appendChild(icon);
    el.appendChild(main);
    el.appendChild(resultEl);

    if (isExpandable) {
        const chevron = document.createElement("span");
        chevron.className = "profile-history-row-chevron";
        chevron.textContent = "›";
        el.appendChild(chevron);
    }

    item.appendChild(el);

    if (isExpandable) {
        const detail = document.createElement("div");
        detail.className = "profile-history-detail";
        detail.hidden = true;
        item.appendChild(detail);

        let loaded = false;

        el.addEventListener("click", async () => {
            const opening = detail.hidden;
            detail.hidden = !detail.hidden;
            el.classList.toggle("is-open", opening);

            if (!opening || loaded) return;
            loaded = true;

            if (hostRow) {
                detail.innerHTML = `<p class="profile-history-detail-loading" data-i18n="profile.historyDetailLoading">Loading...</p>`;
                const participants = await loadRoomParticipants(game, room_code);
                detail.innerHTML = "";

                const participantsContainer = document.createElement("div");
                detail.appendChild(participantsContainer);
                renderRoomParticipants(participantsContainer, participants);

                // Se a pessoa também jogou na própria sala (não só
                // hospedou), mostra as rodadas dela também - sem isso,
                // esse detalhe se perdia por completo, mesmo o rótulo
                // já indicando "X rodadas".
                if (playerRows.length > 0) {
                    const ownRoundsLabel = document.createElement("p");
                    ownRoundsLabel.className = "profile-history-detail-subheading";
                    ownRoundsLabel.textContent =
                        window.nodraTranslator?.translations?.["profile.historyYourRounds"] ||
                        "Your rounds";
                    detail.appendChild(ownRoundsLabel);

                    const ownRoundsContainer = document.createElement("div");
                    detail.appendChild(ownRoundsContainer);
                    renderRoundsBreakdown(ownRoundsContainer, playerRows);
                }
            } else {
                renderRoundsBreakdown(detail, playerRows);
            }
        });
    }

    container.appendChild(item);
}

function formatResultText(row) {
    if (row.placement) return `#${row.placement}`;
    if (row.details?.correct_answers !== undefined) return `${row.details.correct_answers} ✓`;
    if (row.details?.total_score !== undefined) return `${row.details.total_score} pts`;
    if (row.details?.tap_count !== undefined) return `${row.details.tap_count} taps`;
    return "";
}

function renderRoundsBreakdown(container, playerRows) {
    container.innerHTML = "";

    playerRows.forEach((row) => {
        const line = document.createElement("div");
        line.className = "profile-history-detail-row";

        const label = document.createElement("span");
        label.className = "profile-history-detail-name";
        const roundLabel =
            window.nodraTranslator?.translations?.["profile.historyRoundLabel"] || "Round";
        label.textContent = `${roundLabel} ${row.round_number || "?"}`;

        const result = document.createElement("span");
        result.className = "profile-history-detail-result";
        result.textContent = formatResultText(row);

        line.appendChild(label);
        line.appendChild(result);
        container.appendChild(line);
    });
}

// Junta quem jogou numa sala específica hospedada por mim - logados
// vêm de match_history (público, com username via profiles_public),
// anônimos vêm de guest_participants (só o host vê, RLS já garante
// isso). É pra isso que o histórico existe: poder abrir a sala que
// hospedei e ver quem jogou e o resultado, pra futuramente mandar
// prêmio. Quando a integração onchain existir, o hash que prova a
// partida entra aqui também.
async function loadRoomParticipants(game, roomCode) {
    const [historyResult, guestResult] = await Promise.all([
        supabaseClient
            .from("match_history")
            .select("user_id, placement, details, round_number")
            .eq("game", game)
            .eq("room_code", roomCode)
            .eq("role", "player"),
        supabaseClient
            .from("guest_participants")
            .select("nickname, placement, details, round_number")
            .eq("game", game)
            .eq("room_code", roomCode),
    ]);

    const playerRows = historyResult.data || [];
    const guestRows = guestResult.data || [];

    let usernameMap = {};
    if (playerRows.length > 0) {
        const userIds = playerRows.map((p) => p.user_id);
        const { data: profiles } = await supabaseClient
            .from("profiles_public")
            .select("id, username")
            .in("id", userIds);
        (profiles || []).forEach((p) => {
            usernameMap[p.id] = p.username;
        });
    }

    // Agrupa por RODADA, não por pessoa - mostra o ranking completo
    // de cada rodada, um bloco por vez (Rodada 1: ranking completo,
    // Rodada 2: ranking completo...), em vez de cada pessoa com as
    // próprias rodadas dentro. Responde direto "quem ganhou a rodada
    // X", que é a pergunta mais natural pra quem hospedou.
    const roundGroups = new Map();

    playerRows.forEach((p) => {
        const key = p.round_number ?? 0;
        if (!roundGroups.has(key)) roundGroups.set(key, []);
        roundGroups
            .get(key)
            .push({
                name: usernameMap[p.user_id] || "?",
                isGuest: false,
                placement: p.placement,
                details: p.details,
            });
    });

    guestRows.forEach((g) => {
        const key = g.round_number ?? 0;
        if (!roundGroups.has(key)) roundGroups.set(key, []);
        roundGroups
            .get(key)
            .push({ name: g.nickname, isGuest: true, placement: g.placement, details: g.details });
    });

    roundGroups.forEach((list) => list.sort((a, b) => (a.placement || 999) - (b.placement || 999)));

    const rounds = [...roundGroups.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([roundNumber, participants]) => ({ roundNumber, participants }));

    return rounds;
}

function renderRoomParticipants(container, rounds) {
    if (rounds.length === 0) {
        container.innerHTML = `<p class="profile-history-detail-empty" data-i18n="profile.historyDetailEmpty">No participants recorded.</p>`;
        window.nodraTranslator?.translatePage();
        return;
    }

    container.innerHTML = "";

    const formatResult = (p) => {
        if (p.placement) return `#${p.placement}`;
        if (p.details?.correct_answers !== undefined) return `${p.details.correct_answers} ✓`;
        if (p.details?.total_score !== undefined) return `${p.details.total_score} pts`;
        if (p.details?.tap_count !== undefined) return `${p.details.tap_count} taps`;
        return "";
    };

    const showRoundLabel = rounds.length > 1;

    rounds.forEach((round) => {
        const block = document.createElement("div");
        block.className = "profile-history-round-block";

        if (showRoundLabel) {
            const heading = document.createElement("p");
            heading.className = "profile-history-detail-subheading";
            // round_number 0 é o grupo de fallback (p.round_number ?? 0)
            // - junta quem só tem linha de "participou da sala" (join,
            // sem round_number, sem resultado ainda), não uma rodada de
            // verdade. Bug real reportado ao vivo: isso aparecia rotulado
            // "Round 1", confundindo com a rodada 1 de verdade (que tem
            // seu próprio bloco, com round_number = 1 e resultado).
            const roundLabelText = round.roundNumber === 0
                ? (window.nodraTranslator?.translations?.["profile.historyParticipantsLabel"] || "Participants")
                : `${window.nodraTranslator?.translations?.["profile.historyRoundLabel"] || "Round"} ${round.roundNumber}`;
            heading.textContent = roundLabelText;
            block.appendChild(heading);
        }

        round.participants.forEach((p) => {
            const row = document.createElement("div");
            row.className = "profile-history-detail-row";

            // Nome vem de texto livre digitado por guest em alguns
            // casos - nunca via innerHTML, sempre textContent/DOM.
            // Logado com username de verdade vira link pro perfil
            // público, em nova aba - guest não tem perfil pra abrir,
            // fica só texto.
            const nameSpan = document.createElement("span");
            nameSpan.className = "profile-history-detail-name";

            if (!p.isGuest && p.name && p.name !== "?") {
                const link = document.createElement("a");
                link.href = `perfil.html?u=${encodeURIComponent(p.name)}`;
                link.target = "_blank";
                link.rel = "noopener noreferrer";
                link.textContent = p.name;
                nameSpan.appendChild(link);
            } else {
                nameSpan.textContent = p.name;
            }

            if (p.isGuest) {
                const guestTag = document.createElement("span");
                guestTag.className = "profile-history-detail-guest-tag";
                guestTag.textContent =
                    window.nodraTranslator?.translations?.["profile.historyGuestTag"] || "guest";
                nameSpan.appendChild(document.createTextNode(" "));
                nameSpan.appendChild(guestTag);
            }

            const resultSpan = document.createElement("span");
            resultSpan.className = "profile-history-detail-result";
            resultSpan.textContent = formatResult(p);

            row.appendChild(nameSpan);
            row.appendChild(resultSpan);
            block.appendChild(row);
        });

        container.appendChild(block);
    });
}

document.getElementById("history-filters")?.addEventListener("click", (event) => {
    const btn = event.target.closest(".profile-history-filter");
    if (!btn) return;

    // Escopo só neste grupo de botões - sem isso, clicar aqui também
    // tirava o "ativo" do outro filtro (papel), já que os dois usam
    // a mesma classe.
    event.currentTarget
        .querySelectorAll(".profile-history-filter")
        .forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");

    historyFilter = btn.dataset.game;
    renderHistoryList();
});

document.getElementById("history-role-filters")?.addEventListener("click", (event) => {
    const btn = event.target.closest(".profile-history-filter");
    if (!btn) return;

    event.currentTarget
        .querySelectorAll(".profile-history-filter")
        .forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");

    historyRoleFilter = btn.dataset.role;
    renderHistoryList();
});

// ==================================================================
// BOOT
// ==================================================================
// ABA VIP - criar badge (nome + imagem + formato + cor) e conceder
// um badge existente pra alguém. Ver
// docs/BADGE_INTEGRITY_ARCHITECTURE.md, Path 2. O "recorte" em
// formato de escudo é só CSS (clip-path), aplicado toda vez que o
// badge é exibido - a imagem enviada nunca é editada de verdade,
// fica intacta no armazenamento.
// ==================================================================

const BADGE_COLORS = [
    "#1a2942",
    "#7c3aed",
    "#c084fc",
    "#ef4444",
    "#f59e0b",
    "#22c55e",
    "#0ea5e9",
    "#ec4899",
    "#64748b",
    "#0f172a",
];
// Ícones de verdade (Lucide, vetorial) em vez de emoji - reportado ao
// vivo: emoji renderiza diferente em cada sistema/navegador, nunca
// fica consistente. Cada um é só o conteúdo interno do SVG (paths),
// envolvido pelo mesmo wrapper na hora de desenhar - todos usam
// stroke="currentColor", então a cor do "traço gravado" vem de fora,
// via CSS, não fica fixa no ícone.
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

function buildIconSvg(iconKey) {
    const inner = BADGE_ICONS[iconKey];
    if (!inner) return "";
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}

// --------------------------------------------------------
// Meus badges - mostra tudo que a própria pessoa ganhou, com uma
// caixa de marcar em cada um pra escolher quais aparecem no card
// público (perfil.html). Reportado ao vivo: essa seção nunca tinha
// sido construída aqui, só no perfil público (read-only).
// --------------------------------------------------------

// Constrói o elemento visual de um badge (escudo pequeno, imagem OU
// ícone) - reaproveitado em toda tela que mostra badge em tamanho
// pequeno (quadro de curadoria, tira do card do topo, "meus badges
// criados"), pra não repetir a mesma lógica em 3 lugares.
function buildSmallBadgeElement(badge) {
    const badgeEl = document.createElement("div");
    if (badge.image_url) {
        // Imagem própria já vem com a forma e o fundo dela desenhados
        // - não aplica recorte nem cor de fundo por cima, bug real
        // reportado ao vivo: um "anel" da cor da badge aparecia em
        // volta de uma arte que já tinha fundo transparente e moldura
        // própria (o recorte da badge não batia pixel a pixel com o
        // hexágono já desenhado na imagem).
        badgeEl.className = "badge badge--small badge--image";
    } else {
        badgeEl.className = `badge badge--small badge--${badge.badge_shape}`;
        badgeEl.style.background = badge.background_color;
    }

    if (badge.image_url) {
        const img = document.createElement("img");
        img.src = badge.image_url;
        img.alt = "";
        badgeEl.appendChild(img);
    } else if (badge.icon) {
        const iconSpan = document.createElement("span");
        iconSpan.className = "badge-icon";
        iconSpan.innerHTML = buildIconSvg(badge.icon);
        iconSpan.style.color = badge.icon_color || badge.background_color;
        const sizePx = Math.round(78 * ((badge.icon_size || 35) / 100));
        iconSpan.style.width = `${sizePx}px`;
        iconSpan.style.height = `${sizePx}px`;
        badgeEl.appendChild(iconSpan);
    }

    return badgeEl;
}

// Tira compacta de badges no card do topo (perto do avatar/nome) -
// reportado ao vivo: badge aparecia no quadro de curadoria mais
// abaixo, mas não aqui. Mesma regra do perfil público: se a pessoa já
// escolheu quais destacar, mostra só esses; se ainda não escolheu
// nenhum, mostra todos (senão o card ficaria vazio à toa logo depois
// de ganhar o primeiro badge).
function renderHeaderBadgeStrip(rows, featuredIds) {
    const stripEl = document.getElementById("profile-header-badges");
    if (!stripEl) return;

    stripEl.innerHTML = "";

    const featuredSet = new Set(featuredIds);
    const rowsToShow =
        featuredSet.size > 0 ? rows.filter((row) => featuredSet.has(row.badge_id)) : rows;

    rowsToShow.forEach((row) => {
        const badge = row.badges;
        if (!badge) return;
        stripEl.appendChild(buildSmallBadgeElement(badge));
    });
}

async function loadOwnBadges(userId, featuredIds) {
    const listEl = document.getElementById("profile-own-badges-list");
    const emptyEl = document.getElementById("profile-own-badges-empty");
    if (!listEl || !emptyEl) return;

    const { data, error } = await supabaseClient
        .from("user_badges")
        .select(
            "badge_id, granted_at, badges(slug, name_pt, name_en, description_pt, description_en, badge_shape, background_color, image_url, icon, icon_color, icon_size)",
        )
        .eq("user_id", userId)
        .order("granted_at", { ascending: false });

    if (error) {
        console.error("Erro ao carregar meus badges:", error);
    }

    if (error || !data || data.length === 0) {
        emptyEl.hidden = false;
        listEl.innerHTML = "";
        renderHeaderBadgeStrip([], featuredIds);
        return;
    }

    emptyEl.hidden = true;
    listEl.innerHTML = "";

    renderHeaderBadgeStrip(data, featuredIds);

    const lang = document.documentElement.lang === "en" ? "en" : "pt";
    const featuredSet = new Set(featuredIds);

    data.forEach((row) => {
        const badge = row.badges;
        if (!badge) return;

        const wrapper = document.createElement("label");
        wrapper.className = "profile-own-badge-item";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = featuredSet.has(row.badge_id);
        checkbox.addEventListener("change", () =>
            toggleFeaturedBadge(row.badge_id, checkbox.checked),
        );

        const card = document.createElement("div");
        card.className = "badge-card badge-card--small";

        const badgeEl = buildSmallBadgeElement(badge);

        const title = document.createElement("span");
        title.className = "badge-card-title";
        title.textContent = lang === "en" ? badge.name_en : badge.name_pt;

        card.appendChild(badgeEl);
        card.appendChild(title);

        wrapper.appendChild(checkbox);
        wrapper.appendChild(card);
        listEl.appendChild(wrapper);
    });

    // Guarda pra re-renderizar a tira do topo sem precisar buscar de
    // novo no banco, toda vez que uma caixa de marcar mudar.
    lastLoadedBadgeRows = data;
}

let lastLoadedBadgeRows = [];

async function toggleFeaturedBadge(badgeId, isChecked) {
    const current = new Set(currentProfile?.featured_badge_ids || []);
    if (isChecked) {
        current.add(badgeId);
    } else {
        current.delete(badgeId);
    }

    const newList = [...current];

    const { error } = await supabaseClient
        .from("profiles")
        .update({ featured_badge_ids: newList })
        .eq("id", currentUserId);

    if (error) {
        console.error("Erro ao salvar badges em destaque:", error);
        return;
    }

    if (currentProfile) currentProfile.featured_badge_ids = newList;

    renderHeaderBadgeStrip(lastLoadedBadgeRows, newList);
}

const badgeNameInput = document.getElementById("badge-name");
const badgeDescriptionInput = document.getElementById("badge-description");
const badgeShapeSelect = document.getElementById("badge-shape");
const badgeColorPalette = document.getElementById("badge-color-palette");
const badgeIconPalette = document.getElementById("badge-icon-palette");
const badgeIconColorPalette = document.getElementById("badge-icon-color-palette");
const badgeImageInput = document.getElementById("badge-image");
const badgePreview = document.getElementById("badge-preview");
const badgePreviewImg = document.getElementById("badge-preview-img");
const badgePreviewIcon = document.getElementById("badge-preview-icon");
const badgePreviewName = document.getElementById("badge-preview-name");
const badgePreviewDesc = document.getElementById("badge-preview-desc");
const createBadgeForm = document.getElementById("create-badge-form");
const createBadgeBtn = document.getElementById("create-badge-btn");
const createBadgeStatus = document.getElementById("create-badge-status");

let pendingBadgeImageFile = null;
let selectedBadgeColor = BADGE_COLORS[0];
let selectedBadgeIcon = null;
// Cor do ÍCONE, separada da cor de fundo - reportado ao vivo: antes
// era a mesma cor pras duas coisas, e escolher um ícone reciclava a
// cor de fundo pra dentro do traço, perdendo o fundo que já tinha
// sido escolhido. Agora os dois são independentes, dá pra combinar
// qualquer par.
let selectedIconColor = BADGE_COLORS[1];
let selectedIconSize = 35; // porcentagem do tamanho do escudo - escala certo em qualquer contexto (tela de criar em tamanho cheio, versão pequena do perfil)

const badgeIconSizeInput = document.getElementById("badge-icon-size");
badgeIconSizeInput?.addEventListener("input", () => {
    selectedIconSize = Number(badgeIconSizeInput.value);
    updateBadgePreview();
});

// Paleta de cores fixa em vez do seletor nativo do sistema - evitou
// dois problemas reportados ao vivo: o botão minúsculo/cortado do
// <input type="color">, e o conta-gotas nativo do navegador saindo
// pra capturar cor de fora da própria janela (comportamento do
// sistema operacional, sentido como invasivo). Genérica agora - a
// mesma função desenha tanto a paleta de fundo quanto a de ícone,
// já que os dois viraram independentes.
function renderGenericColorPalette(container, currentValue, onPick, colors = BADGE_COLORS) {
    if (!container) return;
    container.innerHTML = "";
    colors.forEach((color) => {
        const swatch = document.createElement("button");
        swatch.type = "button";
        swatch.className = "vip-color-swatch";
        if (color === currentValue) swatch.classList.add("is-selected");
        swatch.style.background = color;
        swatch.setAttribute("aria-label", color);
        swatch.addEventListener("click", () => onPick(color));
        container.appendChild(swatch);
    });
}

function renderColorPalette() {
    renderGenericColorPalette(badgeColorPalette, selectedBadgeColor, (color) => {
        selectedBadgeColor = color;
        renderColorPalette();
        updateBadgePreview();
    });
}

function renderIconColorPalette() {
    renderGenericColorPalette(badgeIconColorPalette, selectedIconColor, (color) => {
        selectedIconColor = color;
        renderIconColorPalette();
        updateBadgePreview();
    });
}

// Modelo "conquista de RPG" - a imagem enviada aparece inteira, sem
// nada escrito por cima dela (era assim antes: o nome ficava
// sobreposto na imagem, mal posicionado e cobrindo parte do
// desenho). Nome e descrição agora são legenda normal, embaixo do
// escudo, texto solto.
function updateBadgePreview() {
    if (!badgePreview) return;

    const hasIcon = !pendingBadgeImageFile && selectedBadgeIcon;

    if (pendingBadgeImageFile) {
        // Imagem própria já vem com a forma e o fundo dela desenhados
        // - mesma correção usada na exibição de verdade (ver
        // buildSmallBadgeElement), aplicada aqui também pro preview
        // já mostrar exatamente como vai ficar.
        badgePreview.className = "badge badge--image";
        badgePreview.style.background = "none";
    } else {
        badgePreview.className = `badge badge--${badgeShapeSelect.value}`;
        // Fundo sempre é a cor de fundo escolhida - reportado ao vivo: a
        // versão anterior forçava um cinza fixo assim que um ícone era
        // selecionado, e não dava pra escolher fundo e cor do ícone ao
        // mesmo tempo. Agora os dois são independentes: o painel do
        // ícone (mais abaixo) tem a própria paleta pra isso.
        badgePreview.style.background = selectedBadgeColor;
    }

    badgePreviewName.textContent = badgeNameInput.value;
    badgePreviewDesc.textContent = badgeDescriptionInput.value;

    if (hasIcon) {
        badgePreviewIcon.innerHTML = buildIconSvg(selectedBadgeIcon);
        badgePreviewIcon.style.color = selectedIconColor;
        const sizePx = Math.round(200 * (selectedIconSize / 100)); // 200px = tamanho do escudo na tela de criar
        badgePreviewIcon.style.width = `${sizePx}px`;
        badgePreviewIcon.style.height = `${sizePx}px`;
        badgePreviewIcon.hidden = false;
    } else {
        badgePreviewIcon.hidden = true;
    }
}

function renderIconPalette() {
    if (!badgeIconPalette) return;
    badgeIconPalette.innerHTML = "";
    Object.keys(BADGE_ICONS).forEach((iconKey) => {
        const swatch = document.createElement("button");
        swatch.type = "button";
        swatch.className = "vip-icon-swatch";
        if (iconKey === selectedBadgeIcon) swatch.classList.add("is-selected");
        swatch.innerHTML = buildIconSvg(iconKey);
        swatch.addEventListener("click", () => {
            // Clicar no mesmo ícone de novo desmarca - nem imagem
            // nem ícone são obrigatórios, precisa dar pra "desfazer".
            selectedBadgeIcon = selectedBadgeIcon === iconKey ? null : iconKey;
            // Escolher um ícone descarta uma imagem enviada - os dois
            // são mutuamente exclusivos, escolher um limpa o outro.
            if (selectedBadgeIcon) {
                pendingBadgeImageFile = null;
                badgeImageInput.value = "";
                badgePreviewImg.hidden = true;
            }
            renderIconPalette();
            updateBadgePreview();
        });
        badgeIconPalette.appendChild(swatch);
    });
}

[badgeNameInput, badgeDescriptionInput, badgeShapeSelect].forEach((el) => {
    el?.addEventListener("input", updateBadgePreview);
});

badgeImageInput?.addEventListener("change", () => {
    const file = badgeImageInput.files?.[0];
    if (!file) {
        pendingBadgeImageFile = null;
        badgePreviewImg.hidden = true;
        updateBadgePreview();
        return;
    }

    if (file.type !== "image/png") {
        createBadgeStatus.textContent =
            window.nodraTranslator?.translations?.["vip.pngOnly"] || "Please choose a PNG file.";
        createBadgeStatus.className = "vip-badge-status is-error";
        badgeImageInput.value = "";
        pendingBadgeImageFile = null;
        return;
    }

    // Enviar uma imagem descarta um ícone genérico escolhido antes -
    // mutuamente exclusivos, igual ao caminho inverso.
    selectedBadgeIcon = null;
    renderIconPalette();

    pendingBadgeImageFile = file;
    const reader = new FileReader();
    reader.onload = () => {
        badgePreviewImg.src = reader.result;
        badgePreviewImg.hidden = false;
        updateBadgePreview();
    };
    reader.readAsDataURL(file);
});

function generateBadgeSlug(name) {
    const base =
        (name || "badge")
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "") || "badge";
    const suffix = crypto.randomUUID().slice(0, 8);
    return `${base}-${suffix}`;
}

createBadgeForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    createBadgeStatus.textContent = "";
    createBadgeStatus.className = "vip-badge-status";

    createBadgeBtn.disabled = true;

    const slug = generateBadgeSlug(badgeNameInput.value);

    // Imagem é opcional - reportado ao vivo: precisa dar pra criar
    // um badge só com cor e formato, sem imagem nenhuma (e também dá
    // pra usar um ícone genérico em vez de enviar arquivo - os dois
    // são mutuamente exclusivos, nunca os dois juntos). Só faz
    // upload de verdade se realmente tiver um arquivo pendente.
    let imageUrl = null;

    if (pendingBadgeImageFile) {
        const fileName = `${slug}.png`;

        const { error: uploadError } = await supabaseClient.storage
            .from("badge-images")
            .upload(fileName, pendingBadgeImageFile, { contentType: "image/png" });

        if (uploadError) {
            console.error("Erro ao enviar imagem do badge:", uploadError);
            createBadgeStatus.textContent =
                window.nodraTranslator?.translations?.["vip.uploadFailed"] ||
                "Failed to upload image.";
            createBadgeStatus.className = "vip-badge-status is-error";
            createBadgeBtn.disabled = false;
            return;
        }

        const { data: publicUrlData } = supabaseClient.storage
            .from("badge-images")
            .getPublicUrl(fileName);

        imageUrl = publicUrlData.publicUrl;
    }

    // Badge de comunidade não distingue pt/en - o mesmo nome único
    // vai pros dois campos internos, que continuam existindo pra
    // quando os badges "oficiais"/protocolo (com pt/en de verdade)
    // forem criados depois, por outro caminho.
    const { error: insertError } = await supabaseClient.from("badges").insert({
        slug,
        name_pt: badgeNameInput.value,
        name_en: badgeNameInput.value,
        description_pt: badgeDescriptionInput.value || null,
        description_en: badgeDescriptionInput.value || null,
        badge_shape: badgeShapeSelect.value,
        background_color: selectedBadgeColor,
        image_url: imageUrl,
        icon: imageUrl ? null : selectedBadgeIcon,
        icon_color: imageUrl ? null : selectedBadgeIcon ? selectedIconColor : null,
        icon_size: imageUrl ? undefined : selectedBadgeIcon ? selectedIconSize : undefined,
        created_by: currentUserId,
        source: "community",
    });

    createBadgeBtn.disabled = false;

    if (insertError) {
        console.error("Erro ao criar badge:", insertError);
        createBadgeStatus.textContent =
            window.nodraTranslator?.translations?.["vip.createFailed"] || "Failed to create badge.";
        createBadgeStatus.className = "vip-badge-status is-error";
        return;
    }

    createBadgeStatus.textContent =
        window.nodraTranslator?.translations?.["vip.createSuccess"] || "Badge created!";
    createBadgeStatus.className = "vip-badge-status is-success";
    createBadgeForm.reset();
    pendingBadgeImageFile = null;
    badgePreviewImg.hidden = true;
    selectedBadgeColor = BADGE_COLORS[0];
    selectedIconColor = BADGE_COLORS[1];
    selectedIconSize = 35;
    selectedBadgeIcon = null;
    renderColorPalette();
    renderIconPalette();
    renderIconColorPalette();
    updateBadgePreview();
    loadBadgesIntoGrantSelect();
});

// --------------------------------------------------------
// Conceder badge - agora suporta VÁRIOS badges pra VÁRIAS pessoas de
// uma vez (reportado ao vivo). Busca por nome enquanto digita, cada
// resultado CLICADO vira um "chip" removível na lista de
// destinatários (não trava mais um só). Badges viram caixas de
// marcar, não um <select> de opção única. No envio, manda os dois
// arrays pra Edge Function, que faz o produto cartesiano (cada badge
// x cada pessoa) numa chamada só.
// --------------------------------------------------------

const grantBadgeForm = document.getElementById("grant-badge-form");
const grantTargetSearchInput = document.getElementById("grant-target-search");
const grantTargetResults = document.getElementById("grant-target-results");
const grantTargetChipsEl = document.getElementById("grant-target-chips");
const grantBadgeCheckboxesEl = document.getElementById("grant-badge-checkboxes");
const grantNoteInput = document.getElementById("grant-note");
const grantBadgeBtn = document.getElementById("grant-badge-btn");
const grantBadgeStatus = document.getElementById("grant-badge-status");

// Map<userId, username> - preserva a ordem de adição, e permite
// remover um específico sem perder os outros.
let grantSelectedTargets = new Map();

async function loadBadgesIntoGrantSelect() {
    if (!grantBadgeCheckboxesEl) return;

    // Só os badges que ESSE VIP criou - reportado ao vivo: badge de
    // um VIP aparecia na lista de conceder de outro VIP, deixando
    // qualquer um mandar o badge que não era dele. Mesma regra já
    // usada em "Meus Badges Criados".
    const { data, error } = await supabaseClient
        .from("badges")
        .select("slug, name_pt, name_en")
        .eq("created_by", currentUserId)
        .order("name_pt");

    if (error) {
        console.error("Erro ao carregar badges:", error);
        return;
    }

    const lang = document.documentElement.lang === "en" ? "en" : "pt";
    grantBadgeCheckboxesEl.innerHTML = "";

    (data || []).forEach((badge) => {
        const label = document.createElement("label");
        label.className = "vip-grant-badge-checkbox-item";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = badge.slug;
        checkbox.addEventListener("change", updateGrantButtonState);

        const text = document.createElement("span");
        text.textContent = lang === "en" ? badge.name_en : badge.name_pt;

        label.appendChild(checkbox);
        label.appendChild(text);
        grantBadgeCheckboxesEl.appendChild(label);
    });
}

function updateGrantButtonState() {
    const anyBadgeChecked = !!grantBadgeCheckboxesEl?.querySelector('input[type="checkbox"]:checked');
    grantBadgeBtn.disabled = !(grantSelectedTargets.size > 0 && anyBadgeChecked);
}

function renderGrantTargetChips() {
    grantTargetChipsEl.innerHTML = "";
    grantSelectedTargets.forEach((username, userId) => {
        const chip = document.createElement("span");
        chip.className = "vip-target-chip";

        const label = document.createElement("span");
        label.textContent = username;

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "vip-target-chip-remove";
        removeBtn.textContent = "×";
        removeBtn.addEventListener("click", () => {
            grantSelectedTargets.delete(userId);
            renderGrantTargetChips();
            updateGrantButtonState();
        });

        chip.appendChild(label);
        chip.appendChild(removeBtn);
        grantTargetChipsEl.appendChild(chip);
    });
}

let userSearchDebounce = null;

grantTargetSearchInput?.addEventListener("input", () => {
    const query = grantTargetSearchInput.value.trim();
    if (userSearchDebounce) clearTimeout(userSearchDebounce);

    if (query.length < 2) {
        grantTargetResults.hidden = true;
        return;
    }

    userSearchDebounce = setTimeout(async () => {
        const { data, error } = await supabaseClient
            .from("profiles_public")
            .select("id, username")
            .ilike("username", `%${query}%`)
            .limit(8);

        if (error) {
            console.error("Erro ao buscar usuário pra conceder badge:", error);
        }

        if (error || !data || data.length === 0) {
            grantTargetResults.hidden = true;
            return;
        }

        grantTargetResults.innerHTML = "";
        data
            .filter((profile) => !grantSelectedTargets.has(profile.id)) // já adicionado, não repete na lista
            .forEach((profile) => {
                const item = document.createElement("div");
                item.className = "vip-user-search-result";
                item.textContent = profile.username;
                item.addEventListener("click", () => {
                    grantSelectedTargets.set(profile.id, profile.username);
                    renderGrantTargetChips();
                    updateGrantButtonState();
                    grantTargetSearchInput.value = "";
                    grantTargetResults.hidden = true;
                });
                grantTargetResults.appendChild(item);
            });
        grantTargetResults.hidden = grantTargetResults.children.length === 0;
    }, 300);
});

grantBadgeForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    grantBadgeStatus.textContent = "";
    grantBadgeStatus.className = "vip-badge-status";

    const targetUserIds = [...grantSelectedTargets.keys()];
    const badgeSlugs = [...grantBadgeCheckboxesEl.querySelectorAll('input[type="checkbox"]:checked')].map(
        (cb) => cb.value,
    );

    if (targetUserIds.length === 0 || badgeSlugs.length === 0) {
        grantBadgeStatus.textContent =
            window.nodraTranslator?.translations?.["vip.userNotFound"] ||
            "Select at least one user and one badge.";
        grantBadgeStatus.className = "vip-badge-status is-error";
        return;
    }

    grantBadgeBtn.disabled = true;

    // Reportado ao vivo: o botão ficava travado pra sempre depois de
    // clicar em "Conceder". Causa real: se o fetch falhasse por
    // qualquer motivo (rede, CORS, resposta que não é JSON válido), a
    // exceção nunca era capturada, e a linha que reabilita o botão
    // nunca rodava. try/catch garante que o botão SEMPRE volta a
    // ficar clicável, com ou sem erro, e o erro real vai pro console
    // em vez de desaparecer silenciosamente.
    try {
        const {
            data: { session },
        } = await supabaseClient.auth.getSession();

        const response = await fetch(`${window.nodraSupabaseUrl}/functions/v1/vip-grant-badge`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
                targetUserIds,
                badgeSlugs,
                note: grantNoteInput.value || undefined,
            }),
        });

        const result = await response.json();

        if (result.error) {
            grantBadgeStatus.textContent = result.error;
            grantBadgeStatus.className = "vip-badge-status is-error";
            return;
        }

        const successTemplate =
            window.nodraTranslator?.translations?.["vip.grantBatchSuccess"] ||
            "{granted} badge(s) granted, {skipped} already had it.";
        grantBadgeStatus.textContent = successTemplate
            .replace("{granted}", result.granted)
            .replace("{skipped}", result.skipped);
        grantBadgeStatus.className = "vip-badge-status is-success";

        grantBadgeForm.reset();
        grantSelectedTargets = new Map();
        renderGrantTargetChips();
        grantBadgeCheckboxesEl
            .querySelectorAll('input[type="checkbox"]')
            .forEach((cb) => (cb.checked = false));
    } catch (err) {
        console.error("Erro ao conceder badge:", err);
        grantBadgeStatus.textContent =
            window.nodraTranslator?.translations?.["vip.grantFailed"] ||
            "Something went wrong. Check the console for details.";
        grantBadgeStatus.className = "vip-badge-status is-error";
    } finally {
        updateGrantButtonState();
    }
});


// --------------------------------------------------------
// Sub-abas dentro do VIP - reportado ao vivo: a aba VIP só tinha
// badge antes, precisava de outras coisas relacionadas ao papel de
// VIP também, organizadas em abas próprias (não tudo numa rolagem
// só). Carrega o conteúdo de cada sub-aba só na primeira vez que ela
// é aberta (preguiçoso), não toda vez que a aba VIP principal é
// visitada.
// --------------------------------------------------------

let vipSubTabsInitialized = false;
let myBadgesLoaded = false;
let submittedPacksLoaded = false;
let myThemesLoaded = false;

function initVipSubTabs() {
    if (vipSubTabsInitialized) return;
    vipSubTabsInitialized = true;

    const subtabs = document.querySelectorAll(".vip-subtab");
    const panels = document.querySelectorAll(".vip-subtab-panel");

    subtabs.forEach((btn) => {
        btn.addEventListener("click", () => {
            const target = btn.dataset.vipSubtab;
            subtabs.forEach((b) => b.classList.remove("is-active"));
            btn.classList.add("is-active");
            panels.forEach((p) => {
                p.hidden = p.dataset.vipSubtabPanel !== target;
            });

            if (target === "my-badges" && !myBadgesLoaded) {
                myBadgesLoaded = true;
                loadMyCreatedBadges();
            }
            if (target === "submitted-packs" && !submittedPacksLoaded) {
                submittedPacksLoaded = true;
                loadSubmittedPacksForReview();
            }
            if (target === "themes" && !myThemesLoaded) {
                myThemesLoaded = true;
                loadThemeSlotStatus();
            }
        });
    });
}

// Quadro com os badges que o próprio VIP criou (created_by = ele
// mesmo) - diferente da aba "Conceder", que mostra TODOS os badges
// disponíveis pra dar pra alguém.
async function loadMyCreatedBadges() {
    const listEl = document.getElementById("vip-my-badges-list");
    const emptyEl = document.getElementById("vip-my-badges-empty");
    if (!listEl || !emptyEl) return;

    const { data, error } = await supabaseClient
        .from("badges")
        .select("id, slug, name_pt, name_en, badge_shape, background_color, image_url, icon, icon_color, icon_size")
        .eq("created_by", currentUserId)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Erro ao carregar meus badges criados:", error);
    }

    if (error || !data || data.length === 0) {
        emptyEl.hidden = false;
        listEl.innerHTML = "";
        return;
    }

    emptyEl.hidden = true;
    listEl.innerHTML = "";

    const lang = document.documentElement.lang === "en" ? "en" : "pt";

    data.forEach((badge) => {
        // Envolve o card num wrapper próprio, com um botão "ver quem
        // tem" embaixo - útil pra gestão, reportado ao vivo. A lista
        // de quem tem só é buscada quando clicado (preguiçoso).
        const wrapper = document.createElement("div");
        wrapper.className = "vip-my-badge-wrapper";

        const card = document.createElement("div");
        card.className = "badge-card badge-card--small";

        const badgeEl = document.createElement("div");
        if (badge.image_url) {
            // Imagem própria já vem com a forma e o fundo dela
            // desenhados - mesma correção do buildSmallBadgeElement
            // acima, ver o comentário lá pro motivo completo.
            badgeEl.className = "badge badge--small badge--image";
        } else {
            badgeEl.className = `badge badge--small badge--${badge.badge_shape}`;
            badgeEl.style.background = badge.background_color;
        }

        if (badge.image_url) {
            const img = document.createElement("img");
            img.src = badge.image_url;
            img.alt = "";
            badgeEl.appendChild(img);
        } else if (badge.icon) {
            const iconSpan = document.createElement("span");
            iconSpan.className = "badge-icon";
            iconSpan.innerHTML = buildIconSvg(badge.icon);
            iconSpan.style.color = badge.icon_color || badge.background_color;
            const sizePx = Math.round(78 * ((badge.icon_size || 35) / 100));
            iconSpan.style.width = `${sizePx}px`;
            iconSpan.style.height = `${sizePx}px`;
            badgeEl.appendChild(iconSpan);
        }

        const title = document.createElement("span");
        title.className = "badge-card-title";
        title.textContent = lang === "en" ? badge.name_en : badge.name_pt;

        card.appendChild(badgeEl);
        card.appendChild(title);

        const holdersToggle = document.createElement("button");
        holdersToggle.type = "button";
        holdersToggle.className = "vip-my-badge-holders-toggle";
        holdersToggle.textContent = window.nodraTranslator?.translations?.["vip.seeHolders"] || "See who has this";

        const holdersList = document.createElement("div");
        holdersList.className = "vip-my-badge-holders-list";
        holdersList.hidden = true;

        let holdersLoaded = false;
        holdersToggle.addEventListener("click", async () => {
            const willShow = holdersList.hidden;
            holdersList.hidden = !willShow;
            if (willShow && !holdersLoaded) {
                holdersLoaded = true;
                await loadBadgeHolders(badge.id, holdersList);
            }
        });

        wrapper.appendChild(card);
        wrapper.appendChild(holdersToggle);
        wrapper.appendChild(holdersList);
        listEl.appendChild(wrapper);
    });
}

// Quem tem um badge específico - sem join direto pro profiles_public
// (é uma view, não uma tabela com FK declarada, o encadeamento
// automático do supabase-js não funciona nela) - busca os user_id em
// user_badges primeiro, depois os username em profiles_public numa
// segunda chamada, filtrando pelos IDs encontrados.
async function loadBadgeHolders(badgeId, containerEl) {
    containerEl.innerHTML = `<span class="vip-my-badge-holders-loading">${window.nodraTranslator?.translations?.["vip.loadingHolders"] || "Loading..."}</span>`;

    const { data: holders, error: holdersError } = await supabaseClient
        .from("user_badges")
        .select("user_id, granted_at")
        .eq("badge_id", badgeId)
        .order("granted_at", { ascending: false });

    if (holdersError || !holders || holders.length === 0) {
        containerEl.innerHTML = `<span class="vip-my-badge-holders-empty">${window.nodraTranslator?.translations?.["vip.noHoldersYet"] || "Nobody has this badge yet."}</span>`;
        return;
    }

    const userIds = holders.map((h) => h.user_id);
    const { data: profiles, error: profilesError } = await supabaseClient
        .from("profiles_public")
        .select("id, username")
        .in("id", userIds);

    if (profilesError) {
        console.error("Erro ao carregar nomes de quem tem o badge:", profilesError);
    }

    const usernameById = new Map((profiles || []).map((p) => [p.id, p.username]));

    containerEl.innerHTML = "";
    holders.forEach((holder) => {
        const row = document.createElement("div");
        row.className = "vip-my-badge-holder-row";
        row.textContent = usernameById.get(holder.user_id) || holder.user_id;
        containerEl.appendChild(row);
    });
}

// Fila de revisão - pacotes de pergunta que a comunidade enviou
// (ndquest/submit), pra qualquer VIP conferir. Diferente de
// question_packs (o catálogo já aprovado que os jogos usam de
// verdade), submitted_packs não tem vínculo de usuário nenhum (só
// nome/email digitados à mão no formulário), então não dá pra
// filtrar "só o que EU enviei" - mostra tudo, como fila de revisão
// compartilhada entre os VIPs.
async function loadSubmittedPacksForReview() {
    const listEl = document.getElementById("vip-submitted-packs-list");
    const emptyEl = document.getElementById("vip-submitted-packs-empty");
    if (!listEl || !emptyEl) return;

    // Só a fila de pendentes aqui - aprovado/rejeitado sai da lista
    // (fica registrado na própria linha de submitted_packs, não
    // apagado, só não aparece mais nessa fila de revisão).
    const { data, error } = await supabaseClient
        .from("submitted_packs")
        .select("id, slug, name_pt, name_en, submitter_name, submitter_email, questions, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Erro ao carregar pacotes enviados:", error);
    }

    if (error || !data || data.length === 0) {
        emptyEl.hidden = false;
        listEl.innerHTML = "";
        return;
    }

    emptyEl.hidden = true;
    listEl.innerHTML = "";

    const lang = document.documentElement.lang === "en" ? "en" : "pt";

    data.forEach((pack) => {
        const item = document.createElement("div");
        item.className = "vip-submitted-pack-item";

        const name = document.createElement("div");
        name.className = "vip-submitted-pack-name";
        name.textContent = lang === "en" ? pack.name_en : pack.name_pt;

        const questionCount = Object.values(pack.questions || {}).reduce(
            (total, arr) => total + (Array.isArray(arr) ? arr.length : 0),
            0,
        );

        const meta = document.createElement("div");
        meta.className = "vip-submitted-pack-meta";
        const dateStr = pack.created_at ? new Date(pack.created_at).toLocaleDateString() : "";
        meta.textContent = `${pack.submitter_name || "?"} (${pack.submitter_email || "?"}) . ${questionCount} perguntas ${dateStr ? `. ${dateStr}` : ""}`;

        const actions = document.createElement("div");
        actions.className = "vip-submitted-pack-actions";

        const approveBtn = document.createElement("button");
        approveBtn.type = "button";
        approveBtn.className = "btn btn-primary";
        approveBtn.textContent = window.nodraTranslator?.translations?.["vip.approveBtn"] || "Approve";
        approveBtn.addEventListener("click", () =>
            reviewSubmittedPack(pack.id, "approve", item),
        );

        const rejectBtn = document.createElement("button");
        rejectBtn.type = "button";
        rejectBtn.className = "btn btn-secondary";
        rejectBtn.textContent = window.nodraTranslator?.translations?.["vip.rejectBtn"] || "Reject";
        rejectBtn.addEventListener("click", () =>
            reviewSubmittedPack(pack.id, "reject", item),
        );

        actions.appendChild(approveBtn);
        actions.appendChild(rejectBtn);

        const status = document.createElement("p");
        status.className = "vip-badge-status";

        item.appendChild(name);
        item.appendChild(meta);
        item.appendChild(actions);
        item.appendChild(status);
        listEl.appendChild(item);
    });
}

// Aprova (vira question_packs de verdade, usável pelos jogos) ou
// rejeita (só marca, não cria nada) um pacote enviado. Mesmo padrão
// de try/catch dos outros fluxos VIP - botões desabilitam durante a
// chamada, erro real sempre visível, nunca trava silenciosamente.
async function reviewSubmittedPack(packId, action, itemEl) {
    const buttons = itemEl.querySelectorAll("button");
    const statusEl = itemEl.querySelector(".vip-badge-status");

    buttons.forEach((b) => (b.disabled = true));
    statusEl.textContent = "";
    statusEl.className = "vip-badge-status";

    try {
        const {
            data: { session },
        } = await supabaseClient.auth.getSession();

        const response = await fetch(`${window.nodraSupabaseUrl}/functions/v1/vip-review-submitted-pack`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ packId, action }),
        });

        const result = await response.json();

        if (result.error) {
            statusEl.textContent = result.error;
            statusEl.className = "vip-badge-status is-error";
            buttons.forEach((b) => (b.disabled = false));
            return;
        }

        const successKey = action === "approve" ? "vip.approveSuccess" : "vip.rejectSuccess";
        const fallback = action === "approve" ? "Approved! Pack is now live." : "Rejected.";
        statusEl.textContent = window.nodraTranslator?.translations?.[successKey] || fallback;
        statusEl.className = "vip-badge-status is-success";

        // Some da fila depois de um instante, já que não é mais
        // "pendente" - dá tempo da pessoa ler a confirmação primeiro.
        setTimeout(() => itemEl.remove(), 1200);
    } catch (err) {
        console.error("Erro ao revisar pacote enviado:", err);
        statusEl.textContent =
            window.nodraTranslator?.translations?.["vip.reviewFailed"] ||
            "Something went wrong. Check the console for details.";
        statusEl.className = "vip-badge-status is-error";
        buttons.forEach((b) => (b.disabled = false));
    }
}

// --------------------------------------------------------
// Tema personalizado do VIP - 1 incluso (grátis) por ciclo de
// renovação, privado, aplica na hora, sem revisão. Submissão pra
// virar tema público (patrocínio pago) é uma etapa futura, ainda não
// implementada aqui - essa tela por enquanto só cobre o tema
// incluso.
//
// A derivação de cor abaixo é uma CÓPIA da mesma lógica que roda em
// supabase/functions/vip-create-theme/index.ts - só pra preview ao
// vivo aqui no formulário. Quem decide de verdade o que fica salvo é
// a Edge Function (mesmo dado, calculado nos dois lados
// separadamente, de propósito - o preview pode ficar levemente
// diferente do resultado final por um instante, mas nunca é o
// preview que grava no banco).
// --------------------------------------------------------

function hexToRgbTheme(hex) {
    const clean = hex.replace("#", "");
    const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
    const num = parseInt(full, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function rgbToHslTheme(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    const d = max - min;
    if (d !== 0) {
        s = d / (1 - Math.abs(2 * l - 1));
        if (max === r) h = ((g - b) / d) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h *= 60;
        if (h < 0) h += 360;
    }
    return [h, s * 100, l * 100];
}

function hslToHexTheme(h, s, l) {
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

function clampTheme(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

function deriveThemeColorsPreview(primaryHex, backgroundHex) {
    const [pr, pg, pb] = hexToRgbTheme(primaryHex);
    const [ph, ps] = rgbToHslTheme(pr, pg, pb);

    const [br, bgc, bb] = hexToRgbTheme(backgroundHex);
    const [bh, bs, bl] = rgbToHslTheme(br, bgc, bb);
    const isDark = bl < 50;

    const primaryLight = hslToHexTheme(ph, clampTheme(ps + 5, 0, 100), isDark ? 62 : 55);
    const backgroundAlt = hslToHexTheme(bh, bs, clampTheme(bl + (isDark ? 4 : -3), 0, 100));
    const surface = hslToHexTheme(bh, bs, clampTheme(bl + (isDark ? 8 : -6), 0, 100));
    const surfaceBorder = `rgba(${pr}, ${pg}, ${pb}, 0.18)`;
    const text = isDark ? hslToHexTheme(0, 0, 96) : hslToHexTheme(0, 0, 12);
    const textMuted = isDark
        ? hslToHexTheme(bh, Math.min(bs, 15), 68)
        : hslToHexTheme(bh, Math.min(bs, 10), 42);
    const paperTint = Math.min(ps * 0.15, 12);
    const paper = hslToHexTheme(ph, paperTint, 94);

    return { primary: primaryHex, primaryLight, background: backgroundHex, backgroundAlt, surface, surfaceBorder, text, textMuted, paper };
}

const themeNameInput = document.getElementById("theme-name");
const themeLogoInput = document.getElementById("theme-logo");
const themeSloganPtInput = document.getElementById("theme-slogan-pt");
const themeSloganEnInput = document.getElementById("theme-slogan-en");
const createThemeForm = document.getElementById("create-theme-form");
const createThemeBtn = document.getElementById("create-theme-btn");
const createThemeStatus = document.getElementById("create-theme-status");
const themeSlotStatusEl = document.getElementById("vip-theme-slot-status");
const themeMyThemesListEl = document.getElementById("vip-my-themes-list");

let pendingThemeLogoFile = null;

// Estado das duas cores-base (não são mais <input type="color"> nem
// texto solto - vêm do seletor de cor próprio, ver mais abaixo).
let themePrimaryHex = "#fea203";
let themeBackgroundHex = "#071b30";

// Sobrescritas manuais por cima do que foi derivado automaticamente -
// reportado ao vivo: a pessoa quer poder clicar numa cor específica
// do preview e ajustar ela na mão, sem perder a geração automática
// das outras. Guarda só o que foi mexido de propósito; o resto
// continua vindo do cálculo (ver deriveThemeColorsPreview). Isso vai
// junto no envio pra Edge Function, que faz a mesma mesclagem antes
// de salvar - ver vip-create-theme/index.ts.
let themeColorOverrides = {};

// null = criando um tema novo (consome o slot do ciclo). Com um id
// aqui, o formulário vira "editar esse tema existente" - usado pra
// corrigir um tema rejeitado antes de reenviar de graça (ver
// loadThemeIntoEditForm), não consome slot nenhum.
let editingThemeId = null;

const HEX_INPUT_REGEX = /^#[0-9a-fA-F]{6}$/;

function normalizeHexInput(value) {
    let v = (value || "").trim();
    if (v && !v.startsWith("#")) v = `#${v}`;
    return v;
}

function updateThemePreview() {
    const primarySwatch = document.getElementById("theme-primary-color-swatch");
    const backgroundSwatch = document.getElementById("theme-background-color-swatch");
    if (primarySwatch) primarySwatch.style.background = themePrimaryHex;
    if (backgroundSwatch) backgroundSwatch.style.background = themeBackgroundHex;
    document.getElementById("theme-primary-color-value").textContent = themePrimaryHex;
    document.getElementById("theme-background-color-value").textContent = themeBackgroundHex;

    const derived = deriveThemeColorsPreview(themePrimaryHex, themeBackgroundHex);
    const colors = { ...derived, ...themeColorOverrides };

    const themeName = themeNameInput?.value || "CryptoBasics";
    document.getElementById("theme-preview-name").textContent = themeName;

    const swatchMap = {
        "theme-swatch-primary": "primary",
        "theme-swatch-primary-light": "primaryLight",
        "theme-swatch-bg": "background",
        "theme-swatch-surface": "surface",
        "theme-swatch-text": "text",
        "theme-swatch-paper": "paper",
    };
    Object.entries(swatchMap).forEach(([id, key]) => {
        const el = document.getElementById(id);
        if (el) el.style.background = colors[key];
    });

    // Mockup de verdade - reportado ao vivo: "teria como esse preview
    // ser tipo o cabeçalho de um jogo". Mesma estrutura do header
    // real (logo à esquerda, seletor de idioma à direita, PT ativo
    // com o gradiente principal → principal clara).
    const mockup = document.getElementById("theme-mockup");
    const mockupLogo = document.getElementById("theme-mockup-name");
    const mockupLogoImg = document.getElementById("theme-mockup-logo-img");
    const mockupLangWrap = mockup?.querySelector(".vip-theme-mockup-lang");
    const mockupLangActive = document.getElementById("theme-mockup-lang-active");
    const mockupLangInactive = document.getElementById("theme-mockup-lang-inactive");

    if (mockup) mockup.style.background = colors.background;

    // Mesma regra do tema de verdade (ver theme-schema.js): com logo,
    // mostra a imagem; sem logo, cai pro texto do nome.
    if (pendingThemeLogoPreviewUrl && mockupLogoImg) {
        mockupLogoImg.src = pendingThemeLogoPreviewUrl;
        mockupLogoImg.hidden = false;
        if (mockupLogo) mockupLogo.hidden = true;
    } else {
        if (mockupLogoImg) mockupLogoImg.hidden = true;
        if (mockupLogo) {
            mockupLogo.hidden = false;
            mockupLogo.textContent = themeName;
            mockupLogo.style.color = colors.text;
        }
    }
    if (mockupLangWrap) {
        mockupLangWrap.style.background = colors.surface;
        mockupLangWrap.style.border = `1px solid ${colors.surfaceBorder}`;
    }
    if (mockupLangActive) {
        mockupLangActive.style.background = `linear-gradient(180deg, ${colors.primaryLight}, ${colors.primary})`;
        mockupLangActive.style.color = colors.background;
    }
    if (mockupLangInactive) {
        mockupLangInactive.style.color = colors.textMuted;
    }

    return colors;
}

themeNameInput?.addEventListener("input", updateThemePreview);

let pendingThemeLogoPreviewUrl = null;

themeLogoInput?.addEventListener("change", () => {
    pendingThemeLogoFile = themeLogoInput.files?.[0] || null;

    // Preview local do arquivo escolhido, antes até de enviar -
    // reportado ao vivo: "tem como incluir a logo que o cara upar
    // também". URL.createObjectURL não sobe nada, só lê o arquivo já
    // selecionado no próprio navegador. Revoga a anterior pra não
    // acumular URLs soltas na memória se a pessoa trocar de arquivo
    // várias vezes.
    if (pendingThemeLogoPreviewUrl) URL.revokeObjectURL(pendingThemeLogoPreviewUrl);
    pendingThemeLogoPreviewUrl = pendingThemeLogoFile ? URL.createObjectURL(pendingThemeLogoFile) : null;

    updateThemePreview();
});

// --------------------------------------------------------
// Seletor de cor próprio - quadrado de saturação/luminosidade (HSV)
// + barra de matiz + hex + paletas prontas. Reportado ao vivo: o
// <input type="color"> nativo do navegador tem um "conta-gotas" que
// deixa clicar em qualquer pixel da tela, até fora do site - achado
// invasivo. Isso aqui é construído do zero, sem essa ferramenta.
// Um único popover compartilhado, reaproveitado pros três lugares que
// precisam escolher cor (principal, fundo, e sobrescrita de swatch
// individual) - guarda qual callback chamar em onPickerApply.
// --------------------------------------------------------

function hsvToHex(h, s, v) {
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

function hexToHsv(hex) {
    const clean = normalizeHexInput(hex).replace("#", "");
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

const themeColorPicker = document.getElementById("theme-color-picker");
const themePickerSv = document.getElementById("theme-picker-sv");
const themePickerSvCursor = document.getElementById("theme-picker-sv-cursor");
const themePickerHue = document.getElementById("theme-picker-hue");
const themePickerHueCursor = document.getElementById("theme-picker-hue-cursor");
const themePickerHex = document.getElementById("theme-picker-hex");
const themePickerPalette = document.getElementById("theme-picker-palette");
const themePickerDone = document.getElementById("theme-picker-done");
const themeColorPickerBackdrop = document.getElementById("theme-color-picker-backdrop");

let pickerState = { h: 0, s: 0, v: 0 };
let onPickerApply = null;

function pickerCurrentHex() {
    return hsvToHex(pickerState.h, pickerState.s, pickerState.v);
}

function renderPickerCursors() {
    const svRect = themePickerSv.getBoundingClientRect();
    themePickerSvCursor.style.left = `${(pickerState.s / 100) * (svRect.width || 248)}px`;
    themePickerSvCursor.style.top = `${(1 - pickerState.v / 100) * (svRect.height || 160)}px`;
    themePickerHueCursor.style.left = `${(pickerState.h / 360) * (themePickerHue.getBoundingClientRect().width || 248)}px`;
    themePickerSv.style.background = `hsl(${pickerState.h}, 100%, 50%)`;
}

function renderPickerHex() {
    themePickerHex.value = pickerCurrentHex().replace("#", "").toUpperCase();
}

function openColorPicker(initialHex, onApply) {
    pickerState = hexToHsv(initialHex);
    onPickerApply = onApply;
    themeColorPicker.hidden = false;
    renderPickerCursors();
    renderPickerHex();
    renderGenericColorPalette(themePickerPalette, null, (color) => {
        pickerState = hexToHsv(color);
        renderPickerCursors();
        renderPickerHex();
    });
}

function closeColorPicker() {
    themeColorPicker.hidden = true;
    onPickerApply = null;
}

function setPickerFromPointer(clientX, clientY) {
    const rect = themePickerSv.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, clientY - rect.top));
    pickerState.s = (x / rect.width) * 100;
    pickerState.v = (1 - y / rect.height) * 100;
    renderPickerCursors();
    renderPickerHex();
}

function setPickerHueFromPointer(clientX) {
    const rect = themePickerHue.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    pickerState.h = (x / rect.width) * 360;
    renderPickerCursors();
    renderPickerHex();
}

function wireDrag(el, onMove) {
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

wireDrag(themePickerSv, (x, y) => setPickerFromPointer(x, y));
wireDrag(themePickerHue, (x) => setPickerHueFromPointer(x));

themePickerHex?.addEventListener("input", () => {
    const value = normalizeHexInput(`#${themePickerHex.value}`);
    if (HEX_INPUT_REGEX.test(value)) {
        pickerState = hexToHsv(value);
        renderPickerCursors();
    }
});

themePickerDone?.addEventListener("click", () => {
    const hex = pickerCurrentHex();
    if (onPickerApply) onPickerApply(hex);
    closeColorPicker();
});

themeColorPickerBackdrop?.addEventListener("click", closeColorPicker);
document.getElementById("theme-picker-close-btn")?.addEventListener("click", closeColorPicker);

document.getElementById("theme-primary-trigger")?.addEventListener("click", () => {
    openColorPicker(themePrimaryHex, (hex) => {
        themePrimaryHex = hex;
        // Trocar a cor-base depois de já ter mexido em swatches
        // individuais invalidaria essas sobrescritas de forma
        // confusa (a pessoa ajustou "surface" na mão, mas a base
        // mudou inteira) - mais simples e previsível é limpar.
        themeColorOverrides = {};
        updateThemePreview();
    });
});

document.getElementById("theme-background-trigger")?.addEventListener("click", () => {
    openColorPicker(themeBackgroundHex, (hex) => {
        themeBackgroundHex = hex;
        themeColorOverrides = {};
        updateThemePreview();
    });
});

// Clicar num swatch do preview abre o mesmo seletor, só pra aquela
// cor específica - reportado ao vivo: "deveria poder clicar e trocar
// manualmente 1 cor específica".
document.querySelectorAll(".vip-theme-swatch-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
        const key = btn.dataset.colorKey;
        const currentColors = updateThemePreview();
        if (!currentColors) return;

        openColorPicker(currentColors[key], (hex) => {
            themeColorOverrides[key] = hex;
            updateThemePreview();
        });
    });
});

// Confere se o slot grátis desse ciclo de VIP já foi usado - mesma
// regra da Edge Function (compara com vip_expires_at atual), só que
// aqui é uma leitura simples, sem precisar de função nenhuma pra só
// mostrar o estado pra pessoa.
async function loadThemeSlotStatus() {
    if (!currentUserId) return;

    // Bug real reportado ao vivo: VIP concedido direto pelo admin,
    // sem vip_expires_at registrado, fazia essa função simplesmente
    // parar sem mostrar nada - nem erro, nem formulário, tela vazia.
    // Sem uma data de renovação pra comparar, não dá pra calcular
    // "ciclo" - trata como "1 tema incluso pra sempre" nesse caso
    // (em vez de "1 por ciclo"), em vez de travar a pessoa numa tela
    // morta. Mesma lógica espelhada na Edge Function.
    const hasExpiryTracked = !!currentProfile?.vip_expires_at;

    const query = supabaseClient
        .from("custom_themes")
        .select("id, name, status")
        .eq("owner_id", currentUserId)
        .eq("is_included_slot", true);

    const { data: existingForCycle } = hasExpiryTracked
        ? await query.eq("created_for_vip_expiry", currentProfile.vip_expires_at).maybeSingle()
        : await query.is("created_for_vip_expiry", null).maybeSingle();

    const usedKey = hasExpiryTracked ? "vip.themeSlotUsed" : "vip.themeSlotUsedNoExpiry";
    const availableKey = "vip.themeSlotAvailable";

    if (existingForCycle) {
        themeSlotStatusEl.textContent =
            window.nodraTranslator?.translations?.[usedKey] ||
            (hasExpiryTracked
                ? `You've already used this cycle's theme (${existingForCycle.name}). A new one unlocks on your next VIP renewal.`
                : `You've already used your included theme (${existingForCycle.name}). Your account has no renewal date on file, so contact an admin if you need another one.`);
        createThemeForm.hidden = true;
    } else {
        themeSlotStatusEl.textContent =
            window.nodraTranslator?.translations?.[availableKey] ||
            "You have a theme slot available for this cycle.";
        createThemeForm.hidden = false;
        updateThemePreview();
    }

    await loadMyThemesList();
}

function escapeThemeHtml(value) {
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
}

async function loadMyThemesList() {
    const { data: themes } = await supabaseClient
        .from("custom_themes")
        .select("id, name, status, applicable_games, colors, reviewer_notes, slogan_pt, slogan_en, logo_url")
        .eq("owner_id", currentUserId)
        .order("created_at", { ascending: false });

    themeMyThemesListEl.innerHTML = "";
    (themes || []).forEach((theme) => {
        const item = document.createElement("div");
        item.className = "vip-submitted-pack-item";

        const swatch = `<span class="vip-theme-swatch" style="background:${theme.colors?.primary || "#888"};display:inline-block;width:14px;height:14px;border-radius:50%;margin-right:6px;"></span>`;
        const statusKey = `vip.themeStatus.${theme.status}`;
        const statusLabel = window.nodraTranslator?.translations?.[statusKey] || theme.status;

        let actionsHtml = "";
        if (theme.status === "private") {
            actionsHtml = `<button type="button" class="btn btn-secondary vip-theme-submit-btn" data-theme-id="${theme.id}">${window.nodraTranslator?.translations?.["vip.themeSubmitBtn"] || "Submit for public review"}</button>`;
        } else if (theme.status === "rejected") {
            actionsHtml = `
                <p class="vip-theme-reject-note">${escapeThemeHtml(theme.reviewer_notes || "")}</p>
                <button type="button" class="btn btn-secondary vip-theme-edit-btn" data-theme-id="${theme.id}">${window.nodraTranslator?.translations?.["vip.themeEditResubmitBtn"] || "Edit and resubmit"}</button>
            `;
        } else if (theme.status === "pending_review") {
            actionsHtml = `<span class="vip-theme-pending-note">${window.nodraTranslator?.translations?.["vip.themePendingNote"] || "Waiting for admin review."}</span>`;
        } else if (theme.status === "public") {
            actionsHtml = `<span class="vip-theme-public-note">${window.nodraTranslator?.translations?.["vip.themePublicNote"] || "Live - visible to any host while your VIP stays active."}</span>`;
        }

        item.innerHTML = `
            <span class="vip-submitted-pack-name">${swatch}${escapeThemeHtml(theme.name)}</span>
            <span class="vip-submitted-pack-meta">${escapeThemeHtml(statusLabel)} - ${escapeThemeHtml((theme.applicable_games || []).join(", "))}</span>
            <div class="vip-theme-item-actions">${actionsHtml}</div>
        `;
        themeMyThemesListEl.appendChild(item);

        item.querySelector(".vip-theme-submit-btn")?.addEventListener("click", () => openThemeSubmitModal(theme.id, theme.name));
        item.querySelector(".vip-theme-edit-btn")?.addEventListener("click", () => loadThemeIntoEditForm(theme));
    });
}

createThemeForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    createThemeStatus.textContent = "";
    createThemeStatus.className = "vip-badge-status";
    createThemeBtn.disabled = true;

    const selectedGames = [...document.querySelectorAll(".theme-game-check:checked")].map((c) => c.value);

    if (selectedGames.length === 0) {
        createThemeStatus.textContent =
            window.nodraTranslator?.translations?.["vip.themeNoGameSelected"] || "Choose at least one game.";
        createThemeStatus.className = "vip-badge-status is-error";
        createThemeBtn.disabled = false;
        return;
    }

    // Logo é opcional, mesmo espírito do badge - upload só se tiver
    // um arquivo pendente de verdade. Editando sem trocar a logo,
    // manda null - vip-update-theme trata null como "sem logo"
    // (mesmo comportamento de criar sem logo, não existe "manter a
    // antiga" hoje - reenviar a mesma imagem é o caminho por agora).
    let logoUrl = null;
    if (pendingThemeLogoFile) {
        const ext = pendingThemeLogoFile.name.split(".").pop() || "png";
        const fileName = `${currentUserId}-${Date.now()}.${ext}`;

        const { error: uploadError } = await supabaseClient.storage
            .from("theme-logos")
            .upload(fileName, pendingThemeLogoFile);

        if (uploadError) {
            console.error("Erro ao enviar logo do tema:", uploadError);
            createThemeStatus.textContent =
                window.nodraTranslator?.translations?.["vip.uploadFailed"] || "Failed to upload image.";
            createThemeStatus.className = "vip-badge-status is-error";
            createThemeBtn.disabled = false;
            return;
        }

        const { data: publicUrlData } = supabaseClient.storage.from("theme-logos").getPublicUrl(fileName);
        logoUrl = publicUrlData.publicUrl;
    }

    const isEditing = !!editingThemeId;

    try {
        const {
            data: { session },
        } = await supabaseClient.auth.getSession();

        const payload = {
            name: themeNameInput.value,
            primary_color: themePrimaryHex,
            background_color: themeBackgroundHex,
            color_overrides: themeColorOverrides,
            logo_url: logoUrl,
            slogan_pt: themeSloganPtInput.value || null,
            slogan_en: themeSloganEnInput.value || null,
            applicable_games: selectedGames,
        };
        if (isEditing) payload.themeId = editingThemeId;

        const response = await fetch(
            `${window.nodraSupabaseUrl}/functions/v1/${isEditing ? "vip-update-theme" : "vip-create-theme"}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify(payload),
            },
        );

        const result = await response.json();

        if (result.error) {
            createThemeStatus.textContent = result.error;
            createThemeStatus.className = "vip-badge-status is-error";
            createThemeBtn.disabled = false;
            return;
        }

        // Editar um tema rejeitado já reenvia pra revisão em seguida,
        // no mesmo clique - reportado ao vivo: "libera ele pra enviar
        // um submit novo gratuitamente", sem passo extra.
        if (isEditing) {
            const resubmitResponse = await fetch(`${window.nodraSupabaseUrl}/functions/v1/vip-resubmit-theme`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ themeId: editingThemeId }),
            });
            const resubmitResult = await resubmitResponse.json();
            if (resubmitResult.error) {
                createThemeStatus.textContent = resubmitResult.error;
                createThemeStatus.className = "vip-badge-status is-error";
                createThemeBtn.disabled = false;
                return;
            }
        }

        createThemeStatus.textContent = isEditing
            ? window.nodraTranslator?.translations?.["vip.themeResubmitSuccess"] || "Saved and resubmitted for review!"
            : window.nodraTranslator?.translations?.["vip.themeCreateSuccess"] || "Theme created! Already live in your games.";
        createThemeStatus.className = "vip-badge-status is-success";

        pendingThemeLogoFile = null;
        if (pendingThemeLogoPreviewUrl) URL.revokeObjectURL(pendingThemeLogoPreviewUrl);
        pendingThemeLogoPreviewUrl = null;
        themeColorOverrides = {};
        themePrimaryHex = "#fea203";
        themeBackgroundHex = "#071b30";
        editingThemeId = null;
        createThemeBtn.textContent =
            window.nodraTranslator?.translations?.["vip.themeCreateBtn"] || "Create Theme";
        createThemeForm.reset();
        updateThemePreview();
        await loadThemeSlotStatus();
    } catch (err) {
        console.error("Erro ao salvar tema:", err);
        createThemeStatus.textContent =
            window.nodraTranslator?.translations?.["vip.themeCreateFailed"] || "Something went wrong. Check the console.";
        createThemeStatus.className = "vip-badge-status is-error";
        createThemeBtn.disabled = false;
    }
});

// Reabre o formulário de criação já preenchido com os dados de um
// tema rejeitado, pra corrigir e reenviar - mesmo formulário, modo
// diferente (ver isEditing no handler de submit acima). Editar não
// consome slot nenhum, é sempre grátis.
function loadThemeIntoEditForm(theme) {
    editingThemeId = theme.id;

    themeNameInput.value = theme.name;
    themePrimaryHex = theme.colors?.primary || "#fea203";
    themeBackgroundHex = theme.colors?.background || "#071b30";

    // Não guardamos separadamente quais cores foram mexidas na mão -
    // recalcula o que seria automático a partir de primary/background
    // e trata qualquer diferença encontrada como sobrescrita manual.
    const autoColors = deriveThemeColorsPreview(themePrimaryHex, themeBackgroundHex);
    themeColorOverrides = {};
    ["primaryLight", "surface", "text", "paper"].forEach((key) => {
        if (theme.colors?.[key] && theme.colors[key] !== autoColors[key]) {
            themeColorOverrides[key] = theme.colors[key];
        }
    });

    themeSloganPtInput.value = theme.slogan_pt || "";
    themeSloganEnInput.value = theme.slogan_en || "";

    document.querySelectorAll(".theme-game-check").forEach((cb) => {
        cb.checked = (theme.applicable_games || []).includes(cb.value);
    });

    createThemeBtn.textContent =
        window.nodraTranslator?.translations?.["vip.themeSaveResubmitBtn"] || "Save and Resubmit";
    createThemeForm.hidden = false;
    updateThemePreview();
    createThemeForm.scrollIntoView({ behavior: "smooth" });
}

// --------------------------------------------------------
// Redes/tokens aceitos pra pagamento - reportado ao vivo: "tem como
// adicionar mais redes?". Mesma configuração (endereços, ordem)
// espelhada no back (ver supabase/functions/_shared/
// paymentVerification.ts) - se trocar um endereço aqui, troca lá
// também. Uma carteira EVM comum recebe no MESMO endereço em
// qualquer rede EVM (por isso só existe um endereço EVM, reusado pra
// Avalanche e Base); Solana usa outro formato de endereço inteiramente.
// Definido aqui, antes de qualquer coisa que use - bug real que eu
// mesmo quase deixei passar: código no topo do arquivo rodando antes
// de um "const" mais abaixo já ter sido inicializado quebra a página
// inteira (erro "Cannot access before initialization").
// --------------------------------------------------------

const EVM_TREASURY_ADDRESS = "0x0000000000000000000000000000000000000000"; // TROCAR - mesmo endereço serve Avalanche e Base
const SOLANA_TREASURY_ADDRESS_FOR_PAYMENTS = "REPLACE_WITH_SOLANA_TREASURY_ADDRESS"; // TROCAR - formato diferente do EVM

const NETWORK_TOKEN_OPTIONS = [
    { network: "avalanche", token: "USDT", label: "USDT - Avalanche C-Chain", address: EVM_TREASURY_ADDRESS },
    { network: "base", token: "USDC", label: "USDC - Base", address: EVM_TREASURY_ADDRESS },
    { network: "solana", token: "USDC", label: "USDC - Solana", address: SOLANA_TREASURY_ADDRESS_FOR_PAYMENTS },
    { network: "solana", token: "USDT", label: "USDT - Solana", address: SOLANA_TREASURY_ADDRESS_FOR_PAYMENTS },
];

// Preenche um <select> com as opções acima e devolve uma função pra
// pegar a opção escolhida no momento - reaproveitado pelo pagamento
// de VIP e pelo de submissão de tema, mesma lista nos dois.
function setupNetworkTokenSelect(selectEl) {
    if (!selectEl) return () => NETWORK_TOKEN_OPTIONS[0];
    selectEl.innerHTML = "";
    NETWORK_TOKEN_OPTIONS.forEach((opt, index) => {
        const option = document.createElement("option");
        option.value = String(index);
        option.textContent = opt.label;
        selectEl.appendChild(option);
    });
    return () => NETWORK_TOKEN_OPTIONS[Number(selectEl.value)] || NETWORK_TOKEN_OPTIONS[0];
}

// --------------------------------------------------------
// Modal de pagamento pra submeter um tema pro público - mesmo
// espírito do pagamento de VIP (endereço fixo, cola o hash da
// transação, confere) - ver verify-theme-submission-payment.
// --------------------------------------------------------

const THEME_SUBMISSION_PRICE_USDT = 10;

const themeSubmitModal = document.getElementById("theme-submit-modal");
const themeSubmitNameEl = document.getElementById("theme-submit-name");
const themeSubmitTxHashInput = document.getElementById("theme-submit-tx-hash");
const themeSubmitStatus = document.getElementById("theme-submit-status");
const themeSubmitVerifyBtn = document.getElementById("theme-submit-verify-btn");
const themeSubmitNetworkSelect = document.getElementById("theme-submit-network-token-select");
const getSelectedThemeSubmitNetworkToken = setupNetworkTokenSelect(themeSubmitNetworkSelect);

let submittingThemeId = null;

function renderThemeSubmitAddress() {
    const addressEl = document.getElementById("theme-submit-treasury-address");
    if (addressEl) addressEl.textContent = getSelectedThemeSubmitNetworkToken().address;
}
themeSubmitNetworkSelect?.addEventListener("change", renderThemeSubmitAddress);

function openThemeSubmitModal(themeId, themeName) {
    submittingThemeId = themeId;

    const lang = window.nodraTranslator?.currentLanguage === "pt" ? "pt" : "en";

    // Não usa data-i18n nesses dois parágrafos de propósito - bug
    // real reportado ao vivo: o tradutor faz element.innerHTML =
    // texto, que apaga qualquer elemento filho (o <strong> do preço,
    // o <span> do nome) toda vez que a página troca de idioma.
    // Monta a frase na mão aqui, com o nome do tema sempre via
    // textContent (nunca innerHTML) - evita repetir esse bug e evita
    // que um nome de tema com HTML dentro vire código na página.
    themeSubmitNameEl.textContent = themeName;

    const hintText = lang === "pt" ? "Envie exatamente" : "Send exactly";
    const hintTail =
        lang === "pt"
            ? "pro endereço abaixo, na rede escolhida, depois cole o hash da transação pra confirmar."
            : "to the address below, on the network you pick, then paste the transaction hash to confirm.";

    const hintEl = document.getElementById("theme-submit-hint-text");
    hintEl.textContent = "";
    hintEl.appendChild(document.createTextNode(`${hintText} `));
    const priceEl = document.createElement("strong");
    priceEl.id = "theme-submit-price";
    priceEl.textContent = `${THEME_SUBMISSION_PRICE_USDT} USDT`;
    hintEl.appendChild(priceEl);
    hintEl.appendChild(document.createTextNode(` ${hintTail}`));

    renderThemeSubmitAddress();
    themeSubmitTxHashInput.value = "";
    themeSubmitStatus.textContent = "";
    themeSubmitStatus.className = "vip-badge-status";
    themeSubmitModal.hidden = false;
}

function closeThemeSubmitModal() {
    themeSubmitModal.hidden = true;
    submittingThemeId = null;
}

document.getElementById("theme-submit-modal-backdrop")?.addEventListener("click", closeThemeSubmitModal);
document.getElementById("theme-submit-close-btn")?.addEventListener("click", closeThemeSubmitModal);

// Esc fecha qualquer um dos dois modais - saída de emergência extra,
// além do X e do clique fora, mesmo motivo (reportado ao vivo: sem
// um jeito óbvio de sair, dava impressão de tela travada).
document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (themeColorPicker && !themeColorPicker.hidden) closeColorPicker();
    if (themeSubmitModal && !themeSubmitModal.hidden) closeThemeSubmitModal();
});

themeSubmitVerifyBtn?.addEventListener("click", async () => {
    if (!submittingThemeId) return;

    themeSubmitStatus.textContent = "";
    themeSubmitStatus.className = "vip-badge-status";
    themeSubmitVerifyBtn.disabled = true;

    try {
        const {
            data: { session },
        } = await supabaseClient.auth.getSession();

        const response = await fetch(`${window.nodraSupabaseUrl}/functions/v1/verify-theme-submission-payment`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
                themeId: submittingThemeId,
                txHash: themeSubmitTxHashInput.value.trim(),
                network: getSelectedThemeSubmitNetworkToken().network,
                token: getSelectedThemeSubmitNetworkToken().token,
            }),
        });

        const result = await response.json();

        if (result.error) {
            themeSubmitStatus.textContent = result.error;
            themeSubmitStatus.className = "vip-badge-status is-error";
            themeSubmitVerifyBtn.disabled = false;
            return;
        }

        themeSubmitStatus.textContent =
            window.nodraTranslator?.translations?.["vip.themeSubmitSuccess"] || "Payment verified! Sent for admin review.";
        themeSubmitStatus.className = "vip-badge-status is-success";

        setTimeout(async () => {
            closeThemeSubmitModal();
            themeSubmitVerifyBtn.disabled = false;
            await loadMyThemesList();
        }, 1500);
    } catch (err) {
        console.error("Erro ao verificar pagamento de submissão de tema:", err);
        themeSubmitStatus.textContent =
            window.nodraTranslator?.translations?.["vip.themeCreateFailed"] || "Something went wrong. Check the console.";
        themeSubmitStatus.className = "vip-badge-status is-error";
        themeSubmitVerifyBtn.disabled = false;
    }
});

// --------------------------------------------------------
// --------------------------------------------------------
// VIP mensal - PRECISA trocar os dois endereços acima pelos reais da
// tesouraria antes de ir pro ar, mesmas constantes usadas na Edge
// Function verify-vip-payment (o back e o front têm que bater).
// --------------------------------------------------------

const vipNetworkSelect = document.getElementById("vip-network-token-select");
const getSelectedVipNetworkToken = setupNetworkTokenSelect(vipNetworkSelect);

function renderVipPaymentDetails() {
    const selected = getSelectedVipNetworkToken();
    const addressEl = document.getElementById("vip-treasury-address");
    const instructionsEl = document.getElementById("vip-payment-instructions");
    if (addressEl) addressEl.textContent = selected.address;
    if (instructionsEl) {
        const template =
            window.nodraTranslator?.translations?.["vip.paymentInstructionsTemplate"] ||
            "Pay $5 in {token} ({network}) to the address above, using any wallet you like. Then paste the transaction hash below to verify.";
        instructionsEl.textContent = template
            .replace("{token}", selected.token)
            .replace("{network}", selected.label.split(" - ")[1] || selected.network);
    }
}

vipNetworkSelect?.addEventListener("change", renderVipPaymentDetails);
renderVipPaymentDetails();

// Alterna entre a tela de compra (quem ainda não é VIP) e a área VIP
// de verdade (badges, pacotes) - reportado ao vivo: a compra devia
// ficar separada e em destaque, não escondida numa seção da barra
// lateral do perfil.
function renderVipPanelState(isVip) {
    const purchaseScreen = document.getElementById("vip-purchase-screen");
    const areaScreen = document.getElementById("vip-area-screen");
    if (!purchaseScreen || !areaScreen) return;

    purchaseScreen.hidden = isVip;
    areaScreen.hidden = !isVip;
}

function renderVipMembershipStatus(isVip, expiresAtISO) {
    // A visibilidade da linha inteira já é controlada pelo
    // #vip-area-screen (só aparece pra quem é VIP) - aqui só precisa
    // preencher a data, ou uma mensagem padrão se não tiver uma
    // registrada (conta VIP concedida direto, nunca passou pelo
    // pagamento).
    const expiryDateEl = document.getElementById("vip-membership-expiry-date");
    if (!expiryDateEl) return;

    expiryDateEl.textContent = expiresAtISO
        ? new Date(expiresAtISO).toLocaleDateString()
        : window.nodraTranslator?.translations?.["vip.noExpiryTracked"] || "no expiration date on file";
}

const vipPaymentForm = document.getElementById("vip-payment-form");
const vipTxHashInput = document.getElementById("vip-tx-hash-input");
const vipVerifyPaymentBtn = document.getElementById("vip-verify-payment-btn");
const vipPaymentStatus = document.getElementById("vip-payment-status");

vipPaymentForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    vipPaymentStatus.textContent = "";
    vipPaymentStatus.className = "vip-badge-status";
    vipVerifyPaymentBtn.disabled = true;

    // Mesmo padrão do "Conceder Badge" - try/catch garante que o
    // botão SEMPRE volta a ficar clicável, e o erro real vai pro
    // console, nunca desaparece silenciosamente (bug real já
    // encontrado e corrigido nesse outro fluxo antes).
    try {
        const {
            data: { session },
        } = await supabaseClient.auth.getSession();

        const response = await fetch(`${window.nodraSupabaseUrl}/functions/v1/verify-vip-payment`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
                txHash: vipTxHashInput.value.trim(),
                network: getSelectedVipNetworkToken().network,
                token: getSelectedVipNetworkToken().token,
            }),
        });

        const result = await response.json();

        if (result.error) {
            vipPaymentStatus.textContent = result.error;
            vipPaymentStatus.className = "vip-badge-status is-error";
            return;
        }

        vipPaymentStatus.textContent =
            window.nodraTranslator?.translations?.["vip.paymentSuccess"] ||
            "Payment verified! Vip is now active.";
        vipPaymentStatus.className = "vip-badge-status is-success";
        vipPaymentForm.reset();
        renderVipMembershipStatus(true, result.vipExpiresAt);

        if (currentProfile) currentProfile.is_vip = true;
        const vipTab = document.getElementById("navbar-tab-vip");
        if (vipTab) {
            vipTab.textContent =
                window.nodraTranslator?.translations?.["vip.navTabActive"] || "Vip Area";
        }
        // Troca da tela de compra pra área VIP de verdade na hora,
        // sem precisar recarregar a página.
        renderVipPanelState(true);
    } catch (err) {
        console.error("Erro ao verificar pagamento de VIP:", err);
        vipPaymentStatus.textContent =
            window.nodraTranslator?.translations?.["vip.paymentFailed"] ||
            "Something went wrong. Check the console for details.";
        vipPaymentStatus.className = "vip-badge-status is-error";
    } finally {
        vipVerifyPaymentBtn.disabled = false;
    }
});

// --------------------------------------------------------
// Resgatar código de convite - alternativa ao pagamento, gerado
// pelo admin (admin-generate-vip-code). Mesmo padrão de try/catch do
// pagamento - botão sempre volta a ficar clicável, erro real sempre
// visível.
// --------------------------------------------------------

const vipRedeemCodeForm = document.getElementById("vip-redeem-code-form");
const vipRedeemCodeInput = document.getElementById("vip-redeem-code-input");
const vipRedeemCodeBtn = document.getElementById("vip-redeem-code-btn");
const vipRedeemCodeStatus = document.getElementById("vip-redeem-code-status");

vipRedeemCodeForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    vipRedeemCodeStatus.textContent = "";
    vipRedeemCodeStatus.className = "vip-badge-status";
    vipRedeemCodeBtn.disabled = true;

    try {
        const {
            data: { session },
        } = await supabaseClient.auth.getSession();

        const response = await fetch(`${window.nodraSupabaseUrl}/functions/v1/redeem-vip-code`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ code: vipRedeemCodeInput.value.trim() }),
        });

        const result = await response.json();

        if (result.error) {
            vipRedeemCodeStatus.textContent = result.error;
            vipRedeemCodeStatus.className = "vip-badge-status is-error";
            return;
        }

        vipRedeemCodeStatus.textContent =
            window.nodraTranslator?.translations?.["vip.redeemSuccess"] ||
            "Code redeemed! Vip is now active.";
        vipRedeemCodeStatus.className = "vip-badge-status is-success";
        vipRedeemCodeForm.reset();
        renderVipMembershipStatus(true, result.vipExpiresAt);

        if (currentProfile) currentProfile.is_vip = true;
        const vipTab = document.getElementById("navbar-tab-vip");
        if (vipTab) {
            vipTab.textContent =
                window.nodraTranslator?.translations?.["vip.navTabActive"] || "Vip Area";
        }
        renderVipPanelState(true);
    } catch (err) {
        console.error("Erro ao resgatar código de VIP:", err);
        vipRedeemCodeStatus.textContent =
            window.nodraTranslator?.translations?.["vip.redeemFailed"] ||
            "Something went wrong. Check the console for details.";
        vipRedeemCodeStatus.className = "vip-badge-status is-error";
    } finally {
        vipRedeemCodeBtn.disabled = false;
    }
});

// ==================================================================

supabaseClient.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
        ensureProfileAndRoute(session.user);
    } else {
        toggleNavbarProfileTabs(false);
        showSection("auth");
    }
});

(async function boot() {
    const {
        data: { session },
    } = await supabaseClient.auth.getSession();
    if (session?.user) {
        await ensureProfileAndRoute(session.user);
    } else {
        toggleNavbarProfileTabs(false);
        showSection("auth");
    }
})();
