// ==================================================================
// _shared/paymentVerification.ts
//
// Verificação de pagamento em stablecoin, com suporte a mais de uma
// rede - reportado ao vivo: "tem como adicionar mais redes?". Hoje:
// Avalanche C-Chain (USDT), Base (só USDC - o USDT lá é uma versão
// em ponte, não emitida pela Tether, decisão consciente de não
// aceitar), Solana (USDC e USDT, os dois oficiais).
//
// EVM (Avalanche, Base) e Solana são fundamentalmente diferentes por
// baixo - EVM tem "logs de evento" (Transfer), Solana não tem esse
// conceito, a forma padrão de detectar uma transferência de token é
// comparar o saldo da conta antes/depois da transação
// (preTokenBalances/postTokenBalances). Por isso os dois caminhos
// são funções separadas aqui, não uma tentando servir os dois.
//
// TROCAR antes de produção: os dois endereços de tesouraria abaixo
// (EVM_TREASURY_ADDRESS, SOLANA_TREASURY_ADDRESS) são placeholders.
// Uma carteira EVM comum (não multisig) recebe em qualquer rede EVM
// com o MESMO endereço - por isso só existe UM endereço EVM aqui,
// reaproveitado pra Avalanche e Base. Solana usa outro formato de
// endereço inteiramente, precisa do seu próprio.
// ==================================================================

export type NetworkId = "avalanche" | "base" | "solana";
export type TokenSymbol = "USDT" | "USDC";

const EVM_TREASURY_ADDRESS = "0x0000000000000000000000000000000000000000"; // TROCAR - mesmo endereço vale pra Avalanche e Base
const SOLANA_TREASURY_ADDRESS = "REPLACE_WITH_SOLANA_TREASURY_ADDRESS"; // TROCAR - formato de endereço diferente, não é o mesmo da EVM

interface EvmTokenConfig {
    kind: "evm";
    rpcUrl: string;
    treasuryAddress: string;
    contractAddress: string;
    decimals: number;
}

interface SolanaTokenConfig {
    kind: "solana";
    rpcUrl: string;
    treasuryAddress: string;
    mintAddress: string;
    decimals: number;
}

type TokenConfig = EvmTokenConfig | SolanaTokenConfig;

// Endereços de contrato/mint confirmados via busca em 02/09/2026 -
// ver conversa. USDC na Base é emitido nativamente pela Circle. USDT
// na Solana é emitido oficialmente pela Tether. Não existe entrada
// "base:USDT" de propósito (só a versão em ponte existe lá, decisão
// de não aceitar - ver comentário no topo do arquivo).
const NETWORK_TOKEN_CONFIG: Record<string, TokenConfig> = {
    "avalanche:USDT": {
        kind: "evm",
        rpcUrl: "https://api.avax.network/ext/bc/C/rpc",
        treasuryAddress: EVM_TREASURY_ADDRESS,
        contractAddress: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7",
        decimals: 6,
    },
    "base:USDC": {
        kind: "evm",
        rpcUrl: "https://mainnet.base.org",
        treasuryAddress: EVM_TREASURY_ADDRESS,
        contractAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        decimals: 6,
    },
    "solana:USDC": {
        kind: "solana",
        rpcUrl: "https://api.mainnet-beta.solana.com",
        treasuryAddress: SOLANA_TREASURY_ADDRESS,
        mintAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        decimals: 6,
    },
    "solana:USDT": {
        kind: "solana",
        rpcUrl: "https://api.mainnet-beta.solana.com",
        treasuryAddress: SOLANA_TREASURY_ADDRESS,
        mintAddress: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
        decimals: 6,
    },
};

const TRANSFER_EVENT_TOPIC0 = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const MAX_PAYMENT_AGE_MS = 48 * 60 * 60 * 1000; // 48 horas, mesma regra em qualquer rede

export interface VerifyResult {
    ok: boolean;
    error?: string;
    amount?: number;
    fromAddress?: string;
}

export function isSupportedNetworkToken(network: string, token: string): boolean {
    return `${network}:${token}` in NETWORK_TOKEN_CONFIG;
}

export async function verifyStablecoinPayment(
    network: NetworkId,
    token: TokenSymbol,
    txHash: string,
    minAmount: number,
): Promise<VerifyResult> {

    const config = NETWORK_TOKEN_CONFIG[`${network}:${token}`];
    if (!config) {
        return { ok: false, error: `Combinação ${network}/${token} não é aceita` };
    }

    try {
        if (config.kind === "evm") {
            return await verifyEvmPayment(config, txHash, minAmount);
        }
        return await verifySolanaPayment(config, txHash, minAmount);
    } catch (err) {
        console.error(`Erro ao verificar pagamento (${network}/${token}):`, err);
        return { ok: false, error: "Erro ao consultar a blockchain - tente de novo em instantes" };
    }
}

async function verifyEvmPayment(config: EvmTokenConfig, txHash: string, minAmount: number): Promise<VerifyResult> {

    if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
        return { ok: false, error: "txHash precisa ser um hash de transação válido" };
    }

    const receiptResponse = await fetch(config.rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionReceipt", params: [txHash] }),
    });
    const receiptJson = await receiptResponse.json();
    const receipt = receiptJson?.result;

    if (!receipt) return { ok: false, error: "Transação não encontrada na blockchain" };
    if (receipt.status !== "0x1") return { ok: false, error: "Transação existe mas falhou (revertida)" };

    const transferLog = (receipt.logs || []).find(
        (log: { address: string; topics: string[] }) =>
            log.address?.toLowerCase() === config.contractAddress.toLowerCase() &&
            log.topics?.[0]?.toLowerCase() === TRANSFER_EVENT_TOPIC0,
    );

    if (!transferLog) return { ok: false, error: "Transação não contém uma transferência do token esperado" };

    const toAddress = ("0x" + transferLog.topics[2].slice(-40)).toLowerCase();
    const fromAddress = ("0x" + transferLog.topics[1].slice(-40)).toLowerCase();
    const amountUnits = BigInt(transferLog.data);
    const requiredUnits = BigInt(Math.round(minAmount * 10 ** config.decimals));

    if (toAddress !== config.treasuryAddress.toLowerCase()) {
        return { ok: false, error: "Transação não foi pro endereço de tesouraria certo" };
    }
    if (amountUnits < requiredUnits) {
        return {
            ok: false,
            error: `Valor pago (${Number(amountUnits) / 10 ** config.decimals}) é menor que o esperado (${minAmount})`,
        };
    }

    const blockTimestamp = await fetchEvmBlockTimestamp(config.rpcUrl, receipt.blockNumber);
    if (blockTimestamp) {
        const ageMs = Date.now() - blockTimestamp * 1000;
        if (ageMs > MAX_PAYMENT_AGE_MS) {
            return { ok: false, error: "Essa transação é antiga demais (mais de 48h)" };
        }
    }

    return { ok: true, amount: Number(amountUnits) / 10 ** config.decimals, fromAddress };
}

async function fetchEvmBlockTimestamp(rpcUrl: string, blockNumberHex: string): Promise<number | null> {
    try {
        const response = await fetch(rpcUrl, {
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
        console.error("Erro ao buscar horário do bloco EVM (não bloqueia o pagamento):", err);
        return null;
    }
}

interface SolanaTokenBalance {
    mint: string;
    owner: string;
    uiTokenAmount: { amount: string };
}

async function verifySolanaPayment(config: SolanaTokenConfig, txHash: string, minAmount: number): Promise<VerifyResult> {

    // Solana usa assinatura de transação em base58 (letras e números,
    // sem o 0/O/I/l ambíguos), formato bem diferente do hash hex 0x
    // da EVM.
    if (!/^[1-9A-HJ-NP-Za-km-z]{64,100}$/.test(txHash)) {
        return { ok: false, error: "txHash precisa ser uma assinatura de transação Solana válida" };
    }

    const response = await fetch(config.rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "getTransaction",
            params: [txHash, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }],
        }),
    });
    const json = await response.json();
    const tx = json?.result;

    if (!tx) return { ok: false, error: "Transação não encontrada na blockchain" };
    if (tx.meta?.err) return { ok: false, error: "Transação existe mas falhou" };

    if (tx.blockTime) {
        const ageMs = Date.now() - tx.blockTime * 1000;
        if (ageMs > MAX_PAYMENT_AGE_MS) {
            return { ok: false, error: "Essa transação é antiga demais (mais de 48h)" };
        }
    }

    // Solana não tem "log de evento Transfer" igual EVM - o jeito
    // padrão de confirmar uma transferência de token é comparar o
    // saldo da conta de token antes/depois da transação
    // (preTokenBalances/postTokenBalances), pro mint e dono certos.
    const preBalances: SolanaTokenBalance[] = tx.meta?.preTokenBalances || [];
    const postBalances: SolanaTokenBalance[] = tx.meta?.postTokenBalances || [];

    const preEntry = preBalances.find((b) => b.mint === config.mintAddress && b.owner === config.treasuryAddress);
    const postEntry = postBalances.find((b) => b.mint === config.mintAddress && b.owner === config.treasuryAddress);

    if (!postEntry) {
        return { ok: false, error: "Transação não contém uma transferência do token esperado pra tesouraria" };
    }

    const preAmount = preEntry ? BigInt(preEntry.uiTokenAmount.amount) : BigInt(0);
    const postAmount = BigInt(postEntry.uiTokenAmount.amount);
    const receivedUnits = postAmount - preAmount;
    const requiredUnits = BigInt(Math.round(minAmount * 10 ** config.decimals));

    if (receivedUnits < requiredUnits) {
        return {
            ok: false,
            error: `Valor pago (${Number(receivedUnits) / 10 ** config.decimals}) é menor que o esperado (${minAmount})`,
        };
    }

    // Remetente - primeira conta que perdeu saldo desse mint. Só pra
    // registrar quem pagou, não é usado como trava de segurança (a
    // trava real é o hash não poder ser reutilizado, ver as tabelas
    // de pagamento que chamam essa função).
    const senderEntry = preBalances.find((b) => {
        if (b.mint !== config.mintAddress) return false;
        const post = postBalances.find((p) => p.mint === b.mint && p.owner === b.owner);
        const preAmt = BigInt(b.uiTokenAmount.amount);
        const postAmt = post ? BigInt(post.uiTokenAmount.amount) : BigInt(0);
        return postAmt < preAmt;
    });

    return {
        ok: true,
        amount: Number(receivedUnits) / 10 ** config.decimals,
        fromAddress: senderEntry?.owner || "unknown",
    };
}
