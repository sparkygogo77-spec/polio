# Runs inside a sentence — the shape

**The contract.** (Written for Fable; the capture lane is retired and the emitting side is ours now.) It is defined here and not negotiated in
a chat: build against it, and if something in it cannot be measured, say which
field and why rather than emitting an approximation.

## What is broken

On his site one sentence reads *"Launch your first token on pump.fun to see PnL
tracking here"* — centred, with pump.fun in its own green. On the board that
sentence is two parts: the words with a hole where the link was, and pump.fun
floating separately. The centring is ruined because neither piece knows it
belongs to a sentence.

The cause is one line: **a node's text is a flat string.** A run of
differently coloured or linked words inside a sentence cannot be held at all,
so the only way to keep it has been to break the sentence apart.

## The shape

```ts
/**
 * A stretch of a node's words that carries its own look.
 *
 * Everything but `text` is optional, and absent means "whatever the part
 * would have drawn anyway". A span never carries a size, a family or a
 * line-height: those belong to the node (`NodeFont`), because a sentence is
 * set in one face at one size and it is the ink inside it that varies.
 */
export interface Span {
  /** The words. Never empty — a span with no words is not emitted. */
  text: string;
  /**
   * A colour literal as the browser reports it (`rgb(…)` / `rgba(…)`), or
   * the name of one of the six palette roles. Resolved exactly as
   * `NodeEdge.colour` is: a role name follows the site, a literal does not.
   */
  colour?: string;
  /** 300..800, and only when it differs from the run around it. */
  weight?: number;
  italic?: boolean;
  /** Where these words go. The same `NodeLink` every other part uses. */
  link?: NodeLink;
}

/** What a node's words are. A plain string is one unstyled span. */
export type Words = string | Span[];
```

`StudioNode.content` becomes `Words`. One normaliser — `spansOf(content):
Span[]` — is the only thing that ever reads it raw; a string becomes a single
span with nothing set.

## The four rules that go with it

1. **A plain string stays valid, permanently.** Every saved document has
   `content: string`, `items()` splits it, and twenty-odd parts read it. The
   union plus the normaliser means no migration and no risk to existing
   boards, and a part that has not learned spans yet can call
   `spansOf(c).map(s => s.text).join("")` and behave exactly as it does today.
   This is not a transition state to be cleaned up later.

2. **A span never straddles a newline.** `items()` splits content on commas
   and newlines, and a span boundary is not a line boundary. Emit spans that
   sit *within* one item; splitting runs per-item over spans is what stops
   "for the builders, believers, and bold thinkers" becoming three paragraphs
   again.

3. **Do not emit a span that says nothing.** A run whose colour, weight,
   italic and link all match the element's own is part of the run beside it.
   Merge adjacent spans that carry identical fields before emitting. A
   sentence with one green word is two or three spans, never eleven.

4. **Whitespace belongs to the span that carries it.** Keep the exact
   spacing of the original text node — leading and trailing spaces included —
   so `spansOf(...).map(s => s.text).join("")` reconstructs the sentence
   character for character. Do not trim.

## What it does not change

Nothing here touches the growth work or the button work. It is the node, the
renderer and the inspector on this side; recording and emitting the runs on
yours.

## Order

Two commits, and the import half ships first: the node shape, the normaliser
and the renderer are the risky half and they unblock his page on their own —
his sentence comes back as one part, centred, with pump.fun green inside it.
Selecting a word in the inspector and colouring it is an independent surface
that cannot regress the import, and holding the first behind the second buys
nothing. If this shape is right, the second commit adds no types at all.


---

## Where it stands

**Landed: the node shape and the normaliser.** `parts/spans.ts` holds `Span`,
`Words`, `spansOf`, `plain`, `merged`, `alike` and `lines`, and
`StudioNode.content` is `Words`. Widening that type is what found every place
that read content raw — eleven of them — and each now goes through `plain()`.
Parts are untouched: `blocks.tsx` hands each one `content` as the plain string
exactly as before and `spans` beside it only when the node carries runs, which
is what makes a plain string permanently valid rather than a migration waiting
to happen. Proved a no-op: the whole suite green and the twenty-nine
hand-placed buttons byte-identical.

`tests/spans-hold.mjs` is pure — `node --experimental-strip-types
tests/spans-hold.mjs`, no browser, no build — and holds both rules of the
contract. Run red first by removing the merge and the newline cut: 7 red.

**Landed: the renderer.** `parts/Runs.tsx` draws a run sequence as inline
spans — no block, no wrapper, nothing that could introduce a break the
browser would not have made, so what decides where a line breaks is the
browser reading one continuous run of inline content, exactly as on the page
it came from. A run that says nothing gets no element at all, which is what
keeps a plain string setting byte for byte as before. A colour names one of
the six roles or is his own literal, resolved off the THEME rather than a
palette so a run naming "accent" follows the part it is inside and `parts/`
stays self-contained. A run that points somewhere carries one marker on both
surfaces: words on the board, pressable live. `PlainBox` and `Prose` read
runs; `Prose`'s drop-cap, kinetic and highlight modes take a paragraph apart
by character and by word, so they keep exactly the branch they had.

`tests/runs-draw.mjs` holds his two cases at 17/17 and asks the browser how
many line boxes the words occupy rather than counting markup. Run red by
giving each run `display: block` — the fragmentation this replaces — it
reports 6 line boxes where there should be 1, his symptom exactly, while the
colour and face checks stay green. That is why the line-box count is the
check and colour alone is not.

**Landed: the emitter.** `reassemble.ts` is pure and holds the rules:
`sentences()` finds wordy parts sitting on one line, close enough to the next
to have been one sentence, and returns the runs plus the box. Wired into the
copy-whole import — his door, where the fragments are already written into the
published document, so teaching only the reader would have done nothing for
the board he is looking at — and offered as a palette command for a board
already open. One undo for the whole rebuild.

The one inference is named: the capture threw the whitespace away when it
split the sentence, so the GAP decides whether a space belonged there. Half a
space width, judged against the type size rather than a flat pixel count,
which is what tells "A Sol" + "Works" from "$" + "118.35".

`tests/reassemble.mjs` is pure (22/22) and each contract rule was run red on
its own: no merge gives 5 runs where there should be 1; no space inference
gives "A SolWorksproject"; allowing newlines in joins across a line.
`tests/sentence-back.mjs` (12/12) runs it end to end through the palette.

**Known residue, and it is not this piece.** A reassembled sentence sits on
ONE line when its box has the room its words need here, and still wraps at the
width the capture recorded — because the merged box is the sum of the
fragments' own widths and those were measured on HIS machine, where the face
is narrower. That is the +9-per-heading residue at sentence scale, and it is
the sideways-growth piece. The test measures both and says which is which.

**Still to do: the inspector half** — select a word, colour it — which is its
own commit and needs no new types.

**His hand-corrections are replaced, by his ruling.** He extended and moved
these boxes working around this bug, and said plainly he wants the correct
result rather than his patches kept. So a fragment group merges whatever its
parts are marked, the merged box takes the geometry the capture recorded
rather than where he dragged it, and every hand-moved part replaced is
reported by name. The `byHand` exemption is overruled INSIDE a runs rebuild
only — a part he moved that is not in a sentence being reassembled still
stays where he put it.

---

## Three fixes after the emitter landed

Measured on trunk `90560a8`, on his board, and each one run red on purpose
before it was trusted. The numbers about his page are the coordinator's
measurements, not mine.

### 1. The lost space — "A SolWorksproject"

The header is **one node with three runs** and reads back with no spaces at
all. Where the space went: the reader trimmed every run's edges
(`raw.replace(/\s+/g," ").trim()`) before anything downstream could see them,
and the boxes butt, so no gap could recover it either.

**It cannot be fixed at the join.** "Sol|Works" takes no space and
"Works|project" takes one; both boundaries are letter against letter at gap
zero. No rule reading only the text or only the geometry can tell them apart.
Only the page knew.

So it is fixed at the reading, in `siteRead.ts`, under three rules — and they
are the browser's, not ours:

- **A space belongs to the run AFTER it, never to the one before.** Written
  down exactly once, so two fragments cannot each claim it and rejoin with a
  double space. Nothing carries a trailing space.
- **Only if the page RENDERS one there.** Whitespace at the edge of a line is
  collapsed away by CSS. A headline indented in the markup —
  `"\n  Everything arrives somewhere\n"` — has no space in front of it, and an
  earlier version of this fix that kept edges blindly put one in front of
  every heading on every hand-written page. That was caught by
  `tests/site-read.mjs`, which went from 56/56 to 55/56.
- **Asked of the LINE, not of the element being read.** A fragment read on its
  own cannot see what is beside it, and being beside something is the whole
  point. `spaceBefore` walks the text nodes of the run's own block, skipping
  nested blocks, and finds the nearest ink before it.

`recreate.ts`'s `lines()` stopped trimming when there is only one item, since
then the item IS the part's whole text and its edges are the page's.
`reassemble.ts` believes a carried space over any guess: no second space is
inferred from the gap beside one that is already there.

`tests/reader-space.mjs` (13/13) round-trips a sentence whose runs are
separated by spaces at both ends of a run boundary, against a real DOM through
the real `MEASURE`. Three red proofs, one per rule: trimming edges again gives
back `"A SolWorksproject"` exactly; asking the element rather than the line
loses the space that lives between two fragments; counting line-start
whitespace puts a space in front of the indented headline.

*An earlier version of this test was **vacuous** — its fixture put the runs in
one block, where the reader's older glue path already joined them, so the
changed line was never reached and it passed with the fix reverted. It is
rebuilt on separate elements read separately, which is the real case.*

### 2. The price line that never grouped

`n_prose_92` "$ 116.59" and `n_prose_95` "-1.94 %", 81px apart start-to-start
and **22px** edge-to-edge, did not merge. Measured rather than assumed: the old
limit was `spaceAt(last) * gapMax * 4`, and `spaceAt` is derived from a **type
size the capture often does not record**. With no size it collapses to its 2px
floor, giving 14.4px; with one it gave 20.7px. So the cut sat between one and
eight pixels away from a gap that is plainly a word space.

A box's own **height** is the honest proxy — always recorded, and it scales
with the type the way a word space does:

```ts
function joinLimit(a: Frag, b: Frag): number {
  return Math.max(spaceAt(a) * 4, Math.min(a.h, b.h) * 0.75);
}
```

At his scale (32-tall boxes) the limit falls at **43px**: 43 joins, 44 does
not, and his 22 is inside it with room rather than one pixel from the cut.
Neighbours that are genuinely separate are still separate — a control 400px
along the same line, and `n_ctaprimary_59`, which sits 139px below and shares
no band of the page, so it is a column jump and not a gap in a sentence.

### 3. Empty captured wrappers — collapsed on load, not dropped at capture

**The decision, and why.** Two things settled it, and neither is a pixel
count:

- **Capture-time recovers nothing he can see.** His board is already written
  down — 720 nodes across nine pages, published from an earlier capture. A
  capture-time rule fixes the next page he takes and does exactly nothing for
  the board he is looking at. That is the same reason `reassemble.ts` exists
  at all rather than being a reader change.
- **"Drop the empty ones" would walk past the part he clicked on.** `n_box_75`
  is 1763x82, claims one child, and geometrically holds exactly one thing:
  `n_box_76`, the 1280x49 box that claims three and holds nothing. A chain —
  banner, into an empty div, into nothing. The banner is **not empty**; it
  carries 33px of dead space under its only child. The footer `n_box_109` is
  the same fault mirrored: 1763x73, claims one, holds five.

The claim count and the geometry disagree in **both** directions, which says
they come from different passes and one of them is wrong. So `slimWrappers`
trusts neither claim and asks where the boxes actually are, as every other
rule in that file does. A wrapper holding nothing is removed; one holding
something is fitted to its lowest child plus whatever foot padding the capture
recorded.

**Only the bottom is ever trimmed, never the top.** Shrinking a box moves
nothing; lifting one would, and lifting is the direction that puts a part
where nobody placed it.

**Two things are never removed**, both because removal is the one direction
that cannot be undone by looking at the page:

- A wrapper **his hand** placed or resized — not fitted either. Its size is
  his answer, exactly as with the button and the healing.
- A wrapper that shows a **surface of its own** — a background, an edge, a
  texture, an aura. It looks empty only from the outside, and dropping it
  takes a coloured band off the page. Fitting one is still fine.

Containment is **within one page**: every page starts at 0,0 again, so without
that check a box on page two makes a box on page one look full.

**And a finding that limits what this can do:** shrinking wrappers alone will
not close the gaps between parts. Positions are absolute and the healing is
monotone — it pushes things down when something grows and never pulls them
back up. Giving a box back its height gives back the height; it does not move
what sits below it. Closing those gaps is a separate piece and is not
authorised here.

`tests/reassemble.mjs` is pure (53/53) and `tests/boxes-fit.mjs` (13/13) runs
it end to end through the palette against a production build. Red proofs, each
on its own: the old distance rule puts his price line back to 0 sentences;
removing the carried-space preference gives `"left  right"`; dropping the hand
exemption touches his box; dropping the surface guard removes the coloured
band; dropping the page check joins two pages; and disabling each half of the
store action in turn fails exactly the checks that half is responsible for.

---

## The sweep on open, and why it was needed

All three fixes above landed, merged, deployed — and his board did not move by
a byte. Same 685 nodes, same seventeen "A SolWorksproject", same 45 wrappers,
same 293px. Green suite, clean merge, confirmed deploy, unchanged page: the
exact shape of a fix that works on the path it tests and never reaches the
user's data.

**The answer, measured rather than reasoned.** `joinSentences` and
`fitWrappers` have exactly two callers each — the copy-whole import and their
palette commands. `onRehydrateStorage` calls neither. `MEASURE` runs only
inside a browser against a live page. So: nothing ran when a stored board was
opened. `tests/old-board.mjs` is the check that was missing — it seeds a board
the old code wrote, presses **nothing**, and asserts what a load does and does
not do.

**Item one is unrecoverable from inside polio, and a re-import will not fix
it.** The space was destroyed at reading time, before the document existed,
and `Runs.tsx` emits adjacent spans — so the published page reads
"A SolWorksproject" too, and re-reading anything polio published gives the
damage back. Only a fresh capture of the original source site restores it.

**Items two and three did reach his board, by command — and only the open
page's worth was visible**, because nine pages of two presses is a chore
rather than a fix. So the sweep runs on open: every page, one checkpoint,
once. Note that the commands were never page-scoped; a three-page fixture
swept all three. What IS page-scoped is the healing, which runs only for the
page on screen — which is why the sweep runs BEFORE it, so every page is
judged by the same captured heights instead of the open one being judged by
settled ones.

**And the publish question is answered: there is no second defect.** A space
inside a run survives the board, the live preview and the published page —
`>$ 116.59 <span style="color: rgb(239, 68, 68);">-1.94 %</span>` is what
ships. Red-proved by trimming each run in `Runs.tsx`, which gives
`"$ 116.59-1.94 %"` in all three places.

## The paint a capture dropped

The capture could not read `oklab()`, so the translucent tint that marks an
active control was dropped and the node arrived as an outline where the page
had a solid. The other lane fixed the reading; that reaches a new capture and
nothing on a board already written down.

**My first predicate was wrong, and it would have failed silently.** It looked
for the tint's colour in the node's `accent` and required a painted box
behind it. On the second measured case, the docs sidebar's "Burn Tokens"
entry, both are absent: it carries no accent at all, only `colour.text`, and
every box behind it has `colour: null`. It would have corrected one page and
skipped the other without saying so.

**The signal that does hold** is the one his sidebar makes obvious:

> In a set of choices, the active one is the one whose ink differs from the
> ink the rest agree on.

Twelve of thirteen docs entries share one muted `oklch()`; the thirteenth is
the accent. Five of six time buttons share one dim white; the sixth is the
accent. Written as "differs from what the others share" and never as "equals
the green", so it survives a different accent and does not grab text that is
green by design. Comparison is by string, so the inactive `oklch()` needs no
parsing.

It also predicts the page it was not fitted to: on his home page every
sidebar entry is grey, so it finds **no** active entry there — which is what
his reference shows, and it is where an earlier guess (that "Cleanup" was
highlighted) was wrong. One on docs, zero on home, agreeing with the real site
on both.

So three of the four things the browser used survive: the tint's colour (the
node's own ink), what it was laid over (the innermost containing box that
paints a surface, or **the page's own background** when none does), and which
node it is. Only the opacity is gone: `TINT = 0.1`.

    rgb(0, 255, 0) at a tenth over rgb(21, 25, 34) = rgb(19, 48, 31)   the time button
    rgb(0, 255, 0) at a tenth over rgb(16, 21, 26) = rgb(14, 44, 23)   the docs entry

Both are the values the other lane arrived at independently by re-reading the
capture. Two routes, two numbers, no ids. Run over the committed
`sink/site/document.json` the rule finds exactly one node, `n_ctaprimary_34`,
at exactly that colour — with or without the page-background fallback, so the
fallback adds no false positives on real data.

**Narrowed to controls on purpose.** Only a part carrying a `variant` is
considered, which both measured cases are. Without it, a column of same-sized
paragraphs with one coloured differently is indistinguishable from a set of
choices, and painting a box behind somebody's highlighted sentence is a change
nobody asked for. Missing an active entry is safe; inventing one is not. If a
`box`-shaped active entry ever turns up, that is the line to widen — against
measured data, not in advance.

**Where the colour goes, measured, because the answer changed underneath this
work.** The chrome lane moved a node's fill out to the wrapper, so there are
now two routes and they are not equivalent. Seeded four ways at 60×30 against
a production build and read as painted pixels:

| written as | what paints | size of a 35×18 box |
|---|---|---|
| `accent` + `variant: solid` | the `button` itself | 35×**15** |
| `colour.bg` | the wrapper | 35×**18** |
| both | the wrapper | 35×18 |
| untouched | **nothing** | — |

The first stops at the padding, which is the very fault the chrome lane fixed
as "a box's fill reaches its edge"; `Cta.tsx` now stands aside for it
(`background: saidRole(t, "bg") ? "transparent" : fill`). So the blend goes in
`bg` — what the page actually had, a `background-color` on the element — and
it fills the box.

**The variant is deliberately left alone**, which departs from the "and
variant solid" the other lane specified. With `bg` set the button paints
nothing either way, so it makes no difference to either measured node; and
forcing `solid` would flip the text of any node that never named a colour from
the accent to the accent's contrast — light text on a dark tint, the wrong way
round. Worth reconciling with the other lane, since a re-captured document and
a swept one should agree on the field.

(The old route is also why the fault read as nothing at all rather than as a
faint tint: a `ghost` fills with `accent + "22"`, and an eight-digit hex
suffix on an `rgb(...)` string is not a colour.)

**Note on data.** None of these checks use `sink` as a stand-in for his board;
every fixture is built at his measured numbers. `sink` is used once, for
arithmetic: it is the only place holding a raw capture with the `oklab()`
string still in it.

---

## The same box emitted twice

His numbers: 24 pairs across nine pages where one box holds another at 88% or
more of its area, repeating per page rather than scattering. Thirteen **pixel
identical** — the main content panel of almost every page, twice, exactly on
top of itself. Nine differing by **exactly one pixel of width**, 256 against
255: the sidebar, on every page.

**The standing hypothesis was two box models — one read including a border,
one excluding — and the capture refutes it.** His raw capture holds six
parent/child pairs with identical rects, and they are two distinct DOM
elements every time: `div` in `div`, `button` in `div`, `img` in `div`. The
page really does wrap a row in a box the same size. Nothing is measured twice.

**The cause is one gap.** `pageBlocks` dedupes properly — one box is one
block, within two pixels — and `offered` threw that work away:

```ts
const rest = candidates.filter((c) => !blocks.some((b) => same(b.box, c.box) || …));
return [...blocks, ...rest];        // rest is never compared against itself
```

`rest` is filtered against the blocks that *survived* the wrapper-opening
loop. Where neither twin survived, both are emitted. That predicts the
off-by-one shape too, because the two-pixel tolerance that would have caught
256-against-255 lives inside `pageBlocks` and `rest` applies none. Reproduced
in pure data before anything was changed.

**Two pieces, and they reach different things.** The fix in `offered` stops it
happening and reaches a **new capture only**. `twins.ts` in the sweep is the
**retrofit** that reaches a board already written down.

### What keeps the dedupe safe

- **Its own file**, not just its own thought. A duplicate may be removed
  because a twin remains; an empty wrapper may not be removed at all.
- **The twin is proven, not assumed** — `keeps` names it, and nothing is
  removed whose keeper is itself on the removal list. Where it cannot prove
  the twin survives, it leaves both.
- **Keep the one that says or draws something, else the outermost.** "Keep
  the first" throws away the button of a `div`-wrapping-a-button pair.
- **Two pixels and no wider.** A pair that disagrees on height keeps both:
  removing one would be choosing a height nothing here knows. His page_home
  column pair is 255×431 against 256×528; page_tokens' is 255×440 against
  256×440 and only that one is deduped.
- **Read off the document as SAVED.** The taller of his column pair *contains*
  the shorter, so the wrapper pass fits 528 → 431 — and at that moment they
  are the same box. A dedupe reading that result deletes a node on the
  strength of a height this code chose. **It did exactly that until the check
  caught it.** A box may only be removed for something the capture said.

---

## Measurement: what recorded parentage would move

**A measurement, not a change. No repositioning is built.** `owns.ts` answers
the question and moves nothing; `scripts/wrappers-report.mjs` prints the
numbers for any document.

**I do not have his board.** Everything below is the committed
capture-derived document (126 nodes, one page) — the same site and the same
converter, so the *mechanism* transfers, but the counts do not. Run the script
against his document for his numbers.

### The naive rule is wrong, and the measurement is what says so

"Put the wrapper where the parts it owns are" — replace its box with theirs:

| | wrappers |
|---|---|
| flagged | **31** of 126 |
| would move **down** | 27 (376px total) |
| would move **up** | 2 (38px) |
| would **shrink** | 29 (1879px) |

Twenty-seven moving *down* is the tell. That rule strips every wrapper's
**padding**: a box with 25px of it reads as 25px adrift and 50px too tall.
Twenty-nine of the thirty-one are padding, not drift.

### Grow-only, and the direction is the point

Keep the wrapper's own box, take in what escapes it, never shrink:

| | wrappers |
|---|---|
| flagged | **2** of 126 |
| direction | up and taller only — 38px lift, 93px growth |
| which ones | `n_box_83`, `n_box_84` — the header wrappers, each owning 32–33 parts with 2 escaping |

Fifteen times more selective, and it lands exactly on the banner fault.

### The healing does not undo it — it is currently causing it

I told the coordinator the opposite, and that was wrong. Measured
(`tests/wrapper-heals.mjs`), on his shape — banner 1763×82 at y 0, logo
overflowing to y −11:

- **Left alone:** the healing sees the banner overlapping the logo it owns
  and clears it the only way it can, downward. `y 0 → 101`. Every part below
  moves down 101px too. **An 11px overhang becomes 101px of dead space.**
- **Put right first:** the healing moves nothing at all, and the page is
  **101px shorter**.

So repositioning doesn't need the healing to pull anything back — it removes
the reason the healing pushed. And the two cannot fight: the correction only
lifts or grows, the healing only pushes down to clear an overlap, and the
correction's purpose is to stop the overlap existing.

This is very likely how his banner came to sit at y 147 with its header above
it: not the capture alone, but the capture's overlap plus a healing with one
direction.

### The sidebar does not fall out of this rule

Both column boxes have **zero** escaping children, and grow-only leaves both
untouched. The document holds an outer rail (256×1282, y 73→1355, reaching
the footer) and an inner nav (255×440, tracking its 24 entries) — a real
outer/inner pair, not duplicates, which is why `twins` correctly leaves them.
On his board *both* are short, which this rule cannot fix, because the rail's
own content ends where it ends. It needs its own investigation.
