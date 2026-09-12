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
 *
 * **The pace is nearly static, and deliberately so.** Everything here runs
 * about three times slower than it first did: a second's glance should show
 * nothing at all and only time should reveal it. Slowing rather than damping
 * is the lever, because a third of the rate is a third of the change per
 * second without touching how far anything travels — and it costs less,
 * which is what thirty on a screen needs.
 */

/**
 * The temperatures a construct comes in, and what each one means.
 *
 * - `verdant` — an **iteration**. Green: the boards on the timeline, and the
 *   Finish key that opens them, because it is one of them.
 * - `ember` — a **drawing**, and every other piece that came off one. Red.
 * - `lantern` — the base set, and the fallback for a construct that has not
 *   said which of the two it is.
 *
 * The meanings are the agreement, not a preference: two branches render
 * these, and a construct that is green here and red there is worse than
 * either. All three are the same five stops and the same keyframes; a fourth
 * is a decision to take in `molten.css`, not in a component.
 */
export type MoltenKind = "lantern" | "ember" | "verdant";

/** What a construct is, said in the word the rest of the app uses for it. */
export const MOLTEN_MEANS: Record<MoltenKind, string> = {
  verdant: "an iteration, and the key that opens them",
  ember: "a drawing, and the pieces that came off one",
  lantern: "the base set, for a construct that has not said which it is",
};

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
  "molten-drift": "the slow boil: the veining crawls one way, 150s",
  "molten-churn": "a second layer the other way at another rate, 226s, so brightness drifts rather than pulses",
  "molten-breathe": "the edge thickening and thinning, 42s",
  "molten-flare": "an occasional run of light along the outline that dies, 74s, visible for a sliver of it",
  "molten-ember": "the odd spark shed at a corner, 54s, nothing for most of it",
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
