/* =========================================================
   MANIFESTO DE TEMAS DE MARCA (WHITE LABEL)

   O script.js nunca precisa ser alterado para trocar ou
   adicionar uma identidade visual. Para criar um novo tema
   (ex.: um novo parceiro/empresa):

   1. Duplique a pasta "default" e renomeie usando o MESMO slug
      do pacote de perguntas do parceiro (ex.: pacote de perguntas
      "questions/pagfinance.js" → pasta "branding/pagfinance/").
      Renomeie também o arquivo dentro dela para esse slug
      (ex.: "branding/pagfinance/pagfinance.js"), seguindo
      exatamente a mesma estrutura de dados já usada.
   2. Substitua as cores e, se quiser, adicione logo.png e/ou
      uma textura de envelope dentro da nova pasta.
   3. Importe o novo arquivo aqui embaixo.
   4. Adicione-o ao array "themes".

   O tema aparecerá automaticamente no seletor da tela de
   configuração.

   Todo tema listado aqui passa por validação (ver
   "./theme-schema.js"). Se um tema estiver incompleto ou com
   algum campo errado, o carregamento do jogo é interrompido com
   uma mensagem indicando exatamente o que corrigir — não existe
   modo "degradado" com aparência genérica.
   ========================================================= */
import defaultTheme from './default/default.js';
import evervalueTheme from './evervalue/evervalue.js';
import stellarTheme from './stellar/stellar.js';
import avalancheTheme from './avalanche/avalanche.js';
import amuletsTheme from './amulets/amulets.js';
import pagfinanceTheme from './pagfinance/pagfinance.js';
import bitgetWalletTheme from './bitget-wallet/bitget-wallet.js';
import { validateTheme } from './theme-schema.js';

const rawThemes = [
  { theme: defaultTheme, source: 'branding/default/default.js' },
  { theme: evervalueTheme, source: 'branding/evervalue/evervalue.js' },
  { theme: stellarTheme, source: 'branding/stellar/stellar.js' },
  { theme: avalancheTheme, source: 'branding/avalanche/avalanche.js' },
  { theme: amuletsTheme, source: 'branding/amulets/amulets.js' },
  { theme: pagfinanceTheme, source: 'branding/pagfinance/pagfinance.js' },
  { theme: bitgetWalletTheme, source: 'branding/bitget-wallet/bitget-wallet.js' }
];

const themes = rawThemes.map(({ theme, source }) => validateTheme(theme, source));

export default themes;
