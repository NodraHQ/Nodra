// Resolved relative to this script's own location (not the page's),
// so translations load correctly regardless of how deep the page is
// nested (e.g. academy/05-defi/index.html or academy/index.html).
const TRANSLATIONS_BASE_URL = new URL("../../translations/", document.currentScript.src).href;

// Every Academy page loads two files per language: shared.json (navbar,
// footer, and anything reused across more than one page) plus the file
// matching its own module folder. This is derived automatically from the
// current URL, so no per-page configuration is needed.
function detectModuleFile() {

    const parts = window.location.pathname.split("/").filter(Boolean);

    if (parts.length && parts[parts.length - 1].endsWith(".html")) {
        parts.pop();
    }

    const last = parts[parts.length - 1];

    if (!last || last === "academy") {
        return "00-landing";
    }

    return last;

}

class Translator {

    constructor() {

        this.currentLanguage = localStorage.getItem("nodra-language") || "en";

        this.translations = {};

        this.moduleFile = detectModuleFile();

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

        const [sharedResponse, moduleResponse] = await Promise.all([
            fetch(`${TRANSLATIONS_BASE_URL}${language}/shared.json`),
            fetch(`${TRANSLATIONS_BASE_URL}${language}/${this.moduleFile}.json`)
        ]);

        const shared = await sharedResponse.json();
        const module = await moduleResponse.json();

        this.translations = { ...shared, ...module };

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

translator.init();
