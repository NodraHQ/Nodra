// ==================================================================
// vip-create-saved-pack
//
// Body: { games: string[], name: string, questions: array }
//
// Centraliza a criação de vip_saved_packs - antes era insert direto
// do navegador (perfil E os 4 jogos, cada um com sua própria
// chamada), sem limite nenhum de verdade além da política de RLS
// (só confere se é VIP, não confere QUANTOS já existem). Reportado
// ao vivo: "vamos implementar sim, isso é super importante" - teto
// por tier, igual badge e tema. Diferente dos outros dois, pacote
// NÃO é por ciclo de VIP - é um teto total de pacotes vivos ao mesmo
// tempo (contando todos, não só criados nesse ciclo), porque
// diferente de badge/tema não faz sentido "resetar" isso a cada
// renovação.
// ==================================================================

import { corsHeaders, withVipAuth } from "../_shared/vipAuth.ts";

const PACK_LIMITS_BY_TIER: Record<string, number> = {
    bronze: 5,
    prata: 20,
    gold: 999,
};

Deno.serve(withVipAuth(async (req, { vipClient, vipId }) => {

    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Use POST" }), {
            status: 405,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const body = await req.json().catch(() => null);
    const games = body?.games;
    const name = body?.name;
    const questions = body?.questions;

    if (!Array.isArray(games) || games.length === 0) {
        return new Response(JSON.stringify({ error: "games precisa ter pelo menos 1 item" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
    if (typeof name !== "string" || !name.trim()) {
        return new Response(JSON.stringify({ error: "name é obrigatório" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
    if (!Array.isArray(questions) || questions.length === 0) {
        return new Response(JSON.stringify({ error: "questions precisa ter pelo menos 1 pergunta" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const { data: profile } = await vipClient
        .from("profiles")
        .select("vip_tier")
        .eq("id", vipId)
        .maybeSingle();

    const maxPacks = PACK_LIMITS_BY_TIER[profile?.vip_tier ?? ""] ?? PACK_LIMITS_BY_TIER.bronze;

    const { count, error: countError } = await vipClient
        .from("vip_saved_packs")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", vipId);

    if (countError) {
        console.error("Erro ao contar pacotes salvos:", countError);
        return new Response(JSON.stringify({ error: "Erro ao conferir o limite" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    if ((count ?? 0) >= maxPacks) {
        return new Response(
            JSON.stringify({ error: `Limite de ${maxPacks} pacotes salvos atingido. Apague um antigo ou faça upgrade de tier pra liberar mais.` }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    const { data: newPack, error: insertError } = await vipClient
        .from("vip_saved_packs")
        .insert({ owner_id: vipId, games, name: name.trim(), questions })
        .select("id")
        .single();

    if (insertError || !newPack) {
        console.error("Erro ao criar pacote salvo:", insertError);
        return new Response(JSON.stringify({ error: "Erro ao criar o pacote" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ success: true, packId: newPack.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

}));
