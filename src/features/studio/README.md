# studio

The Builder. Big files are split into folders of topic files; each old file (`Canvas.tsx`, `store.ts`, ...) stays as a thin re-export, so imports never change. Open the folder README to find which file holds what, and read only that file.

| Folder | What it is | Re-exported by |
| --- | --- | --- |
| `store/` | The Builder's state and actions | `store.ts` |
| `canvas/` | The board: pointer handling, parts, ink, wires | `Canvas.tsx` |
| `inspector/` | The side panel's fields | `Inspector.tsx` |
| `page/` | The Builder page: top, toolbar, side panel frame | `StudioPage.tsx` |
| `palette/` | The shelf under the board | `Palette.tsx` |
| `radial/` | The part menu (the wheel) | `RadialMenu.tsx` |
| `timeline/` | The timeline of builds (Finish) | `Timeline.tsx` |
| `fromasite/` | Bringing a site in | `FromASite.tsx` |
| `siteread/` | Scripts run inside a page to read it | `siteRead.ts` |
| `lookparts/` | Colour, texture, light and motion maths | `look.ts` |
| `scaffolding/` | Writing a Next.js site from the board | `scaffold.ts` |
| `library/` | Part library, behaviours (`behaviourScripts/`), learned looks | — |
| `parts/` | One file per kind of part | — |
| `live/` | The live and preview site renderer | — |

Still one big component each, because splitting them would be a rewrite rather than a move: `canvas/DesktopCanvas.tsx` (about 2,200 lines), `timeline/Timeline.tsx`, `radial/RadialMenu.tsx`.
