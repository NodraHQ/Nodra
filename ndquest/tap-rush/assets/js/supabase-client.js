// ==================================================================
// TAP RUSH — supabase-client.js
//
// Cópia própria do Tap Rush (não referencia a pasta quest-drop/, time-attack/, show-down/ nem roulette/
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
