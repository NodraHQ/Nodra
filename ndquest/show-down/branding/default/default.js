/* =========================================================
   TEMA DE MARCA — Padrão

   Todo tema precisa seguir exatamente esta estrutura (ver
   validação completa em "../theme-schema.js"). Nenhum campo
   pode ficar de fora: se faltar algo, o jogo recusa carregar.

   - colors: paleta completa do tema (ver theme-schema.js para
     o que cada cor controla).
   - fonts.display / fonts.body: font-family usada em títulos e
     no corpo do texto.
   - fonts.files: fontes locais próprias do tema (nenhuma aqui —
     este tema reaproveita Fraunces/Work Sans, já carregadas
     pelo projeto em index.html).
   - logo: caminho para a imagem da logo (opcional, pode ser
     null). Se o arquivo não existir/carregar, um texto com o
     nome do tema é exibido no lugar.
   - logoBackground: cor de fundo opcional atrás da logo dentro
     do envelope — útil quando a logo tem partes claras que
     ficariam "apagadas" sobre o papel claro. null para não usar.
   - envelopeTexture: caminho para uma imagem/textura de fundo
     do envelope (opcional). null para usar o papel padrão.
   - slogan: frase curta exibida abaixo do título na tela de
     envelopes (opcional). null para não exibir nenhuma.
   ========================================================= */
const theme = {
  name: "CryptoBasics",

  colors: {
    primary: "#fea203",
    primaryLight: "#ffc24d",

    background: "#071b30",
    backgroundAlt: "#0d2846",

    surface: "#123a5e",
    surfaceBorder: "rgba(254, 162, 3, 0.18)",

    text: "#eaf2fa",
    textMuted: "#9fb4c9",

    success: "#5fa77c",
    error: "#b5544a",

    paper: "#eef3f8",
    paperDark: "#cfdbe8",
    paperShadow: "#a8bdd1"
  },

  fonts: {
    display: "'Fraunces', serif",
    body: "'Work Sans', sans-serif",
    files: []
  },

  logo: "assets/logos/ndquest-light.png",
  logoBackground: null,
  envelopeTexture: null,
  slogan: {
    pt: "Complete missões. Ganhe mais.",
    en: "Complete Missions. Earn More."
  }
};

export default theme;
