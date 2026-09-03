// ==================================================================
// admin-review-submitted-pack
//
// Body: { packId: string, action: "approve" | "reject" }
//
// Mesma lógica de vip-review-submitted-pack, mas do lado do admin -
// as duas convivem de propósito: VIP continua podendo aprovar pelo
// próprio account (fila compartilhada entre VIPs), admin agora
// também consegue, com auth e log separados (admin_audit_log, nunca
// vip_audit_log - ver docs/ADMIN_ARCHITECTURE.md e
// _shared/vipAuth.ts). Aprovar transforma o conteúdo enviado (formato
// livre, sem vínculo nenhum de usuário) num question_packs de
// verdade, usado pelos jogos - cria o pacote e cada pergunta
// individual, convertendo o formato { answers: {pt:[], en:[]} } pro
// formato real que a tabela questions usa ({pt,en} pareado por
// índice). Rejeitar só marca como rejeitado, sem criar nada. Os dois
// marcam o pacote enviado como revisado (não apaga - fica o
// histórico de quem revisou e quando).
// ==================================================================

import { corsHeaders, withAdminAuth, logAdminAction } from "../_shared/adminAuth.ts";

function zipAnswers(answersPt: string[], answersEn: string[]): { pt: string; en: string }[] {
    return answersPt.map((pt, i) => ({ pt, en: answersEn[i] ?? pt }));
}

Deno.serve(withAdminAuth(async (req, { adminClient, adminId }) => {

    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Use POST" }), {
            status: 405,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const body = await req.json().catch(() => null);
    const packId = body?.packId;
    const action = body?.action;

    if (typeof packId !== "string" || (action !== "approve" && action !== "reject")) {
        return new Response(
            JSON.stringify({ error: 'Body precisa de { packId: string, action: "approve" | "reject" }' }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    const { data: submittedPack, error: fetchError } = await adminClient
        .from("submitted_packs")
        .select("id, slug, name_pt, name_en, questions, status")
        .eq("id", packId)
        .maybeSingle();

    if (fetchError || !submittedPack) {
        return new Response(JSON.stringify({ error: "Pacote enviado não encontrado" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    if (submittedPack.status !== "pending") {
        return new Response(JSON.stringify({ error: "Esse pacote já foi revisado antes" }), {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    if (action === "reject") {
        await adminClient
            .from("submitted_packs")
            .update({ status: "rejected", reviewed_by: adminId, reviewed_at: new Date().toISOString() })
            .eq("id", packId);

        await logAdminAction(adminClient, adminId, "reject_submitted_pack", null, { packId, slug: submittedPack.slug });

        return new Response(JSON.stringify({ success: true, action: "rejected" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    // action === "approve" - cria o question_packs de verdade e cada
    // pergunta individual.
    const { data: newPack, error: packInsertError } = await adminClient
        .from("question_packs")
        .insert({
            slug: submittedPack.slug,
            name_pt: submittedPack.name_pt,
            name_en: submittedPack.name_en,
            tier: "official",
            applicable_games: ["time_attack", "show_down"],
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

    const questionsPayload: Array<{
        pack_id: string;
        difficulty: string;
        question_pt: string;
        question_en: string;
        options: { pt: string; en: string }[];
        correct_index: number;
    }> = [];

    const questionsByDifficulty = submittedPack.questions || {};
    for (const difficulty of ["easy", "medium", "hard"]) {
        const list = questionsByDifficulty[difficulty] || [];
        for (const q of list) {
            questionsPayload.push({
                pack_id: newPack.id,
                difficulty,
                question_pt: q.question?.pt || "",
                question_en: q.question?.en || "",
                options: zipAnswers(q.answers?.pt || [], q.answers?.en || []),
                correct_index: Number(q.correct) || 0,
            });
        }
    }

    let questionsCreated = 0;
    if (questionsPayload.length > 0) {
        const { error: questionsInsertError, count } = await adminClient
            .from("questions")
            .insert(questionsPayload, { count: "exact" });

        if (questionsInsertError) {
            console.error("Erro ao criar perguntas a partir do envio:", questionsInsertError);
            // O pacote já foi criado - não desfaz, só avisa que as
            // perguntas não entraram, pra revisão manual depois.
            return new Response(
                JSON.stringify({ error: "Pacote criado, mas erro ao criar as perguntas - revise manualmente" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
        }
        questionsCreated = count || questionsPayload.length;
    }

    await adminClient
        .from("submitted_packs")
        .update({ status: "approved", reviewed_by: adminId, reviewed_at: new Date().toISOString() })
        .eq("id", packId);

    await logAdminAction(adminClient, adminId, "approve_submitted_pack", null, {
        packId,
        slug: submittedPack.slug,
        newPackId: newPack.id,
        questionsCreated,
    });

    return new Response(
        JSON.stringify({ success: true, action: "approved", questionsCreated }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

}));
