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

**Next: the renderer**, then the emitter that stops fragmenting a sentence at
capture. The inspector half — select a word, colour it — is its own commit
behind them.

**His hand-corrections are replaced, by his ruling.** He extended and moved
these boxes working around this bug, and said plainly he wants the correct
result rather than his patches kept. So a fragment group merges whatever its
parts are marked, the merged box takes the geometry the capture recorded
rather than where he dragged it, and every hand-moved part replaced is
reported by name. The `byHand` exemption is overruled INSIDE a runs rebuild
only — a part he moved that is not in a sentence being reassembled still
stays where he put it.
