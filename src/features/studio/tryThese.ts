/**
 * Parts to try: two or three working shelf items, from different categories,
 * for a roll's "Try these" section (`starterPage.ts`).
 *
 * Only what the published site really does is offered: an item is picked
 * when its badge says it works when published (`shelfFacts.ts#statusOf`),
 * it is a part rather than a switch for the whole site, and it is a part of
 * its own rather than a feature put on another (`work:` keys need a host).
 * Categories that are the page's own furniture (layout, navigation, the
 * first screen), the engine, and media (which would show a picture the
 * site does not have) are left to the shelf. Seeded, so a roll picks again
 * what it picked before.
 */
import { CATEGORIES, getFeature } from "./catalog";
import { doesOf, statusOf, switchOf } from "./shelfFacts";
import { shelfOf } from "./shelfPlan";
import { isWorkKey } from "./shelfGroups";
import { rng } from "./siteTheme";
import type { TryItem } from "./starterPage";

const SKIP = new Set(["structure", "nav", "hero", "platform", "media"]);

/** Every item the section may offer, by category. */
export function tryable(): Map<string, TryItem[]> {
  const out = new Map<string, TryItem[]>();
  for (const cat of CATEGORIES) {
    if (SKIP.has(cat.id)) continue;
    const list: TryItem[] = [];
    for (const { entries } of shelfOf(cat.id)) {
      for (const e of entries) {
        if (isWorkKey(e.key)) continue;
        const f = getFeature(e.key);
        if (!f || switchOf(e.key) || statusOf(f) !== "works") continue;
        list.push({ featureId: f.id, name: f.name, does: doesOf(f), category: cat.label, w: f.w ?? 400, h: f.h ?? 240 });
      }
    }
    if (list.length) out.set(cat.id, list);
  }
  return out;
}

/** Two or three items, each from a different category, chosen by the roll's seed. */
export function pickTryThese(seed: number, count = 3): TryItem[] {
  const r = rng(seed ^ 0x5bd1e995);
  const cats = [...tryable().entries()];
  const out: TryItem[] = [];
  const want = Math.min(count, cats.length);
  while (out.length < want && cats.length) {
    const [, list] = cats.splice(Math.floor(r() * cats.length), 1)[0]!;
    out.push(list[Math.floor(r() * list.length)]!);
  }
  return out;
}
