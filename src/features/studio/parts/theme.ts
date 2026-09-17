/**
 * The theme a part wears, derived from the Format panel.
 *
 * Only `themeFrom` knows about the Builder's format ids; a generated site can
 * hand parts a `Theme` object built any other way.
 */
import type * as React from "react";
import type { FormatValues } from "../format";
import { liftCss, css as cssColour, lands, paletteFromHue, parseColor, contrast, textureCss, withAlpha, ROLES, type Light, type Look, type Palette, type RoleId } from "../look";

// Re-exported so the primitives can tint a role without reaching outside
// `parts/` — see `types.ts` for why that line matters.
export { withAlpha };

export interface Theme {
  bg: string;
  surface: string;
  line: string;
  text: string;
  muted: string;
  accent: string;
  /** A second colour for emphasis, distinct from the accent. */
  highlight: string;
  accentText: string;
  /** When a texture is set, the full background properties for the page. */
  surfaceStyle?: React.CSSProperties;
  /** When the texture is painted on surfaces, the properties every card wears. */
  surfacePaint?: React.CSSProperties;
  /**
   * The opaque floor every part paints under itself.
   *
   * A texture behind the page is behind the *page* — the site stands on it.
   * Parts are transparent by default, so without this the picture reads
   * straight through every section, bar and card, and "behind the page",
   * "on surfaces" and "both" all come out looking the same. Set only when a
   * layer actually lands behind the page; otherwise nothing changes.
   */
  partGround?: string;
  /** A layer set to "over everything", painted above the finished page. */
  overlayStyle?: React.CSSProperties;
  /** A dim over the whole page — black at the look's veil opacity — when there is one. */
  veil?: string;
  /** Set only when a part overrides its own background, so `Fill` paints it. */
  ownBackground?: string;
  /**
   * The shadow this part throws, worked out from where it stands relative to
   * the page's light. Unset when there is no light, and then nothing changes.
   */
  shadow?: string;
  /** A sheen on the face turned toward the light, as a CSS gradient. */
  sheen?: string;
  /** Which way the light is coming from, for a part drawing its own depth. */
  lightFrom?: { x: number; y: number };
  radius: number;
  light: boolean;
  backdrop: string;
  /** Body size in px from the type settings. */
  fontPx: number;
  lineHeight: number;
  measurePx: number;
  textAlign: "left" | "center" | "justify";
  boxStyle: string;
  boxPad: number;
  headingFamily: string;
  bodyFamily: string;
  /** Set only when a part has its own type; `Fill` puts them on the root and text inherits them. */
  fontWeight?: number;
  letterSpacing?: string;
  /**
   * What the site is called, straight off the brief.
   *
   * The brief binds it: "wherever a logo or wordmark is drawn it reads
   * <name>, never Logo". Two parts wrote "Logo" anyway, so the published
   * page introduced his site under a word he never typed. A wordmark reads
   * this; when the site has no name yet, there is nothing to read and the
   * part says so rather than inventing one.
   */
  siteName?: string;
  /**
   * True when this render is the page a visitor will be served.
   *
   * THE PUBLISH BOUNDARY, and the one rule across it: fail loudly in the
   * Builder, never on the published site. He is the only person who needs
   * to know a part did not render; a visitor must never see the
   * scaffolding. So a part that would say "not written yet" where he is
   * building says nothing at all where a stranger is reading — the page
   * shows what was built and omits what was not — and everything the
   * publish found is listed for him instead, beside the button.
   *
   * It is the absolute rule as well: the site never mentions him, the
   * chats, the models, or how the work is made, and "nothing has been
   * built for it yet" is a sentence about how the work is made.
   */
  published?: boolean;
}

/**
 * A part's own type, over the site's.
 *
 * Every field is optional and relative where it can be: `size` scales the
 * site's base size rather than replacing it, so a part set a shade larger
 * stays a shade larger when the site's type changes. `family` is one of the
 * `FAMILY` keys and sets headings and body alike for this one part.
 */
export interface NodeFont {
  family?: string;
  /**
   * The family's real name, off a page it was read from, carried whether
   * or not its file is on this machine: first on the stack, so it shows
   * where it is installed, with the class behind it where it is not.
   */
  face?: string;
  /** Multiplier on the site's base size, 0.6..2. */
  size?: number;
  /** 300..800. Body text takes it; parts that set their own weights keep them. */
  weight?: number;
  /** In em, -0.05..0.3. */
  spacing?: number;
  /** Line height, 1..2. */
  leading?: number;
}

export function applyFont(t: Theme, font: NodeFont | null | undefined): Theme {
  if (!font) return t;
  const next: Theme = { ...t };
  const stack = font.family ? FAMILY[font.family] : undefined;
  const face = typeof font.face === "string" ? font.face.trim().replace(/['"]/g, "") : "";
  if (face || stack) {
    next.headingFamily = [face ? `'${face}'` : null, stack ?? t.headingFamily].filter(Boolean).join(", ");
    next.bodyFamily = [face ? `'${face}'` : null, stack ?? t.bodyFamily].filter(Boolean).join(", ");
  }
  if (typeof font.size === "number" && Number.isFinite(font.size)) next.fontPx = Math.round(t.fontPx * Math.max(0.6, Math.min(2, font.size)) * 10) / 10;
  if (typeof font.weight === "number" && Number.isFinite(font.weight)) next.fontWeight = Math.round(Math.max(300, Math.min(800, font.weight)) / 100) * 100;
  if (typeof font.spacing === "number" && Number.isFinite(font.spacing)) next.letterSpacing = `${Math.max(-0.05, Math.min(0.3, font.spacing)).toFixed(3)}em`;
  if (typeof font.leading === "number" && Number.isFinite(font.leading)) next.lineHeight = Math.max(1, Math.min(2, font.leading));
  return next;
}

export const FAMILY: Record<string, string> = {
  "geometric sans": "'Avenir Next', 'Futura', 'Century Gothic', ui-sans-serif, sans-serif",
  "grotesque sans": "'Helvetica Neue', Inter, Arial, ui-sans-serif, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  display: "'Impact', 'Arial Black', ui-sans-serif, sans-serif",
  condensed: "'Arial Narrow', 'Roboto Condensed', ui-sans-serif, sans-serif",
  monospace: "ui-monospace, 'SF Mono', Menlo, monospace",
  handwritten: "'Segoe Print', 'Comic Sans MS', cursive",
  "system sans": "ui-sans-serif, system-ui, sans-serif",
  "humanist sans": "'Segoe UI', 'Trebuchet MS', ui-sans-serif, sans-serif",
};

/** The six roles a part can paint with, after any overrides you set. */
export function resolvePalette(format: FormatValues, look?: Look): Palette {
  const hue = Number(format["palette.accentHue"] ?? 265);
  const mode = String(format["palette.mode"] ?? "dark");
  const base = paletteFromHue(hue, mode === "light" || mode === "both");
  // Only a role that is a colour overrides: a role left in the record with
  // nothing in it used to overwrite the derived colour with that nothing,
  // and the first thing to read it as a colour took the page down.
  const overrides = Object.fromEntries(Object.entries(look?.palette ?? {}).filter(([, v]) => typeof v === "string" && v.trim().length > 0));
  return { ...base, ...overrides } as Palette;
}

export function themeFrom(format: FormatValues, look?: Look, siteName?: string): Theme {
  const hue = Number(format["palette.accentHue"] ?? 265);
  const mode = String(format["palette.mode"] ?? "dark");
  const light = mode === "light" || mode === "both";
  const radius = Number(format["layout.radius"] ?? 10);
  const background = String(format["palette.background"] ?? "flat");
  const align = String(format["type.align"] ?? "left");

  // A palette override wins over anything derived from the hue. The background
  // role is the background — the accent hue only fills in when nothing has been
  // chosen, and the flourishes below are painted *over* whatever it ends up as.
  const roles = resolvePalette(format, look);
  const backdrop =
    background === "subtle gradient" || background === "mesh gradient"
      ? `radial-gradient(120% 80% at 20% 0%, oklch(0.7 0.14 ${hue} / 0.2), transparent 70%), ${roles.bg}`
      : background === "grid"
        ? `linear-gradient(${light ? "oklch(0 0 0 / .05)" : "oklch(1 0 0 / .05)"} 1px, transparent 1px), linear-gradient(90deg, ${light ? "oklch(0 0 0 / .05)" : "oklch(1 0 0 / .05)"} 1px, transparent 1px), ${roles.bg}`
        : roles.bg;

  // Each layer says where it lands, so one texture can dress the page while
  // another dresses the cards.
  const layers = look?.texture?.filter((l) => l.on) ?? [];
  const onPage = layers.filter((l) => lands(l, "page"));
  const onCards = layers.filter((l) => lands(l, "surfaces"));
  const onTop = layers.filter((l) => lands(l, "over"));
  const painted = onPage.length ? textureCss(onPage, roles, roles.bg) : null;
  const onSurfaces = onCards.length ? textureCss(onCards, roles, roles.surface) : null;
  const over = onTop.length ? textureCss(onTop, roles, "transparent") : null;

  return {
    bg: roles.bg,
    backdrop: painted ? "" : backdrop,
    /** When a texture is set, this is the whole set of background properties. */
    surfaceStyle: painted ?? undefined,
    surfacePaint: onSurfaces ?? undefined,
    overlayStyle: over ?? undefined,
    veil: look?.veil && look.veil > 0.005 ? `oklch(0 0 0 / ${Math.min(0.85, look.veil).toFixed(2)})` : undefined,
    // Only a texture behind the page needs to be covered up.
    partGround: painted ? roles.bg : undefined,
    surface: roles.surface,
    line: light ? `oklch(0.88 0.01 ${hue})` : `oklch(0.31 0.014 ${hue})`,
    text: roles.text,
    muted: roles.muted,
    accent: roles.accent,
    highlight: roles.highlight,
    accentText: light ? `oklch(0.99 0.01 ${hue})` : `oklch(0.16 0.03 ${hue})`,
    radius,
    light,
    fontPx: Number(format["type.baseSize"] ?? 16),
    lineHeight: Number(format["type.lineHeight"] ?? 1.55),
    siteName: siteName?.trim() || undefined,
    measurePx: Math.round(Number(format["type.measure"] ?? 66) * 8.2),
    textAlign: align === "center" ? "center" : align === "justified" ? "justify" : "left",
    boxStyle: String(format["type.textBox"] ?? "plain"),
    boxPad: Number(format["type.boxPadding"] ?? 16),
    headingFamily: FAMILY[String(format["type.headingFamily"] ?? "geometric sans")] ?? FAMILY["geometric sans"]!,
    bodyFamily: FAMILY[String(format["type.bodyFamily"] ?? "system sans")] ?? FAMILY["system sans"]!,
  };
}

/** "a, b, c" → ["a","b","c"], with a fallback list when nothing is typed. */
export function items(content: string, fallback: string[]): string[] {
  /*
   * One item per line when there are lines, else one per comma. A content
   * typed on one line, "Home, About, Contact", is a list by its commas; a
   * content with lines in it is a list by its lines, and a comma inside a
   * line is the line's own. A first screen recreated from a real page had
   * its headline "…for testing, scripting, and AI agents." cut at its
   * commas into three items, and the part drew the first as the line and
   * the second as the sentence under it.
   */
  const list = (content.includes("\n") ? content.split("\n") : content.split(",")).map((s) => s.trim()).filter(Boolean);
  return list.length ? list : fallback;
}

/** "Title: body" → { title, body }. Body is null when no colon was typed. */
export function titled(item: string): { title: string; body: string | null } {
  const i = item.indexOf(":");
  if (i <= 0) return { title: item.trim(), body: null };
  return { title: item.slice(0, i).trim(), body: item.slice(i + 1).trim() || null };
}

export function radiusFor(shape: string | undefined, t: Theme): number {
  if (shape === "pill") return 999;
  if (shape === "square") return 0;
  if (shape === "underlined") return 0;
  return t.radius;
}

export function boxStyles(t: Theme): React.CSSProperties {
  const base: React.CSSProperties = { borderRadius: t.radius, padding: t.boxPad };
  switch (t.boxStyle) {
    case "bordered": return { ...base, border: `1px solid ${t.line}` };
    case "filled": return { ...base, background: t.surface };
    case "card": return { ...base, background: t.surface, border: `1px solid ${t.line}`, boxShadow: `0 4px 14px ${t.light ? "oklch(0 0 0 / .08)" : "oklch(0 0 0 / .35)"}` };
    case "underlined": return { ...base, borderBottom: `2px solid ${t.line}`, borderRadius: 0 };
    case "quoted": return { ...base, borderLeft: `4px solid ${t.accent}`, borderRadius: 0 };
    case "inset shadow": return { ...base, background: t.surface, boxShadow: `inset 0 2px 8px ${t.light ? "oklch(0 0 0 / .08)" : "oklch(0 0 0 / .4)"}` };
    default: return { ...base, padding: 0 };
  }
}

/** The surface-card look every boxed part shares. */
export function cardStyle(t: Theme): React.CSSProperties {
  return {
    background: t.surface,
    ...(t.surfacePaint ?? {}),
    border: `1px solid ${t.line}`,
    borderRadius: t.radius,
    ...(t.shadow ? { boxShadow: t.shadow } : {}),
  };
}

/**
 * The same card drawn as an outline: a slot, a placeholder, a drop target.
 *
 * A helper rather than `{ ...cardStyle(t), borderStyle: "dashed" }`, which is
 * what nine parts did and what React warns about on every render — a
 * shorthand (`border`) and one of its longhands set on the same element, from
 * which the browser takes whichever it applied last. Same picture, one
 * property.
 */
export function ghostStyle(t: Theme, colour?: string): React.CSSProperties {
  return { ...cardStyle(t), border: `1px dashed ${colour ?? t.line}` };
}

/**
 * A part can repaint any of the six roles for itself. A value is either a
 * colour, or the name of another role — "make this one's background the
 * accent" — which is how a single element is picked out without inventing a
 * colour that belongs to nothing.
 */
export type NodeColour = Partial<Record<RoleId, string>>;

/**
 * The same theme, but knowing where this box stands under the page's light.
 *
 * `cx`/`cy` are the box's centre as fractions of the page. Everything a part
 * needs — the shadow it throws, the sheen on its lit face — is worked out
 * here, so a part never has to know about the lamp or its own position.
 */
export function liftTheme(t: Theme, light: Light | undefined, cx: number, cy: number): Theme {
  if (!light?.on) return t;
  const css = liftCss(light, cx, cy);
  if (!css) return t;
  const away = Math.hypot(cx - light.x, cy - light.y) || 0.0001;
  const from = { x: (light.x - cx) / away, y: (light.y - cy) / away };
  /*
   * Through a variable, with the committed value as the fallback.
   *
   * A part reads `t.shadow` and puts it in its own `box-shadow`, which means
   * moving the lamp used to mean re-rendering every part. Written as
   * `var(--lift-shadow, …)` the same string still arrives when nothing is
   * being dragged — the fallback is exactly what this function used to return
   * — and while the sun is in somebody's hand `lightRig.ts` sets the variable
   * on each part's box instead, once a frame, with no render at all.
   */
  return { ...t, shadow: `var(--lift-shadow, ${css.shadow})`, sheen: `var(--lift-sheen, ${css.sheen})`, lightFrom: from };
}

export function overrideTheme(t: Theme, colour: NodeColour, palette: Palette): Theme {
  const resolve = (v: string): string | null => {
    const trimmed = v.trim();
    if (!trimmed) return null;
    if ((ROLES as readonly string[]).includes(trimmed)) return palette[trimmed as RoleId];
    return parseColor(trimmed) ? trimmed : null;
  };
  const next: Theme = { ...t };
  let touched = false;
  for (const role of ROLES) {
    const raw = colour[role];
    if (!raw) continue;
    const value = resolve(raw);
    if (!value) continue;
    touched = true;
    next[role] = value;
    if (role === "bg") {
      next.ownBackground = value;
      // The page's texture belongs to the page, not to a part that repaints itself.
      next.surfaceStyle = undefined;
      next.partGround = undefined;
    }
    if (role === "surface") next.surfacePaint = undefined;
  }
  if (!touched) return t;
  /*
   * A ground with nothing standing on it.
   *
   * Most parts fill their own box with a card, so painting only the ground
   * behind them changed nothing you could see and the control read as broken.
   * When the background is set on its own, the surfaces and the lines that go
   * with it move too — the same step apart the palette keeps them, in the same
   * direction. Say what the surface should be and this stands aside.
   */
  if (colour.bg && !colour.surface) {
    const ground = parseColor(next.bg);
    if (ground) {
      const step = t.light ? -0.035 : 0.05;
      next.surface = cssColour({ ...ground, l: Math.max(0, Math.min(1, ground.l + step)) });
      next.line = cssColour({ ...ground, l: Math.max(0, Math.min(1, ground.l + step * 2.6)) });
    }
  }
  // Whatever sits on the accent has to stay readable against it.
  const accent = parseColor(next.accent);
  if (accent) {
    const dark = parseColor("oklch(0.16 0.02 0)")!;
    const light = parseColor("oklch(0.99 0 0)")!;
    next.accentText = contrast(accent, dark) >= contrast(accent, light) ? "oklch(0.16 0.02 0)" : "oklch(0.99 0 0)";
  }
  return next;
}
