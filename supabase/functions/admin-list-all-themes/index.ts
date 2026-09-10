// ==================================================================
// admin-list-all-themes
//
// GET, sem body. Devolve TODOS os temas personalizados, qualquer
// status (private, pending_review, public, rejected) - diferente de
// admin-list-submitted-themes, que só mostra a fila pendente.
// Reportado ao vivo: "adiciona uma função pra eu poder ver os
// temas privados dos VIPs também".
// ==================================================================

import { corsHeaders, withAdminAuth } from "../_shared/adminAuth.ts";

Deno.serve(withAdminAuth(async (_req, { adminClient }) => {

    const { data, error } = await adminClient
        .from("custom_themes")
        .select("id, slug, name, status, colors, logo_url, slogan_pt, slogan_en, applicable_games, owner_id, created_at")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Erro ao carregar todos os temas pro admin:", error);
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

    const themes = rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        status: row.status,
        colors: row.colors,
        logoUrl: row.logo_url,
        sloganPt: row.slogan_pt,
        sloganEn: row.slogan_en,
        applicableGames: row.applicable_games,
        ownerUsername: usernameMap.get(row.owner_id) || row.owner_id,
        createdAt: row.created_at,
    }));

    return new Response(JSON.stringify({ themes }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

}));
