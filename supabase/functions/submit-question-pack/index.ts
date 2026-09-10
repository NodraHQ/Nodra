// ==================================================================
// submit-question-pack
//
// Body: { namePt, nameEn, submitterName, submitterEmail, questions,
//         slug }
//
// Moveu de insert direto do cliente pra cá - o limite diário só faz
// sentido se for aplicado aqui, contra uma identidade que a pessoa
// não escolhe (IP pra quem não tá logado, user_id de verdade pra
// quem tá). Sem isso, "1 por dia pra anônimo" seria só decorativo -
// bastava reenviar o formulário.
//
// Reportado ao vivo: "um limite pra contas sem login 1 por dia, um
// pra com login 5 por dia e um pra vip 10 por dia".
// ==================================================================

import { createClient } from "jsr:@supabase/supabase-js@2";

export const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAILY_LIMIT_ANONYMOUS = 1;
const DAILY_LIMIT_LOGGED_IN = 5;
const DAILY_LIMIT_VIP = 10;

function getClientIp(req: Request): string {
    // x-forwarded-for pode vir com uma lista "cliente, proxy1,
    // proxy2" - o primeiro da lista é o IP de origem de verdade.
    const forwarded = req.headers.get("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0].trim();
    return req.headers.get("cf-connecting-ip") || "unknown";
}

function jsonError(message: string, status: number): Response {
    return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}

Deno.serve(async (req) => {

    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== "POST") {
        return jsonError("Use POST", 405);
    }

    try {

        const serviceClient = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );

        // Login é opcional aqui - qualquer um pode enviar pacote,
        // login só muda QUAL limite se aplica. Mesmo espírito do
        // getOptionalCallerId usado nas functions de jogo, mas
        // também precisa saber se é VIP, então faz a checagem
        // completa aqui mesmo em vez de importar.
        let callerId: string | null = null;
        let isVip = false;
        let callerUsername: string | null = null;
        let callerEmail: string | null = null;

        const authHeader = req.headers.get("Authorization");
        if (authHeader) {
            const callerClient = createClient(
                Deno.env.get("SUPABASE_URL")!,
                Deno.env.get("SUPABASE_ANON_KEY")!,
                { global: { headers: { Authorization: authHeader } } },
            );
            const { data: { user } } = await callerClient.auth.getUser();
            if (user) {
                callerId = user.id;
                callerEmail = user.email ?? null;
                const { data: profile } = await serviceClient
                    .from("profiles")
                    .select("is_vip, username")
                    .eq("id", user.id)
                    .maybeSingle();
                isVip = !!profile?.is_vip;
                callerUsername = profile?.username ?? null;
            }
        }

        const ip = getClientIp(req);
        const dailyLimit = isVip ? DAILY_LIMIT_VIP : callerId ? DAILY_LIMIT_LOGGED_IN : DAILY_LIMIT_ANONYMOUS;

        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        // Identidade pra contar: user_id de verdade se logado, IP se
        // não. Nunca os dois juntos - uma pessoa logada trocando de
        // rede não deveria ser penalizada pelo IP, e várias pessoas
        // anônimas atrás do mesmo IP (rede de escritório, faculdade)
        // compartilham a cota entre si, é a limitação inerente de
        // identificar por IP - aceitável pro nível de proteção que
        // isso precisa ter.
        let countQuery = serviceClient
            .from("pack_submission_log")
            .select("id", { count: "exact", head: true })
            .gte("submitted_at", since);

        countQuery = callerId ? countQuery.eq("user_id", callerId) : countQuery.eq("ip_address", ip);

        const { count, error: countError } = await countQuery;

        if (countError) {
            console.error("Erro ao contar envios recentes:", countError);
            return jsonError("Erro ao conferir o limite", 500);
        }

        if ((count ?? 0) >= dailyLimit) {
            return jsonError(
                `Limite de ${dailyLimit} pacote(s) por dia atingido. Tenta de novo amanhã.`,
                429,
            );
        }

        const body = await req.json().catch(() => null);
        if (!body) return jsonError("Corpo inválido", 400);

        const { namePt, nameEn, submitterName, submitterEmail, questions, slug } = body;

        if (!namePt && !nameEn) {
            return jsonError("Nome do pacote é obrigatório em pelo menos um idioma", 400);
        }
        if (typeof submitterName !== "string" || !submitterName.trim()) {
            return jsonError("submitterName é obrigatório", 400);
        }
        if (typeof submitterEmail !== "string" || !submitterEmail.trim()) {
            return jsonError("submitterEmail é obrigatório", 400);
        }
        if (!questions || typeof questions !== "object") {
            return jsonError("questions é obrigatório", 400);
        }

        const { error: insertError } = await serviceClient.from("submitted_packs").insert({
            slug,
            name_pt: namePt || nameEn,
            name_en: nameEn || namePt,
            // Nome/email de quem enviou - se estava logado, usa o
            // dado real da conta (ignora o que veio no corpo da
            // requisição), não confia em texto livre pra isso. Bate
            // com o campo travado (readOnly) no formulário, mas a
            // trava de verdade é aqui, não no HTML - reportado ao
            // vivo: "deveria ser fixo o do login já".
            submitter_name: callerUsername || submitterName,
            submitter_email: callerEmail || submitterEmail,
            questions,
            submitted_by_user_id: callerId,
        });

        if (insertError) {
            console.error("Erro ao gravar pacote enviado:", insertError);
            return jsonError("Erro ao enviar o pacote", 500);
        }

        // Grava o registro DEPOIS do insert principal ter dado certo -
        // se o pacote não foi salvo, não faz sentido gastar cota de
        // limite por uma tentativa que não vingou.
        await serviceClient.from("pack_submission_log").insert({
            ip_address: ip,
            user_id: callerId,
        });

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err) {
        console.error("Erro inesperado em submit-question-pack:", err);
        return jsonError("Erro interno", 500);
    }

});
