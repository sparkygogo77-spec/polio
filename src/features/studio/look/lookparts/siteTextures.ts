/**
 * A SITE'S OWN TEXTURES, READ AT BRING-IN.
 *
 * J (2026-10-10), on PonsStars' TV: "the grainy noise effect that i can see
 * in the preview should be considered an original texture". A site brought
 * in keeps what its code painted on every part (`source.was.art`). Among
 * those backgrounds, the ones that are a texture (a tiled noise picture,
 * repeating lines, a small tiled pattern) are listed here, once each, so the
 * Texture row can offer them on ANY part as the site's own, and the saved
 * shelf can keep them. Shading (one gradient across a box), icons and photos
 * are not textures and stay out.
 *
 * A texture is worn as layers on the front of a part's `art.background`, so
 * the part's own shading stays under it and the style layer sends it back as
 * plain CSS: the same look on the board, in the preview and on the site.
 *
 * Pure: no store, no React. `tests/site-textures.mjs` holds it.
 */
import { splitTop, type Art } from "./siteDots.ts";

export interface SiteTexture {
  /** Stable for the same CSS: what saved and worn copies are matched by. */
  key: string;
  /** Short name for the tile: Noise, Lines, Dots, Pattern (numbered when a site has two). */
  name: string;
  /** The part it came from, by its hook (or label), for the tile's hint. */
  from: string;
  /** CSS lists, one entry per layer. */
  image: string;
  size: string;
  position: string;
  repeat: string;
}

type Layer = { image: string; size: string; position: string; repeat: string };

const decode = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };
const TILE = /^\s*[\d.]+(px|rem|em)(\s+[\d.]+(px|rem|em))?\s*$/;

/** What kind of texture one background layer is, or null when it is not one. */
export function textureKind(l: Layer): string | null {
  const img = l.image.trim();
  if (!img || img === "none") return null;
  if (/no-repeat/.test(l.repeat)) return null;
  if (/^repeating-(linear|radial|conic)-gradient\(/.test(img)) return /^repeating-linear/.test(img) ? "Lines" : "Rings";
  const tiled = TILE.test(l.size);
  if (/^url\(/.test(img)) {
    const body = decode(img);
    if (/data:image\/svg\+xml/.test(body)) {
      if (/feTurbulence/i.test(body)) return "Noise";
      if (/<pattern/i.test(body) && tiled) return "Pattern";
      return null;
    }
    return tiled ? "Pattern" : null;
  }
  if (/^radial-gradient\(/.test(img) && tiled) return "Dots";
  if (/^(linear|conic)-gradient\(/.test(img) && tiled) return "Pattern";
  return null;
}

/** A background as its layers (each with its own size, position, repeat). */
function layersOf(image: string, size?: string, position?: string, repeat?: string): Layer[] {
  const imgs = splitTop(image ?? "");
  const pick = (list: string[], i: number, d: string) => list[i] ?? list[list.length - 1] ?? d;
  const sizes = splitTop(size ?? ""), poss = splitTop(position ?? ""), reps = splitTop(repeat ?? "");
  return imgs.map((img, i) => ({ image: img, size: pick(sizes, i, "auto"), position: pick(poss, i, "0% 0%"), repeat: pick(reps, i, "repeat") }));
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim();
const join = (ls: Layer[], k: keyof Layer) => ls.map((l) => l[k]).join(", ");

/** The texture among these background layers (only its texture layers), or null. */
export function textureIn(image: string | undefined, size?: string, position?: string, repeat?: string): Omit<SiteTexture, "name" | "from"> & { kind: string } | null {
  if (!image) return null;
  const ls = layersOf(image, size, position, repeat).filter((l) => textureKind(l));
  if (!ls.length) return null;
  const kind = textureKind(ls[0]!)!;
  const t = { image: join(ls, "image"), size: join(ls, "size"), position: join(ls, "position"), repeat: join(ls, "repeat") };
  return { ...t, key: `${norm(t.image)}|${norm(t.size)}`, kind };
}

/** The texture a part's code painted when it was brought in (`source.was.art`). */
export function originalTexture(n: { source?: unknown }): ReturnType<typeof textureIn> {
  const was = (n.source as { was?: { art?: Record<string, string> } } | null | undefined)?.was?.art;
  return was ? textureIn(was["background-image"], was["background-size"], was["background-position"], was["background-repeat"]) : null;
}

/** The texture a part wears now on its own background (`art`). */
export function wornTexture(art: Art | null | undefined): ReturnType<typeof textureIn> {
  const o = art?.backgroundOptions ?? [];
  return textureIn(art?.background, o[0], o[1], o[2]);
}

/** Every texture a brought-in site's code painted, once each, in the order the parts come. */
export function siteTexturesOf(nodes: readonly { id: string; label?: string; source?: unknown }[]): SiteTexture[] {
  const out: SiteTexture[] = [];
  const seen = new Set<string>();
  const count = new Map<string, number>();
  for (const n of nodes) {
    const t = originalTexture(n);
    if (!t || seen.has(t.key)) continue;
    seen.add(t.key);
    const k = (count.get(t.kind) ?? 0) + 1;
    count.set(t.kind, k);
    const hook = (n.source as { hook?: { value?: string } } | null | undefined)?.hook?.value;
    const { kind, ...rest } = t;
    out.push({ ...rest, name: k > 1 ? `${kind} ${k}` : kind, from: hook || n.label || n.id });
  }
  return out;
}

/** A part's background with this texture on top of whatever is not a texture (its shading stays under it). */
export function wearTexture(art: Art | null | undefined, t: Pick<SiteTexture, "image" | "size" | "position" | "repeat"> | null): Art {
  const o = art?.backgroundOptions ?? [];
  const keep = layersOf(art?.background ?? "", o[0], o[1], o[2]).filter((l) => l.image !== "none" && !textureKind(l));
  const ls = [...(t ? layersOf(t.image, t.size, t.position, t.repeat) : []), ...keep];
  const next: Art = { ...(art ?? {}) };
  if (!ls.length) return { ...next, background: "none", backgroundOptions: undefined };
  return { ...next, background: join(ls, "image"), backgroundOptions: [join(ls, "size"), join(ls, "position"), join(ls, "repeat")] };
}

/*
 * SAVED TEXTURES: a shelf kept in this browser (J, 2026-10-10: "I should also
 * be able to save original textures"). Any site's texture saved here is
 * offered on every site built in this browser. Keys and accounts come later.
 */
export const SAVED_KEY = "builder.savedTextures";
export type SavedTexture = SiteTexture & { savedAt: string };

export function readSaved(store: Pick<Storage, "getItem"> | null | undefined): SavedTexture[] {
  try {
    const v = JSON.parse(store?.getItem(SAVED_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((t) => t && typeof t.key === "string" && typeof t.image === "string") : [];
  } catch { return []; }
}

export function writeSaved(store: Pick<Storage, "setItem"> | null | undefined, list: SavedTexture[]): void {
  try { store?.setItem(SAVED_KEY, JSON.stringify(list)); } catch { /* kept for this visit only */ }
}

/** The list with `t` kept (once: the same CSS is not saved twice). */
export function withSaved(list: SavedTexture[], t: SiteTexture, at = new Date().toISOString()): SavedTexture[] {
  return list.some((s) => s.key === t.key) ? list : [...list, { ...t, savedAt: at }];
}
