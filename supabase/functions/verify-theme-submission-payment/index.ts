// ==================================================================
// verify-theme-submission-payment
//
// Body: { themeId: string, txHash: string, network: "avalanche" |
//         "base" | "solana", token: "USDT" | "USDC" }
//
// Mesmo padrão de sempre (mesma trava contra reuso de hash, mesmo
// prazo de 48h) - só que agora aceita mais de uma rede/token, todos
// resolvidos pelo mesmo módulo compartilhado (ver
// _shared/paymentVerification.ts, que sabe lidar com EVM e Solana).
// Em vez de estender vip_expires_at (como verify-vip-payment faz),
// isso move um tema privado do próprio VIP pra fila de revisão do
// admin (status: pending_review). Preço fixo de submissão, separado
// do preço de VIP - ver THEME_SUBMISSION_PRICE_USDT abaixo (o preço é
// o mesmo valor em qualquer rede/token aceito, já que USDT e USDC são
// ambos pareados a 1 dólar).
//
// payment_confirmed fica marcado true pra sempre nesse tema, mesmo
// que seja rejeitado depois - é o que permite reenviar de graça (ver
// vip-resubmit-theme) sem pagar de novo a cada correção.
// ==================================================================

import { corsHeaders } from "../_shared/vipAuth.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { isSupportedNetworkToken, verifyStablecoinPayment } from "../_shared/paymentVerification.ts";

const THEME_SUBMISSION_PRICE_USDT = 10; // fácil de trocar aqui

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== "POST") {
        return jsonError("Use POST", 405);
    }

    try {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) return jsonError("Not signed in", 401);

        const callerClient = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_ANON_KEY")!,
            { global: { headers: { Authorization: authHeader } } },
        );

        const { data: { user }, error: userError } = await callerClient.auth.getUser();
        if (userError || !user) return jsonError("Not signed in", 401);

        const body = await req.json().catch(() => null);
        const themeId = body?.themeId;
        const txHash = body?.txHash;
        const network = body?.network;
        const token = body?.token;

        if (typeof themeId !== "string" || typeof txHash !== "string") {
            return jsonError("Body precisa de { themeId, txHash, network, token }", 400);
        }
        if (typeof network !== "string" || typeof token !== "string" || !isSupportedNetworkToken(network, token)) {
            return jsonError("Rede/token não aceito", 400);
        }

        const serviceClient = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );

        // O tema precisa existir, ser dessa pessoa, e estar no estado
        // certo pra ser submetido (privado - já rejeitado ou já
        // público não passa por aqui, tem os próprios caminhos).
        const { data: theme, error: themeError } = await serviceClient
            .from("custom_themes")
            .select("id, owner_id, status")
            .eq("id", themeId)
            .maybeSingle();

        if (themeError || !theme) return jsonError("Tema não encontrado", 404);
        if (theme.owner_id !== user.id) return jsonError("Esse tema não é seu", 403);
        if (theme.status !== "private") {
            return jsonError(`Esse tema já está em "${theme.status}", não dá pra submeter de novo por aqui`, 409);
        }

        // Trava contra reuso - a MESMA transação não pode submeter
        // dois temas, nem em contas diferentes, nem se a pessoa
        // tentar de novo dizendo que é de outra rede.
        const { data: existingPayment } = await serviceClient
            .from("theme_submission_payments")
            .select("id")
            .eq("tx_hash", txHash)
            .maybeSingle();

        if (existingPayment) return jsonError("Essa transação já foi usada antes", 409);

        const result = await verifyStablecoinPayment(network, token, txHash, THEME_SUBMISSION_PRICE_USDT);

        if (!result.ok) {
            return jsonError(result.error || "Pagamento não pôde ser confirmado", 400);
        }

        const { error: paymentInsertError } = await serviceClient.from("theme_submission_payments").insert({
            theme_id: themeId,
            user_id: user.id,
            tx_hash: txHash,
            network,
            token,
            amount_usdt: result.amount,
            from_address: result.fromAddress,
        });

        if (paymentInsertError) {
            console.error("Erro ao gravar pagamento de submissão de tema:", paymentInsertError);
            return jsonError("Erro ao gravar o pagamento", 500);
        }

        const { error: updateError } = await serviceClient
            .from("custom_themes")
            .update({ status: "pending_review", payment_confirmed: true, tx_hash: txHash })
            .eq("id", themeId);

        if (updateError) {
            console.error("Erro ao mover tema pra revisão:", updateError);
            return jsonError("Pagamento registrado, mas erro ao enviar pra revisão - contate o suporte", 500);
        }

        return new Response(
            JSON.stringify({ success: true, status: "pending_review" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    } catch (err) {
        console.error("Erro inesperado ao verificar pagamento de submissão de tema:", err);
        return jsonError("Erro interno", 500);
    }
});

function jsonError(message: string, status: number): Response {
    return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}
