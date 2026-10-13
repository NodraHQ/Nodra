// ==================================================================
// tournament-edit-result
//
// Body: { tournament_id, match_id, a_score, b_score, reason? }
//
// Corrige um resultado JA registrado. Toda correcao entra em
// tournament_edit_log (publico, so de acrescentar). Se a correcao
// muda quem venceu e a fase seguinte ja foi jogada, o motor recusa
// (downstream_played): nao da pra reescrever o passado por cima de
// partidas que dependem dele.
// ==================================================================

import { corsHeaders, withCallerAuth } from "../_shared/tournamentAuth.ts";
import {
    ENGINE_ERROR_STATUS,
    Engine,
    RETENTION_DAYS_FREE,
    RETENTION_DAYS_VIP,
    isTournamentClosed,
    jsonResponse,
    loadTournament,
    persistChanges,
} from "../_shared/tournamentStore.ts";

Deno.serve(withCallerAuth(async (req, { client, userId, isVip }) => {

    if (req.method !== "POST") {
        return jsonResponse({ error: "Use POST" }, 405, corsHeaders);
    }

    const body = await req.json().catch(() => null);
    const tournamentId = body?.tournament_id;
    const matchId = body?.match_id;
    const aScore = body?.a_score;
    const bScore = body?.b_score;
    const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 200) : "";

    if (typeof tournamentId !== "string" || typeof matchId !== "string") {
        return jsonResponse({ error: "tournament_id e match_id são obrigatórios" }, 400, corsHeaders);
    }

    const loaded = await loadTournament(client, tournamentId);
    if (!loaded) return jsonResponse({ error: "Torneio não encontrado" }, 404, corsHeaders);
    if (loaded.tournament.owner_id !== userId) {
        return jsonResponse({ error: "Só quem criou o torneio pode editar resultados" }, 403, corsHeaders);
    }

    // Sala parada ha mais de 30 min fecha sozinha: segue visivel, mas
    // nao aceita mais resultado nem correcao.
    if (isTournamentClosed(loaded.tournament)) {
        return jsonResponse({ error: "tournament_closed" }, 409, corsHeaders);
    }

    // deno-lint-ignore no-explicit-any
    const old = loaded.state.matches.find((m: any) => m.id === matchId);

    // deno-lint-ignore no-explicit-any
    let next: any;
    try {
        next = Engine.editResult(loaded.state, matchId, aScore, bScore);
    } catch (err) {
        const code = (err as Error).message;
        return jsonResponse({ error: code }, ENGINE_ERROR_STATUS[code] ?? 400, corsHeaders);
    }

    // deno-lint-ignore no-explicit-any
    const updated = next.matches.find((m: any) => m.id === matchId);
    const log = [{
        match_id: matchId,
        editor_id: userId,
        old_a_score: old.a_score,
        old_b_score: old.b_score,
        new_a_score: updated.a_score,
        new_b_score: updated.b_score,
        old_winner_id: old.winner_id,
        new_winner_id: updated.winner_id,
        reason: reason || null,
    }];

    const result = await persistChanges(client, tournamentId, loaded.tournament.version, loaded.state, next, log, isVip ? RETENTION_DAYS_VIP : RETENTION_DAYS_FREE);
    if (!result.ok) {
        return result.conflict
            ? jsonResponse({ error: "version_conflict" }, 409, corsHeaders)
            : jsonResponse({ error: "Erro ao salvar a correção" }, 500, corsHeaders);
    }

    return jsonResponse({ success: true, version: result.version }, 200, corsHeaders);

}));
