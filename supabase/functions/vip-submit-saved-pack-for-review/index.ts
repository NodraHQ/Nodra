// ==================================================================
// vip-submit-saved-pack-for-review
//
// Body: { packId }
//
// Reconstrução do sistema de envio - reportado ao vivo: o desenho
// anterior (fila pública que qualquer VIP navegava e aprovava)
// misturava duas coisas que deveriam ser separadas: pacote PRIVADO
// (só a própria pessoa usa e vê) e pacote PÚBLICO (só o time, pelo
// admin, aprova). Agora só existe uma tabela (vip_saved_packs) - um
// pacote nasce sempre privado, e essa function marca ele como
// pending pra entrar na fila que só o ADMIN vê (não mais outro VIP
// qualquer).
// ==================================================================

import { corsHeaders, withVipAuth, logVipAction } from "../_shared/vipAuth.ts";

Deno.serve(withVipAuth(async (req, { vipClient, vipId }) => {

    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Use POST" }), {
            status: 405,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const body = await req.json().catch(() => ({}));
    const packId = body?.packId;

    if (!packId) {
        return new Response(JSON.stringify({ error: "packId é obrigatório" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const { data: pack, error: fetchError } = await vipClient
        .from("vip_saved_packs")
        .select("id, owner_id, submission_status")
        .eq("id", packId)
        .maybeSingle();

    if (fetchError || !pack || pack.owner_id !== vipId) {
        return new Response(JSON.stringify({ error: "Pacote não encontrado" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    if (pack.submission_status === "pending") {
        return new Response(JSON.stringify({ error: "Esse pacote já está aguardando revisão" }), {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
    if (pack.submission_status === "approved") {
        return new Response(JSON.stringify({ error: "Esse pacote já foi aprovado" }), {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const { error: updateError } = await vipClient
        .from("vip_saved_packs")
        .update({
            submission_status: "pending",
            rejection_reason: null,
            reviewed_by: null,
            reviewed_at: null,
        })
        .eq("id", packId);

    if (updateError) {
        console.error("Erro ao enviar pacote pra revisão:", updateError);
        return new Response(JSON.stringify({ error: "Erro ao enviar pra revisão" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    await logVipAction(vipClient, vipId, "submit_pack_for_review", null, { packId });

    return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

}));
