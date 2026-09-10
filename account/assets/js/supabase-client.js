// ==================================================================
// ACCOUNT — supabase-client.js
//
// Cópia própria do Account (não referencia ndquest/ nem nenhuma outra
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

window.nodraSupabase = supabase.createClient(
    NDQUEST_SUPABASE_URL,
    NDQUEST_SUPABASE_PUBLISHABLE_KEY
);

// Exposta separada pra quem precisa montar a URL de uma Edge
// Function na mão (ex: fetch direto, sem passar pelo client) —
// reportado ao vivo: o botão "Conceder Badge" ficava travado pra
// sempre porque essa variável nunca existia aqui, só no arquivo
// equivalente do ndquest/. O fetch virava uma URL quebrada
// ("undefined/functions/v1/..."), e sem tratamento de erro isso
// nunca reabilitava o botão.
window.nodraSupabaseUrl = NDQUEST_SUPABASE_URL;

// Mesma ideia da URL acima, mas pra chave - Edge Functions do
// Supabase exigem essa chave (ou um token de usuário) em toda
// chamada, mesmo pra function pensada pra ser pública/sem login.
// O client oficial (window.nodraSupabase) manda isso sozinho por
// baixo dos panos; um fetch cru direto na function não manda nada
// a menos que a gente inclua na mão - bug real reportado ao vivo:
// get-badge-claim-info (chamada assim, sem sessão, de propósito)
// voltava 401 por causa exatamente disso.
window.nodraSupabaseAnonKey = NDQUEST_SUPABASE_PUBLISHABLE_KEY;
