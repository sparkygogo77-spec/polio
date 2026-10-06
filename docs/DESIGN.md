# DESIGN.md — the Builder's design language, and how to work on it

This is the distilled memory of the sessions that shaped the part menu, the
console, the plates, the drawing board and the tray. It exists so that an agent
opening this repository cold makes the same choices the last one made, for the
same reasons. `AGENTS.md` says *where things go*; this file says *what it has
to feel like* and *how the owner works*.

Read it before touching anything under `src/features/studio/` that a person
sees. If a rule here and the code disagree, the code has drifted: fix the code.

---

## 1. The palette, in one paragraph

Three colours carry the whole menu system and nothing else does. **Blue
(hue 205)** is the first level: one flat neon blue for all seven pieces, so the
wheel reads as one object. **Green (148)** is the second level, in the quadrant
the first level left empty. **The void** is everything past that — the console's
slabs, the drawing board, the tray, the rim buttons, the middle button once you
are inside an editor: a dark purple-blue (`CONSOLE` in `RingConsole.tsx`, hue
~288, lightness 0.14–0.27) with a thin *lighter* rim, because on something that
dark the edge has to be the lit line. **Red (27)** is reserved for exactly two
things: the Delete slab, and the one control on a slab that is *on* (`PICKED`).
There is no grey anywhere in the menu. A grey button next to blue and green
reads as mud; a grey slab with red controls had nothing left to say "picked".

The typing surfaces are the fourth thing: a **screen** (`SCREEN` in
`PlateEditors.tsx`) — dark teal glass set into a void slab, scanlines, a faint
dot matrix, a lit bezel, phosphor lettering in a monospaced face. A screen is
where words are typed. It is never a control of its own kind: its keys are the
same boxes as everywhere else, in the screen's colours.

## 2. The rules the menu lives by

- **A piece that wears something does not take a tint.** Every piece of the
  wheel answers a hover by going a brighter blue; Looks *is* the part's colour
  or texture, so a blue wash over it under the hand says the button is blue
  after all. A worn piece keeps its paint and answers with the lift it already
  had, and its edge catches a little more light — a brighten, never a swap.
- **A mark is the far side of what it marks.** The line round a picked part
  is the complement of that part's own aura or fill — never the app's accent,
  which was the loudest thing on the board and covered the aura it was drawn
  over. Thin, one line, and offset inwards so the aura's hairline stays
  outside it. The same rule holds for the page and for ink.
- **The wheel is the whole editor; the panel is the convenience.** Anything the
  Inspector can do to one part, the wheel does too. Add to both or to the wheel
  alone; never to the panel alone.
- **Never a sliver.** Every piece of the wheel is a slab you cannot hit by
  accident. Six buttons come from three quadrants by cutting each once, at a
  middle radius; Delete is a whole quadrant. Anything that would need a seventh
  slice goes to the tray or the plate instead.
- **Geometry is the hit area.** A piece is one SVG path — arc in, seam out,
  round the outside, seam back — and the word on it is glued inside the same
  rotated group. Nothing is positioned HTML chasing a number; nothing trails.
- **The layout never moves.** Empty top-left, Delete bottom-left, Looks
  bottom-right, Animation · pencil · Draw top-right. The only thing that turns it
  is `menuSpin`, and only the hand turns that.
- **The middle is the way back**, and the handle the menu is carried by. No X
  on the rim, no X on the console.
- **One line, two ends.** Hold right and move: red end frees the menu, green end
  turns the wheel. The line goes the moment it has done its job. The line is
  measured from the **hand's press**, not the menu's middle: near an edge the
  menu is kept on screen some way from the hand, and a pull measured from the
  menu never found its line. Turning is still about the wheel's own centre.
- **What you are choosing is shown, not named.** Hue shows the strip of roles;
  Texture shows the tile; Aura glows in the aura; the animation is played by the
  slab it comes across; the font chip is set in its own face. A palette icon
  where a swatch would fit is a mistake.
- **Continuous things are sliders; discrete things are icon keys or a readout
  with arrows. Never a row of word-boxes.** A slider bends along the slab
  (`ArcSlider`, smooth: the mark follows the hand from local state, one read
  per frame, pointer captured, the part written where the hand lets go when
  a replay would otherwise fire on every frame). A choice with a picture is
  a key with an icon (`ArcChips` in the screen tone). A choice that is only
  words — an option's values, a type family — is a readout between two
  arrows (`ArcStepper`), shown in phosphor, set in its own face when it has
  one. Colours stay boxes, because the box *is* the colour. Never a
  dropdown, never a list.
- **Settings sit on screens.** A slab that carries sliders or keys is painted
  as a screen (`ScreenFace`): the same teal glass, scanlines and bezel as the
  plate, in the slab's own shape. The caption under a slider reads its value
  out.
- **Words go on a screen, on the square slab, laid out round the hole.** The
  slab opposite the green is cut square whatever the wheel's shape is. The
  screen takes the far corner out to the slab's edges; the strip along the
  top beside the hole carries the title and the part's name; the strip down
  the near side under the hole is the rail — the information key and
  whatever else the editor puts there (`PlateQuad`).
- **The page's background is a thing, with the same wheel.** Click the bare
  frame and it is selected like a part; right-press it and the wheel opens
  about the page — the same seven pieces in the same places, with Picture,
  Cut and Strip where a part has Draw, Duplicate and Delete. Its Looks are
  the page's colour, its texture layers and a veil; its Edit is the fill;
  the pencil holds the page's words. What makes no sense for a page is a
  placeholder that taps, never a hole in the wheel. ⌘X cuts it bare and
  holds it, ⌘V puts it back, ⌫ strips it. Cut and paste on parts work the
  same way, and paste puts back whatever was cut last.
- **Click off the wheel and the wheel goes.** The only thing outside it that
  keeps it up is the part it is about — click your own element and the menu
  stays, so it can be parked aside and worked against. The page's background
  is not that exception: the frame is most of the screen, so a wheel that
  ignored clicks on it left the grid at the very edge as the only way out.
  Anything else — the frame, the grid, the panels, the bar — closes it, and so
  does Escape. `tests/wheel-dismiss.mjs` holds this to it.
- **The page's middle is Add, and Add is a hole.** The page has nothing to
  lock, so the middle of its wheel is a blue Add. Press it and the wheel is
  the add disc (`AddDisc.tsx`): a disc the size of the drawing board whose
  ground is the **dark matter camo** — violet and magenta nebula clouds
  over black voids in two depths: a huge slow mass at the back, a planet
  with no edge to see, and cloud you can watch pass in front; no stars,
  nothing white; embers instead — sixteen small red sparks, never all on
  one wind: two knots of three on gusts of their own, and the rest
  wandering alone, falling with a sway, rising and flickering out, or
  sitting still and darting; each a dot when it drifts and a short streak
  when it goes, dim enough that you are not sure it moved; the peaks kept
  dim — with the parts of one category rolling down the
  middle of it, drawn as themselves, big, with a long gap between each. The
  one at the centre is full size; the rest shrink and dim toward it, so the
  column reads as a drum turning inside the hole. The categories are tabs
  round the left of the rim, top to bottom, each a key in its category's
  own colour with the library's planet mark on it. The search is a short
  bar in the top cap and never more: the parts are what you are there to
  see, and they stay large. A press on the chosen part lands it where the
  wheel was opened, kept inside the frame, and the disc goes; a press on
  another rolls to it. Back is on the rim, top right; Escape steps back.
- **The drum turns like a slot machine's, gently.** The column is on a
  spring, never on the browser's scroll, so nothing teleports. One notch of
  the wheel pushes the chosen part down and it rolls back up into place;
  two notches within half a second and it flies on to the next part and
  settles there with a small overshoot. A flick of several notches goes
  several parts. Not exaggerated: the lean is a few tens of pixels, the
  settle well under a second.
- **The library is grouped by what a visitor could point at.** Twelve
  categories, each a place on a page or a thing a visitor does there —
  never a category named for the kind of person who builds it ("Dense &
  keyboard" went for that reason). A sub-group is named for what it holds,
  never "More"; a part that belongs to two places goes where a visitor
  would look for it (Persuasion beside Proof on First screen, Shop inside
  Forms, the terminal with Data). Regrouping never moves an id: a saved
  page holds ids, not categories, and the drawing board's reader validates
  ids, so the library can be re-sorted without a migration. Near-copies are
  one card with versions (Lane I, `shelfPlan.ts`): the ids stay, a saved
  page still draws each, and the card's detail offers them. Moving the
  behaviours into the page's wheel is a separate decision, not approved.
- **One card per thing; its near-copies are its versions.** Six opening
  banners that differed in what stands behind the headline are one Opening
  banner with six versions; a built-in whole-site motion and the library
  feature that does it to one part are one card; a captured site's own
  version of an effect is one more version, "As on <site>", on the card
  that does the same (`library/siteVersions.ts`). What is not a part of a
  page (a principle, a Format setting drawn as a specimen, a board tool)
  is off the shelf, with where it lives instead. Groups are ordered by
  what a person is trying to do, most useful first (`shelfGroups.ts`).
  `tests/shelf-plan.mjs`.
- **The badge says what the published page does.** Works when published
  (drawn complete, or its script ships: `library/siteMotion.ts`), Needs a
  build (shown still), Needs a key or backend, or For the builder only
  (never on the page). A card never says it works when the exported page
  would only show a picture of it; `tests/shelf-publish.mjs` exports every
  one that says so and presses it.
- **Every word on a preview reads.** The shelf draws in the colours the
  captured page actually paints most, by area (`shelfTheme.ts`), and every
  pair of words and ground is held to 4.5 to 1; when the site's pair fails
  it takes the closest readable pair of the site's own, else plain light
  on dark. `tests/shelf-readable.mjs` on three captured sites.
- **The shelf answers "what does this part use".** With one part picked,
  a strip at the top of the shelf names every card it uses: what it is (at
  its version), each feature it carries, what its page gave it (a hover, a
  loop, a page inside it), and those cards wear a "This part" mark
  (`library/usedBy.ts`). A card's "On this page" count picks the parts and
  opens their list by name, each a link to one part. R14,
  `tests/used-by-part.mjs`.
- **A see-through colour is `tint(colour, alpha)`, never digits glued on.**
  `${t.accent}22` is a colour only for six-digit hex; on oklch, rgb, a name
  or a var() the browser drops the declaration. `parts/tint.ts` is
  color-mix with transparent. `tests/tint-glue.mjs` fails on a glued one.
- **A site's colours are a few roles, in words.** "On this site" shows the
  colours of the parts on top of the page, never the page's own colour, a
  background band or a background picture; a picture standing on the page
  adds its few main colours. Close shades (within 0.05 in OKLab) are one
  swatch that says "(3 shades)". The short palette is at most eight roles a
  person thinks in (words, main fill, buttons, panels and cards, accent,
  outline, shadow, pictures on top), and every count says what it counts:
  "Dark brown outline, 3 to 5 px, on 78 parts". Pressing one outlines every
  part wearing it on the board until it is closed, brings the first into
  view, lists them by name and recolours them all in one step. The full
  list by use is under More (`siteRoles.ts`, `tests/site-roles.mjs`).
- **A shelf card is a promise about the thing, so it says what it is.**
  Its name, one line of what it does, whether it works now or is an idea
  that needs building, and what it needs (a key, a backend, money). Its
  picture is the thing on the site's own page in the site's own words,
  never filler, never cropped, never a glow. A click shows the detail card;
  only Add to page (or a drag) changes the page. A feature of the whole site
  is a switch with its state, never a box to place.
- **Placeholders are cut and wired.** Priority, Reiterate, Make-it-a-prompt: the
  button exists, sits where it will live, plays a tap, and does nothing yet. A
  placeholder is a promise about the layout, not about the feature.
- **Motion is under Animation, layout is under Edit.** A part's own options
  split by `MOTION_OPTION_IDS`: speed, autoplay, on-scroll and the like become
  Behaviour slabs; columns, density, shape stay on the Options screen.
- **Nothing on the disc's face.** The drawing board's whole face is drawing
  surface. Back is on the rim; Make real and Clear are in the tray under it.
- **Nothing hangs off the wheel.** What is about the part but not about
  editing it — preview here, forward, back, copy and paste looks — is the
  More piece, the third icon on the top inner band, opening into green
  pieces that fire on the spot. A tab outside the wheel was a bar sticking
  out of an object. The drawing board keeps its tray under the disc, because
  the disc has no band to put a piece on.
- **Never an empty slab.** An editor that would leave a slab bare is folded
  into its neighbour: the page's colour, fill and veil are one Color editor;
  its width comes with Fit in view and the wires beside it. A slab with only
  an X on it is a slab wasted.
- **Icon keys wear their own colours.** Opaque, a shade bright, far enough
  apart round the wheel to tell at a glance (`KEY_HUES`, `keyOf`), white
  lines on them and dark ones on the yellows. A row of kinds reads as a row
  of different things.
- **A wire seats, and a chain says why.** Connect is a chain: the ends snap
  to the two parts' edges, the wire draws itself on, both parts ring once,
  and the source links to the target when it can. Between two parts it is
  then drawn as an actual chain — interlocking links, in red, wider than the
  line it replaced — and it wears the reason it exists on itself, read off
  what the two parts already say. A connection that does nothing is a
  drawing, not a connection; a connection that says nothing about why is a
  fact nobody can build from.
- **The tour points, it does not perform.** A card that had to sit away from
  the thing it names is joined to it by a thread: one bend, bowed a fixed
  share of its own length, faded out of the card and full strength at the
  hole, drawing itself on as the step arrives the way a wire seats on the
  board, and ending in a ring rather than a blob on the thing being shown.
  A tour that draws attention to its own pointing is a tour about itself.
- **Every design is tracked where it can be seen.** What the wheel writes on
  a part or the page shows in the panel as a row of coloured keys, each with
  an icon. If a setting cannot be seen in the preview, it is still there.
- **The chrome is the void too.** The palette, the panels and the walls
  lean into the same dark purple-blue, a shade rather than a colour; the
  command palette is a console with a screen for its search field.
- **The blueprint is the product.** Every field a part gains must reach
  `spec.ts` in words an agent can act on the same session. If the board can set
  it and the blueprint cannot say it, it is not done.
- **The brief says what it means, and the reader is the test.** Its wording
  was rewritten from what Claude got wrong reading it: defaults it never saw
  became "not decided", "about 520px tall" became a fixed box, a prompted
  region with nothing inside fell out of the reading order, and a button with
  no destination got one invented. So the brief resolves every plain Format
  value and marks the author's with `*`, calls heights minimums and widths
  shares of a desktop frame that stacks when narrower, lists an empty prompted
  region as a section at its row, and says "nowhere yet" where a link is not
  decided. When a critique reports something the brief already answers, the
  brief's sentence is what gets fixed, and the route's system prompt with it.
- **The side panel reads a captured site as a person does.** A part is
  named by its words, the name the browser gave it, or what it is and the
  heading of its section (`partNames.ts`), never "div · 1 inside" or an id;
  a capture's element path stays inside the prompt, and the panel says
  "From <site>, <section>". Format and Settings > This site show what the
  site already says (light or dark, accent, faces, corners) and hide what
  changes nothing on it (`siteFormat.ts`). Picture settings live under a
  closed "Make a picture"; a status line is short, with the ids in its
  details. The panel starts at 300px and its edge drags from 228px to half
  the window; every tab says its name, three to a row when narrow.
  `tests/side-panel.mjs` and `tests/side-panel-reads.mjs` hold this.
- **Format is a short page, in three parts.** "This site" (heading and
  body fonts, base size, corners, page colour, accent), each read once off
  the parts with a Change that changes it where the site has it; "Whole-site
  features", the shelf's switches with their state; and everything a
  generator reads folded under one closed "Brief for a new build". No
  BRIEF tags, never a value shown twice. A part's `font.size` is a multiple
  of the base size, and the page's colour and accent are what the page
  paints most by area, not the body behind it, read by `paintedPalette`
  (`shelfTheme.ts`), the one function the shelf's previews use too, sampled
  on the page only: what hangs past its edge paints nothing.
- **The Element tab is the page's parts in page order.** With nothing
  picked: the counts, then a tree, top to bottom, sections then what is
  inside, with kind icons; hovering a row outlines the part, pressing it
  picks it, scrolls to it and opens its panel (`partTree.ts`,
  `PartTreePanel.tsx`). A count that names parts (needing a decision,
  links) opens the list of exactly those parts in place, each saying what
  the decision is with the fix inline: where it leads, or nowhere on
  purpose (`node.nowhere`). A part's own panel is a breadcrumb with a way
  back, its name and kind, then Content, Position and size, Look, Motion,
  and the prompt and Make a picture folded; sections remember being folded.
  A link's words are edited on the label inside it. `tests/side-panel-g.mjs`.
- **A picture is made in one place**: the Pictures tab, the drawing tool on
  a tab of its own, there whether or not anything is picked. With one part
  picked it draws for that part and puts what it draws on it; a drawing also
  drags onto the page at its own size. A picture's "Draw one" opens the tab
  rather than being a second generator. A part's closed "Make a picture"
  keeps only where a picture of that part is sent (the model and its
  options), with a press that opens the tab. It sat inside "Make a picture"
  for a while and could not be found with nothing picked; the owner asked
  for it back on a panel of its own. `tests/side-panel-h.mjs`.
- **A site made here has Refresh and Publish beside Go live.** Both work
  on the repository Go live made for it. Publish puts the board in as the
  builder-ready kit (builder.json, a data-hook on every part, tokens, the
  style layer, the kit's CLAUDE.md and checks) on a kit/ branch, merged, so a
  code chat can work there; it waits once a chat has pushed, so the chat's
  work is never written over. Refresh is green while the repository is where
  the board left it; once a chat has pushed it asks, then brings the
  repository in, and the site is a site from code from then on, with the
  code site's own Refresh and Publish (`BuilderSiteButtons.tsx`,
  `kitPublish.ts`, `tests/builder-site-code.mjs`).
- **A picture's background is cleared by pointing at it.** The wheel's tray
  under any picture has "Transparent background…": the picture over a
  checkerboard, the four corners picked as a first guess, a click on the
  picture picks that colour (Shift adds one), "How close" and "Everywhere in
  the picture" say how far it reaches. Apply keeps a new PNG on the part,
  the old one in its versions, and one Undo puts it back. The edge fades
  rather than cutting hard, with the background taken out of the faded
  pixels' colour so no pale specks are left on a dark page, and "Trim edge"
  takes off a ring of halo a pixel at a time. A cleared picture is drawn
  with no frame: no line, no corners, no floor behind it, on the board and
  on the published page (`seeThrough.ts`, `tests/see-through.mjs`).
- **Pages shows the link as it will be shared**: the card a pasted link
  draws, from exactly what the head will say (`pageHead`'s rule: the typed
  description), and a character count on the name (60) and the description
  (50 to 160) that says in words what happens past it.
- **Hard-to-read words are one press from readable**, in the site's own
  word colours, as one undo step (`readableFixes`). Outlined lettering is
  measured by its outline, so a site's edged headings are never "fixed".
  Words are measured against what is painted right behind them
  (`backdropOf`): their own paint, else the topmost earlier part covering
  them that paints a fill, a gradient (every stop) or a picture (sampled
  under them, `pictureSampler.ts`), else the page; the worst colour there
  counts, and words over a picture not yet in the browser are not judged.
  `tests/readable-backdrop.mjs`.
- **The Builder learns from every site imported, builder-wide.** Each
  import (through `loadDoc`) is read for what can be used again
  (`library/learned.ts`): its versions of shelf items, filed under the item
  each is a version of (one item, a "Trorty version" per site), its style
  kits and motions, its font pairing with the files, its palette as
  painted. Nothing that would do nothing elsewhere is kept: a feature tied
  to the site's own parts, a motion without its keyframes; each is listed
  as skipped, with why. Kept under `builder.learned` (versioned, in every
  backup), never inside a board: removing a board leaves it, forgetting a
  site is the person's press on "Learned from your sites" (Builds, and the
  command palette). `tests/learned-library.mjs`.
- **A site's own effect is any part's.** The TV's screen look (scanlines,
  static, colour shift, jitter) is the Screen filter, its switch-on is
  Switch on, a pressed key's sink is Push on press (`library/effects.ts`),
  each a library feature, so the published page runs what the board shows.
  Every import teaches its own settings for them as a site's version.
  Clicking a part opens an **Effects** section offering what fits its kind
  (`library/partEffects.ts`): a picture (or a box holding one) its filters,
  a button its hover and press and the button looks the sites taught, a
  section the pointer and background motions, every part the openings;
  plain or a site's version, with its settings right there.
- **A part can be saved whole.** "Save as a component" in the part panel
  keeps the part and everything inside it (the TV with its screen, its
  filter, its knobs, its keyframes, its fonts) builder-wide, in the
  learned library and in backups, under the shelf category picked
  (`library/components.ts`). The shelf shows it under "Saved components"
  in that category; Add places it with fresh ids, holding what it held.
  What it holds is the part tree's reading; Lane J's grouping plugs in as
  `members`. `tests/universal-effects.mjs`.
- **Motion lists kinds as compact rows**: icon, name, count, one switch;
  the all-at-once speed is inside when opened. Frame interpolation is its
  own folded section at the foot.
- **No em dashes in anything a person reads.** A dash is a pause a designer
  reaches for when a sentence has two halves and no punctuation chosen for
  them. On a screen it reads as a machine's tic, and there are hundreds of
  these lines. So every label, hint, empty state and button caption in the
  Builder uses a comma, a colon or a full stop instead, and the sweep is
  global rather than per screen. Comments and prompts sent to Claude are not
  UI copy and keep theirs; a bare "—" standing in for an empty value is a
  glyph, not a sentence, and stays.
- **A finding lands beside the prompt it is about.** Critique, Fill and Finish
  return their prompts as a `json revisions` block, and the Trail view in the
  Blueprint dialog draws them as a map: written, found, now, joined by lines,
  with Take it on any finding that carries a prompt. A critique you can only
  copy is a critique nobody applies.
- **A box drawn on its own is a box, and a box is the cube.** Nobody who
  draws a rectangle with nothing beside it wants to be asked what it is;
  they want it back as a thing. So a lone closed line with four corners,
  nothing typed and nothing of the page inside it, is read as a box off its
  own geometry (`isBox`) and becomes the cube with no model called, at the
  proportion it was drawn. Words beside it win over the shape, and a box
  round parts or over a real part is their frame or its edge, as before.
  The cube it becomes has limits and a rest: pitch never past 85°, and on
  release it eases to the nearest three-quarter view, never a flat square.
  A face is picked by pressing it and edited in the panel or on the wheel's
  pencil; the model road past the cube is lit only by a token in the Keys
  panel and is never an error without one. `tests/box-to-cube.mjs` walks
  the whole thing and photographs each step.
- **A picture is the wrong answer for a thing that moves.** The renderer
  traces a drawing and a trace is a still; a cube has to turn, and what is
  written on its sides has to still be text afterwards. So the drawing says
  what kind of thing it is and how big, and the element is code. The test
  for which path a drawing takes is whether the result has to do anything:
  a helix is a shape, a cube is a machine.
- **The drawing is the specification; nothing may paraphrase it.** A model
  that writes SVG has to be told in words what was drawn, and a line
  described is a line lost. So the drawing path has no writer in it: the
  strokes are rasterised and traced, and what comes back is cut to the line
  that was drawn round it. When it falls short the thing that changes is the
  picture the tracer was given, never a sentence about it. It is judged like
  against like: a closed line is the edge of a thing and both sides are
  filled and compared as areas; an open line is the thing and both sides
  stay ink, compared within a tolerance the width of the stroke drawn. Thin
  ink is never scored against a filled area, and the two frames are always
  the same frame. The same rule
  decides behaviour: a ring is a container because it is a ring, read off
  the geometry, not because anyone said so.
- **A key the person is billed for is the person's to hold.** The renderer's
  Replicate token sits beside the Claude key under the same button, in the
  same keys panel, unlocked the same way, and rides with the call. It is the one
  key whose browser value beats the server's, because a drawn body costs
  eight cents and the person who typed the token is the one paying for it.
  The card says the price where the others say what the key is for.
- **The browser holds only what a browser request can carry.** The Claude
  key rides as a header on the studio routes, so the keys panel holds it: in this
  browser, in the clear, with no PIN in the way and a plain Forget to end it.
  (A PIN — sealed, or held for the tab — is a setting away for anyone who
  wants one, and needs https or localhost for Web Crypto.) GitHub, X and Vercel are read by the server alone; a field for
  them in the browser would be a promise the app cannot keep, so the panel
  names them as server-only instead. The GitHub mark in the top bar is a
  link to `repository` in `site.config.ts`, never a login. A "Try it" beside
  the key asks Anthropic whether it works, so a silent prompt has a first
  answer.
- **One press picks the control; two presses type its words where they
  are.** A press on words inside a button, a link or a card picks that
  button, link or card (`owner.ts`), and moving it carries what it holds.
  A second press, or Enter, opens the words on the canvas in the part's own
  face (`WordsInPlace.tsx`); Enter or a press elsewhere keeps them, Escape
  puts them back, and the edit is one undo. Words drawn in several places
  still open in the panel. `tests/select-owner.mjs`.
- **Escape climbs out one level at a time**: out of the words, a drawing
  tool back to Select, a part to the part that holds it, then nothing
  picked. The arrows nudge a pixel (ten with Shift), one undo per run;
  Ctrl+C copies what is picked. `tests/board-keys.mjs`.
- **A new idea lands where the person is looking**, centred on the visible
  canvas or on the point right-clicked, and picked. A refusal is said beside
  the pointer, whole. `tests/new-idea-here.mjs`.
- **The shelf gives the canvas back.** It folds to a strip (kept in this
  browser), an open category is never more than about a third of the canvas
  however it is grown, Escape puts it away, its close button sits by its
  name, and a search lists this page's parts before the shelf's.
  `tests/shelf-strip.mjs`.
- **Tablet and Phone show the page as those are served it, never the
  desktop cut off.** One plan (`live/small.ts`), and one page drawn once with
  that plan as rules on its parts (`live/smallCss.ts`), for the board's Tablet
  and Phone views, Preview, the companion window and the published page
  (where the rules sit under media queries: one element per part, every
  script and motion at every width): the capture's own layout at that
  width when it has one, else a sensible stack in the desktop's reading
  order (a Menu for the nav, buttons full width and a tap tall, titles scaled
  to fit, pictures fitted, side decorations left out), with the person's
  per-part "On tablet" / "On phone" settings on top. A setting at one width
  changes nothing at another. Format and rules: `docs/RESPONSIVE.md`;
  `tests/small-plan.mjs`, `tests/small-pages.mjs`.
- **Builds shows the sites and their repos at once, never as tabs.** The
  sites take the page, each card led by its picture, as large as the row
  allows; Repos is a column beside them (under them on a phone). With his
  GitHub key held, his repositories are read once and offered under each
  site's field, so a publish target is one press with that repo's own
  default branch; typing owner/name is the fallback. His repos are listed
  below, each naming the site that publishes there. `tests/builds-repos.mjs`.
- **A part's state changes that part and nothing else; the board is the
  picture.** A part with states gets a step bar on the board when picked
  (`StatesTimeline.tsx#StepBar`, pinned to the board's foot so a tall
  panel's bar is never below the fold): its name, a key per step, back and
  next, Finish at the end back to how the page opens. A step changes only
  what is inside the part: a face the page adds slots into the part's flow
  and the part grows, drawn over its neighbours rather than moving them; a
  screen that changes the part is kept to the part. What comes in on the
  page as a whole is a **scene**: one real capture of one moment of the
  site, its positions and its words together, never one moment's words at
  another's places. In a scene every part sits where that capture drew it,
  so a part that grows moves its neighbours as the live page does, and no
  words land on other words beyond what the live page has. A page has a
  handful of scenes in the order a visitor meets them (connecting, sign in,
  lobby, queue, match, result), each with its variants (offline; won, lost,
  draw); two captures of the same step drawing the same parts are one. What
  is drawn over the page rather than being a moment of it (the tour, a menu)
  sits in its own **On top** row and goes over whichever scene is on
  (`scenes.ts`). The shelf's States is a scenes-by-parts grid: a column per
  scene, a row per part with states, each cell the state that scene puts
  the part in; pressing a cell in another column swaps that part's state
  into the scene that is on, one state per part. **Focus** (a row's
  expand key, the step bar, or the wheel) opens one part alone at real size
  with all its states side by side (`PartFocus.tsx`). Plain cards with a
  name and a number; never a shrunk picture of the part.
  `tests/part-steps.mjs`, `tests/state-frames.mjs`.

## 3. The drawing board

The disc is the void with something slower than weather moving under it: four
wide clouds on orbits of a minute and a half to nearly three, and one warm
point at the middle that breathes over half a minute, to start from. No stars
and no crosshair — a scatter of points on a drawing surface is a scatter of
things to draw round — and no caption on the rim. The last sixth of the radius
falls to near black, and past the rim is a black hole's horizon: a hair of dim
orange-red right at the edge, spread thin for a few tens of pixels and gone.
Small and dim; never a lit rim, never dark bands. Repaint on a slow ticker
(`DRIFT_MS`), never per frame; the drift is sub-pixel per tick, which is the
point.

The reader is Claude (`/api/studio/reshape`) and it may only ever pick catalog
ids ("Never invent an id"); without a key the drawing's proportion is the
reshape and the drawing goes into the blueprint as a `drawn:` line. A drawing
is never lost to a missing key.

**The lines drawn are the barriers and the boundary of the part.** That is
the rule the reader is written to, in those terms: the outermost closed line
is a hard boundary and is where the part ends, the part fills it with no
margin inside, nothing crosses it, and its proportion is the part's. Lines
inside are barriers too — they divide the inside, and what sits in a division
stays there. The prompt that comes back is asked to be the most specific
thing there is about *this* drawing: the boundary and its proportion, what
sits inside and where, which lines divide it — never advice that would fit
any part of any site. The boundary is measured before the call
(`sketch.ts`, `readBoundary`) and sent as words, as a box in percent of the
board, and as a bare aspect number, beside the box round everything drawn;
`describeBoundary` is that sentence. An outline counts as the boundary only
when it holds `BOUNDARY_SHARE` of what is drawn, so a small mark beside a big
scrawl is a mark, not an edge. Everything the part is fitted to — the reader's
answer and the no-key fallback alike — is the boundary, never the box round
the ink. A stroke that leaves the outline is counted, and the outline still
bounds the part.

A shape the board snapped is four or five points, so `strokeClosed` asks for
four, not eight. It asked for eight once, which meant every snapped box read
as an open line and no drawing had a boundary at all.

**The outline's shape is kept, not only its size.** `readBoundary` classifies
the closed outline — circle, ellipse, box, rounded box, or a path that is
none of them — from how much of its own box it fills and how even its
distance from the middle is; the measurement sent to Claude names it, the
answer's schema has a `shape` field, and the part is cut to it (`node.shape`,
applied by `Block`, `50%` for a circle or an ellipse). A circle is made as
tall as it is wide. Without a key the shape still reaches the part, because
it was measured here. This was reported from the deployed board: a circle
drawn round a part came back as a 380×351 rectangle, because the rule fitted
the box round the outline and dropped the outline.

The answer is a suggestion until `reshape.ts` has held it to the catalog, the
frame and the drawing: ids and option values not in the library are dropped,
the size is clamped to the frame, and a size a third or more off the
boundary's proportion is brought back to it when there are no words that
could have asked for that (words win; a bare drawing says only its shape). A reply that
kept the old shape would read on the board as the drawing doing nothing. A new
part keeps the author's words as its prompt whether or not the reader wrote
one. `tests/reshape-answer.mjs` holds the check to these rules and
`tests/reshape-schema.mjs` holds the route's schema to what structured output
accepts.

## 4. How the owner works, and how to work with them

These are the working rules that came out of the sessions, not preferences to
guess at:

1. **Show before you finish.** Screenshots of the thing mid-work, sent as
   files, not described. The owner corrects from pictures.
2. **Ask before a big revamp; act on small ones.** A redesign of a whole
   surface gets a short set of yes/no questions first (three or four, with a
   recommendation each). A colour, a slab, a wording — just do it and show it.
3. **A correction is a rule.** When the owner says "no aura", "no grey", "the
   slab is always square", "the sample block only", write it into this file and
   into a Playwright check the same session. The suites in the scratchpad are
   the memory that survives a new session.
4. **Merge the other branch first and show what it changed** when asked to
   revamp something another session touched.
5. **Check for unneeded files** after removing a control; delete what nothing
   imports, keep what the board still uses, and say which is which.
6. **Placeholders over missing buttons.** If a feature is asked for and not yet
   designable, cut the button and wire it to a tap.
7. **Crypto stays parked.** The wallet signs in the browser; no private key
   enters the tool; the exchange is non-custodial; the Builder holds no trading
   code. Those stages are "parts that expand into a spec", not code.
8. **Never make the API key load-bearing.** Every Claude route returns
   `ok: false` with a reason and the UI does the honest fallback.
8b. **A call that can hang must have a deadline at both ends, and the
   spinner must always stop with a sentence.** A route that waits on Claude
   with no budget of its own is killed by the platform where it stands: no
   response, no status, nothing for the page to show, and a spinner that runs
   until someone reloads. So the route answers itself before its own
   `maxDuration` is up (`ANSWER_BUDGET_MS`), the SDK gets a timeout and no
   retries inside that, and the browser keeps a longer deadline of its own for
   the case where nothing arrives at all. Every failure is HTTP 200 with a
   reason and the seconds it took; what the API said — its status and request
   id — is passed on rather than swallowed, because a report of "it hung" with
   no request id cannot be looked up by anyone. A reply that is not JSON (a
   gateway's own error page) is read as the status it is, never handed to
   `res.json()` to fail as a parse error. And every Stop reaches the call it
   appears to stop: a button wired to only half the work is worse than no
   button. `tests/generate-timeout.mjs` holds this to it.
9. **Check for updates before every commit, always.** Other sessions work
   this repository on their own branches at the same time. Before a commit
   is made — not after, not at the next prompt — fetch the remote, look at
   every branch that moved (`git fetch --prune`, then ahead/behind against
   each), read what arrived, merge what relates, and only then commit and
   push. `.claude/hooks/catch-up.sh` does the fetch and the report at the
   start of every turn; the check before the commit is the session's own.
10. **A check presses a wheel piece by its label, never by its bounding
    box.** On a square wheel the outer blocks are L-shaped, and an L's box
    centre is the empty corner it wraps: a click aimed there lands on
    something else and Playwright retries until it times out. The word or
    icon on a piece is glued inside the piece's own group, so its centre
    is always on the piece. `tests/light-placer.mjs` grabs the sun by its
    label for this reason, and the scratchpad suites press every piece
    through one helper that does the same.

## 5. Training an agent on this — what actually works

You do not fine-tune a model on a chat log. What carries across sessions is:

- **This file and `AGENTS.md`**, read first by every session (`CLAUDE.md`
  points at both). Every rule above was once a sentence the owner typed; the
  file is the conversation with the noise removed.
- **The Playwright suites** (`wheel.mjs`, `bugs.mjs`, `frame.mjs`, `erase.mjs`,
  `studio.mjs` and the `shot-*.mjs` screenshot scripts). Each check is one
  thing the owner asked for, in the owner's words, and fails when it stops
  being true. A new session runs them before and after. A scratchpad belongs
  to one session, so a check that must outlive it goes in `tests/` in the
  repository — `tests/wheel-dismiss.mjs` is the first. Run one against a
  server you started: `node tests/wheel-dismiss.mjs http://localhost:3000`.
- **The commit messages.** They carry *why* each thing arrived, so a later
  session does not undo it. There was a changelog in the app doing that job
  and it is retired: the owner reads the work, not a log of it, and a file
  every session has to append to becomes a file every session argues with.
  Do not add entries to it and do not start another.
- **The prompt recipes** in `docs/PROMPTS.md`, which say how to hand a
  blueprint to a fresh agent.

To train a session on a particular site rather than on the Builder, the same
shape applies: declare what a part *does* (its `actions`) beside what it looks
like, turn the blueprint into a task list, and use that list as the eval set —
the site's own build-and-verify loop, not a fine-tune.
