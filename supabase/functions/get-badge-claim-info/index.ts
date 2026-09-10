// ==================================================================
// get-badge-claim-info
//
// GET ?code=XXXX-XXXX (ou POST { code }) - pública, sem login. Só
// MOSTRA qual badge um código representa e se ainda é válido, não
// concede nada - existe pra dar uma tela de prévia decente pra quem
// abre o link antes mesmo de logar (ver account/claim.html).
// Reportado ao vivo: "o usuário deveria ter uma tela clara... só com
// o qr e a imagem da badge e a descrição".
// ==================================================================

import { corsHeaders } from "../_shared/vipAuth.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        let code: string | null = null;

        if (req.method === "GET") {
            code = new URL(req.url).searchParams.get("code");
        } else if (req.method === "POST") {
            const body = await req.json().catch(() => null);
            code = body?.code;
        }

        if (!code || typeof code !== "string") {
            return new Response(JSON.stringify({ error: "code é obrigatório" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const serviceClient = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );

        const { data: claimCode, error: codeError } = await serviceClient
            .from("badge_claim_codes")
            .select("badge_id, max_uses, uses_count, expires_at, paused")
            .eq("code", code.trim().toUpperCase())
            .maybeSingle();

        if (codeError || !claimCode) {
            return new Response(JSON.stringify({ error: "Código não encontrado" }), {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const { data: badge, error: badgeError } = await serviceClient
            .from("badges")
            .select("name_pt, name_en, description_pt, description_en, badge_shape, background_color, image_url, icon, icon_color, icon_size")
            .eq("id", claimCode.badge_id)
            .maybeSingle();

        if (badgeError || !badge) {
            return new Response(JSON.stringify({ error: "Badge não encontrado" }), {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        let valid = true;
        let reason: string | null = null;

        if (claimCode.paused) {
            valid = false;
            reason = "paused";
        } else if (claimCode.expires_at && new Date(claimCode.expires_at) < new Date()) {
            valid = false;
            reason = "expired";
        } else if (claimCode.max_uses !== null && claimCode.uses_count >= claimCode.max_uses) {
            valid = false;
            reason = "exhausted";
        }

        return new Response(JSON.stringify({ badge, valid, reason }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err) {
        console.error("Erro inesperado em get-badge-claim-info:", err);
        return new Response(JSON.stringify({ error: "Erro interno" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
