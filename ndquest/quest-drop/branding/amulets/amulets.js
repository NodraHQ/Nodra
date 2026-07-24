/* =========================================================
   TEMA DE MARCA — Amulets

   Ver estrutura completa e obrigatoriedade dos campos em
   "../theme-schema.js".

   Azul (#4671ED) extraído direto do arquivo enviado
   (amulets.png) — logo de cor única, funciona bem direto sobre
   fundo escuro, sem precisar de versão clara separada.

   Slogan escrito com base no posicionamento real da marca
   (proteção e gestão de risco em DeFi) — não é uma citação
   oficial.
   ========================================================= */
const theme = {
  name: "Amulets",

  colors: {
    primary: "#4671ed",
    primaryLight: "#7b98f5",

    background: "#0a1024",
    backgroundAlt: "#121b3a",

    surface: "#1a2650",
    surfaceBorder: "rgba(70, 113, 237, 0.18)",

    text: "#eaeffc",
    textMuted: "#9aa8cc",

    success: "#5fa77c",
    error: "#b5544a",

    paper: "#ffffff",
    paperDark: "#e2e6f2",
    paperShadow: "#c3cbe3"
  },

  fonts: {
    display: "'Fraunces', serif",
    body: "'Work Sans', sans-serif",
    files: []
  },

  logo: "assets/logos/amulets.png",
  logoBackground: null,
  envelopeTexture: null,
  slogan: {
    pt: "Sua proteção em DeFi, sempre com você.",
    en: "Your protection in DeFi, always with you."
  }
};

export default theme;
