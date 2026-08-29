// ==================================================================
// ADMIN — supabase-client.js
//
// Cópia própria do Admin (não referencia ndquest/ nem nenhuma outra
// pasta). Mesma regra de self-containment do resto do projeto.
//
// A chave abaixo é a PUBLISHABLE key (sb_publishable_...), feita pra
// ficar exposta em código de navegador. Nunca coloque a Secret key
// aqui.
//
// Diferente dos jogos (onde o Supabase guarda salas abertas, sem
// RLS), aqui ele guarda login e perfil — a tabela profiles tem RLS
// de verdade (SQL rodado direto no painel, não fica em arquivo neste
// repo — ver docs/LOGIN_WALLET_ARCHITECTURE.md).
// ==================================================================

const NDQUEST_SUPABASE_URL = "https://tndiyjitylqjajtlneyi.supabase.co";
const NDQUEST_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_LNbUGyVXxa9Z-j4uFjWhxQ_5LONKXqI";

// admin.js precisa montar a URL das Edge Functions
// (${URL}/functions/v1/nome-da-funcao) — por isso, só nesta cópia, a
// URL também fica exposta separadamente.
window.nodraSupabaseUrl = NDQUEST_SUPABASE_URL;

window.nodraSupabase = supabase.createClient(
    NDQUEST_SUPABASE_URL,
    NDQUEST_SUPABASE_PUBLISHABLE_KEY
);
