// ==================================================================
// time-attack-submit-answer
//
// Body: { question_id, selected_index, player_row_id }
//
// Recebe qual opção a pessoa escolheu, decide se acertou (só esta
// function conhece o correct_index de verdade), e É ELA — não o
// navegador do jogador — quem atualiza correct_answers. Antes, o
// navegador decidia sozinho se tinha acertado e escrevia isso
// direto; qualquer um conseguia forjar isso via F12, sem nem
// precisar jogar. Ver docs/BADGE_INTEGRITY_ARCHITECTURE.md.
//
// Checagem de segurança (auditoria de 11/2026):
// - Cada pergunta conta UMA vez por jogador (answered_question_ids).
//   Antes dava pra errar, receber o correct_index no retorno e
//   reenviar a mesma pergunta com a resposta certa, somando +1 quantas
//   vezes quisesse. A pergunta entra na lista acertando ou errando.
// - O correct_index não volta mais no retorno (o navegador só usa
//   `correct`).
// - A pergunta precisa ser do pacote da sala - sem isso dava pra
//   chutar em perguntas de qualquer pacote do banco.
// - Jogador que já terminou (finished_at preenchido) não pontua mais.
// O banco também ignora qualquer mudança de correct_answers vinda do
// navegador em sala de pacote oficial (gatilho
// protect_time_attack_score), então esta function é o único caminho.
// ==================================================================

import { corsHeaders, getServiceClient, getOptionalCallerId } from "../_shared/gameAuth.ts";

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {

    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {

        const { question_id, selected_index, player_row_id } = await req.json();

        if (!question_id || selected_index === undefined || selected_index === null || !player_row_id) {
            return json({ error: "Campos obrigatórios faltando" }, 400);
        }
        if (typeof question_id !== "string" || !UUID_RE.test(question_id)) {
            return json({ error: "question_id inválido" }, 400);
        }

        const client = getServiceClient();
        const callerId = await getOptionalCallerId(req);

        const { data: playerRow, error: playerError } = await client
            .from("time_attack_players")
            .select("id, room_id, user_id, correct_answers, finished_at, answered_question_ids")
            .eq("id", player_row_id)
            .maybeSingle();

        if (playerError || !playerRow) {
            return json({ error: "Jogador não encontrado" }, 404);
        }

        // Linha sem dono (convidado antigo, sem sessão) pode ser
        // respondida por qualquer um - comportamento herdado. Linha com
        // dono só pelo próprio dono.
        if (playerRow.user_id && playerRow.user_id !== callerId) {
            return json({ error: "Essa linha não pertence a você" }, 403);
        }

        if (playerRow.finished_at) {
            return json({ error: "Sua partida já terminou" }, 409);
        }

        const answered: string[] = playerRow.answered_question_ids || [];
        if (answered.includes(question_id)) {
            return json({ error: "Você já respondeu essa pergunta" }, 409);
        }

        const { data: room } = await client
            .from("time_attack_rooms")
            .select("pack_slug")
            .eq("id", playerRow.room_id)
            .maybeSingle();

        const { data: question, error: questionError } = await client
            .from("questions")
            .select("correct_index, pack_id")
            .eq("id", question_id)
            .maybeSingle();

        if (questionError || !question) {
            return json({ error: "Pergunta não encontrada" }, 404);
        }

        const { data: pack } = room?.pack_slug
            ? await client.from("question_packs").select("id").eq("slug", room.pack_slug).maybeSingle()
            : { data: null };

        if (!pack || pack.id !== question.pack_id) {
            return json({ error: "Essa pergunta não é do pacote da sala" }, 409);
        }

        const isCorrect = Number(selected_index) === question.correct_index;

        // Grava a pergunta como respondida (e soma o acerto) num update
        // só, condicionado a ela ainda NÃO estar na lista. Se dois
        // envios da mesma pergunta chegarem juntos, o Postgres reavalia
        // a condição depois da trava de linha e só um deles grava.
        const updatePayload: Record<string, unknown> = {
            answered_question_ids: [...answered, question_id],
        };
        if (isCorrect) {
            updatePayload.correct_answers = (playerRow.correct_answers || 0) + 1;
        }

        const { data: updated, error: updateError } = await client
            .from("time_attack_players")
            .update(updatePayload)
            .eq("id", player_row_id)
            .not("answered_question_ids", "cs", `{${question_id}}`)
            .select("id");

        if (updateError) {
            console.error("time-attack-submit-answer update error:", updateError);
            return json({ error: "Erro ao gravar a resposta" }, 500);
        }
        if (!updated || updated.length === 0) {
            return json({ error: "Você já respondeu essa pergunta" }, 409);
        }

        return json({ correct: isCorrect });

    } catch (err) {
        console.error("time-attack-submit-answer error:", err);
        return json({ error: "Internal error" }, 500);
    }

});
