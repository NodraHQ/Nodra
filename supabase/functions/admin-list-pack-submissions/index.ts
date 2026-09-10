// ==================================================================
// admin-list-pack-submissions
//
// GET, sem body. Substitui admin-list-submitted-packs (que lia da
// tabela antiga submitted_packs) - agora lê de vip_saved_packs com
// submission_status = 'pending'. Só o admin vê essa fila; nenhum
// outro VIP tem mais acesso a isso (reportado ao vivo: "outro
// usuário iria ver algo e ainda poder aprovar, que porra é essa").
// ==================================================================

import { corsHeaders, withAdminAuth } from "../_shared/adminAuth.ts";

Deno.serve(withAdminAuth(async (_req, { adminClient }) => {

    const { data: packs, error } = await adminClient
        .from("vip_saved_packs")
        .select("id, owner_id, games, name, questions, created_at")
        .eq("submission_status", "pending")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Erro ao carregar pacotes pendentes de revisão:", error);
        return new Response(JSON.stringify({ error: "Erro ao carregar dados" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const ownerIds = [...new Set((packs || []).map((p) => p.owner_id))];
    const { data: profiles } = ownerIds.length > 0
        ? await adminClient.from("profiles").select("id, username").in("id", ownerIds)
        : { data: [] };
    const usernameById = new Map((profiles || []).map((p) => [p.id, p.username]));

    const result = (packs || []).map((p) => ({
        id: p.id,
        ownerUsername: usernameById.get(p.owner_id) || p.owner_id,
        games: p.games,
        name: p.name,
        questionCount: Array.isArray(p.questions) ? p.questions.length : 0,
        questions: p.questions,
        createdAt: p.created_at,
    }));

    return new Response(JSON.stringify({ packs: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

}));
