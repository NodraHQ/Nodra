// ==================================================================
// vip-create-badge-claim-code
//
// Body: { badgeId, maxUses?, expiresAt? }
//
// Cria um código de resgate pra um badge que ESSE VIP criou (mesma
// regra de posse do vip-grant-badge - só pode gerar QR pros próprios
// badges). Limite de usos e validade são opcionais, o VIP escolhe -
// reportado ao vivo: "opcional, gera infinito ou com limite a gosto
// do usuário, limite de tempo ou de uso ou os dois". Sem os dois,
// o código nunca expira e nunca esgota sozinho - só pausa/apaga na
// mão (ver vip-manage-badge-claim-code).
// ==================================================================

import { corsHeaders, withVipAuth, logVipAction } from "../_shared/vipAuth.ts";

function generateClaimCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem O/0/I/1
    const randomBlock = () =>
        Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    return `${randomBlock()}-${randomBlock()}`;
}

Deno.serve(withVipAuth(async (req, { vipClient, vipId }) => {

    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Use POST" }), {
            status: 405,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const body = await req.json().catch(() => null);
    const badgeId = body?.badgeId;
    const maxUses = body?.maxUses ? Number(body.maxUses) : null;
    const expiresAt = body?.expiresAt || null;

    if (typeof badgeId !== "string") {
        return new Response(JSON.stringify({ error: "badgeId é obrigatório" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1)) {
        return new Response(JSON.stringify({ error: "maxUses precisa ser um número inteiro maior que zero" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const { data: badge, error: badgeError } = await vipClient
        .from("badges")
        .select("id, created_by")
        .eq("id", badgeId)
        .maybeSingle();

    if (badgeError || !badge || badge.created_by !== vipId) {
        return new Response(JSON.stringify({ error: "Badge não encontrado" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    let code = generateClaimCode();
    let attempts = 0;
    // Colisão é extremamente improvável (33^8 combinações), mas
    // tenta de novo em vez de falhar direto se acontecer.
    while (attempts < 5) {
        const { data: existing } = await vipClient
            .from("badge_claim_codes")
            .select("id")
            .eq("code", code)
            .maybeSingle();
        if (!existing) break;
        code = generateClaimCode();
        attempts++;
    }

    const { data: created, error: insertError } = await vipClient
        .from("badge_claim_codes")
        .insert({
            badge_id: badgeId,
            created_by: vipId,
            code,
            max_uses: maxUses,
            expires_at: expiresAt,
        })
        .select("id, code, max_uses, expires_at, uses_count, paused, created_at")
        .single();

    if (insertError) {
        console.error("Erro ao criar código de resgate de badge:", insertError);
        return new Response(JSON.stringify({ error: "Erro ao criar o código" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    await logVipAction(vipClient, vipId, "create_badge_claim_code", null, { badgeId, code });

    return new Response(JSON.stringify({ success: true, claimCode: created }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

}));
