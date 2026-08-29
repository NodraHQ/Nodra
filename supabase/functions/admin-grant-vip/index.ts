// ==================================================================
// admin-grant-vip
//
// Body: { targetUserId: string, grant: boolean }
//
// Muda profiles.is_vip e grava no admin_audit_log na mesma chamada —
// nunca separado, pra nunca existir uma concessão sem registro.
// ==================================================================

import { corsHeaders, withAdminAuth, logAdminAction } from "../_shared/adminAuth.ts";

Deno.serve(withAdminAuth(async (req, { adminClient, adminId }) => {

    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Use POST" }), {
            status: 405,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const body = await req.json().catch(() => null);
    const targetUserId = body?.targetUserId;
    const grant = body?.grant;

    if (typeof targetUserId !== "string" || typeof grant !== "boolean") {
        return new Response(JSON.stringify({ error: "Body precisa de { targetUserId: string, grant: boolean }" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const { error } = await adminClient
        .from("profiles")
        .update({ is_vip: grant })
        .eq("id", targetUserId);

    if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    await logAdminAction(adminClient, adminId, grant ? "grant_vip" : "revoke_vip", targetUserId);

    return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

}));
