// Resolved relative to this script's own location (not the page's).
// This is Account's own independent copy: it fetches from Account's own
// translations/ folder, not the root's, same self-containment as
// About's assets/js/translations.js has relative to about/translations/.
const TRANSLATIONS_BASE_URL = new URL("../../translations/", document.currentScript.src).href;

class Translator {

    constructor() {

        this.currentLanguage = localStorage.getItem("nodra-language") || "en";

        this.translations = {};

    }

    async init() {

        await this.load(this.currentLanguage);

        this.translatePage();

        this.bindButtons();

        document
    .getElementById(`lang-${this.currentLanguage}`)
    ?.classList.add("active");

    }

    async load(language) {

        const response = await fetch(`${TRANSLATIONS_BASE_URL}${language}.json`);

        this.translations = await response.json();

    }

    translatePage() {

        document.querySelectorAll("[data-i18n]").forEach(element => {

            const key = element.dataset.i18n;

            if (this.translations[key]) {

                element.innerHTML = this.translations[key];

            }

        });

    }

    bindButtons() {

        const en = document.getElementById("lang-en");

        const pt = document.getElementById("lang-pt");

        if (en) {

            en.addEventListener("click", () => this.changeLanguage("en"));

        }

        if (pt) {

            pt.addEventListener("click", () => this.changeLanguage("pt"));

        }

    }

    async changeLanguage(language) {

    localStorage.setItem("nodra-language", language);

    this.currentLanguage = language;

    await this.load(language);

    this.translatePage();

    document
        .querySelectorAll(".language-switch button")
        .forEach(button => button.classList.remove("active"));

    document
        .getElementById(`lang-${language}`)
        ?.classList.add("active");

    }

}

const translator = new Translator();

// Diferente das outras cópias deste arquivo (about/, academy/, etc.),
// o account.js desta pasta precisa ler strings de tradução em tempo
// de execução (mensagens de erro de login/username) — por isso, só
// aqui, o translator é exposto em window. Isso não é copiado de volta
// pras outras pastas: cada uma só ganha o que ela mesma precisa.
window.nodraTranslator = translator;

translator.init();
