// ==================================================================
// claim-badge-code
//
// Body: { code }
//
// Precisa estar logado - é a badge de QUEM chama que recebe o
// badge, não dá pra reivindicar em nome de outra conta. Mesmo
// desenho do redeem-vip-code (incremento atômico contra corrida na
// última vaga, desfaz o registro de resgate se o incremento falhar
// depois de já ter gravado).
// ==================================================================

import { corsHeaders } from "../_shared/vipAuth.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

function jsonError(message: string, status: number): Response {
    return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== "POST") {
        return jsonError("Use POST", 405);
    }

    try {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return jsonError("Precisa estar logado pra resgatar", 401);
        }

        const callerClient = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_ANON_KEY")!,
            { global: { headers: { Authorization: authHeader } } },
        );

        const { data: { user }, error: userError } = await callerClient.auth.getUser();
        if (userError || !user) {
            return jsonError("Precisa estar logado pra resgatar", 401);
        }

        const body = await req.json().catch(() => null);
        const rawCode = body?.code;
        if (typeof rawCode !== "string" || !rawCode.trim()) {
            return jsonError("Body precisa de { code: string }", 400);
        }
        const code = rawCode.trim().toUpperCase();

        const serviceClient = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );

        const { data: claimCode, error: codeError } = await serviceClient
            .from("badge_claim_codes")
            .select("id, badge_id, max_uses, uses_count, expires_at, paused")
            .eq("code", code)
            .maybeSingle();

        if (codeError || !claimCode) {
            return jsonError("Código não encontrado", 404);
        }

        if (claimCode.paused) {
            return jsonError("Esse código está pausado no momento", 400);
        }

        if (claimCode.expires_at && new Date(claimCode.expires_at) < new Date()) {
            return jsonError("Esse código expirou", 400);
        }

        if (claimCode.max_uses !== null && claimCode.uses_count >= claimCode.max_uses) {
            return jsonError("Esse código já atingiu o limite de usos", 400);
        }

        const { data: existingRedemption } = await serviceClient
            .from("badge_claim_redemptions")
            .select("id")
            .eq("claim_code_id", claimCode.id)
            .eq("user_id", user.id)
            .maybeSingle();

        if (existingRedemption) {
            return jsonError("Você já resgatou esse código antes", 409);
        }

        const { error: redemptionError } = await serviceClient.from("badge_claim_redemptions").insert({
            claim_code_id: claimCode.id,
            user_id: user.id,
        });

        if (redemptionError) {
            if (redemptionError.code === "23505") {
                return jsonError("Você já resgatou esse código antes", 409);
            }
            console.error("Erro ao registrar resgate de badge:", redemptionError);
            return jsonError("Erro ao resgatar o código", 500);
        }

        // Incremento atômico - mesma trava contra corrida usada no
        // redeem-vip-code (ver increment_badge_claim_code_use).
        const { data: incremented, error: incrementError } = await serviceClient
            .rpc("increment_badge_claim_code_use", { code_id_input: claimCode.id });

        if (incrementError || !incremented) {
            await serviceClient
                .from("badge_claim_redemptions")
                .delete()
                .eq("claim_code_id", claimCode.id)
                .eq("user_id", user.id);

            return jsonError("Esse código acabou de atingir o limite de usos", 409);
        }

        // granted_by não aceita nulo, e aqui não tem um VIP
        // concedendo em tempo real (é a própria pessoa resgatando um
        // código) - mesmo padrão já usado em
        // academy-grant-module-badge: preenche com o id de quem
        // recebe, não com o id de quem criou o código originalmente
        // (esse já fica registrado em badge_claim_codes.created_by).
        const { error: grantError } = await serviceClient.from("user_badges").insert({
            user_id: user.id,
            badge_id: claimCode.badge_id,
            granted_by: user.id,
            note: "Resgatado via QR/código",
        });

        if (grantError && grantError.code !== "23505") {
            console.error("Erro ao conceder badge via código:", grantError);
            return jsonError("Código resgatado, mas erro ao conceder o badge - contate o suporte", 500);
        }

        return new Response(JSON.stringify({ success: true, badgeId: claimCode.badge_id }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err) {
        console.error("Erro inesperado em claim-badge-code:", err);
        return jsonError("Erro interno", 500);
    }
});
