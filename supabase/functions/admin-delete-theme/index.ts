// ==================================================================
// admin-delete-theme
//
// POST { id }. Apaga um tema pra sempre, qualquer status (privado,
// em revisão, público ou rejeitado) - reportado ao vivo: "preciso
// poder deletar os que estão como públicos também". Sem undo -
// salas que já usaram esse tema no passado não são afetadas (o
// nome do tema fica gravado na própria sala), só o tema em si some
// e deixa de aparecer como opção pra qualquer host.
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

    // Tema pago tem uma linha em theme_submission_payments apontando
    // pra ele - reportado ao vivo: "o pacote vip normal funciona o
    // delete" (mas tema pago não), batendo com uma trava de chave
    // estrangeira barrando a exclusão enquanto esse pagamento existir.
    // Apaga o pagamento primeiro, o tema depois.
    await adminClient
        .from("theme_submission_payments")
        .delete()
        .eq("theme_id", id);

    const { error } = await adminClient
        .from("custom_themes")
        .delete()
        .eq("id", id);

    if (error) {
        console.error("Erro ao apagar tema:", error);
        return new Response(JSON.stringify({ error: "Erro ao apagar" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

}));
