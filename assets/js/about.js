// ======================================
// NODRA — about.js
// Page-specific behavior for /about/.
//
// Reuse-first check: the reveal-on-scroll observer and the
// navbar-solid-on-scroll listener below are copied from home.js because
// they're genuinely shared behavior. The rest of home.js (dashboard
// rotation, hero-dashboard glow pulse) is NOT reused here: this page has
// no .hero-dashboard or .dashboard-item elements, and calling that code
// against a page that lacks them is exactly the kind of bug worth
// avoiding, not a case for a shared import between two otherwise
// independent pages.
// ======================================

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
