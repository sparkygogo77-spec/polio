/**
 * What has been built, in the order it was built.
 *
 * The Builder changes quickly and the changes are not always visible — a
 * texture engine that finally honours its own sliders looks exactly like one
 * that never did. So each entry says what arrived and shows a small sketch of
 * it, and the panel keeps them in one line you can read top to bottom.
 *
 * Newest first. Add to the top; never rewrite an entry once it has shipped.
 */

/** The little drawing beside an entry. Each is hand-drawn in the panel. */
export type Sketch = "frame" | "parts" | "palette" | "flame" | "picture" | "planets";

export interface Release {
  version: string;
  /** A few words, not a sentence. */
  title: string;
  /** What it is for, in one line. */
  summary: string;
  /** The additions, each short enough to scan. */
  added: string[];
  sketch: Sketch;
}

export const RELEASES: Release[] = [
  {
    version: "0.6",
    title: "Pictures become patterns",
    summary: "A photograph dropped in is now a texture you can paint in your own colours.",
    sketch: "picture",
    added: [
      "Background removal, in the browser and free — the pattern without the paper it was shot on.",
      "A picture is reduced to a tintable pattern, so the palette colours it and the background shows through.",
      "A weave slider that runs from a tiled grid to one picture gathered in the middle.",
      "Every slider now bites: colour, scale, angle, opacity and contrast all change what you see.",
      "Controls a texture cannot use are no longer shown at all.",
    ],
  },
  {
    version: "0.5",
    title: "A shelf shaped like a page",
    summary: "The library stopped being a row of tiles and became a picture of a website.",
    sketch: "planets",
    added: [
      "Fourteen planets, one per kind of part, drawn as outlines.",
      "Parts sit where they would sit on a page: bands across the top, three columns below.",
      "Previews are lit by a blue flame rising from underneath instead of sitting in boxes.",
      "Drag a preview straight onto the board — no icons in between.",
      "The board keeps its size: both side edges of the page are always on screen.",
    ],
  },
  {
    version: "0.4",
    title: "Any element repaints itself",
    summary: "The site owns six colours; any one part can disagree.",
    sketch: "palette",
    added: [
      "Per-element colour: give a part another role's colour, or one of its own.",
      "Naming a role keeps a part inside the palette, so later changes carry through.",
      "Textures can be painted on surfaces as well as on the page.",
      "Pictures come in three ways: choose, drag, or paste.",
    ],
  },
  {
    version: "0.3",
    title: "Colour and texture",
    summary: "A palette you can actually mix, and surfaces made of plain CSS.",
    sketch: "palette",
    added: [
      "Six roles every part reads: background, surface, text, muted, accent, highlight.",
      "A mixer with lightness against chroma, a hue strip, hex entry and an eyedropper.",
      "Five harmony generators that build all six roles from one seed.",
      "Contrast reported live, so nothing lands unreadable.",
      "Thirteen texture kinds that compile to CSS and cost nothing to load.",
    ],
  },
  {
    version: "0.2",
    title: "Every part is real",
    summary: "All two hundred and eighteen of them, not a wireframe among them.",
    sketch: "parts",
    added: [
      "The cart adds up, the checkout checks the card, a table of five thousand rows sorts.",
      "Motion parts draw a small scene of what they do rather than showing a name.",
      "Behaviours take no room in the layout and run for real in the live preview.",
      "Every part explains itself on hover — all 218, not the 85 that used to.",
    ],
  },
  {
    version: "0.1",
    title: "The board",
    summary: "Lay a page out at real size, then say what it is.",
    sketch: "frame",
    added: [
      "A page frame at desktop, tablet and phone width.",
      "Parts land inside it at real size and nothing reflows to fit.",
      "Where you put something is part of the specification.",
      "A prompt on every part, region, group and arrow.",
      "A blueprint compiled out of the board, in markdown or JSON.",
    ],
  },
];

export const CURRENT = RELEASES[0]!.version;
