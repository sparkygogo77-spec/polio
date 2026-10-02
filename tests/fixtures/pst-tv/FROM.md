# PST's Chart TV, as a repository to bring in

PST's `web/` and its root `builder.json`, copied from sparkygogo77-spec/PST at 9b39af8
(default branch claude/wizardly-davinci-92ah39, after PR #14 put the chart in the Chart TV).
Left out: the hooks maps (`web/hooks.json`, `web/builder-hooks.json`, `web/HOOKS.md`), the
type declarations and the notes (the chart library keeps its LICENSE).

One line is added to `builder.json`: `preview.stills`, asking for a still of what the code
draws into `chart` on the `tv-idle` preview screen (src/features/studio/stills.ts).

Held by tests/tv-import.mjs.
