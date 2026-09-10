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
  ids, so the library can be re-sorted without a migration. Collapsing
  ids into fewer parts, or moving the behaviours into the page's wheel,
  are separate decisions and were not approved.
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
- **A wire seats.** Connect is a chain: the ends snap to the two parts'
  edges, the wire draws itself on, both parts ring once, and the source
  links to the target when it can. A connection that does nothing is a
  drawing, not a connection.
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
- **A finding lands beside the prompt it is about.** Critique, Fill and Finish
  return their prompts as a `json revisions` block, and the Trail view in the
  Blueprint dialog draws them as a map: written, found, now, joined by lines,
  with Take it on any finding that carries a prompt. A critique you can only
  copy is a critique nobody applies.
- **The browser holds only what a browser request can carry.** The Claude
  key rides as a header on the studio routes, so the vault offers it, two
  ways: sealed under a PIN (needs https or localhost) or held for the tab
  with no PIN. GitHub, X and Vercel are read by the server alone; a field for
  them in the browser would be a promise the app cannot keep, so the panel
  names them as server-only instead. The GitHub mark in the top bar is a
  link to `repository` in `site.config.ts`, never a login. A "Try it" beside
  the key asks Anthropic whether it works, so a silent prompt has a first
  answer.

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
