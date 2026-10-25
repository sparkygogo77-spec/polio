# Handover: variations-taste (variations a designer would call better, J's 2026-10-25 ask)

Reports to coordinator #3 (local_2f123766-90d8-4b53-ab5c-849c3851e891). Lane on Fable, 3 prompts at most.

## Setup
- **Clone:** `Pleo/work-fable-taste`, branch `claude/variations-taste` from base `claude/template-ui-website-builder-11bfgl` at 4161a18c (agents-entry merged).
- **Port:** 3201 (`npx next start -p 3201`). Stop it with `solface-scratch/stop-port.ps1 -Port 3201`.
- **Captures:** `capture/sites/{thesolface3,mochi3,share-xyz,gotchi-gg,stonkfun-xyz,trumpmorty-fun,parasiteonsol-fun,trendtrader-pro}` copied from work-editable (untracked).
- **Logs:** `Pleo/fable-taste-*.log`.

## Branches

| branch | commit | what | test |
|---|---|---|---|
| claude/variations-taste (P2, polish of a new feature) | see MERGE-QUEUE | design rules in the local roll, a named-directions Claude prompt, AA held part by part | `tests/variations-taste.mjs` (pure), plus `tests/variations.mjs` (Builder) |

PR body: `handovers/claude-variations-taste-pr-body.md`.

## What changed (files I own: `variations/*`, `better/*`, the better route)
- **`variations/model.ts`** — the roll is no longer uniform. `RULES` is a table of weights per choice, with a base row and a row per aim (cleaner, modern, like, clearer); a choice's weight is its base plus every ticked aim's. Choices come only from:
  - `RATIOS` 1.2 / 1.25 / 1.333 on a 16–18px body; `TASTE_PAIRINGS` (heading and body that suit each other; novelty faces are never rolled locally);
  - `GRID` 4 / 8 steps, density 1 / 1.25 / 1.5 (never tighter than the original);
  - colours: the site's own hue turned 0–30° (cleaner holds it at 0), harmony mono / analogous / complementary; a grey site gets one good accent;
  - `SpaceChoice.depth` (flat / soft / lifted) drawn from `DEPTH_FOR[corner]`, so square is flat and pills are never lifted;
  - `LayoutChoice.air` (0 / 16 / 32 / 48 px above every section after the first), one body alignment for the whole page, an alternating rhythm or none, the first screen centred for "clearer";
  - order: one pair of neighbouring middle sections swapped, never a shuffle.
  - A lock with nothing to keep it from (first roll) leaves that layer as the original (it used to roll).
  - `specDistance` (how far two specs look apart) and `DIRECTION_GAP` = 1; `directionName` ("Calm editorial", "Bold product") for every variation, local ones too. `readSpec` lands off-rule numbers on the nearest rule (1.5 → 1.333, step 6 → 8, 50px air → 48, lifted square → flat).
- **`variations/tokens.ts`** — round corners 24/12 and pills 32 (on the 4px grid); shadows go to the depth (`SHADOW_OF`), rings (0 0 0 1px) kept as outlines; sizes never clamp to 10px off the scale (two steps under the body is the floor).
- **`variations/relayout.ts`** — `air` moves every section after the first down by k × air.
- **`variations/make.ts`** — `holdWords`: after the tokens, every words part that read at AA on what is behind it (its fill, the smallest filled part under it, or the page) still does; one that fell short has its words moved in lightness, set apart from its token as a hand would. Only runs when colours were rolled.
- **`variations/ask.ts`** (new) — the ask: sections, the layout tree in plain lines (`layoutLines`), the System with its scale, the aims, the **locks**, the words that may get a suggestion. Moved out of `run.ts` so it is pure and tested.
- **`better/prompt.ts`** — the prompt rewritten: a senior designer, four *directions* each named in two or three plain words, the rules spelled out (real ratios, the grid, corners and depth that agree, one body alignment, one swap at most), LOCKED layers must say keep, word changes are suggestions only. Schema adds `name`, `depth`, `air`. `readAnswer` keeps locks, lands off-rule numbers, pushes two directions closer than `DIRECTION_GAP` apart (`apart`: the later one's unlocked layers re-rolled from a seed of its index), and gives every direction a distinct name.
- **`api/studio/better/route.ts`** — reads `locks` and `site.layout` from the ask, and `shape` from the body, so `apart` can roll on the site.
- **`run.ts`** — uses `ask.ts`, passes locks and shape, sets `name` on every variation. **`VariationsPage.tsx`** shows the name on the card and above the layers (two lines).

## MEASURED (build at the pushed commit, port 3201)
- `tests/variations-taste.mjs` on all eight sites: **104/104** (`Pleo/fable-taste-pure.log`). Per site 13/13; words parts reading at AA before, all still reading after 72 rolls: sol face 128/199, mochi 86/123, share-xyz 423/434, gotchi-gg 306/366, stonkfun-xyz 1015/1101, trumpmorty-fun 26/38, parasiteonsol-fun 683/1559, trendtrader-pro 419/427.
- `tests/variations.mjs` (Builder, Claude stubbed): sol face 29/29 and mochi 29/29 on the built branch (the original’s board 0 px moved, control 0; a kept variation publishes with 0 page errors)
- tsc clean, `next build` passes.
- Shots: `Pleo/handovers/shots/variations-taste/` — `before.png` (the original pane), `after-1..4.png` (four Randomize variations of sol face with "cleaner": Warm friendly, Warm clean, Bold friendly, Bold soft), `page-1..4.png` (the whole Variations page).
- Found while testing, fixed: (1) the take can read a scale of ×1.067 from 11px on sol face, and snapping onto it blew sizes up to 69,333px (then `checkValue` left the biggest as they were, off any scale) — sizes are now steps of the *new* ratio from the body size; (2) white words on a fill that turned olive fell to 4.31 and could not be lightened further — `holdPairs` now moves the fill instead; (3) `holdWords` parsed every fill colour inside an O(n²) loop and took minutes on sol face — fills are parsed once per build.

## BELIEVED / not checked
- No real Claude call was made (no spend). The prompt's quality on a real run is believed, not measured; J's first real run should be looked at by a person.
- `holdWords` reads what is behind a part by its box; a words part over a picture or a gradient keeps its colour (the page or the nearest fill is assumed).
- The reference site is still given by name only.

## How to run
```
cd Pleo/work-fable-taste
export PATH="/c/Program Files/nodejs:$PATH" PLAYWRIGHT_CHROMIUM="C:/Users/Josh/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe"
node tests/variations-taste.mjs capture/sites/thesolface3 capture/sites/mochi3 capture/sites/share-xyz capture/sites/gotchi-gg   # pure, no server
npx next build && npx next start -p 3201   # in the background
node --import file:///C:/Users/Josh/Downloads/Pleo/solface-scratch/pw-args.mjs tests/variations.mjs http://127.0.0.1:3201 capture/sites/mochi3
```
Red on base: `tests/variations-taste.mjs` fails to load (`variations/ask.ts` does not exist; `RATIOS`, `GRID`, `specDistance` are not exported).

## What's left
- A real Claude run with J's key, looked at by a person.
- Photograph the reference site for "like".
- Phone width.
