/**
 * The parts registry. One line per catalog id; the `DEFS` array is the source
 * of truth for which archetype draws which part and whether it can link.
 *
 * Adding a part: write an archetype (or add a branch to one), then add its id
 * here. Anything not listed still draws through `legacy.tsx` until it is
 * migrated, and finally the labelled-box fallback.
 */
import { Accordion } from "./Accordion";
import { Cta } from "./Cta";
import { Header } from "./Header";
import { SearchBox } from "./SearchBox";
import { Tabs } from "./Tabs";
import type { PartDef } from "./types";

export const DEFS: PartDef[] = [
  { component: Header, ids: ["sticky-header", "mega-menu", "mobile-nav", "home-anchor"], tier: "A", linkable: true },
  { component: SearchBox, ids: ["search-nav", "search-autocomplete", "ai-search"], tier: "A" },
  { component: Tabs, ids: ["tabs-panel"], tier: "A" },
  { component: Accordion, ids: ["accordion", "faq"], tier: "A" },
  { component: Cta, ids: ["cta-primary", "quick-action", "follow"], tier: "A", linkable: true },
];

export const PARTS: Record<string, PartDef> = Object.fromEntries(DEFS.flatMap((d) => d.ids.map((id) => [id, d])));

export function resolvePart(featureId: string): PartDef | null {
  return PARTS[featureId] ?? null;
}

export function isLinkable(featureId: string): boolean {
  return resolvePart(featureId)?.linkable === true;
}

export type { NodeLink, Part, PartDef, PartEvent, PartMode, PartProps } from "./types";
export { opt } from "./types";
export { items, themeFrom, titled, type Theme } from "./theme";
