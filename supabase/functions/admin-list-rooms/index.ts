// ==================================================================
// admin-list-rooms
//
// Une as tabelas de sala dos 4 jogos que têm sala no Supabase (Time
// Attack, Show Down, Tap Rush, Roulette) mais os torneios do NDQuest. Quest Drop não entra aqui —
// ele não usa sala em tempo real no Supabase, é local por design (ver
// NDQUEST_ARCHITECTURE.md).
//
// Cada tabela tem colunas próprias além de um núcleo comum
// (room_code, host_name, status, created_at) — a função normaliza
// isso num formato só antes de devolver.
// ==================================================================

import { corsHeaders, withAdminAuth } from "../_shared/adminAuth.ts";

const GAME_TABLES = [
    { game: "time_attack", table: "time_attack_rooms", playersTable: "time_attack_players" },
    { game: "show_down", table: "showdown_rooms", playersTable: "showdown_players" },
    { game: "tap_rush", table: "tap_rush_rooms", playersTable: "tap_rush_players" },
    { game: "roulette", table: "roulette_rooms", playersTable: "roulette_players" },
];

const TOURNAMENT_INACTIVITY_MS = 30 * 60 * 1000;

// deno-lint-ignore no-explicit-any
async function listTournamentRooms(adminClient: any) {
    const { data, error } = await adminClient
        .from("tournaments")
        .select("id, name, owner_id, status, last_activity_at, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
    if (error) {
        console.error("admin-list-rooms: failed reading tournaments:", error.message);
        return [];
    }
    const rows = data ?? [];
    if (rows.length === 0) return [];

    const ids = rows.map((r: Record<string, unknown>) => r.id);
    const ownerIds = [...new Set(rows.map((r: Record<string, unknown>) => r.owner_id))];

    const [participantsRes, profilesRes] = await Promise.all([
        adminClient.from("tournament_participants").select("tournament_id, name").in("tournament_id", ids),
        adminClient.from("profiles").select("id, username").in("id", ownerIds),
    ]);

    const playersByTournament = new Map<string, string[]>();
    (participantsRes.data ?? []).forEach((p: Record<string, unknown>) => {
        const key = p.tournament_id as string;
        if (!playersByTournament.has(key)) playersByTournament.set(key, []);
        playersByTournament.get(key)!.push(p.name as string);
    });
    const usernameById = new Map<string, string>();
    (profilesRes.data ?? []).forEach((p: Record<string, unknown>) => {
        usernameById.set(p.id as string, p.username as string);
    });

    const now = Date.now();
    return rows.map((t: Record<string, unknown>) => {
        const idle = now - new Date(t.last_activity_at as string).getTime() > TOURNAMENT_INACTIVITY_MS;
        const closed = t.status !== "active" || idle;
        return {
            id: t.id,
            game: "tournament",
            room_code: t.name,
            host_name: usernameById.get(t.owner_id as string) || "Guest",
            status: closed ? "closed" : "open",
            created_at: t.created_at,
            players: playersByTournament.get(t.id as string) || [],
        };
    });
}

Deno.serve(withAdminAuth(async (_req, { adminClient }) => {

    const results = await Promise.all(
        GAME_TABLES.map(async ({ game, table, playersTable }) => {
            const { data, error } = await adminClient
                .from(table)
                .select("id, room_code, host_name, status, created_at")
                .order("created_at", { ascending: false })
                .limit(100);

            if (error) {
                console.error(`admin-list-rooms: failed reading ${table}:`, error.message);
                return [];
            }

            const rooms = data ?? [];

            // Nome de jogador junto - reportado ao vivo: "poder
            // pesquisar o nome de player" na tela de Live Rooms.
            // Busca todos de uma vez (1 consulta por jogo, não 1 por
            // sala) e agrupa em memória, evitando N+1.
            const roomIds = rooms.map((r: Record<string, unknown>) => r.id);
            let playersByRoom = new Map<string, string[]>();
            if (roomIds.length > 0) {
                const { data: players, error: playersError } = await adminClient
                    .from(playersTable)
                    .select("room_id, nickname")
                    .in("room_id", roomIds);

                if (playersError) {
                    console.error(`admin-list-rooms: failed reading ${playersTable}:`, playersError.message);
                } else {
                    (players ?? []).forEach((p: Record<string, unknown>) => {
                        const key = p.room_id as string;
                        if (!playersByRoom.has(key)) playersByRoom.set(key, []);
                        playersByRoom.get(key)!.push(p.nickname as string);
                    });
                }
            }

            return rooms.map((room: Record<string, unknown>) => ({
                ...room,
                game,
                players: playersByRoom.get(room.id as string) || [],
            }));
        }),
    );

    // Torneios (NDQuest): normalizados no mesmo formato das salas. Nao tem
    // codigo de sala, entao o nome do torneio ocupa essa coluna. "closed"
    // = encerrado ou sem atividade por 30 min (mesma regra do jogo).
    const tournamentRooms = await listTournamentRooms(adminClient);

    const rooms = [...results.flat(), ...tournamentRooms]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return new Response(JSON.stringify({ rooms }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

}));
