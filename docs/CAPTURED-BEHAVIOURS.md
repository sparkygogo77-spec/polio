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
| `pointer[]` turn (the TV) | nothing | the TV's screen, knobs and words are parts of their own; turning its box alone would tear it apart |

The other idle loops (the planet's spin, the eyes, the title's wobble, the
screen's `screenJit` flicker) stay captured CSS and already play.

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
