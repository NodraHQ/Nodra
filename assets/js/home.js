// ======================================
// NODRA HOME
// home.js
// ======================================

// ===============================
// NAVBAR
// ===============================

const navbar = document.querySelector(".navbar");

window.addEventListener("scroll", () => {
    if (window.scrollY > 30) {
        navbar.classList.add("navbar-solid");
    } else {
        navbar.classList.remove("navbar-solid");
    }
});

// ===============================
// THEME TOGGLE — claro (papel/creme) vs escuro (padrão
// Nodra). Escuro é sempre o inicial pra quem nunca visitou;
// depois disso lembra a última escolha. O quadrado azul da
// logo nunca muda de cor nos dois temas (é marca, não tema)
// - por isso o toggle só mexe no atributo data-theme, nunca
// toca em .logo-icon diretamente.
// ===============================

const THEME_STORAGE_KEY = "nodra-home-theme";
const themeToggleBtn = document.getElementById("theme-toggle");

function applyTheme(theme) {
    if (theme === "light") {
        document.documentElement.setAttribute("data-theme", "light");
        if (themeToggleBtn) themeToggleBtn.textContent = "☾";
    } else {
        document.documentElement.removeAttribute("data-theme");
        if (themeToggleBtn) themeToggleBtn.textContent = "☀";
    }
}

const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
applyTheme(savedTheme === "light" ? "light" : "dark");

themeToggleBtn?.addEventListener("click", () => {
    const isLight = document.documentElement.getAttribute("data-theme") === "light";
    const nextTheme = isLight ? "dark" : "light";
    applyTheme(nextTheme);
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
});

// ===============================
// LANGUAGE TOGGLE — um botão só em vez de EN/PT separados
// (reportado ao vivo: "tem como deixar como sendo só 1?").
// window.nodraTranslator precisou ser exposto global em
// translations.js pra isso funcionar - antes só existia como
// variável local daquele arquivo.
// ===============================

const langToggleBtn = document.getElementById("lang-toggle");

function updateLangToggleLabel() {
    if (!langToggleBtn || !window.nodraTranslator) return;
    // Mostra a PRÓXIMA língua, não a atual - mesmo padrão de "clique
    // pra virar isso", como um botão de dia/noite mostra o sol
    // quando está de noite (a ação que o clique vai fazer).
    langToggleBtn.textContent = window.nodraTranslator.currentLanguage === "en" ? "PT" : "EN";
}

langToggleBtn?.addEventListener("click", () => {
    if (!window.nodraTranslator) return;
    const nextLang = window.nodraTranslator.currentLanguage === "en" ? "pt" : "en";
    window.nodraTranslator.changeLanguage(nextLang).then(updateLangToggleLabel);
});

// O tradutor carrega de forma assíncrona (busca o JSON) - espera um
// instante antes de ler currentLanguage pela primeira vez, senão
// pega o valor default antes do localStorage ser aplicado.
setTimeout(updateLangToggleLabel, 300);
