// ==================================================================
// ACADEMY — supabase-client.js
//
// Não existia antes — a home nunca precisou de Supabase até agora.
// Criado só pro indicador de login (navAuth.js) checar sessão.
// Mesmo projeto/chave que o resto do site. Self-contained: cópia
// própria desta pasta.
// ==================================================================

const NODRA_SUPABASE_URL = "https://tndiyjitylqjajtlneyi.supabase.co";
const NODRA_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_LNbUGyVXxa9Z-j4uFjWhxQ_5LONKXqI";

window.nodraSupabase = supabase.createClient(
    NODRA_SUPABASE_URL,
    NODRA_SUPABASE_PUBLISHABLE_KEY
);

// Exposto separado - precisa pra montar a URL das Edge Functions
// (${URL}/functions/v1/nome-da-funcao). Academy não chamava nenhuma
// até agora, passou a precisar com academy-grant-module-badge (ver
// cada módulo/*.js) - mesmo padrão que o resto do site já usava.
window.nodraSupabaseUrl = NODRA_SUPABASE_URL;
window.nodraSupabaseAnonKey = NODRA_SUPABASE_PUBLISHABLE_KEY;
