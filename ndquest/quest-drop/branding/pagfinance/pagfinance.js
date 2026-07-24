/* =========================================================
   TEMA DE MARCA — PagFinance

   Ver estrutura completa e obrigatoriedade dos campos em
   "../theme-schema.js".

   Cores extraídas direto do arquivo vetorial enviado
   (pagfinance1.svg): texto em cinza-quase-preto (#1D1D1B) e um
   ícone em gradiente roxo→verde (#674F9B → #67B980).

   Diferente dos outros temas (todos de fundo escuro), este é o
   primeiro tema CLARO do sistema: o logo original já foi
   desenhado com texto escuro para uso sobre fundo claro, então
   em vez de recolorir a logo, o tema inteiro segue essa direção
   — mantém a logo exatamente como enviada, sem edição.

   O verde do gradiente (#67B980) não foi usado no gradiente do
   botão/selo porque, calculando o contraste, texto claro sobre
   esse verde específico fica abaixo do mínimo recomendado de
   legibilidade — o roxo sozinho (dois tons) resolve isso sem
   perder a identidade. O verde aparece como cor de "sucesso".
   ========================================================= */
const theme = {
  name: "PagFinance",

  colors: {
    primary: "#674f9b",
    primaryLight: "#9481c0",

    background: "#f6f5f4",
    backgroundAlt: "#ede9e8",

    surface: "#ffffff",
    surfaceBorder: "rgba(103, 79, 155, 0.18)",

    text: "#1d1d1b",
    textMuted: "#6e6e6c",

    success: "#67b980",
    error: "#b5544a",

    paper: "#fff8ec",
    paperDark: "#f0e2c8",
    paperShadow: "#d9c7a0"
  },

  fonts: {
    display: "'Fraunces', serif",
    body: "'Work Sans', sans-serif",
    files: []
  },

  logo: "assets/logos/pagfinance.png",
  logoBackground: null,
  envelopeTexture: null,
  slogan: {
    pt: "Pagamentos em cripto, do jeito simples.",
    en: "Crypto payments, made simple."
  }
};

export default theme;
