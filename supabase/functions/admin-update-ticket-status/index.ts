// ==================================================================
// admin-update-ticket-status
//
// Body: { ticketId, status: "open" | "closed" }
// ==================================================================

import { corsHeaders, withAdminAuth } from "../_shared/adminAuth.ts";

Deno.serve(withAdminAuth(async (req, { adminClient }) => {

    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Use POST" }), {
            status: 405,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const body = await req.json().catch(() => ({}));
    const { ticketId, status } = body;

    if (!ticketId || !["open", "closed"].includes(status)) {
        return new Response(JSON.stringify({ error: "ticketId e status (\"open\" ou \"closed\") são obrigatórios" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const { error } = await adminClient
        .from("support_tickets")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", ticketId);

    if (error) {
        console.error("Erro ao atualizar status do ticket:", error);
        return new Response(JSON.stringify({ error: "Erro ao atualizar" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

}));
