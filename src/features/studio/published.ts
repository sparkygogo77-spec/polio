/**
 * The published document: what "Publish" pushed to `site/document.json`.
 *
 * On a deployment made from that push the app renders it at /site. The
 * /site page reads the file on the server and hands it to `PublishedPage`
 * as data (`src/app/(site)/site/[[...slug]]/page.tsx`): imported here, it
 * was compiled into the page's script, and a visitor's browser parsed the
 * whole document as code before drawing (sol face's: 1.3 MB of 3.4).
 */
export type Published = { pages?: unknown[]; nodes?: unknown[] };

/** Is there a published site in this document? */
export function hasPublished(doc: Published): boolean {
  return Array.isArray(doc.pages) && Array.isArray(doc.nodes) && doc.nodes.length > 0;
}
