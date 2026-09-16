// ==================================================================
// admin-grant-theme
//
// Body: { target_user_id, name, primary_color, background_color,
//         logo_url, slogan_pt, slogan_en, applicable_games,
//         color_overrides }
//
// Pedido ao vivo: "em vez do usuário criar o tema, eu como admin
// crio um e jogo pra ele ter acesso como se fosse um tema simples
// criado por ele". Essa function é literalmente vip-create-theme
// com duas trocas: quem autentica é admin (withAdminAuth), e o
// owner_id do tema criado é o ALVO escolhido pelo admin, não quem
// está logado. Lógica de derivação de cor e a regra de cota por
// ciclo/tier são as MESMAS do vip-create-theme de propósito -
// "como se fosse criado por ele" inclui valer as mesmas regras, não
// só a aparência. Duplicado aqui (não importado de lá) seguindo o
// padrão de self-contained já usado pelos jogos - se um dia divergir
// intencionalmente (ex: admin sem limite de cota), é decisão nova,
// não bug de sincronização entre os dois arquivos.
// ==================================================================

import { corsHeaders, withAdminAuth, logAdminAction } from "../_shared/adminAuth.ts";

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

    const text = isDark ? hslToHex(0, 0, 96) : hslToHex(0, 0, 12);
    const textMuted = isDark
        ? hslToHex(bh, Math.min(bs, 15), 68)
        : hslToHex(bh, Math.min(bs, 10), 42);

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
const OVERRIDABLE_KEYS = ["primary", "primaryLight", "background", "surface", "text", "paper"];
const THEME_LIMITS_BY_TIER: Record<string, number> = { bronze: 3, prata: 10, gold: 999 };

Deno.serve(withAdminAuth(async (req, { adminClient, adminId }) => {

    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Use POST" }), {
            status: 405,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const body = await req.json().catch(() => null);
    const targetUserId = body?.target_user_id;
    const name = body?.name?.trim();
    const primaryColor = body?.primary_color;
    const backgroundColor = body?.background_color;
    const logoBase64 = typeof body?.logo_base64 === "string" ? body.logo_base64 : null;
    const logoExt = typeof body?.logo_ext === "string" ? body.logo_ext.replace(/[^a-z0-9]/gi, "").toLowerCase() : "png";
    const sloganPt = body?.slogan_pt || null;
    const sloganEn = body?.slogan_en || null;
    const applicableGames = Array.isArray(body?.applicable_games) ? body.applicable_games : [];

    if (typeof targetUserId !== "string" || !targetUserId) {
        return new Response(JSON.stringify({ error: "target_user_id é obrigatório" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

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

    const { data: targetProfile, error: profileError } = await adminClient
        .from("profiles")
        .select("vip_expires_at, vip_tier, is_vip, username")
        .eq("id", targetUserId)
        .maybeSingle();

    if (profileError || !targetProfile) {
        return new Response(JSON.stringify({ error: "Conta de destino não encontrada" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    // Tema é benefício de VIP - concedido pra conta que não é VIP não
    // teria onde aparecer pra ninguém usar (a aba "Meu Tema" só
    // existe pra quem é VIP). Em vez de criar um estado esquisito
    // (tema órfão sem lugar de usar), barra aqui e deixa claro pro
    // admin: primeiro concede VIP (admin-grant-vip), depois o tema.
    if (!targetProfile.is_vip) {
        return new Response(
            JSON.stringify({ error: "Essa conta não é VIP - conceda VIP primeiro (aba Usuários) antes de criar um tema pra ela" }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    const vipExpiry = targetProfile.vip_expires_at || null;
    const maxThemesThisCycle = THEME_LIMITS_BY_TIER[targetProfile.vip_tier ?? ""] ?? THEME_LIMITS_BY_TIER.bronze;

    // Mesma regra de cota do vip-create-theme, calculada em cima do
    // ciclo do ALVO - "como se ele tivesse criado" inclui valer a
    // mesma cota dele, não uma cota separada só pra concessão de
    // admin. Se a pessoa já usou os slots do ciclo, essa chamada
    // também é bloqueada - é intencional, não bug.
    const existingQuery = adminClient
        .from("custom_themes")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", targetUserId)
        .eq("is_included_slot", true);

    const { count: existingCountForCycle } = vipExpiry
        ? await existingQuery.eq("created_for_vip_expiry", vipExpiry)
        : await existingQuery.is("created_for_vip_expiry", null);

    if ((existingCountForCycle ?? 0) >= maxThemesThisCycle) {
        return new Response(
            JSON.stringify({
                error: `Essa conta já usou os ${maxThemesThisCycle} temas inclusos desse ciclo - não dá pra conceder mais um até a renovação dela`,
            }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    const colors = { ...deriveThemeColors(primaryColor, backgroundColor), ...colorOverrides };
    const slug = `${name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "tema"}-${crypto.randomUUID().slice(0, 8)}`;

    // Upload acontece AQUI, com service role - ignora qualquer RLS do
    // bucket theme-logos. Fazer isso no navegador (como vip-create-theme
    // faz, autenticado como o próprio VIP) não funcionaria aqui: o admin
    // estaria tentando subir arquivo em nome de OUTRA conta, e o bucket
    // provavelmente só libera upload com o próprio auth.uid() no nome
    // do arquivo (mesmo padrão de RLS usado nos outros buckets do
    // projeto). Nome do arquivo usa o ID do ALVO, não do admin, pra
    // ficar organizado do mesmo jeito que os uploads normais ficam.
    const MAX_LOGO_BYTES = 3 * 1024 * 1024; // 3MB, mesmo limite do avatar
    let logoUrl: string | null = null;

    if (logoBase64) {
        let logoBytes: Uint8Array;
        try {
            logoBytes = Uint8Array.from(atob(logoBase64), (c) => c.charCodeAt(0));
        } catch {
            return new Response(JSON.stringify({ error: "Imagem inválida" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        if (logoBytes.byteLength > MAX_LOGO_BYTES) {
            return new Response(JSON.stringify({ error: "Imagem muito grande (máximo 3MB)" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const contentTypeByExt: Record<string, string> = {
            png: "image/png",
            svg: "image/svg+xml",
            webp: "image/webp",
        };
        const ext = contentTypeByExt[logoExt] ? logoExt : "png";
        const fileName = `${targetUserId}-${Date.now()}.${ext}`;

        const { error: uploadError } = await adminClient.storage
            .from("theme-logos")
            .upload(fileName, logoBytes, { contentType: contentTypeByExt[ext] });

        if (uploadError) {
            console.error("admin-grant-theme: erro ao subir logo", uploadError);
            return new Response(JSON.stringify({ error: "Erro ao enviar a imagem" }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const { data: publicUrlData } = adminClient.storage.from("theme-logos").getPublicUrl(fileName);
        logoUrl = publicUrlData.publicUrl;
    }

    const { data: newTheme, error: insertError } = await adminClient
        .from("custom_themes")
        .insert({
            owner_id: targetUserId,
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
        console.error("admin-grant-theme: erro ao criar tema", insertError);
        return new Response(JSON.stringify({ error: "Erro ao criar o tema" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    await logAdminAction(adminClient, adminId, "grant_theme", targetUserId, {
        themeId: newTheme.id,
        slug: newTheme.slug,
        targetUsername: targetProfile.username,
    });

    return new Response(JSON.stringify({ success: true, theme: { id: newTheme.id, slug: newTheme.slug, colors } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

}));
