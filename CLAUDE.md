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
npm run test:changed   # only the tests the change since trunk touches, plus the smoke set
```

Prompt recipes for turning this into a specific site live in `docs/PROMPTS.md`.
Before changing anything a person sees in the Builder, read `docs/DESIGN.md`:
the menu's design language, the rules it lives by, and how the owner works.
