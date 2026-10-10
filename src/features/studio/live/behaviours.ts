/**
 * Tier-B parts are behaviours: they change how the whole page moves rather
 * than sitting in it. This reads the ones placed on a page and turns them into
 * a flat set of switches `LiveShell` can act on.
 *
 * A few motions cannot be run honestly in a preview — a scroll-driven film, a
 * pinned story, a physics rig. Those are listed in `described` instead, so the
 * preview says what will happen rather than pretending.
 */
import { resolvePart } from "../shelf/ui";
import { CORNER_DEFAULT, SCREEN, cornerOf, type Corner } from "./corner";
import { getFeature } from "../shelf";
import type { StudioNode } from "../board/store";

export interface Behaviours {
  progress: boolean;
  backToTop: boolean;
  /** Where the back-to-top button stays on screen: the nearest corner and how far in from it. */
  backToTopAt: Corner;
  reveal: boolean;
  /** How things appear: fade-up, fade, scale, blur or stagger (the card's Style). */
  revealStyle: string;
  parallax: number;
  smooth: boolean;
  /** How long a wheel's glide takes: "light" or "heavy" (the card's Strength). */
  smoothStrength: string;
  snap: "vertical" | "horizontal" | null;
  /**
   * The parts each scroll effect was dropped on, by node id (the switch's
   * `options.parts`): Smooth's stops a wheel notch glides to, Snap's
   * sections, Depth's background layers (`scrollMotionJs.ts`).
   */
  smoothStops: string[];
  snapParts: string[];
  depthParts: string[];
  intro: boolean;
  cursor: string | null;
  /** The custom cursor's own picture (a small PNG, its tip top left), when it is "picture". */
  cursorPicture: string | null;
  tilt: boolean;
  confetti: boolean;
  /** Named, not simulated — shown as a note in the corner of the preview. */
  described: { id: string; label: string }[];
  any: boolean;
}

const STRENGTH: Record<string, number> = { subtle: 0.08, medium: 0.18, strong: 0.32, light: 0.08, heavy: 0.32, off: 0 };

/** Motions the preview names rather than fakes. */
const DESCRIBE_ONLY = new Set(["sticky-story", "scroll-video", "morph-transition", "physics", "horizontal-scroll", "infinite-scroll"]);

export function isBehaviour(featureId: string): boolean {
  return resolvePart(featureId)?.tier === "B";
}

export { CORNER_DEFAULT, MIN_INSET, cornerOf, onScreenButton, type Corner } from "./corner";

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

/** A cursor's own picture: a data address only, never a link out. */
/** The parts a scroll effect was dropped on (`ShelfCards.tsx#dropFeature`), as a comma list in its options. */
export const partsOf = (o: Record<string, string> | undefined): string[] => (o?.parts ?? "").split(",").map((x) => x.trim()).filter(Boolean);

const pictureCursor = (o: Record<string, string>) => (o.style === "picture" && o.picture?.startsWith("data:image/") ? o.picture : null);

export function deriveBehaviours(nodes: StudioNode[], scroll?: string, frameWidth = 1440): Behaviours {
  const pageH = nodes.reduce((m, n) => (isBehaviour(n.featureId) || n.state ? m : Math.max(m, n.y + n.h)), 0) || SCREEN;
  const b: Behaviours = {
    progress: false, backToTop: false, backToTopAt: CORNER_DEFAULT, reveal: false, revealStyle: "fade-up", parallax: 0, smooth: false, smoothStrength: "light",
    snap: null, smoothStops: [], snapParts: [], depthParts: [], intro: false, cursor: null, cursorPicture: null, tilt: false, confetti: false, described: [], any: false,
  };
  for (const n of nodes) {
    if (!isBehaviour(n.featureId)) continue;
    /* Turned off in the Motion tab: kept on the board, done nowhere. */
    if (n.options?.off === "yes") continue;
    b.any = true;
    const o = n.options;
    switch (n.featureId) {
      case "scroll-progress": b.progress = true; break;
      case "back-to-top": b.backToTop = true; b.backToTopAt = cornerOf(n, frameWidth, pageH); break;
      case "reveal-on-scroll": b.reveal = true; b.revealStyle = o.style ?? "fade-up"; break;
      case "parallax": b.parallax = STRENGTH[o.strength ?? "medium"] ?? 0.18; b.depthParts.push(...partsOf(o)); break;
      case "smooth-scroll": b.smooth = (o.strength ?? "light") !== "off"; b.smoothStrength = o.strength === "heavy" ? "heavy" : "light"; if (b.smooth) b.smoothStops.push(...partsOf(o)); break;
      case "scroll-snap": b.snap = o.axis === "horizontal" ? "horizontal" : "vertical"; b.snapParts.push(...partsOf(o)); break;
      case "page-load": b.intro = true; break;
      case "cursor-effects": b.cursor = o.style ?? "dot"; b.cursorPicture = pictureCursor(o); if (b.cursor === "picture" && !b.cursorPicture) b.cursor = "dot"; break;
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
