// ==================================================================
// showdown-reset-round
//
// Body: { room_id: string }
//
// Chamada pelo host ao clicar "Jogar de Novo" - limpa showdown_answers
// da sala e zera total_score de todo mundo, com chave de serviço
// (ignora RLS de propósito). Existia antes como duas chamadas diretas
// do navegador do host (.delete()/.update()), mas isso depende do
// host ter permissão de RLS pra mexer em linhas que não são dele -
// se não tiver, falha calado (a Supabase JS não lança erro sozinha,
// só devolve um objeto de erro que ninguém checava). O sintoma bateu
// exatamente com isso: "função de finalizar quando todos responderem
// não funciona, só no primeiro round" - se o delete falha, sobra
// resposta fantasma da rodada anterior ocupando a mesma trava única
// (room_id + player_id + question_index), a rodada nova nunca
// consegue gravar uma resposta pra esse índice, e quem escuta
// showdown_answers pra auto-encerrar nunca vê nada novo chegar.
// Service role sempre tem permissão, então isso fecha a dúvida de
// vez, em vez de só logar o erro e continuar sem saber a causa.
// ==================================================================

import { corsHeaders, getServiceClient } from "../_shared/gameAuth.ts";

Deno.serve(async (req) => {

    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {

        const { room_id } = await req.json();

        if (!room_id) {
            return new Response(JSON.stringify({ error: "room_id obrigatório" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const client = getServiceClient();

        const { error: deleteError } = await client
            .from("showdown_answers")
            .delete()
            .eq("room_id", room_id);

        if (deleteError) {
            console.error("showdown-reset-round: erro ao apagar respostas antigas", deleteError);
            return new Response(JSON.stringify({ error: "Erro ao limpar respostas da rodada anterior" }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const { error: resetError } = await client
            .from("showdown_players")
            .update({ total_score: 0 })
            .eq("room_id", room_id);

        if (resetError) {
            console.error("showdown-reset-round: erro ao zerar placar", resetError);
            return new Response(JSON.stringify({ error: "Erro ao zerar o placar" }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err) {
        console.error("showdown-reset-round error:", err);
        return new Response(JSON.stringify({ error: "Internal error" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

});
