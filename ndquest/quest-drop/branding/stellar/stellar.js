/* =========================================================
   TEMA DE MARCA — Stellar

   Ver estrutura completa e obrigatoriedade dos campos em
   "../theme-schema.js".

   Identidade real da Stellar (Stellar Development Foundation):
   monocromática, preto/branco, sem cor de acento — por isso
   "primary"/"primaryLight" aqui não são uma cor de destaque
   colorida como nos outros temas, e sim um branco/cinza-claro
   (o "acento" vira luminosidade, não matiz).

   Duas versões da logo:
   - stellar.png: original, preta — usada só no futuro se algum
     dia precisar dela sobre fundo claro.
   - stellar-light.png: mesma logo com o preto trocado por creme
     (--color-paper), usada na hero e na marca d'água, que ficam
     sobre o fundo escuro do tema.
   ========================================================= */
const theme = {
  name: "Stellar",

  colors: {
    primary: "#f5f5f0",
    primaryLight: "#ffffff",

    background: "#0a0a0a",
    backgroundAlt: "#161616",

    surface: "#1f1f1f",
    surfaceBorder: "rgba(255, 255, 255, 0.14)",

    text: "#f5f5f0",
    textMuted: "#9a9a9a",

    success: "#5fa77c",
    error: "#b5544a",

    paper: "#ffffff",
    paperDark: "#e3e3e3",
    paperShadow: "#c2c2c2"
  },

  fonts: {
    display: "'Fraunces', serif",
    body: "'Work Sans', sans-serif",
    files: []
  },

  logo: "assets/logos/stellar-light.png",
  logoBackground: null,
  envelopeTexture: null,
  slogan: {
    pt: "Onde o blockchain encontra o mundo real",
    en: "Where blockchain meets the real world"
  }
};

export default theme;
