// ==================================================================
// admin-list-submitted-packs
//
// GET, sem body. Devolve a fila de pacotes de pergunta enviados
// (ndquest/submit) que ainda estão pendentes - mesma fila que
// qualquer VIP já vê em account (ver vip-review-submitted-pack e
// account.js/loadSubmittedPacksForReview), só que agora acessível
// pelo admin também. Reportado ao vivo: "hoje não consigo acessar
// isso, quero acessar pelo painel de admin".
// ==================================================================

import { corsHeaders, withAdminAuth } from "../_shared/adminAuth.ts";

Deno.serve(withAdminAuth(async (_req, { adminClient }) => {

    const { data, error } = await adminClient
        .from("submitted_packs")
        .select("id, slug, name_pt, name_en, submitter_name, submitter_email, questions, status, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Erro ao carregar pacotes enviados pro admin:", error);
        return new Response(JSON.stringify({ error: "Erro ao carregar dados" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const packs = (data || []).map((pack) => ({
        id: pack.id,
        slug: pack.slug,
        namePt: pack.name_pt,
        nameEn: pack.name_en,
        submitterName: pack.submitter_name,
        submitterEmail: pack.submitter_email,
        questionCount: Object.values(pack.questions || {}).reduce(
            (total: number, arr) => total + (Array.isArray(arr) ? arr.length : 0),
            0,
        ),
        createdAt: pack.created_at,
    }));

    return new Response(JSON.stringify({ packs }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

}));
