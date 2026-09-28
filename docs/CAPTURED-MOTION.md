# A captured page's own motion, replayed

sink records what a page does over time (sink `docs/motion.md`): its
`@keyframes` (`doc.keyframes`), each element's animations, transitions and
`:hover` / `:focus` rules (`node.motion`), a title split into letters folded
back into one part with per-letter runs, and its iframes (`node.embed`).
This is how the Builder draws them. Everything is in
`src/features/studio/parts/capturedMotion.ts`, one stylesheet shared by the
preview (`LiveSite`, a `<style>` beside the page) and the published page
(`exportSite`, in `assets/site.css`, reaching each part by its id).

| sink field | drawn as | where |
|---|---|---|
| `doc.keyframes` | taken into `look.keyframes` on import (`docTake.ts`); each written as `@keyframes cap-<name>`, so a page's `spin` is never the Builder's own | preview, export |
| `node.motion.animation` / `transition` | `animation` / `transition` on the part's box (`.mo-<id>`, the `[data-part-box]` wrapper, which also wears the captured transform, so an animation of `transform` replaces it as it did on the page) | preview, export |
| `node.motion.hover` / `focus`, `self: true` | a `:hover` rule on the box, fired when the part **or any part inside it** (by element path) is pointed at; a move it makes (`transform`, `translate`, `rotate`, `scale`) is made by the parts inside too, about the element's centre, with its transition, so a link's words and icon travel with it | preview, export |
| `…`, `self: false` (`.tv:hover .knob`) | keyed on the ancestor: the nearest part at least as many levels up as the selector says that paints a surface (fill, edge, picture), and everything inside it | preview, export |
| a folded title's runs (`content[i].transform`, `motion`, `colour`, `size`, `textShadow`, `textStroke`, `paintOrder`) | each letter an `inline-block` span with its own transform and type; live, its own animation and delay (`parts/Runs.tsx`); `value-prop` now draws runs | board (still), preview, export |
| `node.embed` | an `<iframe>` filling the box, `sandbox` as captured or `allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox`, `referrerpolicy="no-referrer"`, lazy; on the board a still naming its host | preview, export |

The board is a layout surface and stays still: letters sit at their
captured transform, nothing animates, the embed is a still. Under
`prefers-reduced-motion: reduce` nothing animates or transitions. Every
name and value came from somebody's page, so a keyframes name, a property
and a value are checked before they are written (a value that could leave
its declaration is dropped). Check: `node tests/motion-drawn.mjs <builder url>`.

trumpmorty.fun (sink `claude/youthful-cannon-yb4atv`, `sites/trumpmorty-fun`),
exported, before (trunk 6fff154) and after, beside this file in `shots/`:
`captured-motion-{before,after}-headline.png` (one white line → the
letters in their own colours, the "&" slime and turned, "MORTY" with its pink
shadow, each wobbling on its delay), `-hover-rest/-hover-on` (BUY ON
PUMP.FUN lifts and turns with a 10px shadow, words and icon with it; before,
nothing), `-embed` (a black box → the DEX Screener frame).

A captured part draws at the size and leading it was measured at
(`applyFont(…, { captured })`, sink fidelity #7): the headline is 123.84px
at 0.86, in the 635×213 box the capture measured, where it drew at 51.2px
held to the Font control's 0.6–2× range; a part built here is still held
to it (`tests/captured-size.mjs`). A title's letters wrap between words,
never inside one, and rise past their tight line unclipped, as on the page.

Not done here: a `transform-origin` is not captured (the site's letters turn
about 50% 90%); pseudo-elements and script-driven motion (the marquee,
parallax) are not in the capture.
