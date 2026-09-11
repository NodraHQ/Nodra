// ==================================================================
// _shared/gameAuth.ts
//
// Diferente de adminAuth.ts (que EXIGE ser admin), este helper é
// usado pelas Edge Functions de jogo, que precisam funcionar tanto
// pra quem está logado quanto pra quem não está — login é opcional
// pra jogar, sempre foi. getOptionalCallerId nunca lança erro por
// falta de login; retorna null nesse caso, que é um caminho válido.
// ==================================================================

import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";

export const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Client com chave de serviço — ignora RLS de propósito. É esse
// client que consegue ler `questions` (correct_index incluso), coisa
// que nenhum client comum, logado ou não, tem permissão de fazer.
export function getServiceClient(): SupabaseClient {
    return createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
}

// Se vier um token válido, retorna o user id de quem está chamando.
// Se não vier nenhum (chamada anônima) ou o token for inválido,
// retorna null — sem lançar erro, porque jogar sem login é um
// caminho legítimo, não uma falha de autenticação.
export async function getOptionalCallerId(req: Request): Promise<string | null> {

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return null;

    const callerClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user } } = await callerClient.auth.getUser();
    return user?.id ?? null;

}

// Diferente de getOptionalCallerId (que só quer saber SE tem alguém
// chamando, sem se importar se é conta real ou convidado - certo pra
// jogo, onde login é opcional de propósito), essa função é pra fluxo
// que EXIGE conta de verdade (ex: academy-grant-module-badge). Sem
// token nenhum conta como "não é conta real" (não lança erro, só
// retorna true - quem chama decide o que fazer com isso).
export async function isCallerAnonymous(req: Request): Promise<boolean> {

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return true;

    const callerClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user } } = await callerClient.auth.getUser();
    return user?.is_anonymous ?? true;

}
