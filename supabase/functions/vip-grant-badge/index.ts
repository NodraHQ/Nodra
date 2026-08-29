// ==================================================================
// vip-grant-badge
//
// Body: { targetUserIds: string[], badgeSlugs: string[], note?: string }
// (também aceita string única em cada campo, por compatibilidade -
// normaliza pra array internamente)
//
// Path 2 do sistema de badge (ver docs/BADGE_INTEGRITY_ARCHITECTURE.md)
// - pra coisas que nenhum sistema automatizado consegue verificar por
// natureza (presença num evento, participação numa comunidade). Não
// precisa de Mecanismo A nem B - é controle de acesso puro, mesmo
// desenho do admin-grant-vip: só quem tem permissão pode chamar,
// mira usuários específicos, e fica registrado. Grava no
// user_badges e no vip_audit_log na mesma chamada - nunca separado,
// pra nunca existir uma concessão sem registro.
//
// Reportado ao vivo: dar vários badges pra várias pessoas de uma vez
// - agora faz o produto cartesiano (cada badge x cada pessoa) numa
// chamada só, em vez de precisar de uma chamada por combinação. Uma
// combinação que já existe (pessoa já tem aquele badge) é contada
// como "pulada", não trava o resto do lote.
// ==================================================================

import { corsHeaders, withVipAuth, logVipAction } from "../_shared/vipAuth.ts";

function toArray(value: unknown): string[] {
    if (Array.isArray(value)) return value.filter((v) => typeof v === "string");
    if (typeof value === "string") return [value];
    return [];
}

Deno.serve(withVipAuth(async (req, { vipClient, vipId }) => {

    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Use POST" }), {
            status: 405,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const body = await req.json().catch(() => null);
    const targetUserIds = toArray(body?.targetUserIds);
    const badgeSlugs = toArray(body?.badgeSlugs);
    const note = typeof body?.note === "string" ? body.note : null;

    if (targetUserIds.length === 0 || badgeSlugs.length === 0) {
        return new Response(
            JSON.stringify({ error: "Body precisa de { targetUserIds: string[], badgeSlugs: string[] }, ambos não vazios" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    const { data: badgesRaw, error: badgeError } = await vipClient
        .from("badges")
        .select("id, slug, created_by")
        .in("slug", badgeSlugs);

    if (badgeError) {
        return new Response(JSON.stringify({ error: "Erro ao buscar badges" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    // Só pode conceder badge que ESSE VIP criou - reportado ao vivo:
    // badge de um VIP aparecia disponível pra outro VIP conceder.
    // Trata "não é meu" igual a "não encontrado" na resposta, mesma
    // categoria já existente, sem inventar um terceiro tipo de erro.
    const badges = (badgesRaw || []).filter((b) => b.created_by === vipId);

    const foundSlugs = new Set(badges.map((b) => b.slug));
    const notFoundBadgeSlugs = badgeSlugs.filter((s) => !foundSlugs.has(s));

    if (badges.length === 0) {
        return new Response(JSON.stringify({ error: "Nenhum badge encontrado" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const { data: targetProfiles } = await vipClient
        .from("profiles")
        .select("id")
        .in("id", targetUserIds);

    const foundUserIds = new Set((targetProfiles || []).map((p) => p.id));
    const notFoundUserIds = targetUserIds.filter((id) => !foundUserIds.has(id));

    if (!targetProfiles || targetProfiles.length === 0) {
        return new Response(JSON.stringify({ error: "Nenhum usuário encontrado" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    // Produto cartesiano - cada badge válido x cada usuário válido.
    const rows: Array<{ user_id: string; badge_id: string; granted_by: string; note: string | null }> = [];
    for (const userId of targetProfiles.map((p) => p.id)) {
        for (const badge of badges) {
            rows.push({ user_id: userId, badge_id: badge.id, granted_by: vipId, note });
        }
    }

    // Insere um por um em vez de um insert em lote só - assim uma
    // combinação já existente (23505, pessoa já tem aquele badge) só
    // pula essa linha específica, sem travar o resto do lote inteiro
    // (um insert em lote só falharia tudo de uma vez no primeiro
    // conflito).
    let granted = 0;
    let skipped = 0;

    for (const row of rows) {
        const { error } = await vipClient.from("user_badges").insert(row);
        if (error) {
            if (error.code === "23505") {
                skipped++;
            } else {
                console.error("Erro ao conceder badge (linha do lote):", error);
            }
        } else {
            granted++;
        }
    }

    await logVipAction(vipClient, vipId, "grant_badge_batch", null, {
        badgeSlugs,
        targetUserIds,
        granted,
        skipped,
        note,
    });

    return new Response(
        JSON.stringify({
            success: true,
            granted,
            skipped,
            notFoundBadgeSlugs,
            notFoundUserIds,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

}));
