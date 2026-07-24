/* =========================================================
   TEMA DE MARCA — Avalanche

   Ver estrutura completa e obrigatoriedade dos campos em
   "../theme-schema.js".

   Cor vermelha (#E6212F) extraída direto do arquivo vetorial
   oficial enviado (AvalancheLogo_Horizontal_1C_Red.svg) — bate
   com a cor oficial de marca da Avalanche (~#E84142 nas fontes
   públicas; usamos o valor exato do arquivo original).

   A logo é monocromática (só vermelho, sem branco/preto), então
   ao contrário da NDQuest/Stellar não precisou de uma versão
   clara separada: o vermelho já contrasta bem sozinho contra o
   fundo escuro do tema.

   Slogan: não existe um tagline curto "oficial" único e público
   da Avalanche (diferente da Stellar). A frase abaixo foi escrita
   com base no posicionamento real da marca (velocidade e
   escalabilidade), não é uma citação literal.
   ========================================================= */
const theme = {
  name: "Avalanche",

  colors: {
    primary: "#e6212f",
    primaryLight: "#ff5a5a",

    background: "#150808",
    backgroundAlt: "#210d0d",

    surface: "#2e1414",
    surfaceBorder: "rgba(230, 33, 47, 0.18)",

    text: "#f7eded",
    textMuted: "#b79a9a",

    success: "#5fa77c",
    error: "#b5544a",

    paper: "#ffffff",
    paperDark: "#e8dede",
    paperShadow: "#c9b3b3"
  },

  fonts: {
    display: "'Fraunces', serif",
    body: "'Work Sans', sans-serif",
    files: []
  },

  logo: "assets/logos/avalanche.png",
  logoBackground: null,
  envelopeTexture: null,
  slogan: {
    pt: "Construída para velocidade. Feita para escalar.",
    en: "Built for speed. Made to scale."
  }
};

export default theme;
