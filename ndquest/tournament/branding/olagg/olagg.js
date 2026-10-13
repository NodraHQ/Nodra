/* =========================================================
   TEMA DE MARCA — OlaGG

   Ver estrutura completa e obrigatoriedade dos campos em
   "../theme-schema.js". Tema estático, disponível pra todo mundo
   (não depende de VIP nem do Supabase).

   Cores amostradas direto do print do site da OlaGG:
   - primary #6046f3: botão "Entrar" (texto branco sobre ele fica
     com contraste 5,7:1).
   - background #0c0623: fundo da página; backgroundAlt #1e144c:
     barra superior; surface #21154f: barra lateral e chips.
   - text #ffffff; success #459a4f (verde do chip de missões);
     paper #f0ecfd (lavanda dos selos de XP).

   Derivadas (não existem no print, escolhidas pra manter a
   legibilidade sobre o fundo escuro):
   - primaryLight #9d8bff (contraste 5,9:1 sobre a surface; o roxo
     puro da marca ficaria abaixo de 4,5:1 em texto pequeno).
   - textMuted #a8a4b8 (o cinza do site, #868391, dá só 4,4:1 sobre
     a surface).
   - error #ff6b6b, paperDark e paperShadow (tons do paper).

   Logo: SVG oficial copiado do cabeçalho do site da OlaGG, sem
   edição (escudo em degradê e texto branco, feito para fundo
   escuro). Fica em assets/logos/olagg.svg.
   ========================================================= */
const theme = {
  name: "OlaGG",

  colors: {
    primary: "#6046f3",
    primaryLight: "#9d8bff",

    background: "#0c0623",
    backgroundAlt: "#1e144c",

    surface: "#21154f",
    surfaceBorder: "rgba(96, 70, 243, 0.35)",

    text: "#ffffff",
    textMuted: "#a8a4b8",

    success: "#459a4f",
    error: "#ff6b6b",

    paper: "#f0ecfd",
    paperDark: "#d8cef7",
    paperShadow: "#b3a4ea"
  },

  fonts: {
    display: "'Fraunces', serif",
    body: "'Work Sans', sans-serif",
    files: []
  },

  logo: "assets/logos/olagg.svg",
  logoBackground: null,
  envelopeTexture: null,
  slogan: null
};

export default theme;
