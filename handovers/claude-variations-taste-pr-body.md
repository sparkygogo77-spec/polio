P2 (polish of a new feature, Builder only). Generality 5: every site, captured or made here.

**You get:** variations that look better, not just different. Randomize now follows a designer's rules (real type scales, a 4/8 spacing grid, colours in the site's own family, corners and shadows that agree, more air between sections, one aligned body), and "Ask Claude for 4" comes back with four named directions ("Calm editorial", "Bold product") that are four different ideas, each respecting your locks. Words you read at AA still read at AA in every variation. Nothing you locked ever changes, the original never moves, and no word is changed until you accept it.

## What changed
- **Randomize is ruled, not random.** Each aim (cleaner, modern, like a site, clearer) leans the odds of every choice: a weight table, not a uniform pick.
  - Type: scales of 1.2, 1.25 or 1.333 on a 16–18px body; pairings whose heading and body suit each other (no novelty faces).
  - Spacing: steps of 4 or 8, never tighter than the original; corners on the grid; shadows go flat, soft or lifted to agree with the corners (square is flat, pills never lift).
  - Colours: the site's own hue turned a little, by tinted neutrals, analogous or complementary harmony; words held at 4.5 to 1, token by token *and* part by part (a words part whose new colours fall short is moved in lightness until it reads).
  - Layout, from the layout tree: one alignment for the whole body, more air above sections (0/16/32/48px), a rhythm or none, the first screen centred for "clearer".
  - Order: one pair of neighbouring middle sections swapped at most.
  - A lock on the first roll keeps that layer as the original (it used to roll anyway).
- **The Claude prompt is rewritten** as a senior designer's brief: it gets the pictures, the sections, the layout tree in plain lines, the System with its scale, the aims, the locks and the reference site. It must answer with named directions that differ; locked layers say keep; word changes are suggestions only. The answer is read strictly: off-rule numbers land on the rules, locks are enforced again here, and two directions closer than a set gap are pushed apart so four come back that are four.
- Every variation, local too, has a name on its card.

## Files
`src/features/studio/variations/{model,tokens,relayout,make,run,ask(new),VariationsPage}`, `src/features/studio/better/prompt.ts`, `src/app/api/studio/better/route.ts`, `tests/variations-taste.mjs` (new), `tests/variations.mjs` (stub gains name and depth). Nothing in `system/*`, `layout/*`, `compare/*`.

## Tests
`tests/variations-taste.mjs` (pure, 13 checks per site; red on base: no `variations/ask.ts`) on sol face, mochi and six repo fixtures:

| site | checks | words parts reading at AA before (all still do after 72 rolls) |
|---|---|---|
| sol face | 13/13 | 128 of 199 |
| mochi | 13/13 | 86 of 123 |
| share-xyz | 13/13 | 423 of 434 |
| gotchi-gg | 13/13 | 306 of 366 |
| stonkfun-xyz | 13/13 | 1015 of 1101 |
| trumpmorty-fun | 13/13 | 26 of 38 |
| parasiteonsol-fun | 13/13 | 683 of 1559 |
| trendtrader-pro | 13/13 | 419 of 427 |

104/104. Each site: AA kept part by part and token by token; every scale 1.2 / 1.25 / 1.333 with every size on it; every space and corner on the 4px grid; corners and shadows agree; locks respected on every layer (choice and tokens, and a lock on the first roll keeps the original); the original's document unchanged; the ask carries the System, the layout tree, the aims, the locks and the reference site; 4 named directions with the locked layer kept, every pair further apart than the gap (an answer with two near-identical directions comes back as four); an off-rule answer (×1.5, step 6, lifted square) lands on ×1.333, step 8, flat; word changes are suggestions only.

`tests/variations.mjs` (Builder, stubbed Claude): sol face 29/29 and mochi 29/29 on the built branch (the original’s board 0 px moved, control 0; a kept variation publishes with 0 page errors)

tsc clean; `next build` passes. No real Claude call was made.

## Not covered
- The prompt's quality on a real Claude run is believed, not measured: J's first real run should be looked at.
- The reference site is still given by name only, not photographed.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
