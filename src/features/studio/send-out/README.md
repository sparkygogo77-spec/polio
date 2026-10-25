# studio/send-out

Sending a design out of the builder: the style layer keyed by hook, exporting
a site, publishing the kit and to a code site, going live, the publish check,
writing a zip, and the design branch. A module of the builder audit's split
(item 11).

**Doors.** Other files import this module only through its doors; anything
deeper fails `tests/module-doors.mjs`. Files in here import each other freely.

- `index.ts`: the pure steps. No React, no store, every import ends in `.ts`,
  so node tests load it directly.
- `run.ts`: the runs that need the bundler's imports (`@/...`, extensionless):
  exporting a site, publishing the kit, going live, the publish check.

| File | Holds |
| --- | --- |
| `styleLayer.ts` | The style layer: only what changed on the board, keyed by hook |
| `codePublish.ts` | Publishing to a code site's repository |
| `zipWrite.ts` | Writing a zip |
| `designBranch.ts` | The design branch a send-back lands on |
| `exportSite.ts` | Exporting the board as a site |
| `kitPublish.ts` | Publishing the builder kit into a site's repository |
| `goLive.ts` | Going live on Vercel |
| `pagesRecord.ts` | The page files a push wrote, so the next takes off the ones no longer pages |
| `buildRecord.ts` | The files Build wrote, so the next push writes them again from the board, keeps the ones a code chat changed and takes off the ones Build no longer writes |
| `publishCheck.ts` | The checks run before publishing |
| `tailwindOf.ts` | CSS declarations as Tailwind classes, the System's tokens by name, any other value exact |
| `pagesOut.ts` | Clean pages: the layout tree as flex and grid, each section a component, every style a class; what is still placed by hand listed for POLIO.md |
| `libraryOut.ts` | The component library: one file per System component in components/ui, variants from tokens, hover and pressed as CSS states, and the gallery page |
| `tokensOut.ts` | The System as four token files (W3C `tokens.json`, `tokens.css`, a Tailwind v4 `@theme`, `tokens.ts`) and the one map of token names the library and pages use |
