// ==================================================================
// showdown-pick-questions
//
// Sorteia N perguntas de um pacote e devolve só os IDs — nunca o
// conteúdo, nunca a resposta certa. A sala (showdown_rooms) passa a
// guardar esse array de IDs em vez do pacote inteiro com gabarito
// (era assim antes: `questions` na própria linha da sala, incluindo
// correct_index — qualquer jogador que entrasse já tinha acesso ao
// gabarito do jogo inteiro, antes mesmo da primeira pergunta
// aparecer). Ver docs/BADGE_INTEGRITY_ARCHITECTURE.md.
// ==================================================================

import { corsHeaders, getServiceClient } from "../_shared/gameAuth.ts";

Deno.serve(async (req) => {

    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {

        const { pack_slug, count } = await req.json();

        if (!pack_slug || !count) {
            return new Response(JSON.stringify({ error: "pack_slug e count são obrigatórios" }), {
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

        const { data: questions, error } = await client
            .from("questions")
            .select("id")
            .eq("pack_id", pack.id);

        if (error) {
            console.error("showdown-pick-questions query error:", error);
            return new Response(JSON.stringify({ error: "Erro ao buscar perguntas" }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        if (!questions || questions.length < count) {
            return new Response(JSON.stringify({ error: "Não há perguntas suficientes nesse pacote" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const shuffled = [...questions].sort(() => Math.random() - 0.5);
        const picked = shuffled.slice(0, count).map((q) => q.id);

        return new Response(JSON.stringify({ question_ids: picked }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err) {
        console.error("showdown-pick-questions error:", err);
        return new Response(JSON.stringify({ error: "Internal error" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

});
