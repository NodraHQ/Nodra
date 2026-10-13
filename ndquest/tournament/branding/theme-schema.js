/* =========================================================
   ESQUEMA DE TEMA — validação

   Um tema só é considerado válido se tiver TODOS os campos
   obrigatórios abaixo, corretamente preenchidos. Não existe
   "valor de segurança" para campo faltando: se algo estiver
   incompleto ou errado, o jogo recusa carregar e aponta
   exatamente o que falta e em qual arquivo, ao invés de rodar
   com uma aparência genérica por acidente.

   Campos obrigatórios em "colors" (aceitam hexadecimal, ex.:
   "#c9a227", ou rgb()/rgba() quando precisar de transparência,
   ex.: "rgba(232, 199, 102, 0.18)" — útil em surfaceBorder):
     - primary, primaryLight     → cor de destaque (botões, bordas, glow)
     - background, backgroundAlt → fundo da tela
     - surface, surfaceBorder    → fundo e borda dos cards/overlays
                                    (pergunta, resultado, fim de evento)
     - text, textMuted           → cor do texto
     - success, error            → feedback de acerto/erro
     - paper, paperDark, paperShadow → cor do "papel" do envelope

   Campos obrigatórios em "fonts":
     - display  → string de font-family para títulos
                  (ex.: "'Fraunces', serif")
     - body     → string de font-family para o corpo do texto
                  (ex.: "'Work Sans', sans-serif")
     - files    → array de fontes locais do tema (pode ser [] se o
                  tema reaproveitar as fontes já carregadas pelo
                  projeto, Fraunces e Work Sans — mas o campo
                  precisa existir, mesmo vazio). Cada item:
                  { family, path, weight?, style? }
                  - family: nome da font-family declarada no @font-face
                  - path: caminho do arquivo .woff2 dentro da pasta do tema
                  - weight: peso da fonte (padrão "400")
                  - style: "normal" ou "italic" (padrão "normal")

   Campos obrigatórios no nível raiz do tema (podem ser null, mas
   a chave precisa existir explicitamente no objeto):
     - logo, logoBackground, envelopeTexture, slogan
   ========================================================= */

const REQUIRED_COLOR_KEYS = [
  'primary', 'primaryLight',
  'background', 'backgroundAlt',
  'surface', 'surfaceBorder',
  'text', 'textMuted',
  'success', 'error',
  'paper', 'paperDark', 'paperShadow'
];

const REQUIRED_OPTIONAL_KEYS = ['logo', 'logoBackground', 'envelopeTexture', 'slogan'];

const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const RGB_COLOR_REGEX = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/;

function isValidColor(value) {
  return typeof value === 'string' && (HEX_COLOR_REGEX.test(value) || RGB_COLOR_REGEX.test(value));
}

function fail(themeLabel, message) {
  throw new Error(`Tema inválido ("${themeLabel}"): ${message}`);
}

function validateTheme(theme, sourceFile) {
  if (!theme || typeof theme !== 'object') {
    fail(sourceFile, 'o arquivo não exporta (export default) um objeto de tema.');
  }

  if (!theme.name || typeof theme.name !== 'string') {
    fail(sourceFile, 'campo "name" é obrigatório e precisa ser um texto.');
  }

  const label = theme.name;

  if (!theme.colors || typeof theme.colors !== 'object') {
    fail(label, 'campo "colors" é obrigatório e precisa ser um objeto.');
  }
  REQUIRED_COLOR_KEYS.forEach((key) => {
    const value = theme.colors[key];
    if (!isValidColor(value)) {
      fail(
        label,
        `colors.${key} é obrigatório e precisa ser uma cor válida em hex ou ` +
        `rgb()/rgba() (ex.: "#c9a227" ou "rgba(232, 199, 102, 0.18)"). ` +
        `Valor atual: ${JSON.stringify(value)}`
      );
    }
  });

  if (!theme.fonts || typeof theme.fonts !== 'object') {
    fail(label, 'campo "fonts" é obrigatório e precisa ser um objeto.');
  }
  ['display', 'body'].forEach((key) => {
    if (!theme.fonts[key] || typeof theme.fonts[key] !== 'string') {
      fail(
        label,
        `fonts.${key} é obrigatório e precisa ser uma string de font-family ` +
        `(ex.: "'Fraunces', serif").`
      );
    }
  });
  if (!Array.isArray(theme.fonts.files)) {
    fail(
      label,
      'fonts.files é obrigatório e precisa ser um array (pode ser vazio: [] — ' +
      'nesse caso o tema reaproveita as fontes já carregadas pelo projeto, ' +
      'Fraunces e Work Sans).'
    );
  }
  theme.fonts.files.forEach((file, index) => {
    if (!file || typeof file !== 'object') {
      fail(label, `fonts.files[${index}] precisa ser um objeto { family, path }.`);
    }
    ['family', 'path'].forEach((key) => {
      if (!file[key] || typeof file[key] !== 'string') {
        fail(label, `fonts.files[${index}].${key} é obrigatório.`);
      }
    });
  });

  REQUIRED_OPTIONAL_KEYS.forEach((key) => {
    if (!(key in theme)) {
      fail(
        label,
        `campo "${key}" precisa existir explicitamente no objeto do tema ` +
        `(pode ter valor null, mas a chave não pode estar ausente).`
      );
    }
  });

  return theme;
}

export { validateTheme };
