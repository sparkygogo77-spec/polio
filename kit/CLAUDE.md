# Claude / agent entry point

This repo is built to the **builder contract**: J's Polio builder reads and restyles every part of
the site, so every change you make must keep it readable. Read `AGENTS.md` (how to work here) and
`BUILDER-CONTRACT.md` (the rules), and `BUILDER-RULES.md` (the design and build rules every code chat
follows) before touching any page, stylesheet or script.

The short version:

- Every element in `<body>` gets a unique, meaningful `data-hook`. Layout containers too.
- No inline styles, no `<style>` blocks, no class or id selectors, no colours outside `tokens.css`.
- Numbers, colours and text a script uses for how things look or read are tokens in `tokens.css`
  (read with `getComputedStyle` or from `tokens.js`), never literals: the builder edits them.
- Scripts find elements only by hook (`hook('name')`) and build nothing by hand: repeated parts
  come from `<template data-hook="template-...">`.
- `tokens.css` loads first, `style-layer.css` loads last. Never edit `style-layer.css`; it is the
  design's file.
- Anything a script shows later (a box that becomes a button, a message, a result) is a state inside
  a part the builder can see: a declared state of a panel (`data-panel`, `data-states`, parts with
  `data-show`); scripts only set the panel's `data-state`. Never append it outside a part.
- Every visible thing is a real tagged element: no `::before`/`::after` drawings.
- Label parts for the builder (BUILDER-RULES.md rules 21-24): `data-label` (plain name; every panel and
  list), `data-kind` (what a filled-in value is), `data-list` (where template copies go), `data-group`
  (parts that share a look).
- Need a look or setting the builder can't edit yet? Don't drop it or hard-code it: make it a token
  and list it in `builder.json` `rules.slots` (BUILDER-RULES.md rule 4). States stay inside their frame.
- The only `<iframe>` is the DexScreener chart embed; scripts set only the position variables
  `builder.json` `rules.scriptPositions` lists.
- New page? Add it to `builder.json`, with at least one preview screen.
- Building from a design? Build from `design/record.json` (`DESIGN-RECORD.md`): keep each part's
  hook exactly, put every value it marks as a token in `tokens.css`/`tokens.js`, then check the
  build with a look-only capture and `npm run kit:record-diff -- design/record.json <capture>`.

Commands:

```
npm run kit:hooks   # rewrite hooks.json from the code (run after any page, CSS or script edit)
npm run kit:check   # the contract check; must pass before you push
npm run kit:diff -- --base origin/main   # no hook the design uses was dropped
npm run kit:states -- design/record.json # every state stays inside its frame
npm test            # the kit's own tests
```

`kit:check` and `kit:diff` passing are part of "done". `PIPELINE.md` says how this repo moves
between code and the builder; pull requests from `style/...` branches are J's design. If one fails, fix the code, not the check.
