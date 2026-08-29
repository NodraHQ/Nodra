// ==================================================================
// accountIdentity.js
//
// Se a pessoa já está logada na conta Nodra, preenche o campo de
// nome (host-name-input ou nickname-input, dependendo da tela) com o
// username dela, e troca o campo por um "Logado como X — Trocar".
// Clicar em "Trocar" volta pro campo normal, editável, exatamente
// como já era pra quem não está logado.
//
// Não toca em host.js/play.js — esses arquivos continuam lendo
// input.value normalmente, sem saber que esse valor pode ter vindo
// do login em vez de digitado na hora. Deslogado, nada muda.
//
// Parâmetros via data-attribute no <script>:
//   data-target-input  -> id do campo ("host-name-input" ou "nickname-input")
//   data-lang-key      -> chave do localStorage de idioma do jogo (ex.: "time-attack:language")
// ==================================================================

(function () {

    const scriptEl = document.currentScript;
    const targetInputId = scriptEl.dataset.targetInput;
    const langKey = scriptEl.dataset.langKey;
    const client = window.ndquestSupabase;

    const STRINGS = {
        pt: { loggedInAs: "Logado como", switchName: "Trocar" },
        en: { loggedInAs: "Logged in as", switchName: "Switch" },
    };

    function currentLang() {
        return localStorage.getItem(langKey) === "en" ? "en" : "pt";
    }

    function t(key) {
        return STRINGS[currentLang()][key];
    }

    function escapeHtml(value) {
        const div = document.createElement("div");
        div.textContent = value ?? "";
        return div.innerHTML;
    }

    async function boot() {

        const input = document.getElementById(targetInputId);
        if (!input || !client) return;

        const { data: { session } } = await client.auth.getSession();
        if (!session) return; // deslogado: comportamento igual sempre foi, não mexe em nada

        const { data: profile } = await client
            .from("profiles")
            .select("username")
            .eq("id", session.user.id)
            .maybeSingle();

        const username = profile?.username;
        if (!username) return; // logado mas ainda sem username (não deveria, mas defensivo)

        input.value = username;
        renderChip(input, username);

    }

    function renderChip(input, username) {

        const chip = document.createElement("div");
        chip.className = "account-identity-chip";
        chip.innerHTML = `
            <span class="account-identity-chip-label">${t("loggedInAs")}</span>
            <strong class="account-identity-chip-name">${escapeHtml(username)}</strong>
            <button type="button" class="account-identity-switch-btn">${t("switchName")}</button>
        `;

        input.insertAdjacentElement("beforebegin", chip);
        input.hidden = true;

        chip.querySelector(".account-identity-switch-btn").addEventListener("click", () => {
            chip.hidden = true;
            input.hidden = false;
            input.value = "";
            input.focus();
        });

    }

    boot();

})();
