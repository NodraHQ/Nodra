// ==================================================================
// ndquest-get-themes
//
// Body: { game_slug: string }
// Header opcional: Authorization com token de quem estiver logado -
// se vier, também devolve os temas privados/pendentes dessa pessoa,
// além dos públicos. Sem token (ou anônimo), só devolve os públicos.
//
// Compartilhada entre os 5 jogos (Show Down, Time Attack, Tap Rush,
// Roulette, Quest Drop) - cada branding-manifest.js chama essa mesma
// função passando o próprio game_slug. Não é uma quebra da regra de
// "cada pasta de jogo é independente" (essa regra é sobre o FRONTEND
// não compartilhar código entre pastas ndquest/*, não sobre o
// backend - os 5 jogos já apontam pro mesmo projeto Supabase e já
// usam algumas Edge Functions com lógica idêntica hoje).
//
// Chave de serviço aqui de propósito, não RLS: "dono ainda é VIP"
// pros temas públicos precisa cruzar com profiles (que tem RLS de
// "só o dono lê"), e fazer isso via PostgREST embutindo uma view não
// é algo que dá pra garantir sem testar contra o banco real. Fazendo
// a consulta aqui, direto, evita essa incerteza inteira - duas
// buscas simples (temas, depois os donos únicos) e mescla em código,
// mais fácil de confiar que vai funcionar.
// ==================================================================

import { corsHeaders, getServiceClient, getOptionalCallerId } from "../_shared/gameAuth.ts";

Deno.serve(async (req) => {

    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {

        const { game_slug } = await req.json();

        if (!game_slug || typeof game_slug !== "string") {
            return new Response(JSON.stringify({ error: "game_slug obrigatório" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const client = getServiceClient();

        // Quem está pedindo - opcional. Sem isso, vê só os públicos.
        const requesterId = await getOptionalCallerId(req);

        const { data: themeRows, error: themesError } = await client
            .from("custom_themes")
            .select(
                "slug, name, colors, fonts, logo_url, logo_background, envelope_texture_url, slogan_pt, slogan_en, status, owner_id"
            )
            .contains("applicable_games", [game_slug])
            .in("status", requesterId ? ["public", "private", "pending_review"] : ["public"]);

        if (themesError) {
            console.error("ndquest-get-themes: erro ao buscar temas", themesError);
            return new Response(JSON.stringify({ error: "Erro ao buscar temas" }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const rows = themeRows || [];

        // Filtra os privados/pendentes pra só os do próprio requisitante
        // (a query acima já trouxe TODOS os status quando tem
        // requesterId, incluindo privados de OUTRAS pessoas - filtra
        // aqui em vez de tentar fazer isso na query, mais simples e
        // direto de auditar).
        const visibleRows = rows.filter((row) => row.status === "public" || row.owner_id === requesterId);

        // Confere quem ainda é VIP, numa busca só (não uma por linha) -
        // só importa pros públicos, mas não custa nada buscar geral.
        const ownerIds = [...new Set(visibleRows.map((row) => row.owner_id))];
        const { data: vipProfiles } = ownerIds.length > 0
            ? await client.from("profiles").select("id, is_vip").in("id", ownerIds)
            : { data: [] };
        const vipSet = new Set((vipProfiles || []).filter((p) => p.is_vip).map((p) => p.id));

        const finalRows = visibleRows.filter((row) => (row.status === "public" ? vipSet.has(row.owner_id) : true));

        const themes = finalRows.map((row) => ({
            slug: row.slug,
            name: row.name,
            colors: row.colors,
            fonts: row.fonts,
            logo_url: row.logo_url,
            logo_background: row.logo_background,
            envelope_texture_url: row.envelope_texture_url,
            slogan_pt: row.slogan_pt,
            slogan_en: row.slogan_en,
        }));

        return new Response(JSON.stringify({ themes }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err) {
        console.error("ndquest-get-themes error:", err);
        return new Response(JSON.stringify({ error: "Internal error" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

});
