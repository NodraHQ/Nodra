// ==================================================================
// _shared/tournamentAuth.ts
//
// Auth do Torneio: diferente de vipAuth.ts (exige VIP), aqui QUALQUER
// sessao serve, inclusive a anonima de convidado - igual aos outros
// jogos, usar sem login sempre foi permitido. O que muda pra quem e
// VIP e retencao (180 dias em vez de 30) e acesso ao historico da
// conta. Nunca usar "tem user_id" pra decidir "e conta real": convidado
// tem user_id tambem (ver MATCH_HISTORY_ARCHITECTURE.md). Aqui
// isAnonymous vem do proprio usuario do Supabase.
// ==================================================================

import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";

export const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export interface CallerContext {
    client: SupabaseClient;
    userId: string;
    isAnonymous: boolean;
    isVip: boolean;
}

export function withCallerAuth(
    handler: (req: Request, ctx: CallerContext) => Promise<Response>,
): (req: Request) => Promise<Response> {
    const fail = (message: string, status: number) =>
        new Response(JSON.stringify({ error: message }), {
            status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    return async (req: Request) => {

        if (req.method === "OPTIONS") {
            return new Response("ok", { headers: corsHeaders });
        }

        try {
            const authHeader = req.headers.get("Authorization");
            if (!authHeader) return fail("Missing Authorization header", 401);

            const callerClient = createClient(
                Deno.env.get("SUPABASE_URL")!,
                Deno.env.get("SUPABASE_ANON_KEY")!,
                { global: { headers: { Authorization: authHeader } } },
            );
            const { data: { user }, error: userError } = await callerClient.auth.getUser();
            if (userError || !user) return fail("Not signed in", 401);

            const client = createClient(
                Deno.env.get("SUPABASE_URL")!,
                Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
            );

            const isAnonymous = !!user.is_anonymous;
            let isVip = false;
            if (!isAnonymous) {
                const { data: profile } = await client
                    .from("profiles")
                    .select("is_vip")
                    .eq("id", user.id)
                    .maybeSingle();
                isVip = !!profile?.is_vip;
            }

            return await handler(req, { client, userId: user.id, isAnonymous, isVip });
        } catch (err) {
            console.error("Unexpected tournament function error:", err);
            return fail("Internal error", 500);
        }

    };
}
