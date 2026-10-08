# studio

The Builder. Big files are split into folders of topic files; each old file (`Canvas.tsx`, `store.ts`, ...) stays as a thin re-export, so imports never change. Modules (`board/`, `bring-in/`, `look/`, `states/`, ...) are entered only through their doors (`tests/module-doors.mjs`). Open the folder README to find which file holds what, and read only that file.

| Folder | What it is | Re-exported by |
| --- | --- | --- |
| `board/` | Module: the board (pointer handling, parts, ink, wires, press rules) and the Builder's store. Doors: `index.ts`, `store.ts`, `ui.ts`, `reads.ts` | `Canvas.tsx` |
| `bring-in/` | Module: reading a site, capturing it, bringing a repository or zip in, From a site. Doors: `index.ts`, `ui.ts` | — |
| `loop/` | Module: the timeline of builds (Finish), threads and strands, lanes, the build queue, the agent. Doors: `index.ts`, `run.ts`, `ui.ts` | — |
| `look/` | Module: colour, texture, light and motion maths, site colours, style kits, fonts, part looks, the Look panel. Doors: `index.ts`, `parts.ts`, `ui.ts` | — |
| `pictures/` | Module: making and keeping pictures (the image route, the picture store, remaking a part's picture), sketches and the drawing board, the Pictures panel. Doors: `index.ts`, `run.ts`, `ui.ts` | — |
| `send-out/` | Module: the style layer, exporting a site, publishing the kit and to a code site, going live, the publish check, zips, the design branch. Doors: `index.ts`, `run.ts` | — |
| `shelf/` | Module: the part catalog, one file per kind of part (`parts/`), the part library and behaviours (`library/`), the shelf under the board (`palette/`), its groups and plan. Doors: `index.ts`, `run.ts`, `ui.ts`, `screens.ts` | — |
| `states/` | Module: a page's states, panels, Show switch, Structure view. Doors: `index.ts`, `ui.ts` | — |
| `inspector/` | The side panel's fields | `Inspector.tsx` |
| `page/` | The Builder page: top, toolbar, side panel frame | `StudioPage.tsx` |
| `radial/` | The part menu (the wheel) | `RadialMenu.tsx` |
| `scaffolding/` | Writing a Next.js site from the board | `scaffold.ts` |
| `live/` | The live and preview site renderer | — |

Still one big component each, because splitting them would be a rewrite rather than a move: `board/DesktopCanvas.tsx` (about 2,200 lines), `loop/timeline/Timeline.tsx`, `radial/RadialMenu.tsx`.
