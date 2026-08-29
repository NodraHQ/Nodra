// ==================================================================
// _shared/vipAuth.ts
//
// Mesmo desenho do adminAuth.ts, mas confere `profiles.is_vip = true`
// em vez de presença na tabela `admins` — VIP não é admin, ações de
// VIP (como conceder badge) ficam em log próprio (vip_audit_log),
// nunca misturado com admin_audit_log. Ver
// docs/BADGE_INTEGRITY_ARCHITECTURE.md, Path 2.
// ==================================================================

import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";

export const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export class VipAuthError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.status = status;
    }
}

export async function requireVip(req: Request): Promise<{ vipClient: SupabaseClient; vipId: string }> {

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
        throw new VipAuthError("Missing Authorization header", 401);
    }

    // Client com a ANON key, carregando o token de quem chamou — é
    // isso que permite descobrir QUEM está pedindo, validando o
    // token de verdade (não é possível forjar isso só mandando um
    // id qualquer no corpo da requisição).
    const callerClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userError } = await callerClient.auth.getUser();
    if (userError || !user) {
        throw new VipAuthError("Not signed in", 401);
    }

    // Client com service role — só ele ignora RLS pra ler o próprio
    // is_vip de qualquer um e gravar no log. Nunca é construído a
    // partir de nada que vem do navegador; a service role key só
    // existe aqui, nas variáveis de ambiente da própria função.
    const vipClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: profile } = await vipClient
        .from("profiles")
        .select("is_vip")
        .eq("id", user.id)
        .maybeSingle();

    if (!profile?.is_vip) {
        throw new VipAuthError("Not a VIP", 403);
    }

    return { vipClient, vipId: user.id };

}

export async function logVipAction(
    vipClient: SupabaseClient,
    vipId: string,
    action: string,
    targetUserId: string | null,
    details: Record<string, unknown> = {},
): Promise<void> {
    await vipClient.from("vip_audit_log").insert({
        vip_id: vipId,
        action,
        target_user_id: targetUserId,
        details,
    });
}

// Wrapper comum: cuida do CORS/preflight, chama requireVip, e
// transforma VipAuthError num Response com o status certo.
export function withVipAuth(
    handler: (req: Request, ctx: { vipClient: SupabaseClient; vipId: string }) => Promise<Response>,
): (req: Request) => Promise<Response> {
    return async (req: Request) => {

        if (req.method === "OPTIONS") {
            return new Response("ok", { headers: corsHeaders });
        }

        try {
            const { vipClient, vipId } = await requireVip(req);
            return await handler(req, { vipClient, vipId });
        } catch (err) {
            if (err instanceof VipAuthError) {
                return new Response(JSON.stringify({ error: err.message }), {
                    status: err.status,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }
            console.error("Unexpected VIP function error:", err);
            return new Response(JSON.stringify({ error: "Internal error" }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

    };
}
