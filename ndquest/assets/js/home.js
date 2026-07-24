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
