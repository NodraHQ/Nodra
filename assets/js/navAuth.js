// ==================================================================
// navAuth.js — widget de login na navbar (versão completa, com
// dropdown). Cópia própria desta pasta — cada pasta self-contained
// tem a sua, com o caminho relativo pro /account/ ajustado pra
// profundidade certa. Ver docs/LOGIN_WALLET_ARCHITECTURE.md.
//
// Estado deslogado: link "Entrar" -> /account/
// Estado logado: avatar (foto do Google se tiver, senão iniciais) +
// username, com dropdown (Perfil / Sair).
//
// Depende de window.nodraSupabase já existir (definido no
// supabase-client.js desta mesma pasta) e, se a página usar o
// Translator (window.nodraTranslator), usa ele pras strings —
// senão cai num texto fixo em inglês como fallback.
// ==================================================================

(function () {

    const ACCOUNT_URL = document.currentScript.dataset.accountUrl || "account/index.html";

    function t(key, fallback) {
        return window.nodraTranslator?.translations?.[key] || fallback;
    }

    function renderSignedOut(container) {
        container.innerHTML = `<a href="${ACCOUNT_URL}" class="nav-auth-signin">${t("navAuth.signIn", "Sign in")}</a>`;
    }

    function renderSignedIn(container, { username, avatarUrl }) {

        const displayName = username || t("navAuth.account", "Account");
        const initial = (username || "?").charAt(0).toUpperCase();

        // Constrói o avatar via DOM (não innerHTML com a URL solta) —
        // mesma razão de segurança do account.js: avatar_url nunca
        // deve ser interpretado como HTML, só como valor de atributo.
        container.innerHTML = `
            <div class="nav-auth-widget">
                <button type="button" class="nav-auth-trigger">
                    <span class="nav-auth-avatar-slot"></span>
                    <span class="nav-auth-name">${escapeHtml(displayName)}</span>
                </button>
                <div class="nav-auth-dropdown">
                    <a href="${ACCOUNT_URL}">${t("navAuth.profile", "Profile")}</a>
                    <button type="button" class="nav-auth-signout">${t("navAuth.signOut", "Sign out")}</button>
                </div>
            </div>
        `;

        const avatarSlot = container.querySelector(".nav-auth-avatar-slot");
        if (avatarUrl) {
            const img = document.createElement("img");
            img.className = "nav-auth-avatar-img";
            img.src = avatarUrl;
            img.alt = "";
            avatarSlot.appendChild(img);
        } else {
            avatarSlot.className += " nav-auth-avatar-fallback";
            avatarSlot.textContent = initial;
        }

        const trigger = container.querySelector(".nav-auth-trigger");
        const dropdown = container.querySelector(".nav-auth-dropdown");

        trigger.addEventListener("click", (event) => {
            event.stopPropagation();
            dropdown.classList.toggle("is-open");
        });

        document.addEventListener("click", () => { dropdown.classList.remove("is-open"); });

        container.querySelector(".nav-auth-signout").addEventListener("click", async () => {
            await window.nodraSupabase.auth.signOut();
            window.location.reload();
        });

    }

    function escapeHtml(value) {
        const div = document.createElement("div");
        div.textContent = value ?? "";
        return div.innerHTML;
    }

    async function boot() {

        const container = document.getElementById("nav-auth");
        if (!container || !window.nodraSupabase) return;

        const { data: { session } } = await window.nodraSupabase.auth.getSession();

        if (!session) {
            renderSignedOut(container);
            return;
        }

        const { data: profile } = await window.nodraSupabase
            .from("profiles")
            .select("username, avatar_url")
            .eq("id", session.user.id)
            .maybeSingle();

        renderSignedIn(container, {
            username: profile?.username,
            avatarUrl: profile?.avatar_url || session.user.user_metadata?.avatar_url,
        });

    }

    boot();

})();
