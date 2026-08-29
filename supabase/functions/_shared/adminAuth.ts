// ==================================================================
// _shared/adminAuth.ts
//
// Usado por toda Edge Function de admin. Confere QUEM está chamando
// (usando o próprio token que o navegador manda, nunca confiando em
// nada que vem solto no corpo da requisição) e se essa pessoa está
// na tabela `admins`. Ver docs/ADMIN_ARCHITECTURE.md pra entender
// por que isso vive aqui e não numa policy de RLS.
// ==================================================================

import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";

export const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export class AdminAuthError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.status = status;
    }
}

export async function requireAdmin(req: Request): Promise<{ adminClient: SupabaseClient; adminId: string }> {

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
        throw new AdminAuthError("Missing Authorization header", 401);
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
        throw new AdminAuthError("Not signed in", 401);
    }

    // Client com service role — só ele consegue ler `admins` e
    // executar as ações privilegiadas ignorando RLS. Nunca é
    // construído a partir de nada que vem do navegador; a service
    // role key só existe aqui, nas variáveis de ambiente da própria
    // função.
    const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: adminRow } = await adminClient
        .from("admins")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

    if (!adminRow) {
        throw new AdminAuthError("Not an admin", 403);
    }

    return { adminClient, adminId: user.id };

}

export async function logAdminAction(
    adminClient: SupabaseClient,
    adminId: string,
    action: string,
    targetUserId: string | null,
    details: Record<string, unknown> = {},
): Promise<void> {
    await adminClient.from("admin_audit_log").insert({
        admin_id: adminId,
        action,
        target_user_id: targetUserId,
        details,
    });
}

// Wrapper comum pra toda function de admin: cuida do CORS/preflight,
// chama requireAdmin, e transforma AdminAuthError num Response com o
// status certo — pra cada function não precisar repetir esse
// try/catch igual.
export function withAdminAuth(
    handler: (req: Request, ctx: { adminClient: SupabaseClient; adminId: string }) => Promise<Response>,
): (req: Request) => Promise<Response> {
    return async (req: Request) => {

        if (req.method === "OPTIONS") {
            return new Response("ok", { headers: corsHeaders });
        }

        try {
            const { adminClient, adminId } = await requireAdmin(req);
            return await handler(req, { adminClient, adminId });
        } catch (err) {
            if (err instanceof AdminAuthError) {
                return new Response(JSON.stringify({ error: err.message }), {
                    status: err.status,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }
            console.error("Unexpected admin function error:", err);
            return new Response(JSON.stringify({ error: "Internal error" }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

    };
}
