# Handover: three catalogue faults, measured on the CSS Zen Garden zip

For whoever owns `src/features/studio/recreate.ts`. Nothing here needs
re-deriving: every number below was read off the page through the zip
route (`api/studio/zip`, selectors measured by `MEASURE`), and the code
each fault lives in is named by function. The walk they come from is
`scratchpad/zip-walk.mjs` on `zen-garden.zip` (design 214); the same
page lands the same way on the deployed site at ef5bdec.

All three are the same class of fault: a proxy is standing in for a
meaning. A run's size stands in for "this is the heading"; a count of
same-sized children stands in for "these are cards"; a big run high on
the page stands in for "this is the first screen". Each proxy is right
on the pages it was written from and wrong on this one, and none of them
says which it is. A reading that uses a proxy should say so, or use the
meaning where the page gives it (a tag, a role, a position among its
siblings).

## 1. The heading is chosen by size

`headline(r)` returns the run with the biggest `px`. The Requirements
section has seven runs:

| run | px |
|---|---|
| Requirements | 29 |
| Where possible, we would like to see… | 16 |
| CSS validates. | 14 |
| Luckily, designing this way shows… | 16 |
| We ask that you submit original artwork… | 16 |
| This is a learning exercise as well as… | 16 |
| By Dave Shea. Bandwidth graciously donated by mediatemple… | 32 |

The closing line is set at 32px, so the part lands headed "By Dave Shea.
Bandwidth graciously donated by mediatemple. Now available: Zen Garden,
the book" and the word "Requirements" is a body line under it. Every
entry that calls `headline` (`HERO`, `PROSE`, and `body`, which is
"everything but the headline") inherits this.

What the page gives instead: the run's tag. The heading is an `h3`, the
closing line a `p`. The reading's `text` runs do not carry a tag today;
`MEASURE` in `siteRead.ts` could add one (`blockOf` already has the
element), and `headline` could prefer the first `h1`–`h6` run, falling
back to size only when the page has no heading. Where it falls back, the
part's `did` line should say "headed by its biggest line".

Check to add in `tests/recreate.mjs`: a reading with runs
`[["Requirements", 29, "h3"], ["By Dave Shea…", 32, "p"]]` lands headed
"Requirements". It fails today.

## 2. A five-link footer becomes five cards

The page's `<footer>` (at 0.95 down, 1280×176, tag `footer`) holds five
links in a row: HTML, CSS, CC, A11y, GH. Measured: 5 children, layout
row, 5 columns, gap 101; five runs at 16px; five links.

`FOOTER.match` returns 1 for it (`down ≥ 0.6`, aspect ≥ 2, tag
`footer`). `CARDS.match` also returns 1: 5 children ≥ 3, width spread
under 0.25, first child 60px or taller, `columns > 1`. The picker in
`recreateFrom` keeps the first entry to reach the top score
(`if (n > sure)`), and `CARDS` comes before `FOOTER` in `RECREATABLE`,
so the tie goes to cards and the footer lands as a card grid of five
one-word cards, white on rgb(19, 67, 71).

What the page gives instead: the tag. A block tagged `footer` or with
`role="contentinfo"` is a footer before it is anything else; `CARDS`
could return 0 for it, or `FOOTER` could come before `CARDS` in the
list, or a tagged match could score above 1 so that ties never decide a
tagged block. Any of the three is a one-line change.

Check to add: the reading above (`tag: "footer"`, five same-sized
children in a row, `down: 0.95`) lands as `footer`, not `card-grid`. It
fails today.

## 3. Three inner sections become first screens

`HERO.match` claims any block with `down ≤ 0.45`, height ≥ 220, a
biggest run of 28px or more, and that run at least 1.5× the next. The
Zen Garden's column has three such blocks, and none of them is the first
screen:

| block | down | box | biggest run | next | children |
|---|---|---|---|---|---|
| `#zen-preamble` | 0.15 | 845×325 | The Road to Enlightenment, 29px | 16px | 4 |
| `#zen-explanation` | 0.25 | 845×425 | So What is This About?, 29px | 14px | 3 |
| `#zen-participation` | 0.38 | 1280×501 | Participation, 29px | 16px | 4 |

The page's actual first screen (`#zen-intro`'s header, 0 down, 1280×310,
"CSS Zen Garden" / "The Beauty of CSS Design") is claimed too, rightly.
So the whole page lands with four first screens: 4 of the 7 catalogue
parts on a page that has one.

What the page gives instead: position among siblings. One page has one
first screen, and it is the first tall block. Two ways to say it:
`recreateFrom` is called per block and cannot see the others, so either
the whole-page take (`FromASite.tsx`, `takeAll`) passes the block's
index and `HERO` claims only index 0 or 1, or `HERO` requires the block
to start above the fold (`box.y < ~900` at 1280 wide, which the
preamble at 498 still passes) and to be headed by an `h1` or `h2`, which
the three sections (all `h3`) are not. The second needs the tag on runs
from fault 1. The rest of these blocks are bands of words with a heading
(`PROSE`), which is what they are.

Check to add: the three readings above land as `prose`, and `#zen-intro`
still lands as `hero-split`. The first three fail today.

## Where the three meet

Fault 1 gives fault 3 its heading test, and fault 2 is decided by list
order. Doing them in the order 1, 2, 3 means each check can be written
against the previous one's reading. The whole-page count to compare
against afterwards is in `docs/RECREATE-FINDINGS.md`: today 7 of 10
blocks are catalogue parts (4 first screens, 2 lists of links, 1 card
grid) and 3 are bands of words; after these three it should read 1 first
screen, 2 lists of links, 1 footer, 6 bands of words.
