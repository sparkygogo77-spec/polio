# A captured page's scripts, attached as features

sink records what a page's **stylesheets** say about motion (`docs/CAPTURED-MOTION.md`)
and now what only its **script** does (`doc.behaviours`, sink `docs/behaviours.md`):
the loader, the intro, reveals, a header that changes once scrolled, layers that
follow the pointer, the marquee, the lights that blink. Taking a document in
(`docTake.ts` → `library/captured.ts#attachCaptured`) attaches the library feature
that does each to the part it was recorded on, with the settings measured. The
section itself is not kept; what it attached is, as `node.work`.

| recorded (sink) | attached | settings |
|---|---|---|
| `loader` | **CRT loader** on the part showing the loader's picture (trorty → the TV screen) | title, ticker, channel, label; `hold` = when the page switched it off |
| `reveal[]` | **Reveal on scroll** on the part and on every part inside it (a captured page is flat) | direction and distance from the rest transform less the shown one, `scale`, stagger `delay`, `duration` and `ease` from the transition; parts inside scale about the container's centre (`origin`) |
| `intro[]` | **Reveal on scroll**, `after: loader` | from the `animate()` keyframes: 40 px, 0.9, 800 ms, 150 + 110·i ms |
| `loops[]` marquee | **Marquee loop** | `speed` = the script's step a frame × 60 (0.6 → 36 px/s), direction, never pausing, no gap |
| `pointer[]` move | **Follow the pointer**, `how: layer` | `x`, `y` px over the whole window, `scroll` px a px |
| `scrollClass[]` | **Header bar on scroll** (new) | `at` 40, the fill and the edge it took, its pace |
| `idle[]` taking a part to no opacity | **Blink** (new) | its period and steps; the captured `blink` animation is handed to the feature, so switching it off stops it |
| `pointer[]` turn (the TV) | nothing from this row | the TV's screen, knobs and words are parts of their own; turning its box alone would tear it apart. Sampled under the pointer (`motion.hover`, below), it is a Tilt carrying them |

The other idle loops (the planet's spin, the eyes, the title's wobble, the
screen's `screenJit` flicker) stay captured CSS and already play.

## Motion sampled (`behaviours.motion`)

sink also samples motion as the browser draws it, on any page, whoever does it
(`via: css` or `script`; sink `docs/behaviours.md`, "Motion sampled"). Each is
attached the same way:

| sampled (sink) | attached | settings |
|---|---|---|
| `spin[]` | **Spin** (new) | `period` s a turn, `direction` cw / ccw. Not when it is a stylesheet loop the part already carries (the planet's 140 s `spin`): that plays as captured CSS |
| `float[]` | **Float** (new) | `travel` px, `period` s, `axis`, `toward`, `ease`. The same rule: a carried stylesheet loop is not given twice |
| `hover[]` tilt, by a script | **Tilt** | `across`, `down` (degrees over the whole part), `lift`, `depth`, `perspective`, `pace`; `parts`: every part inside it, turned about its middle with it, so a thing drawn as several parts (the TV: screen, knobs, words) turns whole; `area`: the part the page listened on (the TV's holder), watched from the window since the carried parts sit over it |
| `hover[]` lift, by a script | **Lift on hover** (new) | `lift`, `x`, `turn`, `scale`, `pace`. A stylesheet's `:hover` is carried as captured CSS (`node.motion.hover`) and is not given twice |
| `scrollSpeed[]` | the part's **Marquee loop**, `boost` and `cap` | its step a frame is its own plus the scroll's pace (eased 0.9 / 0.1, as the page measures it) × `boost`, never more than `cap`: the animation's playback rate |
| `scrollGrow[]` | **Grow with the scroll** (new) | `prop`, `start` / `end` (where its own top is, as a share of the window), `from` / `to` %, `kept` (how much of it the capture drew, seen with its section in view): made whole, then clipped to what the scroll has reached |
| `canvases[]` particles | a new part: an inert box at the canvas's box, just over the part painted under it, carrying **Dust** | `colours`, `spacing`, `speed` (its specks' pace a frame over the feature's 0.275), `size`, `direction`. The canvas itself is never a part |

**On the board.** Only what moves on its own plays there (`AMBIENT`: Spin, Float,
Dust), softly (a float half as far, the dust half as thick), on the drawn layer
inside the part (`[data-part-drawn]`), never on its box: the part is picked,
moved and resized as ever, and the dust layer is inert, so a press goes through
it. What answers the pointer or the scroll (Tilt, Lift, the Marquee, Grow) does
not play on the board. Less motion asked for: nothing moves (each script asks).

A box carrying a working feature is never a "twin" the sweep takes out
(`twins.ts`): the Dust layer has the hero's own box.

Check: `tests/motion-sampled.mjs` (sink's stand-in page, captured and
converted, as `tests/fixtures/motion-sampled.json`; trumpmorty.fun from a sink
checkout beside this one): attached, then played on the board, in the Preview
and on the served export, and held still for less motion.

**Where they play.** The published page, as every feature does
(`assets/features/*.js`). The Preview now too: `live/runWorks.ts` runs the same
runtime and scripts on the Preview's part elements (`LiveSite features`, set by
`LiveStage` and `PreviewPage` only). The board, the companion and a page on a cube
never run them. Each script asks `prefers-reduced-motion` and holds still; the
header bar still changes, at once, because it is a state and not a motion.

**Switching one off.** The Element panel's Working block lists each feature a part
carries with a switch (`data-work-switch`); off, it stays with its settings
(`work.off`) and ships nothing. The fine settings sit under More.

Checks: `tests/behaviours-attach.mjs` (pure, on sink's document),
`tests/features-behaviours.mjs` (every script, published, in a browser), and
`tests/captured-behaviours.mjs` (the real door, the board, the Element panel,
Preview and the served export; writes `docs/shots/captured-behaviours-strip.png`).
