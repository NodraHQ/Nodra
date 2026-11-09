// ==================================================================
// showdown-submit-answer
//
// Body: { room_id, player_id, selected_index, question_id?, question_index? }
//
// Decide certo/errado E calcula os pontos por velocidade — os dois
// só a Edge Function faz agora, nunca o navegador. O tempo decorrido
// usa question_started_at (que um gatilho no banco trava pro relógio
// do servidor, nunca aceita valor do cliente) contra o relógio do
// próprio servidor no momento da resposta — fecha a pontuação por
// velocidade contra manipulação dos dois lados (nem o horário de
// início nem o horário de resposta vêm do navegador de quem está
// jogando).
//
// Serve os DOIS modos:
// - Pacote oficial: manda question_id, o gabarito vem de `questions`.
// - Custom/salvo: manda question_index, o gabarito vem de
//   showdown_rooms.questions[index].correct. Antes o modo custom
//   decidia certo/errado e gravava total_score direto do navegador -
//   qualquer um conseguia se dar a pontuação que quisesse pelo
//   console. Hoje o banco ignora qualquer mudança de total_score que
//   não venha da chave de serviço (gatilho protect_showdown_score),
//   então TODA pontuação passa por aqui.
//
// Checagem de segurança (auditoria de 11/2026):
// - Uma resposta por pergunta: o índice único (player_id,
//   question_index) em showdown_answers barra a segunda. Antes o erro
//   desse insert era só logado e o placar somava de novo mesmo assim
//   - reenviar a mesma resposta dava pontos infinitos. Agora, se o
//   insert falha, a função para antes de mexer no placar.
// - Só aceita resposta com a pergunta aberta (status "question") -
//   impede esperar o gabarito aparecer na tela de resultado e só
//   então responder.
// - O jogador precisa ser daquela sala.
// ==================================================================

import { corsHeaders, getServiceClient, getOptionalCallerId } from "../_shared/gameAuth.ts";

function calcPoints(elapsedMs: number, questionSeconds: number): number {
    const elapsedSeconds = elapsedMs / 1000;
    if (elapsedSeconds <= 3) return 1000;
    if (elapsedSeconds >= questionSeconds) return 300;
    const ratio = (elapsedSeconds - 3) / (questionSeconds - 3);
    return Math.round(1000 - ratio * (1000 - 300));
}

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}

Deno.serve(async (req) => {

    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {

        const { room_id, question_id, question_index, selected_index, player_id } = await req.json();

        if (!room_id || selected_index === undefined || selected_index === null || !player_id) {
            return json({ error: "Campos obrigatórios faltando" }, 400);
        }
        if (!question_id && (question_index === undefined || question_index === null)) {
            return json({ error: "Informe question_id (pacote oficial) ou question_index (custom)" }, 400);
        }

        const client = getServiceClient();
        const callerId = await getOptionalCallerId(req);

        const { data: playerRow, error: playerError } = await client
            .from("showdown_players")
            .select("id, room_id, user_id, total_score")
            .eq("id", player_id)
            .maybeSingle();

        if (playerError || !playerRow) {
            return json({ error: "Jogador não encontrado" }, 404);
        }

        if (playerRow.room_id !== room_id) {
            return json({ error: "Jogador não é dessa sala" }, 403);
        }

        // Se a linha tem dono (logada ou sessão anônima de convidado) e
        // quem está chamando é outra conta, recusa.
        if (playerRow.user_id && playerRow.user_id !== callerId) {
            return json({ error: "Essa linha não pertence a você" }, 403);
        }

        const { data: room, error: roomError } = await client
            .from("showdown_rooms")
            .select("status, question_seconds, question_started_at, current_question_index, selected_question_ids, questions")
            .eq("id", room_id)
            .maybeSingle();

        if (roomError || !room) {
            return json({ error: "Sala não encontrada" }, 404);
        }

        if (room.status !== "question") {
            return json({ error: "A pergunta não está mais aberta" }, 409);
        }

        let correctIndex: number;

        if (Array.isArray(room.questions) && room.questions.length > 0) {

            // Modo custom/salvo - gabarito dentro da própria sala.
            if (Number(question_index) !== room.current_question_index) {
                return json({ error: "Essa pergunta não é mais a atual da sala" }, 409);
            }
            const q = room.questions[room.current_question_index];
            if (!q || typeof q.correct !== "number") {
                return json({ error: "Pergunta não encontrada" }, 404);
            }
            correctIndex = q.correct;

        } else {

            // Pacote oficial - a pergunta precisa ser a atual da sala
            // (não dá pra responder uma pergunta passada ou futura).
            const expectedQuestionId = room.selected_question_ids?.[room.current_question_index];
            if (!question_id || expectedQuestionId !== question_id) {
                return json({ error: "Essa pergunta não é mais a atual da sala" }, 409);
            }
            const { data: question, error: qError } = await client
                .from("questions")
                .select("correct_index")
                .eq("id", question_id)
                .maybeSingle();
            if (qError || !question) {
                return json({ error: "Pergunta não encontrada" }, 404);
            }
            correctIndex = question.correct_index;

        }

        const isCorrect = Number(selected_index) === correctIndex;

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

        if (answerError) {
            // 23505 = já existe resposta desse jogador pra essa pergunta.
            if (answerError.code === "23505") {
                return json({ error: "Você já respondeu essa pergunta" }, 409);
            }
            console.error("showdown-submit-answer: erro ao gravar resposta", answerError);
            return json({ error: "Erro ao gravar a resposta" }, 500);
        }

        const newScore = (playerRow.total_score || 0) + points;

        const { error: updateError } = await client
            .from("showdown_players")
            .update({ total_score: newScore })
            .eq("id", player_id);

        if (updateError) console.error("showdown-submit-answer: erro ao atualizar placar", updateError);

        // O gabarito NÃO volta aqui: a pergunta ainda está aberta pros
        // outros jogadores, e devolver correct_index deixaria quem já
        // respondeu passar a resposta pros demais. O navegador mostra
        // o resultado na tela de resultados (showdown_answers).
        return json({ correct: isCorrect, points });

    } catch (err) {
        console.error("showdown-submit-answer error:", err);
        return json({ error: "Internal error" }, 500);
    }

});
