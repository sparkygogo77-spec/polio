# Prompt recipes

Copy one of these, edit the bracketed parts, and hand it to an agent working
in this repository. Every recipe assumes the agent has read `AGENTS.md`.

The pattern is always the same: **re-centre the site config, add one or more
feature modules, remove the demos, verify.** The shell stays.

---

## 0. Start in the Builder (the intended route)

Open `/builder`, then:

1. **Place** parts from the library — search or browse by category, drag each
   one where it should sit on the page. Vertical order is reading order.
2. **Draw** regions around groups of them, connect related parts with arrows,
   sketch anything the library has no tile for.
3. **Prompt each part.** Select one and write instructions specific to that
   placement ("sits flush against the hero, shares its accent, collapses on
   mobile"). Group things and give the group its own prompt.
4. **Watch the preview** pinned on the board — it redraws as you move things
   and as you change the format.
5. **Set the format** — pages, scroll behaviour, typography and text-box
   treatment, motion, palette, stack.
6. **Write the master prompt**: the one sentence saying what the site is.
7. **Compile**, then either hand the blueprint to Claude in-page, or copy it
   into any agent with this line in front:

```
Read AGENTS.md, then build the site described in the blueprint below. Treat
position, regions, arrows and per-part prompts as binding. Start with everything
marked `must`. Ask me about anything the blueprint leaves genuinely ambiguous
rather than guessing silently.

<paste the blueprint>
```

The blueprint explains its own conventions, so it works in a fresh session with
no other context.

---

## A. Any site, from scratch

```
Read AGENTS.md. Turn this template into [a portfolio site for a motion designer].

1. Edit site.config.ts: name "[Name]", tagline "[...]", accentHue [hue], density "comfortable",
   layout.sidebar "hidden", topTabs true, demoModules [].
2. Create feature modules with `npm run new:feature`:
   - work: route "/work" and "/work/:slug"; a grid of case studies from src/features/work/data.ts;
     right-click a card → "Copy link", "Open in new tab", "Add to shortlist" (checkbox).
   - about: route "/about".
   - contact: route "/contact" with a form; on submit publish {key:"contact:sent"} as a success toast.
3. Home: keep the hero from site.config, set primaryCta to /work.
4. Every list uses VirtualList if it can exceed 100 rows; otherwise a plain grid.
5. Add commands "Go to work", "Copy email" and shortcuts "g w", "g a", "g c".
6. Run npm run typecheck and npm run build. Fix everything. Do not touch src/core unless a bug forces it.
```

## B. Trading terminal for a specific chain / launchpad

```
Read AGENTS.md and docs/FEATURE-CATALOG.md. Build a real trading terminal for [Pons on Robinhood Chain] as a new module.

- `npm run new:feature pulse --name "Pulse" --icon Activity`. Lean on the Dense & keyboard parts in the Builder library:
  side-by-side feeds, huge list, saved presets, one-click action, status bar, privacy blur, live data stream.
- Subscribe to factory TokenLaunched events (F01/F02) over websocket [endpoint], read pool reserves for liquidity (F14) and
  graduation progress against 4.2 ETH (F18). Three columns, pause-on-hover with queued rows.
- Add modules: token (route /token/:address — chart placeholder F40, holders table F24/F17, dev history F32),
  positions (/positions — F59-F61 with realised/unrealised split), watchlist (/watchlist — F74).
- Row context menu must include quick buy P1/P2/P3 (F47/F48), copy CA (F20), open chart, watch, hide, blacklist dev (F77).
- Settings: presets (size/slippage/priority fee) under group "trade", most advanced: true.
- Every price/MC change publishes with key "pulse:mc:<address>" and ttlMs 30000; never one line per tick without a key.
- Sound: newRow on inserts into "New pairs" only when the user has a saved filter matching (F08).
- Keep everything virtualised and blur-able. Typecheck and build must pass.
```

## C. Dashboard / admin panel

```
Read AGENTS.md. Turn this into an ops dashboard for [service].

- site.config: name "[Ops]", accentHue 255, density "compact", sidebar "fixed".
- Modules: overview (/), incidents (/incidents, /incidents/:id), services (/services), logs (/logs).
- Logs is a VirtualList over a streaming source (start it in onMount, stop in the cleanup); rows carry
  ctxProps("log", id) with "Copy line", "Filter by service", "Open trace".
- Incidents publish with key "incident:<id>" so status changes update one feed line with a diff (open → acknowledged → resolved).
- Add a status item showing error rate; colour it with text-up / text-warn / text-down tokens.
- Add settings: refresh interval (advanced), sound on new incident (alerts category), compact log timestamps.
- Keep demos off (demoModules: []). Typecheck and build.
```

## D. Content / docs site

```
Read AGENTS.md. Make this a documentation site for [product].

- Modules: docs (routes "/docs" and "/docs/*"), changelog (/changelog), search.
- /docs/* renders markdown from src/features/docs/content/<path>.md (add a tiny markdown renderer; no heavy deps).
- Sidebar: "fixed", grouped by section, top tabs off.
- Command palette should list every doc page (generate commands from the content index).
- Right-click a heading → "Copy link to section". Right-click a code block → "Copy code".
- Feed: publish "changelog:<version>" when a new version is viewed the first time (quiet: true).
- Theme: light default, accentHue 30, radius 8, comfortable density.
```

## E. Just change the look

```
Read AGENTS.md. Do not add modules. In site.config.ts set accentHue [20], radius [10], density "comfortable",
effects.grid false, effects.glow true, defaultMode "light". In globals.css adjust only the light palette so the panel
colour is warmer. Confirm with a screenshot of / and /showcase in both themes.
```

## F. Add one capability to the shell (rare)

```
Read AGENTS.md §1 and src/core/types.ts. Add a "widget" contribution type: modules can declare `widgets: [{ id, title, component, size }]`
and the home page renders them in a grid. Collect it in src/core/registry.ts, render it in src/features/home/HomePage.tsx,
document it in AGENTS.md's table. Keep the change minimal and typed. Typecheck and build.
```

---

### Verifying like a person would

After any recipe, the agent should run the app and check, by hand or with
Playwright: right-click on a row, ⌘K, change a setting three times and open
the bell (one line), hover a feed column and confirm it freezes, toggle sound
and hear the difference, switch density and theme.
