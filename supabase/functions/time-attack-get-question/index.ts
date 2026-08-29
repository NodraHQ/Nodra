// ==================================================================
// time-attack-get-question
//
// Serve uma pergunta pro Time Attack SEM o índice da resposta certa
// — isso é o ponto central do Mecanismo B (ver
// docs/BADGE_INTEGRITY_ARCHITECTURE.md). Antes, o pacote inteiro
// (com correct_index incluso) era carregado direto no navegador; a
// pessoa podia abrir o F12 e ver a resposta certa antes de clicar.
// Agora `questions` não tem NENHUMA policy de select — nem essa
// function consegue burlar isso, ela só lê porque usa a chave de
// serviço, que ignora RLS de propósito.
// ==================================================================

import { corsHeaders, getServiceClient } from "../_shared/gameAuth.ts";

Deno.serve(async (req) => {

    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {

        const { pack_slug, difficulty, excluded_question_ids } = await req.json();

        if (!pack_slug) {
            return new Response(JSON.stringify({ error: "pack_slug é obrigatório" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const client = getServiceClient();

        const { data: pack, error: packError } = await client
            .from("question_packs")
            .select("id")
            .eq("slug", pack_slug)
            .maybeSingle();

        if (packError || !pack) {
            return new Response(JSON.stringify({ error: "Pacote não encontrado" }), {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        let query = client
            .from("questions")
            .select("id, question_pt, question_en, options")
            .eq("pack_id", pack.id);

        // Dificuldade é opcional — Time Attack hoje mistura fácil,
        // médio e difícil numa lista só, sem progressão. Se não vier
        // dificuldade, sorteia de qualquer uma das três, igual ao
        // pool combinado que já existia antes desta migração.
        if (difficulty) {
            query = query.eq("difficulty", difficulty);
        }

        const excluded = Array.isArray(excluded_question_ids) ? excluded_question_ids : [];
        if (excluded.length > 0) {
            query = query.not("id", "in", `(${excluded.join(",")})`);
        }

        const { data: candidates, error: questionsError } = await query;

        if (questionsError) {
            console.error("time-attack-get-question query error:", questionsError);
            return new Response(JSON.stringify({ error: "Erro ao buscar pergunta" }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        if (!candidates || candidates.length === 0) {
            // Acabaram as perguntas dessa dificuldade nesse pacote que
            // essa sessão ainda não viu — o jogo do lado do cliente
            // decide o que fazer (repetir dificuldade, encerrar, etc).
            return new Response(JSON.stringify({ done: true }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const picked = candidates[Math.floor(Math.random() * candidates.length)];

        // options já vem como [{pt,en}, ...] do banco — anexa só a
        // posição real (index), NUNCA o correct_index. É essa omissão
        // que fecha o mecanismo: o cliente literalmente não recebe o
        // dado que precisaria pra trapacear, não é "escondido na
        // tela", é ausente da resposta inteira.
        const optionsWithIndex = (picked.options as { pt: string; en: string }[]).map((opt, index) => ({
            index,
            pt: opt.pt,
            en: opt.en,
        }));

        return new Response(JSON.stringify({
            question_id: picked.id,
            question_pt: picked.question_pt,
            question_en: picked.question_en,
            options: optionsWithIndex,
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err) {
        console.error("time-attack-get-question error:", err);
        return new Response(JSON.stringify({ error: "Internal error" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

});
