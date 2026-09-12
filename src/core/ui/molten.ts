/**
 * MOLTEN — the names, so nothing has to be spelled twice.
 *
 * `molten.css` is the agreement: the stops, the keyframes and the two classes
 * live there and nowhere else. This is the handle on it for anything that
 * needs to put a construct on the screen without hardcoding a class name or a
 * colour, and the list a test can hold the stylesheet to.
 *
 * Two branches render these — the timeline's iteration boxes here, the
 * element cards on the sibling — so the rule is: import from here, never
 * declare a `--molten-*` property or a `molten-*` keyframe of your own. A
 * second red that nearly matches is the thing this exists to prevent.
 *
 * Usage:
 *
 *     <div className={moltenClass("lantern")} style={moltenSeed(i)}>
 *       <span data-molten="" />
 *       …the content, which sits above the boil…
 *     </div>
 *
 * The child carries the edge, the flare and the ember; the seed staggers a
 * construct's animations so a screen of them is not one machine.
 */

/**
 * The temperatures a construct comes in.
 *
 * `lantern` is an iteration, `ember` an element piece, `verdant` the green
 * counterpart — Finish, the key that opens the red ones. All three are the
 * same five stops and the same keyframes; a fourth is a decision to take in
 * `molten.css`, not in a component.
 */
export type MoltenKind = "lantern" | "ember" | "verdant";

/** The five stops, hottest to coldest, as the custom properties that hold them. */
export const MOLTEN_STOPS = ["white", "hot", "body", "deep", "char"] as const;

/** The five keyframes. Every construct on the screen shares exactly these. */
export const MOLTEN_KEYFRAMES = [
  "molten-drift",
  "molten-churn",
  "molten-breathe",
  "molten-flare",
  "molten-ember",
] as const;

/** What each one is for, in a line, so nobody has to read the stylesheet to know. */
export const MOLTEN_MOTION: Record<(typeof MOLTEN_KEYFRAMES)[number], string> = {
  "molten-drift": "the slow boil: the veining crawls one way, 47s",
  "molten-churn": "a second layer the other way at another rate, 71s, so brightness drifts rather than pulses",
  "molten-breathe": "the edge thickening and thinning, 13s",
  "molten-flare": "an occasional run of light along the outline that dies, 23s, visible for a sliver of it",
  "molten-ember": "the odd spark shed at a corner, 17s, nothing for most of it",
};

/** The class that makes a thing a construct, at the temperature asked for. */
export function moltenClass(kind: MoltenKind = "lantern"): string {
  if (kind === "ember") return "molten molten-ember";
  if (kind === "verdant") return "molten molten-verdant";
  return "molten";
}

/**
 * A construct's own offset into the shared animations.
 *
 * Any stable number will do — an index, or a hash of an id — because it is
 * only ever multiplied into a negative delay. What matters is that two
 * constructs beside each other do not get the same one, or they breathe and
 * flare together and the screen reads as one machine rather than as thirty
 * separate things that happen to be alight.
 */
export function moltenSeed(from: string | number): { "--molten-seed": number } {
  if (typeof from === "number") return { "--molten-seed": from % 97 };
  let n = 0;
  for (let i = 0; i < from.length; i++) n = (n * 31 + from.charCodeAt(i)) % 97;
  return { "--molten-seed": n };
}
