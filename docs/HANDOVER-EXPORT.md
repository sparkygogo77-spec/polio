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

## Measured, sink, every page (`tests/export-page.mjs`)

Each page against the preview of the same page at 100%, both pictures settled.
Every letter is also held to where the preview puts it, to 0.001px: all nine
pages pass that, 186 to 1098 letters each, none moved and none missing. The
pixel bar is 1%, a convention, measured with the exported page lifted onto a
layer of its own for the picture only (never in the export), because the
preview draws its page inside a composited layer and Chromium rasterises
words differently there. The coordinator accepted that convention once it
was diagnosed rather than tuned to.

| page | letters | as exported | px per letter | on its own layer |
|---|---|---|---|---|
| home | 471 | 16945 (0.57%) | 36.0 | 4514 (0.15%) |
| cleanup | 406 | 16878 (0.60%) | 41.6 | 0 |
| tokens | 186 | 7652 (0.27%) | 41.1 | 0 |
| nfts | 436 | 16456 (0.59%) | 37.7 | 0 |
| cnfts | 459 | 17892 (0.64%) | 39.0 | 0 |
| domains | 193 | 8261 (0.30%) | 42.8 | 0 |
| lp | 476 | 18535 (0.66%) | 38.9 | 0 |
| unknown | 456 | 15083 (0.54%) | 33.1 | 0 |
| docs | 1098 | 41012 (1.46%) | 37.4 | 11867 (0.42%) |

**Docs, traced.** It was the one page over 1% as exported, four times its
neighbours. Per letter it is not: 37.4 px, inside the 33 to 43 every page
shows. It has the most words (1098 letters against 186 to 476), and a bar
measured against the page's area crosses first on the densest page. Its
letters are all where the preview's are to 0.001px, in the same faces and
colours, so nothing is laid out or drawn differently: the same glyphs at the
same places are rasterised differently, the same artefact as every other
page at a different scale. Ruled out, each by measurement: the face (the
same stacks resolve on both sides); sub-pixel placement (whole-pixel page
origins, identical glyph positions); font smoothing (no effect on Linux
Chromium); the inherited font context (giving the export the preview's
13px/18.2px sans-serif changed not one pixel); the preview's ancestry (a
scrolling box and a scale(1) wrapper round the export changed nothing).
Home and docs keep 4514 and 11867 px on their own layer where the other
seven reach 0; those are letter edges in particular parts (the docs side
navigation and headings, home's empty-state lines), with the glyphs in
place. Why those parts rasterise differently even on a layer is not traced.

## The leak

`tests/publish-leak.mjs` reads every file the real Publish button pushes. On
9734afa it failed: `site/document.json`, `site/BLUEPRINT.md` and
`site/blueprint.json` carried the capture and his working (22657 occurrences,
overlapping); the nine pages and the stylesheet carried none. Fixed by what
Publish writes, never by the test: the blueprint pair no longer goes up
(nothing downstream reads either; they stay in the Brief dialog), and the
document goes up cleaned (`publishedDoc` in `agent.ts`): prompts, notes,
where each part and face was captured, pages' prompts and the brief emptied;
`from.position` kept. It stays because Bring reads it back (`repoImport.ts`,
MADE_HERE) and a copy of this app renders it at /site; measured, a published
document brought back in lands all 637 parts, every kind the same. The cost:
with no element paths it brings back no ownership, so escapes read 0 there.
When and where Publish writes, and what it overwrites, are unchanged: the
guards are the owner's to rule on.
