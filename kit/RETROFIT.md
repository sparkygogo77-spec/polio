# Bringing an existing repo up to the contract

The steps below work for any static or lightly scripted site. The worked example is PonsStars
(`sparkygogo77-spec/PST`, folder `web/`), checked on 2 October 2026 against the merged design
readiness work (pull request #6).

## Steps

1. **Copy the kit in.** Into the repo (root, or the folder that serves the site):
   `tools/kit-check.mjs`, `BUILDER-CONTRACT.md`, the `kit:check`, `kit:hooks` scripts from
   `package.json`, and `.github/workflows/kit-check.yml` (set its working directory if the site is
   in a subfolder). Merge `CLAUDE.md` and `AGENTS.md` into the repo's own, keeping the repo's other
   rules.
2. **Write `builder.json`** at the root, pointing at what exists today. If the scripts already reach
   elements through helpers, name them in `scripts.hookCalls` (helper name: which argument is the
   hook) and put the helper file in `scripts.helperFiles`, so nothing needs renaming yet.
3. **Run it once with `--write`** (`node tools/kit-check.mjs builder.json --write`) and sort the
   problem list by kind. Fix in this order, running the check after each:
   1. hooks (missing, duplicate, vague names, one kind per hook);
   2. tokens: move every `:root` variable into `tokens.css`, load it first, and turn each colour
      the check lists into a token;
   3. stylesheet order: `style-layer.css` last, empty;
   4. inline styles from scripts: pass numbers through CSS variables instead;
   5. markup built by scripts: move it into `<template>`s;
   6. run-time hook names: add `// hooks:` comments;
   7. links and inline scripts;
   8. preview screens: each page answers `?still=1&screen=<name>`; list them in `builder.json`.
4. **Commit `hooks.json`** once the check passes, and keep CI running `kit:check`.

Do it in small pull requests, one kind of fix each, with the site's own tests run every time: the
check proves the builder can read the site, not that the site still works.

## Worked example: PonsStars

**Status: done** (2 October 2026). `kit:check` passes on PST's `web/` with no problems; the
manifest is PST's `builder.json` and `server/test/kit-check.test.ts` keeps it that way. What it
took is below; the table was the starting point.

Manifest used for the trial run (at the repo root, nothing renamed):

```json
{
  "kit": "1.0.0",
  "pages": [{ "file": "web/index.html" }, { "file": "web/profile.html" }, { "file": "web/match.html" },
            { "file": "web/leaderboard.html" }, { "file": "web/library.html" }],
  "hooks": "web/hooks.kit.json",
  "tokens": "web/base.css",
  "styleLayer": "web/style-layer.css",
  "preview": { "page": "web/preview.html", "screens": [] },
  "gallery": "web/library.html",
  "scripts": {
    "hookCalls": { "$": 0, "setText": 0, "show": 0, "fromTemplate": 0, "part": 1, "drop": 1 },
    "helperFiles": ["web/dom.js"]
  },
  "links": { "allowHosts": ["pump.fun", "dexscreener.com"] }
}
```

**Already there.** PST mapped cleanly: 639 hooks, with no missing hook, duplicate hook, bad name or
mixed element kind on any page. `style-layer.css` already loads last and is empty, repeated parts
already come from `<template data-hook="template-...">`, scripts already reach elements only
through `web/dom.js`, and most run-time names already carry `// hooks:` comments. PST also has its
own generator (`cd server && npm run hooks`, writing `web/hooks.json` and checked by
`server/test/hooks-map.test.ts`); the kit's map has the same shape of information, so the two can
run side by side (`web/hooks.kit.json`) until PST switches over.

**What the check reported (71 problems), and the fix for each:**

| Count | Problem | Fix in PST |
| ---: | --- | --- |
| 17 | Colours in scripts (`avatars.js` 13, `overlay.js` 4) | Add tokens (`--avatar-*`, `--overlay-*`) and read them with `getComputedStyle` |
| 12 | Scripts set inline styles (`app.js` trade markers, `preview.js` frame sizing) | Set CSS variables (`--marker-left`, `--marker-top`) and use them in `base.css` |
| 11 | Colours in `base.css` outside a variable (`#fff`, `rgba(...)`, `#2563eb`...) | Create `web/tokens.css` with the `--pons-*` variables plus these colours; load it first |
| 11 | Scripts build markup (`app.js` 7, `preview.js` 4) | Declare each in a `<template>` and clone it |
| 11 | Links with `href="#"` that a script fills through a variable | Set the href through a hook helper call (`part(row, 'history-opponent-link').href = ...`) so the map sees the write |
| 5 | Inline `<script type="module">` in pages | Move each to `web/<page>.js` |
| 2 | Run-time hook names without a comment (`app.js:62`, `tour.js:202`) | Add `// hooks: ...` lists |
| 1 | `base.css` is first, not a tokens file | Follows from the `tokens.css` split |
| 1 | A link to a chart library's site | Gone: the site now draws its own charts (`web/pons-chart.js`), so no credit link is needed |

**Preview screens.** PST's pages take `?preview=<screen>` and `preview.html` takes
`?still=1&screen=<name>`. To meet the contract, each page also accepts `?still=1&screen=<name>`
(a rename of its existing `preview` parameter), and the screen names go into `builder.json`.

**Order for PST.** 1) `tokens.css` split and colour tokens; 2) inline styles to CSS variables;
3) templates for script-built markup; 4) links, inline scripts, `// hooks:` comments;
5) screens in `builder.json`, then switch `server/test/hooks-map.test.ts` to run `kit:check`.
Steps 1 and 2 touch `web/`, so they wait until no other thread is changing it.
