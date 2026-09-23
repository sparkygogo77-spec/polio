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

The harness was a scratch script, not committed. Its whole shape is
`tests/bring-sweeps.mjs` (the stub, the Keys step, the door) with sink's tree
served instead of a fixture: `site/document.json` plus `assets/pictures/*`
from the sink repository, and the page switched by writing `activePageId` and
reloading. Rebuild it from that file; it is about sixty lines.

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
