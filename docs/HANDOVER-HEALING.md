# Handover: the healing, which only ever pushes down

Written by the lane that landed `f25089b` (an import is swept, in the sweep's
order) and `25c7f44` (the sweep fits nothing). **Nothing here has been
started.** It is what was measured about the healing while doing those two,
kept for whoever takes it, so the pattern is inherited rather than rediscovered.

Strictly separated, as the column handover was: **MEASURED** (a number I took,
with how), **BELIEVED** (reasoning I did not close).

---

## 0. The pattern, before the numbers

The healing (`textFit.ts` — `fitRows`, `useSettleToWords`; the rule in its own
words is "a box that grew displaces what follows it") has **one direction:
down.** It never lifts, never pulls back. Every gap measured tonight that was
not a converter fault traced to that direction:

1. **The banner's 11px overhang became 101px** of dead space: the healing saw
   the banner overlapping the logo it owns and cleared it downward
   (`tests/wrapper-heals.mjs`; reproduced through the import in
   `tests/bring-sweeps.mjs`, banner at y 101 on the code before `f25089b`).
2. **His tokens banner at y 147**: the same push, on sink's real document,
   when the sweep never ran on an import (fixed by `f25089b`).
3. **The rail pushed down 72px under the grown banner** — below, with the
   sweep now running.
4. **The footer's contents scattered out of the footer** — below. This is the
   one to start from.

The owner's complaint, sent as a picture, is a box whose content has fallen
out of it. Section 2 is that, measured.

---

## 1. How the numbers were taken

**MEASURED**, local production build of `25c7f44`, sink's own
`site/document.json` (byte-identical to what re-running the converter on the
committed captures produces), brought in through the real door — GitHub
control → Bring — with GitHub stubbed in the browser and a placeholder token,
into an empty site that had been opened first (as Site 3 on his Builder has
been). The page is then opened and left to heal; positions are read from the
saved document.

**`scripts/bring-measure.mjs`** does all of it and prints every table in
section 2. Against a production build, with a checkout of
sparkygogo77-spec/sink:

    npm run build && npx next start -p 3013
    node scripts/bring-measure.mjs http://127.0.0.1:3013 <path to sink> [out.json]

Re-run on the rebased branch (trunk `1d18b0e` plus this lane's three
commits), it reproduced every figure below exactly. The ids it reads are
sink's; if sink's document is regenerated it names any it cannot find
rather than guessing.

**Only the tokens page is solid.** On home the healing ran once while the
import landed (home is the page on screen), so its figures are indicative.

---

## 2. The tokens page after healing (`25c7f44`)

The capture: page 1427 tall; header 0–82, rail 73–1354 (1281 tall, fixed,
top 73 / bottom 73), main 73–1354, footer 1354–1427. **In the capture the rail
ends exactly where the footer starts.**

| part | captured y | after healing | moved |
|---|---|---|---|
| banner (grown by the sweep to hold its logo) | 0 → −11 | −11 | 0 |
| rail `n_box_207`, 1281 tall | 73 | 145 | **+72** |
| nav `n_box_208`, 440 tall | 73 | 145 | +72 |
| main `n_box_198`, 1281 tall | 73 | 178 | **+105** |
| footer `n_box_259`, 73 tall | 1354 | 1579 | **+225** |
| page bottom | 1427 | 1692 | +265 |

The rail now ends at 1426 and the footer starts at 1579: **153px short**, where
the capture had zero. 38 of 64 parts moved; 26 did not move, 15 moved 12px, and
the rest moved between 14 and 281px.

### The footer's contents, relative to the footer

The footer holds seven parts. In the capture every one sits 17–31px below the
footer's top, inside it. After healing **not one of them is inside it**:

| part | captured, from footer top | moved | after, from footer top | where |
|---|---|---|---|---|
| `n_box_260` div | +17 | **+281** | +73 | **out the bottom** — starts exactly at the footer's bottom edge; 56px further than the footer moved |
| `n_box_261` div | +17 | +168 | −40 | out the top, 0px clear |
| `n_prose_266` "A Sol" | +31 | +142 | −52 | out the top, 36px clear |
| `n_box_263` link "Documentation" | +17 | +128 | −80 | out the top, 40px clear |
| `n_drawnicon_264` icon | +27 | +128 | −70 | out the top, 50px clear |
| `n_prose_265` "v2.0.0 \|" | +29 | +128 | −68 | out the top, 52px clear |
| `n_ctaprimary_262` button "?" | +17 | +105 | −103 | out the top, 63px clear |

So the push is **per part, not per box**: the footer and each thing in it were
pushed by different amounts, and a box's contents do not travel with the box.
One went further than its footer and fell out the bottom; six went less far and
were left above it.

### For comparison, the same page on the two earlier builds

| build | rail | rail ends | footer top | rail short of footer | page bottom |
|---|---|---|---|---|---|
| before `f25089b` (sweep never ran) | 440 at y 229 | 669 | 1616 | 947 | 1689 |
| `f25089b` (swept, still fitted) | 440 at y 145 | 585 | 1569 | 984 | 1642 |
| `25c7f44` (swept, not fitted) | 1281 at y 145 | 1426 | 1579 | **153** | 1692 |

Between `f25089b` and `25c7f44` only the three lowest parts moved differently
(footer 215 → 225, `n_box_261` 158 → 168, `n_box_260` 198 → 281). Everything
else moved by exactly the same amounts.

---

## 3. What I believe and did not close

**BELIEVED: the healing treats a positioned band's overlap as a collision.** In
the capture the header (fixed, 0–82) overlaps the rail (fixed, from 73) by 9px,
and the page means it: the converter keeps those overlaps on purpose ("they
are the page's own", `capture-to-document.mjs`). Grown to hold its logo, the
banner reaches 101, and the rail moved to 145 — consistent with being cleared
downward past the banner plus a gap. Not traced in `fitRows`.

**BELIEVED: displacement is decided per part, never per owned group.** The
footer table says so in effect, but I did not read `fitRows` to see why each
part got its number. The sweep's grow step already knows ownership from the
recorded DOM path (`owns.ts`); the healing does not appear to consult it.

**BELIEVED: a rule that moves a box's contents with the box would stop the
scatter, and a rule that lets a positioned band overlap what it overlapped in
the capture would stop the rail's push.** Neither is designed, measured, or
costed. Both are the healing's own rules, which have their own fixtures; the
wrapper-heals and grew-moves suites are where their red checks would start.

---

## 4. Known shifts, so nobody mistakes them for new breakage

- **`tests/box-fields.mjs`** fails two checks ("the cards wrap into lines
  inside the strip", "the strip grew to hold them") **on the code before this
  lane's work as well** — measured, not taken from a label. Since `25c7f44`
  its strip sits **5px lower** (151 → 156, 135 → 140): the board carries
  captured `layout`/`pad` fields, so the sweep runs on it, and the sweep used
  to fit a box above the strip. The same two checks fail; nothing new does.
- A board already swept before `25c7f44` keeps the heights the fitting took
  from it. Not fitting cannot restore them, and no retrofit was written by
  ruling: bringing sink into a fresh site (Site 3) is the way to a board with
  the rail at 1281.

## 5. Traps met on the way

- **`ss` is not installed in this container.** A port check written with it
  greps nothing and always reads "free". Check the port by asking it
  (`curl --max-time 2`), and kill servers with a pattern the calling shell's
  own command line cannot match (`pkill -f "next-serve[r]"`) — a plain
  `pkill -f "next start"` killed the shell that ran it.
- **A regex can be vacuous in the other direction.** `boxes?` never matches
  "1 box". The check went red for the right reason on the old code only by
  luck; it was found by printing what the page actually said.
- **A fixture can fail to reach the fault.** The nav check first passed under
  the wrong fix because the fixture's nav was itself shrunk, so rail and nav
  never became twins. His nav's entries fill it to its foot; the fixture had
  to as well. Run every check red under the wrong fix, not only the old code.

---

## 6. Separate defects, logged and NOT fixed with the carry

Found while the carry was built. Each is its own change; none of them rides
along with the healing work.

1. **A picture drawn taller than the capture recorded.** On sink's pages the
   "Solana" picture draws **220 tall against a captured 24** (`n_picture_90`
   on home, `n_picture_240` on Tokens, one per section page), and the SOL
   WORKS logo **156 against 112** (`n_picture_87`, `n_picture_237`). The
   board draws the picture wrong; the capture is right. The healing no longer
   treats it as growth (only words grow), so it moves nothing — but it still
   draws at that size.

2. **Eight buttons paint their descendants' words, and the descendants paint
   them again.** Each section page's wallet button carries its own content set
   to the joined words of what it holds — on Tokens `n_ctaprimary_247` reads
   "4HXH...TXxd 7s ago" — while it also owns the two prose parts that draw the
   same words over it (`n_prose_250` "4HXH...TXxd" at 1261,25 and
   `n_prose_251` "7s ago" at 1261,41). Two layers of the same text in two
   colours: the white is the button's own label, which is in none of his
   design. One per page, eight in all: Creator Hub `n_ctaprimary_97`, Cleanup
   `n_ctaprimary_176`, Tokens `n_ctaprimary_247`, NFTs `n_ctaprimary_323`,
   cNFTs `n_ctaprimary_399`, Domains `n_ctaprimary_470`, plus LP and Unknown.
   Documentation has none. This is the duplicated-button-words defect, and it
   is not harmless repetition. **Produced at capture time, not by polio:** the
   joined words are already in sink's own `site/document.json` (traced by the
   lane that took it) — the converter's side of the import.
   TRACED: the converter gathered a button's words from its whole subtree
   (`wordsWithin`) but folded only a DIRECT child holding words and nothing
   else. The wallet's words sit in `button > div > span`, a level deeper, so
   they were gathered AND emitted. The ruling, for buttons and sentences
   alike: every captured word is drawn by exactly one part; a child folds only
   as a control's label (a button's direct child holding only words) or as a
   run of its parent's own sentence; anything else keeps its words out of the
   parent. Three halves, in this order, because each one alone is worse:
   · polio `2bbde72` — a button that speaks and carries no words draws none
     (else it paints "Get started" where the address was). On trunk; changed
     nothing visible on its own, which is right.
   · polio `e98f7f1` — the twin keep rule (entry 8). Without it the capture
     half DELETES the eight buttons.
   · sink `5a0bc6d`, the capture half — gather only what is folded. On sink's
     `main` after `e98f7f1` was on trunk and verified. It changes exactly the
     eight nodes' `content` and `label`; all 720 ids stay, in order.

3. **"[object Object]": 18 parts on the board, from 17 sets in sink.**
   CORRECTED and TRACED. The earlier line here said "two on each of the nine
   pages", counted off the board. The board does hold 18, but not that way:
   sink's document carries 17 "A Sol / Works / project" sets (8 header, 8
   footer, 1 inside the Documentation page's `main`) and 1 "Powered by /
   GitBook" pair in its aside. That is 18 rejoins, 17 + 1, and a count wrong
   by one in a handover is how someone later concludes a fix missed a case.
   It is **not in sink's document** (0 parts carry it; every `content` there
   is a string), which the column lane found from the capture's end. It is
   made in polio: the sentence rejoin (`reassemble.ts`) keeps one part per
   sentence and `withJoins` (`store.ts:1268`) writes its runs into `content`
   as a LIST. Measured on a fresh import: 18 parts with list content, the
   string "[object Object]" drawn 0 times and present 0 times in the saved
   state. It appears only where something reads `content` as a string.
   **What the capture's sentence half will and will not clear.** The 8 footer
   sets sit under "v2.0.0 |", a parent with words of its own, so the capture
   folds them into that sentence and they never reach the rejoin: they
   disappear on a new import once that half lands. The other 10 — 8 header
   sets and both Documentation ones — have parents with NO words of their
   own, so the capture leaves them as parts, the rejoin still joins them, and
   they survive until polio handles list-as-content.
   **One line from the entry this replaced, re-measured so it is not lost or
   revived by mistake:** the first version said the footer line "renders as
   'A SolWorks project'", with the space. Measured on 0a81b05 with the
   fixture's home page: header (`n_prose_81`) and footer (`n_prose_116`) both
   draw "A SolWorksproject". That reading does not hold today; entry 7 is the
   current one.
   **So 2 and 3 live on opposite sides of the import:** the buttons' doubled
   words come in with sink's document; the "[object Object]" does not, and is
   made after it lands. Look for them in different places.

4. **The grow step's own overlap.** FIXED since: the converter now carries the
   capture's `position` (sink 98355ca) and the grow step never grows a wrapper
   to take in an out-of-flow part; the header keeps 0/82. What follows is how
   it was found. The sweep grows the header to hold its
   logo, from 0–82 to −11–101 (−11–121 once the price line reflows), and
   the first sidebar button starts at 89 (109 after the healing). The header
   reaches **12px** past that button's top. The capture has the header ending
   at 82, clear of the button: the overlap is manufactured by the grow step,
   not the page's own, and the carry keeps it rather than prising the pair
   apart.

5. **A part above y 0 was out of reach; the board now reaches it. The
   reported page size is left alone, on purpose.** FIXED for reach.
   `frameTopReach` (`store.ts`) gave the board room above the page for ink
   and drawn spaces and not for parts. On sink the capture places one kind
   of part above 0: the SOL WORKS badge at y −11, 112 tall, on each section
   page (Documentation has none). Measured on 2bbde72, "clipped" was the
   wrong word: nothing clips it. The board keeps 20px of ground over the page,
   so at the zoom it opens at the badge fitted with 9px to spare. Zoomed in
   to 3.03 its top 13px sat above the board's own top, where no scroll
   reaches, and a part at y −200 was 175px out of reach at any zoom. The earlier
   acceptance ("the owner will place the logo by hand") is superseded: he
   ruled the barrier unnecessary. Parts now count in `frameTopReach`. The
   part stays at −11 and the page keeps its origin; only the board reaches
   higher. `tests/part-above-reach.mjs`: 8/12 on 2bbde72, 12/12 with the fix.

   **The badge above the page still reads from 0** (the section pages report
   the lowest part's foot, not foot + 11). Making it read the span was
   weighed and not done, because every other height in the app measures
   from 0 and would then disagree with it:
   - the frame box the badge labels (`Canvas.tsx`, `height: frameH`) is
     drawn from 0, and the snap-to-foot aims at that same height;
   - the published site (`live/LiveSite.tsx:217`) draws the page as a box
     from 0 with `overflow: hidden`, and `live/reflow.ts:70` measures from 0.
     The badge's top 11px are not on the published page, just as they were
     not on the captured site: a browser cannot scroll above a document's
     top either;
   - `SitePreview` and the import cover animation (`ImportFlow.tsx:269`)
     size the page from 0.
   Changing only the number would make the badge claim a height that the
   frame, the preview and the published page do not have. Changing the page
   itself to start above 0 would move every one of those. Neither is done. A page that scrolls
   correctly and reports its height from its origin is the smaller problem.

6. **A Publish would overwrite the capture in sink.** Sink's `main` is both the
   store of the captured document (`site/document.json`, what Bring imports)
   and the owner's Publish target. A Publish writes the files `siteFiles`
   (`src/features/studio/agent.ts:578`) lists — `site/document.json` (his
   whole board as it stands), `site/BLUEPRINT.md` and `site/blueprint.json` —
   onto that branch. So one Publish replaces the captured document, and from
   then on Bring imports his board, not the capture: the `from.position` flags
   (sink 98355ca) and every capture-side fix go with it. **No publish has
   reached sink's `main` so far** (its commits, to 98355ca, are three uploads
   and the capture commits). The order that keeps the capture: land the
   capture, Bring it into a new site, publish last. The owner has been told;
   what Publish should do about it is his call, and nothing here changes it.
   **A second consequence: a Publish can bring back a fixed defect.** The grow
   step's fix keys on `from.position`, which on sink's pages the capture puts
   on the SOL WORKS badge's wrapper, not on the image; the sweep removes that
   wrapper as the image's twin, so a swept board has no wrapper. Until the
   survivor inherited the flag, such a board published to sink and brought
   back in reached the grow step as an unflagged image, and the header was
   grown round the badge again (`tests/twin-flag.mjs`, red on f961d1b). That
   hole is now closed in polio, but it is the sharper argument for a Publish
   guard: a publish writes the board as it stands, not as it was captured, and
   any fact the capture held that the board does not will be gone from sink.

7. **His wordmark reads "A SolWorksproject": no space before "project".**
   The first thing he showed, hours before any of this was diagnosed. The
   page reads "A Sol" "Works" " project": no space between the first two, one
   before the third ("Works" is a different face). The capture trims each
   element's own words (`capture-route.mjs`, `own()`), so no run carries the
   space the page had; the boxes butt (gap 0 at 1425), so the rejoin's gap
   rule puts none back either. `spans.ts` says it plainly: only the page
   knew, and the run must carry it. Not fixed by any half above: the capture
   must keep a run's edge whitespace. Measured on the board: 17 kept parts
   read "A SolWorksproject"; "Powered by GitBook" keeps its space.

8. **The twin keep rule threw away a button and kept its bare wrapper.**
   FIXED in polio `e98f7f1`. `twins.ts` ranked same-box twins on words, then
   drawings, then "the outermost, then the first". A twin that shows a
   surface of its own tied with a bare box. It now ranks words, drawings,
   WHAT SHOWS (a colour, a drawn edge, a texture, an aura), then the
   outermost. Reach, over sink's nine pages: 33 twins removed under both
   rules; the survivor changes in ONE stack today and NINE with the capture's
   button half. The one is live on his board: the Documentation search field
   (`n_box_647/648/649`) lost `n_box_649`, the input's box with its fill,
   hairline and inset, and kept a bare div. The nine are that plus the eight
   wallet buttons.
   **How it was caught, and the rule it leaves.** The capture half was about
   to be pushed with "0 duplicate-word buttons" in hand. A real-door import
   also read 101 buttons where there had been 109: the eight were gone, their
   fill and green edge with them. Reporting the part TOTAL beside the defect
   count was proposed as the guard, and rejected, because it would have
   missed exactly this: parts read 652 before and after. Only the kinds
   moved: box 243 → 251, cta-primary 109 → 101. **Verify by parts per kind,
   never a total** — a total hides a substitution, a breakdown cannot.
   `scripts/import-measure.mjs` prints it, per page and in all, beside the
   other three numbers we verify by: duplicate-word buttons, escapes, gap.

9. **720 parts in, 652 on the board: all 68 accounted for, by kind.**
   `scripts/import-measure.mjs` on `e98f7f1` with the capture's button half:
   box 33 and prose 35 lost, nothing else. The 33 boxes are the twin spares,
   none carrying words, a colour or an edge. The 35 prose are the pieces the
   sentence rejoin absorbs: "Works" ×17, "project" ×17, "GitBook" ×1, into
   its 18 kept parts. No part of any other kind is lost on import.
   Traced by id, not only by kind: each of the 35 is a sibling (same parent
   path) of one of the 18 parts the rejoin keeps, and its words are inside
   that kept part — 35 of 35. They are removed by `withJoins`, the
   `.filter((n) => !dropped.has(n.id))` at `store.ts:1260`.

10. **Any number read off a board depends on which pages have been drawn.**
   The healing runs when a page is opened, and it moves things. On sink, a
   section page nobody has opened since the import still has its header's
   inner box at the captured 16–65; opening the page lets that box take in
   the price line (16–85), and the logo's worst escape on the page drops
   from 63 to 43. Home is healed while the import lands, so it reads 43
   either way. Measured on polio `fb89923` with sink `5a0bc6d`: worst escape
   **63** with only home rendered, **43** with all nine opened; parts (652),
   parts per kind, duplicate-word buttons (0), escapes (16) and the gap (0 on
   all eight) the same in both. Two of us traded 43 against 63 for a round
   before this was named: neither measurement was wrong, the state was a
   hidden input. **A figure without the pages it was read after is not
   reproducible.** `scripts/import-measure.mjs` prints it on every run, opens
   every page by default, and reads the board as the import left it with
   `OPEN=none` — which is what a fresh import in a person's browser is until
   they visit each page.

10. **Centred text drew left of its part's centre.** FIXED, drawing only.
   "No PnL data available", "No tokens created yet" and "Launch your first
   token…" carry `text.align: "center"` and a 1457-wide box, both right. The
   words sit in a holder capped at the site's line length (`t.measurePx`,
   66 characters = 541px), and the holder sat at the part's left edge, so they
   were centred inside 541px: 456px left of the part's centre, on the board
   and on the live page. `parts/Text.tsx` now centres the capped holder
   (right-aligned text sits it right), as `Hero.tsx` already did. The cap is
   kept, so where a line wraps, and how tall the words are, does not change.
   `n_prose_54`: holder 541 wide before and after; its words' centre −456px
   from the part's centre before, +1 after. Over the fixture's 245 parts, only
   five centred paragraphs' words moved, sideways only; no stored box, no
   drawn part box, no left or unaligned text changed. `tests/centred-text.mjs`:
   8/10 on f35ac75, 10/10 with the fix.

11. **The header price wraps: "$ 116.59" and "-1.94 %". NOT FIXED: it is not
   a drawing fault, and the board has already stored its result.** Stopped
   by the coordinator's rule (stop if it reaches beyond drawing), measured on
   9bc39df with the fixture's home page.
   - **The capture's widths are right; its words are not.** `n_prose_92` was
     captured 59×20 and `n_prose_95` 43×16, one line each, in a 176×24 group.
     Measured in the site's own font stack (ui-monospace, "SF Mono", Menlo…):
     "$116.59", as the page drew it, is 59.3px; "-1.94%" is 43.4px. The
     capture wrote "$ 116.59" and "-1.94 %": one character wider each
     (67.8px, 50.6px). That is what wraps them.
   - **The space is made at capture time, in the capture itself.**
     `capture-route.mjs:123`, `own()`, joins an element's text nodes with
     `" "`. React renders "$" and the price as two text nodes, so one space
     appears that the page never drew. The same line then `.trim()`s each
     run, and that is the space LOST in "A SolWorksproject" (entry 7).
     One function, a space added here and one lost there. It is in the raw
     capture (`routes/page_home.json`: `text: "$ 116.59"`), before the
     converter or polio's rejoin touch it, so neither can undo it safely:
     after the join, nothing says whether a space was the page's. Fixing it
     at source (join text nodes with "", as the DOM already carries their
     own whitespace; keep edge spaces instead of trimming) needs a new
     capture, which is ruled out while it needs the wallet stand-in.
   - **The board stores the damage within seconds of opening.** A fresh
     import draws 59×40 and 43×32 at once (two lines), and the healing
     grows the stored boxes to match about 3s later: 92 → 59×40,
     95 → 43×32, `n_box_91` → 124×40, `n_box_93` → 57×32, `n_box_89` →
     176×44 (from 20, 16, 20, 16, 24). Healing is grow-only, so on his board
     those heights are in the document now. No drawing change can bring
     them back to 20 and 16. That needs a stored height changed, which the
     rule forbids.
   - **A drawing-only patch was possible and was not made.** "Draw a text
     part at least as wide as its words" would stop the wrap on a fresh
     import, but it would draw the wrong words ("$ 116.59", with the space)
     past its captured box by about 9px. It would also key on the machine's
     fallback font: the needed width was 57.9 and 50.1 in this container and
     62 and 46 on the coordinator's. The board's 2px left inset
     (`parts/Text.tsx`, `paddingLeft: max(2, …)`) takes 2 more off every
     plain paragraph's room. That is a real contributor, not the cause.
   **For whoever takes it:** the fix is the capture's `own()`. Then decide,
   with the owner, whether boards that already grew get their heights
   reset: a stored-height change, his call.
   **Later the same night: a safety net landed, and the box was tested as an
   arbiter.** The one-line rule (`parts/Text.tsx`, `tests/one-line-words.mjs`)
   now stops a text part one line tall from wrapping. It is a safety net
   (his rule: a box never arrives too small for its text), NOT this fix: the
   words still read "$ 116.59". His live site shows "$117.12 ↗+1.83%", with no
   space either side. The coordinator's machine: "$116.59" 54.2px, "$ 116.59"
   61.9 against a 59 box; "-1.94%" 39.6, "-1.94 %" 46.2 against 43. This
   container, whose fonts match the capture's ("$116.59" is 59.3 against 59):
   67.8 and 50.6 with the space. **Can the recorded box say which joins are
   wrong, with no recapture?** Measured over all 284 one-paragraph text parts
   on sink `5a0bc6d`'s nine pages, each at its own recorded font (the carried
   Press Start 2P where the part names it), against its box less padding
   and border:
   - 248 are one line tall. 33 of those are wider than their box: **16 by one
     space (1.04 and 1.06 spaces), every one the price pair on 8 pages**, and
     each fits once its single space goes. 16 more by under half a space
     (at most 2.9px, rounding and face), none with a space-shaped excess; one
     long sentence by 1.3 spaces that no single dropped space fixes.
   - **The dropped side is exact in the site's own face.** The wordmark
     pieces are 60, 60 and 96 wide; in Press Start 2P "A Sol" is 60.0,
     "Works" 60.0, "project" 84.0 and " project" 96.0. The box holds the
     space the trim took, to the pixel, on all 17 sets (Docs: 70/70/112 at
     14px, the same). Measured in a fallback face instead it is invisible.
   - **Where it is noise.** 136 fitting parts sit in boxes over five spaces
     wider than their words: blocks, not shrink-wrapped runs. "Narrower
     than its box" means nothing there. Only a run whose box hugs its words
     (an inline span) can say a space was dropped.
   So on this capture the box arbitrates cleanly in both directions, with a
   rule of: over by half to one and a half spaces AND fixed by dropping one
   space; or a shrink-wrapped run whose box is its words plus one space.
   Two conditions before anyone builds on it: it must be measured in the
   capture machine's fonts (the converter would need a browser to measure),
   and a multi-space text says a space is extra, not which one. Not built:
   the coordinator asked for the distribution first.
   **BUILT, in sink's converter** (sink `bbd8a72` check, `cc68d31` fix):
   `site/capture/join-arbiter.mjs` measures each one-line text part in the
   faces the document carries, in a browser on the machine converting.
   One space too wide with a single space in it: the space goes. Exactly one
   space short with a run touching it on one side: the space comes back on
   that side. Anything else is kept as captured and noted in the ledger,
   which also records the machine's metrics on every run ("$116.59" 59.3px
   here against the recorded 59). Regenerated from the same captures, 33
   contents change and nothing else: "$ 116.59" -> "$116.59" (x6, and
   "$ 116.70" -> "$116.70" x2), "-1.94 %" -> "-1.94%" (x6, and "-1.85 %" ->
   "-1.85%" x2), "project" -> " project" (x17). The one case left is the
   Cleanup warning sentence: 20 spaces, and the box cannot say which is
   extra. In the Builder the wordmark draws "A SolWorks project" and the price
   "$116.59". Boards imported before this keep the old words until they are
   brought in again.

   **The one-line guard was OVERRULED, on purpose.** The one-line safety net
   (`parts/Text.tsx`, polio `199e1ce`) moves 191 of 245 parts on a fresh
   import of the fixture compared with trunk, against a guard that said
   nothing else may move. The coordinator overruled that guard: every one
   of the 191 lands CLOSER to its captured box and none further, and the
   parts sitting exactly on their captured box go from **42 to 66**. It is
   the same defect fixed in more places: the wrap was growing the stat
   labels ("Total PnL") and, through them, the header band and everything
   below it. If you see 191 parts move and wonder why, this is why. Do not
   revert it without that measurement.

12. **An imported site's colour roles were the app's, not the site's, and moved
   nothing.** FIXED at import (`paletteFrom.ts`, called from `copySite` in
   `FromASite.tsx` after the sweep). Sink's document named two roles, the
   page and the body's white text; the other four came from the app's default
   hue, and the pink highlight was that hue turned 62 degrees. And every part
   carried a fixed colour, so moving a role moved only the gaps between
   sections. Now the six are picked off the swept board (neutrals, chroma
   under 0.005, never compete for a text role; the accent is the colour the
   most parts wear across every role and the edges), every part colour that
   is exactly a role's is written as the role's name, and the Colour panel
   says under each role how many parts follow it or "none". Measured with
   sink: 463 of 629 colour slots linked; bg 27 parts, surface 23, text 171,
   muted 17, accent 128, highlight 24; every page byte-identical to the
   build before (0 px on all nine). `tests/palette-import.mjs`.
   **One trap left for whoever moves `SWEEP`:** the sweep's `repaint` reads a
   control's ink as an rgb colour to mix, and skips one it cannot parse. The
   linking runs after the sweep for exactly that reason. A later bump of
   `SWEEP` re-runs the sweep over role names, and `repaint` would then skip
   controls it used to repaint. Resolve role names through the palette in
   `repaint.ts` before bumping it.

**One idea under two of these, met once here:** a check can read correct
because the evidence left rather than because the fault did. A duplicate
count went to 0 when eight wallet buttons were deleted rather than
de-duplicated, and a published board can drop a flag the capture held and
look clean for it. Before trusting a zero, count the parts it was measured on.

## 6b. The sentence holes, folded (sink `e353246` check, `85b5100` fix)

**The contract moved, on purpose. Read 637 as folds, not parts lost.**

| fresh import, new site, only page_home rendered (OPEN=none) | old (sink 81aa13d) | new (sink 85b5100) |
|---|---|---|
| parts on the board | 652 | **637** |
| box / cta-primary / drawn-icon / picture / value-prop | 243 / 109 / 132 / 20 / 22 | 243 / 109 / 132 / 20 / 22 |
| prose | 126 | **111** |
| duplicate-word buttons | 0 | 0 |
| wordless buttons (every page opened) | 8 | 8 |
| escapes | 16 (worst 63) | 16 (worst 63) |
| gap, eight footer pages | 0 | 0 |
| prose lost on import (rejoin) | 35 | 19 |
| parts whose words are runs | 18 | 25 |

**The 15 are folds.** 31 prose parts that were the elements inside 15 sentences
are now runs of those sentences, and every one's words are in its sentence
(31 of 31, checked word for word). Nothing else in the document changed:
15 contents and 8 labels, 0 boxes. The 15:

| sentence | before | after |
|---|---|---|
| home `n_prose_55` | Launch your first token on to see PnL tracking here | Launch your first token on **pump.fun** to see PnL tracking here |
| footer x8 (`n_prose_115` …) | v2.0.0 \| | v2.0.0 \| **A SolWorks project** |
| nfts, cnfts, lp (`n_prose_280/356/503`) | It may be in the tab accessed … | It may be in the **"Unknown"** tab accessed … |
| docs `n_valueprop_693` | Burn Tokens. Reclaim SOL. | **🔥** Burn Tokens. Reclaim SOL. |
| docs `n_prose_706` | With built-in , instantly swap … | With built-in **Jupiter DEX integration**, instantly swap … |
| docs `n_valueprop_709` | Ready to Reclaim Your SOL | **❓** Ready to Reclaim Your SOL |

pump.fun is a run with its own green and its link (`https://pump.fun/`).
**Where** each element goes is measured: the one place where the sentence, in
its own face, puts the element at its recorded x within a quarter of a space
(+0.1px for pump.fun). **The spacing either side** is measured for the 8
footers and is **CONVENTION** for 7, recorded per sentence in sink's ledger,
because the box cannot tell the readings apart: on a centred line two
missing spaces shorten it by two and move its start right by exactly one,
so "on pump.fun to" and "onpump.funto" put the link at the same x; and the
space after an element in a left-set line moves nothing recorded. The
convention: a space between words, none before punctuation. The seven
chosen strings are the pump.fun, three "Unknown", Jupiter, 🔥 and ❓ lines
above.

**On the board** (every page opened) 78 parts sit differently from the old
import, **every one closer to its captured box, none further** (52 box, 16
prose, 5 cta-primary, 4 drawn-icon, 1 value-prop). The old import grew the
holed sentences round their missing words (pump.fun's 20 -> 24, each footer
16 -> 20, Jupiter 52 -> 78) and pushed what was below them down; the fold
removes the cause. The 15 keep their x and width; their heights come back
toward the capture.

**"[object Object]": MEASURED AND ABSENT, no fix written.** Entry 3 above says
18. On a fresh import of sink 81aa13d with every page opened in turn: 0 drawn
on any page, 0 in the stored document, 0 on the live page of every page. The
18 parts whose words are runs all draw correctly; everything that reads
content reads runs (a part is handed plain words and the runs separately,
`blocks.tsx`). It went with the join work. Nobody needs to go looking.

**One measurement, two numbers.** The grow-on-edit (`fbf4417`) took his
wordmark from 216 to **229** in my harness; the coordinator, doing it by hand
on the live site, measured **228**. The space is 12.02px here and the
growth rounds up to the whole pixel; the live browser's metrics round
differently. Both are real; neither is corrected to the other.

## 7. Open, written down, not started

1. **Publishing a site from the capture: which sizing rules could a capture
   supply, and which can nobody supply?** Measured on sink `5a0bc6d` (same
   figures as `98355ca`): 223 of 720 parts carry the `layout` the browser
   computed (222 flex, 1 grid, the home stat row, kept as `columns: 4`);
   148 more are block containers, where no layout field means normal flow,
   71 of them holding two or more parts directly; 349 are leaves. Below the page
   shell the selector tree has no gaps: every part's parent element is a part,
   except the 34 top-level bands. So **the structure is there to rebuild this
   site at the width it was captured; how it adapts to other widths was never
   captured.** A flex row arranges its children but every child is a fixed
   pixel box, so nothing grows or shrinks to fill. What is missing falls in
   three tiers, and the tier decides who can close it:
   - **Captured, not carried. Converter work, no recapture.** Every
     element's margins, max-width and min-height; the fixed bands' insets and
     z-index; the page shell's own flex column (`body > div`, "the page is
     not a part"); the grid's track widths (the converter keeps only their
     count). All in `site/capture/routes/*.json`, all "nowhere" in
     `ledger.txt`.
   - **Exposed by the browser, never recorded. Needs a new capture.**
     `getComputedStyle` gives flex-grow, flex-shrink and flex-basis: "this
     column takes the remaining space" is readable, and the capture never
     asked. Authored rules (widths in %, `1fr` tracks, `@media` breakpoints)
     are not in computed style but are in the page's stylesheets when they
     are served from the site's own domain, and the capture already reads
     those sheets for `@font-face`. Or measure it instead: capture at two or
     three widths and compare. **Every recapture uses the wallet stand-in, which
     is ruled out.** That ruling, not the browser, is what this tier waits on.
   - **Not knowable from outside.** Layout decided in JavaScript (a
     component that renders a different tree on a phone), and behaviour that
     depends on data the stand-in does not have.
   NOT verified: whether his stylesheets contain breakpoints at all. The
   capture recorded the sheet's address (`look.fonts[].from.sheet`);
   fetching it is a request to his live site and is his call. Not done.
   Neither blueprint file carries `layout`: they cannot be rendered into this
   site (flat rows, no nesting, "left of/right of" is only reading order).

2. **The Publish and Bring guards: unbuilt, and the owner has not ruled.**
   A Publish writes the board over sink's captured document (entry 6 of §6);
   a Bring after that imports his board, not the capture, and any fact the
   capture held that the board does not is gone. What either should do,
   refuse, warn, or write elsewhere, is his decision. Nothing is built.
