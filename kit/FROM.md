# Where this kit comes from

A copy of `kit/` from sparkygogo77-spec/PST (branch `claude/wizardly-davinci-92ah39`, commit
2c9fac2, PR #12), so the Builder can export builder-ready repos and check designs against the
same contract (PIPELINE.md, "Where the kit comes from", the copy option).

- Change the kit in PST first, then copy it here again and run `npm run kit:files`, which embeds
  the files the export writes (`src/features/studio/kitFiles.ts`).
- The Builder runs `tools/kit-check.mjs` on its server to remake `hooks.json` before a design is
  sent (`src/features/studio/kitMap.ts`), and the export test runs it on every export.
- If a second site appears, move the kit to its own repo that PST and Polio both read.
