// ==================================================================
// admin-delete-vip-pack
//
// POST { id }. Apaga um pacote salvo de VIP (vip_saved_packs) pra
// sempre - reportado ao vivo: "preciso poder deletar eles também
// caso aconteça". Não tem undo - a sala que já usou esse pacote no
// passado não é afetada (as perguntas ficam copiadas dentro da
// própria sala, não referenciadas), só o pacote salvo em si some.
// ==================================================================

import { corsHeaders, withAdminAuth } from "../_shared/adminAuth.ts";

Deno.serve(withAdminAuth(async (req, { adminClient }) => {

    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Método não permitido" }), {
            status: 405,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const body = await req.json().catch(() => ({}));
    const { id } = body;

    if (!id) {
        return new Response(JSON.stringify({ error: "id é obrigatório" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const { error } = await adminClient
        .from("vip_saved_packs")
        .delete()
        .eq("id", id);

    if (error) {
        console.error("Erro ao apagar pacote salvo de VIP:", error);
        return new Response(JSON.stringify({ error: "Erro ao apagar" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

}));
