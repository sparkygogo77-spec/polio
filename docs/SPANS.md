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
