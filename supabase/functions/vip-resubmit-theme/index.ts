// ==================================================================
// vip-resubmit-theme
//
// Body: { themeId: string }
//
// Reenvio grátis depois de rejeitado - reportado ao vivo: "não barra
// e já era, mando de volta pra revisão, ele corrige e manda de novo
// gratuitamente". Só funciona se o tema já tiver payment_confirmed
// (pago uma vez, na primeira submissão) e estiver com status
// "rejected" - não é uma forma de pular o pagamento inicial.
// ==================================================================

import { corsHeaders, withVipAuth, logVipAction } from "../_shared/vipAuth.ts";

Deno.serve(withVipAuth(async (req, { vipClient, vipId }) => {

    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Use POST" }), {
            status: 405,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const body = await req.json().catch(() => null);
    const themeId = body?.themeId;

    if (typeof themeId !== "string") {
        return new Response(JSON.stringify({ error: "Body precisa de { themeId: string }" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const { data: theme, error: themeError } = await vipClient
        .from("custom_themes")
        .select("id, owner_id, status, payment_confirmed")
        .eq("id", themeId)
        .maybeSingle();

    if (themeError || !theme) {
        return new Response(JSON.stringify({ error: "Tema não encontrado" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    if (theme.owner_id !== vipId) {
        return new Response(JSON.stringify({ error: "Esse tema não é seu" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    if (!theme.payment_confirmed) {
        return new Response(
            JSON.stringify({ error: "Esse tema nunca foi pago - use a submissão normal, com pagamento" }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    if (theme.status !== "rejected") {
        return new Response(
            JSON.stringify({ error: `Esse tema está em "${theme.status}", só dá pra reenviar um tema rejeitado` }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    const { error: updateError } = await vipClient
        .from("custom_themes")
        .update({ status: "pending_review", reviewer_notes: null })
        .eq("id", themeId);

    if (updateError) {
        console.error("vip-resubmit-theme: erro ao reenviar", updateError);
        return new Response(JSON.stringify({ error: "Erro ao reenviar o tema" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    await logVipAction(vipClient, vipId, "resubmit_theme", null, { themeId });

    return new Response(JSON.stringify({ success: true, status: "pending_review" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

}));
