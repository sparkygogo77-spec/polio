# studio/shelf

The parts and the shelf they come from: the part catalog, one file per kind of
part (`parts/`), the part library with its behaviours, learned looks and badges
(`library/`), the shelf under the board (`palette/`, `Palette.tsx`) and the
shelf's groups and plan. A module of the builder audit's split (item 11).

**Doors.** Other files import this module only through its doors; anything
deeper fails `tests/module-doors.mjs`. Files in here import each other freely.

- `index.ts`: the pure parts. No React, no store, every import ends in `.ts`,
  so node tests load it directly: `catalog.ts`, `shelfGroups.ts`,
  `shelfPlan.ts`, `library/` (but its hooks and `repoFeatures.ts`) and the
  pure helpers in `parts/` (spans, cube faces and pose, lead-in, offsite links,
  captured motion, tint, types).
- `run.ts`: a part's theme (`parts/theme.ts`) and a repository's features
  (`library/repoFeatures.ts`), which need the bundler's imports.
- `ui.ts`: the part renderers (`parts/*.tsx`, `parts/index.ts`), the shelf
  screens, and the library hooks (`useLibrary`, `useLearned`).

Doors are named re-exports, not `export *`. A name re-exported by two files in
here (a shim) appears once in a door.
