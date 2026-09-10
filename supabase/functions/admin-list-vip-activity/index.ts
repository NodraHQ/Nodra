// ==================================================================
// admin-list-vip-activity
//
// GET, sem body. Devolve dois históricos pro painel de admin:
// - activations: toda ativação de VIP, seja por pagamento ou por
//   código resgatado, misturadas numa lista só, ordenadas por data
// - codes: todo código já gerado, quem resgatou (se alguém), e
//   quais ainda estão livres
// ==================================================================

import { corsHeaders, withAdminAuth } from "../_shared/adminAuth.ts";

Deno.serve(withAdminAuth(async (_req, { adminClient }) => {

    const [paymentsResult, redemptionsResult, codesResult, themePaymentsResult] = await Promise.all([
        adminClient
            .from("vip_payments")
            .select("user_id, amount_usdt, network, verified_at, tx_hash, tier")
            .order("verified_at", { ascending: false }),
        adminClient
            .from("vip_invite_redemptions")
            .select("user_id, code_id, redeemed_at")
            .order("redeemed_at", { ascending: false }),
        adminClient
            .from("vip_invite_codes")
            .select("id, code, max_uses, uses_count, vip_days, tier, expires_at, note, created_at, paused")
            .order("created_at", { ascending: false }),
        // Pagamento de submissão de tema - reportado ao vivo: "o
        // pagamento pelo tema público não aparece" em lugar nenhum
        // do admin. Junta na mesma lista de atividade, com um
        // método próprio pra distinguir de ativação de VIP.
        adminClient
            .from("theme_submission_payments")
            .select("theme_id, user_id, amount_usdt, network, created_at, tx_hash")
            .order("created_at", { ascending: false }),
    ]);

    if (paymentsResult.error || redemptionsResult.error || codesResult.error || themePaymentsResult.error) {
        console.error(
            "Erro ao carregar atividade de VIP:",
            paymentsResult.error || redemptionsResult.error || codesResult.error || themePaymentsResult.error,
        );
        return new Response(JSON.stringify({ error: "Erro ao carregar dados" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const payments = paymentsResult.data || [];
    const redemptions = redemptionsResult.data || [];
    const codes = codesResult.data || [];
    const themePayments = themePaymentsResult.data || [];

    // Tema só precisa aqui pra pegar o NOME (exibição) - quem pagou
    // já vem direto na própria linha de theme_submission_payments
    // (user_id), não precisa passar pelo dono do tema.
    const themeIds = [...new Set(themePayments.map((tp) => tp.theme_id))];
    const { data: themeRows } = await adminClient
        .from("custom_themes")
        .select("id, name")
        .in("id", themeIds.length > 0 ? themeIds : ["00000000-0000-0000-0000-000000000000"]);
    const themeNameById = new Map((themeRows || []).map((t) => [t.id, t.name]));

    // Busca username de todo user_id envolvido (pagamentos + resgates
    // + pagamentos de tema) numa passada só, em vez de uma consulta
    // por linha.
    const userIds = [
        ...new Set([
            ...payments.map((p) => p.user_id),
            ...redemptions.map((r) => r.user_id),
            ...themePayments.map((tp) => tp.user_id),
        ]),
    ];

    const { data: profiles } = await adminClient
        .from("profiles")
        .select("id, username")
        .in("id", userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"]);

    const usernameById = new Map((profiles || []).map((p) => [p.id, p.username]));
    const codeById = new Map(codes.map((c) => [c.id, c.code]));
    const tierByCodeId = new Map(codes.map((c) => [c.id, c.tier || "bronze"]));

    const activations = [
        ...payments.map((p) => ({
            username: usernameById.get(p.user_id) || p.user_id,
            date: p.verified_at,
            method: "payment",
            detail: `${p.amount_usdt} USDT`,
            txHash: p.tx_hash,
            network: p.network,
            tier: p.tier || null,
        })),
        ...redemptions.map((r) => ({
            username: usernameById.get(r.user_id) || r.user_id,
            date: r.redeemed_at,
            method: "code",
            detail: codeById.get(r.code_id) || r.code_id,
            txHash: null,
            network: null,
            // Usa o tier de verdade do código, não mais fixo em
            // Bronze - reportado ao vivo: "na tela vip codes, eu não
            // tenho como diferenciar cada tipo de vip que eu dê".
            tier: tierByCodeId.get(r.code_id) || "bronze",
        })),
        ...themePayments.map((tp) => ({
            username: usernameById.get(tp.user_id) || tp.user_id,
            date: tp.created_at,
            method: "theme_payment",
            detail: `${themeNameById.get(tp.theme_id) || tp.theme_id} - $${tp.amount_usdt}`,
            txHash: tp.tx_hash,
            network: tp.network,
            // Pagamento de tema não tem tier - não é ativação de VIP.
            tier: null,
        })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const codesWithHolders = codes.map((c) => ({
        id: c.id,
        code: c.code,
        maxUses: c.max_uses,
        usesCount: c.uses_count,
        vipDays: c.vip_days,
        tier: c.tier || "bronze",
        expiresAt: c.expires_at,
        note: c.note,
        createdAt: c.created_at,
        paused: c.paused,
        redeemedBy: redemptions
            .filter((r) => r.code_id === c.id)
            .map((r) => usernameById.get(r.user_id) || r.user_id),
    }));

    return new Response(JSON.stringify({ activations, codes: codesWithHolders }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

}));
