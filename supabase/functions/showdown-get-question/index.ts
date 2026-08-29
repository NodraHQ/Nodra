// ==================================================================
// showdown-get-question
//
// Serve a pergunta ATUAL da sala (baseado em current_question_index
// + selected_question_ids) sem nunca incluir a resposta certa. Todo
// mundo na sala pede a mesma pergunta, no mesmo momento — diferente
// do Time Attack, aqui não tem "próxima pergunta pessoal", é sempre
// a pergunta corrente da sala inteira.
// ==================================================================

import { corsHeaders, getServiceClient } from "../_shared/gameAuth.ts";

Deno.serve(async (req) => {

    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {

        const { room_id, question_index } = await req.json();

        if (!room_id) {
            return new Response(JSON.stringify({ error: "room_id é obrigatório" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const client = getServiceClient();

        const { data: room, error: roomError } = await client
            .from("showdown_rooms")
            .select("selected_question_ids, current_question_index, status, num_questions")
            .eq("id", room_id)
            .maybeSingle();

        if (roomError || !room) {
            return new Response(JSON.stringify({ error: "Sala não encontrada" }), {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // question_index é opcional — se vier, serve ESSA pergunta
        // específica (usado pra pré-carregar a próxima enquanto a
        // pessoa ainda está vendo o resultado da atual, sem precisar
        // esperar o host avançar pra só então buscar). Ver a resposta
        // certa nunca vaza aqui — só o TEXTO da pergunta antecipa,
        // nunca qual opção é a certa, então não abre brecha nenhuma
        // pra responder antes da hora. Continua limitado a perguntas
        // que já fazem parte da sala (dentro de num_questions), nunca
        // um índice arbitrário de fora do jogo.
        const idx = question_index !== undefined && question_index !== null ? question_index : room.current_question_index;

        if (idx < 0 || idx >= room.num_questions) {
            return new Response(JSON.stringify({ error: "Índice de pergunta inválido" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const questionId = room.selected_question_ids?.[idx];

        if (!questionId) {
            return new Response(JSON.stringify({ error: "Pergunta atual não encontrada" }), {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const { data: question, error: qError } = await client
            .from("questions")
            .select("id, question_pt, question_en, options, correct_index")
            .eq("id", questionId)
            .maybeSingle();

        if (qError || !question) {
            return new Response(JSON.stringify({ error: "Pergunta não encontrada" }), {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // options já vem como [{pt,en}, ...] do banco — anexa só a
        // posição real, NUNCA o correct_index — EXCETO se a sala já
        // está na fase de resultado (status='results'), que só o
        // HOST consegue colocar a sala nesse estado, depois da janela
        // de resposta já ter fechado pra todo mundo. Checa o status
        // NO SERVIDOR, não confia em quando o cliente pede — pedir
        // antes da hora simplesmente não revela nada.
        const optionsWithIndex = (question.options as { pt: string; en: string }[]).map((opt, index) => ({
            index,
            pt: opt.pt,
            en: opt.en,
        }));

        const responseBody: Record<string, unknown> = {
            question_id: question.id,
            question_pt: question.question_pt,
            question_en: question.question_en,
            options: optionsWithIndex,
        };

        if (room.status === "results" && idx === room.current_question_index) {
            responseBody.correct_index = question.correct_index;
        }

        return new Response(JSON.stringify(responseBody), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err) {
        console.error("showdown-get-question error:", err);
        return new Response(JSON.stringify({ error: "Internal error" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

});
