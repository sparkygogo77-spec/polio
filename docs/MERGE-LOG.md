# The merge log

What the merge seat did, commit by commit, and the rules the doing of it
earned. Kept because a branch tip is not a record: the branches move, the
deploy moves, and six weeks from now the only way to answer "when did that
land and what was green when it did" is a list somebody wrote down.

One row per commit pushed to trunk, in the order they went out, with what
each carried and whether it went out green. Where something was pushed red
or with a suite skipped, the row says so rather than the row being absent —
a log that only records the good days is not a log.

The rules at the end are the ones that cost something to learn. They are
here rather than in AGENTS.md because they are about merging, not about
building, and the seat that needs them is this one.

## The night of 15 September 2026

Trunk `claude/template-ui-website-builder-11bfgl`.

Branches watched: elegant-hypatia-ys9biz · youthful-euler-qyt5tx ·
amazing-dijkstra-cznfor · tender-shannon-j0df86 · eloquent-dijkstra-5yhglq (dormant)

| deployed | carried | state |
|---|---|---|
| 9e5a77a | hypatia 703a3f0 — three wheel slots, two duplicates and one that said soon | green |
| 36b6bba | trunk — colour-menu's live half had never run (URL pinned to :3000, playwright-core off the module list); 18/18 → 31/31 | green |
| 57db749 | dijkstra c0e7336 — one element from a site fitted to the space it lands in | green |
| 2337f93 | hypatia de7414a + be365c9 — scroll contract, backend surface | RED: scroll-contract 24/27, 3 × "categories on screen without scrolling" at 2048x1152 ("1440p at 125%"), shelf 261–456px below the fold. Passes at 1267x1278, "the window J measured in". Hypatia's to close. |
| 2bab116 | euler 22a43b9 + c9ec7e2 + 0b64a1d — sparks rub out where they were, sliding layer on whole pixels; plus trunk retiring board-layout's "moves on every frame" (7th instrument broken by the thing improving) | green |
| d6dee78 | dijkstra a445520 — a tall header named a first screen, recreate findings written by owner | green |
| 7b38e86 | shannon f9d0082 — a real site over the open web, read and landed by measurement (her first on trunk) | SKIPPED: site-live can't run here — Chromium doesn't trust the session's egress CA (every https host fails for the browser, none for node); managed-policy route tried and removed |
| d9858fa | dijkstra fa836ba — a floated section read where its words are; zip-import 68 → 73, six blocks where there were five | green |
| 08cfa42 | bardeen ea31164 + c12b0d9 (sixth session, first on trunk) — the unfinished inventory (216 lines, docs-only), and a Build export that imported a file nobody wrote; scaffold 32/32 | green |


| 87de105 | dijkstra fc50ba6 — a picture in a landed block said to stay a placeholder; a made surface picked again ("Make it again"); zip-import 73 → 75 | green |

| 9dd20f9 | shannon 82c0125 — the seven shortfalls of the live read, held to the page by number; placeInFrame now to a hundredth of a pixel (board geometry re-measured: board-edges 11/11, full-page 42/42, picked 16/16, create-flow 26/26). One docs conflict with dijkstra, both sides kept | green |

| e27e5d0 | bardeen 2c4453e + 935af3b + 3fdd402 + a1783b1 — inventory rows A1/A2/A3 closed by the session that wrote the list: Re-iterate from the tab you are on, Compile opens the book's tab, Picture+Solid on the shelf (229 counted three ways), tweet console records the real site. Four new suites 8/8, 8/8, 7/7, 6/6 | green |

| aeeee41 | meitner ce115bb (seventh session, first on trunk) — a drawn box is a real cube: turned, written on, moved. Twenty source files incl. Canvas/store/RadialMenu/blocks/spec; box-to-cube 74/74 new, cube 62/62, cube-part 29/29, and the board geometry re-measured green | green |

| 3d1199a | dijkstra 0295c74 — the family a page was set in travels by name; Zen Garden counted. zip-import 79/79, site-read 48/48, recreate 49/49. Commit also carries the held-hypatia explanation for her and for euler | green |
| a1ec677 | bardeen 850e7a6 — thirteen controls that now do what they say (most of section A of its own INVENTORY.md); eleven new suites all green, plus menu-pass 101/101, cards 67/67, board-edges 11/11, full-page 42/42 | green |

| f339736 | meitner f2afcf6 — where it goes reads the part first: a cube is a solid in one step; box-to-cube 76/76, space 54/54, cube 62/62 | green |
| f32fbbb | shannon 68beea4 — the live read holds a page written this year (any colour, any status); site-read 48 → 56. Two conflicts with dijkstra resolved by keeping what each added (her normalised `border`, his font-face block) | green |

| b6a5d65 | bardeen 809b7d8 — the backend's effort rides with every ask; a traced drawing comes back as a drawing. effort-rides 15/15 and render-answer 13/13 new | green |
| f77107a | meitner ee8f32f — one undo takes back an edit; the still under a solid is the object. box-to-cube 76 → 82, board geometry re-measured green | green |

| 6163dc4 | **hypatia 8c9160e — the held work goes in.** Content sets the page, the pane sets the zoom. board-edges 1/11 → 11/11, full-page 33/42 → 45/45, picked timeout → 16/16, scroll-contract 40 → 52 all holding (incl. the 2048x1152 fold reds). Carries **euler's 30** — his branch had merged hers. quiet-scroll instrument fixed (8th) | green |

| e741538 | bardeen 362b300 — Preview here previews here, the wheel's tray, a page's scroll reaching the preview, published width, screenshot cut, Vercel pages, named behaviours. Six new suites green. RadialMenu import conflict resolved as the union. page-scroll-live instrument fixed (9th) — the Builder no longer writes the store on load, so a suite must make its own document | green |

| fc67aca | bardeen 99b8ade — a part wearing a drifting texture drifts; a cube turned on the full preview stays turned; route deadlines. part-drift 3/3, live-turn-saved 4/4, route-deadlines 21/21 new. RadialMenu import sorted alphabetically to stop it conflicting a third time | green |

| ef5bdec | **my regression, taken back** — bardeen 99b8ade. My merge carried an older copy of the wheel's slot table and resurrected the Edit slot A22 had removed; the union resolution of the lucide import kept Files and Monitor alive to compile it. page-wheel-edit 4/4, priority-wheel 6/6 | green |
| 64d80f8 | all five waiting branches at once — dijkstra's catalogue handover, meitner's second-time cube walk, euler's 8, bardeen's 13, hypatia's 11. 51 source files. Six new suites green, every wheel suite green, board green, scroll-contract 60/60. Deployed 11:26:47 | green |

## RESOLVED — was held, went in at 6163dc4

### the original finding — not pushed

**hypatia 972ce24** (was 2d237de; her tip moved, the reds did not) "The fit is remembered only when it happened, and three
things watch the width". Merged clean, typecheck clean, build rc=0, and then
held: it takes the board's core geometry red. Kept locally on branch
`held-hypatia-2d237de`; trunk stays at 08cfa42.

Before and after, same three suites, same test files (her commit changes only
Canvas.tsx and scroll-contract.mjs), both measured here on a build:

| suite | 08cfa42 (deployed trunk) | with 2d237de |
|---|---|---|
| board-edges | 11 of 11 | **1 of 11** |
| full-page | 42 of 42 | **33 of 42** |
| picked | 16/16 | **times out** at outlineOf |

The merge did not cause it: the merged Canvas.tsx is byte-identical to hers
(diff is 0 lines).

The specific losses:
- "the page still grows downward to hold what is drawn below it" — 1220 tall
  for ink at 1060, becomes 900 tall for ink at 1060. That is the
  page-is-everything-drawn-on-it behaviour measured on the live deploy at
  19b831e.
- full-page: "exactly one element that could move the site scrolls" — NOTHING
  scrolls, in any direction; travel 0 against a wanted -354; board 589 in a
  pane of 1191; the shelf's search box unreachable at y 1032.
- board-edges reports drawn lines as undefined×undefined — the elements it
  looks for are not found at all.

Her own new work in the same commit does hold: scroll-contract 34 of 37,
including twelve new width checks (page 644/944/1381 inside panes of
772/1072/1509, no overrun across sixteen drag steps, hand zoom not undone).
The 2048x1152 fold check is still red but is now constant at 1413 across all
three arrangements where it was 1413/1608/1460, so the stroke case improved
from 456px below the fold to 261px.


## Two rules this night earned

1. **Which suites to run on a merge.** When a merge brings an older copy of a
   file another session has just changed, run that session's suites for that
   file, not the general one. wheel-pass stayed green right through the
   Edit-slot regression; page-wheel-edit and priority-wheel owned it.

2. **The icon-import trap.** A sorted import line is not a union. Resolving
   as the union is right when two sessions each add an icon and wrong when
   one has deliberately removed icons — an icon dropped on purpose stays
   dropped. RadialMenu.tsx's lucide import conflicted three times in one
   night and caught two sessions, mine and euler's. It is alphabetical now,
   with that sentence above it.

## When two lanes rewrite the same thing: the later instruction wins

17 September. Dijkstra's five (tip 19aa259 — box order, the vine leaving on
its own edge, no black field on a carried-out box) conflicted with hypatia's
lane work already live: ten hunks across Lanes.tsx, Timeline.tsx, lanes.ts
and tests/lanes.mjs. Both had rewritten the lane rendering, from different
directions.

Held rather than resolved. The merge seat had no basis for choosing whose
geometry survived, and picking one would have silently discarded a night of
the other's work.

**The owner's ruling, and the rule it leaves.** The live geometry is the
base and it wins, because it is what he asked for LAST. He looked at the
fan, called it awkward, and asked for the three lanes in a column with
strict square-cornered connectors. Dijkstra's five predate that instruction,
so the box-order and vine-edge work was built against a layout he has since
rejected. Taking that side wholesale would have undone the thing he most
recently asked for, which is the worst of the three outcomes available.

So, for anyone in this seat later:

  · a conflict between two lanes over the same surface is not a merge
    problem, it is a question about which instruction is newer;
  · what is deployed is the answer to that question, because it is what the
    owner last looked at and accepted;
  · the lane whose work predates the newer instruction rebases and keeps
    only what is genuinely new and not superseded;
  · anything that re-litigates the superseded layout is dropped, however
    good it is on its own.

**For dijkstra.** Rebase onto trunk. Keep the black-field work if any of it
is still missing, and anything about box ORDER that is not about where the
boxes sit. Drop anything that re-opens the fan, the stagger, or the old vine
edges. Trunk's lane geometry is the base; do not bring the old one back.

Holding a merge for an hour costs less than quietly deleting a night's work.

## The suite set is not chosen by the diff

17 September, and this one cost a false clean report. The floor below runs on
every merge, whatever the diff touched. A diff-driven set is an optimisation
on top of it: it may ADD, it may never SUBTRACT.

    npm run typecheck
    npm run build
    node tests/menu-pass.mjs   <url>
    node tests/lanes.mjs       <url>
    node tests/full-page.mjs   <url>
    node tests/ink-on-cards.mjs <url>   # "contrast on cards"

Measured on the 034e34d build: menu-pass 25s, lanes 23s, full-page 52s,
ink-on-cards 104s — 204s for the four, against a typecheck and a build that
every merge already runs. There is no case for trimming it on time. If a
floor ever does get slow, SAY SO and let the owner decide what to trade.
Never decide it by omission.

**How the gap worked.** I picked suites by which files a diff touched, which
is a reasonable heuristic and a silent one. ink-on-cards reads pixels off
`/builder`, and no commit has to touch its files for its numbers to move: a
colour, a light, a face, a font weight anywhere upstream changes what it
measures. So it went unrun across several pushes and was red on the live
deploy at 217ecc3 while I reported that push clean. The owner repeated that
to the person the work is for.

The general shape, which is the same fault this whole night has been about:
**a check nothing thinks to ask is a check that fails quietly.** Coverage
chosen by what changed can only ever find what changed. A floor is the part
that does not ask permission from the diff.

## Two things a merge seat does not do

Established the same night, both on a held merge:

  · **Do not push red**, even when the failure looks cosmetic. A pin naming
    an old spelling and a pin catching a real rename are indistinguishable
    from the merge seat. The lane that changed the line is the only one that
    knows which it is, so that lane fixes it. Hold, name the check, hand it
    back.
  · **A git hook counting unpushed commits is not an argument for pushing
    them.** It cannot see that a suite is 21/24. Refuse it and put the
    question to the owner.

## Caused by this merge, or inherited by it

The floor catches reds. It does not follow that every red stops a push, and
getting this backwards turns a safety net into a gate nothing passes, with
unrelated work piling up behind a fault nobody is working on.

The distinction is not red against green. It is **caused by this** against
**inherited by this**:

  · a floor suite that was red BEFORE the merge and is UNCHANGED BY IT does
    not block that merge — ship past it;
  · a floor suite that THIS MERGE TURNS RED blocks, every time, no
    exceptions — hold, name the check, hand it to the lane that changed the
    line;
  · either way the reds are named in the commit and to the owner.

Worked on 17 September, all three cases in one night. `board-speed` went
24/24 → 21/24 on the light-panel merge: caused, so held, and the lane fixed
its own pins. `ink-on-cards` and `updates-view` were red before and after,
byte-identical: inherited, so shipped past. Establishing "unchanged by it"
is worth a build — check out the pre-merge tip, build it, and run the suite
there rather than reasoning about whether the diff could have reached it.

**Date an inherited red in the same breath.** A red with a date is a known
debt; a red without one cannot be told apart from something that broke an
hour ago and nobody noticed. Two dates cost different amounts:

  · CHEAP, git only: when the check itself last moved.
    `git log --oneline --follow -- tests/<suite>.mjs`, and
    `git log -S"<the threshold>" -- tests/<suite>.mjs` for the bar itself,
    with `git rev-list --count <sha>..HEAD` to say how many commits back.
    A bar that has not moved in hundreds of commits means the PRODUCT
    drifted under a stationary check, not a check that got stricter — which
    is most of what an owner wants to know.
  · EXPENSIVE: when it started failing. That is a bisect with a build at
    every step. Say it is available rather than spending it unasked.

Dated this way on 17 September: ink-on-cards' 70%-of-the-room bar unchanged
since 378 commits back, its suite last edited 49 back; updates-view
untouched for 425 commits. Both reds are drift under old bars.

## The constraint order for the timeline, as the owner has ruled it

Five rules, in this order. Later rules give way to earlier ones, never the
other way round.

  1. No part of the COLUMN is ever outside the frame.
  2. No part of the FAN is ever under the band. Something hidden under an
     opaque band reads as absent, and absent is a lie about the board.
  3. Subject to those, the column is centred in the room and fills it as
     fully as it can.
  4. If all of those cannot hold at some width, the FAN OVERHANGS TO THE
     RIGHT, visibly, and the widths and the amounts are named.
  5. The fan may overhang and it may sit in front of things, but it MUST NOT
     TINT WHAT IS UNDER IT.

Rule 5 was added on 18 September off the finding below. A merge seat does not
codify a lane's own reading of a rule as though it were the owner's ruling —
that mistake was made once tonight, with "the column is never under the band,
whatever it costs the fan", which is the opposite of rule 2.

## FOR THE LANE: the fan's new position is tinting the cards

`a7146f2` + `8f2bb99` are merged and HELD, not pushed. `ink-on-cards` is
17/18 on that tree and was 18/18 the commit before, so this is caused, not
inherited. The suite is not in the diff; the bar has not moved in 378
commits.

**The lead.** The declared ink is LIGHT — `oklch(0.95 0.07 152)` — and what
lands is `rgb(115,151,124)`. A near-white ink does not measure as mid
grey-green unless something is laid over it. The fan's new position is
tinting the cards; the ink itself has not changed.

The four failing samples, all `<li>` feature names inside `ul[data-features]`
on a green card:

    mark        ink measured      declared ink          face measured   ratio
    "Top bar"   rgb(131,168,140)  oklch(0.95 0.07 152)  rgb(0,58,21)    4.41
    "Hero"      rgb(115,151,124)  oklch(0.95 0.07 152)  rgb(0,58,21)    3.46
    "Join"      rgb(114,151,124)  oklch(0.95 0.07 152)  rgb(0,58,21)    3.50
    "Footer"    rgb(126,165,136)  oklch(0.95 0.07 152)  rgb(0,61,22)    4.01

"Hero" was 4.54:1 one commit ago on the same 24px of core.

What was ruled out, by measurement rather than by argument:

  · the GROUND IS UNCHANGED at `rgb(0,58,21)`, the `<li>`'s own
    `oklch(0.3 0.09 152)`;
  · NOTHING IS BEHIND the marks — no lane box intersects any of the four.
    Across the whole board there is exactly one card/lane-box overlap,
    105x92px, and it is on none of them;
  · the layer stack under every failing mark is
    `li[data-feature-new]` → `ul[data-features]` → `div` →
    `div[data-box]` → `div[data-timeline]` → `div[data-studio-pane]`,
    and every layer above `data-box` is `rgba(0,0,0,0)`.

So the ground did not lighten. The ink darkened. Something the fan's move
introduced is being laid over the card.

**Fix the tint, not the colour.** Darkening or lightening the ink to clear
the bar treats the symptom and loses the colour he chose. This is likely one
line.


## CORRECTION: the fan is not tinting the cards. The zoom dropped.

The section above was right in its numbers and wrong in its diagnosis. The
lane had read the source and found no `mix-blend-mode`, no `backdrop-filter`,
no z-index on the vine layers, the lane canvas `pointer-events-none` with no
stacking context, and the boxes at zIndex 12 rendered after the lanes. It was
right. There is no overlay.

The same instrument, run on the build BEFORE the fan moved and after:

                      BEFORE 1a11243        AFTER 10dc554
    plot zoom         0.7939                0.6234
    feature li        9px declared          9px declared
    painted height    13.2px                10.3px
    "Hero"            4.54:1, 24px core     3.46:1, 24px core
    "Top bar"         5.03:1, 36px core     4.41:1, 10px core
    "Footer"          5.10:1, 29px core     4.01:1, 24px core
    "Join"            5.43:1, 15px core     3.50:1,  9px core
    face              rgb(0,58,21)          rgb(0,58,21)  — IDENTICAL

The ground did not move. The TEXT GOT SMALLER: the fit zooms out 21% further
than it did, so 9px text paints 10.3px tall instead of 13.2px, and the core
pixel counts collapse with it — "Top bar" from 36 pixels of core to 10.

At that size a glyph stem is about a pixel wide and nearly every pixel is a
blend of ink and ground. `ink-on-cards` cuts its "core" at 0.7 of the largest
difference in the patch, which does not separate ink from antialiasing at
10px, so what it reports as the ink is a mixture of ink and ground — darker
by exactly the amount the antialiasing contributes. The declared ink,
`oklch(0.95 0.07 152)`, never changed.

**Both halves are true.** The fan's change DID move the number, so the check
is not reading a pre-existing state — but not by laying anything over the
card. It moved it by zooming out. And the check IS at fault, in that it
cannot measure 9px text honestly and reports antialiasing as dimmer ink.

**So neither fix in the note above is the right one.** Do not hunt a tint;
there is none. Do not move the ink; it is unchanged and correct. The two real
questions are whether the fit should zoom out this far on this board, which
is the owner's to answer, and whether `ink-on-cards` should read a mark whose
painted size leaves it no core — an instrument question and a different
commit.

**The rule this leaves.** "Ground unchanged, ink darker, nothing behind it"
does NOT imply an overlay. Smaller text produces exactly that signature
through antialiasing. Before calling a contrast drop an overlay, read the
painted size of the mark and the zoom, not only the colours.

## The owner's two rulings off that push, 18 September

Shipped with the red named, and NEITHER of these is approval of what shipped.

**1. THE 21% ZOOM-OUT IS NOT ACCEPTED.** It breaks the constraint order
rather than satisfying it. Rule 3 says the column fills the room AS FULLY AS
IT CAN; rule 4 says that where the rules cannot all hold, THE FAN OVERHANGS
TO THE RIGHT, VISIBLY. Neither says the board shrinks. **Room for the fan
comes out of overhang, not out of his text.** 0.7939 to 0.6234 is a real loss
on the surface he reads all night and it comes back in the next commit.

**2. `ink-on-cards` GETS ITS OWN COMMIT.** It must REFUSE TO JUDGE a mark it
cannot measure rather than report a number it cannot support. A check that
fails on 10px text and passes on 14px is not measuring legibility. It handed
the owner two false readings in one day: once reported as a real dimming that
was antialiasing, and once cited in a clean report where it had not been run
at all.

The general form, which is the night's lesson in one line: **an instrument
that answers when it cannot see is worse than one that says it cannot see**,
because the answers get believed and acted on. Same shape as the four checks
that were green about nothing, and as the suite that timed out on a deleted
element and reported the six checks behind it as passing.
