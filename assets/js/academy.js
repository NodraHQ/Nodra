// ======================================
// NODRA ACADEMY
// academy.js
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
// DASHBOARD PROGRESS
// ===============================

const modules=[

"Blockchain",

"Wallets",

"Networks",

"Assets"

];

let current=0;

const dashboardItems=document.querySelectorAll(".dashboard-item");

function rotateDashboard(){

dashboardItems.forEach(item=>item.classList.remove("active"));

dashboardItems[current].classList.add("active");

current++;

if(current>=dashboardItems.length){

current=0;

}

}

setInterval(rotateDashboard,2200);


// ===============================
// HERO GLOW
// ===============================

const dashboard=document.querySelector(".hero-dashboard");

let glow=0;

setInterval(()=>{

glow++;

dashboard.style.boxShadow=

`0 0 ${30+glow}px rgba(77,166,255,.18)`;

if(glow>12){

glow=0;

}

},120);


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