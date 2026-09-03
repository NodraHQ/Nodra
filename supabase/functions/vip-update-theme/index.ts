// ==================================================================
// vip-update-theme
//
// Body: { themeId, name, primary_color, background_color,
//         color_overrides, logo_url, slogan_pt, slogan_en,
//         applicable_games }
//
// Mesma validação e mesmo gerador de cor de vip-create-theme
// (derivação HSL + sobrescritas manuais) - só que atualiza um tema
// que já existe, em vez de criar um novo e gastar outro slot. Usado
// principalmente pra corrigir um tema rejeitado antes de reenviar
// (ver vip-resubmit-theme), mas funciona pra qualquer tema privado
// da própria pessoa também. Tema público ou pendente de revisão não
// pode ser editado direto por aqui - editar um público sem revisão
// de novo anularia o sentido da fila; pendente já está na fila,
// esperando.
// ==================================================================

import { corsHeaders, withVipAuth, logVipAction } from "../_shared/vipAuth.ts";

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

    const primaryLight = hslToHex(ph, clamp(ps + 5, 0, 100), isDark ? 62 : 55);
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
        primary: primaryHex, primaryLight,
        background: backgroundHex, backgroundAlt,
        surface, surfaceBorder,
        text, textMuted,
        success: "#5fa77c", error: "#b5544a",
        paper, paperDark, paperShadow,
    };
}

const HEX_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const OVERRIDABLE_KEYS = ["primary", "primaryLight", "background", "surface", "text", "paper"];

Deno.serve(withVipAuth(async (req, { vipClient, vipId }) => {

    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Use POST" }), {
            status: 405,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const body = await req.json().catch(() => null);
    const themeId = body?.themeId;
    const name = body?.name?.trim();
    const primaryColor = body?.primary_color;
    const backgroundColor = body?.background_color;
    const logoUrl = body?.logo_url ?? null;
    const sloganPt = body?.slogan_pt ?? null;
    const sloganEn = body?.slogan_en ?? null;
    const applicableGames = Array.isArray(body?.applicable_games) ? body.applicable_games : [];

    const rawOverrides = body?.color_overrides && typeof body.color_overrides === "object" ? body.color_overrides : {};
    const colorOverrides: Record<string, string> = {};
    for (const key of OVERRIDABLE_KEYS) {
        if (HEX_REGEX.test(rawOverrides[key] || "")) colorOverrides[key] = rawOverrides[key];
    }

    if (typeof themeId !== "string" || !name || !HEX_REGEX.test(primaryColor || "") || !HEX_REGEX.test(backgroundColor || "")) {
        return new Response(
            JSON.stringify({ error: "themeId, name, primary_color e background_color (hex válido) são obrigatórios" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    if (applicableGames.length === 0) {
        return new Response(JSON.stringify({ error: "Escolha pelo menos um jogo pro tema valer" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const { data: theme, error: themeError } = await vipClient
        .from("custom_themes")
        .select("id, owner_id, status")
        .eq("id", themeId)
        .maybeSingle();

    if (themeError || !theme) {
        return new Response(JSON.stringify({ error: "Tema não encontrado" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    if (theme.owner_id !== vipId) {
        return new Response(JSON.stringify({ error: "Esse tema não é seu" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    if (theme.status !== "private" && theme.status !== "rejected") {
        return new Response(
            JSON.stringify({ error: `Esse tema está em "${theme.status}", não dá pra editar agora` }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    const colors = { ...deriveThemeColors(primaryColor, backgroundColor), ...colorOverrides };

    const { error: updateError } = await vipClient
        .from("custom_themes")
        .update({
            name,
            colors,
            logo_url: logoUrl,
            slogan_pt: sloganPt,
            slogan_en: sloganEn,
            applicable_games: applicableGames,
            updated_at: new Date().toISOString(),
        })
        .eq("id", themeId);

    if (updateError) {
        console.error("vip-update-theme: erro ao atualizar", updateError);
        return new Response(JSON.stringify({ error: "Erro ao atualizar o tema" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    await logVipAction(vipClient, vipId, "update_theme", null, { themeId });

    return new Response(JSON.stringify({ success: true, colors }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

}));
