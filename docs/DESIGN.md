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
  turns the wheel. The line goes the moment it has done its job.
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
- **The page's background is a thing.** Click the bare frame and it is
  selected like a part; the panel shows its fill and the texture layers that
  land on it; ⌘X cuts it bare and holds it, ⌘V puts it back, ⌫ strips it.
  Cut and paste on parts work the same way, and paste puts back whatever
  was cut last.
- **Placeholders are cut and wired.** Priority, Reiterate, Make-it-a-prompt: the
  button exists, sits where it will live, plays a tap, and does nothing yet. A
  placeholder is a promise about the layout, not about the feature.
- **Motion is under Animation, layout is under Edit.** A part's own options
  split by `MOTION_OPTION_IDS`: speed, autoplay, on-scroll and the like become
  Behaviour slabs; columns, density, shape stay on the Options screen.
- **Nothing on the disc's face.** The drawing board's whole face is drawing
  surface. Back is on the rim; Make real and Clear are in the tray under it.
- **The tray is for what is about the part but not about editing it.** Preview
  here, forward, back, copy and paste looks. A tab, not a row, until the hand
  goes to it.
- **The blueprint is the product.** Every field a part gains must reach
  `spec.ts` in words an agent can act on the same session. If the board can set
  it and the blueprint cannot say it, it is not done.

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

## 5. Training an agent on this — what actually works

You do not fine-tune a model on a chat log. What carries across sessions is:

- **This file and `AGENTS.md`**, read first by every session (`CLAUDE.md`
  points at both). Every rule above was once a sentence the owner typed; the
  file is the conversation with the noise removed.
- **The Playwright suites** (`wheel.mjs`, `bugs.mjs`, `frame.mjs`, `erase.mjs`,
  `studio.mjs` and the `shot-*.mjs` screenshot scripts). Each check is one
  thing the owner asked for, in the owner's words, and fails when it stops
  being true. A new session runs them before and after.
- **The changelog** (`src/features/updates/changelog.ts`), newest first,
  which says *why* each thing arrived, so a later session does not undo it.
- **The prompt recipes** in `docs/PROMPTS.md`, which say how to hand a
  blueprint to a fresh agent.

To train a session on a particular site rather than on the Builder, the same
shape applies: declare what a part *does* (its `actions`) beside what it looks
like, turn the blueprint into a task list, and use that list as the eval set —
the site's own build-and-verify loop, not a fine-tune.
