// ==================================================================
// tournament-touch
//
// Body: { tournament_id }
//
// Batimento de atividade do organizador: a pagina chama isso (no
// maximo a cada 5 min) quando a pessoa mexe nela. Mantem a sala
// aberta. Se a sala ja passou de 30 min parada, NAO reabre: fechou,
// fechou (mesma regra dos jogos).
// ==================================================================

import { corsHeaders, withCallerAuth } from "../_shared/tournamentAuth.ts";
import { isTournamentClosed, jsonResponse } from "../_shared/tournamentStore.ts";

Deno.serve(withCallerAuth(async (req, { client, userId }) => {

    if (req.method !== "POST") {
        return jsonResponse({ error: "Use POST" }, 405, corsHeaders);
    }

    const body = await req.json().catch(() => null);
    const tournamentId = body?.tournament_id;
    if (typeof tournamentId !== "string") {
        return jsonResponse({ error: "tournament_id é obrigatório" }, 400, corsHeaders);
    }

    const { data: tournament } = await client
        .from("tournaments")
        .select("id, owner_id, status, last_activity_at")
        .eq("id", tournamentId)
        .maybeSingle();

    if (!tournament) return jsonResponse({ error: "Torneio não encontrado" }, 404, corsHeaders);
    if (tournament.owner_id !== userId) return jsonResponse({ error: "Só quem criou pode manter aberto" }, 403, corsHeaders);
    if (tournament.status !== "active") return jsonResponse({ success: true, closed: false }, 200, corsHeaders);
    if (isTournamentClosed(tournament)) return jsonResponse({ error: "tournament_closed" }, 409, corsHeaders);

    const { error } = await client
        .from("tournaments")
        .update({ last_activity_at: new Date().toISOString() })
        .eq("id", tournamentId);

    if (error) {
        console.error("Erro ao registrar atividade:", error);
        return jsonResponse({ error: "Erro ao registrar atividade" }, 500, corsHeaders);
    }
    return jsonResponse({ success: true }, 200, corsHeaders);

}));
