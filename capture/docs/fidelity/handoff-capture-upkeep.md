# Hand-off: capture upkeep lane, 2026-09-30

This lane is retiring. Its branches: sink `claude/dazzling-cori-0ds7kb`
(converter, checks, sites converted again), polio `claude/dazzling-cori-0ds7kb`
(what the Builder draws). Nothing here moved `main` or `capture-consolidated`.

## How the comparisons were made

This container's browser cannot open live sites (the proxy's certificate), so
every comparison is against a curl mirror served on 127.0.0.1: static for
share.xyz; for stonkfun.xyz and gotchi.gg (drawn by their scripts), a mirror
that fetches each GET once with curl and refuses every other method, so it
never writes. Differences in live data (games, prices, feeds) are left out;
what is ranked is what the page's structure decides, matched word for word.
Every fix is general and held by a check, red before, green after.

## stonkfun.xyz and gotchi.gg, before and after (committed document vs converted again, polio trunk cb38449 + 237e60b)

| site (pages compared) | window differing at the top, 1440 | at 2000 | text runs placed or sized off |
|---|---|---|---|
| gotchi.gg (/, pets, rules, faq, shop) | 4.10 → 2.39% | 2.95 → 1.72% | 343 → 34 |
| stonkfun.xyz (/, flywheel, revenue, launch) | 6.54 → 6.13% | 4.70 → 4.41% | 14 → 11 |

(stonkfun's token lists come over a live feed the mirror cannot hold, so most
of what differs there is data.)

## Fixed, by where

**sink converter** (`site/capture/capture-to-document.mjs`)
- A face split by unicode-range (Google's M PLUS Rounded 1c, 126 rules a
  weight) carries, per weight the page sets it in, the rules the browser
  draws the page's characters with (the last declared that holds each). It
  took four per family: gotchi.gg's body text came with a slice lacking the
  space and `$`, and no 700 or 800. `check-font-ranges.mjs`
- A heading's own words among children set apart, a flex-row button's words
  (by justify-content), a block button's start alignment, a button's words
  beside a part of its own, words after an icon in a centred row, a
  `<button>`'s line in the middle of its height, a line whose letters stand
  taller than it (gotchi's wordmark), an older capture's empty field showing
  its placeholder. `check-words-placed.mjs`
- `check-reconvert.mjs` makes its stale document itself.

**polio** (`src/features/studio/parts/`)
- The 2px glyph inset sits outside a text part's box (`tests/inset-room.mjs`).
- A captured button draws its whole label, commas and all, in its part's case
  and spacing (`tests/button-label-whole.mjs`).
- A captured part's spacing is the page's, in px at the size its words are
  drawn (`tests/captured-spacing.mjs`).

## What is left, per site

- **share.xyz**: a retake (captures predate the dump's resting-state, loader,
  loop-clock and placeholder-colour fixes); the price chart's axis labels.
  See `share-xyz.md`.
- **stonkfun.xyz**: the footer links read white in the capture and grey live
  (the capture's own reading; a retake tells which); an ellipsis
  (`text-overflow`) is read by nothing in the pipeline.
- **gotchi.gg**: the contract address runs under its copy button where the
  page ends it with "…" (the same missing `text-overflow`); the feed and park
  are live data.
- **trumpmorty.fun, parasiteonsol.fun, trendtrader.pro**: retakes, from the
  Builder's Recapture now that `main` has the capture fixes
  (`reimport-plan.md`; trendtrader with `--hide-gate`).

## Checks to run after touching the converter

    node capture/site/capture/check-words-placed.mjs
    node capture/site/capture/check-font-ranges.mjs
    node capture/site/capture/check-reconvert.mjs
    node capture/site/capture/check-rest-states.mjs

The root site's document is the converter's output byte for byte; several
checks hold that as their control, so convert it again when the converter
changes it.
