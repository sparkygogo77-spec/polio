# Handover: the Builder's chrome, tool options, group lock, marquee

For whoever next works on how the Builder draws round a part (selection,
badges, borders, fills) and on the select tool's gestures. Everything here is
merged or on `claude/adoring-rubin-jjx7rr` at `13c05fb`, rebased on trunk
`e78ca77`. Nothing here changes the published page, and none of it touches
the converter, capture, spans, runs, wrappers or the sweep.

Each claim is marked **proved** (a check that went red first and asserts the
interaction happened), **measured on his board** (by the coordinator, on the
live board after deploy), or **believed** (reasoned, not tested). Most proofs
use a small board seeded by the check itself, not his board, and those are
labelled that way. That line has been crossed five times in this work, and
each time it gave a wrong number.

---

## 1. The tool options bar: extend it, don't rebuild it

**What it is.** `src/features/studio/toolOptions.tsx`. The header renders
`<ToolOptions tool={tool} />` where the drawing colours used to sit
(`StudioPage.tsx`). It shows the entries from `TOOL_OPTIONS` whose `tools`
include the tool in hand, sorted by `order`, and renders nothing when a tool
has none. Below `lg` the header folds into More tools, which renders the same
entries with `compact`.

**Adding a setting to a tool** takes one entry, and the bar doesn't change:

```ts
// 1. The setting, in index.ts `settings` (so ⌘K and the settings drawer find it too):
{ id: "studio.eraseWhole", group: "studio", label: "Erase whole drawings", type: "toggle", default: false, order: 6,
  description: "…" },

// 2. The entry, in TOOL_OPTIONS:
{ id: "erase-whole", tools: ["erase"], order: 1, kind: "toggle",
  setting: "studio.eraseWhole", label: "Erase whole drawings", hint: "…" },
```

Read the value wherever it acts with `useSettingValue("studio.eraseWhole")`.
If the control is richer than a checkbox, use `kind: "custom"` with
`render: ({ compact }) => …`. The pen's colour and draw-kind row is the
example: `DrawKindRow` moved into this file unchanged.

**Where values live.** A `toggle` entry is a module setting, stored per
browser in `localStorage["builder.settings"]` like the drawing colour. It is
never stored in the board. The coordinator asked for this so that a
preference of his can't show up as a difference when his document is measured.

**The checkbox.** He asked for a checkbox by name, and `@/core/ui` has no
checkbox, only a Switch. `OptionCheckbox` is a native
`<input type="checkbox">` that plays the Switch's own sound and haptic
feedback. If a Checkbox is ever added to `@/core/ui`, swap it in there.

**Proved** (`tests/tool-options.mjs`, own seeded board, 13/13):
- The select tool shows "Scale contents with group", on by default. The pen
  shows the colour row and not the checkbox. Each tool switch is asserted off
  the picker's `aria-label` before the bar is read.
- Toggling the checkbox writes `builder.settings`, leaves the saved board
  byte-identical, and survives a reload.

**Believed, not tested:** the compact rendering inside More tools below 1024px.

## 2. Group lock: what it stores, and what it deliberately doesn't

**Stores exactly one thing:** `StudioGroup.locked?: boolean` (`store.ts`).
It's set from the Inspector's "Hold together" switch or the group's
right-click menu ("Hold together: size as one" / "Let go"). Groups made
before this have no field and behave exactly as groups always did. That is
proved for an unlocked group's handles and frame in `tests/group-lock.mjs`.

**Behaviour of a held group** (`Canvas.tsx`, maths in `groupScale.ts`):
- Pressing any member picks all members. That was already true of every group.
- When all members are picked, one frame `[data-group-frame]` with eight
  handles `[data-group-resize]` is drawn round the group, and the members'
  own handles and Fill tab are hidden.
- Dragging a handle rescales every member from the opposite side of the
  group's box, as one undo step.
  - **Scale contents on** (the default): each member's box scales with the
    group, and so does its `font.size`, by the smaller of the two stretches.
  - **Scale contents off**: each member keeps its own w/h and font, and its
    centre moves with the group, so the spacing still scales. This is the
    coordinator's ruling: the arrangement is what the lock holds.

**Does not store, by design:**
- No per-member scale factor, no "original size", and no new text field.
  Scaling rewrites members' `x/y/w/h` and, when on, `font.size`, which are
  fields the published page already reads. Adding a field would change the
  published page, and publish is off-limits without his word.
- The frame is not stored. It's drawn from the members' bounds each render.
  So with scale contents off, the frame grows by the spread of the
  arrangement, not by the whole pull.
- A group isn't locked in the old per-part sense. `node.locked` (the padlock,
  "can't move") is a separate, older thing and is untouched.

**Proved** (`tests/group-lock.mjs`, own seeded board, 21/21, each step
asserting the pick, the frame, the handle and a changed frame size first):
- 2× pull: icon 40→80 from the group's corner, words' box 200×40→400×80
  moving to y=320, `font.size` 1→2.
- Off: icon stays 40×40, words stay 200×40 at size 1, and the words move down
  away from the icon.
- An unlocked group keeps per-member handles and gets no frame.

**Not verified on his board.** No held group exists there yet.

## 3. The marquee, and the escape-hatch key

**Rules** (`Canvas.tsx`):
- A marquee takes only parts, drawings and wires it **fully** covers. This is
  his ruling.
- A marquee that catches nothing leaves nothing picked. The page background,
  which a press on bare page selects, is dropped.
- A plain click on bare page still selects the background, as before.
- **Starting a marquee on a covered page.** A press on a part that wholly
  contains a smaller part on its page (`ownsOthers`) starts a marquee instead
  of moving it. Released without a drag, that part is picked, with its group.
  A press on any other part grabs it as before.
- A second quick press on a container falls through to the old double-press
  path, so a linked container still goes where it points.

**Escape hatch: Ctrl, or ⌘ on a Mac,** held while pressing moves a
container on purpose.
- Why these keys: Alt already pans from anywhere, and Shift already adds to
  and removes from the selection. Neither can be reused without breaking a
  gesture he has.
- The code accepts either key on every platform. On a Mac, Ctrl-click can
  also raise the context menu, so ⌘ is the one to tell him.

**Proved** (`tests/marquee-cover.mjs`, own seeded board, 14/14; the press
point's owner is checked with `elementFromPoint` and the marquee rectangle
`[data-marquee]` is looked for while the button is still down):
- Across a panel, the marquee takes exactly the two parts it fully covers,
  not the part half in, and not the panel. The panel does not move.
- On bare page, a marquee that catches nothing picks nothing, not even the
  background.
- A plain press picks the panel. A leaf drags 60px. Ctrl+drag moves the
  panel.

**Believed, with a caution.**
- "Holds others" is judged by shape. So a captured button whose icon was
  captured as a separate part inside it counts as a container: dragging it
  draws a marquee. His sidebar buttons may be built that way. I haven't
  checked that on his board.
- Trunk now has `owns.ts` (the other lane's), which answers "who owns what"
  from the recorded DOM path instead of shape. It's a better source for
  captured boards. If someone unifies the two, `ownsOthers` in `Canvas.tsx`
  is the one to replace. It's deliberately small.
- On the sink document, 100% of three pages is covered by some part. That's
  why the container rule exists. It's a hint about his board, not a
  measurement of it.

## 4. The text clamp, and how it shows itself

- The renderer clamps a part's `font.size` to **0.6–2×** the site's size
  (`applyFont` in `parts/theme.ts`). `groupScale.ts` keeps that clamp
  (`TEXT_SCALE_MIN`/`MAX`), as ruled, rather than add a field.
- When a resize wanted more than 2× (or less than 0.6×), the group's frame
  shows, under itself:
  - "Words at their largest: 2× the site's size. The boxes kept growing."
  - or "Words at their smallest: 0.6× the site's size. The boxes kept shrinking."

  as `[data-group-ceiling]`.
- It appears only when that resize was actually stopped, not whenever the
  text happens to be at 2×. A pull that lands exactly on 2× says nothing.
- It clears on the next group resize, or when the group stops being fully
  picked.

**Proved** (`tests/group-lock.mjs`, own seeded board): the first 2× pull
shows no notice. A second 1.5× pull leaves `font.size` at 2, and the notice
reads "Words at their largest…".

---

## Earlier work in this lane (merged, verified)

| Change | What it does | Where it's proved |
|---|---|---|
| A box is filled to its edge | The `[data-part-box]` wrapper paints the node's ground and the part inside paints none | `tests/box-fill.mjs`. **Measured on his board**: all eleven parts fill, e.g. the stat cards 365×104 where the fill was 331×0 |
| An unedged captured button has no border | No more `2px solid transparent`; a hand-placed button keeps its 2px | `tests/button-no-edge.mjs` |
| "not shown" waits until he picks the part | Shown on the chip above the part. Screen-reader names and placeholders are not counted as copy. A picture that didn't arrive is named | `tests/badge-selected.mjs`. **Measured on his board**: 5 → 0 badges, correctly, because nothing there is missing. The "badge appears" case is proved only on the seeded board |

## Open, not mine to fix

`tests/box-fields.mjs` fails 2/17 on trunk ("the cards wrap into lines
inside the strip", "the strip grew to hold them"), in the live preview at
tablet width. It fails identically on trunk with my changes set aside. It
passed 17/17 on `0574738` and has failed since `0bdd262`.

## Habits that caught real faults here

- Assert the interaction happened before asserting its result. A click that
  selected nothing, a marquee that was never drawn, and a pull measured
  against a part the test itself resized all produced confident wrong answers.
- A red for the wrong reason (a missing test marker) is as misleading as a
  green for the wrong reason.
- Regenerate and prove byte-identical before changing a generator.
- Start a server for a check and stop it in the same step. Confirm with a
  refused connection, not a status word, and not a `grep` that can match its
  own shell.
