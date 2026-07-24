/* =========================================================
   TEMA DE MARCA — Bitget Wallet

   Ver estrutura completa e obrigatoriedade dos campos em
   "../theme-schema.js".

   O arquivo enviado (BitgetWallet.svg) já é uma versão branca +
   um ícone escuro (#001F29), feita para uso sobre fundo escuro
   — usada direto, sem recolorir. O ciano vibrante (#00F0FF) é a
   cor oficial de marca da Bitget, confirmada via busca (não
   estava presente no arquivo enviado, que é monocromático).

   Slogan escrito com base no posicionamento real do produto
   (carteira Web3 self-custodial) — não é uma citação oficial.
   ========================================================= */
const theme = {
  name: "Bitget Wallet",

  colors: {
    primary: "#00f0ff",
    primaryLight: "#7cf6ff",

    background: "#020202",
    backgroundAlt: "#0c1417",

    surface: "#121c1f",
    surfaceBorder: "rgba(0, 240, 255, 0.18)",

    text: "#eafcff",
    textMuted: "#96b3b8",

    success: "#5fa77c",
    error: "#b5544a",

    paper: "#ffffff",
    paperDark: "#e3eef0",
    paperShadow: "#c2d6d9"
  },

  fonts: {
    display: "'Fraunces', serif",
    body: "'Work Sans', sans-serif",
    files: []
  },

  logo: "assets/logos/bitget-wallet.png",
  logoBackground: null,
  envelopeTexture: null,
  slogan: {
    pt: "Sua carteira Web3, seu controle total.",
    en: "Your Web3 wallet, your full control."
  }
};

export default theme;
