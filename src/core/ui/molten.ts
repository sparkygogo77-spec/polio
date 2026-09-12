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

/**
 * The seven stops, darkest to brightest, as the custom properties that hold
 * them. The shape is the agreement: most of a construct is `char`/`field`,
 * `body`/`lit` show in a few places, `edge`/`edge-hot` are the edge and never
 * cross the face, and `vein` is the filaments through the dark.
 */
export const MOLTEN_STOPS = ["char", "field", "body", "lit", "edge", "edge-hot", "vein"] as const;

/**
 * The two keyframes. Every construct on the screen shares exactly these.
 *
 * There were five. The other three — a breathing edge, a flare that ran the
 * outline, a spark shed at a corner — were things that *played*, and a
 * construct you look at fifty times an hour must look the same every time.
 */
export const MOLTEN_KEYFRAMES = ["molten-drift", "molten-churn"] as const;

/** What each one is for, in a line, so nobody has to read the stylesheet to know. */
export const MOLTEN_MOTION: Record<(typeof MOLTEN_KEYFRAMES)[number], string> = {
  "molten-drift": "dark matter crossing the field, 190s, a couple of per cent of travel",
  "molten-churn": "a second layer at another scale and rate, 260s, so the two never line up",
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
