# Motion and embeds through the capture

Motion lane, 2026-09-27, branch `claude/youthful-cannon-yb4atv` off
`claude/capture-integration` (c052524). What a page does over time — its
`@keyframes`, each element's animation and transitions, the `:hover` /
`:focus` rules that move it — and the frames it embeds are now carried
from the capture into the document, so polio can replay them. Every field
is **additive**: nothing that was in the document before changes shape or
place, and the committed SOLCINERATOR captures still convert to the root
`site/document.json` byte for byte. trumpmorty.fun is the owner's own site,
captured locally only; the old contract addresses on it are obsolete.

The check is `node capture/site/capture/check-motion.mjs` (a stand-in page, served
on two hostnames so one stylesheet is cross-origin; red on c052524, 26/26
now). Read `docs/fidelity/trumpmorty-fun.md` for everything else about this
site.

## The fields

In the capture (`dump.mjs`, per element, and at the top):

    cap.keyframes            [{ name, frames: [{ key, style: { prop: value } }], sheet }]
    el.motion.animation      [{ name, duration, timing, delay, iterations, direction, fill }]
    el.motion.transition     [{ property, duration, timing, delay }]     (only with a duration or delay)
    el.motion.hover          [{ selector, self, style: { prop: value } }]
    el.motion.active         [{ selector, self, style: { prop: value } }]
    el.motion.focus          [{ state: focus | focus-visible | focus-within, selector, self, style }]
    el.motion.hover[].pseudo  "::before" | "::after", with `base`: a state that brings a pseudo-element not drawn at rest (a pill behind a link), its look at rest and under the state, read whole
    el.motion.hover[].of      on a pseudo-element's own part: whose state paints it, "host" (the element bearing it) or "above"
    el.embed                 { src, allow?, sandbox?, title?, loading? }  (an iframe)

In the document (`capture-to-document.mjs`):

| field | what it holds | where it came from |
|---|---|---|
| `doc.keyframes[]` | `{name, frames[{key, style}], sheet}`, every page's, by name | every stylesheet the page loads, the cross-origin ones included (fetched by `capture-route.mjs` before the dump and parsed by the browser into a sheet that is never applied) |
| `node.motion.animation[]` | one entry per animation on the element, every longhand as computed | `animation-*` |
| `node.motion.transition[]` | one per transitioned property, as computed | `transition-*` |
| `node.motion.hover[]` | the declarations a `:hover` rule sets on this element; `self` is true when the element itself is hovered, false when an ancestor or sibling is (`.tv:hover .knob`) | any `:hover` style rule whose selector, states removed, matches the element; in a `@media` block only when it matches the capture's window |
| `node.motion.active[]` | as hover, for `:active` (pressed): its own state, never folded into the hover or the resting look. The resting look is read with the pointer off the page, after each state rule is tried and the element read at rest again (`check-rest-states.mjs`) | as hover |
| `node.motion.focus[]` | as hover, for `:focus`, `:focus-visible`, `:focus-within` | as hover |
| `node.motion.letter` | the animation every letter of a folded title shares, when they all agree | a folded title (below) |
| `node.art.letterTransform` | the transform every letter shares, when they all agree | a folded title |
| `node.embed` | `{src, allow?, sandbox?, title?, loading?, size: {w, h}}`; the part is a `box` of that size, never a `picture` | an `<iframe>` (no longer skipped by the dump) |
| `node.content[i].{colour, size, face, weight, textShadow, textStroke, paintOrder, transform, motion}` | a folded title's run for one letter (or a run of letters) where it differs from the part | per-letter spans |

**What an animation drives is read at rest.** A part's opacity and
transform, when a running animation touches them, are read with that
animation taken off for the moment of reading (`dump.mjs`, `atRest`).
trumpmorty.fun's LIVE dot, `blink 1s steps(2)` over `50% { opacity: 0 }`,
runs 1, .5, 0, .5; read on a half step it was `opacity: .5`, and a rule
with no 0% or 100% stop of its own starts from and returns to the part's
own value, so the copy ran .5, .25, 0, .25. Every stop of every rule is
kept with its key and declarations, a stop's own
`animation-timing-function` included (`steps(3, jump-start)` as written);
`audit-keyframes.mjs` lists each site's animations, compares the stops
with the page's own stylesheet (`--css`), and names a part whose rest was
caught mid-animation.

Values are as the browser computed them (`0.3s`, `cubic-bezier(0.2, 0.9, 0.25, 1.2)`).
A value the page wrote through a custom property is resolved: against the
element for a hover/focus rule, against the root for a keyframe
(`var(--ink)` → `#1a0f0b`, `var(--ease)` → the curve). A hover/focus rule's
declarations are as declared, so a shorthand stays one
(`.nav a:hover{background: var(--mustard)}` → `background: #f3d440`);
`calc()` is kept as written. The old `node.art.animation` (the name only)
is still written beside `node.motion.animation`.

**A title split into letters is one part.** The converter looks for the
lowest element that holds only single-character leaf elements (plus empty
spacers and containers of them), at least three, touching in a line; that
element becomes one part (`value-prop` for a heading, else `prose`) with the
letters' words. Letters under one parent run on; a new parent (a row, the
"&") starts a new word. The letters' shared colour, size, face and text
effects (the outline, paint order and shadow they inherit from their row)
go on the part (`colour.text`, `font`, `art.textShadow`, `art.textStroke`,
`art.paintOrder`); where one letter differs, it keeps that value on its
run. A transform or animation is kept on each letter's run when the letters
differ; when they all agree it is written once (`art.letterTransform`,
`motion.letter`), since a transform on the whole part is not one on each
letter. `content` stays a plain string when no run carries anything. The
letter elements are folded (the ledger names each one).

## What trumpmorty.fun yielded

Recaptured with `node capture/site/capture/capture-site.mjs --url https://trumpmorty.fun/ --name trumpmorty-fun`
into `sites/trumpmorty-fun/`: 243 elements → 197 parts (was 207: the
title's 15 parts are one, the iframe is new, and three blinking lights,
the remote's LED, the ON AIR dot and "● LIVE", were caught on the visible
half of their `steps(2)` blink this time, so they clear the 5 % opacity
floor that dropped them before), 17 `@keyframes`, 11 animated parts plus 11 animated letters, 55
parts with transitions, 30 hover rules on 28 parts, no `:focus` rule (the
site has none), 1 embed. The per-part ids below are this capture's.

### Keyframes → `doc.keyframes`

All 17 rules of `assets/css/style.css`, with their frames: loaderZoom,
scanroll, blink, crtOff, eyeSpin, spin, bob, wob, ampSpin, pulse, drip,
ant, ant2, screenJit, floatA, floatB, staticShift. (Google Fonts' sheet is
cross-origin and was read too; it has none.) Eleven are used by a part or a
letter below; the six that are not:

| keyframes | used by | why no part names it |
|---|---|---|
| loaderZoom, scanroll, crtOff | the CRT loader | the capture waits for the loader to be gone, so no element runs them |
| staticShift | `.chart-placeholder::before` | a pseudo-element (the dump walks elements only), and the placeholder is hidden once the chart embed is shown |
| drip | `.drip::before`, `.drip::after` under BUY | pseudo-elements |
| ant, ant2 | `.tv__antenna i` | the antenna holder is `width: 0`, so the dump's visibility rule drops it and both antennas with it (a capture rule older than this lane) |

### Animations → `node.motion.animation`

| part | selector | animation: name duration timing delay iterations direction fill | field |
|---|---|---|---|
| `n_picture_10` picture | `main > section[1] > img[1]` | spin 140s linear 0s infinite normal none | `node.motion.animation[0]` |
| `n_picture_11` picture | `main > section[1] > img[2]` | bob 7s ease-in-out 0s infinite normal none | `node.motion.animation[0]` |
| `n_box_112` box | `main > section[6] > div > div[2] > div[1] > span[1]` | blink 1.4s steps(2) 0s infinite normal none | `node.motion.animation[0]` |
| `n_box_144` box | `main > section[1] > div[4] > div[1] > div[1] > i` | blink 1s steps(2) 0s infinite normal none | `node.motion.animation[0]` |
| `n_prose_147` prose | `main > section[1] > div[4] > div[1] > div[2] > span` | pulse 2.4s ease-in-out 0s infinite normal none | `node.motion.animation[0]` |
| `n_picture_160` picture | `main > section[1] > div[4] > div[2] > div > div[1] > div[1] > img` | screenJit 6s steps(1) 0s infinite normal none | `node.motion.animation[0]` |
| `n_prose_175` prose | `main > section[1] > div[4] > div[2] > div > div[1] > div[1] > div[3] > b` | blink 1s steps(2) 0s infinite normal none | `node.motion.animation[0]` |
| `n_picture_176` picture | `main > section[1] > div[4] > div[2] > img[1]` | floatA 6s ease-in-out 0s infinite normal none | `node.motion.animation[0]` |
| `n_picture_177` picture | `main > section[1] > div[4] > div[2] > img[2]` | floatB 7s ease-in-out 0s infinite normal none | `node.motion.animation[0]` |
| `n_picture_178` picture | `main > section[1] > div[4] > div[2] > img[3]` | floatA 5s ease-in-out 0s infinite reverse none | `node.motion.animation[0]` |
| `n_picture_184` picture | `header > a > img` | eyeSpin 9s linear 0s infinite normal none | `node.motion.animation[0]` |
| `n_valueprop_145` run 0 “T” | `main > section[1] > div[4] > div[1] > h1` (a letter) | wob 2.6s ease-in-out 0s infinite normal none | `node.content[0].motion.animation[0]` |
| `n_valueprop_145` run 1 “R” | `main > section[1] > div[4] > div[1] > h1` (a letter) | wob 2.6s ease-in-out -0.22s infinite normal none | `node.content[1].motion.animation[0]` |
| `n_valueprop_145` run 2 “U” | `main > section[1] > div[4] > div[1] > h1` (a letter) | wob 2.6s ease-in-out -0.44s infinite normal none | `node.content[2].motion.animation[0]` |
| `n_valueprop_145` run 3 “M” | `main > section[1] > div[4] > div[1] > h1` (a letter) | wob 2.6s ease-in-out -0.66s infinite normal none | `node.content[3].motion.animation[0]` |
| `n_valueprop_145` run 4 “P” | `main > section[1] > div[4] > div[1] > h1` (a letter) | wob 2.6s ease-in-out -0.88s infinite normal none | `node.content[4].motion.animation[0]` |
| `n_valueprop_145` run 6 “&” | `main > section[1] > div[4] > div[1] > h1` (a letter) | ampSpin 4s cubic-bezier(0.2, 0.9, 0.25, 1.2) 0s infinite normal none | `node.content[6].motion.animation[0]` |
| `n_valueprop_145` run 8 “M” | `main > section[1] > div[4] > div[1] > h1` (a letter) | wob 2.6s ease-in-out -0.5s infinite normal none | `node.content[8].motion.animation[0]` |
| `n_valueprop_145` run 9 “O” | `main > section[1] > div[4] > div[1] > h1` (a letter) | wob 2.6s ease-in-out -0.72s infinite normal none | `node.content[9].motion.animation[0]` |
| `n_valueprop_145` run 10 “R” | `main > section[1] > div[4] > div[1] > h1` (a letter) | wob 2.6s ease-in-out -0.94s infinite normal none | `node.content[10].motion.animation[0]` |
| `n_valueprop_145` run 11 “T” | `main > section[1] > div[4] > div[1] > h1` (a letter) | wob 2.6s ease-in-out -1.16s infinite normal none | `node.content[11].motion.animation[0]` |
| `n_valueprop_145` run 12 “Y” | `main > section[1] > div[4] > div[1] > h1` (a letter) | wob 2.6s ease-in-out -1.38s infinite normal none | `node.content[12].motion.animation[0]` |

The title's letters each run `wob` from a different negative delay (the
script sets `animation-delay: -(i*0.22 + row*0.5)s`), so every letter keeps
its own; the "&" runs `ampSpin` instead. `floatA` on the third eye runs in
`reverse`. The blinking lights are measured at one instant of their blink;
the remote's LED carries `opacity: 0.5` from it.

### Transitions → `node.motion.transition`

| transition: property duration timing delay | parts | field |
|---|---|---|
| opacity 0.7s ease 0s, transform 0.8s cubic-bezier(0.2, 0.9, 0.25, 1.2) 0s | 25: `n_box_19` `n_prose_21` `n_valueprop_22` `n_prose_23` `n_prose_24` `n_prose_25` `n_box_26` `n_prose_43` `n_valueprop_44` `n_box_46` `n_box_50` `n_box_54` `n_box_58` `n_box_62` `n_prose_72` `n_valueprop_73` `n_box_74` `n_prose_83` `n_valueprop_84` `n_box_86` `n_box_91` `n_box_96` `n_box_101` `n_prose_109` `n_box_110` | `node.motion.transition[]` |
| transform 0.2s cubic-bezier(0.2, 0.9, 0.25, 1.2) 0s, box-shadow 0.2s ease 0s | 12: `n_box_63` `n_ctaprimary_65` `n_ctaprimary_78` `n_box_129` `n_box_132` `n_box_135` `n_ctaprimary_138` `n_box_149` `n_box_152` `n_ctaprimary_155` `n_box_192` `n_box_195` | `node.motion.transition[]` |
| transform 0.12s ease 0s, box-shadow 0.12s ease 0s | 10: `n_ctaprimary_115` `n_ctaprimary_116` `n_ctaprimary_117` `n_ctaprimary_118` `n_ctaprimary_119` `n_ctaprimary_120` `n_ctaprimary_121` `n_ctaprimary_122` `n_ctaprimary_123` `n_ctaprimary_124` | `node.motion.transition[]` |
| transform 0.15s linear 0s | 1: `n_box_157` | `node.motion.transition[]` |
| transform 0.5s cubic-bezier(0.2, 0.9, 0.25, 1.2) 0s | 2: `n_box_162` `n_box_163` | `node.motion.transition[]` |
| background 0.3s ease 0s, box-shadow 0.3s ease 0s, padding 0.3s ease 0s | 1: `n_box_182` | `node.motion.transition[]` |
| background 0.2s ease 0s, transform 0.2s ease 0s | 4: `n_prose_187` `n_prose_188` `n_prose_189` `n_prose_190` | `node.motion.transition[]` |

The 25 with `opacity 0.7s, transform 0.8s` are the `.reveal` sections: the
page adds `.in` from an IntersectionObserver as each scrolls in, and the
capture records them revealed (the rest state `opacity: 0;
transform: translateY(46px) scale(.96)` is the class the script removes; it
is not in the capture).

### Hover → `node.motion.hover`

| :hover rule | whose hover | declarations, custom properties resolved | parts | field |
|---|---|---|---|---|
| `.btn:hover` | its own | `transform: translate(-3px, -3px) rotate(-2deg); box-shadow: 10px 10px 0 #1a0f0b` | `n_box_63` `n_ctaprimary_78` `n_box_149` `n_box_152` | `node.motion.hover[]` |
| `.ca:hover` | its own | `transform: translate(-2px, -2px); box-shadow: 8px 8px 0 #1a0f0b` | `n_ctaprimary_65` `n_ctaprimary_138` `n_ctaprimary_155` | `node.motion.hover[]` |
| `.key:hover` | its own | `transform: translateY(-3px); box-shadow: 0 10px 0 #1a0f0b` | `n_ctaprimary_115` `n_ctaprimary_116` `n_ctaprimary_117` `n_ctaprimary_118` `n_ctaprimary_119` `n_ctaprimary_120` `n_ctaprimary_121` `n_ctaprimary_122` `n_ctaprimary_123` | `node.motion.hover[]` |
| `.remote__power:hover` | its own | `transform: translateY(-3px); box-shadow: 0 10px 0 #1a0f0b` | `n_ctaprimary_124` | `node.motion.hover[]` |
| `.sticker:hover` | its own | `transform: translate(-3px, -3px) rotate(-4deg); box-shadow: calc(6px + 3px) calc(6px + 3px) 0 #1a0f0b` | `n_box_129` `n_box_132` `n_box_135` | `node.motion.hover[]` |
| `.sticker--x:hover` | its own | `box-shadow: calc(6px + 3px) calc(6px + 3px) 0 #d23c34` | `n_box_132` | `node.motion.hover[]` |
| `.tv:hover .knob:first-child` | a hovered ancestor (`.tv`) | `transform: rotate(120deg)` | `n_box_162` | `node.motion.hover[]` |
| `.tv:hover .knob:nth-child(2)` | a hovered ancestor (`.tv`) | `transform: rotate(-80deg)` | `n_box_163` | `node.motion.hover[]` |
| `.nav a:hover` | its own | `background: #f3d440; transform: rotate(-3deg)` | `n_prose_187` `n_prose_188` `n_prose_189` `n_prose_190` | `node.motion.hover[]` |
| `.sticker:hover` | its own | `transform: translate(-3px, -3px) rotate(-4deg); box-shadow: calc(4px + 3px) calc(4px + 3px) 0 #1a0f0b` | `n_box_192` `n_box_195` | `node.motion.hover[]` |
| `.sticker--x:hover` | its own | `box-shadow: calc(4px + 3px) calc(4px + 3px) 0 #d23c34` | `n_box_195` | `node.motion.hover[]` |

`.sticker:hover` resolves differently in the header and the footer because
`--sh` is 4px in one and 6px in the other.

### Embed → `node.embed`

`n_box_79`, `main > section[4] > div > div[2] > div[1] > iframe`, at
(164, 2920), 1112×579: the DEX Screener chart,
`{src: "https://dexscreener.com/solana/<address>?embed=1&…&interval=15", title: "DEX Screener chart", loading: "lazy", size: {w: 1112, h: 579}}`.
The page sets `src` from `site-config.js` and unhides the frame, hiding the
"NO SIGNAL YET" placeholder; no `allow` and no `sandbox` are written on it.
The address in `src` is the old, obsolete one. Before this lane the dump
skipped every iframe and the chart was a black 1120×590 box.

### The folded title → `n_valueprop_145`

`main > section[1] > div[4] > div[1] > h1` (`aria-label` "Trump and
Morty"), at (100, 215), 635×213, reading **"TRUMP & MORTY"** in 13 runs
(11 letters and two spaces). On the part: Luckiest Guy, `colour.text`
rgb(250, 250, 250), `font.leading` 0.86, `art.textStroke` 5px ink,
`art.paintOrder` stroke, `art.textShadow` `7px 7px 0 ink, 11px 11px 0
red` (the first row's). On the runs: every letter's `transform` (its wob
frame when measured) and `motion` (its delay); "MORTY" also its paper
colour rgb(255, 247, 207) and its pink second shadow; "&" its slime colour
rgb(166, 216, 111), size 76.8px, 4px stroke, `5px 5px 0 ink` shadow, its
rotate(12deg) transform and `ampSpin`. Before: 15 parts, `T U P M &` and
`M R O T Y` scattered at the boxes of one wobble frame.

## Not carried, and why

- **The marquee** (`[data-marquee]` tracks): moved by `main.js` with
  `requestAnimationFrame`, not by CSS; nothing to read.
- **Parallax, the TV's tilt toward the pointer, inertia scrolling**:
  `main.js#frame`, script.
- **Reveal-on-scroll**: the transition is carried; the trigger (the
  IntersectionObserver adding `.in`) and the hidden rest state are not.
- **Pseudo-elements** (`::before` / `::after`): their animations (drip,
  staticShift) and any hover on them. A selector with `::` is skipped.
- **The TV antennas** (ant, ant2): dropped with their zero-width holder.
- **The mobile rules** (`@media (max-width: …)`) and the
  `prefers-reduced-motion` block do not match the 1440×900 capture and are
  not recorded.
- **A hover on a word inside a button** (`.btn--dex span`): the span is
  folded into the button, so a rule on it is not on any part.

## What polio must draw (the polio lane)

1. `doc.keyframes` → one `@keyframes` rule per entry, in the published page
   and on the board (names may clash with polio's own; prefix them).
2. `node.motion.animation` → `animation: name duration timing delay
   iterations direction fill` on the part's wrapper (the element the
   capture measured). 11 parts here.
3. A run's `motion.animation` and `transform` → each letter of a folded
   title as its own `inline-block` span with that animation, delay and
   transform (and `transform-origin: 50% 90%` for `wob`, which the capture
   does not record); `motion.letter` / `art.letterTransform` → the same on
   every letter. The run's `colour`, `size`, `textShadow`, `textStroke`,
   `paintOrder` → that span's own type (`n_valueprop_145`).
4. `node.motion.transition` → `transition` on the wrapper. 55 parts.
5. `node.motion.hover` with `self: true` → a `:hover` rule on the part's
   wrapper with those declarations; `self: false` → the rule keyed on the
   ancestor the selector names (`.tv:hover` → the TV part holding the
   knobs), or dropped. 28 parts, 30 rules; `node.motion.focus` likewise
   (none on this site).
6. `node.embed` → an `<iframe src allow sandbox title loading>` filling the
   part's box, in the published page; on the board a still with the host
   name is enough (the frame is another site). The part today is a plain
   `box`, so it draws as an empty box until then.
7. Still polio's from the earlier lanes: `node.art.textStroke`,
   `paintOrder`, `textShadow` and `transform`, which the folded title leans
   on to look like the site.
