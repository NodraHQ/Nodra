// ==================================================================
// showdown-submit-answer
//
// Decide certo/errado E calcula os pontos por velocidade — os dois
// só a Edge Function faz agora, nunca o navegador. O tempo decorrido
// usa question_started_at (que um gatilho no banco trava pro relógio
// do servidor, nunca aceita valor do cliente) contra o relógio do
// próprio servidor no momento da resposta — fecha a pontuação por
// velocidade contra manipulação dos dois lados (nem o horário de
// início nem o horário de resposta vêm do navegador de quem está
// jogando).
// ==================================================================

import { corsHeaders, getServiceClient, getOptionalCallerId } from "../_shared/gameAuth.ts";

function calcPoints(elapsedMs: number, questionSeconds: number): number {
    const elapsedSeconds = elapsedMs / 1000;
    if (elapsedSeconds <= 3) return 1000;
    if (elapsedSeconds >= questionSeconds) return 300;
    const ratio = (elapsedSeconds - 3) / (questionSeconds - 3);
    return Math.round(1000 - ratio * (1000 - 300));
}

Deno.serve(async (req) => {

    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {

        const { room_id, question_id, selected_index, player_id } = await req.json();

        if (!room_id || !question_id || selected_index === undefined || selected_index === null || !player_id) {
            return new Response(JSON.stringify({ error: "Campos obrigatórios faltando" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const client = getServiceClient();
        const callerId = await getOptionalCallerId(req);

        const { data: playerRow, error: playerError } = await client
            .from("showdown_players")
            .select("id, user_id, total_score")
            .eq("id", player_id)
            .maybeSingle();

        if (playerError || !playerRow) {
            return new Response(JSON.stringify({ error: "Jogador não encontrado" }), {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Mesma regra do Time Attack: se a linha tem dono (logada) e
        // quem está chamando é outra conta, recusa.
        if (playerRow.user_id && playerRow.user_id !== callerId) {
            return new Response(JSON.stringify({ error: "Essa linha não pertence a você" }), {
                status: 403,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const { data: room, error: roomError } = await client
            .from("showdown_rooms")
            .select("question_seconds, question_started_at, current_question_index, selected_question_ids")
            .eq("id", room_id)
            .maybeSingle();

        if (roomError || !room) {
            return new Response(JSON.stringify({ error: "Sala não encontrada" }), {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Confere que a pergunta respondida É a atual da sala — evita
        // responder uma pergunta "velha" depois da sala já ter
        // avançado (ex: resposta atrasada chegando fora de hora).
        const expectedQuestionId = room.selected_question_ids?.[room.current_question_index];
        if (expectedQuestionId !== question_id) {
            return new Response(JSON.stringify({ error: "Essa pergunta não é mais a atual da sala" }), {
                status: 409,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const { data: question, error: qError } = await client
            .from("questions")
            .select("correct_index")
            .eq("id", question_id)
            .maybeSingle();

        if (qError || !question) {
            return new Response(JSON.stringify({ error: "Pergunta não encontrada" }), {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const isCorrect = Number(selected_index) === question.correct_index;

        const startedAt = new Date(room.question_started_at).getTime();
        const elapsedMs = Date.now() - startedAt;
        const points = isCorrect ? calcPoints(elapsedMs, room.question_seconds) : 0;

        const { error: answerError } = await client
            .from("showdown_answers")
            .insert({
                room_id,
                player_id,
                question_index: room.current_question_index,
                is_correct: isCorrect,
                points_earned: points,
            });

        if (answerError) console.error("showdown-submit-answer: erro ao gravar resposta", answerError);

        const newScore = (playerRow.total_score || 0) + points;

        const { error: updateError } = await client
            .from("showdown_players")
            .update({ total_score: newScore })
            .eq("id", player_id);

        if (updateError) console.error("showdown-submit-answer: erro ao atualizar placar", updateError);

        return new Response(JSON.stringify({
            correct: isCorrect,
            points,
            correct_index: question.correct_index,
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err) {
        console.error("showdown-submit-answer error:", err);
        return new Response(JSON.stringify({ error: "Internal error" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

});
