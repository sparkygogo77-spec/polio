/**
 * THE PARTS SOMETHING OFF THE BOARD IS POINTING AT.
 *
 * Hover a row in the Elements list, a swatch on the Colours preview, a
 * "make all like" facet: those parts glow on the board (`SiteColours.tsx`
 * `pointAt`). They used to get a grey frame each, drawn over the board from
 * the part's box and measured again every frame for as long as the hand
 * stayed; frames are rectangles, so round buttons got square rings, and
 * parts that sit close together got rings on top of each other (J,
 * 2026-10-09). Now the part itself glows: a neon blue `drop-shadow` on what
 * it paints (globals.css, `[data-point-mark]`), which follows its own
 * corners and outline and hugs it closely enough that neighbours stay apart.
 *
 * Nothing runs while the hand rests: the event says which parts, each part
 * reads one boolean from here, and only the parts whose answer changed draw
 * again. No copies, no overlay, no measuring.
 */
const POINT = "studio:point-at";

let pointed: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();

function set(ids: readonly string[] | null) {
  const next = new Set(ids ?? []);
  if (next.size === pointed.size && [...next].every((id) => pointed.has(id))) return;
  pointed = next;
  for (const l of listeners) l();
}

/* One listener for the whole app, so a test or any other part of it can point with the event alone. */
if (typeof window !== "undefined") window.addEventListener(POINT, (e) => set((e as CustomEvent<string[] | null>).detail));

export function pointParts(ids: readonly string[] | null) {
  window.dispatchEvent(new CustomEvent(POINT, { detail: ids }));
}

export function subscribePointed(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export const isPointed = (id: string): boolean => pointed.has(id);
