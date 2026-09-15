/**
 * The face of a construct: J's own tile, sliding for ever.
 *
 * The mechanism is the ground's and it has not changed: a field of cloud
 * one period wide, oversized by one period and slid by a CSS transform, so
 * the loop lands on itself and nothing repaints. Thirty cards cost what one
 * composited layer costs.
 *
 * What has changed is where the picture comes from. It used to be painted
 * here at load — the ground's own noise, coloured red or green — which was
 * a fair likeness of the reference and not the reference. J has since
 * rendered the lantern boxes himself and cut seamless 512 tiles out of
 * their faces, so the face *is* his render now: the filaments, the flares
 * and the dark between them are his, and nothing here draws anything.
 *
 * TWO PAIRS, AND BOTH ARE ON THE PAGE. A bright one and a dark one, cut from
 * the same renders. `mountNebula` publishes the pair the page wears as
 * `--nebula-verdant` / `--nebula-ember` and the bright cut as
 * `--nebula-verdant-lit` / `--nebula-ember-lit`, because the choice is no
 * longer page-wide: a card wants the dark cut and a construct the size of a
 * key wants the bright one, and both are on the screen at once. The boxes
 * wear the dark pair — measured, it is about half the luminance of
 * the bright one (mean 23 against 45 for the green, 21 against 38 for the
 * red), which is what a card carrying words at eleven pixels wants.
 * `mountNebula("bright")` puts the other pair on, for comparing them.
 *
 * THE DARK CENTRE AND THE FALLOFF ARE UNTOUCHED. They were baked into the
 * painted tile's alpha; a photograph has no alpha, so they moved into the
 * stylesheet as a mask on the same sliding layer (`molten.css`) — the same
 * curve, thin in the middle and full towards the edges, so the face's own
 * `--mo-core` still shows through the centre and the cloud still holds the
 * edges. Nothing else about the layer is different.
 *
 * The files are under `public/construct/`, served and cached as files
 * rather than built into a data URL: a quarter of a megabyte of base64 on
 * the root element is a quarter of a megabyte the browser has to parse
 * before it can draw anything.
 */

/**
 * The tile wraps on this width and slides exactly it.
 *
 * **How much of J's render is in view, and how fast it goes past.** It was
 * 512, the file's own pixel size, which drew the render at one to one: a
 * card is about 220 across and 72 tall, so what showed was a third of the
 * picture's width and a seventh of its height — five or six fat filaments,
 * read as big lines rather than as cloud. At 180 a card holds more than a
 * whole tile across and two fifths of its height, and the same filaments
 * are hairlines in a field of them, which is what a nebula is.
 *
 * It is also the speed. The glide is exactly one period per turn of
 * `molten-drift`, so halving the period halves the distance and doubles
 * what a given travel does to the picture: at 512 over 150 seconds the
 * surface crept at three and a half pixels a second and J could only just
 * see it move. 180 over 20 is nine, and a filament crosses a card in under
 * half a minute.
 */
export const NEBULA_PERIOD = 180;

export type NebulaKind = "verdant" | "ember";

/** Which pair of J's tiles the constructs wear. */
export type FacePair = "dark" | "bright";

/**
 * The four faces, as they are served.
 *
 * Green is an iteration and red is a drawing, which is the same meaning the
 * five stops carry (`molten.ts`); the dark and the bright are the two cuts
 * of the same render.
 */
export const FACES: Record<FacePair, Record<NebulaKind, string>> = {
  dark: {
    verdant: "/construct/face-green-dark.png",
    ember: "/construct/face-red-dark.png",
  },
  bright: {
    verdant: "/construct/face-green.png",
    ember: "/construct/face-red.png",
  },
};

/**
 * The rim, and where it comes from.
 *
 * `box-*` are J's whole boxes, as he rendered them. `rim-*` are the
 * nine-slice sheets cut out of them by `scripts/cut-rims.mjs` — the box's
 * own bounding rectangle, so the decorative tab at the middle of an edge is
 * left outside it, with the middle cleared and the whole thing halved.
 *
 * Nothing here hands them over. Unlike the faces, which come in two pairs
 * and swap, there is one rim per temperature and it never changes, so
 * `molten.css` names the file itself and a card is framed before any of
 * this has run. The other red J sent, `box-red-alt.png`, has no sheet and
 * nothing wears it today.
 */

/** Which pair is on, once something has asked. Read by `tests/molten.mjs`. */
let wearing: FacePair | null = null;

export function facePair(): FacePair | null {
  return wearing;
}

/**
 * Hand the faces to the stylesheet, once.
 *
 * On the root, so every construct anywhere — the timeline's boxes, the
 * Finish key, the rows under it, the vines — reads the same two pictures.
 * Idempotent for a pair already on; asking for the other pair swaps them,
 * which is how the two are compared on a real board.
 */
export function mountNebula(pair: FacePair = "dark"): void {
  if (typeof document === "undefined" || wearing === pair) return;
  const root = document.documentElement;
  root.style.setProperty("--nebula-period", `${NEBULA_PERIOD}px`);
  root.style.setProperty("--nebula-verdant", `url("${FACES[pair].verdant}")`);
  root.style.setProperty("--nebula-ember", `url("${FACES[pair].ember}")`);
  /*
   * AND THE BRIGHT CUT, ALWAYS, WHATEVER THE PAGE IS WEARING.
   *
   * Two names rather than one, because the choice stopped being a page-wide
   * one. A construct the size of a key wants the bright cut and a card wants
   * the dark cut, and both are on the screen at once — so the pair above is
   * "what this page wears" and this is "the bright one, always", and a rule
   * that wants it names it (`.molten-key` in `molten.css`) instead of asking
   * for a swap nobody else wanted.
   *
   * Nothing extra is fetched by naming them: a `url()` in a custom property
   * is a string until a rule uses it, so the bright pair is loaded only on a
   * page that actually puts a key on the screen.
   */
  root.style.setProperty("--nebula-verdant-lit", `url("${FACES.bright.verdant}")`);
  root.style.setProperty("--nebula-ember-lit", `url("${FACES.bright.ember}")`);
  root.dataset.facePair = pair;
  wearing = pair;
}
