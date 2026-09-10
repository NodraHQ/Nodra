// ==================================================================
// admin-send-support-message
//
// Body: { ticketId, message }
//
// Grava a resposta do admin e atualiza updated_at do ticket (pra ele
// subir pro topo da lista, mesmo padrão de inbox). Reabre o ticket
// se estava fechado - responder implica continuar a conversa.
// ==================================================================

import { corsHeaders, withAdminAuth } from "../_shared/adminAuth.ts";

Deno.serve(withAdminAuth(async (req, { adminClient, adminId }) => {

    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Use POST" }), {
            status: 405,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const body = await req.json().catch(() => ({}));
    const { ticketId, message } = body;

    if (!ticketId || typeof message !== "string" || !message.trim()) {
        return new Response(JSON.stringify({ error: "ticketId e message são obrigatórios" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const { error: insertError } = await adminClient.from("support_messages").insert({
        ticket_id: ticketId,
        sender_type: "admin",
        sender_id: adminId,
        message: message.trim(),
    });

    if (insertError) {
        console.error("Erro ao enviar resposta de suporte:", insertError);
        return new Response(JSON.stringify({ error: "Erro ao enviar" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    await adminClient
        .from("support_tickets")
        .update({ updated_at: new Date().toISOString(), status: "open" })
        .eq("id", ticketId);

    return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

}));
