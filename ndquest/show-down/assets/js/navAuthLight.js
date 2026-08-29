// ==================================================================
// navAuthLight.js — indicador de login leve, pros jogos (sem navbar,
// só o toggle de idioma). Diferente do navAuth.js completo: sem
// dropdown, e não mostra nada quando deslogado (não faz sentido
// empurrar login numa tela de host/play rápida). Cópia própria desta
// pasta. Ver docs/LOGIN_WALLET_ARCHITECTURE.md.
// ==================================================================

(function () {

    const ACCOUNT_URL = document.currentScript.dataset.accountUrl || "../../account/index.html";

    function escapeHtml(value) {
        const div = document.createElement("div");
        div.textContent = value ?? "";
        return div.innerHTML;
    }

    async function boot() {

        const container = document.getElementById("nav-auth-light");
        // Os jogos usam window.ndquestSupabase (nome já estabelecido
        // nesta pasta), diferente do window.nodraSupabase usado em
        // account/ e admin/ — mantém o nome que já existe aqui em vez
        // de renomear e arriscar quebrar o resto do jogo.
        const client = window.ndquestSupabase;
        if (!container || !client) return;

        const { data: { session } } = await client.auth.getSession();
        if (!session) return; // fica escondido, é o padrão

        const { data: profile } = await client
            .from("profiles")
            .select("username, avatar_url")
            .eq("id", session.user.id)
            .maybeSingle();

        const username = profile?.username;
        const avatarUrl = profile?.avatar_url || session.user.user_metadata?.avatar_url;
        const initial = (username || "?").charAt(0).toUpperCase();

        // Constrói o avatar via DOM, não via innerHTML com a URL
        // solta — mesma razão de segurança do account.js.
        container.innerHTML = `
            <a href="${ACCOUNT_URL}" class="nav-auth-light-widget">
                <span class="nav-auth-light-avatar-slot"></span>
                <span class="nav-auth-light-name">${escapeHtml(username || "")}</span>
            </a>
        `;

        const avatarSlot = container.querySelector(".nav-auth-light-avatar-slot");
        if (avatarUrl) {
            const img = document.createElement("img");
            img.className = "nav-auth-light-avatar-img";
            img.src = avatarUrl;
            img.alt = "";
            avatarSlot.appendChild(img);
        } else {
            avatarSlot.className += " nav-auth-light-avatar-fallback";
            avatarSlot.textContent = initial;
        }

        container.hidden = false;

        // Posiciona dinamicamente à esquerda do toggle de idioma, em
        // vez de um "right" fixo chutado no CSS. Bug real reportado
        // ao vivo: um username mais longo (ex.: "Tatuira") deixava o
        // widget largo o suficiente pra invadir o espaço do toggle de
        // idioma, sobrepondo os dois. Medir a largura de verdade do
        // toggle na hora resolve pra qualquer tamanho de nome.
        positionNextToLanguageToggle(container);

    }

    function positionNextToLanguageToggle(container) {
        const toggle = document.querySelector(".language-toggle");
        if (!toggle) return;

        const toggleRect = toggle.getBoundingClientRect();
        const gapFromToggle = 12;
        const rightOffset = (window.innerWidth - toggleRect.left) + gapFromToggle;

        container.style.right = `${rightOffset}px`;
    }

    boot();

})();
