/**
 * The published document: what "Publish" pushed to `site/document.json`.
 *
 * On a deployment made from that push the app renders it at /site, and the
 * root redirects there (see next.config.ts). Here, in the repository, the
 * file is empty until something is published, and nothing reads it.
 */
import doc from "../../../site/document.json";

type Published = { pages?: unknown[]; nodes?: unknown[] };

export const PUBLISHED = doc as Published;

/** Is there a published site in the repository? */
export function hasPublished(): boolean {
  return Array.isArray(PUBLISHED.pages) && Array.isArray(PUBLISHED.nodes) && PUBLISHED.nodes.length > 0;
}
