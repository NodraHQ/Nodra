// ==================================================================
// admin-list-users
//
// Lista usuários pro painel — diferente da view profiles_public, esta
// função É a rota "admin vê tudo" (wallet_evm incluso), então só
// existe atrás do requireAdmin, nunca exposta como view/RLS.
//
// Query params opcionais: ?search=texto (filtra por username),
// ?page=0 (paginação, 50 por página).
// ==================================================================

import { corsHeaders, withAdminAuth } from "../_shared/adminAuth.ts";

const PAGE_SIZE = 50;

Deno.serve(withAdminAuth(async (req, { adminClient }) => {

    const url = new URL(req.url);
    const search = url.searchParams.get("search")?.trim();
    const page = Number(url.searchParams.get("page") ?? "0");

    let query = adminClient
        .from("profiles")
        .select("id, username, x_handle, telegram_handle, instagram_handle, wallet_evm, is_vip, vip_tier, created_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (search) {
        query = query.ilike("username", `%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ users: data, total: count, page, pageSize: PAGE_SIZE }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

}));
