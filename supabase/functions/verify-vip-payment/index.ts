// ==================================================================
// verify-vip-payment
//
// Body: { txHash: string, network: "avalanche" | "base" | "solana",
//         token: "USDT" | "USDC" }
//
// VIP mensal pago em stablecoin, em mais de uma rede agora -
// reportado ao vivo: "tem como adicionar mais redes?". A verificação
// em si (existe, foi bem-sucedida, é do token certo, foi pro
// endereço certo, no valor certo, hash nunca usado antes) é toda
// resolvida pelo módulo compartilhado (ver
// _shared/paymentVerification.ts) - esse arquivo só cuida da parte
// que é específica de VIP (estender vip_expires_at).
//
// A pessoa paga com a própria carteira, sem servidor no meio nessa
// parte. Essa função só CONFERE, na blockchain de verdade via RPC
// pública.
//
// Decisão consciente, confirmada com o time: não exige que quem
// pagou seja o dono da carteira conectada no perfil - "pagar paga
// como quiser". Isso significa que, em teoria, alguém observando os
// pagamentos recebidos (é tudo público) poderia tentar reivindicar
// o pagamento de outra pessoa antes dela. Pra um produto de valor
// baixo isso é aceitável, mas documentado aqui pra quem mexer nisso
// depois entender o trade-off.
// ==================================================================

import { corsHeaders } from "../_shared/vipAuth.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { isSupportedNetworkToken, verifyStablecoinPayment } from "../_shared/paymentVerification.ts";

const VIP_PRICE_USDT = 5; // preço mensal - fácil de trocar aqui (mesmo valor em qualquer rede/token aceito)
const VIP_PERIOD_DAYS = 30;

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Use POST" }), {
            status: 405,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    try {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return jsonError("Not signed in", 401);
        }

        const callerClient = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_ANON_KEY")!,
            { global: { headers: { Authorization: authHeader } } },
        );

        const {
            data: { user },
            error: userError,
        } = await callerClient.auth.getUser();

        if (userError || !user) {
            return jsonError("Not signed in", 401);
        }

        const body = await req.json().catch(() => null);
        const txHash = body?.txHash;
        const network = body?.network;
        const token = body?.token;

        if (typeof txHash !== "string") {
            return jsonError("Body precisa de { txHash, network, token }", 400);
        }
        if (typeof network !== "string" || typeof token !== "string" || !isSupportedNetworkToken(network, token)) {
            return jsonError("Rede/token não aceito", 400);
        }

        const serviceClient = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );

        // Trava contra reuso - a MESMA transação não pode "comprar"
        // VIP duas vezes, nem pra contas diferentes.
        const { data: existingPayment } = await serviceClient
            .from("vip_payments")
            .select("id")
            .eq("tx_hash", txHash)
            .maybeSingle();

        if (existingPayment) {
            return jsonError("Essa transação já foi usada antes", 409);
        }

        // Consulta a blockchain de verdade, não confia em nada que o
        // cliente mandou sobre o valor/destinatário - ver
        // _shared/paymentVerification.ts pros detalhes de cada rede.
        const result = await verifyStablecoinPayment(network, token, txHash, VIP_PRICE_USDT);

        if (!result.ok) {
            return jsonError(result.error || "Pagamento não pôde ser confirmado", 400);
        }

        // Estende a partir de agora, ou a partir do vencimento atual
        // se ainda não venceu - pagar adiantado não perde tempo.
        const { data: profile } = await serviceClient
            .from("profiles")
            .select("vip_expires_at")
            .eq("id", user.id)
            .maybeSingle();

        const currentExpiry = profile?.vip_expires_at ? new Date(profile.vip_expires_at) : null;
        const baseDate = currentExpiry && currentExpiry > new Date() ? currentExpiry : new Date();
        const newExpiry = new Date(baseDate.getTime() + VIP_PERIOD_DAYS * 24 * 60 * 60 * 1000);

        const { error: insertError } = await serviceClient.from("vip_payments").insert({
            user_id: user.id,
            tx_hash: txHash,
            network,
            token,
            amount_usdt: result.amount,
            from_address: result.fromAddress,
            vip_extended_until: newExpiry.toISOString(),
        });

        if (insertError) {
            console.error("Erro ao gravar pagamento de VIP:", insertError);
            return jsonError("Erro ao gravar o pagamento", 500);
        }

        const { error: updateError } = await serviceClient
            .from("profiles")
            .update({ is_vip: true, vip_expires_at: newExpiry.toISOString() })
            .eq("id", user.id);

        if (updateError) {
            console.error("Erro ao atualizar VIP do perfil:", updateError);
            return jsonError("Pagamento registrado, mas erro ao ativar o VIP - contate o suporte", 500);
        }

        return new Response(
            JSON.stringify({ success: true, vipExpiresAt: newExpiry.toISOString() }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    } catch (err) {
        console.error("Erro inesperado ao verificar pagamento de VIP:", err);
        return jsonError("Erro interno", 500);
    }
});

function jsonError(message: string, status: number): Response {
    return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}
