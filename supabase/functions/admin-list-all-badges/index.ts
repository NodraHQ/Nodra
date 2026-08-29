// ==================================================================
// admin-list-all-badges
//
// GET, sem body. Devolve TODO badge já criado (de qualquer VIP, não
// só um), com quem criou e quem tem cada um - reportado ao vivo como
// urgente: "preciso ver as badges criadas e quem possui elas, tipo a
// do menu VIP, mas de todos os usuários pra mim".
// ==================================================================

import { corsHeaders, withAdminAuth } from "../_shared/adminAuth.ts";

Deno.serve(withAdminAuth(async (_req, { adminClient }) => {

    const [badgesResult, holdersResult] = await Promise.all([
        adminClient
            .from("badges")
            .select("id, slug, name_pt, name_en, badge_shape, background_color, image_url, icon, icon_color, icon_size, source, created_by, created_at")
            .order("created_at", { ascending: false }),
        adminClient
            .from("user_badges")
            .select("badge_id, user_id, granted_at"),
    ]);

    if (badgesResult.error || holdersResult.error) {
        console.error("Erro ao carregar badges pro admin:", badgesResult.error || holdersResult.error);
        return new Response(JSON.stringify({ error: "Erro ao carregar dados" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const badges = badgesResult.data || [];
    const holders = holdersResult.data || [];

    const userIds = [...new Set([...badges.map((b) => b.created_by).filter(Boolean), ...holders.map((h) => h.user_id)])];

    const { data: profiles } = await adminClient
        .from("profiles")
        .select("id, username")
        .in("id", userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"]);

    const usernameById = new Map((profiles || []).map((p) => [p.id, p.username]));

    const result = badges.map((badge) => ({
        id: badge.id,
        slug: badge.slug,
        namePt: badge.name_pt,
        nameEn: badge.name_en,
        badgeShape: badge.badge_shape,
        backgroundColor: badge.background_color,
        imageUrl: badge.image_url,
        icon: badge.icon,
        iconColor: badge.icon_color,
        iconSize: badge.icon_size,
        source: badge.source,
        createdBy: usernameById.get(badge.created_by) || badge.created_by,
        createdAt: badge.created_at,
        holders: holders
            .filter((h) => h.badge_id === badge.id)
            .map((h) => usernameById.get(h.user_id) || h.user_id),
    }));

    return new Response(JSON.stringify({ badges: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

}));
