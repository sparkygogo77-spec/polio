# Builder-ready starter kit

A foundation for sites that J's Polio builder can read and edit from day one. Copy this folder to
the root of a new repo (or copy its files into an existing one, see `RETROFIT.md`) and any code
chat working there follows the contract without being told.

| File | What it is |
| --- | --- |
| `BUILDER-CONTRACT.md` | The rules every page, stylesheet and script keeps |
| `CLAUDE.md`, `AGENTS.md` | Instructions a code chat reads on arrival |
| `builder.json` | The manifest the builder reads first: kit version, pages, and where everything is |
| `tools/kit-check.mjs` | The checker: builds `hooks.json`, fails on any broken rule. No dependencies |
| `.github/workflows/kit-check.yml` | Runs the check and tests on every push and pull request |
| `starter/` | A small sample site built to the contract: home (with a modal), about, a form, a list drawn by script, plus `preview.html`, `gallery.html`, `tokens.css`, an empty `style-layer.css` and `hooks.json` |
| `test/` | Tests: the check passes on `starter/` and fails on each purpose-broken fixture |
| `PIPELINE.md` | Who does what, with which command, from a new site to the builder and back, either way round; a new-site checklist and a first prompt for a code chat |
| `tools/new-site.mjs`, `tools/kit-diff.mjs` | `kit:new` starts a new site from this kit; `kit:diff` checks a branch against the one it merges into |
| `RETROFIT.md` | Bringing an existing repo up to the contract, with PonsStars as the worked example |

```
npm run kit:check   # check everything builder.json lists
npm run kit:hooks   # rewrite hooks.json from the code
npm run kit:diff -- --base origin/main   # no hook the design uses was dropped (--style-only for the builder's design)
npm run kit:new -- ../my-site --name "My site"   # start a new site from this kit
npm test            # kit tests
npm run serve       # then open http://localhost:8080/starter/preview.html
```

Needs only Node 18 or newer (and Python 3 for `npm run serve`; any static server works).
