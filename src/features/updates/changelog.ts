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
    version: "0.21",
    title: "Claude sees the site",
    summary: "Every prompt from the blueprint dialog goes with screenshots of the pages, seven kinds of ask including your own words and the code, and Publish pushes the site to GitHub and on to Vercel.",
    sketch: "picture",
    added: [
      "Screenshots: the server opens the live preview with your document in place and photographs each page, top to bottom, and the pictures go to Claude beside the blueprint — so it reads what the site looks like, not only what it is for. A switch on the dialog, a setting for how many pages.",
      "Seven asks: Plan, Critique, Fill prompts, Finish (a checklist with the prompt that fixes each item), Ideas (ten, placed and ranked), Ask (anything, in your words), Build (every file, complete). Ctrl-Enter sends.",
      "Publish: the document the app renders at /site, the blueprint both ways, and whatever Build wrote, pushed to a GitHub repository in one commit with a token on the server; a Vercel deploy hook called after, when one is set. On a deployment made from that push, the root of the site is the site.",
      "The drawing board snaps: a wobbly box becomes a box, a loop a circle, a slanted line level, three corners a triangle. Snap, smooth or raw, on the board's rim and in the settings.",
      "The tour render and the screenshots see the real site: the document travels with the request, so a headless browser no longer opens an empty page.",
    ],
  },
  {
    version: "0.20",
    title: "The tweet console",
    summary: "Press T: a dashboard comes down over the screen where posts to X are drafted, previewed, given a recorded tour of the site, queued, and sent.",
    sketch: "planets",
    added: [
      "One draft at a time in the middle, the way X will show it on the right, and on the left every draft as a stop on one line with the log under it, so what is queued and what happened to it reads like a feed.",
      "Threads, four pictures or one GIF or video per post with alt text, a poll, who can reply, a post to quote or answer, the sensitive flag; the count is X's count, links as 23, and a Split button cuts a long draft into a thread at paragraphs and sentences.",
      "Schedule it and the console sends it when it is due, retries with a growing wait when X refuses, and says so honestly: the queue runs while the app is open, a post still goes out up to three hours late, later it is marked missed and offered again.",
      "The tour: the live site in a frame, scrolled top to bottom at a walking pace, pressing tabs and opening rows as it passes them. Record it from the tab, or render it on the server, and attach it to the first post as a GIF X will take — the GIF is written by the app itself, so nothing has to be installed for it.",
      "No keys on the server and nothing is stuck: Send opens X with the words or copies them, and every draft's right-click menu does the same. With keys, media goes up through X's upload API and the thread is posted in order.",
      "Thirty-one settings under their own group, most under advanced: your handle for the preview, the character limit, numbering, retries and their backoff, the queue's cadence and late window, picture size and quality, the tour's device, speed and passes, the console's size.",
    ],
  },
  {
    version: "0.19",
    title: "The drawing board",
    summary: "Draw is the outer top-right slab of the part menu, and it turns the whole wheel into a dark disc you draw the part's shape on.",
    sketch: "frame",
    added: [
      "Draw sits on the outer block of the top-right quadrant; Prompt moves in beside Animation on the inner band, icon only, so both working quadrants are cut the same way.",
      "Press it and the wheel is gone: one dark disc the size of the whole menu, no hole in the middle, every pixel of it drawing surface. Back and Clear sit on the top of its rim, Make real on the bottom.",
      "Draw the shape the part should be, add words in the strip under it if the drawing alone would not say, and press Make real: Claude reads the picture, the part as it is, the words and the whole library, and answers with what the part becomes — size, kind, contents, options.",
      "Without a key the board still works: the part takes the drawing's proportion, and the drawing is kept on the part and written into the blueprint as a \"drawn\" line, so the shape reaches whoever builds the site either way.",
      "The board's own right-click menu has \"Draw a new part here\": the same disc with no part under it, and the drawing becomes a new part in that shape, at that spot.",
    ],
  },
  {
    version: "0.18",
    title: "The aura, seen",
    summary: "Aura gets colour boxes, a spectrum, a sample block with styles and sizes; the middle button is the way back.",
    sketch: "palette",
    added: [
      "Aura's colour comes off boxes packed into the slab — an X for none, the colours you picked lately, then the site's six — and the box is the colour, with the picked one wearing a small red aura.",
      "The spectrum from the Hue editor is on Aura too, so an aura can be any colour, not only a role.",
      "A sample block shows exactly what the part wears. Beside it: soft glow, hard ring, or pulse, each chip wearing its own, and four sizes.",
      "Only the sample block and the green Aura piece take the chosen colour. The slabs keep their red aura, now tighter and dimmer, with a gap to be seen in: the grey slabs are cut a shade smaller.",
      "One button in the middle takes you back to the start from any level. The green X and the red X are gone.",
      "Texture: the take-it-off-the-site button is gone, and Reiterate stands in its place — a placeholder for changing one thing about the texture at random.",
    ],
  },
  {
    version: "0.17",
    title: "Grey slabs, red aura, and a sweep",
    summary: "The editor's slabs are a clean grey with a redder aura, and the eraser takes everything you drag it across.",
    sketch: "palette",
    added: [
      "The three editor slabs are a clean grey now, not brown; the red is in the aura round them and on whatever is switched on.",
      "The eraser: press to take what is under it, keep holding and sweep to take every drawing you cross. One undo brings the whole sweep back. A part is only ever erased by pressing on it.",
      "The menu's line works the same on a Mac, where the browser announces a right-click on the press rather than the release.",
    ],
  },
  {
    version: "0.16",
    title: "Three more slabs, and words that stay put",
    summary: "The editor is three more quadrants of the wheel, every word is part of its button, and the line does two things.",
    sketch: "palette",
    added: [
      "Hue, Texture and Aura open on the three quadrants the green is not using — three more slabs shaped like Delete, not a ring outside the wheel. The green stays up.",
      "Every word is glued to its piece and turns with it; nothing trails round a turn any more. Captions are engraved along the slab's inner curve.",
      "The inner band is icons only. Hue shows the part's own colours as a strip, Texture shows the tile it is wearing, and Aura glows in the aura it has.",
      "One line, two ends. Pull to the red ring and the whole menu comes loose and follows your hand anywhere. Pull to the green ring and the wheel turns under your hand instead, with the green dot left lit where it was reached.",
      "The hold that opens the menu is the hold that pulls: press, and go straight into moving or turning without a second click.",
      "The line runs under the buttons; the two rings sit over them, so the one you are reaching for is never hidden behind a slab.",
      "A menu opened near the edge of the screen now pulls its line from its own middle, not from where the click was.",
    ],
  },
  {
    version: "0.15",
    title: "The editor is a ring",
    summary: "The third level wraps around the green instead of being a box, and the turn runs on rails.",
    sketch: "palette",
    added: [
      "Hue, Texture and Aura open as a three-quarter ring around the green menu. The green stays up, so you can step sideways without leaving.",
      "Colour comes off arcs bent round that ring — hue, lightness and strength — not sliders in a list.",
      "The few choices that are really text sit on a plate inside the ring rather than in a box beside it.",
      "The turn runs on rails: your first movement fixes a line, and after that the handle slides along it instead of steering.",
      "Pull to the red ring and it pins; run back to the green ring at the other end and the wheel comes loose.",
      "Right-click somewhere else and the menu goes there — a different part, or a different corner of the same one. Right-click off a part and it closes.",
      "Shove the whole thing aside by the bare ring.",
    ],
  },
  {
    version: "0.14",
    title: "One bar, one console",
    summary: "The pages and the way out moved on to the toolbar, and the menu's editor fills the wheel.",
    sketch: "frame",
    added: [
      "Pages sit on the toolbar now, and Finish is a chip on the end of it. Two rows of chrome became board.",
      "Turning the menu takes three moves you can see: pull the line out until it locks, take it across to the ring opposite, then turn. Swinging it while locked does nothing.",
      "The editor fills the wheel's own footprint instead of hanging off a corner — one frame, one size, whatever is in it.",
      "It covers what you are editing, so drag it clear by its head.",
      "The colour picker gained a strength bar, and picking off the spectrum now gives you the colour you clicked instead of the same grey at a different hue.",
    ],
  },
  {
    version: "0.13",
    title: "Pull it, turn it, paint from it",
    summary: "The menu is turned by a line you pull out of it, and its third level became a console.",
    sketch: "palette",
    added: [
      "Hold the right button and pull: a line comes out of the pointer and fades up as it lengthens. At full strength it takes hold and the wheel follows your hand.",
      "A second line runs the opposite way in the opposing colour, so you are turning a bar rather than dragging a string.",
      "Push the menu aside by its middle and leave it there — clicking the part it belongs to no longer closes it.",
      "Bigger middle, thicker buttons, and a wider gap between the inner and outer rings.",
      "Looks, Texture and Aura open a console instead of a box: the choices ride an arc and the colour comes off a spectrum.",
      "A drop-in picture joins the site's texture stack, so it is there for every other part too.",
      "A texture layer can hold a colour of its own now, off the same spectrum — the flat background finally has a colour picker.",
      "Size and Bleed stopped fighting: Size sets the tile, Bleed softens its edges.",
      "Background and Highlight actually paint something on a part now. They were two of six swatches that did nothing.",
      "The category bar reads: where you are is solid neon with black lettering, not a tint on a tint.",
    ],
  },
  {
    version: "0.12",
    title: "The menu, lighter and locked",
    summary: "Flat colour, separated pieces, one fixed layout you can turn by hand — and the prompt bar is gone.",
    sketch: "palette",
    added: [
      "Every piece is one flat colour with rounded corners and a real gap round it, instead of a gradient in a dark box.",
      "Reaching for one takes a couple of pixels back out of that gap and goes a shade brighter.",
      "The layout never moves: Delete bottom-left, Looks bottom-right, wherever on the screen you click.",
      "Hold the right button on an open menu and drag to turn the whole wheel to any orientation. It stays where you leave it.",
      "Square edges turn real right angles at the corners, and the whole thing is smaller.",
      "Picking an editor replaces the green quadrant with a red panel in the same place, rather than opening a box beside it.",
      "Edit now holds everything the side panel held: options, board tint and glyph as well as name, contents, size, links and data.",
      "The square/round toggle moved to the toolbar and lights up while a menu is open.",
      "The prompt bar under the toolbar is gone. The master prompt is in the blueprint, and the way there is one round blue button over the board.",
    ],
  },
  {
    version: "0.11",
    title: "A stack that stacks",
    summary: "Layers stopped painting the page colour over each other, so colour comes through transparency.",
    sketch: "picture",
    added: [
      "Turn a layer down and what you see under it is the layer below, not a wash of the background.",
      "Weaving a picture thins it toward its edges instead of laying a disc of background over the whole stack.",
      "Noise, grain and paper take their colour role like every other kind — a grain was always grey, and turned up it was a lid.",
      "Their solidity slider bites all the way up; it used to stop moving halfway.",
      "The panel shows the stack as the page will paint it, grouped by where each layer lands.",
      "Every swatch sits on a checkerboard, so a see-through layer and a solid one no longer look the same.",
    ],
  },
  {
    version: "0.10",
    title: "The stack, rebuilt",
    summary: "Textures got a flat ground, a merge, and the same controls every time you open one.",
    sketch: "picture",
    added: [
      "Flat colour: one solid colour at any opacity — the static background the stack was missing.",
      "Every layer shows the same seven controls in the same order, whatever kind it is.",
      "And all of them bite now: checks, dots and halftone turn, blobs and mesh swing round, a flat colour fades along its angle.",
      "Merge a layer into the one below and the pair bakes into a single picture you can go on scaling and tinting.",
      "New layers arrive on top, where you left off, already open.",
    ],
  },
  {
    version: "0.9",
    title: "The quadrants, and a light",
    summary: "Right-click became geometry, and the page got somewhere for its shadows to come from.",
    sketch: "palette",
    added: [
      "Four quadrants round the pointer, cut again into an inner band and an outer block — six buttons, none of them a sliver, and a clear circle in the middle with the lock in it.",
      "The quadrant facing the middle of the screen stays empty, wherever you click; Delete is the whole slab beside it, undivided.",
      "Picking a group replaces the first level with a green one in that empty quadrant, and its editor opens in amber opposite.",
      "Lit faces with edges darker than the surface; reaching for one lifts it. The outer edge is square, or swept round with the ◻/◯ chip.",
      "Looks: hue, a texture of this part's own, and an aura glowing round its edge.",
      "Size: the numbers, and align left, centre or right.",
      "Animation: how a part arrives — fade, rise, drop, in from either side, grow, focus, tip up.",
      "One light source you drag around the page. Every surface works out its own shadow from where it stands relative to it, and lit faces pick up warmth.",
      "New marks for Interaction, Shop, Forms, AI and Dense & keyboard — and Under the hood is a bonnet, propped open.",
    ],
  },
  {
    version: "0.8",
    title: "Frames in between",
    summary: "Five keyframes go in and a second and a half of movement comes out.",
    sketch: "frame",
    added: [
      "The crate, on the left: five sleeves, per-gap timing, hold, easing and loop.",
      "Every frame between your keyframes is worked out here — scrub it, play it, keep it as a sprite sheet or a WebM.",
      "The brief goes into the blueprint on the same timing, so a generator can replace the dissolve with real motion.",
      "The middle column scrolls: past the board into the parts, and back, without the page ever changing size.",
      "Previews take the width they would take on a page — full width, or side by side — and are large enough to read.",
      "A moon for every sub-group, drawn like the planets.",
      "Each preview has its own fire again: red until you reach for it, then blue.",
      "One footer, three shapes, and a social row you add to and take from.",
    ],
  },
  {
    version: "0.7",
    title: "Behind the page, not through it",
    summary: "A texture now knows the difference between the floor and the furniture.",
    sketch: "picture",
    added: [
      "The background: the site's sections, bars and cards stay opaque over it, so it shows in the margins and the gaps.",
      "On surfaces: the cards, bars and panels wear it and the page stays flat.",
      "Over everything: the old all-consuming wash, kept as its own choice.",
      "Each of the four now looks different from the others, which is the whole point of choosing.",
      "How solid: a layer's transparency is baked into the picture itself, so two textures stack and both are visible.",
    ],
  },
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
