/**
 * Tier-B parts are behaviours: they change how the whole page moves rather
 * than sitting in it. This reads the ones placed on a page and turns them into
 * a flat set of switches `LiveShell` can act on.
 *
 * A few motions cannot be run honestly in a preview — a scroll-driven film, a
 * pinned story, a physics rig. Those are listed in `described` instead, so the
 * preview says what will happen rather than pretending.
 */
import { resolvePart } from "../parts";
import { getFeature } from "../catalog";
import type { StudioNode } from "../store";

export interface Behaviours {
  progress: boolean;
  backToTop: boolean;
  reveal: boolean;
  parallax: number;
  smooth: boolean;
  snap: "vertical" | "horizontal" | null;
  intro: boolean;
  cursor: string | null;
  tilt: boolean;
  confetti: boolean;
  /** Named, not simulated — shown as a note in the corner of the preview. */
  described: { id: string; label: string }[];
  any: boolean;
}

const STRENGTH: Record<string, number> = { subtle: 0.08, medium: 0.18, strong: 0.32, light: 0.08, heavy: 0.32, off: 0 };

/** Motions the preview names rather than fakes. */
const DESCRIBE_ONLY = new Set(["sticky-story", "scroll-video", "morph-transition", "physics", "horizontal-scroll", "infinite-scroll", "page-transitions"]);

export function isBehaviour(featureId: string): boolean {
  return resolvePart(featureId)?.tier === "B";
}

/**
 * What a page's own scroll setting does to the live page: the three the
 * preview can do, done; the two it cannot, named in the corner note beside
 * the other behaviours it describes rather than fakes. It reached only the
 * blueprint before, so the setting changed nothing anyone could scroll.
 */
function pageScroll(b: Behaviours, scroll: string | undefined) {
  switch (scroll) {
    case "snap to sections": b.snap = b.snap ?? "vertical"; break;
    case "horizontal": b.snap = "horizontal"; break;
    case "smooth / inertial": b.smooth = true; break;
    case "scroll-driven story":
    case "paged":
      b.described.push({ id: `scroll:${scroll}`, label: `Scroll: ${scroll}` });
      break;
    default: break;
  }
}

export function deriveBehaviours(nodes: StudioNode[], scroll?: string): Behaviours {
  const b: Behaviours = {
    progress: false, backToTop: false, reveal: false, parallax: 0, smooth: false,
    snap: null, intro: false, cursor: null, tilt: false, confetti: false, described: [], any: false,
  };
  for (const n of nodes) {
    if (!isBehaviour(n.featureId)) continue;
    /* Turned off in the Motion tab: kept on the board, done nowhere. */
    if (n.options?.off === "yes") continue;
    b.any = true;
    const o = n.options;
    switch (n.featureId) {
      case "scroll-progress": b.progress = true; break;
      case "back-to-top": b.backToTop = true; break;
      case "reveal-on-scroll": b.reveal = true; break;
      case "parallax": b.parallax = STRENGTH[o.strength ?? "medium"] ?? 0.18; break;
      case "smooth-scroll": b.smooth = (o.strength ?? "light") !== "off"; break;
      case "scroll-snap": b.snap = o.axis === "horizontal" ? "horizontal" : "vertical"; break;
      case "page-load": b.intro = true; break;
      case "cursor-effects": b.cursor = o.style ?? "dot"; break;
      case "hover-tilt": b.tilt = true; break;
      case "confetti": b.confetti = true; break;
      default: break;
    }
    if (DESCRIBE_ONLY.has(n.featureId)) b.described.push({ id: n.featureId, label: getFeature(n.featureId)?.name ?? n.label });
  }
  pageScroll(b, scroll);
  if (b.described.length || b.snap || b.smooth) b.any = true;
  return b;
}
