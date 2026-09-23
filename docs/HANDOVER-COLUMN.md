# Handover: the sidebar column, and everything around it

Written at the end of the session that built the sweep. **Uncommitted on
purpose** — the branch has gone to the merge chat and nothing further was
pushed. The durable copy is in the chat transcript.

Strictly separated below: **PROVED** (I measured it, with a red proof),
**HIS** (the coordinator measured it on his document — I never had it),
**BELIEVED** (reasoning I did not close).

---

## 0. The limitation that shaped everything

**I never had his board.** Not once, all night. Every number I produced myself
came from `sink/site/document.json` — 126 nodes, one page — or from fixtures I
built to his reported shapes. Every number about his nine pages came from the
coordinator running their own measure.

`sink` is **not a stand-in**, and the divergences are large:

| | sink | his board |
|---|---|---|
| size | 126 nodes, 1 page | 631 nodes, 9 pages |
| wrappers adrift | 1.6% | 5.5% (3× worse) |
| empty wrappers | 0 by geometry | 5 on home alone |
| label duplication | **0 instances** | at least one |
| the column rail | 256×1282, reaches the footer | 256×528, ~1100px short |

That last row matters most for the column. **My "outer rail reaching the
footer" reading is a sink fact, not his.** On his board *neither* column box
reaches the footer. Do not inherit my confidence there.

Also from the coordinator: applying `fitWrappers` to sink changes 56 heights,
leaves the banner at 82 and leaves `n_box_76` — nothing like his board.

`scripts/wrappers-report.mjs <document.json>` prints the whole measurement for
any document. **Get his document and run it before building anything.**

---

## 1. The healing — the finding that reversed a conclusion

I told the coordinator twice that shrinking wrappers could never close gaps
because the healing is monotone. **The healing is monotone and the conclusion
was wrong.**

**PROVED** (`tests/wrapper-heals.mjs`, 7/7, production build, on a fixture at
his shape — *not* his document):

Banner 1763×82 at y 0, logo it owns overflowing to y −11.

- **Left alone:** the healing sees a box overlapping a part and clears it the
  only way it can — downward. `y 0 → 101`. Every part below moves +101.
  **An 11px overhang becomes 101px of dead space.**
- **Grown first:** the healing moves **nothing**, and the page is **101px
  shorter**.

So the healing is not the obstacle. It is the **amplifier**. Repositioning
does not need the healing to pull anything back; it removes the reason it
pushed.

And the two cannot fight: the correction only lifts or grows, the healing only
pushes down to clear an overlap, and the correction's purpose is to stop the
overlap existing.

**BELIEVED:** that this is why his banner sits at y 147 with its header above
it. The mechanism is proved on a fixture; I never ran it on his document.

---

## 2. Why the naive wrapper rule is wrong — do not rediscover this

"Put the wrapper where the parts it owns are" — replace its box with theirs.

**PROVED**, on sink's real document:

| | wrappers |
|---|---|
| naive rule flags | **31** of 126 |
| … would move **down** | 27 |
| … would **shrink** | 29 |
| grow-only flags | **2** |

Twenty-seven moving *down* is the tell. Replacing a wrapper's box with its
contents' box **strips its padding**: a box with 25px of it reads as 25px
adrift and 50px too tall. **29 of the 31 are padding, not drift.**

Grow-only — keep the wrapper's own box, take in what escaped, never shrink —
is 15× more selective and lands exactly on the fault. The shrink guard in
`grownTo` is a **guard, not a preference**, and it is red-proved.

**Never widen this.** 29-in-31 is the number to remember.

---

## 3. The three buckets, and which reader each lives in

| bucket | symptom | reader | status |
|---|---|---|---|
| **same box** | 24 duplicate panels and rails | `offered` in `zipImport.ts` re-admitted twins; `pageBlocks` had deduped correctly and `offered` threw it away | **fixed** + retrofit (`twins.ts`) |
| **same words, different box** | duplicated button label | `CANDIDATES` in `siteRead.ts` — its own dedupe key is `WxH:words`, so it only matches boxes of the same *size*, which is the case `pageBlocks` already catches | **diagnosed, not fixed** |
| **the state fault** | split link, words missing mid-sentence | not structural at all | **diagnosed, not fixable from here** |

**PROVED** for bucket 2: a row containing a button, both carrying the same
words, comes out as `#row 940×84` and `#burn 300×44`, both offered. Neither
the box dedupe nor the `offered` fix can reach it — two parts inside one
cannot both be box-identical to it. **A new capture gets this wrong too.**

**PROVED** for bucket 3 (`tests/said-twice.mjs`): six markups through the real
reader. Inline, inline-block, absolutely positioned 700px away, and
`display: contents` **all keep the words**. Only `display: none` and
`visibility: hidden` produce his string character for character — the link not
being drawn *at the moment the sentence was read*.

**BELIEVED:** that a scroll-reveal or entrance animation is what put it in
that state. Unproven and not settleable without his page.

---

## 4. The words-dedupe, scoped as two pieces

**Piece one — the converter.** Change `CANDIDATES`' key to dedupe on words
alone, and pick the survivor by the rule that already worked twice: keep the
thing that **is** a control (a `button`, `role="button"`, or carrying a link)
over the container that merely repeats its words; failing that the outer, as
the existing comment already intends. One key, one comparator, plus a test on
the pair already reproduced. **New captures only.** ~an afternoon.

**Piece two — the retrofit.** A node-side pass, its own file, same shape as
`twins`: parts whose words are wholly inside another part's words *and* whose
box is inside it; keep the control; prove the survivor remains.

> **Do not write piece two before measuring its false-positive rate on his
> board.** "Words contained in words" is far looser than "same box" — a
> heading repeated in a card, a label that happens to match. It should flag
> about 1 pair per page. If it flags 20, the rule is wrong. ~a day,
> front-loaded on measurement.

---

## 5. The column

**HIS** (coordinator's measurements):

- page_home: column boxes end at y 660 and 760; footer starts 1791; page runs
  to 1864. Eight entries span 236–644. **Over 1000px short.**
- page_tokens: column ends 513, footer 1354, entries span 89–497. ~840 short.
- page_docs numbers exist but their footer identification is unreliable —
  treat only home and tokens as solid.
- Every page has two column boxes, 255 and 256 wide at the same x and y. On
  page_home they are 528 and 431 tall; on page_tokens both 440.

**PROVED** (on sink, which differs — see §0):

- Both column boxes have **zero escaping children**. Grow-only touches
  neither, and `grownTo` returns null for both. **The column will not be
  solved by repositioning.**
- The 255/256 pair is a genuine outer/inner pair, not duplicates. `twins`
  correctly declines them where they differ in height (97px apart on his
  page_home), because removing one would be choosing a height nothing knows.
  **It will not be solved by deduplication either.**

### What I would look at first

1. **Get the raw capture, not the document.** `sink/site/capture/` holds a
   `ccc-capture.json` with every element's rect as the browser reported it.
   The single decisive question: **was the rail short in the capture, or did
   it become short afterwards?** That splits the investigation in half and
   costs one script.
2. If it was short in the capture, the suspect is the same `MEASURE` growth
   that causes the wrapper fault, in the other direction — a rail that is
   `height: 100%` of a flex row gets a tall rect from the browser, so
   something read it before layout settled or read a different element.
   `tests/wrapper-below.mjs` already isolates the three growth limits and is
   the place to add a fourth case.
3. If it was tall in the capture and short in the document, the fault is in
   the converter between them, and `pageBlocks`' wrapper-opening loop (which
   *replaces* a block by what it holds) is the first thing to read.
4. **Do not assume the rail should reach the footer.** That is sink's shape.
   Check his reference image before treating "short" as the defect.

---

## 6. Traps that cost real time

**A `SWEEP` bump has now broken something five times.** Four were fixtures
(`grew-moves`, `boxes-fit`, `badge-selected`, `old-board`) whose boards were
marked with a hard-coded number so the sweep would stand aside; the fifth was
`wrapper-heals`, and it exposed a **real defect** — the skip was
`swept === SWEEP`, so a document swept by a *newer* build read as never-swept
and got swept again. Now `>= SWEEP`.

> **Fixtures must import `SWEEP` from the source, never hard-code it.**

**The dedupe must read the document as SAVED, never the output of another
pass.** His page_home column pair is 528 and 431, one containing the other —
so the fitting shrinks 528 → 431, and at that instant the two *are* the same
box. The dedupe then deleted a node on the strength of a height **my own code
had chosen**. The rule that came out of it:

> A **deletion** may only ever be justified by something the capture said.
> Recomputing a **height** from corrected geometry is not the same act.

That is why `grownTo` may run before the fitting and `twins` may not.

**Empty wrappers are misplaced, not junk.** The sweep used to delete them.
Both of the two on his home page are real surfaces that slid below their own
contents — deleting them takes his banner and his panel off the page. Removal
is **gone from the wrapper pass entirely**, not conditioned, so nobody can
re-enable it by getting a condition wrong.

**Two `next start` processes share one `.next`.** Rebuild while one is running
and it serves a stale chunk manifest — the app dies with `ChunkLoadError` and
every measurement is garbage. This invalidated two red proofs I nearly
reported as findings. Use
`scratchpad/serve.sh`: build, kill, **verify the ports are free**, start, then
fetch a chunk to confirm.

**Tests can be vacuous and look green.** Three of mine were:
- `reader-space` v1 put its runs in one block, where the reader's older glue
  path already joined them — it passed with the fix reverted.
- the path-separator guard fixture used `nth-of-type(1)` vs `nth-of-type(11)`,
  which cannot collide because the bracket separates them. The reachable case
  is `p` against `pre`.
- the depth fixture used normal-flow content, which makes its parent tall
  anyway. Isolating depth needs real overflow.

**Run every new check red on purpose.** It is the only reason the above were
caught.

**A pass that edits shared fixtures is dangerous in proportion to how green
its own suite is.** Four times the thing that caught my fault was another
lane's test, never mine.

---

## 7. Where things stand

Branch `claude/busy-thompson-3hna0t`, last commit `30cf385`, with the merge
chat. On the sweep (`sweepDocument`, `SWEEP = 4`, one undo, once per document,
every page, hand-placed exempt, captured boards only):

1. sentences rejoined · 2. wrappers grown to hold what they own · 3. wrappers
fitted · 4. active controls repainted · 5. duplicate boxes removed · empty
wrappers **reported and never touched**.

Suite green: sweep-on-open 41/41, owns 29/29, twins 20/20, reassemble 53/53,
repaint 38/38, wrapper-heals 7/7, wrapper-below 9/9, said-twice 11/11,
old-board 12/12, boxes-fit 13/13, plus the rest.

Open, in the order I would take them: **the column**, the words-dedupe (two
pieces), the stacked header row (`n_box_47`, owns 5, 1 escaping, wants 37px),
the split link. `box-fields` fails two checks and arrived with the chrome
lane's merge — not this work's.
