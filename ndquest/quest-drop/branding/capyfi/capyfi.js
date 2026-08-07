/* =========================================================
   TEMA DE MARCA — CapyFi

   Paleta tirada direto do logo enviado: laranja #DE6437 (a
   capivara/marca), escuro #121212 (detalhes) e quase-branco
   #F2F2F2 (o texto "CapyFi" no logo). Segue a mesma estrutura
   obrigatória de "../theme-schema.js".
   ========================================================= */
const theme = {
  name: "CapyFi",

  colors: {
    primary: "#DE6437",
    primaryLight: "#E8875F",

    background: "#141414",
    backgroundAlt: "#1c1c1c",

    surface: "#232323",
    surfaceBorder: "rgba(222, 100, 55, 0.22)",

    text: "#F2F2F2",
    textMuted: "#a3a3a3",

    success: "#5fa77c",
    error: "#b5544a",

    paper: "#f5ede1",
    paperDark: "#e0d0b8",
    paperShadow: "#b8a888"
  },

  fonts: {
    display: "'Fraunces', serif",
    body: "'Work Sans', sans-serif",
    files: []
  },

  logo: "branding/capyfi/capyfi-logo.svg",
  logoBackground: "#121212",
  envelopeTexture: null,
  slogan: {
    pt: "DeFi simples para a América Latina",
    en: "Simple DeFi for Latin America"
  }
};

export default theme;
