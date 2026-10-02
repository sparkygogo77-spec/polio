# stonkfun.xyz through the pipeline

Taken 2026-09-28 from this sandbox with `site/capture/capture-site.mjs` (the
capture code of `claude/jolly-hamilton-dosymj` 7b7ee04 merged with
`claude/pensive-tesla-cp2l9g` 0a1f79b), at 1440×900, headless Chromium with the
session's proxy CA added to its NSS trust store (no check turned off). Local
run only: nothing was published.

| page                   | parts | note |
|------------------------|-------|------|
| `/`                    | 201   | the Terms gate agreed to first; the token grid kept as its first line of 3 cards |
| `/flywheel`            | 180   | |
| `/revenue`             | 193   | |
| `/developers`          | 452   | |
| `/launch`              | 181   | |
| `/token/:id`           | 244   | ONE token page as the template (`page_token`); 31 ids recorded |
| `/flywheel-disclaimer` | 46    | found by the crawl |
| `/stonk-disclaimer`    | 46    | found by the crawl |
| `/rewards`             | —     | skipped (`--skip /rewards`): backend data, see below |

Document: 8 pages, 1543 parts; faces Sora and Geist Mono carried; the head
(title, description, theme colour, favicon and touch icon) in `doc.head`,
and the token page's own card and share picture in its `page.head`. The
home page declares no og:image or twitter:card live either. Taken with:

    node capture/site/capture/capture-site.mjs --url https://www.stonkfun.xyz/ --name stonkfun-xyz \
      --pages "/, /flywheel, /revenue, /developers, /launch" --crawl --skip "/rewards" --limit 12


## Status, 2026-09-29 evening (capture upkeep)

The comparison under "The export against the live site" is the first take's.
The site has been taken again with its Terms of Use **hidden, never agreed
to** (`--hide-gate`, sink bd2d8b1 and 782942c). Its numbered differences, now:

1. Layout at 2000 — **fixed**: its 1440px wrapper and 69 other parts carry their max-width (sink 556de04, polio 235c134).
2. Icons as solid squares — **fixed**: its Iconify icons are masked pictures (bd2d8b1); stroked svg icons draw at their own width (polio 498363f).
3. The hero chart running out of its card — open, not re-measured.
4. The search field empty — **fixed**: its placeholder in its grey and the magnifier inside it; matches live at 1440 and 2000 (sink a2e15a9, 782942c).
5. Motion — partly: the hover and pressed looks are read apart from the resting one since sink f4c95d5 (reaches this site at its next take). Draw-in and skeletons still show the final state.
6. Words split at "$" — open, not re-measured.
7. Pictures, 8. Fonts — as before.

Not re-measured against live after these here: this container's browser
cannot open live pages. `site/capture/tools/` holds the comparison scripts.

## The representative-page rule (the owner's, 2026-09-28)

What a capture is for is the site's **physical design**: its parts, what
they do (buttons, tabs, toggles, copy, menus, modals) and how they move
(animations, motion). The backend's data is not the design, and the
fidelity work puts the design first. So, for every site:

- **One page per template.** Same-site links that differ only in an id
  (`/token/<address>`, `/g/<id>`, `/u/<address>`), or six or more
  siblings under one parent, are one pattern. `capture-site --crawl`
  captures each plain page once and **one representative per pattern**;
  the pattern, its representative and every id seen are written to
  `capture/routes.json` and `capture/run.json` as `crawl.patterns`, and the
  other pages of the pattern are not opened. An id is a number among
  siblings, a hash, a uuid, an address, or a short id mixing letters and
  digits (six or more; a sibling of the same length joins it). The
  representative is named for its pattern (`page_token`) and carries
  `pattern: "/token/:id"`. `check-representatives.mjs`.
- **One row per row type.** A list of twelve or more children of one shape
  (tag, classes, the tags of its own children) is the backend's data: it
  keeps its own box, the rows of its first line (so a grid shows its
  columns) and the first row of every other shape, and records
  `rows: { of, kept, shapes }`. Every link on the page is still read (the
  dump's `links`), so a pattern's ids include those of rows not kept.
- **Pages that are only data are skipped.** `/rewards` is a leaderboard
  whose content is arbitrary and the backend's; `--skip` leaves it out.

## What the capturer needed, fixed on this branch

- **A terms gate was captured as the page.** The site opens on a "Website
  Terms of Use" dialog: a box to tick and an Accept that waits for it. The
  first capture of `/` was a capture of that dialog over a dimmed page.
  `--agree` knew only SOLCINERATOR's "AGREE AND CLOSE"; it now ticks the
  agreeing box of a modal dialog and presses its Accept / Agree / Continue
  (never a Decline), before behaviours are read and again after a reload.
  `capture-site` passes it unless `--no-agree`, so the Builder's Capture a
  site gets it too. `check-gates.mjs`.

## /rewards: why it is left out

It is backend data (above), and it is heavy: a leaderboard that puts every
row in the page at once, **~372,000 elements and 39,789 pictures**, of which
**23,554 are token logos served through `wsrv.nl`**. wsrv.nl refuses to
proxy `.xyz` addresses (`400 {"message":"Domain or TLD blocked by
policy"}`: its answer, not this session's proxy), so each fails for every
visitor too; the capture did not finish in 13 minutes. With the row rule
its list would come down to a line of rows, should it ever be wanted.

## The export against the live site

The comparison below was made on the first take (5 pages, before the
row rule); the export is polio's (`scripts/export-site.mjs`, branch
`claude/compassionate-galileo-2pkhch` 52bbdf6) opened from disk; the live
site in the same headless Chromium with its Terms gate agreed to. Crops,
live on the left: `stonkfun-xyz/stonk-home-<width>-y<scroll>.png`. Prices,
market caps and volumes are live values and differ by the minute; they are
not counted.

Top visible differences, most visible first:

1. **Layout at 2000: the page spreads to the full width.** Live, the
   content sits in a centred column (~1400px) at 2000; the export
   stretches the header, the hero and the token grid edge to edge, so the
   cards are 50% wider (`stonk-home-2000-y0.png`, `-y900.png`). At 1440 the
   two match in position. The column's `max-width` + auto margins are not
   holding at a wider window. *Cause: export/converter (the fluid frame);
   the same family as trumpmorty's 2000px work.*
2. **Icons are solid squares.** The small line icons (search, the button
   `+` and wallet glyphs, the card corner buttons, "copy CA") draw as
   filled light squares. They look like lucide-style stroked `<svg>` icons.
   *Likely cause, not yet traced: capture/converter of stroked svg icons.* The gotchi lane is working on
   the same fault for gotchi's icons.
3. **The hero chart runs out of its card.** Live, the dashed market-cap
   line is clipped by the hero card; in the export it continues past the
   card's right edge at 2000 and its start leaks into the search row at
   1440 (a stray square at the left, under the hero). *Likely cause, not yet
   traced: the card's clipping is not applied to an absolutely placed svg.*
4. **The search field is empty.** Its magnifier and its placeholder
   ("Search name, ticker, or contract address") are gone; the box alone is
   drawn. *Cause: an input's placeholder is not a part.*
5. **Motion.** Live, the chart line draws in and its dot travels, the
   "$STONK" card fades in over it, and the token cards arrive as grey
   skeletons first. The export shows the final state, still; the $STONK
   card is always shown (right, not wrong). Sparkline charts are static.
6. **Words split at "$".** "$ZCAT", "$SI", "$NEARKAT" are drawn "$ ZCAT":
   the `$` is its own span and a space is put between the parts.
   *Cause: converter word-join.*
7. **Pictures.** Token pictures and pairing coins are right. The large
   coin art in each card (NVIDIA, SANDISK…) is clipped at a slightly
   different place. The ~24k wsrv.nl-proxied logos (see /rewards) fail
   live too, so they are not a difference.
8. **Fonts.** Sora and Geist Mono are carried and match.

What was general and is fixed on this branch: the terms gate (above);
from gotchi.gg, a face split by `unicode-range` keeping its Latin file
(`check-font-ranges.mjs`) and a `<canvas>` keeping its pixels
(`check-canvas.mjs`). This capture of stonkfun predates the canvas fix; it
draws no canvas that matters on these five pages.
