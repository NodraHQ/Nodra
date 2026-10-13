// ==================================================================
// tournament-record-result
//
// Body: { tournament_id, match_id, a_score, b_score }
//
// Qualquer sessao dona do torneio (inclusive convidado).
// Registra o PRIMEIRO resultado de uma partida pronta. Corrigir um
// resultado ja registrado e outra funcao (tournament-edit-result),
// porque correcao deixa rastro no log publico.
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

    if (typeof tournamentId !== "string" || typeof matchId !== "string") {
        return jsonResponse({ error: "tournament_id e match_id são obrigatórios" }, 400, corsHeaders);
    }

    const loaded = await loadTournament(client, tournamentId);
    if (!loaded) return jsonResponse({ error: "Torneio não encontrado" }, 404, corsHeaders);
    if (loaded.tournament.owner_id !== userId) {
        return jsonResponse({ error: "Só quem criou o torneio pode registrar resultados" }, 403, corsHeaders);
    }

    // Sala parada ha mais de 30 min fecha sozinha: segue visivel, mas
    // nao aceita mais resultado nem correcao.
    if (isTournamentClosed(loaded.tournament)) {
        return jsonResponse({ error: "tournament_closed" }, 409, corsHeaders);
    }

    // deno-lint-ignore no-explicit-any
    let next: any;
    try {
        next = Engine.applyResult(loaded.state, matchId, aScore, bScore);
    } catch (err) {
        const code = (err as Error).message;
        return jsonResponse({ error: code }, ENGINE_ERROR_STATUS[code] ?? 400, corsHeaders);
    }

    const result = await persistChanges(client, tournamentId, loaded.tournament.version, loaded.state, next, [], isVip ? RETENTION_DAYS_VIP : RETENTION_DAYS_FREE);
    if (!result.ok) {
        return result.conflict
            ? jsonResponse({ error: "version_conflict" }, 409, corsHeaders)
            : jsonResponse({ error: "Erro ao salvar o resultado" }, 500, corsHeaders);
    }

    return jsonResponse({ success: true, version: result.version }, 200, corsHeaders);

}));
