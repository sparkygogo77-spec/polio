# Working in a builder-ready repo

This repo's pages are edited in two places: here, in code, and in J's Polio builder, which
restyles them. The builder reads `builder.json`, then `hooks.json`, and sends its design back as
`style-layer.css`. Your job is to change how the site works without ever breaking how it can be
designed. The rules are in `BUILDER-CONTRACT.md` and `BUILDER-RULES.md`; `npm run kit:check` enforces them.
Above all (`BUILDER-RULES.md` rule 1): anything a script shows later is a state inside a part the
builder can see (a hooked child hidden until shown), never a new element outside it, and it stays
inside that part's frame. When the code needs a look or setting the builder lacks, add a slot
(`rules.slots`, rule 4): never drop the design or work around the builder.

## Where things go

| What | Where |
| --- | --- |
| The manifest the builder reads first | `builder.json` |
| Pages | the paths listed in `builder.json` `pages` |
| Colours, fonts, sizes, spacing | `tokens.css` (`:root { --name: value }`) |
| What the site needs to work and look decent | `base.css`, rules keyed by `[data-hook="..."]` |
| The design | `style-layer.css` (empty; never edited by code changes) |
| Hook helpers, preview states | `js/hooks.js` (`hook`, `hooks`, `fromTemplate`, `part`, `screens`) |
| Generated map of every hook | `hooks.json` (`npm run kit:hooks`; never edited by hand) |
| Every screen frozen side by side | `preview.html` (screens listed in `builder.json`) |
| Every reusable part on one page | `gallery.html` |

## Adding or changing a page

1. Copy an existing page so the head is right: `tokens.css` first, `base.css`, `style-layer.css`
   last, one `<script type="module" src="js/<page>.js">`.
2. Give `<body>` the hook `page-<name>` and every element inside a hook (see naming below).
3. Anything a script repeats or adds goes in a `<template data-hook="template-<thing>">` holding
   one element; clone it with `fromTemplate` and fill its parts with `part(copy, 'hook')`.
4. In the page's script, declare its states: `screens({ '<name>': () => {}, '<name>-empty': ... })`.
5. Add the page to `builder.json` `pages`, and each state to `preview.screens`.
6. Style it in `base.css` with `[data-hook="..."]` rules and `var(--token)` values. Need a new
   colour? Add a token to `tokens.css` first.
7. `npm run kit:hooks && npm run kit:check`, then commit `hooks.json` with the change.

## Naming hooks

- Lower-case words joined by dashes that say what the part is: `contact-form`, `email-error`,
  `list-item-name`. The builder shows these names to J; write them for a person.
- `<area>-<part>`: `home-hero`, `hero-button`, `modal-title`.
- Endings the builder groups by: `-button`, `-input`, `-field`, `-error`, `-title`, `-text`,
  `-link`, `-list`, `-item`. Templates start with `template-`. Page bodies start with `page-`.
- A part that appears on several pages keeps one hook and one element kind everywhere.
- Renaming a hook drops the design's rules for it. Don't rename without a reason; when you must,
  say so in the pull request so J can move the style.

## Scripts

- Reach elements only with the helpers or a literal `[data-hook="..."]` selector. If a name is
  built at run time, put `// hooks: name-{a,b,c}` on that line listing every possibility.
- Show and hide with the `hidden` attribute. Never set inline styles; to pass a computed number
  to CSS, set a variable: `el.style.setProperty('--bar-width', pct + '%')`.
- Colours, numbers and text a script needs for how things look or read (charts, canvas, durations,
  labels) come from tokens via `getComputedStyle` or the `tokensModule`; never type them into a
  script. Rules and money stay in the code.
- `?still=1` must give a stable picture: no animation, fixed sample data and dates.

## Links

An action is a `<button>`; a link goes somewhere. Outside links only to hosts in
`builder.json` `links.allowHosts`, never matching `links.block` (by default: pump.fun allowed;
DexScreener allowed but never to a specific contract address; no X profile links).

## Before you push

```
npm run kit:hooks
npm run kit:check
npm test
npm run kit:diff -- --base origin/main
```

All four must pass. Never weaken the check, add an ignore, or edit `hooks.json` by hand to get
green; fix the page instead.

## Building from a design record

When a branch carries `design/record.json` (written by the builder or the capturer, format in
`DESIGN-RECORD.md`), build from it:

1. Each part keeps its `hook` as its `data-hook`, exactly; a part without one gets a hook from its
   `label`.
2. Each value a part lists under `tokens` goes into `tokens.css` under that token name (and
   `tokens.js` via `npm run kit:hooks`); styles and scripts use the token.
3. `states` become `:hover` / `:active` rules and the `hidden` attribute; `breakpoints` become media
   queries.
4. Check it: take a look-only capture of the built page and run
   `npm run kit:record-diff -- design/record.json <capture>.json --page <file>`. Fix every part it
   lists, then `kit:check` and `kit:diff`.

