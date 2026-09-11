// ==================================================================
// academy-grant-module-badge
//
// Body: { module_slug: string }
//
// Concede a badge daquele módulo (se ainda não tiver) quando o quiz
// é concluído - reportado ao vivo: "ao concluir cada quiz em cada
// módulo o usuário receba uma badge". Sem login, não tem pra quem
// conceder - o próprio front trata esse caso antes de chamar (mostra
// aviso, não chama).
//
// Só 10 badges (uma por módulo) - o módulo 10 (Final Project) já é a
// conclusão em si, não existe uma badge especial separada de "10/10"
// (decisão revista ao vivo, tinha sido desenhado com uma 11ª antes).
//
// As badges são "do sistema" - sem dono humano (created_by null),
// identificadas por badges.academy_module_slug. Reaproveita a mesma
// tabela/mecânica que as badges criadas por VIP já usam
// (user_badges), então aparecem no perfil e nos jogos igual qualquer
// outra - só a origem é diferente.
// ==================================================================

import { corsHeaders, getServiceClient, getOptionalCallerId, isCallerAnonymous } from "../_shared/gameAuth.ts";

const MODULE_SLUGS = [
    "01-blockchain", "02-wallets", "03-networks", "04-assets", "05-defi",
    "06-lending", "07-yield", "08-stablecoins", "09-security", "10-final-project",
];

Deno.serve(async (req) => {

    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== "POST") {
        return jsonError("Use POST", 405);
    }

    const callerId = await getOptionalCallerId(req);
    if (!callerId) {
        return jsonError("Precisa estar logado pra ganhar a badge", 401);
    }

    // Bug real: sessão anônima (de quem jogou algum jogo do ndquest
    // antes de visitar a Academy no mesmo navegador) passava por aqui
    // como se fosse conta de verdade - getOptionalCallerId só olha se
    // existe id, não se é anônimo. A badge era concedida "de verdade"
    // numa conta descartável, e a Academy mostrava "conquistada" mesmo
    // sem a pessoa ter feito login de verdade.
    if (await isCallerAnonymous(req)) {
        return jsonError("Precisa estar logado pra ganhar a badge", 401);
    }

    const body = await req.json().catch(() => null);
    const moduleSlug = body?.module_slug;

    if (typeof moduleSlug !== "string" || !MODULE_SLUGS.includes(moduleSlug)) {
        return jsonError("module_slug inválido", 400);
    }

    const client = getServiceClient();

    const { data: moduleBadge, error: moduleBadgeError } = await client
        .from("badges")
        .select("id")
        .eq("academy_module_slug", moduleSlug)
        .maybeSingle();

    if (moduleBadgeError || !moduleBadge) {
        console.error("academy-grant-module-badge: badge do módulo não configurada", moduleSlug, moduleBadgeError);
        return jsonError("Badge desse módulo ainda não foi configurada", 500);
    }

    const grantedModuleBadge = await grantIfMissing(client, callerId, moduleBadge.id);

    return new Response(
        JSON.stringify({ success: true, grantedModuleBadge }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

});

// Insere em user_badges só se ainda não existir - devolve true se
// concedeu agora, false se já tinha (idempotente, seguro pra chamar
// de novo se a pessoa refizer o quiz).
async function grantIfMissing(
    client: ReturnType<typeof getServiceClient>,
    userId: string,
    badgeId: string,
): Promise<boolean> {
    const { data: existing } = await client
        .from("user_badges")
        .select("id")
        .eq("user_id", userId)
        .eq("badge_id", badgeId)
        .maybeSingle();

    if (existing) return false;

    // granted_by preenchido com o próprio usuário - não tem um "VIP
    // que concedeu" aqui (é conquista automática, não concessão
    // manual), e não dá pra confirmar sem acesso ao banco se essa
    // coluna aceita nulo. Mais seguro preencher com algo válido
    // (a própria pessoa, ganhou por mérito próprio) do que arriscar
    // quebrar a concessão pra todo mundo se não aceitar.
    const { error } = await client
        .from("user_badges")
        .insert({ user_id: userId, badge_id: badgeId, granted_by: userId, note: "Concedida automaticamente pela Academy" });
    if (error) {
        console.error("academy-grant-module-badge: erro ao conceder", badgeId, error);
        return false;
    }
    return true;
}

function jsonError(message: string, status: number): Response {
    return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}
