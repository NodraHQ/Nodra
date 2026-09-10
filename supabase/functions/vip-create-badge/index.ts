// ==================================================================
// vip-create-badge
//
// Body: { slug, namePt, nameEn, descriptionPt, descriptionEn,
//         badgeShape, backgroundColor, imageUrl, icon, iconColor,
//         iconSize }
//
// Cria o badge (moveu de insert direto do cliente pra cá) - sem
// isso, o limite de 30 por ciclo era só decorativo, dava pra
// contornar chamando a API do Supabase direto. A imagem em si
// continua subindo do navegador pro Storage (isso já usa o próprio
// login da pessoa via RLS do bucket) - só o INSERT na tabela badges
// que precisa passar por aqui agora, pra contar e travar o limite.
//
// Reportado ao vivo: "30 por VIP, pagou um novo VIP libera 30, sem
// ser acumulativo" - mesmo desenho já usado pra tema (1 por ciclo):
// o badge é carimbado com o vip_expires_at vigente na hora da
// criação (created_for_vip_expiry). Quando o VIP renova de verdade
// (vip_expires_at muda pra um valor novo), os carimbos antigos não
// batem mais com o valor atual, e a contagem desse ciclo volta a
// zero sozinha - não precisa de job de reset nem de zerar nada à
// mão.
// ==================================================================

import { corsHeaders, withVipAuth, logVipAction } from "../_shared/vipAuth.ts";

const BADGE_LIMITS_BY_TIER: Record<string, number> = {
    bronze: 10,
    prata: 20,
    gold: 30,
};

Deno.serve(withVipAuth(async (req, { vipClient, vipId }) => {

    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Use POST" }), {
            status: 405,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
        return new Response(JSON.stringify({ error: "Corpo inválido" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const {
        slug, namePt, nameEn, descriptionPt, descriptionEn,
        badgeShape, backgroundColor, imageUrl, icon, iconColor, iconSize,
    } = body;

    if (typeof slug !== "string" || typeof namePt !== "string" || !namePt.trim()) {
        return new Response(JSON.stringify({ error: "slug e namePt são obrigatórios" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    // vip_expires_at vigente AGORA - lido de novo aqui (não confia
    // em nada que o cliente possa ter mandado sobre isso), é ele que
    // define o ciclo atual.
    const { data: profile } = await vipClient
        .from("profiles")
        .select("vip_expires_at, vip_tier")
        .eq("id", vipId)
        .maybeSingle();

    const currentExpiry = profile?.vip_expires_at ?? null;
    const maxBadgesThisCycle = BADGE_LIMITS_BY_TIER[profile?.vip_tier ?? ""] ?? BADGE_LIMITS_BY_TIER.bronze;

    const { count, error: countError } = await vipClient
        .from("badges")
        .select("id", { count: "exact", head: true })
        .eq("created_by", vipId)
        .eq("created_for_vip_expiry", currentExpiry);

    if (countError) {
        console.error("Erro ao contar badges do ciclo atual:", countError);
        return new Response(JSON.stringify({ error: "Erro ao conferir o limite" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    if ((count ?? 0) >= maxBadgesThisCycle) {
        return new Response(
            JSON.stringify({ error: `Limite de ${maxBadgesThisCycle} badges nesse ciclo de VIP atingido. Renove ou faça upgrade de tier pra liberar mais.` }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    const insertPayload: Record<string, unknown> = {
        slug,
        name_pt: namePt,
        name_en: nameEn ?? namePt,
        description_pt: descriptionPt || null,
        description_en: descriptionEn || null,
        badge_shape: badgeShape,
        background_color: backgroundColor,
        image_url: imageUrl || null,
        icon: imageUrl ? null : icon,
        icon_color: imageUrl ? null : (icon ? iconColor : null),
        created_by: vipId,
        created_for_vip_expiry: currentExpiry,
        source: "community",
    };

    // icon_size não aceita null no banco (coluna NOT NULL) - erro
    // real visto ao vivo: "null value in column icon_size violates
    // not-null constraint". A chave só entra no objeto quando tem
    // ícone de verdade; do contrário fica de fora, e o banco aplica
    // o próprio valor padrão da coluna sozinho.
    if (!imageUrl && icon) {
        insertPayload.icon_size = iconSize;
    }

    const { data: created, error: insertError } = await vipClient
        .from("badges")
        .insert(insertPayload)
        .select("id, slug")
        .single();

    if (insertError) {
        console.error("Erro ao criar badge:", insertError);
        return new Response(JSON.stringify({ error: "Erro ao criar o badge" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    await logVipAction(vipClient, vipId, "create_badge", null, { slug, badgeId: created.id });

    return new Response(
        JSON.stringify({ success: true, badge: created, remaining: maxBadgesThisCycle - (count ?? 0) - 1 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

}));
