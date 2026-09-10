// ======================================
// NODRA ABOUT — about.js
// Page-specific behavior for /about/.
//
// Rebuilt for the docs-style page (sidebar + content panels,
// borrowed from NDQuest's landing structure). The old reveal-on-
// scroll observer and roadmap-accordion code are gone along with the
// HTML they targeted - this page has neither .reveal nor
// [data-roadmap-toggle] elements anymore.
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
// DOCS SIDEBAR — clica num item, mostra o painel dele, esconde os
// outros. Mesmo padrão de aba que a landing do NDQuest já usa.
// "NDQuest" é um item pai que expande pra mostrar os 5 jogos como
// subitens, em vez de aparecer solto na lista principal.
// ===============================

const docsNavItems = document.querySelectorAll(".docs-nav-item[data-section], .docs-nav-child");
const ndquestToggle = document.getElementById("ndquest-toggle");
const ndquestChildren = document.getElementById("ndquest-children");

function showDocsSection(sectionId) {
    document.querySelectorAll(".docs-panel").forEach((panel) => {
        panel.hidden = panel.id !== `section-${sectionId}`;
    });

    docsNavItems.forEach((item) => {
        item.classList.toggle("is-active", item.dataset.section === sectionId);
    });
}

docsNavItems.forEach((item) => {
    item.addEventListener("click", () => showDocsSection(item.dataset.section));
});

ndquestToggle?.addEventListener("click", () => {
    const isOpen = ndquestToggle.classList.toggle("is-open");
    ndquestChildren.hidden = !isOpen;
});

// Abre o grupo NDQuest sozinho se a pessoa clicar num dos jogos
// (também cobre o caso de já entrar direto numa dessas seções).
document.querySelectorAll(".docs-nav-child").forEach((child) => {
    child.addEventListener("click", () => {
        ndquestToggle?.classList.add("is-open");
        if (ndquestChildren) ndquestChildren.hidden = false;
    });
});
