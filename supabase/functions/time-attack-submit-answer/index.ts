// ==================================================================
// time-attack-submit-answer
//
// Recebe qual opção a pessoa escolheu, decide se acertou (só esta
// function conhece o correct_index de verdade), e É ELA — não o
// navegador do jogador — quem atualiza correct_answers. Antes, o
// navegador decidia sozinho se tinha acertado e escrevia isso
// direto; qualquer um conseguia forjar isso via F12, sem nem
// precisar jogar. Ver docs/BADGE_INTEGRITY_ARCHITECTURE.md.
// ==================================================================

import { corsHeaders, getServiceClient, getOptionalCallerId } from "../_shared/gameAuth.ts";

Deno.serve(async (req) => {

    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {

        const { question_id, selected_index, player_row_id } = await req.json();

        if (!question_id || selected_index === undefined || selected_index === null || !player_row_id) {
            return new Response(JSON.stringify({ error: "Campos obrigatórios faltando" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const client = getServiceClient();
        const callerId = await getOptionalCallerId(req);

        const { data: playerRow, error: playerError } = await client
            .from("time_attack_players")
            .select("id, user_id, correct_answers")
            .eq("id", player_row_id)
            .maybeSingle();

        if (playerError || !playerRow) {
            return new Response(JSON.stringify({ error: "Jogador não encontrado" }), {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Se a linha do jogador tem um dono (está logada) e quem está
        // chamando é uma conta diferente, recusa — ninguém responde
        // em nome de outra conta. Anônimo não tem como provar
        // identidade mais forte que isso (limitação conhecida,
        // documentada desde o início da sessão — não dá pra resolver
        // sem exigir login, que ficou definido como opcional).
        if (playerRow.user_id && playerRow.user_id !== callerId) {
            return new Response(JSON.stringify({ error: "Essa linha não pertence a você" }), {
                status: 403,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const { data: question, error: questionError } = await client
            .from("questions")
            .select("correct_index")
            .eq("id", question_id)
            .maybeSingle();

        if (questionError || !question) {
            return new Response(JSON.stringify({ error: "Pergunta não encontrada" }), {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const isCorrect = Number(selected_index) === question.correct_index;

        if (isCorrect) {
            const { error: updateError } = await client
                .from("time_attack_players")
                .update({ correct_answers: (playerRow.correct_answers || 0) + 1 })
                .eq("id", player_row_id);

            if (updateError) {
                console.error("time-attack-submit-answer update error:", updateError);
            }
        }

        // Revela a resposta certa DEPOIS de já ter decidido — bom pra
        // aprendizado (o produto é sobre conhecimento, faz sentido
        // mostrar o que era certo), e nesse ponto já não tem mais
        // nada a proteger, a resposta já foi dada.
        return new Response(JSON.stringify({
            correct: isCorrect,
            correct_index: question.correct_index,
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err) {
        console.error("time-attack-submit-answer error:", err);
        return new Response(JSON.stringify({ error: "Internal error" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

});
