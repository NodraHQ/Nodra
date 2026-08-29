// ==================================================================
// admin-generate-vip-code
//
// Body: { vipDays?: number, maxUses?: number, expiresInDays?: number, note?: string }
//
// Gera um código de convite pra VIP - reportado ao vivo: "continua
// pelo painel de admin, mas gera um código legal pra organizar" em
// vez de só ligar/desligar is_vip direto num usuário específico
// (isso já existe, admin-grant-vip). O código pode ser compartilhado
// por fora (Discord, Telegram, o que for) e qualquer pessoa logada
// consegue resgatar ele depois, sem precisar do admin agir de novo
// pra cada pessoa.
// ==================================================================

import { corsHeaders, withAdminAuth } from "../_shared/adminAuth.ts";

function generateCode(): string {
    // Formato legível, fácil de digitar/compartilhar por fora -
    // tipo NODRA-X7K2-P9QM, não um uuid gigante.
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem O/0/I/1, evita confusão visual
    const randomBlock = () =>
        Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    return `NODRA-${randomBlock()}-${randomBlock()}`;
}

Deno.serve(withAdminAuth(async (req, { adminClient, adminId }) => {

    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Use POST" }), {
            status: 405,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const body = await req.json().catch(() => ({}));
    const vipDays = Number.isFinite(body?.vipDays) && body.vipDays > 0 ? body.vipDays : 30;
    const maxUses = Number.isFinite(body?.maxUses) && body.maxUses > 0 ? body.maxUses : 1;
    const note = typeof body?.note === "string" ? body.note : null;

    const expiresAt =
        Number.isFinite(body?.expiresInDays) && body.expiresInDays > 0
            ? new Date(Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
            : null;

    // Tenta algumas vezes até achar um código que não colida - a
    // chance de colisão é bem baixa (32^8 combinações), mas o código
    // é único no banco, então se colidir o insert falharia sozinho.
    let code = "";
    let insertError = null;

    for (let attempt = 0; attempt < 5; attempt++) {
        code = generateCode();
        const { error } = await adminClient.from("vip_invite_codes").insert({
            code,
            created_by: adminId,
            max_uses: maxUses,
            vip_days: vipDays,
            note,
            expires_at: expiresAt,
        });

        if (!error) {
            insertError = null;
            break;
        }
        insertError = error;
        if (error.code !== "23505") break; // erro que não é colisão de código - não adianta tentar de novo
    }

    if (insertError) {
        console.error("Erro ao gerar código de VIP:", insertError);
        return new Response(JSON.stringify({ error: "Erro ao gerar o código" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ success: true, code, vipDays, maxUses, expiresAt }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

}));
