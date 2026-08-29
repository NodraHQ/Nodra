// ==================================================================
// redeem-vip-code
//
// Body: { code: string }
//
// Qualquer pessoa logada pode tentar resgatar - a validação real
// (código existe, não expirou, ainda tem uso sobrando, essa pessoa
// não usou esse código antes) acontece toda aqui dentro. Mesma
// lógica de estender vip_expires_at usada em verify-vip-payment
// (soma a partir de agora, ou do vencimento atual se ainda não
// venceu - resgatar adiantado não perde tempo).
// ==================================================================

import { corsHeaders } from "../_shared/vipAuth.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Use POST" }), {
            status: 405,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    try {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return jsonError("Not signed in", 401);
        }

        const callerClient = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_ANON_KEY")!,
            { global: { headers: { Authorization: authHeader } } },
        );

        const {
            data: { user },
            error: userError,
        } = await callerClient.auth.getUser();

        if (userError || !user) {
            return jsonError("Not signed in", 401);
        }

        const body = await req.json().catch(() => null);
        const rawCode = body?.code;

        if (typeof rawCode !== "string" || !rawCode.trim()) {
            return jsonError("Body precisa de { code: string }", 400);
        }

        // Normaliza - maiúsculo, sem espaço nas pontas. As pessoas
        // vão copiar/colar de qualquer jeito (Discord, Telegram),
        // não custa ser tolerante com isso.
        const code = rawCode.trim().toUpperCase();

        const serviceClient = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );

        const { data: inviteCode, error: codeError } = await serviceClient
            .from("vip_invite_codes")
            .select("id, max_uses, uses_count, vip_days, expires_at, paused")
            .eq("code", code)
            .maybeSingle();

        if (codeError || !inviteCode) {
            return jsonError("Código não encontrado", 404);
        }

        if (inviteCode.expires_at && new Date(inviteCode.expires_at) < new Date()) {
            return jsonError("Esse código expirou", 400);
        }

        if (inviteCode.paused) {
            return jsonError("Esse código está pausado no momento", 400);
        }

        if (inviteCode.uses_count >= inviteCode.max_uses) {
            return jsonError("Esse código já atingiu o limite de usos", 400);
        }

        const { data: existingRedemption } = await serviceClient
            .from("vip_invite_redemptions")
            .select("id")
            .eq("code_id", inviteCode.id)
            .eq("user_id", user.id)
            .maybeSingle();

        if (existingRedemption) {
            return jsonError("Você já resgatou esse código antes", 409);
        }

        const { error: redemptionError } = await serviceClient.from("vip_invite_redemptions").insert({
            code_id: inviteCode.id,
            user_id: user.id,
        });

        if (redemptionError) {
            console.error("Erro ao registrar resgate de código:", redemptionError);
            return jsonError("Erro ao resgatar o código", 500);
        }

        await serviceClient
            .from("vip_invite_codes")
            .update({ uses_count: inviteCode.uses_count + 1 })
            .eq("id", inviteCode.id);

        const { data: profile } = await serviceClient
            .from("profiles")
            .select("vip_expires_at")
            .eq("id", user.id)
            .maybeSingle();

        const currentExpiry = profile?.vip_expires_at ? new Date(profile.vip_expires_at) : null;
        const baseDate = currentExpiry && currentExpiry > new Date() ? currentExpiry : new Date();
        const newExpiry = new Date(baseDate.getTime() + inviteCode.vip_days * 24 * 60 * 60 * 1000);

        const { error: updateError } = await serviceClient
            .from("profiles")
            .update({ is_vip: true, vip_expires_at: newExpiry.toISOString() })
            .eq("id", user.id);

        if (updateError) {
            console.error("Erro ao ativar VIP pelo código:", updateError);
            return jsonError("Código resgatado, mas erro ao ativar o VIP - contate o suporte", 500);
        }

        return new Response(
            JSON.stringify({ success: true, vipExpiresAt: newExpiry.toISOString() }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    } catch (err) {
        console.error("Erro inesperado ao resgatar código de VIP:", err);
        return jsonError("Erro interno", 500);
    }
});

function jsonError(message: string, status: number): Response {
    return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}
