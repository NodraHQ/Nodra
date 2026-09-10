// ==================================================================
// vip-create-theme
//
// Body: { name, primary_color, background_color, mode, logo_url,
//         slogan_pt, slogan_en, applicable_games }
//
// Cria o tema incluso (grátis) do VIP - sempre privado, aplica na
// hora, sem revisão de ninguém. Um por ciclo de renovação: o "ciclo"
// aqui é literalmente o valor atual de profiles.vip_expires_at -
// toda vez que a pessoa paga ou resgata um código, esse campo avança
// (ver verify-vip-payment/redeem-vip-code). Se já existe um tema
// criado com esse MESMO valor de vip_expires_at, o slot já foi usado
// nesse ciclo. Renovou de novo (vip_expires_at avançou), libera de
// novo - sem precisar de nenhum job rodando sozinho pra "resetar
// contador todo mês", só compara com o valor atual.
//
// Cor final: a pessoa só escolhe primary + background (+ modo
// dark/light, usado só pra decidir a direção da derivação). O resto
// das 13 cores obrigatórias do tema é derivado aqui, matematicamente
// (HSL), garantindo contraste em vez de deixar a pessoa escolher
// texto/fundo que podem não combinar. success/error ficam fixos -
// cor de certo/errado não muda com a marca.
// ==================================================================

import { corsHeaders, withVipAuth, logVipAction } from "../_shared/vipAuth.ts";

// --------------------------------------------------------
// Conversão de cor - HSL é o espaço de cor certo pra isso porque
// "luminosidade" (o L) é exatamente o eixo que decide contraste.
// --------------------------------------------------------

function hexToRgb(hex: string): [number, number, number] {
    const clean = hex.replace('#', '');
    const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
    const num = parseInt(full, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    const d = max - min;
    if (d !== 0) {
        s = d / (1 - Math.abs(2 * l - 1));
        switch (max) {
            case r: h = ((g - b) / d) % 6; break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h *= 60;
        if (h < 0) h += 360;
    }
    return [h, s * 100, l * 100];
}

function hslToHex(h: number, s: number, l: number): string {
    s = Math.max(0, Math.min(100, s)) / 100;
    l = Math.max(0, Math.min(100, l)) / 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; } else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
    const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
}

// Gera as 13 cores obrigatórias do tema (ver ndquest/*/branding/theme-schema.js)
// a partir só de primary + background. Mesma lógica roda também no
// preview do lado do cliente (account.js) - se um dia divergir,
// aqui é a fonte de verdade final, é o que realmente fica salvo.
function deriveThemeColors(primaryHex: string, backgroundHex: string) {

    const [pr, pg, pb] = hexToRgb(primaryHex);
    const [ph, ps] = rgbToHsl(pr, pg, pb);

    const [br, bg, bb] = hexToRgb(backgroundHex);
    const [bh, bs, bl] = rgbToHsl(br, bg, bb);
    const isDark = bl < 50;

    const primaryLight = hslToHex(ph, clamp(ps + 5, 0, 100), clamp(ps > 0 ? (isDark ? 62 : 55) : 70, 0, 92));

    const backgroundAlt = hslToHex(bh, bs, clamp(bl + (isDark ? 4 : -3), 0, 100));
    const surface = hslToHex(bh, bs, clamp(bl + (isDark ? 8 : -6), 0, 100));
    const surfaceBorder = `rgba(${pr}, ${pg}, ${pb}, 0.18)`;

    // Texto sempre no extremo oposto do fundo - garante contraste alto
    // matematicamente, não depende de acertar a cor certa.
    const text = isDark ? hslToHex(0, 0, 96) : hslToHex(0, 0, 12);
    const textMuted = isDark
        ? hslToHex(bh, Math.min(bs, 15), 68)
        : hslToHex(bh, Math.min(bs, 10), 42);

    // Família "papel" (envelope do Quest Drop/Show Down) - sempre
    // clara, com uma leve tintura da cor principal, independente do
    // modo escuro/claro escolhido. O texto/tinta em cima dela é fixo
    // e escuro (não é o "text" do tema), então contraste aqui não
    // depende do resto da paleta.
    const paperTint = Math.min(ps * 0.15, 12);
    const paper = hslToHex(ph, paperTint, 94);
    const paperDark = hslToHex(ph, clamp(paperTint + 2, 0, 18), 82);
    const paperShadow = hslToHex(ph, clamp(paperTint + 4, 0, 20), 68);

    return {
        primary: primaryHex,
        primaryLight,
        background: backgroundHex,
        backgroundAlt,
        surface,
        surfaceBorder,
        text,
        textMuted,
        success: "#5fa77c",
        error: "#b5544a",
        paper,
        paperDark,
        paperShadow,
    };
}

const HEX_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

Deno.serve(withVipAuth(async (req, { vipClient, vipId }) => {

    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Use POST" }), {
            status: 405,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const body = await req.json().catch(() => null);
    const name = body?.name?.trim();
    const primaryColor = body?.primary_color;
    const backgroundColor = body?.background_color;
    const logoUrl = body?.logo_url || null;
    const sloganPt = body?.slogan_pt || null;
    const sloganEn = body?.slogan_en || null;
    const applicableGames = Array.isArray(body?.applicable_games) ? body.applicable_games : [];

    // Sobrescritas manuais por cima do que é derivado automaticamente
    // - reportado ao vivo: a pessoa quer poder clicar numa cor
    // específica do preview e ajustar ela na mão. Só aceita chaves
    // conhecidas (as mesmas 6 que aparecem no preview) com valor hex
    // válido - qualquer coisa fora disso é ignorada, não gera erro
    // (evita travar a criação por causa de um campo extra
    // inesperado no corpo da requisição).
    const OVERRIDABLE_KEYS = ["primary", "primaryLight", "background", "surface", "text", "paper"];
    const rawOverrides = body?.color_overrides && typeof body.color_overrides === "object" ? body.color_overrides : {};
    const colorOverrides: Record<string, string> = {};
    for (const key of OVERRIDABLE_KEYS) {
        if (HEX_REGEX.test(rawOverrides[key] || "")) colorOverrides[key] = rawOverrides[key];
    }

    if (!name || !HEX_REGEX.test(primaryColor || "") || !HEX_REGEX.test(backgroundColor || "")) {
        return new Response(
            JSON.stringify({ error: "name, primary_color e background_color (hex válido) são obrigatórios" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    if (applicableGames.length === 0) {
        return new Response(JSON.stringify({ error: "Escolha pelo menos um jogo pro tema valer" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    // Confere o ciclo de renovação atual e quantos temas inclusos já
    // foram criados nele. Bug real reportado ao vivo: VIP concedido
    // direto pelo admin, sem vip_expires_at registrado, era barrado
    // aqui com erro 500 - sem uma data de renovação pra comparar,
    // não dá pra calcular "ciclo", então trata como "incluso pra
    // sempre" (created_for_vip_expiry fica null) em vez de travar a
    // pessoa por completo. Mesma lógica espelhada em
    // account.js/loadThemeSlotStatus.
    //
    // Limite virou por TIER, não mais fixo em 1 pra todo mundo -
    // reportado ao vivo: "vamos implementar sim, isso é super
    // importante", números já fechados numa conversa anterior.
    const THEME_LIMITS_BY_TIER: Record<string, number> = { bronze: 3, prata: 10, gold: 999 };

    const { data: profile, error: profileError } = await vipClient
        .from("profiles")
        .select("vip_expires_at, vip_tier")
        .eq("id", vipId)
        .maybeSingle();

    if (profileError) {
        return new Response(JSON.stringify({ error: "Não foi possível confirmar seu status de VIP" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const vipExpiry = profile?.vip_expires_at || null;
    const maxThemesThisCycle = THEME_LIMITS_BY_TIER[profile?.vip_tier ?? ""] ?? THEME_LIMITS_BY_TIER.bronze;

    const existingQuery = vipClient
        .from("custom_themes")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", vipId)
        .eq("is_included_slot", true);

    const { count: existingCountForCycle } = vipExpiry
        ? await existingQuery.eq("created_for_vip_expiry", vipExpiry)
        : await existingQuery.is("created_for_vip_expiry", null);

    if ((existingCountForCycle ?? 0) >= maxThemesThisCycle) {
        return new Response(
            JSON.stringify({
                error: vipExpiry
                    ? `Você já usou os ${maxThemesThisCycle} temas inclusos desse ciclo - os próximos liberam na sua renovação, ou faça upgrade de tier`
                    : "Você já usou seus temas inclusos - sua conta não tem data de renovação registrada",
            }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    const colors = { ...deriveThemeColors(primaryColor, backgroundColor), ...colorOverrides };
    const slug = `${name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "tema"}-${crypto.randomUUID().slice(0, 8)}`;

    const { data: newTheme, error: insertError } = await vipClient
        .from("custom_themes")
        .insert({
            owner_id: vipId,
            slug,
            name,
            colors,
            fonts: { display: "'Fraunces', serif", body: "'Work Sans', sans-serif", files: [] },
            logo_url: logoUrl,
            logo_background: null,
            envelope_texture_url: null,
            slogan_pt: sloganPt,
            slogan_en: sloganEn,
            status: "private",
            applicable_games: applicableGames,
            is_included_slot: true,
            created_for_vip_expiry: vipExpiry,
        })
        .select("id, slug")
        .single();

    if (insertError || !newTheme) {
        console.error("vip-create-theme: erro ao criar tema", insertError);
        return new Response(JSON.stringify({ error: "Erro ao criar o tema" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    await logVipAction(vipClient, vipId, "create_included_theme", null, { themeId: newTheme.id, slug: newTheme.slug });

    return new Response(JSON.stringify({ success: true, theme: { id: newTheme.id, slug: newTheme.slug, colors } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

}));
