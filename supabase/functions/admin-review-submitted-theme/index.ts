// ==================================================================
// admin-review-submitted-theme
//
// Body: { themeId: string, action: "approve" | "reject", notes?: string }
//
// Aprovar: status vira "public" - passa a aparecer pra qualquer host
// no seletor de tema daquele jogo (ver ndquest-get-themes), contanto
// que o dono continue VIP.
// Rejeitar: status vira "rejected", com o motivo em reviewer_notes -
// aparece como aviso pro VIP na própria área dele, que pode corrigir
// e reenviar de graça (ver vip-resubmit-theme), sem pagar de novo.
// ==================================================================

import { corsHeaders, withAdminAuth, logAdminAction } from "../_shared/adminAuth.ts";

Deno.serve(withAdminAuth(async (req, { adminClient, adminId }) => {

    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Use POST" }), {
            status: 405,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const body = await req.json().catch(() => null);
    const themeId = body?.themeId;
    const action = body?.action;
    const notes = typeof body?.notes === "string" ? body.notes.trim() : null;

    if (typeof themeId !== "string" || (action !== "approve" && action !== "reject")) {
        return new Response(
            JSON.stringify({ error: 'Body precisa de { themeId: string, action: "approve" | "reject" }' }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    if (action === "reject" && !notes) {
        return new Response(JSON.stringify({ error: "Rejeitar precisa de um motivo em notes, pro VIP saber o que corrigir" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const { data: theme, error: themeError } = await adminClient
        .from("custom_themes")
        .select("id, status, slug")
        .eq("id", themeId)
        .maybeSingle();

    if (themeError || !theme) {
        return new Response(JSON.stringify({ error: "Tema não encontrado" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    if (theme.status !== "pending_review") {
        return new Response(JSON.stringify({ error: "Esse tema não está esperando revisão" }), {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const newStatus = action === "approve" ? "public" : "rejected";

    const { error: updateError } = await adminClient
        .from("custom_themes")
        .update({ status: newStatus, reviewer_notes: action === "reject" ? notes : null })
        .eq("id", themeId);

    if (updateError) {
        console.error("admin-review-submitted-theme: erro ao atualizar", updateError);
        return new Response(JSON.stringify({ error: "Erro ao processar" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    await logAdminAction(adminClient, adminId, `${action}_theme`, null, { themeId, slug: theme.slug, notes });

    return new Response(JSON.stringify({ success: true, status: newStatus }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

}));
