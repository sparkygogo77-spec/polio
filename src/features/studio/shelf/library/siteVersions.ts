/**
 * What a captured site brought that the shelf can offer again: its own
 * versions of the effects on the shelf.
 *
 * HIS ASK: when a capture brings in a new feature or element (the
 * behaviours and effects sink records), it appears on the shelf in the right
 * category, deduplicated against the catalogue (same effect, same item,
 * with the site's version as a variation), with its own editing options,
 * and marked as working from that site.
 *
 * A capture lands its effects in two ways, and both are read here, off the
 * board, so nothing new has to be kept:
 *
 *   · a library feature on a part (`node.work`, attached by
 *     `captured.ts#attachCaptured` from sink's `doc.behaviours`), with the
 *     settings measured on the page. Same effect is same item: the feature
 *     is filed under the shelf item it is a version of (`shelfPlan.ts`),
 *     and the site's measured settings are the version;
 *   · the page's own stylesheet motion carried on the part (`node.motion`,
 *     sink `node.motion`): a `:hover` that moves the part is the site's
 *     "Lift on hover", a loop whose keyframes turn, travel or fade is its
 *     "Spin", "Float" or "Blink". Taking the version copies that motion.
 *
 * Every version names the site it came from and runs as published: the
 * features ship their scripts and the carried motion ships as CSS
 * (`docs/CAPTURED-MOTION.md`).
 *
 * Pure: no store, no React.
 */
import { itemOf } from "../shelfPlan.ts";
import { getWork, usesOf, type WorkUse } from "./works.ts";

export interface SiteVersion {
  /** The shelf item it is a version of (a catalogue id or `work:<id>`). */
  item: string;
  /** What taking it puts on a part. */
  take:
    | { kind: "work"; id: string; inputs: Record<string, string> }
    | { kind: "motion"; motion: Record<string, unknown> }
    | { kind: "embed"; embed: Record<string, unknown> };
  /** "As on example.com", said on the card. */
  label: string;
  host: string;
  /** The parts on the board that carry it, so the card can jump to them. */
  parts: string[];
}

interface Carrier {
  id: string;
  work?: WorkUse | null;
  motion?: { animation?: { name: string }[]; hover?: { style?: Record<string, string> }[]; transition?: unknown[]; off?: boolean } | null;
  from?: { host?: string } | null;
  embed?: { src?: string } | null;
}

interface Frames { name: string; frames: { key: string; style: Record<string, string> }[] }

/** What a loop's keyframes do, read off the properties they change. */
export function loopKind(frames: Frames | undefined): "spin" | "float" | "blink" | null {
  if (!frames) return null;
  const styles = frames.frames.map((f) => f.style ?? {});
  const said = (re: RegExp) => styles.some((s) => Object.entries(s).some(([k, v]) => re.test(`${k}:${v}`)));
  if (said(/^(transform|rotate):.*rotate|^rotate:/)) return "spin";
  if (said(/^(transform|translate):.*translate|^translate:/)) return "float";
  const opacities = styles.map((s) => Number(s.opacity)).filter((n) => Number.isFinite(n));
  if (opacities.length >= 2 && Math.max(...opacities) - Math.min(...opacities) >= 0.5) return "blink";
  return null;
}

const MOVES = /^(transform|translate|rotate|scale|top|margin-top)$/;

/**
 * The site's versions of shelf items, one per effect and site, with the
 * settings of the first part that carries it and every part that does.
 */
export function siteVersions(nodes: readonly Carrier[], keyframes: readonly Frames[] = [], siteName = ""): SiteVersion[] {
  const frames = new Map(keyframes.map((k) => [`cap-${k.name}`, k] as [string, Frames]).concat(keyframes.map((k) => [k.name, k] as [string, Frames])));
  const out = new Map<string, SiteVersion>();
  const hostOf = (n: Carrier) => n.from?.host || siteName || "this site";
  const add = (key: string, n: Carrier, take: SiteVersion["take"]) => {
    const item = itemOf(key) ?? key;
    const host = hostOf(n);
    /* One version per item and site: the feature, with its measured settings, over the stylesheet motion that does the same. */
    const k = `${item}|${host}`;
    const hit = out.get(k);
    if (hit) {
      hit.parts.push(n.id);
      if (hit.take.kind !== "work" && take.kind === "work") hit.take = take;
      return;
    }
    out.set(k, { item, take, host, label: `As on ${host}`, parts: [n.id] });
  };
  for (const n of nodes) {
    /* Only what came from a page: a feature somebody put on a part here is theirs, not the site's. */
    if (!n.from) continue;
    for (const u of usesOf(n.work)) {
      if (u.off || !getWork(u.id)) continue;
      add(`work:${u.id}`, n, { kind: "work", id: u.id, inputs: { ...u.inputs } });
    }
    /* Another page shown inside a part: the site's own Embed. */
    if (n.embed?.src) add("work:embed", n, { kind: "embed", embed: { ...n.embed } });
    const m = n.motion;
    if (!m || m.off) continue;
    const lifts = (m.hover ?? []).some((h) => Object.keys(h.style ?? {}).some((p) => MOVES.test(p)));
    if (lifts) add("work:hover-lift", n, { kind: "motion", motion: { hover: m.hover, transition: m.transition } });
    for (const a of m.animation ?? []) {
      const kind = loopKind(frames.get(a.name));
      if (kind) add(`work:${kind}`, n, { kind: "motion", motion: { animation: [a] } });
    }
  }
  return [...out.values()];
}
