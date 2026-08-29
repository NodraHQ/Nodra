// ==================================================================
// admin-check-status
//
// Chamada assim que o painel carrega. Diferente das outras funções
// de admin, esta NÃO lança 403 pra quem não é admin — ela responde
// { isAdmin: false } normalmente, porque o próprio painel usa essa
// resposta pra decidir se mostra a tela de "não autorizado" ou o
// painel de verdade. As outras funções (grant-vip, etc.) continuam
// recusando de verdade (403) mesmo que alguém tente chamar direto,
// sem passar pelo painel.
// ==================================================================

import { corsHeaders, requireAdmin, AdminAuthError } from "../_shared/adminAuth.ts";

Deno.serve(async (req) => {

    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        await requireAdmin(req);
        return new Response(JSON.stringify({ isAdmin: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (err) {
        if (err instanceof AdminAuthError) {
            return new Response(JSON.stringify({ isAdmin: false }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }
        console.error("admin-check-status error:", err);
        return new Response(JSON.stringify({ isAdmin: false }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

});
