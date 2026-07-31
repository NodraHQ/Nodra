// NDQuest landing — page-specific behavior. Own copy, not shared
// with the root's or Academy's home.js/about.js (same small, generic
// reveal-on-scroll + navbar-on-scroll pattern each independent page
// in this repo keeps for itself).

const observer = new IntersectionObserver(
    (entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add("show");
            }
        });
    },
    { threshold: .15 }
);

document.querySelectorAll(".reveal").forEach(el => observer.observe(el));

const navbar = document.querySelector(".navbar");

window.addEventListener("scroll", () => {
    if (window.scrollY > 30) {
        navbar.classList.add("navbar-solid");
    } else {
        navbar.classList.remove("navbar-solid");
    }
});

// --------------------------------------------------------
// Abas de categoria (Quiz / Ação / Sorteio) — troca qual painel
// de jogos aparece embaixo. Puro toggle de hidden, sem framework,
// consistente com o resto do site.
// --------------------------------------------------------

const categoryTabs = document.querySelectorAll(".category-tab");
const categoryPanels = document.querySelectorAll(".category-panel");

categoryTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
        const category = tab.dataset.category;

        categoryTabs.forEach((t) => t.classList.toggle("is-active", t === tab));
        categoryPanels.forEach((panel) => {
            panel.hidden = panel.id !== `category-${category}`;
        });
    });
});
