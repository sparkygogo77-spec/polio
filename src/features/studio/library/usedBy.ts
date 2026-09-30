/**
 * Which shelf items one part uses (owner note R14).
 *
 * HIS NOTE: when a part is picked on the board, the shelf shows which shelf
 * items that part uses: its motions, its behaviours, its version. So a
 * person looking at a captured button that lifts and blinks can find, on the
 * shelf, the cards that do those things, and take them for another part.
 *
 * Read off the node, the same way the shelf files a capture's effects
 * (`siteVersions.ts`), so the two cannot disagree:
 *
 *   · WHAT IT IS: the card its part stands under, and which version of it
 *     (a Questions and answers part is the Folding rows card, that version);
 *   · WHAT IT CARRIES: every library feature on it (`node.work`) that is
 *     switched on, as the card that feature is filed under;
 *   · WHAT ITS PAGE GAVE IT: a stylesheet `:hover` that moves it (Lift on
 *     hover), a keyframe loop that turns, travels or fades (Spin, Float,
 *     Blink), another page shown inside it (Embed).
 *
 * Pure: no store, no React. `tests/used-by-part.mjs`.
 */
import { VARIANTS, itemOf } from "../shelfPlan.ts";
import { getWork, usesOf, type WorkUse } from "./works.ts";
import { loopKind } from "./siteVersions.ts";

export interface Use {
  /** The shelf card (a catalogue id or `work:<id>`). */
  item: string;
  /** The version of it the part uses: a catalogue id or `work:<id>`, for opening the card at it. */
  version: string;
  /** How the part uses it, in a word: what it is, what it carries, or what its page gave it. */
  via: "is" | "carries" | "captured";
  /** The version's own words, when the card has versions. */
  label: string;
}

interface Part {
  featureId: string;
  work?: WorkUse | null;
  motion?: { animation?: { name: string }[]; hover?: { style?: Record<string, string> }[]; off?: boolean } | null;
  embed?: { src?: string } | null;
}

interface Frames { name: string; frames: { key: string; style: Record<string, string> }[] }

const MOVES = /^(transform|translate|rotate|scale|top|margin-top)$/;

/** The label a version wears on its card, or "" for a card with none. */
function versionLabel(item: string, version: string): string {
  const v = VARIANTS[item];
  if (!v) return "";
  if (version === item) return v.self;
  return v.more.find((m) => m.key === version)?.label ?? "";
}

/** The shelf items a part uses, each once, what it is first. */
export function usedByPart(node: Part, keyframes: readonly Frames[] = []): Use[] {
  const out: Use[] = [];
  const add = (version: string, via: Use["via"]) => {
    const item = itemOf(version);
    if (!item || out.some((u) => u.item === item)) return;
    out.push({ item, version, via, label: versionLabel(item, version) });
  };
  add(node.featureId, "is");
  for (const u of usesOf(node.work)) if (!u.off && getWork(u.id)) add(`work:${u.id}`, "carries");
  if (node.embed?.src) add("work:embed", "captured");
  const m = node.motion;
  if (m && !m.off) {
    if ((m.hover ?? []).some((h) => Object.keys(h.style ?? {}).some((p) => MOVES.test(p)))) add("work:hover-lift", "captured");
    const frames = new Map(keyframes.flatMap((k) => [[k.name, k], [`cap-${k.name}`, k]] as [string, Frames][]));
    for (const a of m.animation ?? []) {
      const kind = loopKind(frames.get(a.name));
      if (kind) add(`work:${kind}`, "captured");
    }
  }
  return out;
}
