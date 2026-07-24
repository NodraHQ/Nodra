// ======================================
// NODRA ABOUT — about.js
// Page-specific behavior for /about/.
//
// This folder is self-contained, same as /academy/: it doesn't import
// or reuse anything from the root's assets/js/home.js. The reveal-on-
// scroll observer and the navbar-solid-on-scroll listener below are its
// own copy of that same small, generic behavior (identical to what
// home.js and academy.js also each keep their own copy of).
//
// home.js additionally has dashboard-rotation and hero-dashboard glow-
// pulse code that assumes a .hero-dashboard / .dashboard-item element
// exists on the page. This page has neither, so that code is
// intentionally NOT copied here — calling it against a page that lacks
// those elements is exactly the kind of bug worth avoiding.
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
