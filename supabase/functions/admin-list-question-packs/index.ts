// ==================================================================
// admin-list-question-packs
//
// GET, sem body. Lista TODO pacote oficial já aprovado (o catálogo
// de verdade que os jogos usam pra buscar pergunta) - reportado ao
// vivo: pacote de teste aprovado (inclusive um auto-aprovado antes
// da trava existir) não aparecia em lugar nenhum do admin pra
// limpar depois. A fila de "Pacotes Enviados" só mostra pendente,
// suma daqui assim que aprovado - esse aqui é o catálogo em si.
// ==================================================================

import { corsHeaders, withAdminAuth } from "../_shared/adminAuth.ts";

Deno.serve(withAdminAuth(async (_req, { adminClient }) => {

    const { data: packs, error } = await adminClient
        .from("question_packs")
        .select("id, slug, name_pt, name_en, tier, applicable_games, created_at")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Erro ao carregar catálogo de pacotes:", error);
        return new Response(JSON.stringify({ error: "Erro ao carregar dados" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const packIds = (packs || []).map((p) => p.id);
    const { data: questionCounts } = packIds.length > 0
        ? await adminClient.from("questions").select("pack_id").in("pack_id", packIds)
        : { data: [] };

    const countByPack = new Map();
    (questionCounts || []).forEach((q) => {
        countByPack.set(q.pack_id, (countByPack.get(q.pack_id) || 0) + 1);
    });

    const result = (packs || []).map((p) => ({
        id: p.id,
        slug: p.slug,
        namePt: p.name_pt,
        nameEn: p.name_en,
        tier: p.tier,
        applicableGames: p.applicable_games,
        questionCount: countByPack.get(p.id) || 0,
        createdAt: p.created_at,
    }));

    return new Response(JSON.stringify({ packs: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

}));
