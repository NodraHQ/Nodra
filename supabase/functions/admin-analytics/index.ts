// ==================================================================
// admin-analytics
//
// Números gerais + engajamento ao longo do tempo. Pra v1, o
// agrupamento por dia é feito em JS depois de buscar as linhas dos
// últimos 30 dias — funciona bem numa base pequena/média. Se a
// plataforma crescer muito, isso deveria virar uma view/função SQL
// de agregação em vez de trazer linha por linha; não fizemos isso
// agora porque seria complexidade sem necessidade real ainda.
//
// badges_minted fica fixo em 0 por enquanto — o mecanismo de badge
// (vale assinado + contrato) ainda não existe (ver Open Items em
// LOGIN_WALLET_ARCHITECTURE.md). Trocar por uma contagem real quando
// essa peça for construída.
// ==================================================================

import { corsHeaders, withAdminAuth } from "../_shared/adminAuth.ts";

const ROOM_TABLES = ["time_attack_rooms", "showdown_rooms", "tap_rush_rooms", "roulette_rooms"];

Deno.serve(withAdminAuth(async (_req, { adminClient }) => {

    const { count: totalUsers } = await adminClient
        .from("profiles")
        .select("id", { count: "exact", head: true });

    const roomCounts = await Promise.all(
        ROOM_TABLES.map((table) =>
            adminClient.from(table).select("id", { count: "exact", head: true })
                .then(({ count, error }: { count: number | null; error: { message: string } | null }) => {
                    if (error) console.error(`admin-analytics: failed counting ${table}:`, error.message);
                    return count ?? 0;
                })
        ),
    );
    const totalRooms = roomCounts.reduce((sum, n) => sum + n, 0);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentSignups } = await adminClient
        .from("profiles")
        .select("created_at")
        .gte("created_at", thirtyDaysAgo);

    const signupsByDay: Record<string, number> = {};
    for (const row of recentSignups ?? []) {
        const day = row.created_at.slice(0, 10); // YYYY-MM-DD
        signupsByDay[day] = (signupsByDay[day] ?? 0) + 1;
    }

    return new Response(JSON.stringify({
        totalUsers: totalUsers ?? 0,
        totalRooms,
        badgesMinted: 0,
        signupsByDay,
    }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

}));
