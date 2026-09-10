// ==================================================================
// admin-delete-question-pack
//
// Body: { packId }
//
// Apaga um pacote do catálogo oficial pra sempre, junto com toda
// pergunta dele - reportado ao vivo: precisa limpar pacote de teste
// que virou catálogo de verdade (um até tinha sido auto-aprovado
// pelo próprio remetente, antes da trava existir). Apaga as
// perguntas primeiro, o pacote depois - não confia em cascade
// automático sem confirmar que existe.
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
    const { packId } = body;

    if (!packId) {
        return new Response(JSON.stringify({ error: "packId é obrigatório" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const { error: questionsError } = await adminClient
        .from("questions")
        .delete()
        .eq("pack_id", packId);

    if (questionsError) {
        console.error("Erro ao apagar perguntas do pacote:", questionsError);
        return new Response(JSON.stringify({ error: "Erro ao apagar as perguntas do pacote" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const { error: packError } = await adminClient
        .from("question_packs")
        .delete()
        .eq("id", packId);

    if (packError) {
        console.error("Erro ao apagar pacote do catálogo:", packError);
        return new Response(JSON.stringify({ error: "Erro ao apagar o pacote" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

}));
