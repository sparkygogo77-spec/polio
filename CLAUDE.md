# Claude / agent entry point

Read **AGENTS.md** first. It is the contract for extending this template: where
things go, how to add a feature module, how the Builder is structured, and the
rules that keep the UI feeling good (no duplicate news lines, tactile buttons,
options hidden under "advanced", virtualised lists, plain names).

Quick commands:

```
npm run dev            # http://localhost:3000 — the Builder is at /builder
npm run typecheck      # tsc --noEmit
npm run build          # next build (must pass before you push)
npm run new:feature X  # scaffold src/features/X and register it
npm run test:all       # every test in tests/, each on the server its header asks for, then a pass/fail table
npm run test:changed   # only the tests whose files the change reaches (imports, routes, hooks), plus the smoke set
npm run test:nightly   # build, then the whole suite: the nightly run
```

Checking something on PonsStars (or any brought-in site)? Don't bring it in.
Open the saved board instead: it is PST already imported (parts, pictures,
stills), and it opens in about three seconds. It drives the last `npm run build`
(or pass `--url` to a Builder already running).

```
npm run board -- shot pst out.png      # a picture of the Builder with PST on it
npm run board -- show pst              # which PST commit the saved board is
npm run board -- refresh pst           # only when PST changed, or the importer did and your check must see it
```

In a test: `const st = await openBoard(page, URL_BASE, "pst")` from
`tests/lib/board.mjs` (see `tests/saved-board.mjs`). Bring a site in for real
only when the import itself is what you changed. Another site gets a board
the same way: add it to `SITES` in `scripts/board.mjs`.

Prompt recipes for turning this into a specific site live in `docs/PROMPTS.md`.
Before changing anything a person sees in the Builder, read `docs/DESIGN.md`:
the menu's design language, the rules it lives by, and how the owner works.
Before changing a Builder file, search `docs/BUILDER-HISTORY.md` for that file
and its test (`rg -n Canvas.tsx docs/BUILDER-HISTORY.md`): it is the long record
of why each Builder behaviour is the way it is, moved out of AGENTS.md so that
file stays a short working guide. Don't read it whole.

Rule from the owner: never wait on J silently. Whenever a thread is blocked or
waiting on J (a test, a key, a payment, an account setting, a decision), say so
right away in one short line naming exactly what J must do.
