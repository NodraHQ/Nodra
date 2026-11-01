// ======================================
// NODRA ACADEMY
// academy.js
// Shared behavior for the Academy landing page and every module page.
// ======================================

const observer = new IntersectionObserver(

(entries)=>{

entries.forEach(entry=>{

if(entry.isIntersecting){

entry.target.classList.add("show");

}

});

},

{

threshold:.15

}

);

document

.querySelectorAll(".reveal")

.forEach(el=>observer.observe(el));


// ===============================
// HERO GLOW
// ===============================

const dashboard=document.querySelector(".hero-dashboard");

if(dashboard){

let glow=0;

setInterval(()=>{

glow++;

dashboard.style.boxShadow=

`0 0 ${30+glow}px rgba(77,166,255,.18)`;

if(glow>12){

glow=0;

}

},120);

}


// ===============================
// NAVBAR
// ===============================

const navbar=document.querySelector(".navbar");

window.addEventListener("scroll",()=>{

if(window.scrollY>30){

navbar.classList.add("navbar-solid");

}else{

navbar.classList.remove("navbar-solid");

}

});

// ------------------------------------------------------------------
// Pastas da home (Cripto de A a Z e Suas Primeiras Criptos): cada card
// abre/fecha a sua lista de modulos (so uma aberta por vez). Abrem
// sozinhas se chegarem por #modules ou #first (menu/rodape).
// ------------------------------------------------------------------
(function () {
    const folders = [
        { toggle: document.getElementById("folder-toggle"), panel: document.getElementById("modules"), hash: "#modules" },
        { toggle: document.getElementById("first-toggle"), panel: document.getElementById("first-modules"), hash: "#first" }
    ].filter((f) => f.toggle && f.panel);

    if (!folders.length) return;

    function setOpen(folder, open) {
        folder.toggle.setAttribute("aria-expanded", String(open));
        folder.panel.classList.toggle("is-open", open);
    }

    folders.forEach((folder) => {
        folder.toggle.addEventListener("click", () => {
            const open = folder.toggle.getAttribute("aria-expanded") !== "true";
            folders.forEach((other) => setOpen(other, other === folder && open));
        });
    });

    function openFromHash() {
        const folder = folders.find((f) => f.hash === window.location.hash);
        if (!folder) return;
        folders.forEach((other) => setOpen(other, other === folder));
        folder.panel.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    window.addEventListener("hashchange", openFromHash);
    openFromHash();
})();
