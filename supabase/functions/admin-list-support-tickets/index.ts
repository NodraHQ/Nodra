// ==================================================================
// admin-list-support-tickets
//
// GET, sem body. Lista todo ticket de suporte, mais recente primeiro
// (por última atividade, não por criação - um ticket antigo que
// acabou de receber resposta sobe pro topo, igual inbox de verdade).
// ==================================================================

import { corsHeaders, withAdminAuth } from "../_shared/adminAuth.ts";

Deno.serve(withAdminAuth(async (_req, { adminClient }) => {

    const { data: tickets, error } = await adminClient
        .from("support_tickets")
        .select("id, user_id, subject, status, created_at, updated_at")
        .order("updated_at", { ascending: false });

    if (error) {
        console.error("Erro ao carregar tickets de suporte:", error);
        return new Response(JSON.stringify({ error: "Erro ao carregar dados" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const userIds = [...new Set((tickets || []).map((t) => t.user_id))];
    const { data: profiles } = userIds.length > 0
        ? await adminClient.from("profiles").select("id, username, vip_tier").in("id", userIds)
        : { data: [] };
    const usernameById = new Map((profiles || []).map((p) => [p.id, p.username]));
    const tierById = new Map((profiles || []).map((p) => [p.id, p.vip_tier]));

    // Última mensagem de cada ticket - pra mostrar uma prévia na
    // lista, sem precisar abrir o ticket pra saber do que se trata.
    const ticketIds = (tickets || []).map((t) => t.id);
    const { data: lastMessages } = ticketIds.length > 0
        ? await adminClient
            .from("support_messages")
            .select("ticket_id, message, sender_type, created_at")
            .in("ticket_id", ticketIds)
            .order("created_at", { ascending: false })
        : { data: [] };

    const lastMessageByTicket = new Map();
    (lastMessages || []).forEach((m) => {
        if (!lastMessageByTicket.has(m.ticket_id)) {
            lastMessageByTicket.set(m.ticket_id, m);
        }
    });

    const result = (tickets || []).map((t) => ({
        id: t.id,
        username: usernameById.get(t.user_id) || t.user_id,
        subject: t.subject,
        status: t.status,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
        lastMessage: lastMessageByTicket.get(t.id)?.message || null,
        lastMessageFrom: lastMessageByTicket.get(t.id)?.sender_type || null,
        // Suporte prioritário do Gold - reportado ao vivo: "vamos
        // implementar sim, isso é super importante". Não muda a
        // ordem por data (mais recente primeiro continua valendo
        // DENTRO de cada grupo), só bota todo ticket Gold antes de
        // qualquer ticket que não seja Gold, sem misturar os dois.
        isPriority: tierById.get(t.user_id) === "gold",
    })).sort((a, b) => {
        if (a.isPriority !== b.isPriority) return a.isPriority ? -1 : 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    return new Response(JSON.stringify({ tickets: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

}));
