// ==================================================================
// admin-get-support-ticket
//
// GET ?ticketId=... - devolve o ticket em si (com username de quem
// abriu) e todas as mensagens dele, em ordem cronológica.
// ==================================================================

import { corsHeaders, withAdminAuth } from "../_shared/adminAuth.ts";

Deno.serve(withAdminAuth(async (req, { adminClient }) => {

    const ticketId = new URL(req.url).searchParams.get("ticketId");
    if (!ticketId) {
        return new Response(JSON.stringify({ error: "ticketId é obrigatório" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const { data: ticket, error: ticketError } = await adminClient
        .from("support_tickets")
        .select("id, user_id, subject, status, created_at")
        .eq("id", ticketId)
        .maybeSingle();

    if (ticketError || !ticket) {
        return new Response(JSON.stringify({ error: "Ticket não encontrado" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const { data: profile } = await adminClient
        .from("profiles")
        .select("username")
        .eq("id", ticket.user_id)
        .maybeSingle();

    const { data: messages, error: messagesError } = await adminClient
        .from("support_messages")
        .select("id, sender_type, message, created_at")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });

    if (messagesError) {
        console.error("Erro ao carregar mensagens do ticket:", messagesError);
        return new Response(JSON.stringify({ error: "Erro ao carregar mensagens" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({
        ticket: {
            id: ticket.id,
            username: profile?.username || ticket.user_id,
            subject: ticket.subject,
            status: ticket.status,
            createdAt: ticket.created_at,
        },
        messages: messages || [],
    }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

}));
