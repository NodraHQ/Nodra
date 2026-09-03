// ==================================================================
// tap-rush-reset-round
//
// Body: { room_id: string }
//
// Chamada pelo host ao clicar "Jogar de Novo" - zera tap_count de
// todo mundo, com chave de serviço (ignora RLS de propósito). Antes
// era uma chamada direta do navegador do host (.update()), que
// depende dele ter permissão de RLS pra mexer em linhas que não são
// dele. No Show Down essa mesma forma de fazer (ver
// showdown-reset-round) escondia uma falha calada: o placar não
// zerava de verdade entre rodadas, contaminando o ranking da rodada
// nova com pontos da anterior. Preventivo aqui - mesmo padrão, antes
// de esperar o mesmo bug aparecer no Tap Rush.
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

        const { error: resetError } = await client
            .from("tap_rush_players")
            .update({ tap_count: 0 })
            .eq("room_id", room_id);

        if (resetError) {
            console.error("tap-rush-reset-round: erro ao zerar toques", resetError);
            return new Response(JSON.stringify({ error: "Erro ao zerar os toques" }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err) {
        console.error("tap-rush-reset-round error:", err);
        return new Response(JSON.stringify({ error: "Internal error" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

});
