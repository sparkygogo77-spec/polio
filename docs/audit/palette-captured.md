# Audit: the Colour palette on a captured site

The site: trumpmorty.fun, captured by sink (`sites/trumpmorty-fun`, 197 parts) and
brought in through Bring. It doesn't use one colour set. One near-black
(`rgb(26, 15, 11)`) does the ink: words, outlines, hard shadows and eight fills.
About a dozen pastels each fill a card or two, and three faces set the words.
The owner saw six swatches with the counts `1, 10, 135, none, 20, 13`, the line
"Accent, from 20 parts on this site", and the Build palette button. This file
says what that panel was doing and what it left out, and then what changed.
The numbers below come from the capture in sink at `94712d6`. That capture
reads `1, 8, 121, none, 13, 12`. His live import was an earlier capture, so
its numbers differ a little, but the mechanism is the same.

## 1. How each swatch and its count were computed

`paletteFrom.ts#landPalette` ran **once**, as the document landed, and never ran again.

| Swatch | Rule | trumpmorty.fun |
|---|---|---|
| Background | The page colour the capture named (`look.palette.bg`) | `rgb(29, 34, 51)`, 1 |
| Surface | The fill worn by the most parts that is neither the page nor a colour (chroma < 0.05) | the near-black, 8 |
| Text | The word colour worn by the most parts that is neither neutral (chroma < 0.005) nor a colour | the near-black, 121 |
| Muted text | The next such word colour that sits closer to the page than Text does | nothing qualifies, so "none" |
| Accent | The colour (chroma ≥ 0.05) worn by the **most parts across every slot and the edges** | `rgb(184, 255, 106)`, 13 |
| Highlight | The second such colour | `rgb(243, 212, 64)`, 12 |

Next, **linking**: every part slot whose colour exactly matched a role was
rewritten to the role's *name* (`"text"`). The number under a swatch was how
many parts named that role right after linking. It was stored in
`look.paletteFrom` and never recounted, so swaps, overrides and deletions left
it stale. The line "Accent, from 20 parts on this site" read that stored
number. The contrast badges (text 1.2, accent 10.8) measure the Text and Accent
roles against Background. Text reads 1.2 because the site's ink is its dark
words on light cards, not on the dark page.

## 2. What "none" meant

"None" meant the site gave that role no evidence, so the role **showed another
role's colour** (Muted shows Text, Surface shows the page, Accent shows Text,
Highlight shows Accent), and no part followed it. It never meant "no colour".
A person reads it as "no colour", or as "broken".

## 3. What never reached the palette

`wornBy()` read only `colour.bg/surface/text/accent` and a drawn edge's
colour. Everything below was never counted, so it could never be picked:

- **Runs of words** (`content[].colour`): the cream `rgb(255, 247, 207)` on 5 runs.
- **Shadows**: every `edge.shadow` (box-shadow: the hard offsets, the red glow
  on the LIVE dot) and every `art.textShadow`. 59 parts wear the near-black
  as a shadow.
- **Text-stroke** (`art.textStroke`, and per letter on the title): the ink
  outline on 18 headings.
- **Gradients** (`art.background`): the TV's navy, the orange planet, and the
  sun's yellow stops.
- **SVG fills**: the 7 captured icons (`vector`) carry no colour of their own
  and draw in their part's word colour, so they appear there and nowhere else.
- **Pseudo-elements**: sink folds `::before` and `::after` into the part that
  owns them, or into a part of their own. What it folds is counted like
  anything else. What it doesn't capture never reaches the document.
- **Image-backed parts**: the colours of the 19 pictures live in the pixels.
  The panel listed none of them and didn't say so.

Colours with no role were left out entirely. The panel showed 6 of the 44
colours the parts wear.

## 4. Did Build palette or a swatch edit overwrite captured colours?

**Yes. Both did it silently, and both could be undone, but nothing on screen
said so.** Linking had turned 150+ captured part colours into role names. So
Build palette, or dragging any swatch's mixer, repainted every linked part:
121 parts' words, 8 fills and 25 accents in one press. The document kept the
role names, not the captured values. Unlinked colours (the white and black
words, the one-off pastels) didn't move. `setLook` pushed an undo step each
time, but nothing told the owner a single ⌘Z would bring the site back.

## 5. Does the six-role model fit a site like this?

It fits a site that was built from roles. This one wasn't. Its colours belong
to parts, not roles: the ink is text, border and shadow at once, and the
pastels are one-offs. Six roles can hold at most six of the 44 colours, and
they force one colour to be "Text" while ignoring the same ink on 74 borders.
The six roles stay useful for the page itself and for parts added here. For
a captured site, the useful model is **every colour, grouped by what it is
used for, with swap-all**. The roles sit above it and are never applied to
captured parts without asking.

## 6. Fonts

`look.fonts` carries the three faces (Luckiest Guy, Fredoka, VT323), but the
panel never listed them, never said how many parts used each, and had no way
to swap one everywhere. The only way to change a face was one part at a
time, from the wheel's Edit → Font.

## What changed (`siteColours.ts`, `SiteColours.tsx`)

- **On this site**, under the six roles, lists every colour the parts wear,
  grouped as Text, Fills, Borders & outlines, Shadows & glows and Accents.
  Accents are the colours that are colours, wherever they're worn. Each
  swatch shows how many parts use it that way. Each group shows its first 8
  colours, and the rest go under **Also on this site**. A line says how many
  parts are pictures.
- Pressing a swatch lists the parts that wear it, with what for; pressing a
  part picks it on the board. **Recolour these N parts** changes exactly those
  spots, and nothing else, in one undo step. An Undo link appears beside the result.
- Role counts are recounted live from the parts. "none" is now **unused**,
  with the reason spelled out: "not used on this site, so it shows the text
  colour". Selecting a role that parts follow says that changing it repaints them.
- On an imported site, **Build palette asks first**. It says how many parts it
  would repaint and waits for confirmation. After it runs, an Undo link
  appears beside it.
- **Fonts on this site** lists each face, set in itself, with its part count.
  Press one to see its parts and swap them all to another face, in one undo
  step. The page's stack naming the old face goes too, because a stack
  outranks a face.

Tests: `tests/site-colours.mjs` (the pure rules, against the real capture) and
`tests/palette-captured.mjs` (the panel, in the browser).
