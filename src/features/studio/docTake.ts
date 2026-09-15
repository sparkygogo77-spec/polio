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
    look: doc.look ? { ...defaults.look(), ...doc.look } : s.look,
    motion: doc.motion ?? s.motion,
    frameWidth: width,
    activePageId: pages[0]!.id,
    selection: [] as string[],
  };
}
