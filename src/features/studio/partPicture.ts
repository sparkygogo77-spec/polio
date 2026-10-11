/**
 * A PICTURE AS A PART'S LOOK, SENT WITH THE DESIGN FOR THE CODE TO APPLY.
 *
 * HIS WORDS: "for this button i would like to maybe generate an image or
 * take any image and drop it in and the code chat upon my next upload to a
 * branch gets the idea instantly and does it". The trade buttons on
 * PonsStars were the example; it holds for any part with a data-hook.
 *
 * So the Contents plate takes a picture (a file, a link, or one dragged off
 * the Render panel) as the part's *look*, never as a new part: the part
 * keeps its hook, its words and what it does. The Builder finds the
 * picture's real edges (`trimBox`), because a picture cropped loosely, or
 * not at all, is the usual case. "Send the design back" then carries it:
 *
 *   design/pictures/<hook>.<ext>   the picture, untouched
 *   design/pictures.json           which hook wears it, where its edges are,
 *                                  and his note; and under `removed`, each
 *                                  hook the repo's list named that no
 *                                  longer wears one (his X), so the code
 *                                  takes that look away again
 *
 * and the code chat applies it by BUILDER-RULES.md "Pictures on parts".
 * The Builder never writes it into the page itself: a builder-ready site
 * serves only its own folder, and design/ is not in it.
 *
 * Pure, so tests/part-picture.mjs reads it without a browser.
 */

/** Where the pictures go on the design branch, beside design/record.json. */
export const PICTURES_DIR = "design/pictures/";
export const PICTURES_LIST = "design/pictures.json";

export interface Box { x: number; y: number; w: number; h: number }

/** What a part keeps: the stored picture (`pictures.ts`), its edges, and what he said about it. */
export interface LookPicture {
  picture: { id: string; path: string; type: string; w: number; h: number; bytes: number; alt: string };
  /** The picture's own edges inside its canvas: what is left when a plain or see-through margin is cut off. */
  crop: Box | null;
  /** Anything he wants the code to know: "keep the label", "glow on hover". */
  note?: string;
}

/**
 * The box round what the picture actually shows.
 *
 * The background is what the four corners agree on: see-through when they
 * are, else their shared colour within `tolerance` (0 to 255 per channel).
 * Corners that disagree mean there is no plain margin, and the whole
 * picture is the box. `rgba` is the picture's pixels, four bytes each.
 */
export function trimBox(rgba: ArrayLike<number>, w: number, h: number, tolerance = 24): Box {
  const whole = { x: 0, y: 0, w, h };
  if (w <= 0 || h <= 0 || rgba.length < w * h * 4) return whole;
  const at = (x: number, y: number) => (y * w + x) * 4;
  const corners = [at(0, 0), at(w - 1, 0), at(0, h - 1), at(w - 1, h - 1)];
  const clear = corners.every((i) => rgba[i + 3]! < 16);
  const c0 = corners[0]!;
  const same = (i: number, j: number) => Math.abs(rgba[i]! - rgba[j]!) <= tolerance && Math.abs(rgba[i + 1]! - rgba[j + 1]!) <= tolerance && Math.abs(rgba[i + 2]! - rgba[j + 2]!) <= tolerance && Math.abs(rgba[i + 3]! - rgba[j + 3]!) <= tolerance;
  if (!clear && !corners.every((i) => same(i, c0))) return whole;
  const isBack = clear ? (i: number) => rgba[i + 3]! < 16 : (i: number) => same(i, c0);
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (isBack(at(x, y))) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return whole;
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** The shape of a board part this reads. */
export interface PictureNode {
  label?: string;
  hooks?: Record<string, string> | null;
  source?: { hook?: { attr?: string; value?: string } | null } | null;
  lookPicture?: LookPicture | null;
}

export const hookOf = (n: PictureNode): string | null => n.hooks?.["data-hook"] ?? (n.source?.hook?.attr === "data-hook" ? n.source.hook.value ?? null : null);

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif", "image/svg+xml": "svg" };

/** Each hooked part wearing a picture, with the file it goes to. A part with no hook has nothing for the code to find, so it is left out and said. */
export function partPictures(nodes: readonly PictureNode[]): { list: { hook: string; label: string; file: string; look: LookPicture }[]; unhooked: string[] } {
  const list: { hook: string; label: string; file: string; look: LookPicture }[] = [];
  const unhooked: string[] = [];
  const seen = new Set<string>();
  for (const n of nodes) {
    if (!n.lookPicture?.picture) continue;
    const hook = hookOf(n);
    if (!hook) { unhooked.push(n.label ?? "a part"); continue; }
    if (seen.has(hook)) continue;
    seen.add(hook);
    const safe = hook.replace(/[^A-Za-z0-9_-]+/g, "-");
    list.push({ hook, label: n.label ?? hook, file: `${PICTURES_DIR}${safe}.${EXT[n.lookPicture.picture.type] ?? "png"}`, look: n.lookPicture });
  }
  return { list, unhooked };
}

/** design/pictures.json: what the code chat reads (BUILDER-RULES.md "Pictures on parts"). `removed`: hooks whose picture look he took off since the last send. */
export function picturesJson(list: ReturnType<typeof partPictures>["list"], removed: readonly string[] = []): string {
  return `${JSON.stringify({
    about: `Pictures J put on parts in the builder. Apply each as that part's look by BUILDER-RULES.md "Pictures on parts": same element, same data-hook, same behaviour.${removed.length ? " A hook under removed: take its picture look away and show the part's own words again." : ""}`,
    pictures: list.map((p) => ({
      hook: p.hook,
      label: p.label,
      file: p.file,
      size: { w: p.look.picture.w, h: p.look.picture.h },
      crop: p.look.crop,
      ...(p.look.note?.trim() ? { note: p.look.note.trim() } : {}),
    })),
    ...(removed.length ? { removed } : {}),
  }, null, 2)}\n`;
}

/** The hooks under `key` in a design/pictures.json: nothing when there is none, or it is not JSON. */
function listedHooks(text: string | null | undefined, key: "pictures" | "removed"): string[] {
  if (!text) return [];
  try {
    const got = (JSON.parse(text) as Record<string, unknown>)[key];
    const hooks = Array.isArray(got) ? got.map((p) => (typeof p === "string" ? p : (p as { hook?: unknown } | null)?.hook)) : [];
    return hooks.filter((h): h is string => typeof h === "string" && !!h);
  } catch {
    return [];
  }
}

/** The hooks a design/pictures.json already in the repo gives a picture: what the last send put there. */
export const sentHooks = (text: string | null | undefined): string[] => listedHooks(text, "pictures");

/** The hooks a design/pictures.json asks the code to take the picture off (the pull request says them). */
export const removedPictures = (text: string | null | undefined): string[] => listedHooks(text, "removed");

/**
 * The files a send adds: each picture (base64, from `bytes`) and the list. A picture whose bytes this browser no longer has is said, not sent.
 * `before` is the hooks the repo's list already names (`sentHooks`): one no part wears any more is listed under `removed`, so his X reaches the site too.
 */
export async function pictureFiles(nodes: readonly PictureNode[], bytes: (look: LookPicture) => Promise<string | null>, before: readonly string[] = []): Promise<{ files: { path: string; content: string; encoding?: "base64" }[]; missing: string[]; unhooked: string[]; removed: string[] }> {
  const { list, unhooked } = partPictures(nodes);
  const files: { path: string; content: string; encoding?: "base64" }[] = [];
  const kept: typeof list = [];
  const missing: string[] = [];
  for (const p of list) {
    const data = await bytes(p.look);
    if (!data) { missing.push(p.hook); continue; }
    files.push({ path: p.file, content: data, encoding: "base64" });
    kept.push(p);
  }
  /* A part still wearing its picture, only not in this browser, keeps it: that is not a removal. */
  const worn = new Set(list.map((p) => p.hook));
  const removed = [...new Set(before)].filter((h) => !worn.has(h));
  if (kept.length || removed.length) files.push({ path: PICTURES_LIST, content: picturesJson(kept, removed) });
  return { files, missing, unhooked, removed };
}
