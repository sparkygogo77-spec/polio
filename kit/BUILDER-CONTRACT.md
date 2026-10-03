# The builder contract

A site built to this contract can be opened in J's Polio builder and restyled, part by part,
without touching its code. The builder reads `builder.json` first, finds every part by its
`data-hook`, edits the tokens, and sends the design back as one stylesheet, `style-layer.css`,
keyed by `[data-hook="..."]`. The code keeps working because it never depends on anything the
design changes.

`npm run kit:check` enforces every rule marked **(checked)**. It fails the build on any break.

## 1. Every visible element has a hook

- **(checked)** Every element inside `<body>`, `<body>` itself and layout containers included
  (`header`, `main`, `section`, `div`, `ul`, `li`, `span`, `label`...), has a `data-hook`. Only
  `<script>`, `<br>` and `<wbr>` go without.
- **(checked) Unique on its page.** A hook names one element on a page. Parts a script repeats are
  written once inside a `<template>` (see 4); every copy keeps the same hooks.
- **(checked) Meaningful and stable.** Lower-case words joined by dashes, naming what the part is:
  `signup-modal`, `contact-form`, `list-item-name`. Not `div-3`, `box`, `wrapper`. Renaming a hook
  is a breaking change for the design: change the markup, scripts and `hooks.json` together.
- **(checked) One kind per hook.** A hook used on several pages (`site-header`, `page-title`,
  `nav-home`) is the same element kind everywhere, so one design rule fits all of them.
- Naming habits that help the builder group parts: `<area>-<part>` (`home-hero`, `hero-button`),
  buttons end in `-button`, inputs in `-input`, error lines in `-error`, the page body is
  `page-<name>`.

## 2. Styles only through tokens and hook-keyed rules

- **(checked) No inline styles.** No `style="..."` in markup, no `<style>` blocks in pages, and no
  `el.style.x = ...`, `cssText` or `setAttribute('style', ...)` in scripts. A script that works out
  a position or size sets a CSS variable instead: `el.style.setProperty('--marker-left', x + 'px')`,
  and the stylesheet uses `left: var(--marker-left)`.
- **(checked) Colours are tokens.** Every colour is a named variable in `tokens.css`
  (`--color-accent: #2f6fde`). Every other stylesheet, and every script, uses `var(--color-...)`.
  Hex, `rgb()`, `hsl()`, `oklch()` and named colours anywhere else fail. A script that needs a
  colour (a chart) reads the token: `getComputedStyle(document.documentElement).getPropertyValue('--color-accent')`.
  Where there is no styled page to read from (a test in Node, a picture drawn as a data URL), set
  `tokensModule` in `builder.json` (for example `web/tokens.js`): `npm run kit:hooks` writes every
  token's value there as `export const TOKENS = {...}`, and `kit:check` fails if it is stale.
  Import colours from it; never type them.
- **(checked) Every `var(--x)` exists**: a token in `tokens.css` (or `style-layer.css`), or a
  run-time variable declared with its default on the rule that uses it
  (`[data-hook="trade-marker"] { --marker-left: 0; left: var(--marker-left); }`).
- **(checked) Rules are keyed by hook.** Selectors use `[data-hook="..."]` (or `^=` / `$=` for a
  family, like `[data-hook$="-button"]`), element names, `:root`, `html`, `body` or attributes.
  No class or id selectors: classes and ids are free for nothing and so never break.
- Sizes, spacing, fonts and radii should be tokens too (`--space-3`, `--radius`); this is not
  checked, but the builder can only edit what has a name.
- **Script settings are tokens.** A number, colour or piece of text a script uses for how a part
  looks or reads (a chart's line width, a flash's duration, a candle count, a button's label, a
  countdown's warning threshold) is a token in `tokens.css` (`--chart-line-width: 2`,
  `--flash-ms: 400`, `--label-trade: "Trade"`), read with `getComputedStyle` or imported from the
  `tokensModule` (`TOKENS['--flash-ms']`), never typed into the script. The builder lists each
  part's tokens, with the ones its scripts read, as its settings, and sends edits back as token
  changes. Values that decide the rules or money (fees, payouts, limits) stay in the code.
- Scripts show and hide parts with the `hidden` attribute; `base.css` keeps
  `[hidden] { display: none !important; }` so a design rule never shows a hidden part.

## 3. Stylesheet order

- **(checked)** Every page loads `tokens.css` first and `style-layer.css` last. In between:
  `base.css` (what the site needs to work and look decent).
- `style-layer.css` ships empty. It belongs to the design: code changes never edit it. It may
  redefine any token and add any `[data-hook]` rule; it wins because it loads last.

## 4. Script-built elements are declared

- **(checked)** Scripts never build markup: no `createElement`, `innerHTML =`, `outerHTML =` or
  `insertAdjacentHTML`. Anything a script adds is declared in the page as
  `<template data-hook="template-<name>">` holding exactly one element, every part of it hooked,
  and cloned with `fromTemplate('template-<name>')`. The builder sees and styles it like any part.
- **(checked)** Scripts reach elements only by hook, through the helpers in `js/hooks.js`
  (`hook`, `hooks`, `fromTemplate`, `part`) or a literal `[data-hook="..."]` selector. The hook
  name is a plain string. `fill(copy, { 'hook-name': value })` counts too: each quoted key is a
  hook the call writes, and an element held in a variable (`const a = hook('x'); a.href = ...`) is
  followed to the end of its function. When a script must build a name (`nav-${page}`), the same line carries a
  comment listing every name it can be: `// hooks: nav-{home,about,list}`.
- **(checked)** Every hook a script uses exists on a page; every hook a stylesheet names exists.
- **(checked)** Every element a script adds (`append`, `prepend`, `replaceChildren`, `insertBefore`,
  `before`, `after`, `replaceWith`...) lands inside a part a page declares, never on `document.body`
  or beside a part. See `BUILDER-RULES.md` rule 1.
- **(checked)** No inline `<script>` code; scripts live in `.js` files.

## 5. Preview screens

- Every page works frozen and in a chosen state at `page.html?still=1&screen=<name>`:
  `still=1` stops animations and uses sample data and fixed dates; `screen` picks a state (a modal
  open, a form with errors, an empty list). Pages declare their screens in their script with
  `screens({ name: () => ..., ... })`; the first one is the default.
- **(checked)** Every screen listed in `builder.json` is declared by its page's scripts.
- A part a script draws into (a chart, a canvas) is empty when the builder imports the page without
  its scripts. `builder.json` `preview.stills` names such parts by hook, with the screen to take them
  on (`[{ "hook": "chart", "screen": "tv-idle" }]`): the builder opens the preview page at that
  screen from the repository's own files (no network), takes a picture of that part alone, and shows
  it as the part's picture on the board, so a design is made around real content.
- `preview.html` shows every screen from `builder.json` side by side. `gallery.html` shows every
  reusable part on one page (buttons, fields, cards, list rows), using the same hooks as the real
  pages, so one rule can be judged everywhere at once.

## 6. Links

- **(checked)** A control is a link (`<a href>`) only if it leads somewhere; an action is a
  `<button>`. `href="#"`, an empty href or `javascript:` fail unless a script sets the href.
- **(checked)** A link leaves the site only to a host in `builder.json` `links.allowHosts`, and
  never matches a pattern in `links.block`. The defaults carry J's rules: pump.fun allowed;
  DexScreener allowed but never a link to a specific contract address (embeds are fine); no X
  (Twitter) profile links.

## 7. The map and the manifest

- `builder.json` (repo root) is what the builder reads first: kit version, pages, and the paths to
  `hooks.json`, `tokens.css`, `style-layer.css`, the preview page and its screens, and the gallery.
- `hooks.json` is generated (`npm run kit:hooks`) and committed. For every hook: its pages,
  element, the hook around it, whether a script builds it and from which template, the tokens its
  rules use, and every code reference (file, line, function, and whether the code reads, writes or
  listens on it). It also lists each page's stylesheets and scripts and each token with its
  default and the hooks that use it.
- **(checked)** `hooks.json` matches the code. If it is stale, `kit:check` fails: run
  `npm run kit:hooks` and commit the result with the change.
