/* =========================================================
   TEMA DE MARCA — EverValue

   Ver estrutura completa e obrigatoriedade dos campos em
   "../theme-schema.js".

   Observação: os campos abaixo que este tema não usava antes
   (backgroundAlt, surface, surfaceBorder, text, textMuted,
   success, error, paper/paperDark/paperShadow, fonts) foram
   preenchidos com os MESMOS valores do tema "Padrão", para
   manter o visual atual exatamente como está. Quando formos
   criar/ajustar temas de verdade, esses valores podem — e
   devem — ser personalizados para a identidade da EverValue.
   ========================================================= */
const theme = {
  name: "EverValue",

  colors: {
    primary: "#fc9201",
    primaryLight: "#ffb84d",

    background: "#150f0a",
    backgroundAlt: "#211826",

    surface: "#2a1f30",
    surfaceBorder: "rgba(232, 199, 102, 0.18)",

    text: "#f4ebda",
    textMuted: "#b9a98c",

    success: "#5fa77c",
    error: "#b5544a",

    paper: "#f4ebda",
    paperDark: "#e2d2ab",
    paperShadow: "#c9b98c"
  },

  fonts: {
    display: "'Fraunces', serif",
    body: "'Work Sans', sans-serif",
    files: []
  },

  logo: "assets/logos/evervalue.png",
  // fundo escuro atrás da logo: o texto da marca tem partes em
  // branco/cinza-claro que ficariam apagadas sobre o papel claro
  // do envelope sem esse contraste.
  logoBackground: "#1f1712",
  envelopeTexture: null,
  slogan: {
    pt: "O Bitcoin ganha um novo propósito no DeFi",
    en: "Bitcoin gets a new purpose in DeFi"
  }
};

export default theme;
