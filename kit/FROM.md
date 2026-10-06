# Where this kit comes from

Polio's `kit/` is the single source of the builder kit (J, 2026-10-06): the design and build rules
(`BUILDER-RULES.md`, the state rules 12 to 20 among them), the contract, `kit:check`, `kit:diff` and
the starter files (`starter/scenes.json`, `starter/samples.json` and the shared `kit:panels` rule in
`starter/tokens.css`). It was last brought in from sparkygogo77-spec/PST PR #39 (branch
`claude/pst-state-rules-flp9zx`), where the state rules were first adopted.

- Change the kit here first, then run `npm run kit:files`, which embeds the files the Builder's
  Export for code writes (`src/features/studio/kitFiles.ts`).
- A site's copy comes from here: `npm run kit:copy -- ../PST/kit` writes it, and
  `npm run kit:copy -- ../PST/kit --check` fails when it has drifted. The site's own files in its
  kit/ folder (PonsStars' `scenes.json` and `samples.json`) are left alone.
- The Builder runs `tools/kit-check.mjs` on its server to remake `hooks.json` before a design is
  sent (`src/features/studio/kitMap.ts`), and the export test runs it on every export.
