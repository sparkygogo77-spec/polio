# Claude / agent entry point

This repo is built to the **builder contract**: J's Polio builder reads and restyles every part of
the site, so every change you make must keep it readable. Read `AGENTS.md` (how to work here) and
`BUILDER-CONTRACT.md` (the rules), and `BUILDER-RULES.md` (the design and build rules every code chat
follows) before touching any page, stylesheet or script.

**First, read `polio/NEXT.md` if it exists.** It is the queue J fills from the builder: each line is a
problem the builder found and J ticked to fix next, naming the part by its `data-hook`, what is wrong
and what done looks like. Fix those lines before anything else you were asked, unless the ask says
otherwise. In the same pull request tick each fixed line (`- [x]`) or delete it, and leave its
`<!-- fix:... -->` comment as it is: the builder's Refresh reads the file back and shows ticked or
deleted lines as fixed. Never add lines yourself; only the builder writes new ones.

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
- Layout blocks that hold parts (a column, a side bar, the main area) carry `data-region="<name>"` and
  `data-label`, and every panel sits in one (BUILDER-RULES.md rule 32): the builder's Structure view
  reads them.
- A hover or press effect goes once on the panel, card or button that reacts as one, never repeated on
  the text and buttons inside it (BUILDER-RULES.md rule 33).
- The box a script fills and measures (a game screen, a chart, a map) carries `data-app-area="<plain name>"`
  beside its `data-hook`; the script measures it and fills it, so the area can go anywhere and the app
  follows. Keep every app area in a redesign or a new site (BUILDER-RULES.md rule 34).
- Every page loads `vendor/builder-motion.js`, the builder's motion file (BUILDER-RULES.md rule 35): never edit
  it or write `--builder-motion` yourself; Publish names motions on hooks in the style layer and it runs them.
- Every visible thing is a real tagged element: no `::before`/`::after` drawings.
- Label parts for the builder (BUILDER-RULES.md rules 21-24): `data-label` (plain name; every panel and
  list), `data-kind` (what a filled-in value is), `data-list` (where template copies go), `data-group`
  (parts that share a look).
- Need a look or setting the builder can't edit yet? Don't drop it or hard-code it: make it a token
  and list it in `builder.json` `rules.slots` (BUILDER-RULES.md rule 4). States stay inside their frame.
- Every code pull request leaves a change note (`npm run kit:notes`, rule 26). A look the builder
  can't edit in any slot kind yet goes in `builder.json` `rules.requests` (rule 27), with a prompt
  J pastes into a Polio chat.
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
npm run kit:notes -- --base origin/main --why "..."   # the change note the builder reads (rules 26-27)
npm run kit:states -- design/record.json # every state stays inside its frame
npm test            # the kit's own tests
```

`kit:check` and `kit:diff` passing are part of "done". `PIPELINE.md` says how this repo moves
between code and the builder; pull requests from `style/...` branches are J's design. If one fails, fix the code, not the check.
