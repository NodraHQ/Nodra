// ==================================================================
// admin-grant-vip
//
// Body: { targetUserId: string, grant: boolean, tier?: "bronze" | "prata" | "gold" }
//
// Muda profiles.is_vip (e vip_tier, quando concedendo) e grava no
// admin_audit_log na mesma chamada — nunca separado, pra nunca
// existir uma concessão sem registro.
//
// Bug real reportado ao vivo: essa function nunca gravou vip_tier
// nenhum - só ligava is_vip=true, e a conta ficava sem tier definido
// (null), o que faz toda regra de cota (badge/tema/pacote) cair no
// fallback de bronze silenciosamente, e a tela de Usuários não tinha
// como mostrar qual tier a pessoa tem porque a coluna nem existia.
// ==================================================================

import { corsHeaders, withAdminAuth, logAdminAction } from "../_shared/adminAuth.ts";

const VALID_TIERS = ["bronze", "prata", "gold"];

Deno.serve(withAdminAuth(async (req, { adminClient, adminId }) => {

    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Use POST" }), {
            status: 405,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const body = await req.json().catch(() => null);
    const targetUserId = body?.targetUserId;
    const grant = body?.grant;
    const tier = body?.tier;

    if (typeof targetUserId !== "string" || typeof grant !== "boolean") {
        return new Response(JSON.stringify({ error: "Body precisa de { targetUserId: string, grant: boolean }" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    if (grant && !VALID_TIERS.includes(tier)) {
        return new Response(JSON.stringify({ error: 'Concedendo VIP, tier precisa ser "bronze", "prata" ou "gold"' }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    // Revogar limpa a data de expiração e o tier também, não só
    // is_vip - reportado ao vivo com conta de teste: revogar só
    // desligava is_vip, a expiração antiga ficava escondida e
    // reaparecia inteira (somando em cima) na próxima vez que a
    // conta virasse VIP de novo, seja por código ou pagamento.
    const updatePayload: Record<string, unknown> = { is_vip: grant };
    if (grant) {
        updatePayload.vip_tier = tier;
    } else {
        updatePayload.vip_expires_at = null;
        updatePayload.vip_tier = null;
    }

    const { error } = await adminClient
        .from("profiles")
        .update(updatePayload)
        .eq("id", targetUserId);

    if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    await logAdminAction(adminClient, adminId, grant ? "grant_vip" : "revoke_vip", targetUserId, grant ? { tier } : {});

    return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

}));
