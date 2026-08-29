// ==================================================================
// admin-manage-vip-code
//
// Body: { codeId: string, action: "pause" | "resume" | "delete" }
//
// Pausar/retomar só liga/desliga uma flag - reversível, não perde
// histórico. Apagar apaga de vez - as concessões (quem já resgatou)
// são apagadas primeiro, senão a chave estrangeira bloqueia (mesmo
// padrão do admin-delete-badge). Note que apagar NÃO revoga o VIP de
// quem já resgatou - só impede reuso futuro do código, o que já
// tinha acontecido continua valendo.
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
    const codeId = body?.codeId;
    const action = body?.action;

    if (typeof codeId !== "string" || !["pause", "resume", "delete"].includes(action)) {
        return new Response(
            JSON.stringify({ error: 'Body precisa de { codeId: string, action: "pause" | "resume" | "delete" }' }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    const { data: code, error: fetchError } = await adminClient
        .from("vip_invite_codes")
        .select("id, code")
        .eq("id", codeId)
        .maybeSingle();

    if (fetchError || !code) {
        return new Response(JSON.stringify({ error: "Código não encontrado" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    if (action === "pause" || action === "resume") {
        const { error } = await adminClient
            .from("vip_invite_codes")
            .update({ paused: action === "pause" })
            .eq("id", codeId);

        if (error) {
            console.error("Erro ao pausar/retomar código:", error);
            return new Response(JSON.stringify({ error: "Erro ao atualizar o código" }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        await logAdminAction(adminClient, adminId, `${action}_vip_code`, null, { codeId, code: code.code });

        return new Response(JSON.stringify({ success: true, action }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    // action === "delete"
    const { error: deleteRedemptionsError } = await adminClient
        .from("vip_invite_redemptions")
        .delete()
        .eq("code_id", codeId);

    if (deleteRedemptionsError) {
        console.error("Erro ao apagar resgates do código:", deleteRedemptionsError);
        return new Response(JSON.stringify({ error: "Erro ao apagar os resgates do código" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const { error: deleteCodeError } = await adminClient
        .from("vip_invite_codes")
        .delete()
        .eq("id", codeId);

    if (deleteCodeError) {
        console.error("Erro ao apagar código:", deleteCodeError);
        return new Response(JSON.stringify({ error: "Erro ao apagar o código" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    await logAdminAction(adminClient, adminId, "delete_vip_code", null, { codeId, code: code.code });

    return new Response(JSON.stringify({ success: true, action: "delete" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

}));
