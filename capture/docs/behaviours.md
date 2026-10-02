# What a page's scripts do, through the capture

Motion & behaviours lane, 2026-09-28, branch `claude/serene-knuth-91h9ko` off
`claude/determined-fermi-rk7bil` (81d39ca). `docs/motion.md` carried what a
page's **stylesheets** say about motion. This carries what only its
**script** does, which no stylesheet names: the loader over the page as it
opens, the intro, the sections revealed as they scroll in, the header that
changes once scrolled, the layers that follow the pointer, the marquee, and
the loops that run forever. Recorded as data, in an additive
`doc.behaviours` section naming parts by id, so polio can attach a working
feature to each part in its place. A capture without it converts exactly as
before; the committed SOLCINERATOR captures still convert to the root
`site/document.json` byte for byte. trumpmorty.fun is the owner's own site.

The check is `node capture/site/capture/check-behaviours.mjs` (a stand-in page doing
each of these the way trumpmorty.fun's `main.js` does; red on 81d39ca,
31/31 now). Every page `capture-site.mjs` takes is captured with
`--behaviours` now (`--no-behaviours` to leave it out).

## How it is taken

`site/capture/behaviours-recorder.js` is injected before the page's own
scripts (like `sources-recorder.js`) and watches, changing nothing: a fixed
element over the whole window as the page opens (its words, its count as it
rises, the class it is switched off with, when it goes), every
`element.animate()` the page calls, and every class its script adds or
takes off an element, with the scroll at that moment and the
`transition-delay` the script set beside it.

`site/capture/behaviours-drive.mjs` then drives the page as a visitor would,
before the capture's usual scroll-through:

1. **idle**: at the top, the pointer never moved. An element whose inline
   transform changes on its own is a loop: sampled every frame for 1.5 s, the
   wrap-around step dropped, its speed, its step per frame and the frame rate
   it was measured at (headless Chrome ran this page at about 33 fps, so the
   speed per second is about half a 60 Hz screen's; the step per frame is the
   script's own). Every animation running forever is listed.
2. **pointer**: the pointer at 25 %, 30 % of the window, held 2.6 s (long
   enough for an eased follow to arrive), then at 75 %, 55 %. An element whose
   inline transform differs moves with the pointer (its factor, px per whole
   window of pointer travel) or, when the matrix turns, turns toward it.
3. **scroll**: 5 px steps to 120 px, then 200 px (a layer that moved with the
   pointer is measured again, for px per px of scroll), then half a window at
   a time to the bottom, then back to the top. A class the script added on
   the way down and never took off is a reveal; one taken off again at the
   top is a scrolled state. Computed styles are read before and after.

`--behaviours-shots <dir>` keeps a picture of the window at each step
(`docs/fidelity/behaviours/trumpmorty-fun/page_home/`: `loader`, `idle`,
`pointer-1`, `pointer-2`, `bottom`, `scrolled-60`, `top-again`).

One thing it changes before the dump, and says so: a light that blinks (an
infinite animation taking it to no opacity) is moved to its visible half when
it stands invisible, only then and only that animation
(`behaviours.heldVisible`). The dump drops what it measures at no opacity,
so taken on the other half a LIVE dot was not in the capture at all. This time
both were caught dark and both were held visible: `n_box_179` (the hero
badge's dot) and `n_prose_216` (the TV's "● LIVE").

Each element named is marked `data-sink-bh` and the dump carries it as
`bh`; the converter turns it into the part it was made into, the part it was
folded into (`folded: true`), or no part.

## The fields (`doc.behaviours`, version 1)

| field | what it holds |
|---|---|
| `loader` | `{covers, words[{text, size, cls}], counts[], label, channel, title, ticker, pictures[], canvases, animations[], lastedMs, off{class, afterMs}, nav{shown, off, gone}, removed, bodyClass[], bodyOff{removed, afterMs}}`: gone before the dump, so no part; kept as what it showed. `nav` is the same moments in ms from the navigation's start (`off`: when the page starts to show through), which a player times its switch-off to; `afterMs` is from when the loader was first seen |
| `intro[]` | `{part, selector, keyframes, duration, delay, easing, fill, iterations, atMs}`: each `element.animate()` call, on its part |
| `reveal[]` | `{part, selector, class, rest{opacity, transform, …}, shown{…}, transition, delayMs, atScroll, top, enterAt}`: `enterAt` is how far into the window the part's top was when the class came (0 the top, 1 the bottom) |
| `scrollClass[]` | `{part, selector, class, at, toggles, before{…}, after{…}, transition}`: `at` is the first scroll (5 px steps) with the class on |
| `pointer[]` | `{part, selector, kind: move or turn, at[{pointer: [x, y], transform}], perX, perY, perScroll, depth}`: `perX`, `perY` px of translation per whole window of pointer travel; `perScroll` px per px scrolled; `depth` the element's own `data-depth` when it has one |
| `loops[]` | `{part, selector, kind: marquee or drift, speed, perFrame, fps, clock, slowed{fps, perFrame, speed}, direction, copies, width, loopWidth}`: `copies` is how many times the words are written in the track. Sampled twice, at the page's frame rate and with every frame held 30 ms longer (`slowed`): `clock: "frame"` when the step a frame held (the page moves it so much each frame, so a 144 Hz screen runs it 2.4 times as fast as a 60 Hz one), `"time"` when the speed held; absent when the two rates were too close to tell |
| `idle[]` | `{part, selector, pseudo?, name, css, duration, easing, delay, direction}`: every animation running forever |
| `heldVisible[]` | `{part, selector, name, opacity}`: the blinks moved to their visible half before the dump |
| `glide` | `{how: script, css or jump, ms{base, perPx, max?}, ease?, curve[21], offset, page, pressed[{id, top, from, to, ms}]}`: how the page's in-page links take a visitor to their places (`glide.mjs`). Each link to a place of its own (up to four, spread over the page) is clicked from the top and the window's scroll read every frame; each named easing is fitted to the frames over the time that fits it best, and one within 2 % of the distance at every frame is `ease`, else `curve` is the shape measured (the share of the distance at each twentieth of the time). The time is a line through the distances pressed, capped (`max`) where the farthest fall under it; `offset` is where it stops against the place's top (a header's height short, negative). `css` when the stylesheet says `scroll-behavior: smooth` |
| `states[].timing[]` | `{part, lasts?, from?{x, y, opacity}}`: what a press flashed (`presses.mjs`, `holdAfterPress`). While a press is read, a timer of a second or more that the page sets once the press has already changed it is held, so what it showed stays put; then each is let go alone, in order, and what it puts back is what it timed: `lasts` ms after the press first changed the page, for a part it showed and for the part it stood in for. `from` is where a part came in from (a toast set 220 px below the window and slid up), its move and opacity before the press |

## What trumpmorty.fun yielded

Re-taken with
`node capture/site/capture/capture-site.mjs --url https://trumpmorty.fun/ --name trumpmorty-fun --shots docs/fidelity/behaviours/trumpmorty-fun`:
263 elements → 240 parts (239 before: the hero badge's blinking dot, caught
dark and held visible, is a part again). The part ids below are this
capture's; the ids in `docs/motion.md` and `docs/fidelity/trumpmorty-fun.md`
are the earlier capture's.

### The loader → `behaviours.loader`

A fixed `#loader` over the window reading **CH 47**, **● REC**,
**TRUMP & MORTY**, **$TRORTY** and **TUNING n%**; its count seen at
35 values (0, 4, 12, 16, 21, 26 … 98, 99, 100);
a picture (`https://trumpmorty.fun/assets/img/trorty.webp`, which no part shows once the loader has gone),
1 canvas (the static), running loaderZoom, scanroll, blink, crtOff. It stood
3376 ms, was switched off with `.is-off` after 2537 ms
(the body lost `is-loading` then) and was removed. (`main.js`:
at least about 1.8 s, then `crtOff` for 0.75 s.) Picture: `loader.jpg`.

### The intro → `behaviours.intro`

As the loader goes, `revealHero()` animates the hero's words and the TV up
from `translateY(40px) scale(.9)` at opacity 0, 110 ms apart:

| part | element | delay | duration | easing |
|---|---|---|---|---|
| `n_prose_178` “LIVE FROM THE YELLOW DIM…” | `div:nth-of-type(1) > div:nth-of-type(1)` | 150 ms | 800 ms | `cubic-bezier(.2,.9,.25,1.2)` |
| `n_valueprop_180` “TRUMP & MORTY” | `div:nth-of-type(1) > h1` | 260 ms | 800 ms | `cubic-bezier(.2,.9,.25,1.2)` |
| `n_box_181` | `div:nth-of-type(1) > div:nth-of-type(2)` | 370 ms | 800 ms | `cubic-bezier(.2,.9,.25,1.2)` |
| `n_box_183` | `div:nth-of-type(1) > div:nth-of-type(3)` | 480 ms | 800 ms | `cubic-bezier(.2,.9,.25,1.2)` |
| `n_box_190` | `div:nth-of-type(1) > button` | 590 ms | 800 ms | `cubic-bezier(.2,.9,.25,1.2)` |
| `n_box_194` | `div:nth-of-type(4) > div:nth-of-type(2)` | 700 ms | 800 ms | `cubic-bezier(.2,.9,.25,1.2)` |

### Reveal on scroll → `behaviours.reveal`

25 parts take `.in` from an IntersectionObserver (threshold 0.15, 40 px off
the bottom); the rest state (what the class takes away) was not in the capture
before. The stagger is the script's (`min(place among siblings, 5) × 90 ms`).
The shown transform is the page's own resting tilt (`.ch`, `.quote`, the
roadmap cards and the remote are turned):

| part | element | class | stagger | came in at (share of window) | rest → shown transform |
|---|---|---|---|---|---|
| `n_box_22` | `div > div:nth-of-type(1)` | .in | 0 ms | 0.468 | `matrix(0.96, 0, 0, 0.96, 0, 46)` opacity 0 → `none` |
| `n_prose_24` “CH 01” | `div:nth-of-type(2) > div:nth-of-type(1)` | .in | 0 ms | 0.443 | `matrix(0.96, 0, 0, 0.96, 0, 46)` opacity 0 → `matrix(0.999391, -0.0348995, 0.0348995, 0.999391, 0, 0)` |
| `n_valueprop_25` “THE LORE” | `div:nth-of-type(2) > h2` | .in | 90 ms | 0.502 | `matrix(0.96, 0, 0, 0.96, 0, 46)` opacity 0 → `none` |
| `n_prose_26` “A hole ripped open over …” | `div:nth-of-type(2) > p:nth-of-type(1)` | .in | 180 ms | 0.628 | `matrix(0.96, 0, 0, 0.96, 0, 46)` opacity 0 → `none` |
| `n_prose_27` ““LOOK AT THE CHART!”” | `div:nth-of-type(2) > p:nth-of-type(2)` | .in | 270 ms | 0.748 | `matrix(0.96, 0, 0, 0.96, 0, 46)` opacity 0 → `matrix(0.999391, -0.0348995, 0.0348995, 0.999391, 0, 0)` |
| `n_prose_28` “He hasn't blinked since.…” | `div:nth-of-type(2) > p:nth-of-type(3)` | .in | 360 ms | 0.844 | `matrix(0.96, 0, 0, 0.96, 0, 46)` opacity 0 → `none` |
| `n_box_29` | `div:nth-of-type(2) > div:nth-of-type(2)` | .in | 450 ms | 0.418 | `matrix(0.96, 0, 0, 0.96, 0, 46)` opacity 0 → `none` |
| `n_prose_46` “CH 02” | `div:nth-of-type(1) > div` | .in | 0 ms | 0.833 | `matrix(0.96, 0, 0, 0.96, 0, 46)` opacity 0 → `matrix(0.999391, -0.0348995, 0.0348995, 0.999391, 0, 0)` |
| `n_valueprop_47` “HOW TO BUY” | `div:nth-of-type(1) > h2` | .in | 90 ms | 0.392 | `matrix(0.96, 0, 0, 0.96, 0, 46)` opacity 0 → `none` |
| `n_box_49` | `div:nth-of-type(2) > article:nth-of-type(1)` | .in | 0 ms | 0.547 | `matrix(0.96, 0, 0, 0.96, 0, 46)` opacity 0 → `none` |
| `n_box_53` | `div:nth-of-type(2) > article:nth-of-type(2)` | .in | 90 ms | 0.547 | `matrix(0.96, 0, 0, 0.96, 0, 46)` opacity 0 → `none` |
| `n_box_57` | `div:nth-of-type(2) > article:nth-of-type(3)` | .in | 180 ms | 0.547 | `matrix(0.96, 0, 0, 0.96, 0, 46)` opacity 0 → `none` |
| `n_box_61` | `div:nth-of-type(2) > article:nth-of-type(4)` | .in | 270 ms | 0.547 | `matrix(0.96, 0, 0, 0.96, 0, 46)` opacity 0 → `none` |
| `n_box_65` | `div:nth-of-type(1) > div:nth-of-type(3)` | .in | 180 ms | 0.868 | `matrix(0.96, 0, 0, 0.96, 0, 46)` opacity 0 → `none` |
| `n_prose_81` “CH 03” | `div:nth-of-type(1) > div` | .in | 0 ms | 0.771 | `matrix(0.96, 0, 0, 0.96, 0, 46)` opacity 0 → `matrix(0.999391, -0.0348995, 0.0348995, 0.999391, 0, 0)` |
| `n_valueprop_82` “LIVE CHART” | `div:nth-of-type(1) > h2` | .in | 90 ms | 0.83 | `matrix(0.96, 0, 0, 0.96, 0, 46)` opacity 0 → `none` |
| `n_box_83` | `div > div:nth-of-type(2)` | .in | 90 ms | 0.484 | `matrix(0.96, 0, 0, 0.96, 0, 46)` opacity 0 → `none` |
| `n_prose_92` “CH 04” | `div:nth-of-type(1) > div` | .in | 0 ms | 0.578 | `matrix(0.96, 0, 0, 0.96, 0, 46)` opacity 0 → `matrix(0.999391, -0.0348995, 0.0348995, 0.999391, 0, 0)` |
| `n_valueprop_93` “SEASON 1 · ROADMAP” | `div:nth-of-type(1) > h2` | .in | 90 ms | 0.637 | `matrix(0.96, 0, 0, 0.96, 0, 46)` opacity 0 → `none` |
| `n_box_95` | `div:nth-of-type(2) > article:nth-of-type(1)` | .in | 90 ms | 0.836 | `matrix(0.96, 0, 0, 0.96, 0, 46)` opacity 0 → `none` |
| `n_box_100` | `div:nth-of-type(2) > article:nth-of-type(2)` | .in | 180 ms | 0.858 | `matrix(0.999657, 0.0261769, -0.0261769, 0.999657, 0, 24)` opacity 0 → `matrix(0.999657, 0.0261769, -0.0261769, 0.999657, 0, 24)` |
| `n_box_105` | `div:nth-of-type(2) > article:nth-of-type(3)` | .in | 270 ms | 0.831 | `matrix(0.999657, -0.0261769, 0.0261769, 0.999657, 0, 0)` opacity 0 → `matrix(0.999657, -0.0261769, 0.0261769, 0.999657, 0, 0)` |
| `n_box_110` | `div:nth-of-type(2) > article:nth-of-type(4)` | .in | 360 ms | 0.86 | `matrix(0.999848, 0.0174524, -0.0174524, 0.999848, 0, 24)` opacity 0 → `matrix(0.999848, 0.0174524, -0.0174524, 0.999848, 0, 24)` |
| `n_prose_123` “SELECT CHANNEL” | `div:nth-of-type(1) > div` | .in | 0 ms | 0.417 | `matrix(0.96, 0, 0, 0.96, 0, 46)` opacity 0 → `matrix(0.999391, -0.0348995, 0.0348995, 0.999391, 0, 0)` |
| `n_box_124` | `div > div:nth-of-type(2)` | .in | 90 ms | 0.522 | `matrix(0.96, 0, 0, 0.96, 0, 46)` opacity 0 → `matrix(0.999657, -0.0261769, 0.0261769, 0.999657, 0, 0)` |

### The header → `behaviours.scrollClass`

`n_box_225` (`body > header`) takes `.scrolled` at 45 px (`main.js`:
`y > 40`) and loses it back at the top. Before: background
`rgba(0, 0, 0, 0)`, box-shadow `none`, padding
14px / 14px. After: background
`rgb(243, 212, 64)` (the mustard), box-shadow `rgb(26, 15, 11) 0px 4px 0px 0px` (the
black bottom edge), padding 8px / 8px.
Transition `background 0.3s, box-shadow 0.3s, padding 0.3s`. Pictures: `idle.jpg` (no bar) and
`scrolled-60.jpg` (the bar).

### Pointer parallax and the TV's turn → `behaviours.pointer`

`main.js` moves every `.hero [data-depth]` layer by
`translate3d(−cmx × depth × 90px, scrollY × depth × 0.9 − cmy × depth × 50px)`,
with `cmx`, `cmy` easing 6 % a frame toward the pointer's place in the
window. The measured factors agree with that to within 1.5 %:

| part | element | kind | depth | px per window of pointer (x, y) | px per px of scroll |
|---|---|---|---|---|---|
| `n_box_10` | `section:nth-of-type(1) > div:nth-of-type(1)` | move | 0.05 | -4.44, -2.46 | 0.045 |
| `n_picture_11` | `section:nth-of-type(1) > img:nth-of-type(1)` | move | 0.25 | -22.19, -12.32 | 0.226 |
| `n_picture_12` | `section:nth-of-type(1) > img:nth-of-type(2)` | move | 0.4 | -35.51, -19.72 | 0.362 |
| `n_box_13` | `section:nth-of-type(1) > div:nth-of-type(2)` | move | 0.15 | -13.32, -7.39 | 0.136 |
| `n_box_14` | `section:nth-of-type(1) > div:nth-of-type(3)` | move | 0.3 | -26.63, -14.79 | 0.271 |
| `n_box_195` | `div:nth-of-type(2) > div` | turn |  | `none` → `rotateY(1.04785deg) rotateX(-1.81508deg) translateZ(20px)` |  |

The TV (`#heroTv`) turns toward the pointer over it (`rotateY(px × 22deg)
rotateX(−py × 18deg) translateZ(20px)`, back to none on leaving). The
`[data-tilt]` cards do the same over themselves; the pointer was not over
one, so they are not recorded. Pictures: `pointer-1.jpg`, `pointer-2.jpg`.

### The marquees → `behaviours.loops`

Two tracks moved by `requestAnimationFrame` (`t.x += dir × (0.6 + min(|scroll
velocity| × 0.25, 14))`), the red one left, the navy one right
(`data-reverse`); the script wrote their words four times (the navy one's
words already repeat twice, so its loop is an eighth):

| part | element | direction | px a frame | measured px/s (at fps) | copies | loop width |
|---|---|---|---|---|---|---|
| `n_prose_20` “$TRORTY ✦ EYES WIDE OPEN…” | `div:nth-of-type(1) > div` | left | 0.6 | 19.8 (33) | 4 | 1415px of 5660px |
| `n_prose_224` “CH 47 ● LIVE ● $TRORTY ●…” | `div:nth-of-type(2) > div` | right | 0.6 | 19.8 (33) | 8 | 488px of 3903px |

At 60 Hz, 0.6 px a frame is 36 px a second.

### Loops that run forever → `behaviours.idle`

The blinks, the screen's flicker and every other idle loop. They are CSS
`@keyframes` (the frames are in `doc.keyframes`, and the animation is on the
part as `node.motion.animation` where it is an element). The TV's scanline
sheet (`.tv__scan`) has no animation of its own: the flicker is `screenJit`
on the screen picture.

| part | element | keyframes | duration |
|---|---|---|---|
| `n_picture_227` | `a > img` | eyeSpin | 9000 ms |
| `n_picture_11` | `section:nth-of-type(1) > img:nth-of-type(1)` | spin | 140000 ms |
| `n_picture_12` | `section:nth-of-type(1) > img:nth-of-type(2)` | bob | 7000 ms |
| `n_box_179` | `div:nth-of-type(1) > i` | blink | 1000 ms |
| `n_valueprop_180` (folded) | `span:nth-of-type(1) > span:nth-of-type(1)` | wob | 2600 ms |
| `n_valueprop_180` (folded) | `span:nth-of-type(1) > span:nth-of-type(2)` | wob | 2600 ms |
| `n_valueprop_180` (folded) | `span:nth-of-type(1) > span:nth-of-type(3)` | wob | 2600 ms |
| `n_valueprop_180` (folded) | `span:nth-of-type(1) > span:nth-of-type(4)` | wob | 2600 ms |
| `n_valueprop_180` (folded) | `span:nth-of-type(1) > span:nth-of-type(5)` | wob | 2600 ms |
| `n_valueprop_180` (folded) | `span:nth-of-type(1) > span:nth-of-type(2)` | ampSpin | 4000 ms |
| `n_valueprop_180` (folded) | `span:nth-of-type(2) > span:nth-of-type(1)` | wob | 2600 ms |
| `n_valueprop_180` (folded) | `span:nth-of-type(2) > span:nth-of-type(2)` | wob | 2600 ms |
| `n_valueprop_180` (folded) | `span:nth-of-type(2) > span:nth-of-type(3)` | wob | 2600 ms |
| `n_valueprop_180` (folded) | `span:nth-of-type(2) > span:nth-of-type(4)` | wob | 2600 ms |
| `n_valueprop_180` (folded) | `span:nth-of-type(2) > span:nth-of-type(5)` | wob | 2600 ms |
| `n_prose_182` | `div:nth-of-type(2) > span` | pulse | 2400 ms |
| `n_box_210` | `a:nth-of-type(1) > b`::before | drip | 2800 ms |
| `n_box_210` | `a:nth-of-type(1) > b`::after | drip | 2800 ms |
| none |  | ant | 3000 ms |
| none |  | ant2 | 3400 ms |
| `n_picture_198` | `div:nth-of-type(1) > img` | screenJit | 6000 ms |
| `n_prose_216` | `div:nth-of-type(3) > b` | blink | 1000 ms |
| `n_picture_219` | `div:nth-of-type(2) > img:nth-of-type(1)` | floatA | 6000 ms |
| `n_picture_220` | `div:nth-of-type(2) > img:nth-of-type(2)` | floatB | 7000 ms |
| `n_picture_221` | `div:nth-of-type(2) > img:nth-of-type(3)` | floatA | 5000 ms |
| `n_box_76` | `a > b`::before | drip | 2800 ms |
| `n_box_76` | `a > b`::after | drip | 2800 ms |
| `n_box_126` | `div:nth-of-type(1) > span:nth-of-type(1)` | blink | 1400 ms |

## Motion sampled (`behaviours.motion`)

Capture script-driven motion lane, 2026-09-28, branch
`claude/jolly-hamilton-dosymj` off `claude/pensive-tesla-cp2l9g` (2521ca7).
What is above names motion by what the page's script did to classes and
inline styles. This samples it as the browser **draws** it, on any page,
whoever does it: a planet a stylesheet turns and one `requestAnimationFrame`
turns come out the same, each said with who did it (`via: css` or
`script`). `site/capture/motion-drive.mjs`, called by
`behaviours-drive.mjs`; the check is `node capture/site/capture/check-motion-sample.mjs`
(a stand-in with a script-spun disc, a CSS-floated ring, a script-bobbed
moon, a script-tilted card, a `:hover`-lifted button, a particle canvas, a
marquee the scroll hurries and a line the scroll grows; red on 2521ca7,
2/23; 26/26 now).

1. **idle**, 3.6 s at the top, the pointer away. Every element's drawn
   turn (`transform`'s angle plus the `rotate` property) and place
   (`transform`'s translation plus `translate`), every frame, for whatever
   moved in a first 300 ms look or has a forever animation. A turn that only
   grows or only shrinks is a **spin** (a line fitted: its period and
   direction, `cw` being CSS's positive angle). A place that goes out and
   comes back is a **float** (a sine fitted, its middle fitted too: a window
   shorter than a cycle has no fair mean). A stylesheet's own animation is
   read exactly instead: its keyframes played on a stand-in off the page at
   48 points of a cycle. Every canvas is looked at 12 frames running through
   a 64 × 40 copy; one that is drawn again is looked at twice, half a
   second apart, at its own resolution: blobs of drawn pixels are its
   specks (how many, their colours, their size), matched nearest to
   nearest for which way and how fast they go.
2. **hover**, after the scroll pass. Every element the page put a pointer
   listener on (the recorder patches `addEventListener`), every one a
   `:hover` rule moves, every `[data-tilt]`: scrolled into view, the pointer
   away, at its middle, at a quarter and at three quarters of it, away
   again, 450 ms each. What it or anything inside it did: a **tilt** when a
   script wrote `rotateX` / `rotateY` that differ between the quarters
   (degrees per whole element of pointer travel across and down, the lift,
   the depth, the perspective, the pace); a **lift** when it moved, turned or
   scaled the same wherever the pointer was. An element a forever animation
   moves is left out (it moved with the clock).
3. **scroll-motion**. A marquee (a loop the idle pass found) scrolled under
   at a steady 8 and then 80 px a frame, from rest (at least 120 frames
   still first: after a long jump the step sits at the page's cap, and a cap
   is steady too): its step at rest, the boost per px of scroll a frame and
   the cap (**scrollSpeed**). Then down the page in tenths of a window: an
   element whose width or height, as a share of its holder, grows one way
   only with the scroll is a **scrollGrow** (fitted: where its own top is in
   the window when it starts and when it is whole). The capture keeps it as
   drawn with its section in view (check-capture-2000 (10)) and says how
   much of the holder that is (`kept`).

| field | what it holds |
|---|---|
| `spin[]` | `{part, period (ms a turn), direction: cw or ccw, via, name?, degPerSec?}` |
| `float[]` | `{part, axis: y or x, travel (px), amplitude, toward: - or +, period (ms), easing, via, name?}` |
| `hover[]` | `{part, host (the part listened on), kind: tilt or lift, via, …}`; a tilt: `across`, `down` (degrees over the whole element), `lift`, `depth` (px), `perspective`, `perspectiveOn: self or holder`, `pace` (its transition), `back`, `at[]`; a lift: `lift`, `x`, `turn`, `scale`, `pace` |
| `scrollSpeed[]` | `{part, base, perScroll, max}`: px a frame at rest, extra px a frame per px scrolled a frame, the most extra |
| `scrollGrow[]` | `{part, prop: width or height, from, to (% of the holder), start, end (its top as a share of the window), holder, full, kept (% drawn in the capture)}` |
| `canvases[]` | `{host, below, above (the parts painted either side), box, zIndex, readable, kind: particles, repaint, still or unknown, repaints (share of frames drawn again)}`; particles: `specks`, `spacing` (px of width a speck), `size` (px across the middle), `colours`, `alpha`, `drift`, `perFrame`, `speed`, `fps` |

### How trumpmorty.fun does each, and what came through

Read in `assets/js/main.js` and `assets/css/style.css`, then sampled:

| motion | how the live site does it | captured as | params |
|---|---|---|---|
| the big planet turns | CSS `.hero__planet{animation:spin 140s linear infinite}`, `@keyframes spin{to{rotate:360deg}}` (the `rotate` property) | `spin` on `n_picture_10`, `via: css` | 140 000 ms a turn, cw, linear |
| …and drifts up and down | JS: `.hero [data-depth]` layers, `translate3d(−cmx·d·90px, scrollY·d·0.9 − cmy·d·50px)`, `cmx/cmy` easing 6 % a frame toward the pointer; the planet is `data-depth=0.25` | `pointer[]` move (above) | −20.6 / −11.4 px per window of pointer, 0.228 px a px of scroll |
| the ring bobs | CSS `.hero__ring{animation:bob 7s ease-in-out infinite}`, `@keyframes bob{50%{translate:0 −18px}}`, and `data-depth=0.4` | `float` on `n_picture_11`, `via: css` | y, 18 px up and back, 7000 ms, ease-in-out |
| dust drifts over the hero | JS canvas `#dustCanvas`: `width/18` specks, r 0.8–3.4 px, rising 0.1–0.45 px a frame with a 0.3 px sine sway, alpha 0.3–0.9, colours `#8fbf7a #a6d86f #89cebc #fff3a0 #ef9043`, drawn only while the hero is on screen | `canvases[]` particles at 0,0,1440,900, over the ring (`n_picture_11`), under the far desert (`n_box_12`) | 73 specks, one every 20 px, 2.2 px across the middle, those five colours exactly, rising 0.23 px a frame (median alpha 0.59) |
| the TV under the pointer | JS on `.hero__tv-wrap` `mousemove`: `#heroTv` `rotateY(px·22deg) rotateX(−py·18deg) translateZ(20px)`, `perspective:1200px` on the holder, `transition: transform .15s linear`; back to none on leaving. CSS `.tv:hover .knob` turns the knobs 120° and −80° (0.5 s) | `hover[]` tilt on `n_box_193`, host `n_box_192`; the knobs a CSS lift (carried as CSS hover) | 22° across, 18° down, forward 20 px, 1200 px, 150 ms |
| the cards under the pointer | JS on `[data-tilt]` (the lore picture, the four how-to-buy steps): `perspective(900px) rotateY(px·14deg) rotateX(−py·12deg) translateY(−6px)` | `hover[]` tilt on `n_box_18`, `n_box_45`, `n_box_49`, `n_box_53`, `n_box_57` | ≈14° across, ≈12° down, 6 px lift, 900 px; their pace is `.reveal`'s `transform .8s cubic-bezier(.2,.9,.25,1.2)` |
| the marquee speeds up while scrolling | JS: `t.x += dir·(0.6 + min(|vel|·0.25, 14))`, `vel = vel·0.9 + (scrollY − lastY)·0.1` each frame | `scrollSpeed[]` on both ribbons (`n_prose_228`, `n_prose_226`) | 0.6 px a frame, +0.245 per px a frame (measured 2.563 at 8 px a frame), at most +14 (14.6 at 80) |
| the roadmap line grows on scroll | JS: `#epLine.style.width = p·100%`, `p = clamp((vh·0.85 − top) / (height + vh·0.3))` of `#episodes` | `scrollGrow[]` on `n_box_117`, by width | 0 → 100 % of its holder, from its top at 0.853 of the window to 0.213; drawn at 78.6 % (`kept`), as seen with the roadmap in view |
| buttons, nav, stickers | CSS `:hover` (`translate(−3px,−3px) rotate(−4deg)` and the like) | `hover[]` lift, `via: css` (27) | already carried as captured CSS hover |

The LIVE dot, the eyes' `floatA`/`floatB`, the title's `wob` and the
screen's `screenJit` are CSS loops, listed as floats `via: css` and
carried as captured CSS as before.

## Not carried, and why

- ~~The speed-up while scrolling, the episode line, the `[data-tilt]`
  cards' turn, the dust~~: sampled now, "Motion sampled" above.
- **Inertia scrolling** (`lenis-on`): the capture does not use the wheel.
  A press on an in-page link is read (`glide`, above): trumpmorty.fun
  glides `min(1600, 500 + distance × 0.25)` ms on an ease-in-out cubic,
  62 px short of the place.
- **The antennas** (`ant`, `ant2`): listed in `idle`, but their zero-width
  holder is dropped by the dump, so no part.
