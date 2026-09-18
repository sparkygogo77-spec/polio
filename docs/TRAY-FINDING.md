# The three-dot tray under the menu: what is under it, and what has nowhere else to go

The control is the `HoverTray` in `RadialMenu.tsx` (~line 1209): a tab hanging
under the wheel, its icon three dots, its label "More". It holds seven actions
across two sets — one when a part is picked, one when the page background is.

The instruction was to remove it, and to say first if anything under it has no
other home. **Four of the seven have no other home.** Nothing is deleted.

| Action | Other home | |
|---|---|---|
| Preview here (page) | Toolbar eye button (`StudioPage.tsx:321`), the `p` shortcut and right-click "Preview this page live" (`index.ts:402`), the command palette (`index.ts:153`), the page menu (`index.ts:515`) | **Homed** |
| Put the background back | Inspector (`Inspector.tsx:235`) and right-click, on `mod+v` (`index.ts:373`) | **Homed** |
| Preview here (part) | The *page* it opens has four other routes. The `#id` anchor that scrolls the live preview to **this part** has none | **Half homed** |
| Forward | None. `raiseNode` has exactly one caller in the app, and it is this tray | **Nowhere else** |
| Backward | None. `lowerNode`, the same | **Nowhere else** |
| Copy looks | None. `carriedLooks` is a module-local in `RadialMenu.tsx` and nothing else reads or writes it | **Nowhere else** |
| Paste looks | None, the same | **Nowhere else** |

Verified by searching every call site: `grep -rn "raiseNode\|lowerNode" src`
returns the store's declaration, its implementation, and these two lines.

## Why this matters beyond the four

Two of the four are Looks, and `DESIGN.md` is explicit that the wheel is the
whole editor and the panel only a convenience: *"Anything the Inspector can do
to one part, the wheel does too. Add to both or to the wheel alone; never to
the panel alone."* Copying a part's colour, font, texture and aura onto another
part is as much a Looks operation as anything on the Looks slab, and today it
is reachable only from a tab that hangs off the bottom of the menu.

The other two are z-order — which part sits over which. That is an ordinary
editing operation on a board where parts overlap, and it has no route at all
apart from this tray: not a shortcut, not a right-click item, not a command.

## Where they would go

- **Copy looks / Paste looks** → the Looks slab on the wheel, which is what
  Looks means, and beside "Put the background back" in the right-click menu,
  which is already the paste of a look-shaped thing.
- **Forward / Backward** → the right-click menu's part section, where the rest
  of the per-part actions are, and on the wheel if a slice can be spared
  without making a sliver.
- **Preview here (part)** → the existing right-click "Preview this page live"
  can carry `#id` when a part is under the pointer, which costs one line and
  makes the anchor reachable without the tray.

With those three moves made, the tray holds nothing that is not reachable
elsewhere and comes out without losing anything.
