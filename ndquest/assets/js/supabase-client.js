// ==================================================================
// NDQUEST — supabase-client.js
//
// Conexão com o Supabase, própria do NDQuest (não é compartilhada com
// Academy nem com a raiz — mesma regra de self-containment do resto
// do projeto).
//
// A chave abaixo é a PUBLISHABLE key (sb_publishable_...), feita pra
// ficar exposta em código de navegador — ela só tem os poderes que as
// políticas de Row Level Security (configuradas no painel do
// Supabase) permitirem. Nunca coloque a Secret key aqui.
//
// Carregado como script global (não como ES module) de propósito:
// existe um bug conhecido (dez/2025) no jeito "import ... from
// '.../+esm'" que quebra em runtime no navegador em alguns casos.
// Este arquivo espera que https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2
// já tenha sido carregado antes dele via <script> comum no HTML.
// ==================================================================

const NDQUEST_SUPABASE_URL = "https://tndiyjitylqjajtlneyi.supabase.co";
const NDQUEST_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_LNbUGyVXxa9Z-j4uFjWhxQ_5LONKXqI";

const ndquestSupabase = supabase.createClient(
    NDQUEST_SUPABASE_URL,
    NDQUEST_SUPABASE_PUBLISHABLE_KEY
);
