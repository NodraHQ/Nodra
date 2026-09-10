// ==================================================================
// admin-list-vip-packs
//
// GET, sem body. Devolve TODOS os pacotes de pergunta que VIPs
// salvaram pra reusar (ver vip_saved_packs) - diferente de
// admin-list-submitted-packs, que só mostra a fila pública pendente.
// Reportado ao vivo: "adiciona uma função pra eu poder ver os
// pacotes privados dos VIPs também".
// ==================================================================

import { corsHeaders, withAdminAuth } from "../_shared/adminAuth.ts";

Deno.serve(withAdminAuth(async (_req, { adminClient }) => {

    const { data, error } = await adminClient
        .from("vip_saved_packs")
        .select("id, owner_id, games, name, questions, created_at")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Erro ao carregar pacotes salvos de VIP pro admin:", error);
        return new Response(JSON.stringify({ error: "Erro ao carregar dados" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const rows = data || [];
    const ownerIds = [...new Set(rows.map((r) => r.owner_id))];

    const { data: owners } = ownerIds.length > 0
        ? await adminClient.from("profiles").select("id, username").in("id", ownerIds)
        : { data: [] };

    const usernameMap = new Map((owners || []).map((o) => [o.id, o.username]));

    const packs = rows.map((row) => ({
        id: row.id,
        games: row.games,
        name: row.name,
        questions: row.questions,
        questionCount: Array.isArray(row.questions) ? row.questions.length : 0,
        ownerUsername: usernameMap.get(row.owner_id) || row.owner_id,
        createdAt: row.created_at,
    }));

    return new Response(JSON.stringify({ packs }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

}));
