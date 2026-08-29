// ==================================================================
// SHOW DOWN — supabase-client.js
//
// Cópia própria do Show Down (não referencia a pasta quest-drop/ nem time-attack/
// nem ndquest/ raiz). Mesma regra de self-containment do resto do
// projeto.
//
// A chave abaixo é a PUBLISHABLE key (sb_publishable_...), feita pra
// ficar exposta em código de navegador. Nunca coloque a Secret key
// aqui.
//
// Diferente do Quest Drop (onde o Supabase é só um extra, pro envio
// de perguntas), aqui ele é essencial: a sala inteira vive nele.
// ==================================================================

const NDQUEST_SUPABASE_URL = "https://tndiyjitylqjajtlneyi.supabase.co";
const NDQUEST_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_LNbUGyVXxa9Z-j4uFjWhxQ_5LONKXqI";

window.ndquestSupabase = supabase.createClient(
    NDQUEST_SUPABASE_URL,
    NDQUEST_SUPABASE_PUBLISHABLE_KEY
);

// Exposto separado — precisa pra montar a URL das Edge Functions
// (${URL}/functions/v1/nome-da-funcao), usadas pelo Mecanismo B (ver
// docs/BADGE_INTEGRITY_ARCHITECTURE.md).
window.ndquestSupabaseUrl = NDQUEST_SUPABASE_URL;
window.ndquestSupabaseAnonKey = NDQUEST_SUPABASE_PUBLISHABLE_KEY;
