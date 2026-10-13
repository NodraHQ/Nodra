// ==================================================================
// tournament-create
//
// Body: { name, mode: 'bracket'|'league', participants: string[],
//         config: { losers_mode, final_rematch, double_round, points },
//         shuffle?: boolean, theme_name?: string }
//
// Qualquer sessao pode criar, inclusive convidado (sessao anonima),
// igual aos outros jogos. Diferencas por tipo de conta:
//   - Free (inclui convidado): ate 10 torneios a cada 30 dias (mesmo
//     numero das salas hospedadas), ate 32 participantes, historico
//     guardado 30 dias.
//   - VIP: sem teto mensal, ate o limite do motor (128 na chave) e
//     retencao de 180 dias. O historico na conta e igual pra todos.
// O servidor monta a chave/tabela com o mesmo motor do navegador
// (_shared/tournamentEngine.js): o cliente nunca manda a estrutura.
// ==================================================================

import { corsHeaders, withCallerAuth } from "../_shared/tournamentAuth.ts";
import { Engine, RETENTION_DAYS_FREE, RETENTION_DAYS_VIP, jsonResponse } from "../_shared/tournamentStore.ts";

const FREE_MONTHLY_LIMIT = 10;
const FREE_MAX_PARTICIPANTS = 32;
// Trava de sanidade contra abuso, vale pra todo mundo.
const MAX_LIVE_ROWS_PER_OWNER = 200;

Deno.serve(withCallerAuth(async (req, { client, userId, isVip }) => {

    if (req.method !== "POST") {
        return jsonResponse({ error: "Use POST" }, 405, corsHeaders);
    }

    const body = await req.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim().slice(0, 80) : "";
    const mode = body?.mode;
    const participants = body?.participants;
    // Tema visual: so o NOME fica guardado; quem abre o link resolve o
    // tema pelo nome, como nas salas da Roleta.
    const themeName = typeof body?.theme_name === "string" ? body.theme_name.trim().slice(0, 80) : "";

    if (!name) return jsonResponse({ error: "name é obrigatório" }, 400, corsHeaders);
    if (mode !== "bracket" && mode !== "league") {
        return jsonResponse({ error: "mode precisa ser bracket ou league" }, 400, corsHeaders);
    }
    if (!Array.isArray(participants) || participants.length > 500) {
        return jsonResponse({ error: "participants inválido" }, 400, corsHeaders);
    }
    if (!isVip && participants.length > FREE_MAX_PARTICIPANTS) {
        return jsonResponse({ error: "free_participants_limit" }, 403, corsHeaders);
    }

    const nowMs = Date.now();

    const { count: totalCount, error: totalError } = await client
        .from("tournaments")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", userId)
        .gt("expires_at", new Date(nowMs).toISOString());

    if (totalError) {
        console.error("Erro ao contar torneios:", totalError);
        return jsonResponse({ error: "Erro ao conferir o limite" }, 500, corsHeaders);
    }
    if ((totalCount ?? 0) >= MAX_LIVE_ROWS_PER_OWNER) {
        return jsonResponse({ error: "too_many_tournaments" }, 403, corsHeaders);
    }

    if (!isVip) {
        const since = new Date(nowMs - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { count: monthCount, error: monthError } = await client
            .from("tournaments")
            .select("id", { count: "exact", head: true })
            .eq("owner_id", userId)
            .gt("created_at", since);
        if (monthError) {
            console.error("Erro ao contar torneios do mes:", monthError);
            return jsonResponse({ error: "Erro ao conferir o limite" }, 500, corsHeaders);
        }
        if ((monthCount ?? 0) >= FREE_MONTHLY_LIMIT) {
            return jsonResponse({ error: "free_monthly_limit" }, 403, corsHeaders);
        }
    }

    // deno-lint-ignore no-explicit-any
    let state: any;
    try {
        state = Engine.createTournamentState(mode, participants.map(String), body?.config ?? {}, {
            shuffle: body?.shuffle !== false,
        });
    } catch (err) {
        return jsonResponse({ error: (err as Error).message }, 400, corsHeaders);
    }

    const retentionDays = isVip ? RETENTION_DAYS_VIP : RETENTION_DAYS_FREE;

    const { data: created, error: insertError } = await client
        .from("tournaments")
        .insert({
            owner_id: userId,
            name,
            mode,
            config: themeName ? { ...state.config, theme_name: themeName } : state.config,
            expires_at: new Date(nowMs + retentionDays * 24 * 60 * 60 * 1000).toISOString(),
            last_activity_at: new Date(nowMs).toISOString(),
        })
        .select("id")
        .single();

    if (insertError || !created) {
        console.error("Erro ao criar torneio:", insertError);
        return jsonResponse({ error: "Erro ao criar o torneio" }, 500, corsHeaders);
    }

    const tournamentId = created.id as string;

    const participantRows = state.participants.map((p: { id: string; name: string; seed: number }) => ({
        id: p.id,
        tournament_id: tournamentId,
        name: p.name,
        seed: p.seed,
    }));
    const matchRows = state.matches.map((m: Record<string, unknown>) => ({
        id: m.id,
        tournament_id: tournamentId,
        bracket: m.bracket,
        round_no: m.round_no,
        pos: m.pos,
        a_id: m.a_id,
        b_id: m.b_id,
        a_src: m.a_src,
        b_src: m.b_src,
        a_score: m.a_score,
        b_score: m.b_score,
        winner_id: m.winner_id,
        status: m.status,
        next_match_id: m.next_match_id,
        next_slot: m.next_slot,
        finished_seq: m.finished_seq,
    }));

    const { error: pError } = await client.from("tournament_participants").insert(participantRows);
    const { error: mError } = pError ? { error: null } : await client.from("tournament_matches").insert(matchRows);

    if (pError || mError) {
        console.error("Erro ao gravar estrutura do torneio:", pError ?? mError);
        await client.from("tournaments").delete().eq("id", tournamentId);
        return jsonResponse({ error: "Erro ao criar o torneio" }, 500, corsHeaders);
    }

    return jsonResponse({ success: true, tournamentId }, 200, corsHeaders);

}));
