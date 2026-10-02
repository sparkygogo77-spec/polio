# Claude / agent entry point

This repo is built to the **builder contract**: J's Polio builder reads and restyles every part of
the site, so every change you make must keep it readable. Read `AGENTS.md` (how to work here) and
`BUILDER-CONTRACT.md` (the rules) before touching any page, stylesheet or script.

The short version:

- Every element in `<body>` gets a unique, meaningful `data-hook`. Layout containers too.
- No inline styles, no `<style>` blocks, no class or id selectors, no colours outside `tokens.css`.
- Scripts find elements only by hook (`hook('name')`) and build nothing by hand: repeated parts
  come from `<template data-hook="template-...">`.
- `tokens.css` loads first, `style-layer.css` loads last. Never edit `style-layer.css`; it is the
  design's file.
- New page? Add it to `builder.json`, with at least one preview screen.

Commands:

```
npm run kit:hooks   # rewrite hooks.json from the code (run after any page, CSS or script edit)
npm run kit:check   # the contract check; must pass before you push
npm run kit:diff -- --base origin/main   # no hook the design uses was dropped
npm test            # the kit's own tests
```

`kit:check` and `kit:diff` passing are part of "done". `PIPELINE.md` says how this repo moves
between code and the builder; pull requests from `style/...` branches are J's design. If one fails, fix the code, not the check.
