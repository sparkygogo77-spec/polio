/**
 * What a document brings when it is loaded over the one in the store.
 *
 * `loadDoc` takes a published document (or one handed back from a build)
 * and lays it over the state: the pages, the parts, the look, and, since a
 * site designed at phone width was arriving at the default 1440 for every
 * visitor who did not build it, the frame width too. Pure, so the rule can
 * be held without a browser.
 */
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
  frameWidth?: unknown;
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
    nodes: doc.nodes ?? s.nodes,
    groups: doc.groups ?? s.groups,
    shapes: doc.shapes ?? s.shapes,
    spaces: doc.spaces ?? s.spaces,
    format: { ...defaults.format(), ...(doc.format ?? {}) },
    brief: { ...s.brief, ...(doc.brief ?? {}) },
    // The look and the behaviours are the document too. Leaving them out
    // meant a published site came back in the template's colours.
    look: (() => {
      const look = (doc.look ? { ...defaults.look(), ...doc.look } : s.look) as object & { texture?: { id: string; on?: boolean }[] };
      return Array.isArray(look.texture) ? { ...look, texture: pictureLayersOff(doc.nodes ?? s.nodes, look.texture) } : look;
    })(),
    motion: doc.motion ?? s.motion,
    frameWidth: width,
    activePageId: pages[0]!.id,
    selection: [] as string[],
  };
}
