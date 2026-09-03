/* =========================================================
   MANIFESTO DE TEMAS DE MARCA (WHITE LABEL)

   Duas fontes de tema agora, nessa ordem sempre:
   1. Estático (esse arquivo, o "default") - sempre existe, é o
      primeiro da lista, nunca falha.
   2. Supabase (tabela custom_themes) - temas criados por VIPs.
      Carregado depois, de forma assíncrona (ver loadRemoteThemes),
      porque precisa de uma consulta ao banco.

   Pra criar um tema estático novo (o jeito antigo, ainda funciona
   pra parceiros fixos que não passam pelo fluxo de VIP):
   1. Duplique a pasta "default" e renomeie usando um slug curto
      do parceiro (ex.: "branding/pagfinance/"). Renomeie também
      o arquivo dentro dela para esse slug, seguindo exatamente a
      mesma estrutura de dados já usada.
   2. Substitua as cores e, se quiser, aponte "logo" pra uma
      imagem própria dentro de assets/logos/.
   3. Importe o novo arquivo aqui embaixo e adicione ao array
      "rawThemes".

   Todo tema (estático ou do Supabase) passa pela mesma validação
   (ver "./theme-schema.js"). Um tema do Supabase que vier
   incompleto/inválido é apenas ignorado (com aviso no console),
   não trava o jogo inteiro - diferente do estático, que ainda
   segue a regra de "sem modo degradado" (erro visível, pra pegar
   problema de configuração cedo, antes de ir pro ar).
   ========================================================= */
import defaultTheme from './default/default.js';
import { validateTheme } from './theme-schema.js';

const GAME_SLUG = 'roulette';

const rawThemes = [
  { theme: defaultTheme, source: 'branding/default/default.js' }
];

const staticThemes = rawThemes.map(({ theme, source }) => validateTheme(theme, source));

// Converte uma linha de custom_themes (formato do banco) pro formato
// que o tema estático já usa - mesma forma, fonte diferente.
function mapRemoteThemeRow(row) {
  return {
    name: row.name,
    colors: row.colors,
    fonts: row.fonts,
    logo: row.logo_url,
    logoBackground: row.logo_background,
    envelopeTexture: row.envelope_texture_url,
    slogan: { pt: row.slogan_pt, en: row.slogan_en },
  };
}

// Busca os temas do Supabase que valem pra esse jogo, via Edge
// Function compartilhada (ver supabase/functions/ndquest-get-themes)
// - ela já resolve "públicos com dono ainda VIP" + "privados do
// próprio usuário logado" com chave de serviço, sem depender de RLS
// nem de embutir view nenhuma numa consulta direta daqui (isso não
// dava pra garantir sem testar contra o banco real).
export async function loadRemoteThemes(supabaseClient) {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const token = session?.access_token;

    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${window.ndquestSupabaseUrl}/functions/v1/ndquest-get-themes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ game_slug: GAME_SLUG }),
    });

    if (!response.ok) {
      console.error(`Erro ao buscar temas do Supabase (${response.status}), seguindo só com o padrão`);
      return staticThemes;
    }

    const result = await response.json();
    if (result.error) {
      console.error('Erro ao buscar temas do Supabase, seguindo só com o padrão:', result.error);
      return staticThemes;
    }

    const remoteThemes = (result.themes || [])
      .map((row) => {
        try {
          return validateTheme(mapRemoteThemeRow(row), `custom_themes:${row.slug}`);
        } catch (err) {
          console.error(`Tema remoto "${row.slug}" inválido, ignorado:`, err.message);
          return null;
        }
      })
      .filter(Boolean);

    return [...staticThemes, ...remoteThemes];
  } catch (err) {
    console.error('Erro de rede ao buscar temas do Supabase, seguindo só com o padrão:', err);
    return staticThemes;
  }
}

export function getStaticThemes() {
  return staticThemes;
}

export default staticThemes;

