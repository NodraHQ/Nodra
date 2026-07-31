/* =========================================================
   MANIFESTO DE TEMAS DE MARCA (WHITE LABEL)

   O host.js nunca precisa ser alterado para trocar ou
   adicionar uma identidade visual. Para criar um novo tema
   (ex.: um novo parceiro/empresa):

   1. Duplique a pasta "default" e renomeie usando um slug curto
      do parceiro (ex.: "branding/pagfinance/"). Renomeie também
      o arquivo dentro dela para esse slug (ex.:
      "branding/pagfinance/pagfinance.js"), seguindo exatamente a
      mesma estrutura de dados já usada.
   2. Substitua as cores e, se quiser, aponte "logo" pra uma
      imagem própria dentro de assets/logos/.
   3. Importe o novo arquivo aqui embaixo.
   4. Adicione-o ao array "themes".

   O tema aparecerá automaticamente no seletor da tela de
   configuração.

   Todo tema listado aqui passa por validação (ver
   "./theme-schema.js"). Se um tema estiver incompleto ou com
   algum campo errado, o carregamento do jogo é interrompido com
   uma mensagem indicando exatamente o que corrigir — não existe
   modo "degradado" com aparência genérica.

   Hoje só existe o tema "default" (a aparência padrão do
   NDQuest). Novos temas de patrocinador entram aqui quando
   existirem, seguindo os passos acima.
   ========================================================= */
import defaultTheme from './default/default.js';
import { validateTheme } from './theme-schema.js';

const rawThemes = [
  { theme: defaultTheme, source: 'branding/default/default.js' }
];

const themes = rawThemes.map(({ theme, source }) => validateTheme(theme, source));

export default themes;
