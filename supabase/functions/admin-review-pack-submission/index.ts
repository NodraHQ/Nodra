// ==================================================================
// admin-review-pack-submission
//
// Body: { packId, action: "approve" | "reject", reason? }
//
// Substitui vip-review-submitted-pack - agora só admin chama isso,
// nunca outro VIP (era esse o problema real reportado ao vivo: VIP
// via e podia mexer no envio de qualquer outra pessoa). Aprovar
// cria question_packs+questions de verdade (formato plano de
// vip_saved_packs vira uma dificuldade só, "medium" - Show Down e
// Time Attack não filtram por dificuldade mesmo, só Quest Drop usa
// isso de verdade). Rejeitar volta o pacote pro estado privado
// normal, com o motivo anexado - a pessoa pode editar e reenviar
// depois, de graça, quantas vezes quiser.
// ==================================================================

import { corsHeaders, withAdminAuth } from "../_shared/adminAuth.ts";

const GAME_TO_APPLICABLE = {
    "show-down": ["show_down"],
    "time-attack": ["time_attack"],
};

Deno.serve(withAdminAuth(async (req, { adminClient, adminId }) => {

    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Use POST" }), {
            status: 405,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const body = await req.json().catch(() => ({}));
    const { packId, action, reason } = body;

    if (!packId || (action !== "approve" && action !== "reject")) {
        return new Response(
            JSON.stringify({ error: 'Body precisa de { packId, action: "approve" | "reject" }' }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    const { data: pack, error: fetchError } = await adminClient
        .from("vip_saved_packs")
        .select("id, games, name, questions, submission_status")
        .eq("id", packId)
        .maybeSingle();

    if (fetchError || !pack) {
        return new Response(JSON.stringify({ error: "Pacote não encontrado" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    if (pack.submission_status !== "pending") {
        return new Response(JSON.stringify({ error: "Esse pacote não está aguardando revisão" }), {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    if (action === "reject") {
        await adminClient
            .from("vip_saved_packs")
            .update({
                submission_status: "rejected",
                rejection_reason: reason || null,
                reviewed_by: adminId,
                reviewed_at: new Date().toISOString(),
            })
            .eq("id", packId);

        return new Response(JSON.stringify({ success: true, action: "rejected" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    // action === "approve" - cria o pacote oficial de verdade
    const { data: newPack, error: packInsertError } = await adminClient
        .from("question_packs")
        .insert({
            slug: `${pack.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`,
            name_pt: pack.name,
            name_en: pack.name,
            tier: "official",
            applicable_games: (pack.games || []).flatMap((g: string) => GAME_TO_APPLICABLE[g] || []),
        })
        .select("id")
        .single();

    if (packInsertError || !newPack) {
        console.error("Erro ao criar question_packs a partir do envio:", packInsertError);
        return new Response(JSON.stringify({ error: "Erro ao criar o pacote oficial" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const questionsPayload = (pack.questions || []).map((q: {
        question: { pt: string; en: string };
        answers: { pt: string[]; en: string[] };
        correct: number;
    }) => ({
        pack_id: newPack.id,
        difficulty: "medium",
        question_pt: q.question?.pt || "",
        question_en: q.question?.en || "",
        options: (q.answers?.pt || []).map((pt: string, i: number) => ({ pt, en: q.answers?.en?.[i] ?? pt })),
        correct_index: Number(q.correct) || 0,
    }));

    let questionsCreated = 0;
    if (questionsPayload.length > 0) {
        const { error: questionsInsertError, count } = await adminClient
            .from("questions")
            .insert(questionsPayload, { count: "exact" });

        if (questionsInsertError) {
            console.error("Erro ao criar perguntas a partir do envio:", questionsInsertError);
            return new Response(
                JSON.stringify({ error: "Pacote criado, mas erro ao criar as perguntas - revise manualmente" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
        }
        questionsCreated = count || questionsPayload.length;
    }

    await adminClient
        .from("vip_saved_packs")
        .update({
            submission_status: "approved",
            reviewed_by: adminId,
            reviewed_at: new Date().toISOString(),
        })
        .eq("id", packId);

    return new Response(
        JSON.stringify({ success: true, action: "approved", questionsCreated }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

}));
