// ==================================================================
// _shared/tournamentStore.ts
//
// Carrega o estado de um torneio salvo, e grava so o que mudou depois
// que o motor (tournamentEngine.js) rodou. Usado por
// tournament-record-result e tournament-edit-result. A gravacao passa
// pela funcao SQL tournament_apply_changes, que confere a versao e
// aplica tudo numa transacao so (dois cliques ao mesmo tempo nao
// corrompem a chave).
// ==================================================================

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import "./tournamentEngine.js";

// deno-lint-ignore no-explicit-any
export const Engine: any = (globalThis as any).TournamentBracketEngine;

// Sala parada ha mais que isso fecha sozinha (mesma regra dos jogos,
// ROOM_INACTIVITY_TIMEOUT_MINUTES = 30). Fechar nao apaga nada: o
// torneio continua visivel, so deixa de aceitar resultados.
export const INACTIVITY_MINUTES = 30;

// Retencao igual ao historico de partidas: 30 dias, 180 pra VIP.
export const RETENTION_DAYS_FREE = 30;
export const RETENTION_DAYS_VIP = 180;

// deno-lint-ignore no-explicit-any
export function isTournamentClosed(tournament: any, now = Date.now()): boolean {
    if (tournament.status !== "active") return false;
    const last = new Date(tournament.last_activity_at).getTime();
    return now - last > INACTIVITY_MINUTES * 60 * 1000;
}

export const MATCH_COLUMNS =
    "id, bracket, round_no, pos, a_id, b_id, a_src, b_src, a_score, b_score, winner_id, status, next_match_id, next_slot, finished_seq";

// deno-lint-ignore no-explicit-any
export type MatchRow = Record<string, any>;

export interface LoadedTournament {
    // deno-lint-ignore no-explicit-any
    tournament: any;
    // deno-lint-ignore no-explicit-any
    state: any;
}

export async function loadTournament(client: SupabaseClient, tournamentId: string): Promise<LoadedTournament | null> {
    const { data: tournament } = await client.from("tournaments").select("*").eq("id", tournamentId).maybeSingle();
    if (!tournament) return null;

    const { data: participants } = await client
        .from("tournament_participants")
        .select("id, name, seed")
        .eq("tournament_id", tournamentId)
        .order("seed", { ascending: true });

    const { data: matches } = await client
        .from("tournament_matches")
        .select(MATCH_COLUMNS)
        .eq("tournament_id", tournamentId)
        .limit(5000);

    return {
        tournament,
        state: {
            mode: tournament.mode,
            config: tournament.config,
            participants: participants ?? [],
            matches: matches ?? [],
        },
    };
}

function sameMatch(a: MatchRow, b: MatchRow): boolean {
    for (const key of MATCH_COLUMNS.split(", ")) {
        if ((a[key] ?? null) !== (b[key] ?? null)) return false;
    }
    return true;
}

export async function persistChanges(
    client: SupabaseClient,
    tournamentId: string,
    expectedVersion: number,
    // deno-lint-ignore no-explicit-any
    before: any,
    // deno-lint-ignore no-explicit-any
    after: any,
    log: MatchRow[],
    retentionDays: number,
): Promise<{ ok: true; version: number } | { ok: false; conflict: boolean; message: string }> {
    const beforeById = new Map<string, MatchRow>();
    for (const m of before.matches) beforeById.set(m.id, m);
    const afterIds = new Set<string>();
    const upserts: MatchRow[] = [];
    for (const m of after.matches as MatchRow[]) {
        afterIds.add(m.id);
        const old = beforeById.get(m.id);
        if (!old || !sameMatch(old, m)) upserts.push(m);
    }
    const deletes: string[] = [];
    for (const id of beforeById.keys()) if (!afterIds.has(id)) deletes.push(id);

    const summary = Engine.summarize(after);

    const { data, error } = await client.rpc("tournament_apply_changes", {
        p_tournament_id: tournamentId,
        p_expected_version: expectedVersion,
        p_upserts: upserts,
        p_delete_ids: deletes,
        p_status: summary.status,
        p_champion_id: summary.champion_id,
        p_losers_champion_id: summary.losers_champion_id,
        p_log: log,
        p_retention_days: retentionDays,
    });

    if (error) {
        const conflict = (error.message ?? "").includes("version_conflict");
        if (!conflict) console.error("tournament_apply_changes falhou:", error);
        return { ok: false, conflict, message: error.message ?? "erro" };
    }
    return { ok: true, version: data as number };
}

export function jsonResponse(body: unknown, status: number, headers: Record<string, string>): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...headers, "Content-Type": "application/json" },
    });
}

export const ENGINE_ERROR_STATUS: Record<string, number> = {
    match_not_found: 404,
    match_not_ready: 409,
    match_not_done: 409,
    downstream_played: 409,
    invalid_score: 400,
    tie_not_allowed: 400,
    tournament_closed: 409,
};
