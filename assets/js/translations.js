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

        const response = await fetch(`../translations/${language}.json`);

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

translator.init();