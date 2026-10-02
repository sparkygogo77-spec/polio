# Taking a site again without losing what its owner set

2026-09-29, capture upkeep lane. For trumpmorty.fun (done in code, waiting on
a retake) and share.xyz (planned here).

## Why a site was left on an old capture

A site's document has two authors. The converter writes every part from the
capture; then the owner changes some of it: on sink's trumpmorty.fun
document, both ribbons' words centred in their band at 36px and 42px
(`node.work`, b587d89); on his board in the Builder, whatever he has moved,
re-worded, switched or deleted since he brought the site in. Taking the site
again replaced both whole, so trumpmorty.fun was never taken again after
b587d89 and kept every fault the capture has since lost: its resting shadows
read at their hover size (7px for 4px, 8px for 6px), its CRT loader timed
from its own script rather than the navigation, its ribbons at a fixed
36 px/s where the page steps 0.6 px a frame.

## What keeps them now

Two layers, both general, both matched part to part by page and element
(`from.selector`), never by id: a new conversion renumbers ids (share.xyz,
below: 66 of 3,996 would change).

1. **sink, on every retake** (`site/capture/keep-owner.mjs`, run by
   `capture-site.mjs`; `check-keep-owner.mjs`). What the converter never
   writes is the owner's and is carried from the document as it was: a
   feature on a part and its settings (standing over any the new document
   gives), a part placed by hand and its box, a lock, a part drawn on the
   board. It prints what it carried. A prompt is not carried: the converter
   writes one on every part.
2. **polio, on Bring** (`src/features/studio/reimport.ts`; `tests/reimport-keeps.mjs`).
   The Replace prompt offers **Bring it in, keep my changes** when the
   repository and folder are the site's own. Every import now records the
   board as it stood once brought in (after the sweep and the palette, as
   hashes: `taken`), so the next one can tell, field by field, what the owner
   changed from what the machine wrote; his changes stand, every other field
   is the new capture's, a part he deleted stays deleted, a part he added
   stays. A board brought in before the record existed is compared with the
   document it was brought in from, read at its source commit and swept the
   same way; with neither, the merge is careful (moved parts, feature
   settings, prompts and locks are his; nothing else is guessed) and says so.

## trumpmorty.fun

Blocked in this lane on one thing: this container's headless browser cannot
open live pages (the proxy's certificate is not trusted by it). From a
machine where it can:

    node capture/site/capture/capture-site.mjs --url https://trumpmorty.fun/ --name trumpmorty-fun --hide-gate
    node capture/site/capture/tools/compare-geometry.mjs --live https://trumpmorty.fun/ --ours <export> --words "TG,X,COPY"
    node capture/site/capture/tools/motion-timing.mjs https://trumpmorty.fun/ <export> --runs 3

The retake prints `kept the owner's on n_prose_226 … marquee middle=yes size=42`
and the same for the red ribbon. What the new document should then carry,
each held by a check on a stand-in page: stickers resting at 4px with 7px as
`motion.hover` and 1px as `motion.active`, the CA bar at 6px / 8px / 2px
(check-rest-states); the COPY end cut to the bar's 12px inner curve
(already in the committed document, f046fa9; the live copy predates it);
`behaviours.loader.nav.off` about 2,540 ms; both ribbons `clock: "frame"`,
0.6 px a frame, boost 0.245, cap 14. In polio the import turns those into
the marquee's Step, Scroll boost and its cap (editable, in the Element
panel's first view) and the CRT loader's Switches off at (tests/ribbon-clock).
Then, on his board: repo menu, Bring in, **Bring it in, keep my changes**.

## share.xyz

Its document (3e47f8a, 2026-09-28) predates two days of converter fixes. A
dry run of the current converter over its committed captures (nothing
written to the repository) changes 1,674 of 3,996 parts and adds or drops
none: faces for 1,125 (`font`), `art` for 397 (turns-with, clips), 133
marked inert, 84 icons redrawn (`vector`), 45 paddings, 30 colours, 12
max-widths, and 66 renumbered ids. It carries nothing its owner set (no
feature, hand placement or lock), so sink's step has nothing to keep; his
changes, if any, are on his board.

1. **Take it again**, not only reconvert: the captures also predate the
   dump's fixes (resting looks, loaders, loop clocks, heads, behaviours).

       node capture/site/capture/capture-site.mjs --url https://share.xyz/ --name share-xyz --pages "/, /event/ai-bubble-burst-by/85299, /league/nfl/b88aa7b2" --hide-gate

   If live cannot be reached, reconvert what is committed instead (the
   dry run above), which is safe: same parts, same pages:

       node capture/site/capture/capture-site.mjs --reconvert --name share-xyz

   (no browser; the owner's fields kept as a retake keeps them;
   `check-reconvert.mjs`).
2. Compare at 1440 and 2000 with `site/capture/tools/compare-shots.mjs`
   and `compare-geometry.mjs`, and update `share-xyz.md`.
3. On the owner's board: **Bring it in, keep my changes**. His board was
   brought in before `taken` existed, so the merge reads the document at
   the commit his board records (`look.capture.source.commit`); if that is
   missing it falls back to the careful merge and its line says so.
