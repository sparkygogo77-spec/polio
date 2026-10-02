# gotchi.gg through the pipeline

gotchi.gg is the owner's own site: plain ES modules (`/js/*.js`,
`/shared/*.js`, no build step), three stylesheets, Google's Pixelify Sans
and M PLUS Rounded 1c plus a digits face of its own (`/fonts/digits.woff2`),
pixel icons drawn as inline SVG, hearts cut by CSS masks, and every pet drawn
on a `<canvas>`. Taken 2026-09-28 with `site/capture/capture-site.mjs`,
1440×900, headless Chromium; 11 pages (`/`, `/pets`, `/adopt`, `/park`,
`/arena`, `/boards`, `/graveyard`, `/shop`, `/wardrobe`, `/rules`, `/faq`).
Local runs only: nothing was published or deployed. The capture lane's first
pass (fonts by a–z, canvas pixels) is in the history of this branch; this
file is the fidelity lane's.

Crops are in `gotchi-gg/`, live on the left, the export on the right (polio
`scripts/export-site.mjs` of `sites/gotchi-gg`, served locally), at 1440
unless named 2000.

Crops (`gotchi-gg/`): `header-1440.png`, `header-2000.png`, `hero-1440.png`,
`hero-2000.png`, `device-1440.png` (as the page opens),
`device-press-feed.png` (0.7 s after pressing feed), `starter-1440.png`,
`starter-press-pup.png` (after pressing pup), `how-it-works-1440.png`,
`park-1440.png`. The two `gotchi-home-*` crops are the capture lane's.

## What was wrong, why, and what now does it

| # | the owner saw | cause | fix (general) | where | check (before → after) |
|---|---|---|---|---|---|
| 1 | pixel font lost; nav words cut ("adop", "par"), "my pets" wraps; logo "gotch" + a square | `Pixelify Sans` is declared twice: Google's Latin file, then the site's own digits-only file (`U+30-39`). Both counted as Latin and shared one id, the first read won; `unicode-range` was never written back; a cross-origin sheet's faces were appended after the page's own, reversing which wins | faces kept in the page's declared order (a linked sheet's faces set where its link stood); a rule for some characters only is its own entry with its range in its id; a family carried as several rules writes each `unicode-range`; the board asks a ranged face with a character it holds | sink `capture-route.mjs`, `dump.mjs`, `capture-to-document.mjs`; polio `fonts.ts`, `live/CarriedFonts.tsx` | sink `check-late-art` (1), `check-font-ranges` (+ the digits rule); polio `tests/fonts-ranged.mjs` 3/8 → 8/8 |
| 1b | nav words still cut or wrapped with the right face | a padded link (15px words in a 33px box, 9px padding) was read by its whole height, so it counted as two lines: allowed to wrap, clipped at its box. Any glyph a hair wider (another machine, the board's zoom) cut or wrapped it | the room for words is measured inside the node's own padding (`theme.padY`), so a one-line link is set on one line, uncut | polio `parts/Text.tsx`, `parts/theme.ts` | polio `tests/padded-one-line.mjs` 7/9 → 9/9 (red: "my pets" on two lines, "graveyard" cut) |
| 2 | starter descriptions spill across cards; stage labels bunched on one line | polio's import sweep joins words on one line into one sentence; each card's `p` and each figure's label sat on one line with their neighbours, so the first was widened across the row (150 → 515px, 101 → 545px) and the rest deleted | pieces each inside their own copy of a repeated element (`button:nth-of-type(1) > p`, `button:nth-of-type(2) > p`) are items in a row, never one sentence | polio `reassemble.ts` | polio `tests/items-apart.mjs` 2/4 → 4/4; `reassemble` 53/53, `links-apart` 11/11, `sentence-back` 12/12 |
| 2b | step numbers in "how it works" sit top-left in their dots | the dot is a grid centring its "1" (`place-items: center`); the part sets words at the top left | words their own grid or row centres carry `text.align: center` and the padding that stands the line in the middle (new captures only) | sink `dump.mjs` (`ji`), `capture-to-document.mjs` | `check-late-art` (7) |
| 3 | coloured pixel icons came out black (logo, device icons, egg, tombstone) | each icon is 16×16 `<rect>`s, each its own fill (`currentColor`, a hex, `var(--line)`); the capture kept geometry only, drawn in one colour. The tombstone and the "hold" mark paint through an inline `style="fill:var(--line)"`, which beat the colour written as an attribute | an svg whose shapes paint in two or more colours is kept whole as a picture of itself, each shape's computed paint written as an attribute and over any inline style | sink `dump.mjs` | `check-late-art` (2), (6) |
| 3b | hearts as solid squares | a `<i>` and its `::after` painted a colour through `mask-image` | a box or pseudo-element cut by a mask over a plain fill is a picture of its colour through its mask (a mask by address fetched and written in); no square left under it | sink `dump.mjs`, `capture-route.mjs`, `capture-to-document.mjs` | `check-late-art` (3) |
| 4 | device LCD blank grey-green; pets missing; no idle frames | the LCD and every pet are `<canvas>` repainted by script | the lane's canvas picture for a canvas drawn once; one that repaints while watched (`--frames`, 3 s at 100 ms) is played back as one svg of its frames at its box; pixel art (`image-rendering: pixelated`) is drawn square (`picture.pixelated`) | sink `capture-route.mjs`, `dump.mjs`, `capture-to-document.mjs`; polio `pictures.ts`, `parts/primitives.tsx` | `check-late-art` (5), `check-canvas` 6/6 |
| 5 | other starters cannot be chosen; device buttons do nothing | the capture held the page as it opened | **what a press shows**: each group of 2–12 sibling buttons, tabs, radios or toggles is pressed one option at a time on a freshly loaded page (its storage and cookies put back, so a remembered switch does not leak), and what changed is kept as parts marked `state`, with the press in `behaviours.states`. polio attaches **Show on press**: the Preview and the published page swap them; the board lays out the page as it opens | sink `capture-route.mjs` (`--states`, on by default), `capture-to-document.mjs`; polio `library/behaviours.ts`, `library/captured.ts`, `store.ts`, `Canvas.tsx`, `live/LiveSite.tsx`, `textFit.ts` | sink `check-states` 6/13 → 13/13; polio `tests/press-shows.mjs` 2/7 → 7/7 |
| 5b | device press: words above the device; LCD "already hatched"; chosen card not tilted; kit 9px low | (a) the words were the site's screen-reader line, a 1×1 clipped box; the LCD's own words are canvas pixels. (b) the first read watched the LCD ~20 s into its load, after the demo pet hatched; presses are made ~4 s in, on an egg, so the LCD counted as noise. (c) the card's `:hover` lift was carried although `[aria-pressed=true]` wins the cascade. (d) the Builder's healing moved the row 9px and left the parts a press shows behind | (a) a box a pixel or less that clips, or clipped to nothing, is no part; (b) the page's canvases are read again on a load like the presses', at the moment they are made, and each press keeps its canvases' frames near the control (the screen answering, in order); (c) a state rule is tried on the page in its own cascade place and only what takes is kept; (d) a part a press shows follows the move of the part it stands in for; (e) a press's canvas plays its frames once from the press and holds, and Show on press restarts a shown svg's clock | sink `dump.mjs`, `capture-route.mjs`, `capture-to-document.mjs`; polio `pressed.ts`, `textFit.ts`, `library/behaviours.ts` | `check-states` 16/19 → 21/21; polio `tests/pressed-follow.mjs` 5/5, `tests/press-shows.mjs` 7/10 → 10/10 (runs the script) |
| 3c | (published build, lane `e67788c`) many icons a dash "–" or nothing | the lane's "one row per row type" rule cut any element of 12+ like children to its first row, and its guard skipped svg *descendants* but not the `<svg>` itself: a pixel icon of ~100 rects kept one row, a dash | the rule leaves an svg's own shapes alone | sink `dump.mjs` (merge `73e2642`) | `check-late-art` (8) 19/21 → 21/21 (counts every icon's shapes against the page's) |
| 5c | (published build) boo and glitch: card tilts, panel an empty cream box up over "how it works"; after another starter, mochi cannot be chosen again | (a) the panel is `position: sticky`; boo's and glitch's presses change the panel's own height, so the press keeps a panel of its own at the page's panel's path. The export put every part under that path into the first band of it, the page's panel, which boo's press hides: boo's panel stood empty. Its margin was measured from the page's panel, so with that one hidden it stood 86px up. (b) every panel stuck against the whole page, not its grid: scrolled, drako's stood 351px into the section (live 199). (c) pressing the card already chosen changes nothing, so mochi had no press; and every other press hides mochi's own card (a copy stands in), so a click on it reached nothing | (a) a band takes the parts of its own press first, else the page's, never another press's; (b) a sticky band whose parent is less than the page, or that a press shows or hides, is held in a box where its parent stood and sticks inside it; (c) **the opening press**: the option marked chosen as the page opens (pressed, selected, checked, current) is a press of its own (`opening: true`) showing the page's own parts wherever the group's other presses change it; Show on press undoing it leaves the page's parts showing, and counts a press where its part last stood while the part is hidden | sink `capture-route.mjs`, `capture-to-document.mjs`; polio `fluidSite.ts`, `exportSite.ts`, `library/behaviours.ts`, `library/captured.ts` | sink `check-states` 24/30 → 30/30; polio `tests/press-shows.mjs` 14/20 → 20/20; the nine starters pressed on the export against live (table below) |
| 5d | (published build) scrolled below the starters, the chosen-starter panel keeps following down the page over "bond hearts"; on live it stops at the foot of its section | the panel sticks against the whole page: it stood in the frame's flow with its height taken back (`margin-bottom: -h`), so nothing stopped it. Held in its parent's box (5c b) it first painted over the header when stuck under it (the hold stood at the header's level, later in the page) | a held band takes no height back inside its box, so it stops at the box's foot; the box sits one level under the bands that stick to the whole page | polio `exportSite.ts` | polio `tests/sticky-in-section.mjs` (every sticky part inside a section scrolled top to bottom at 1440 and 2000, as the page opens and after each press showing one; and the header on top where they meet): old export 7/13, before the stacking fix 9/17, now 18/18 |
| 6 | orange "!" on the device icons | not a fault: `library/badge.ts` puts it on a pressable part with no link, feature or task ("Goes nowhere yet: say what it does") | a pressed part that now carries Show on press loses it; the rest is for the owner or the backend chat (below) | — | — |

### The nine starters, pressed (5c)

Each on a fresh load at 1440, the panel's top in px from the section's top,
at rest / after scrolling to the pressed card; "empty" is a panel with no
words. Live `gotchi.gg`; before is the published build (`gotchi-red`, the
same with this branch's old document exported locally); after is this
capture exported with polio `claude/awesome-archimedes-veqcrh`.

| starter | live | before | after |
|---|---|---|---|
| mochi, pup, kit | 105 / 105 | 106 / 106 | 106 / 106 |
| ribbit, chick | 105 / 165 | 106 / 164 | 106 / 164 |
| boo | 105 / 165 | empty, 20 / 164 | 106 / 164 |
| drako, zorp | 105 / 199 | 106 / 351 | 106 / 200 |
| glitch | 105 / 173 | empty, 20 / 351 | 106 / 178 |
| pup, then mochi | mochi's panel | pup's panel stays | mochi's panel, as it opened |

Glitch scrolled stops 5px low: the export's starter grid is 5px taller than
live's (the height healing under "Pixel rounding" below), and a sticky
panel stops at its grid's foot. Crops: `starter-press-boo.png`,
`starter-press-glitch.png`, `starter-press-mochi-again.png`, `starter-scrolled.png` (scrolled to
"bond hearts": the panel stays at its section's foot) (live left, export
right); `starter-press-boo-before.png`, `starter-scrolled-before.png` (live
left, published right: the panel followed down over "bond hearts").

Scrolled from the top of the page to its foot at 1440 and 2000, the panel's
top reaches 199px into the section on live, 200 on this export, and 2650 on
the published build (bond hearts starts at 779 / 784).

The demo device was first tried as the site's own script in a sandboxed
embed (`device.html`, the owner's modules bundled): it mounted, animated and
answered presses from another origin. The owner ruled embeds out of the
Builder's job, so it is not in the document; the finding is in the hand-off.

## Tips

- sink `claude/fervent-carson-30yt59`: the commit carrying this file; it
  holds the capture lane's `e67788c` (merged in `73e2642`)
- polio `claude/fervent-carson-30yt59`: `6293a37`, rebased onto trunk
  `368569f`

## How far the capture can go on this site

| layer | where it stands | ceiling without backend code |
|---|---|---|
| static look | ~95%: every face, colour, icon, heart, sprite and card as live at 1440 and 2000 (crops); what differs is listed below | ~98%: the page as it opened, in its own faces and paints |
| animation | CSS keyframes and hovers as captured; repainted canvases as sampled frames (3 s loops: the device's pet, the sprites' 2-frame idle, the park's clouds); spins, floats and blinks attached | a sampled loop, not the script: a pet that does something different every minute loops its 3 s |
| the interactive demo | one press deep: each starter card, each device icon and button, as the page answered one press from where it opened | presses that build on each other (feed, then feed again; the device's menus; games) are the device's state machine (`shared/sim.js`): hand-off |
| live data | one sample of each: counters, feed, graveyard, park, arena, supply as they were when captured | backend's job: hand-off |

Measured known gaps left after this pass are listed under "Differences left".

## Functions not captured (hand-off to a backend chat)

For a model that implements these against the Builder's parts. Endpoints
are the site's own (`js/api.js`: `fetch(path, { credentials: "same-origin" })`,
JSON in and out, errors as `{ "error": string }` with an HTTP status). Shapes
below are keys and types seen on the public GETs on 2026-09-28, and the
bodies the site's modules send; no token, cookie or wallet was used or kept.
Signed-in calls need the session cookie that `/api/auth/finish` sets.

Shared state: `GET /api/state` → `{ now, demo, token: { live, mint, symbol,
decimals, program, buyUrl }, tiers: [{ hearts, min }×5], rules: { slotsBase,
nestsMax, bondMin, burnPriceScale, gameBitsDailyCap, lovesDailyCap,
careBitsDailyCap }, prices: { price_capsule_basic, …, items: { <itemId>: {
bits, burn } } } }`; `now` sets the server clock skew every countdown and
sim uses. `GET /api/me` → 401 signed out.

### Header (every page)

- **sign in**: wallet sign-in. `POST /api/auth/start { address }` →
  `{ nonce, … }`; the wallet signs the message; `POST /api/auth/finish
  { nonce, signature }` sets the session. `POST /api/auth/logout {}`.
  Attach to: the header's "sign in" `cta-primary`. States: signed out /
  signing / signed in (then `/api/me` feeds "my pets", the wallet chip).
- **lights**: theme switch (`documentElement.dataset.theme`, remembered in
  localStorage): the whole page's palette, and the park's night scene.
  Attach to: the header's lights button; a site-wide palette swap.
- **sound**: `js/sound.js` on/off, remembered. Attach to: the sound button.

### Home

- **Demo device** (hero): a pet simulated entirely in the browser by the
  site's own `shared/sim.js` (`newPet`, `advance`, `act`, `view`) and drawn
  on the 48×36 LCD by `shared/render.js` / `shared/lcd.js`; no network in
  demo mode. Inputs: the eight icons (`feed, lights, play, medicine, clean,
  stats, scold, alert`) and the three buttons (`select`/A, `ok`/B, `back`/C,
  which walk the icon bar and its menus); outputs: the LCD frame, the
  selected icon, a line of words on the screen ("still an egg."). States:
  egg → hatched stages, awake/asleep (lights), hungry/dirty/sick flags,
  menus. What is captured: each single press from the page as it opened
  (Show on press) and the idle frames. What is not: presses in sequence.
  Suggested: port `shared/sim.js` + the LCD renderer as a Builder feature
  attached to the device's parts (the LCD picture part and the eleven
  pressed parts); it needs no backend. Proven: the owner's modules, bundled,
  run in a sandbox from another origin with no network.
- **Counters** ("alive", "adopted", "burned", "players"…): from `/api/state`
  and the lists below. Attach to: the LCD-tile stat parts.
- **Live feed**: `GET /api/feed?limit=12` → `{ items: [{ id, ts, type,
  wallet, petId, petName, species, data: { name, species, cause, sig, age } }] }`.
  Attach to: the feed list's rows (one captured sample row as the template).
- **Recent graves**: `GET /api/graveyard?page=0` (shape under Graveyard).
- **Park strip**: `GET /api/park` (shape under Park).
- **Starters**: static copy; captured with its presses.
- **copy CA**: copies the mint; Builder's Copy with toast feature fits.

### My pets (`/pets`, signed in)

- List from `/api/me`; per pet: `POST /api/pet/{id}/act { action,
  item? }` (actions as the device), `POST /api/pet/{id}/bond { bond }`,
  `/daycare { hours }`, `/rename { name }`, `/revive {}`; `POST /api/daily {}`.
  Signed out it shows the sign-in prompt, which is what was captured.

### Adopt (`/adopt`)

- Steps: pick a species (radios; captured with its presses), name, bond,
  confirm (checkbox gate), then `POST /api/adopt { name, bond, tz, species
  | eggId, ref? }` → the new pet. Needs sign-in and a bond held in the
  wallet.

### Park (`/park`)

- **Scene**: one canvas (`js/components/parkscene.js`, `mountPark`): sky,
  three clouds drifting (1 px per 0.9–1.7 s), hills, trees, fence, grass and
  flowers, at 10 fps; night palette with lights off. Pets from `GET
  /api/park` → `{ pets: [card] }` wander: each walks at 3–9 px/s, turns at
  the edges, idles 0.8–3.3 s at random, 2-frame idle flip every 500 ms, and
  now and then a heart rises over a random pet (every 0.9–2.7 s, 1.4 s
  life). Captured: the scene's frames (3 s); on 2026-09-28 the park was
  empty (`{ "pets": [] }`), so no pet was there to capture.
- **Tap a pet**: a card (`park-pop`): sprite, name, `species · form · lv`,
  hearts (`lovesEl`), **love** (`POST /api/love/{id} {}` → `{ loves }`,
  one per pet, disabled on your own) and **visit** (`/g/{id}`), close ×.
  The pet is a canvas hit-box, not an element, so no press reached it.
- **In the park now (N)**: the same `pets` as LCD tiles.
- Builder side: a wander feature (speed, bounds, idle, flip) on pet parts,
  with the scene as its ground, would be tier A; pets, hearts and love are
  backend data.

### Arena (`/arena`)

- `GET /api/arena` → `{ day, closesAt, closed, events: [{ id, name, stat,
  entries: { junior, senior } }×4], results: { day, events }, mine }`;
  `POST /api/arena/enter { petId, event }` (signed in). Countdown to
  `closesAt` on the server clock.

### Boards (`/boards`)

- `GET /api/leaderboard?board=<tab>&species=<optional>` → `{ rows }`
  (a request without a valid `board` is refused, 400). The tabs and the
  species picker are captured with their presses as far as the page drew
  them without the network.

### Graveyard (`/graveyard`)

- `GET /api/graveyard?page=N` → `{ rows: [{ id, name, species, form, stage,
  shiny, mythic, level, hearts, equipped: { hat, eyes, neck, back, dye, bg,
  aura, frame, tag, shell, lcd }, alive, ageMs, loves, flowers, death: { at,
  cause, sig, ageMs }, wallet, expression, asleep }], total, page, pageSize }`;
  leave a flower: `POST /api/flower/{id} {}`.

### Shop and wardrobe

- `GET /api/supply` → `{ items: { <itemId>: number } }` (limited stock);
  `POST /api/shop/buy { itemId, qty }`, `POST /api/capsule/open { kind }`,
  `POST /api/pet/{id}/equip { slot, itemId }`, `/rename`, `/revive`;
  wardrobe `POST /api/gift { to, inventoryId }`. Burning for items:
  `POST /api/burn/build { amount }` → a transaction the wallet signs, then
  `POST /api/burn/claim { sig }`.

### Settings and push (not captured pages)

- `/api/settings`, `/api/push/key`, `/api/push/subscribe { subscription }`,
  `/api/push/unsubscribe { endpoint }`, `/api/push/test {}`.

## Differences left

Seen on the export at 1440 and 2000 against live, after this pass:

- **The device answers one press, not a conversation.** Each icon and
  button plays what live showed after that one press from the page as it
  opened (the icon chosen, the screen's answer as frames); a second press,
  the menus, feeding a hatched pet, the games are `shared/sim.js` (hand-off).
- **Sampled loops.** The LCD, the sprites' idle and the park's clouds play 3 s
  of frames on a loop; live runs forever and varies. The park was empty when
  taken (`{ "pets": [] }`), so no pet wanders there in the capture.
- **Numbers and lists are one sample** (counters, feed, graves, arena).
- **The header's sound button** changes on any first press on live (the
  page unlocks audio), so pressing a device icon also swaps it, as live.
- **Pixel rounding**: sections below the hero sit a few pixels lower than
  live (the Builder's height healing under a face measured a hair taller);
  nothing overlaps or clips.
- **The published build** (gotchi-red) also has the empty boo and glitch
  panels and the mochi that cannot be chosen again (5c): fixed on sink and
  polio `claude/awesome-archimedes-veqcrh`, and need a republish.
- **The published build** (gotchi-red, from the lane's `e67788c` and polio
  trunk) still has the dashes and the spilled card words: those are fixed on
  these two branches (`73e2642` in sink, `b307b3e` in polio) and need a
  republish from them.
