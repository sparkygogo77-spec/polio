/**
 * A SYSTEM IN THE COLOURS OF A SITE J NAMED. A draft's plan says nothing about
 * colour (it is laid out and drawn by code), so a reference's colour roles reach
 * a draft here: a copy of the System it would be drawn in, its six roles the
 * reference's. Faces, sizes, space and corners stay the System's own, and the
 * System itself is not touched.
 *
 * Pure: every import ends in .ts, so node tests load it.
 */
import { contrast, parseColor, ROLES, type Palette } from "../look/index.ts";
import { newSystemId, type ColourToken, type System } from "../system/model.ts";

const ROLE_NAME: Record<(typeof ROLES)[number], string> = { bg: "Background", surface: "Surface", text: "Text", muted: "Muted text", accent: "Accent", highlight: "Highlight" };

/** The ink that reads best on this fill, of the two the palette offers. */
function onFill(fill: string, p: Palette): string {
  const f = parseColor(fill);
  const [a, b] = [parseColor(p.bg), parseColor(p.text)];
  if (!f || !a || !b) return p.bg;
  return contrast(f, a) >= contrast(f, b) ? p.bg : p.text;
}

export function systemInColours(system: System, palette: Palette, host: string, at = Date.now()): System {
  const roles = ROLES.filter((r) => parseColor(palette[r]));
  const colour: ColourToken[] = system.tokens.colour.map((t) => {
    if (t.role && roles.includes(t.role)) return { ...t, value: palette[t.role] };
    if (t.use === "Buttons") return { ...t, value: onFill(palette.accent, palette) };
    if (t.use === "Outline") return { ...t, value: palette.muted };
    return t;
  });
  roles.filter((r) => !colour.some((t) => t.role === r)).forEach((r, i) => colour.push({ id: `col_ref_${i + 1}`, name: ROLE_NAME[r], value: palette[r], role: r }));
  return { ...system, id: newSystemId(), name: `${system.name}, colours of ${host}`.slice(0, 80), house: undefined, editedAt: at, tokens: { ...system.tokens, colour } };
}
