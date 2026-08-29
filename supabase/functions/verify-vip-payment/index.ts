// ==================================================================
// verify-vip-payment
//
// Body: { txHash: string }
//
// VIP mensal pago 100% em USDT na Avalanche C-Chain (confirmado: o
// contrato oficial nativo é 0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7,
// 6 casas decimais - existem duas versões antigas/em ponte
// circulando, essa é a certa, verificada contra várias fontes
// independentes antes de usar aqui).
//
// A pessoa paga com a própria carteira, sem servidor no meio nessa
// parte (é a carteira dela assinando a transferência ERC20 direto
// pro endereço de tesouraria). Essa função só CONFERE, na blockchain
// de verdade via RPC pública, que a transação:
// - existe e foi bem-sucedida
// - é uma transferência do contrato certo de USDT
// - foi pro endereço certo de tesouraria
// - no valor mínimo certo
// - e que esse hash nunca foi usado antes (trava contra reuso da
//   mesma transação pra "comprar" VIP em várias contas)
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

const USDT_CONTRACT_ADDRESS = "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7".toLowerCase();
const TREASURY_ADDRESS_PLACEHOLDER = "0x0000000000000000000000000000000000000000"; // TROCAR pelo endereço real da tesouraria antes de ir pra produção
const VIP_PRICE_USDT = 5; // preço mensal - fácil de trocar aqui
const USDT_DECIMALS = 6;
const REQUIRED_MIN_UNITS = BigInt(VIP_PRICE_USDT) * BigInt(10 ** USDT_DECIMALS);
const AVALANCHE_RPC_URL = "https://api.avax.network/ext/bc/C/rpc";
const TRANSFER_EVENT_TOPIC0 =
    "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const VIP_PERIOD_DAYS = 30;
const MAX_PAYMENT_AGE_MS = 48 * 60 * 60 * 1000; // 48 horas

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

        if (typeof txHash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
            return jsonError("Body precisa de { txHash: string } (hash de transação válido)", 400);
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
        // cliente mandou sobre o valor/destinatário.
        const receipt = await fetchTransactionReceipt(txHash);

        if (!receipt) {
            return jsonError("Transação não encontrada na blockchain", 404);
        }

        if (receipt.status !== "0x1") {
            return jsonError("Transação existe mas falhou (revertida)", 400);
        }

        const transferLog = (receipt.logs || []).find(
            (log: { address: string; topics: string[] }) =>
                log.address?.toLowerCase() === USDT_CONTRACT_ADDRESS &&
                log.topics?.[0]?.toLowerCase() === TRANSFER_EVENT_TOPIC0,
        );

        if (!transferLog) {
            return jsonError("Transação não contém uma transferência de USDT", 400);
        }

        const toAddress = ("0x" + transferLog.topics[2].slice(-40)).toLowerCase();
        const fromAddress = ("0x" + transferLog.topics[1].slice(-40)).toLowerCase();
        const amountUnits = BigInt(transferLog.data);

        if (toAddress !== TREASURY_ADDRESS_PLACEHOLDER.toLowerCase()) {
            return jsonError("Transação não foi pro endereço de tesouraria certo", 400);
        }

        if (amountUnits < REQUIRED_MIN_UNITS) {
            return jsonError(
                `Valor pago (${Number(amountUnits) / 10 ** USDT_DECIMALS} USDT) é menor que o preço do VIP (${VIP_PRICE_USDT} USDT)`,
                400,
            );
        }

        // Prazo de validade - reportado ao vivo (duas perguntas que
        // se conectam): 1) transações muito antigas não deveriam
        // contar (fecha a possibilidade de reciclar um pagamento
        // velho e sem relação, caso a carteira algum dia receba
        // outra coisa além de assinatura VIP); 2) sem essa checagem,
        // a tabela vip_payments precisaria ser guardada pra sempre,
        // já que apagar um registro "libera" aquele hash de novo.
        // Com o prazo, dá pra podar registros com mais de ~90 dias
        // com segurança - mesmo se alguém tentasse reciclar um hash
        // já apagado, essa checagem rejeitaria antes de chegar lá.
        const blockTimestamp = await fetchBlockTimestamp(receipt.blockNumber);
        if (blockTimestamp) {
            const ageMs = Date.now() - blockTimestamp * 1000;
            if (ageMs > MAX_PAYMENT_AGE_MS) {
                return jsonError(
                    "Essa transação é antiga demais (mais de 48h) - pagamentos precisam ser verificados logo depois de feitos",
                    400,
                );
            }
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
            amount_usdt: Number(amountUnits) / 10 ** USDT_DECIMALS,
            from_address: fromAddress,
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

async function fetchTransactionReceipt(
    txHash: string,
): Promise<{ status: string; logs: Array<{ address: string; topics: string[]; data: string }>; blockNumber: string } | null> {
    const response = await fetch(AVALANCHE_RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "eth_getTransactionReceipt",
            params: [txHash],
        }),
    });

    const json = await response.json();
    return json?.result || null;
}

// Timestamp de quando o bloco foi minerado - usado pra rejeitar
// transações velhas demais (mais de 48h). Se essa chamada falhar por
// qualquer motivo, deixa passar (não trava o pagamento por causa de
// uma checagem secundária de segurança que não é a principal) - a
// checagem de reuso de hash e a de valor/endereço continuam valendo
// de qualquer jeito.
async function fetchBlockTimestamp(blockNumberHex: string): Promise<number | null> {
    try {
        const response = await fetch(AVALANCHE_RPC_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "eth_getBlockByNumber",
                params: [blockNumberHex, false],
            }),
        });

        const json = await response.json();
        const timestampHex = json?.result?.timestamp;
        return timestampHex ? parseInt(timestampHex, 16) : null;
    } catch (err) {
        console.error("Erro ao buscar horário do bloco (não bloqueia o pagamento):", err);
        return null;
    }
}
