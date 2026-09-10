// ==================================================================
// admin-revoke-badge
//
// Body: { badgeId, userId }
//
// Apaga a linha em user_badges pra essa pessoa+badge - reportado ao
// vivo: "preciso poder remover a badge de um player sem bloquear ele
// de receber novamente". Como isso é só um DELETE simples (não
// grava nenhum "banimento" nem lista de bloqueio em lugar nenhum), a
// mesma badge pode ser concedida de novo pra essa pessoa depois sem
// nenhum obstáculo - a linha nova de user_badges nasce do zero, sem
// vínculo com essa remoção.
// ==================================================================

import { corsHeaders, withAdminAuth } from "../_shared/adminAuth.ts";

Deno.serve(withAdminAuth(async (req, { adminClient }) => {

    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Método não permitido" }), {
            status: 405,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const body = await req.json().catch(() => ({}));
    const { badgeId, userId } = body;

    if (!badgeId || !userId) {
        return new Response(JSON.stringify({ error: "badgeId e userId são obrigatórios" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const { error } = await adminClient
        .from("user_badges")
        .delete()
        .eq("badge_id", badgeId)
        .eq("user_id", userId);

    if (error) {
        console.error("Erro ao remover badge de usuário:", error);
        return new Response(JSON.stringify({ error: "Erro ao remover" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

}));
