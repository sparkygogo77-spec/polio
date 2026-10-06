# studio/scaffolding

Writing a Next.js site from the board, split by topic. `../scaffold.ts` re-exports everything. Imports keep their `.ts` extension so tests can load these in Node.

| File | Holds |
| --- | --- |
| `types.ts` | `ScaffoldFile`, `ScaffoldPage`, `ExportLayout`, `ExportBehaviours`, `ScaffoldPart`, `ScaffoldInput`, `EXPORT_KEYFRAMES` |
| `jsx.ts` | HTML to JSX: `hrefOf`, `styleToObject`, `htmlToJsx`, `componentName` and their helpers |
| `scaffold.ts` | `scaffold` (the entry point) and the 3D cube part |
| `pages.ts` | Tokens CSS, root layout, one part, one page |
| `frameMesh.ts` | The responsive `Frame`/`Place` file and the 3D mesh part |
| `shell.ts` | The behaviours shell (`SHELL_CSS`, `SHELL_TSX`) and the README writer |
