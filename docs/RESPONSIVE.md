# Tablet and phone layouts

How a page is laid out on a tablet (834 pixels wide) and a phone (390 pixels
wide): in the Builder's Tablet and Phone views, in Preview, in the companion
window beside the board, and on the published site. One plan, one renderer,
the same everywhere:

- `src/features/studio/live/small.ts`: the plan (pure, no browser).
- `src/features/studio/live/smallRules.ts`: what the Builder says a part is
  (a control, a link, words, a heading, what holds what).
- `src/features/studio/live/smallCss.ts`: the plan as CSS rules on the page's
  own parts (where each goes, how wide, shown or not, a block opened or kept
  whole).
- `src/features/studio/live/LiveSite.tsx`: draws the page once, nested by
  what holds what, with those rules.
- `src/features/studio/SmallBoard.tsx`: the board's Tablet and Phone views,
  with the per-part "On tablet" / "On phone" settings.
- `exportSite.ts` and `staticSite.ts`: each published page is that one page,
  the rules under CSS media queries.

A page's layout at a small width comes from, in order:

1. **The site's own**, when a capture recorded the site at that width (the
   format below).
2. **One worked out by the Builder** when it did not.
3. **The person's settings** on top of either.

## 1. The capture format (for the capture lane to fill)

A capture already records each element at the desktop width as a part:
`x`, `y`, `w`, `h` in pixels, measured from the top left of the page, plus
`from.selector` (the element's path). To carry the site's own tablet and
phone layouts, capture the same page again with the window at **834** and at
**390** pixels wide, and write each element's box at that width onto **the
same part** (matched by `from.selector`):

```jsonc
{
  "id": "n_ctaprimary_33",
  "x": 1468, "y": 237, "w": 40, "h": 26,          // at the desktop width
  "from": { "selector": "body > div > main > …", "url": "…", "host": "…", "at": 0 },
  "widths": {
    "tablet": { "x": 412, "y": 610, "w": 40, "h": 26 },
    "phone":  { "x": 16,  "y": 1290, "w": 358, "h": 44 },
    // an element the site hides at that width:
    // "phone": { "x": 0, "y": 0, "w": 0, "h": 0, "hidden": true }
  }
}
```

Rules:

- Coordinates are pixels from the top left of the page at that window width,
  the same frame as the desktop's `x` and `y`.
- `hidden: true` when the element is not drawn at that width (`display:
  none`, `visibility: hidden`, or zero size).
- A part drawn at rest with no box for a width is treated as hidden there; a part a press shows is laid out in its panel (below).
- The Builder uses the site's own layout for a page at a width when **at
  least half** of the page's parts carry a box for it. Below that it works
  one out (section 2), so a partial capture never leaves a page half drawn.
  Only parts drawn as the page opens are counted: a part a press shows (a
  menu, a popup, a panel; `state`) was never on screen when the capture
  measured the small widths, and counting it sank captured pages under half
  (gotchi 6 of 13, parasiteonsol 6 of 12) that had 90 to 100 per cent of
  what they draw at rest. Those parts are laid out inside their panel
  instead (`small.ts`, `panelBoxes`): in the panel's own box, scaled, when
  it has one; else the panel takes the page's width under the last part at
  rest above it and what it holds goes down it. They are placed, never
  hidden, and never forced to show: their press shows them.
- Optional, on the document: `"capturedWidths": [1440, 834, 390]`, so a
  reader can tell which widths were captured.
- Not carried yet: an element the site shows **only** at a small width (a
  hamburger button hidden on the desktop). Record it as a part with its
  small-width box in `widths` and a desktop box of zero size; the Builder
  draws it at the small width and the desktop renderer draws nothing for it.

## 2. A layout worked out when the capture has none

- Reading order is the desktop's: top to bottom, and left to right within a
  row.
- A block that stays legible scaled down to the width (its words at 72% or
  more, and anything in it to press still 44 pixels tall) is kept whole and
  scaled. A block with nothing to read or press (a picture, a composition)
  is always kept whole and scaled to fit. Anything else is opened: its own
  box stays behind, and what it holds is stacked inside it.
- On a tablet, cards that sit side by side (alike in size, at least 160
  pixels wide) go two across; on a phone, one.
- A row that fits as it is stays a row; small things side by side (tabs,
  icons, tags) stay a row that wraps.
- A nav (three or more links in a row in the top band, or three or more down
  a narrow side column) becomes a **Menu** button that opens a panel.
- A button or a copy-address bar goes full width and is at least 44 pixels
  tall.
- A heading scales to fit the width, never below half its size; other words
  wrap.
- A picture fits the width and keeps its shape.
- A part lying mostly off the page's sides (a planet at the side, a float) is
  a decoration of the wide layout and is left out. It can be brought back
  from the list of hidden parts.
- Nothing is wider than the window.

## 3. The person's settings

Each part has, per width, `small.tablet` and `small.phone`:

| Field | Meaning |
|---|---|
| `show` | `"hide"` leaves it out at that width; `"show"` brings back a part left out as a decoration |
| `full` | as wide as the page |
| `order` | places moved among the parts beside it: `-1` one earlier, `2` two later |
| `size` | a multiplier on its size, 0.5 to 1.5 |

A setting at one width changes nothing at the other width or on the desktop.
On the board: switch to Tablet or Phone, press a part, and use the bar above
the page.

## 4. The published page

Every page has `width=device-width` in its viewport and is **one page at
every width**: each part is one element, with one id, so a screen reader or
a search engine reads it once, and every script and every motion (a part's
entrance, its hover, a feature's script) runs at every width.

- **Nested by what holds what.** A part that holds others stands in a box
  with them (`<div class="sm-g g-<id>"><div class="sm-gi">…`). On the desktop
  those boxes are `display: contents`: no box, every part placed against the
  page as before, drawn in the same order.
- **The tablet's and the phone's layouts are rules** on those same parts, in
  a `<style>` in the page, under media queries: below 1024 pixels (or, for a
  captured site, below the narrower of its own width and 1280) the tablet's,
  below 600 the phone's. The page becomes a flex column (`.sm-root`); each
  part, or the box it stands in, gets its place (`order`), its width, its
  height floor, and is shown or not (`display: none`). A block opened stands
  in the flow with its own drawing behind what it holds; a block kept whole
  is a box of its shape with the block inside it at its desktop size, scaled
  by the box's width (`zoom` from `100cqw`). A row of chips wraps; tablet
  cards are two across; a zero-height breaker (`i.sm-br`) starts a row on a
  line of its own.
- **The Menu** is a key at the top (a checkbox in a label, no script) and a
  panel under it; while it is pressed the nav's own links, wherever they
  stand in the page, are laid in the panel (`position: fixed` against the
  page, which is their container).
- **Press areas.** In the flow, whatever is pressed is at least 44 pixels
  each way. In a block kept whole, a press drawn smaller (a ticker chip
  25 pixels tall) gets an invisible area round it, 44 pixels each way at the
  narrowest window, and its look is untouched; what stands on a button (its
  own words and icon) lets the press through to it.
- A captured page keeps what the desktop moves inside a band, a moving box or
  a turned row there (`fluid`, `carry.ts`); a block that moves as one is kept
  whole at every width, so what it carries stays where it is in it.

The Builder's Tablet and Phone views, Preview and the companion window draw
the same nested page with the same rules, scoped to that page instead of a
media query, so the board at 390 is what a phone is served
(`tests/small-pages.mjs` compares the order the parts are seen in).
