// ==================================================================
// admin-grant-pack
//
// Body: { target_user_id, games: string[], name: string, questions: array }
//
// Mesma ideia de admin-grant-theme: em vez do VIP criar o próprio
// pacote de perguntas, admin cria um e concede direto pra conta de
// outra pessoa, como se ela mesma tivesse criado. Espelha
// vip-create-saved-pack (mesmo teto por tier, mesma tabela), trocando
// só quem autentica (admin em vez do dono) e de quem é o owner_id
// (o alvo escolhido, não quem está logado).
// ==================================================================

import { corsHeaders, withAdminAuth, logAdminAction } from "../_shared/adminAuth.ts";

const PACK_LIMITS_BY_TIER: Record<string, number> = {
    bronze: 5,
    prata: 20,
    gold: 999,
};

Deno.serve(withAdminAuth(async (req, { adminClient, adminId }) => {

    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Use POST" }), {
            status: 405,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const body = await req.json().catch(() => null);
    const targetUserId = body?.target_user_id;
    const games = body?.games;
    const name = body?.name;
    const questions = body?.questions;

    if (typeof targetUserId !== "string" || !targetUserId) {
        return new Response(JSON.stringify({ error: "target_user_id é obrigatório" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
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

    const { data: targetProfile, error: profileError } = await adminClient
        .from("profiles")
        .select("vip_tier, is_vip, username")
        .eq("id", targetUserId)
        .maybeSingle();

    if (profileError || !targetProfile) {
        return new Response(JSON.stringify({ error: "Conta de destino não encontrada" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    // Pacote salvo é benefício de VIP, igual tema - mesma trava:
    // conceder pra conta que não é VIP não teria "Meus Pacotes" pra
    // aparecer. Primeiro concede VIP, depois o pacote.
    if (!targetProfile.is_vip) {
        return new Response(
            JSON.stringify({ error: "Essa conta não é VIP - conceda VIP primeiro (aba Usuários) antes de criar um pacote pra ela" }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    const maxPacks = PACK_LIMITS_BY_TIER[targetProfile.vip_tier ?? ""] ?? PACK_LIMITS_BY_TIER.bronze;

    // Mesma regra do vip-create-saved-pack: teto TOTAL de pacotes
    // vivos, não por ciclo - "como se ele tivesse criado" inclui
    // valer a mesma cota dele.
    const { count, error: countError } = await adminClient
        .from("vip_saved_packs")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", targetUserId);

    if (countError) {
        console.error("admin-grant-pack: erro ao contar pacotes salvos", countError);
        return new Response(JSON.stringify({ error: "Erro ao conferir o limite" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    if ((count ?? 0) >= maxPacks) {
        return new Response(
            JSON.stringify({ error: `Essa conta já está no limite de ${maxPacks} pacotes salvos - apague um antigo dela ou faça upgrade de tier antes` }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    const { data: newPack, error: insertError } = await adminClient
        .from("vip_saved_packs")
        .insert({ owner_id: targetUserId, games, name: name.trim(), questions })
        .select("id")
        .single();

    if (insertError || !newPack) {
        console.error("admin-grant-pack: erro ao criar pacote", insertError);
        return new Response(JSON.stringify({ error: "Erro ao criar o pacote" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    await logAdminAction(adminClient, adminId, "grant_pack", targetUserId, {
        packId: newPack.id,
        name: name.trim(),
        targetUsername: targetProfile.username,
    });

    return new Response(JSON.stringify({ success: true, packId: newPack.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

}));
