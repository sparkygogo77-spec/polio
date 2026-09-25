# Handover: the HTML and CSS export

The site as files a person can open: an `index.html` per page, one stylesheet,
the pictures. `src/features/studio/exportSite.ts`, reached as
`window.__studioExport()`; `scripts/export-site.mjs` writes it to a folder whose
`index.html` opens from disk. **Not wired into Publish**: the owner has not
ruled on the guards (a Publish overwrites sink's main with the board's
document), so Publish still sends what it sent.

## What it is

- **One width**, the width the site was captured at (1763 for sink). No
  breakpoint is invented. For one to be real, the capture would have to record,
  per element, how its width was specified (a share, "the rest", a fixed px),
  its margins as margins rather than the positions they produced, and the
  page's layout at a second viewport width. It records none of these.
- **The same markup as the preview.** `staticSite.ts` already rendered each
  page with the preview's own `LiveSite` and read it back; that markup is kept
  (`markupOf` is shared) rather than written a second way.
- **What changes round it:** the six roles are custom properties on `:root`,
  and every colour in a style that is a role is written `var(--role)`; the
  carried faces are `@font-face` from their bytes, without where they were
  captured; 8 KB of stylesheet (palette, faces, the resets the parts rely on)
  in place of the app's 126 KB; every `data-*` attribute and `title` taken
  off, each part keeping its id as a plain `id`; no document, blueprint,
  prompt or capture in the tree.
- **A still.** React handlers are gone, and entrance animations name
  keyframes the app's stylesheet held, so the page arrives already arrived.
- **Hand-editable in its colours and faces, not yet in its layout.** Every part
  is positioned absolutely, inline, as the board draws it. The document does
  carry real flex and grid on 223 parts; emitting those as layout is the next
  step, and is a choice to be measured, not a fidelity gain at one width.

## Measured, sink on polio 01adbd8 (`tests/export-page.mjs`)

Each page against the preview of the same page at 100%, both pictures settled.
The 1% bar is a convention.

| page | checks | pixels differ | with the export on its own layer |
|---|---|---|---|
| home | 14/14 | 16945 (0.57%) | 4514 |
| cleanup | 14/14 | 16878 (0.60%) | 0 |
| tokens | 14/14 | 7652 (0.27%) | 0 |
| nfts | 14/14 | 16456 (0.59%) | 0 |
| cnfts | 14/14 | 17892 (0.64%) | 0 |
| domains | 14/14 | 8261 (0.30%) | 0 |
| lp | 14/14 | 18535 (0.66%) | 0 |
| unknown | 14/14 | 15083 (0.54%) | 0 |
| docs | 12/13, **fails the 1% bar** | 41012 (1.46%) | 11867 |

Every differing pixel on every page is a letter edge: same glyphs, same places,
same colours, same faces (the boxes and runs checks pass on all nine). The
preview draws its page inside a composited layer, where Chromium antialiases
words differently; lifting the exported page onto a layer of its own, for the
picture only, takes seven pages to exactly 0. Home keeps 4514 and docs 11867,
still letter edges, **not traced**: not the face (the same stacks resolve on
both sides), not sub-pixel placement (both at whole pixels), not font smoothing
(no effect on Linux Chromium; tried and taken back out). The export is not
tuned to the board's compositing, and the docs bar was not moved.

## The leak

`tests/publish-leak.mjs` reads every file the real Publish button pushes. On
9734afa it fails: `site/document.json`, `site/BLUEPRINT.md` and
`site/blueprint.json` carry the capture and his working (22657 occurrences,
overlapping); the nine pages and the stylesheet carry none. The exporter's own
tree carries none either (`tests/export-page.mjs`). It stays red until
Publish stops sending the design document, which is the wiring that waits.
