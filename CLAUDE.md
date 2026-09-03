# Claude / agent entry point

Read **AGENTS.md** first. It is the contract for extending this template: where
things go, how to add a feature module, and the rules that keep the UI feeling
like a terminal (no duplicate news lines, tactile buttons, options hidden under
"advanced", virtualised lists).

Quick commands:

```
npm run dev            # http://localhost:3000
npm run typecheck      # tsc --noEmit
npm run build          # next build (must pass before you push)
npm run new:feature X  # scaffold src/features/X and register it
```

Prompt recipes for turning this into a specific site live in `docs/PROMPTS.md`.
