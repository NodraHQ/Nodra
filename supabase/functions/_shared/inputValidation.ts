// ==================================================================
// _shared/inputValidation.ts
//
// Validação de campos que acabam dentro de HTML/CSS em páginas de
// OUTRAS pessoas (badge aparece no placar dos jogos de todo mundo,
// tema/logo aparece pros jogadores da sala). Sem isso, uma cor tipo
// `red;"><img src=x onerror=...>` virava código rodando no navegador
// de quem visse a badge (auditoria de 11/2026). O front também escapa
// esses campos, mas o servidor é a barreira que vale.
// ==================================================================

const HEX_COLOR_RE = /^#[0-9a-fA-F]{3,8}$/;

export const BADGE_SHAPES = ["classic", "rounded", "hex", "coin", "square", "circle"];

export function isHexColor(value: unknown): boolean {
    return typeof value === "string" && HEX_COLOR_RE.test(value);
}

// Ícone é uma chave de uma lista fixa no front (trophy, medal...).
export function isIconKey(value: unknown): boolean {
    return typeof value === "string" && /^[a-z0-9-]{1,32}$/.test(value);
}

// Só aceita imagem hospedada no próprio storage público do projeto,
// no bucket certo - nada de URL externa ou "javascript:".
export function isOwnStorageUrl(value: unknown, bucket: string): boolean {
    if (typeof value !== "string") return false;
    const base = `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/${bucket}/`;
    if (!value.startsWith(base)) return false;
    const rest = value.slice(base.length);
    return rest.length > 0 && /^[A-Za-z0-9._\-\/%]+$/.test(rest) && !rest.includes("..");
}
