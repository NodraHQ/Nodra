// ==================================================================
// admin-analytics
//
// Números gerais + engajamento ao longo do tempo. Pra v1, o
// agrupamento por dia é feito em JS depois de buscar as linhas dos
// últimos 30 dias - funciona bem numa base pequena/média. Se a
// plataforma crescer muito, isso deveria virar uma view/função SQL
// de agregação em vez de trazer linha por linha; não fizemos isso
// agora porque seria complexidade sem necessidade real ainda.
//
// badgesMintedOnchain fica fixo em 0 de propósito - o mecanismo de
// badge ONCHAIN (vale assinado + contrato) ainda não existe (ver
// Open Items em LOGIN_WALLET_ARCHITECTURE.md). Diferente de
// badgesGranted (que é real, conta o que o próprio banco já
// concedeu) - reportado ao vivo: "tem badges criadas já e ele não
// conta", os dois números eram tratados como a mesma coisa antes,
// separados agora.
// ==================================================================

import { corsHeaders, withAdminAuth } from "../_shared/adminAuth.ts";

const ROOM_TABLES = ["time_attack_rooms", "showdown_rooms", "tap_rush_rooms", "roulette_rooms"];
const ACADEMY_MODULE_COUNT = 10;

Deno.serve(withAdminAuth(async (_req, { adminClient }) => {

    const count = async (table: string, filters?: (q: any) => any) => {
        let q = adminClient.from(table).select("id", { count: "exact", head: true });
        if (filters) q = filters(q);
        const { count: n, error } = await q;
        if (error) console.error(`admin-analytics: falhou contando ${table}:`, error.message);
        return n ?? 0;
    };

    const [
        totalUsers,
        activeVips,
        activeVipsBronze,
        activeVipsPrata,
        activeVipsGold,
        vipsPurchasedCount,
        vipsPurchasedBronze,
        vipsPurchasedPrata,
        vipsPurchasedGold,
        vipCodesRedeemedCount,
        badgesCreatedCount,
        badgesGrantedCount,
        publicThemesCount,
        privateThemesCount,
        pendingThemesCount,
        privatePacksCount,
        pendingPacksCount,
        approvedPacksCount,
        supportTicketsOpenCount,
        supportTicketsClosedCount,
        matchHistoryCount,
    ] = await Promise.all([
        count("profiles"),
        count("profiles", (q) => q.eq("is_vip", true)),
        count("profiles", (q) => q.eq("is_vip", true).eq("vip_tier", "bronze")),
        count("profiles", (q) => q.eq("is_vip", true).eq("vip_tier", "prata")),
        count("profiles", (q) => q.eq("is_vip", true).eq("vip_tier", "gold")),
        count("vip_payments"),
        count("vip_payments", (q) => q.eq("tier", "bronze")),
        count("vip_payments", (q) => q.eq("tier", "prata")),
        count("vip_payments", (q) => q.eq("tier", "gold")),
        count("vip_invite_redemptions"),
        count("badges"),
        count("user_badges"),
        count("custom_themes", (q) => q.eq("status", "public")),
        count("custom_themes", (q) => q.eq("status", "private")),
        count("custom_themes", (q) => q.eq("status", "pending_review")),
        count("vip_saved_packs"),
        count("vip_saved_packs", (q) => q.eq("submission_status", "pending")),
        count("vip_saved_packs", (q) => q.eq("submission_status", "approved")),
        count("support_tickets", (q) => q.eq("status", "open")),
        count("support_tickets", (q) => q.eq("status", "closed")),
        count("match_history"),
    ]);

    const roomCounts = await Promise.all(
        ROOM_TABLES.map((table) => count(table)),
    );
    const totalRooms = roomCounts.reduce((sum, n) => sum + n, 0);

    // Agregado de jogador em sala ativa, plataforma inteira - mesma
    // function que os jogos chamam antes de deixar alguém entrar.
    // Reportado ao vivo: aviso aos 350 (70% do teto de 500 do
    // Supabase Pro), bloqueia de verdade só aos 420 (nos jogos).
    const { data: activePlayersCount } = await adminClient.rpc("count_active_platform_players");

    // Quantos usuários têm as 10 badges da Academy - conta quantas
    // badges de módulo (academy_module_slug preenchido) cada user_id
    // tem em user_badges, e filtra quem bateu as 10.
    const { data: academyBadgeRows } = await adminClient
        .from("badges")
        .select("id")
        .not("academy_module_slug", "is", null);
    const academyBadgeIds = (academyBadgeRows || []).map((b) => b.id);

    let academyGraduatesCount = 0;
    if (academyBadgeIds.length > 0) {
        const { data: holderRows } = await adminClient
            .from("user_badges")
            .select("user_id, badge_id")
            .in("badge_id", academyBadgeIds);

        const countByUser = new Map<string, number>();
        (holderRows || []).forEach((r) => {
            countByUser.set(r.user_id, (countByUser.get(r.user_id) || 0) + 1);
        });
        academyGraduatesCount = [...countByUser.values()].filter((n) => n >= ACADEMY_MODULE_COUNT).length;
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentSignups } = await adminClient
        .from("profiles")
        .select("created_at")
        .gte("created_at", thirtyDaysAgo);

    const signupsByDay: Record<string, number> = {};
    for (const row of recentSignups ?? []) {
        const day = row.created_at.slice(0, 10);
        signupsByDay[day] = (signupsByDay[day] ?? 0) + 1;
    }

    return new Response(JSON.stringify({
        generatedAt: new Date().toISOString(),
        totalUsers,
        activeVips,
        activeVipsBronze,
        activeVipsPrata,
        activeVipsGold,
        vipsPurchasedCount,
        vipsPurchasedBronze,
        vipsPurchasedPrata,
        vipsPurchasedGold,
        vipCodesRedeemedCount,
        totalRooms,
        activePlayersCount: activePlayersCount || 0,
        matchHistoryCount,
        badgesMintedOnchain: 0,
        badgesCreatedCount,
        badgesGrantedCount,
        academyGraduatesCount,
        publicThemesCount,
        privateThemesCount,
        pendingThemesCount,
        privatePacksCount,
        pendingPacksCount,
        approvedPacksCount,
        supportTicketsOpenCount,
        supportTicketsClosedCount,
        signupsByDay,
    }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

}));
