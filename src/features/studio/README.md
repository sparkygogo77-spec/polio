# studio

The Builder. Big files are split into folders of topic files; each old file (`Canvas.tsx`, `store.ts`, ...) stays as a thin re-export, so imports never change. Modules (`board/`, `bring-in/`, `look/`, `states/`, ...) are entered only through their doors (`tests/module-doors.mjs`). Open the folder README to find which file holds what, and read only that file.

| Folder | What it is | Re-exported by |
| --- | --- | --- |
| `board/` | Module: the board (pointer handling, parts, ink, wires, press rules) and the Builder's store. Doors: `index.ts`, `store.ts`, `ui.ts`, `reads.ts` | `Canvas.tsx` |
| `bring-in/` | Module: reading a site, capturing it, bringing a repository or zip in, From a site. Doors: `index.ts`, `ui.ts` | — |
| `look/` | Module: colour, texture, light and motion maths, site colours, style kits, fonts, part looks, the Look panel. Doors: `index.ts`, `parts.ts`, `ui.ts` | — |
| `send-out/` | Module: the style layer, exporting a site, publishing the kit and to a code site, going live, the publish check, zips, the design branch. Doors: `index.ts`, `run.ts` | — |
| `states/` | Module: a page's states, panels, Show switch, Structure view. Doors: `index.ts`, `ui.ts` | — |
| `inspector/` | The side panel's fields | `Inspector.tsx` |
| `page/` | The Builder page: top, toolbar, side panel frame | `StudioPage.tsx` |
| `palette/` | The shelf under the board | `Palette.tsx` |
| `radial/` | The part menu (the wheel) | `RadialMenu.tsx` |
| `timeline/` | The timeline of builds (Finish) | `Timeline.tsx` |
| `scaffolding/` | Writing a Next.js site from the board | `scaffold.ts` |
| `library/` | Part library, behaviours (`behaviourScripts/`), learned looks | — |
| `parts/` | One file per kind of part | — |
| `live/` | The live and preview site renderer | — |

Still one big component each, because splitting them would be a rewrite rather than a move: `board/DesktopCanvas.tsx` (about 2,200 lines), `timeline/Timeline.tsx`, `radial/RadialMenu.tsx`.
