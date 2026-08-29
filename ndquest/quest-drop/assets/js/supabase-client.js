// ==================================================================
// QUEST DROP — supabase-client.js
//
// Não existia antes — Quest Drop é local por design (sem sala em
// tempo real no Supabase, ver NDQUEST_ARCHITECTURE.md). Criado agora
// só pro indicador de login (navAuthLight.js) conseguir checar sessão
// e mostrar avatar/nome de quem estiver logado.
//
// Mesmo projeto e mesma chave publishable que os outros jogos —
// window.ndquestSupabase, mesmo nome que Time Attack/Show Down/Tap
// Rush/Roulette já usam, por consistência.
// ==================================================================

const NDQUEST_SUPABASE_URL = "https://tndiyjitylqjajtlneyi.supabase.co";
const NDQUEST_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_LNbUGyVXxa9Z-j4uFjWhxQ_5LONKXqI";

window.ndquestSupabase = supabase.createClient(
    NDQUEST_SUPABASE_URL,
    NDQUEST_SUPABASE_PUBLISHABLE_KEY
);
