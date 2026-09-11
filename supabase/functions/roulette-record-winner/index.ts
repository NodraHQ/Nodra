// ==================================================================
// roulette-record-winner
//
// Body: { room_id, room_code, winner_name, placement, round_number }
//
// Bug real reportado ao vivo: o host gravava o resultado direto do
// navegador (.insert() em match_history/guest_participants), mas
// quem faz a chamada é a SESSÃO DO HOST, não do vencedor. Pra
// vencedor logado (não o próprio host), a política de segurança da
// tabela match_history só deixa gravar uma linha sobre VOCÊ MESMO
// (auth.uid() = user_id) - o host tentando gravar em nome de outra
// conta era bloqueado, sem erro visível pra ninguém, e o resultado
// dessa pessoa simplesmente nunca aparecia no histórico dela (mas
// aparecia certinho na tela ao vivo, que não passa pelo banco).
// Guest funcionava porque guest_participants é escrito com o
// host_id do próprio host, que bate com a política.
//
// Roulette é o único dos jogos onde quem grava o resultado é o host
// observando o sorteio, não cada jogador reportando o próprio -
// por isso só ele precisou dessa Edge Function, os outros já
// resolvem isso tendo cada jogador gravar sobre si mesmo.
// ==================================================================

import { corsHeaders, getServiceClient } from "../_shared/gameAuth.ts";

Deno.serve(async (req) => {

    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {

        const { room_id, room_code, winner_name, placement, round_number } = await req.json();

        if (!room_id || !room_code || !winner_name || !placement || !round_number) {
            return new Response(JSON.stringify({ error: "Faltam campos obrigatórios" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const client = getServiceClient();

        const { data: winnerPlayerRow, error: lookupError } = await client
            .from("roulette_players")
            .select("user_id, nickname")
            .eq("room_id", room_id)
            .eq("nickname", winner_name)
            .maybeSingle();

        if (lookupError || !winnerPlayerRow) {
            console.error("roulette-record-winner: não achou a linha do vencedor", lookupError);
            return new Response(JSON.stringify({ error: "Vencedor não encontrado na sala" }), {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Bug real reportado ao vivo (visto em produção com print): esse
        // "if" checava só se winnerPlayerRow.user_id existia - mas desde
        // que convidado ganhou sessão anônima, TODO jogador tem um
        // user_id (até quem nunca logou), então esse if sempre caía no
        // ramo de match_history, e o resultado do convidado aparecia
        // como "?" no histórico do host (guest_participants nunca
        // recebia a linha). Precisa confirmar de verdade se é conta real
        // (via Admin API, é o único jeito confiável de saber a partir só
        // do user_id, sem token de sessão do próprio vencedor à mão).
        const isRealAccount = winnerPlayerRow.user_id
            ? await isRealAccountId(client, winnerPlayerRow.user_id)
            : false;

        if (isRealAccount) {
            const { error } = await client
                .from("match_history")
                .insert({
                    user_id: winnerPlayerRow.user_id,
                    role: "player",
                    game: "roulette",
                    room_code,
                    round_number,
                    placement,
                });

            if (error) {
                console.error("roulette-record-winner: erro ao gravar vencedor logado", error);
                return new Response(JSON.stringify({ error: "Erro ao gravar no histórico" }), {
                    status: 500,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }
        } else {
            const { data: roomRow } = await client
                .from("roulette_rooms")
                .select("host_id")
                .eq("id", room_id)
                .maybeSingle();

            if (roomRow?.host_id) {
                const { error } = await client
                    .from("guest_participants")
                    .insert({
                        host_id: roomRow.host_id,
                        game: "roulette",
                        room_code,
                        round_number,
                        nickname: winnerPlayerRow.nickname,
                        placement,
                    });

                if (error) {
                    console.error("roulette-record-winner: erro ao gravar vencedor guest", error);
                    return new Response(JSON.stringify({ error: "Erro ao gravar no histórico" }), {
                        status: 500,
                        headers: { ...corsHeaders, "Content-Type": "application/json" },
                    });
                }
            }
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err) {
        console.error("roulette-record-winner error:", err);
        return new Response(JSON.stringify({ error: "Internal error" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

});

// Confirma se um user_id é de conta real (não sessão anônima) usando a
// Admin API - único jeito confiável de checar isso a partir só do id,
// sem ter o token da sessão do próprio vencedor em mãos (quem chama essa
// function é o host, não o vencedor).
async function isRealAccountId(
    client: ReturnType<typeof getServiceClient>,
    userId: string,
): Promise<boolean> {
    const { data, error } = await client.auth.admin.getUserById(userId);
    if (error || !data?.user) return false;
    return !data.user.is_anonymous;
}
