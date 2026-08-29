// ==================================================================
// admin-list-rooms
//
// Une as tabelas de sala dos 4 jogos que têm sala no Supabase (Time
// Attack, Show Down, Tap Rush, Roulette). Quest Drop não entra aqui —
// ele não usa sala em tempo real no Supabase, é local por design (ver
// NDQUEST_ARCHITECTURE.md).
//
// Cada tabela tem colunas próprias além de um núcleo comum
// (room_code, host_name, status, created_at) — a função normaliza
// isso num formato só antes de devolver.
// ==================================================================

import { corsHeaders, withAdminAuth } from "../_shared/adminAuth.ts";

const GAME_TABLES = [
    { game: "time_attack", table: "time_attack_rooms" },
    { game: "show_down", table: "showdown_rooms" },
    { game: "tap_rush", table: "tap_rush_rooms" },
    { game: "roulette", table: "roulette_rooms" },
];

Deno.serve(withAdminAuth(async (_req, { adminClient }) => {

    const results = await Promise.all(
        GAME_TABLES.map(async ({ game, table }) => {
            const { data, error } = await adminClient
                .from(table)
                .select("id, room_code, host_name, status, created_at")
                .order("created_at", { ascending: false })
                .limit(100);

            if (error) {
                console.error(`admin-list-rooms: failed reading ${table}:`, error.message);
                return [];
            }

            return (data ?? []).map((room: Record<string, unknown>) => ({ ...room, game }));
        }),
    );

    const rooms = results
        .flat()
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return new Response(JSON.stringify({ rooms }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

}));
