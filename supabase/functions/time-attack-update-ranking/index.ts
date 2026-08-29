// ==================================================================
// time-attack-update-ranking
//
// Recalcula a posição de cada jogador que já terminou numa sala,
// comparando os acertos de todo mundo. Chamada automaticamente pelo
// PRÓPRIO jogador assim que ele termina (endGame, play.js) — sem
// depender do host clicar em "Encerrar sala" ou qualquer outra ação.
// Reportado ao vivo: "não dá pra esperar que o host vá clicar nisso,
// ele vendo o ranking só mete o pé". Idempotente — rodar de novo com
// os mesmos dados só recalcula a mesma coisa, seguro chamar toda vez.
// Usa chave de serviço, então nem precisa da política de RLS
// específica de host pra isso funcionar (essa function já ignora
// RLS por natureza).
//
// round_number escopa ONDE grava — reportado ao vivo: se a mesma
// sala tem várias rodadas (replay controlado pelo host), cada uma
// precisa da própria linha de histórico, não uma só sendo
// sobrescrita/misturada. O CÁLCULO em si (quem tem mais acertos)
// continua olhando o estado atual de time_attack_players sem
// filtrar por rodada — isso é seguro porque o host reseta todo mundo
// junto ao liberar uma rodada nova, então o estado atual da tabela
// sempre reflete só a rodada corrente, nunca uma mistura.
// ==================================================================

import { corsHeaders, getServiceClient } from "../_shared/gameAuth.ts";

Deno.serve(async (req) => {

    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {

        const { room_id, room_code, round_number } = await req.json();

        if (!room_id || !room_code || round_number === undefined || round_number === null) {
            return new Response(JSON.stringify({ error: "room_id, room_code e round_number são obrigatórios" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const client = getServiceClient();

        const { data: players, error } = await client
            .from("time_attack_players")
            .select("user_id, nickname, correct_answers")
            .eq("room_id", room_id)
            .not("finished_at", "is", null);

        if (error) {
            console.error("time-attack-update-ranking query error:", error);
            return new Response(JSON.stringify({ error: "Erro ao buscar jogadores" }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        if (!players || players.length === 0) {
            return new Response(JSON.stringify({ success: true, total: 0 }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const sorted = [...players].sort((a, b) => (b.correct_answers || 0) - (a.correct_answers || 0));

        for (let i = 0; i < sorted.length; i++) {

            const placement = i + 1;
            const player = sorted[i];

            if (player.user_id) {
                const { error: historyError } = await client
                    .from("match_history")
                    .update({ placement })
                    .eq("user_id", player.user_id)
                    .eq("game", "time_attack")
                    .eq("room_code", room_code)
                    .eq("role", "player")
                    .eq("round_number", round_number);

                if (historyError) console.error("time-attack-update-ranking: erro ao gravar posição (logado)", historyError);
            } else {
                const { error: guestError } = await client
                    .from("guest_participants")
                    .update({ placement })
                    .eq("nickname", player.nickname)
                    .eq("game", "time_attack")
                    .eq("room_code", room_code)
                    .eq("round_number", round_number);

                if (guestError) console.error("time-attack-update-ranking: erro ao gravar posição (guest)", guestError);
            }

        }

        return new Response(JSON.stringify({ success: true, total: sorted.length }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err) {
        console.error("time-attack-update-ranking error:", err);
        return new Response(JSON.stringify({ error: "Internal error" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

});
