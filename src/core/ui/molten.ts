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

/** The keyframes. Every construct on the screen shares exactly these. */
export const MOLTEN_KEYFRAMES = [
  "molten-drift",
  "molten-ebb",
  "molten-churn",
  "molten-swell",
  "molten-breathe",
  "molten-flare",
  "molten-ember",
] as const;

/** What each one is for, in a line, so nobody has to read the stylesheet to know. */
export const MOLTEN_MOTION: Record<(typeof MOLTEN_KEYFRAMES)[number], string> = {
  "molten-drift": "the face sliding across, one tile's width every 20s",
  "molten-ebb": "a bigger copy sliding back the other way, its own width every 47s",
  "molten-churn": "kept for a construct that wants a moving layer of its own; nothing uses it",
  "molten-swell": "light gathering inside the top and bottom edges and going out again, 42s each way",
  "molten-breathe": "the whole edge fading in and out; kept for a construct with room for it, nothing uses it",
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
 * The same construct at the size of a bar.
 *
 * A card's face is dark because words sit on it. Ten pixels tall there is no
 * face to speak of and the rim is the whole of what shows, so a small
 * construct reads as an outline around nothing. `molten-bar` lights the body
 * instead — same stops, same keyframes, same rim — so a bar reads as a piece
 * of hot metal rather than a container waiting to be filled.
 *
 * A shape, not a temperature: it composes with whichever kind is asked for.
 */
export function moltenBarClass(kind: MoltenKind = "lantern"): string {
  return `${moltenClass(kind)} molten-bar`;
}

/**
 * A construct at the size of a key, for chrome rather than for a card.
 *
 * One definition, two settings: this is the second. Same stops, same two
 * layers, same keyframes, same tiles, same seed — the tile asked for
 * differently, not a second texture. What differs is written once, in
 * `.molten.molten-key` in `molten.css`, and is four things: the bright cut
 * of J's render rather than the dark one, a shorter period so the filaments
 * read as filaments at 28 pixels, a shallow vignette, and an even face with
 * no dark core, because the core that is depth on a card is a hole on a key.
 *
 * Use it for anything the size of a control. It costs nothing measurable:
 * a construct's cost is its area, and twelve key-sized ones measured free
 * (`tests/idle-cost.mjs`).
 *
 *     <button className={moltenKeyClass("verdant")} style={moltenSeed(id, i)}>
 *       <span data-molten="" />
 *       …the word…
 *     </button>
 */
export function moltenKeyClass(kind: MoltenKind = "lantern"): string {
  return `${moltenClass(kind)} molten-key`;
}

/**
 * A construct's own share of the shared animations: phase, pace, heading and
 * where in the tile it starts.
 *
 * **Phase alone was not enough, and that was the note.** Every construct ran
 * one negative delay off this number, which is the same animation started at
 * a different moment — and a screen of them still reads as one rhythm,
 * because a loop offset from itself is the same loop. Worse, a caller that
 * forgot to pass anything got the same constant as every other caller, and
 * the panel of boxes that did that measured 0.99 correlation between two
 * neighbours' motion: not merely alike, identical.
 *
 * So four dials off one number, and none of them is a new mechanism — they
 * are the properties the stylesheet already reads:
 *
 *   --molten-seed  the phase, as before: every animation's negative delay
 *   --mo-pace      the rate, 0.82 to 1.18 of the written duration
 *   --mo-way       the heading: half of them run their layers the other way
 *   --mo-shift     where in the tile the face starts, so two constructs are
 *                  not showing the same part of the same picture
 *
 * The heading is the one that has to be *guaranteed* rather than hashed,
 * because "no two next to each other" is a claim about neighbours and a hash
 * knows nothing about who its neighbours are. So pass `at` — the thing's
 * index in whatever list it is in — and consecutive items alternate heading
 * however their ids hash. Without it the hash decides, which is fine for
 * constructs scattered on a canvas and not for a column of them.
 *
 * Reversing a construct reverses *both* its layers, so the two of them stay
 * opposed to each other: the rule inside a card is untouched, and what
 * changes is the card's relationship to the card beside it.
 */
export function moltenSeed(from: string | number, at?: number): {
  "--molten-seed": number;
  "--mo-pace": number;
  "--mo-way": string;
  "--mo-shift": string;
} {
  let n: number;
  if (typeof from === "number") n = ((from % 97) + 97) % 97;
  else {
    n = 0;
    for (let i = 0; i < from.length; i++) n = (n * 31 + from.charCodeAt(i)) % 97;
  }
  const turn = at ?? n;
  return {
    "--molten-seed": n,
    /* Seven rates rather than a continuum: two constructs an eighth apart in
       pace drift out of step inside a minute, and a continuum only means
       more numbers that look alike. */
    "--mo-pace": +(0.82 + (n % 7) * 0.06).toFixed(2),
    "--mo-way": turn % 2 ? "reverse" : "normal",
    /* A whole tile's worth, spread across the seed: the same picture, but
       not the same part of it, which is most of what stops two boxes reading
       as one sheet with a line drawn between them. */
    "--mo-shift": `${n * 2}px`,
  };
}
