// ==================================================================
// admin-delete-badge
//
// Body: { badgeId: string }
//
// Apaga um badge e TODAS as concessões dele (user_badges) - a chave
// estrangeira exige apagar as concessões antes do badge em si,
// senão o banco recusa (evita apagar um badge e deixar linhas
// órfãs apontando pra um id que não existe mais). Registra no
// admin_audit_log quantas concessões foram perdidas, pra rastro.
// ==================================================================

import { corsHeaders, withAdminAuth, logAdminAction } from "../_shared/adminAuth.ts";

Deno.serve(withAdminAuth(async (req, { adminClient, adminId }) => {

    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Use POST" }), {
            status: 405,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const body = await req.json().catch(() => null);
    const badgeId = body?.badgeId;

    if (typeof badgeId !== "string") {
        return new Response(JSON.stringify({ error: "Body precisa de { badgeId: string }" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const { data: badge, error: fetchError } = await adminClient
        .from("badges")
        .select("id, slug")
        .eq("id", badgeId)
        .maybeSingle();

    if (fetchError || !badge) {
        return new Response(JSON.stringify({ error: "Badge não encontrado" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const { count: holdersCount } = await adminClient
        .from("user_badges")
        .select("id", { count: "exact", head: true })
        .eq("badge_id", badgeId);

    // Apaga as concessões primeiro - a chave estrangeira bloquearia
    // apagar o badge com concessões ainda apontando pra ele.
    const { error: deleteGrantsError } = await adminClient
        .from("user_badges")
        .delete()
        .eq("badge_id", badgeId);

    if (deleteGrantsError) {
        console.error("Erro ao apagar concessões do badge:", deleteGrantsError);
        return new Response(JSON.stringify({ error: "Erro ao apagar as concessões do badge" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const { error: deleteBadgeError } = await adminClient
        .from("badges")
        .delete()
        .eq("id", badgeId);

    if (deleteBadgeError) {
        console.error("Erro ao apagar badge:", deleteBadgeError);
        return new Response(JSON.stringify({ error: "Erro ao apagar o badge" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    await logAdminAction(adminClient, adminId, "delete_badge", null, {
        badgeId,
        slug: badge.slug,
        holdersLost: holdersCount || 0,
    });

    return new Response(JSON.stringify({ success: true, holdersLost: holdersCount || 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

}));
