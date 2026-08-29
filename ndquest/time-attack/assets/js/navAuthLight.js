// ==================================================================
// navAuthLight.js — indicador de login leve, pros jogos (sem navbar,
// só o toggle de idioma). Diferente do navAuth.js completo: sem
// dropdown. Cópia própria desta pasta. Ver
// docs/LOGIN_WALLET_ARCHITECTURE.md.
//
// Estado deslogado: link "Entrar"/"Sign in" -> account/index.html —
// antes disso simplesmente ficava escondido quando deslogado, sem
// lugar nenhum pra logar direto da tela do jogo. Reportado ao vivo:
// "quero um lugar pra logar se não estiver, e mostrar o perfilzinho
// se estiver, em todas as páginas".
// Estado logado: avatar + username, igual sempre foi.
//
// Idioma: cada jogo tem seu próprio t()/currentLanguage fechado
// dentro do host.js/play.js, não dá pra alcançar daqui (esse script
// é uma IIFE separada). Em vez de depender de um window.nodraTranslator
// que nunca existiu nessas páginas, lê o mesmo localStorage que o
// resto do jogo já usa — data-lang-key no <script> diz qual chave
// checar (ex: "time-attack:language"). Como o resto da página troca
// de idioma AO VIVO (sem recarregar), fica de olho no localStorage
// por um intervalo leve — sem isso, esse widget ficava preso no
// idioma de quando a página carregou, destoando do resto.
// ==================================================================

(function () {

    const ACCOUNT_URL = document.currentScript.dataset.accountUrl || "../../account/index.html";
    const LANG_KEY = document.currentScript.dataset.langKey;

    const STRINGS = {
        signIn: { pt: "Entrar", en: "Sign in" },
    };

    function getCurrentLanguage() {
        return (LANG_KEY && localStorage.getItem(LANG_KEY)) || "pt";
    }

    function t(key, lang) {
        return STRINGS[key]?.[lang] || STRINGS[key]?.pt || "";
    }

    function escapeHtml(value) {
        const div = document.createElement("div");
        div.textContent = value ?? "";
        return div.innerHTML;
    }

    let cachedState = null; // { signedIn, username, avatarUrl } — preenchido uma vez, reaproveitado a cada re-render de idioma
    let lastRenderedLanguage = null;

    function render(container) {

        const lang = getCurrentLanguage();
        if (lang === lastRenderedLanguage) return; // nada mudou, não redesenha à toa
        lastRenderedLanguage = lang;

        if (!cachedState || !cachedState.signedIn) {
            container.innerHTML = `<a href="${ACCOUNT_URL}" class="nav-auth-light-signin">${t("signIn", lang)}</a>`;
            container.hidden = false;
            positionNextToLanguageToggle(container);
            return;
        }

        const { username, avatarUrl } = cachedState;
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

    async function boot() {

        const container = document.getElementById("nav-auth-light");
        // Os jogos usam window.ndquestSupabase (nome já estabelecido
        // nesta pasta), diferente do window.nodraSupabase usado em
        // account/ e admin/ — mantém o nome que já existe aqui em vez
        // de renomear e arriscar quebrar o resto do jogo.
        const client = window.ndquestSupabase;
        if (!container || !client) return;

        const { data: { session } } = await client.auth.getSession();

        if (!session) {
            cachedState = { signedIn: false };
            render(container);
        } else {
            const { data: profile } = await client
                .from("profiles")
                .select("username, avatar_url")
                .eq("id", session.user.id)
                .maybeSingle();

            cachedState = {
                signedIn: true,
                username: profile?.username,
                avatarUrl: profile?.avatar_url || session.user.user_metadata?.avatar_url,
            };
            render(container);
        }

        // Checagem leve — só troca a IDIOMA do que já foi buscado, não
        // busca sessão/perfil de novo a cada tick, só quando o idioma
        // realmente mudou desde o último desenho.
        setInterval(() => render(container), 400);

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
