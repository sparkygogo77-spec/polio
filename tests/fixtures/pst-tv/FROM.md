# PST's Chart TV, as a repository to bring in

PST's `web/` and its root `builder.json`, copied from sparkygogo77-spec/PST at a8616d7
(default branch claude/wizardly-davinci-92ah39, after PR #20 restyled Play around the TV).
Left out: the hooks maps (`web/hooks.json`, `web/builder-hooks.json`, `web/HOOKS.md`), the
type declarations and the notes (the chart library keeps its LICENSE).

`builder.json` is PST's own, without `hooks`; its `preview.stills` asks for a still of what
the code draws into `chart` on the `tv-idle` preview screen (src/features/studio/stills.ts).

Held by tests/tv-import.mjs.
