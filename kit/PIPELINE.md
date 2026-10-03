# Pipeline: a new site, through the builder, either way round

A site made from this kit is worked on in two places: in code, by code chats, and in J's Polio
builder, by J. This page says who does each step, with what command or button, and what proves it
worked. It covers both starts (builder first, code first) and every change after that.

## Who owns what

| Who | Owns | Never touches |
| --- | --- | --- |
| **J** | the look: designs in the builder, decides what ships | code |
| **The builder** (Polio) | `style-layer.css`, the values in `tokens.css`, the `styleAssets` folder if `builder.json` names one | pages, scripts, `base.css`, hook names |
| **A code chat** | pages, scripts, `base.css`, new tokens, `builder.json`, preview screens | `style-layer.css` |
| **A merge chat** | merging the builder's style branches (a code chat whose only job is that) | anything but the merge |

Generated, never edited by hand: `hooks.json` (and `tokens.js` if `builder.json` names a
`tokensModule`). Run `npm run kit:hooks` to rewrite them.

Because the two sides own different files, a design branch and a code branch never conflict. The
checks below catch the one way they can still break each other: code dropping a hook the design
styles.

## The checks

| Command | Proves | Runs |
| --- | --- | --- |
| `npm run kit:check` | every page, stylesheet and script keeps the contract; `hooks.json` is current | every push (GitHub Actions) |
| `npm test` | the kit's own tests | every push |
| `npm run kit:diff -- --base origin/main` | a code change drops no hook the base had | every pull request |
| `npm run kit:diff -- --base origin/main --style-only` | a design change touches only the style layer and token values, and changes no hook; a new `design/record.json` fails only on states it newly puts outside their frame (ones the base's record already had are warned about and counted, never blocking) | every pull request from a `style/...` branch |
| `preview.html?still=1&screen=<name>` | each state of each page renders, still, with sample data | by eye, and in the builder |

The workflow in `.github/workflows/kit-check.yml` runs all of these by itself.

## Route 1: builder first

J designs the site in the builder; the builder hands a code chat a repo that is already
builder-ready.

| # | Step | Who | Command or button | Check that proves it worked |
| --- | --- | --- | --- | --- |
| 1 | Design the pages | J | Builder: **Make a new one** | the pages look right in the builder |
| 2 | Export a builder-ready repo: this kit, `builder.json` listing the pages, every element with a `data-hook`, `tokens.css`, an empty `style-layer.css`, `hooks.json`, `CLAUDE.md`, and a preview screen per page | the builder | Builder command palette (Ctrl+K): **Export for code: a builder-ready repo (zip)**, or **Export for code to a branch of its repo** (pushes a `design/` branch carrying `design/record.json`) | in the export, `npm run kit:check` passes |
| 3 | Put it on GitHub | J (or the builder) | Builder: **Go live** to a new repo | the kit-check run on GitHub is green |
| 4 | Add the logic | a code chat | paste the first prompt below; it works on a branch and opens a pull request | CI green: `kit:check`, `npm test`, `kit:diff` |
| 5 | Merge | the code chat | merge the pull request | CI green on the default branch |

From here, follow **Later changes**.

## Route 2: code first

A code chat builds the site from the starter; J designs it afterwards.

| # | Step | Who | Command or button | Check that proves it worked |
| --- | --- | --- | --- | --- |
| 1 | Make the repo from the kit | a code chat | `npm run kit:new -- ../<site> --name "<Site name>"` from this kit, then `git init`, commit, push as a new repo | it prints `kit:new made ... kit:check passed`; the first CI run is green |
| 2 | Build the site | the code chat | edit pages and scripts; add each state to `builder.json` `preview.screens`; `npm run kit:hooks` | CI green on every pull request; every screen shows at `preview.html?still=1&screen=<name>` |
| 3 | Bring it into the builder | J | Builder: the repo menu, pick the repo, **Bring it in**; the builder reads `builder.json` | the builder lists every page, names parts by their hooks, shows every preview screen |
| 4 | Redesign | J | the builder; it writes only rules keyed by `[data-hook="..."]` and token values | the builder's preview of each screen looks right |
| 5 | Send the design back | the builder | Builder: the repo menu, **Send the design back**, **Open a pull request**: pushes a `style/<name>` branch with `style-layer.css`, `builder-hooks.json` and `design/record.json` only, and opens a pull request. Not **Go live**: that publishes a still copy without the repo's scripts, and the builder says so and asks first | CI green, including `kit:diff --style-only` |
| 6 | Merge the design | a merge chat (or the code chat) | merge the `style/...` pull request | CI green on the default branch; `gallery.html` matches the builder |

## Later changes, either direction

| Change | Who | Steps | Check |
| --- | --- | --- | --- |
| New logic or a new page | a code chat | branch; change; `npm run kit:hooks`; `npm run kit:check`; `npm run kit:diff -- --base origin/main`; pull request; merge | CI green |
| A hook must go or be renamed | a code chat | as above with `--allow-removed`, and say in the pull request which hooks went, so J can move their style | CI green; J sees the note |
| J deleted a part in the builder | a code chat, from the builder's `design/` branch | delete the element and every code reference to it; `npm run kit:diff -- --base <default branch>` passes because `design/HOOK-CHANGES.json` lists the hook as removed (any hook not listed there still fails) | CI green; the hook is gone |
| Build from a design | a code chat, from a `design/` branch carrying `design/record.json` | build each part from the record (hooks kept, token values into tokens), then a look-only capture and `npm run kit:record-diff -- design/record.json <capture>` | record-diff lists no part; kit:check and kit:diff pass |
| A new look | J, then the builder | in the repo menu, **Send the design back**, **Check the code again** re-reads `builder.json` and `hooks.json` from the default branch (new pages and hooks; **Take these in** adds them); J designs; **Open a pull request** | `kit:diff --style-only` green |
| Both at once | both | nothing special: each side touches only its own files. Whoever merges second re-runs CI on the merged result | CI green after both merges |

If a style rule names a hook that a code change removed, `kit:check` fails on whichever pull
request merges second ("rule for hook ..., which no page has"). The chat merging it fixes it: put
the hook back, or ask J to move the style.

## New-site checklist

- [ ] Pick the route: builder first (J has a design) or code first (logic first).
- [ ] Repo made from the kit (`kit:new`) or by the builder's export; `kit:check` passes.
- [ ] `builder.json`: the site's name, every page, a preview screen for every state (empty,
      error, loading, pop-ups), `links.allowHosts` and `links.block` as the project allows.
- [ ] The GitHub workflow is at `.github/workflows/kit-check.yml` and its first run is green.
- [ ] Branch protection on the default branch requires the kit-check run (J, in GitHub settings).
- [ ] `CLAUDE.md` has the project's own rules added under the kit's (networks, money, keys).
- [ ] `preview.html` and `gallery.html` show every screen; `?still=1` gives the same picture twice.
- [ ] `style-layer.css` is empty until the builder's first design arrives.

## First prompt for a new code chat

Paste this as the first message in a new code chat, filling the two lines in angle brackets.

```
You are working on <site name>, a website J designs in the Polio builder. It must stay
builder-ready: read CLAUDE.md, AGENTS.md, BUILDER-CONTRACT.md, BUILDER-RULES.md and PIPELINE.md first, and follow them.
<If the repo is empty: run `npm run kit:new` from the builder kit (sparkygogo77-spec/PST, folder kit/)
to start it, and push that as the first commit.>
The job: <what the site does, its pages, and each state a page can be in>.
Rules:
- Every element gets a data-hook; never rename or drop one the design may style
  (kit:diff tells you); never edit style-layer.css; colours only in tokens.css.
- Add every page state to builder.json preview.screens so the builder can show it.
- Work on a branch, one pull request per job. Before you call it done, run
  npm run kit:hooks, npm run kit:check, npm test and npm run kit:diff -- --base origin/main,
  and paste their summary lines.
- Pull requests from style/... branches are J's design from the builder: merge them once CI is green.
- Keep messages to J short and simple; ask only for real choices (money, keys, accounts, rules).
```

## Builder (Polio) pieces

Checked against the Polio repo on 2026-10-03. The round trip both ways is in the builder:

1. **Export for code** (route 1, step 2): command palette, **Export for code: a builder-ready repo
   (zip)**: this kit's files, `builder.json`, a `data-hook` on every element, `tokens.css`, an empty
   `style-layer.css`, `hooks.json`, `CLAUDE.md` and a preview screen per page.
2. **Export for code to a branch** (Later changes, "Build from a design"): command palette,
   **Export for code to a branch of its repo**: the same, plus `design/record.json`, pushed to a
   new `design/` branch of the site's repo.
3. **Import through `builder.json`** (route 2, step 3): repo menu, **Bring it in**: reads the
   pages, `hooks.json` and `tokens.css`, names parts by their hooks and loads the preview screens.
4. **Send the design back** (route 2, step 5): repo menu, **Send the design back**, **Open a pull
   request**: writes only `style-layer.css` (rules keyed by `[data-hook="..."]`),
   `builder-hooks.json` and `design/record.json` to a new `style/<name>` branch and opens a pull
   request; it never merges.
5. **Re-read before each design round**: in the same panel, **Check the code again** fetches
   `builder.json` and `hooks.json` from the default branch and lists hooks added or removed since
   the last round; **Take these in** brings new ones onto the board.
6. **Go live on a site from code**: publishes a still copy of the pages without the repo's scripts.
   The builder says so in plain words, points to **Send the design back**, and publishes the still
   only after **Publish the still copy**.
7. **Link rules**: links the builder adds follow `builder.json` `links.allowHosts` and `links.block`.
8. **Where the kit comes from**: Polio keeps a copy of `kit/` (`kit/FROM.md`) and embeds these files
   in `src/features/studio/kitFiles.ts` (`npm run kit:files`); change it here first, then copy.

Still open: the still copy drops a captured container's centred `max-width` (a 1100px centred page
renders full window width).
