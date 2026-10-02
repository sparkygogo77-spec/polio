# Capture fixes: what trumpmorty.fun and share.xyz lost in sink

Branch `claude/determined-fermi-rk7bil`, off main 94712d6. The Builder side
had been fixed as far as it could be; these were the capture's
(`dump.mjs`, `capture-route.mjs`) and the converter's
(`capture-to-document.mjs`). Each has a case in
`site/capture/check-capture-fixes.mjs`, written red first (45/45 now).
Every other sink check is green, and SOLCINERATOR's committed captures still
convert to the committed `site/document.json` byte for byte (the root
`site/` and `assets/` are untouched).

| # | what was lost | cause | fixed | check |
|---|---|---|---|---|
| 1 | `.ca` button: three styled spans became one dark run | the converter folded every word-child into its button | yes: only children that look alike and paint nothing are folded; each span is its own part in its own colours; the button is the box they sit in | (1) |
| 2 | `<small>` lines on the remote keys (00…04, 💊 📈 ✈ 𝕏) dropped | folded under the key's own words, which won | yes: the small is its own part; the key's words are set in their own box (`tb`) | (2) |
| 3 | `::before` / `::after` never read | the dump walked elements only | yes: absolute pseudo-elements that draw are children `t: "::before"`, placed by resolved left/top/size; roadmap dots, drips, pink dot pattern, key gloss | (3) |
| 4 | roadmap progress fill dropped | width 0 at the top; the script grows it on scroll | yes: the scroll-through keeps the largest box an empty element grew to (`grown`) | (4) |
| 5 | `#lore` `#buy` `#chart` `#roadmap` became home links | the path was read, the hash ignored | yes: `{ kind: "node" }` to the part that element became (`domId`) | (5) |
| 6 | tilted ticker text ~120px above its ribbon | boxes measured round the rotation | yes: each element measured with its own transform lifted; `ptf` (page matrix) becomes `art.transform` about the part's centre | (6) |
| 7 | 76 of 128 share.xyz pictures one file | assets saved by basename: every `/_next/image?url=…` was `image`, every logo `fit=scale-down,w=144` | yes: one address, one file (`asset-name.mjs`); 115 files, 115 distinct | (7) |
| 8 | hero headline, QR missing; carousel past its edge drawn | an absolute backdrop painted over a later `relative` box; the QR draws through `<defs>`; no overflow clipping | yes: relative-after-band stacking; `color(srgb …)` read; `ov` clipping (wholly outside: no part; across: `art.clipPath`); an svg drawn through `<defs>` kept whole as an svg picture; the app card's first line set where it was | (8) (11) (12) |
| 9 | Fredoka carried four times | one file declared per weight | yes: identical bytes carried once, weight `400 700` (faces 151 KB → 64 KB) | (9) |
| – | share.xyz captured half-styled | the proxy aborted 1–2 of its 60 stylesheets per load | cut stylesheets, faces and pictures asked for again; a cut document or script reloads; what still fails is `missing` | (10) |

`.chart-placeholder::before` (staticShift) is not on the page when it is
captured: the DEX Screener frame replaces the placeholder once it loads.

## Counts

| | parts | picture parts | picture files (distinct) | faces | document |
|---|---|---|---|---|---|
| trumpmorty.fun before | 197 | 19 | 10 (10) | 6 entries, 151 KB | 571 KB |
| trumpmorty.fun after | 239 | 19 | 10 (10) | 3 entries, 64 KB | 520 KB |
| share.xyz before | 5362 (3508 / 255 / 1599) | 239 | 128 (10) | 6, 130 KB | 9059 KB |
| share.xyz after | 3996 (1959 / 257 / 1780) | 250 | 115 (115) | 6, 130 KB | 8737 KB |

share.xyz's home drops ~1560 parts: carousel cards past their track's edge,
which the page never showed.

## Screenshots

`capture-fixes/<page>-live-1440.jpg` is the live page (settled, scrolled
through), `<page>-polio-1440.jpg` polio's export of the recaptured document,
brought in through polio's own importer (`scripts/export-site.mjs`, polio
f6b4dd8), and `<page>-side-by-side.jpg` the two at half size.

## What is still wrong, and is polio's

- `reassemble.ts#sentences()` joins wordy parts that touch on one line into
  one run with the first one's box and fill, even when each paints its own
  fill or edge: the `.ca` bar and the header nav read as one run again.
- `owns.ts` grows a wrapper round everything its path owns, including a
  child it clips: each ribbon is grown from 1584px to its marquee track's
  5660px, so it turns about the wrong centre.
- A `box` part draws no `node.picture`: trumpmorty's hero landscape and
  section backdrops, share.xyz's phone. Unchanged by this branch.
- The keys' gloss (an absolute `::before`) is placed 9px lower than
  captured in the export, so it covers part of the small line.
