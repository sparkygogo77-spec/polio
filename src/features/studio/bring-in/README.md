# studio/bring-in

Bringing a site into the builder: the scripts run inside a page to read it
(`siteread/`), turning what was read into parts (`pageParts.ts`), capturing a
live site, bringing a repository or a zip in, reading a site's own source,
keeping the owner's edits on a second import, re-capturing, and the From a
site screen (`fromasite/`). A module of the builder audit's split (item 11).

**Doors.** Other files import this module only through its doors; anything
deeper fails `tests/module-doors.mjs`. Files in here import each other freely.

- `index.ts`: the pure reads. No React, no store, every import ends in `.ts`,
  so node tests (and `styleLayer.ts`) load it directly.
- `ui.ts`: From a site, the import strip, and re-capturing (store-bound).

| File | Holds |
| --- | --- |
| `siteRead.ts`, `siteread/` | Scripts run in a page: candidates, measuring, faces, parts |
| `pageParts.ts` | What a page read becomes on the board: parts, report chips |
| `sourceSite.ts` | Reading a site's own source files (JSX, Tailwind) |
| `captureSite.ts` | Capturing a live site through a workflow run |
| `repoImport.ts` | Bringing a repository in |
| `zipImport.ts` | Bringing a zip in |
| `reimport.ts` | Keeping the owner's edits when a site comes in again |
| `recapture.ts` | Re-capturing a site already on the board |
| `FromASite.tsx`, `fromasite/` | The From a site screen and the import strip |
