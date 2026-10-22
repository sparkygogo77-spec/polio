/**
 * What a document brings when it is loaded over the one in the store.
 *
 * `loadDoc` takes a published document (or one handed back from a build)
 * and lays it over the state: the pages, the parts, the look, and, since a
 * site designed at phone width was arriving at the default 1440 for every
 * visitor who did not build it, the frame width too. Pure, so the rule can
 * be held without a browser.
 */
import { captureNotes, sourceNote } from "./polioMd.ts";
import { attachCaptured, giveCopies } from "./shelf/index.ts";
import { learnFromDoc, type LearnState } from "./learn.ts";
import { standInFromDoc, type StandIn } from "./standIn.ts";
import { isTaken } from "./bring-in/index.ts";
export interface DocIn {
  pages?: { id: string }[];
  nodes?: unknown[];
  groups?: unknown[];
  shapes?: unknown[];
  spaces?: unknown[];
  format?: object;
  brief?: object;
  look?: object;
  motion?: unknown[];
  /** A capture's `@keyframes` (sink `doc.keyframes`): taken into the look. */
  keyframes?: unknown[];
  /** What the captured page's scripts did (sink `doc.behaviours`): attached to its parts as features, then dropped. */
  behaviours?: unknown;
  frameWidth?: unknown;
  /** The capture's "Functions not captured" hand-off, read beside the document at Bring (`repoRun.ts`). */
  handoff?: unknown;
  /** Where the document was brought in from: repository, folder, branch and commit (`repoRun.ts`). */
  source?: unknown;
  /** What the captured site said about itself in its head (sink `doc.head`): kept on the brief. Each page's own is on the page. */
  head?: unknown;
  /** The board as it was brought in (`reimport.ts`), when the document carries one: a document without it has none, never the last board's. */
  taken?: unknown;
}

export interface DocPrev {
  pages: { id: string }[];
  nodes: unknown[];
  groups: unknown[];
  shapes: unknown[];
  spaces: unknown[];
  brief: object;
  look: object;
  motion: unknown[];
  frameWidth: number;
}

/**
 * A layer a picture wears is the picture's, not the page's.
 *
 * A picture part carries its bytes as an image layer in the look's stack
 * (`node.texture`), and the part wears that layer whether or not it is on.
 * Left on, the same layer is also painted by the page or by every card —
 * his page came up with its logo tiled across the whole ground and every
 * panel, and the parts under it unreadable. So a layer some picture part
 * names is turned off for the page when a document is taken in, and stays
 * on the part. Pure, and applied wherever a document is loaded.
 */
export function pictureLayersOff<L extends { id: string; on?: boolean }>(nodes: readonly unknown[], layers: readonly L[]): L[] {
  const worn = new Set<string>();
  for (const n of nodes) {
    const node = n as { featureId?: unknown; texture?: unknown };
    if (node && node.featureId === "picture" && typeof node.texture === "string") worn.add(node.texture);
  }
  if (!worn.size) return [...layers];
  return layers.map((l) => (worn.has(l.id) && l.on ? { ...l, on: false } : l));
}

/**
 * The brief, with the captured head on it.
 *
 * The head is the site's link preview (`siteHead.ts`): kept whole, so the
 * export can say what the original said. The description is the one field
 * the Builder already had a box for, so a captured one fills that box when
 * nobody has typed one, and never over what somebody did. A document with
 * no head changes nothing here.
 */
function briefOf(prev: object, doc: DocIn): object {
  const brief = { ...prev, ...(doc.brief ?? {}) } as { description?: unknown; head?: unknown };
  /* The head is the document's: one whose brief has none does not keep the last site's. */
  if (doc.brief && !("head" in doc.brief)) delete brief.head;
  const head = doc.head && typeof doc.head === "object" ? (doc.head as { description?: unknown }) : null;
  if (!head) return brief;
  const typed = typeof brief.description === "string" && brief.description.trim();
  return { ...brief, head, ...(!typed && typeof head.description === "string" && head.description.trim() ? { description: head.description.trim() } : {}) };
}

/**
 * EVERY PART HAS OPTIONS. A part with none (the phone-width menu button a
 * widths import brought, `n_ctaprimary_small_1`, on one saved board) took
 * the whole board down on reopen: every shelf part reads `opt(options, …)`.
 * Each part is given `{}` where it has none; a list that needs nothing is
 * handed back as it was. Used on every document taken in and every board
 * read back (`persist.ts#mergeDoc`), so a board saved without them is
 * repaired as it opens (tests/options-missing.mjs).
 */
export function withOptions<T>(nodes: T[]): T[] {
  const missing = (n: T) => { const o = (n as { options?: unknown } | null)?.options; return !!n && typeof n === "object" && (!o || typeof o !== "object" || Array.isArray(o)); };
  return nodes.some(missing) ? nodes.map((n) => (missing(n) ? { ...n, options: {} } : n)) : nodes;
}

/**
 * A BOX'S BACKGROUND NAMES ITS OWN PICTURE, NOT THE SITE IT CAME FROM. A
 * capture keeps a picture layered with gradients as the whole stack on
 * `art.background` (thesolface's splash under its fade), and an older
 * capture wrote the picture's layer with the page's address
 * (`url("https://thesolface.site/assets/bg.webp")`): a published copy
 * fetched it from there, and broke if the site moved it. The layer names
 * the picture's own place in the published site (`picture.path`) instead;
 * the board and the page draw its file over it (`theme.ts#boxPicture`).
 * Used where `withOptions` is, so a board already saved is repaired as it
 * opens (tests/bg-stored.mjs).
 */
const PICTURE_LAYER = /url\(\s*(?!["']?data:)(?:"[^"]*"|'[^']*'|[^)]*)\)/;
export function storedStacks<T>(nodes: T[]): T[] {
  const fix = (n: T): T | null => {
    const m = n as { picture?: { path?: unknown } | null; art?: { background?: unknown } | null } | null;
    const path = typeof m?.picture?.path === "string" ? m.picture.path : "";
    const bg = typeof m?.art?.background === "string" ? m.art.background : "";
    if (!path || !/gradient\(/.test(bg) || !PICTURE_LAYER.test(bg)) return null;
    const next = bg.replace(PICTURE_LAYER, `url("${path.replace(/"/g, "%22")}")`);
    return next === bg ? null : ({ ...n, art: { ...m!.art, background: next } } as T);
  };
  let changed = false;
  const out = nodes.map((n) => { const f = fix(n); if (f) changed = true; return f ?? n; });
  return changed ? out : nodes;
}

export function takeDoc<P extends DocPrev>(
  s: P,
  doc: DocIn,
  defaults: { format: () => object; look: () => object },
) {
  const pages = doc.pages?.length ? doc.pages : s.pages;
  // A width is taken only when it is one: a positive number of pixels.
  const width = typeof doc.frameWidth === "number" && Number.isFinite(doc.frameWidth) && doc.frameWidth > 0 ? Math.round(doc.frameWidth) : s.frameWidth;
  return {
    pages,
    // A capture's script-driven motion arrives as features on its parts (library/captured.ts).
    // A copy button nothing was decided for copies what it sits beside (library/copyButton.ts).
    nodes: (() => {
      const nodes = doc.nodes && doc.behaviours ? attachCaptured(doc.nodes as Parameters<typeof attachCaptured>[0], doc.behaviours, doc.keyframes) : doc.nodes ?? s.nodes;
      return storedStacks(withOptions(giveCopies(nodes as Parameters<typeof giveCopies>[0]) as typeof nodes));
    })(),
    groups: doc.groups ?? s.groups,
    shapes: doc.shapes ?? s.shapes,
    spaces: doc.spaces ?? s.spaces,
    format: { ...defaults.format(), ...(doc.format ?? {}) },
    brief: briefOf(s.brief, doc),
    // The look and the behaviours are the document too. Leaving them out
    // meant a published site came back in the template's colours.
    look: (() => {
      const took = (doc.look ? { ...defaults.look(), ...doc.look } : s.look) as object & { texture?: { id: string; on?: boolean }[] };
      /* A capture writes the page's @keyframes beside the look; they travel in it, for the parts that name them. */
      const framed = Array.isArray(doc.keyframes) ? { ...took, keyframes: doc.keyframes } : took;
      /* What POLIO.md needs of the capture once its behaviours are dropped: each record and its part, the presses, the hand-off, the source (`polioMd.ts`). */
      const notes = captureNotes(doc.behaviours, { handoff: typeof doc.handoff === "string" ? doc.handoff : null, source: sourceNote(doc.source) });
      const look = notes ? { ...framed, capture: notes } : framed;
      return Array.isArray(look.texture) ? { ...look, texture: pictureLayersOff(doc.nodes ?? s.nodes, look.texture) } : look;
    })(),
    motion: doc.motion ?? s.motion,
    /* What the capture held back, and what a later one learned: beside the document, never in what is published (`learn.ts`). */
    learn: learnFromDoc(doc as Record<string, unknown>, (s as { learn?: LearnState }).learn),
    /* The capture's recorded reads and their samples, for the Stand-in server option; a new capture replaces them, a document with none keeps what was there. */
    standIn: standInFromDoc(doc as Record<string, unknown>) ?? ((doc as Record<string, unknown>).capturer ? null : (s as { standIn?: StandIn | null }).standIn ?? null),
    taken: isTaken(doc.taken) ? doc.taken : null,
    frameWidth: width,
    activePageId: pages[0]!.id,
    selection: [] as string[],
  };
}
