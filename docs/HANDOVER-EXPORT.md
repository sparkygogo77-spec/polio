# Handover: the HTML and CSS export

The site as files a person can open: an `index.html` per page, one stylesheet,
the pictures. `src/features/studio/exportSite.ts`, reached as
`window.__studioExport()`; `scripts/export-site.mjs` writes it to a folder whose
`index.html` opens from disk. **Publish and Go live send it** (`collectFiles`
in `goLive.ts`): the first Go live shipped `staticSite`'s pages, with every
link a button and nothing behind it (`tests/published-site.mjs`). (The guard
that was missing, a Publish overwriting sink's main with the board's document,
is in place: see "Where Publish goes" below.)

## What it is

- **One width, fitted to the window.** Laid out at the width the site was
  captured at (1763 for sink), then drawn at the window's width with CSS
  `zoom` (`frameCss`): no sideways scroll below it, and the header bar,
  sidebar and background reach both edges above it. No breakpoint is
  invented. For one to be real, the capture would have to record, per
  element, how its width was specified (a share, "the rest", a fixed px), its
  margins as margins rather than the positions they produced, and the page's
  layout at a second viewport width. It records none of these.
- **The head:** the site's picture (`siteLogo`) as icon and share picture,
  the description typed under the site's name in the Pages panel, Open Graph,
  and og:url once the site has an address.
- **The same markup as the preview.** `staticSite.ts` already rendered each
  page with the preview's own `LiveSite` and read it back; that markup is kept
  (`markupOf` is shared) rather than written a second way.
- **What changes round it:** the six roles are custom properties on `:root`,
  and every colour in a style that is a role is written `var(--role)`; the
  carried faces are `@font-face` from their bytes, without where they were
  captured; 8 KB of stylesheet (palette, faces, the resets the parts rely on)
  in place of the app's 126 KB; every `data-*` attribute and `title` taken
  off, each part keeping its id as a plain `id`; no document, blueprint,
  prompt or capture in the tree.
- **A still, apart from its links.** React handlers are gone, and entrance animations name
  keyframes the app's stylesheet held, so the page arrives already arrived.
- **Hand-editable in its colours and faces, not yet in its layout.** Every part
  is positioned absolutely, inline, as the board draws it. The document does
  carry real flex and grid on 223 parts; emitting those as layout is the next
  step, and is a choice to be measured, not a fidelity gain at one width.

## Links (`tests/export-links.mjs`)

Every part and run of words the document gives a link is a real `<a href>`.
On ab38c88 the export had not one: the preview presses its links through
React (a button, a span with a link role, and for a box nothing at all,
since a box reads no link), and with React gone each was dead. The old run
check counted a span with a link role as a link, so it passed.

- **What the document holds, on sink, fresh import:** 83 links. 65 buttons
  (page links: the sidebar on the eight app pages, plus docs' "Launch
  SOLCINERATOR"), 17 boxes (page links to Documentation: two icon boxes on
  each app page, and docs' SOLCINERATOR logo box back to home), 1 run of words
  (pump.fun, a url). No picture carries one, and no link points at a part.
- **How each is written:** a run becomes an inline `<a>` with its own style;
  a button becomes an `<a>` with the button's own style (a link cannot hold
  a button); a box has its insides held in an `<a>` with `display: contents`,
  which draws no box. A page link goes to the file that page is exported as,
  relative and ending in `index.html`, so the tree works opened from disk as
  well as served; a url opens in a new tab, as the preview opens one.
- **Measured:** 83 held, 83 emitted, page by page; all 83 pressed with a real
  mouse land on their target and it opens; 73 of 73 page-to-page pairs
  reached. All nine pages are byte-identical PNGs before and after the
  anchors, and the preview comparison below is unchanged to the pixel.
### One cause, two workarounds

**The capture flattens containment.** Things the original site had inside a
link (the sidebar entries' icons, the icon boxes' icons, the Documentation
logo's icon and name) arrive as parts beside the link, drawn on top of it or
in its padding. Both declarations below work round that one cause, in the
export only, and nothing else. If a future lane fixes containment in the
converter, **both can be deleted**: they become unnecessary rather than
wrong, and nothing else leans on them. Neither moves a pixel: all nine pages
are byte-identical PNGs to the export before any links existed.

1. **A part sitting wholly on a link lets the press through**
   (`pressThrough` in `exportSite.ts`): `pointer-events: none` on a part
   whose box is wholly inside a linked part's box (to 0.01px; clipping a
   corner does not count) and which has no link, no linked run and nothing
   pressable of its own. On sink, 10 parts on each app page and 2 on docs.
2. **A part's link is stretched over its part** (`stretchLinks`): an empty,
   transparent `::after` on the link, placed over the part, so a press
   anywhere on the part follows it. A button's link sits in the part's
   `Fill`, which is `position: relative` and clips, so on its own the layer
   stopped at the words' box; that one box is set back to `position: static`
   (`.link-fills-part-frame`), which draws nothing differently only when it
   has no offset, z-index, transform or filter and nothing placed inside it.
   Measured on sink, every button has exactly one such box, with none of
   those. Only where the part holds exactly one link and nothing else
   pressable, counted from the document (its own link and every linked run)
   and the page (every control): two links under one layer would have one
   silently win. On sink, 10 parts on each app page and 2 on docs take it,
   and the guard holds back **0**: sink has no part with two links, so there
   the guard does no work. The test gives it a part that does (a copy of the
   pump.fun line with a page link of its own as well): nothing is stretched
   over it, nothing is nested, and pump.fun still follows. Its own page link
   is left out rather than wrapped round a link, and the count says so. That
   fixture also found that the exporter used to wrap such a part's link round
   its run's link, which a browser tears into six links when it reads the
   file. Nothing on sink has that shape.

**Measured after both:** every linked part is pressable over 100% of its box,
sampled every 4px. The sidebar entries went from 36%, and docs' "Launch
SOLCINERATOR" from 41%. The icon boxes went from 75%, and the docs logo from
7%, so its name "SOLCINERATOR" now follows. Every part sitting on a link,
pressed in its middle, follows it (10 per app page, 2 on docs). 83 of 83
links followed, 73 of 73 page-to-page pairs reached.

### Known defect, not fixed: the preview's sidebar icons

In the Builder's preview, pressing a sidebar icon does not follow the link.
The owner has not raised it and the Builder is not what the export ships, so
it is recorded, not fixed. Measured on sink's home page, all eight entries:
the part is 223 by 44 and its button, the only thing that follows, is 159
by 20.1, so **36% of the entry** takes the press (sampled every 4px). The
icon (for example n_drawnicon_62 on n_ctaprimary_61, Cleanup) sits in the
part's padding. Pressed in its middle, the preview stays on page_home;
pressing the words, as a control, goes to page_cleanup. The same cause as
above. The preview also does not follow a box's link at all, since a box
reads none.

### A sampling resolution can decide a result

The docs logo was first reported as **14%** pressable. That number came from
an 8 by 8 grid of sample points per link. The grid was too coarse to see a
20px icon on a 223px button: it reported the sidebar buttons as fully free
while a press on their icons did nothing. At a point every 4px (never fewer
than 8 a side), the same logo measures **7%**. Neither number was a
calculation error: the resolution decided the result. Before trusting a
coverage number, check that the sampling is finer than the smallest thing
that can cover. The test now samples every 4px.

### How the links were proved, kept because it is how to prove the next thing

- The amended run check was proved red on the old exporter before it was
  trusted green on the fix.
- The flaw was in a check before it was in the export: `export-page.mjs`
  counted a span with a link role as a link, which is what let the dead
  links through. The check was fixed, not the symptom.
- Two false failures were a test window shorter than the page, not the
  export: a press is measured in a window taller than the page.
- A url link whose target is `javascript:` is not written as an href.
- Page links end in `index.html` rather than a bare folder, so the tree
  works opened from disk.
- What is still under another part is reported per link, every 4px, so
  the next covered link is noticed; a guard that does no work on sink is
  shown working on a fixture, not assumed.

## Measured, sink, every page (`tests/export-page.mjs`)

Each page against the preview of the same page at 100%, both pictures settled.
Every letter is also held to where the preview puts it, to 0.001px: all nine
pages pass that, 186 to 1098 letters each, none moved and none missing. The
pixel bar is 1%, a convention, measured with the exported page lifted onto a
layer of its own for the picture only (never in the export), because the
preview draws its page inside a composited layer and Chromium rasterises
words differently there. The coordinator accepted that convention once it
was diagnosed rather than tuned to.

| page | letters | as exported | px per letter | on its own layer |
|---|---|---|---|---|
| home | 471 | 16945 (0.57%) | 36.0 | 4514 (0.15%) |
| cleanup | 406 | 16878 (0.60%) | 41.6 | 0 |
| tokens | 186 | 7652 (0.27%) | 41.1 | 0 |
| nfts | 436 | 16456 (0.59%) | 37.7 | 0 |
| cnfts | 459 | 17892 (0.64%) | 39.0 | 0 |
| domains | 193 | 8261 (0.30%) | 42.8 | 0 |
| lp | 476 | 18535 (0.66%) | 38.9 | 0 |
| unknown | 456 | 15083 (0.54%) | 33.1 | 0 |
| docs | 1098 | 41012 (1.46%) | 37.4 | 11867 (0.42%) |

**Docs, traced.** It was the one page over 1% as exported, four times its
neighbours. Per letter it is not: 37.4 px, inside the 33 to 43 every page
shows. It has the most words (1098 letters against 186 to 476), and a bar
measured against the page's area crosses first on the densest page. Its
letters are all where the preview's are to 0.001px, in the same faces and
colours, so nothing is laid out or drawn differently: the same glyphs at the
same places are rasterised differently, the same artefact as every other
page at a different scale. Ruled out, each by measurement: the face (the
same stacks resolve on both sides); sub-pixel placement (whole-pixel page
origins, identical glyph positions); font smoothing (no effect on Linux
Chromium); the inherited font context (giving the export the preview's
13px/18.2px sans-serif changed not one pixel); the preview's ancestry (a
scrolling box and a scale(1) wrapper round the export changed nothing).
Home and docs keep 4514 and 11867 px on their own layer where the other
seven reach 0; those are letter edges in particular parts (the docs side
navigation and headings, home's empty-state lines), with the glyphs in
place. Why those parts rasterise differently even on a layer is not traced.

## The leak

`tests/publish-leak.mjs` reads every file the real Publish button pushes. On
9734afa it failed: `site/document.json`, `site/BLUEPRINT.md` and
`site/blueprint.json` carried the capture and his working (22657 occurrences,
overlapping); the nine pages and the stylesheet carried none. Fixed by what
Publish writes, never by the test: the blueprint pair no longer goes up
(nothing downstream reads either; they stay in the Brief dialog), and the
document goes up cleaned (`publishedDoc` in `agent.ts`): prompts, notes,
where each part and face was captured, pages' prompts and the brief emptied;
`from.position` kept. It stays because Bring reads it back (`repoImport.ts`,
MADE_HERE) and a copy of this app renders it at /site; measured, a published
document brought back in lands all 637 parts, every kind the same. The cost:
with no element paths it brings back no ownership, so escapes read 0 there.
When and where Publish writes, and what it overwrites, are unchanged: the
guards are the owner's to rule on.

## Where Publish goes, and where a board came from (`tests/publish-source.mjs`)

**The owner's ruling:** polio never writes to a capture repository. sink
holds the capturer's code and the capture, and is kept. Publish sends a site
to its own output repository, never to the one it was brought in from.

**Measured on 3e14749**, red: a fresh Bring of `sparkygogo77-spec/sink` left
the site with `repo = sparkygogo77-spec/sink, bound = "import"`; Push to
GitHub sent that as both `repo` and `boundTo`, and the route made 9 writes into
sink (blobs, tree, commit, then `PATCH refs/heads/main`), all caught by a
stand-in for GitHub. The Bring dialog's line "Where Publish pushes is a
separate setting, on the Builds page" was not true in code: the import wrote
the very field (`project.repo`) the Builds page edits.

### Blast radius: every reader and writer of `project.repo` / `bound`, listed before the rule changed

Writers:
1. `builds/store.ts` `setRepo`: writes both, `bound` defaulting to "connected".
2. `FromASite.tsx` whole-site import: `setRepo(id, repo, "import")`. The defect.
3. `FromASite.tsx` page brought into a space: `setRepo(here.id, …, "import")`
   when the site had none.
4. `GithubButton.tsx` `connect()`: a list press (as "import", then a Bring),
   Publish only ("connected"), a repository made there ("made").
5. `BriefDialog.tsx` `remember()`: the repository a first publish made.
6. `BuildsPage.tsx` `RepoRow`: the "Publish here" field.
7. `builds/store.ts` `carryRepos()`: copies an old document's `siteRepo` in.
8. `builds/store.ts` `duplicate()`: the copy takes both.

Readers:
1. `BriefDialog.tsx` `pushTo()`: `repo`, `branch`, `boundTo`, `create`, for
   Push to GitHub and Go live.
2. `api/studio/publish/route.ts`: `boundTo` is the lock; `where()` falls back
   to the server's `GITHUB_REPO`.
3. `GithubButton.tsx` `own`: the panel's "The repo this site goes to", the
   Bring beside it, the Replace/Keep gate, the lock handed to `bringRepoIn`,
   the branch list, Merge into main, "Move to a different repo", the tooltip.
4. `RepoPicker.tsx` `own`: which rows are barred, and the lock.
5. `bringRepo.ts` `bringRepoIn`: `own` refuses a different repository.
6. `builds/store.ts` `importedBy`: refuses pointing another site at an
   imported repository.
7. `studio/store.ts` via `activeRepo()`: an edit on a site with a repository
   opens an `edit/…` branch there (on an imported board, in sink).
8. `agent.ts` `publish`: a push with no branch uses that `siteBranch`.
9. `SwitchButton.tsx`, `NewSiteOffer.tsx`, `BuildsPage.tsx` card: labels.
10. `FromASite.tsx` `deployedBy`: the address a site this Builder published
    went live at.
11. `FromASite.tsx` import line: "Connected to … the next edit opens a branch
    there."
12. Go live's deploy call, after a push that worked (Vercel; not changed).
13. Tests that pinned the old rule: `bring-lands.mjs`, `bring-bound.mjs`.

### The rule now

- **Two fields.** `project.repo` is where a site publishes, and only that.
  `project.source` is where it was brought in from: what Bring reads (the
  lock on which repository a board may bring in again), never written to.
  Every import (`FromASite.tsx`, both paths) sets only the source, and takes
  off a publish target that was the same repository, saying so.
- **One rule, `settle` in `builds/store.ts`:** a site bound by "import" reads
  as brought in from that repository with no publish target, and no site
  keeps a publish target that is any site's source. It runs on every
  hydration (the persist `merge`, then written back by `carryRepos`) and
  whenever a source is set. `setRepo` refuses a source. Not a persist version
  bump, so an older build reading the list does not drop it.
- **A site with no target** gets a repository of its own on its first
  Publish (`createRepo` in the route, as before), on `main`.
- **The route refuses**, in words and before any call that writes: any
  repository the browser says a site was brought in from (`sources`, reason
  "source"); any repository holding `site/capture/` on its default branch or
  the branch asked for (reason "capture"); and one it cannot look in (reason
  "capture-unknown", with GitHub's status). The capture check runs ahead of
  `tipOf`, which can itself make a branch. The Brief dialog refuses a source
  before sending, and takes a target the route calls a capture or a source
  off the site, saying so. The Builds page's "Publish here" and the GitHub
  panel's "publish only" refuse a source in words.
- **Replace / Keep, measured on every Bring door** into a 3-part board
  brought in from sink. On 3e14749: the GitHub panel's Bring beside the
  repo and its typed field warned; its list of repos and the "Bring a
  repository in" dialog replaced the 3 parts with 245 and said nothing.
  Now all four warn, and Keep my board leaves the 3 parts.

**Measured:** `tests/publish-source.mjs` on 3e14749, 7 of 24 (the browser
asks for `repo = boundTo = sparkygogo77-spec/sink`; 9 writes into it on one
press, 19 over the run). On this change, 26 of 26: the push asks
`create = SOLCINERATOR, branch = main`, the route makes `someone/solcinerator`
and makes its 9 writes there, and 0 writes reach sink over the whole run.

## Going live in one press (`tests/live-link.mjs`)

**Measured on b2ba350**, red, 5 of 16: Go live on a site with no repository
pushed to the repository Publish made (`someone/kept-live`), asked Vercel for
its projects, found none connected, and the deploy route answered
"no-project" ("Import it once at vercel.com/new"). No project, no deployment,
no address. A repository Publish makes can never be imported by hand before
its first Go live, so a new site never went live.

### Blast radius: every reader and writer of a site's address and of the deploy route, listed before the rule changed

Writers:
1. `BriefDialog.tsx` `goLive()`: `setLive(id, url)` once a deployment is READY.
2. `builds/store.ts` `setLive`; `duplicate()` clears `live` on the copy.

Readers:
1. `BuildsPage.tsx` card: a "Live" link when `project.live` is set.
2. `FromASite.tsx` `deployedBy()`: a Bring of a repository some site here
   publishes to reads its page at that site's `live.url`.
3. `BriefDialog.tsx`: the per-press `liveRun` line; nothing shows the recorded
   address.

The deploy route and its callers:
1. `agent.ts` `deploy()` (POST), from `goLive()` only; sends the Vercel token
   and team, not the GitHub token, not the site's name, not its sources.
2. `agent.ts` `watchDeploy()` (GET `?id=`), from `goLive()`.
3. `agent.ts` `deployStatus()` (GET), which gates the Go live button and the badge.
4. `api/studio/deploy/route.ts` POST: a project named in the request, or by
   `VERCEL_PROJECT` on the server, wins over the one connected to the
   repository; otherwise the one whose `link` is the repository; otherwise
   "no-project". Then `POST /v13/deployments` with `gitSource`.
5. `api/studio/publish/route.ts`: `VERCEL_DEPLOY_HOOK`, a poke for a project
   that is not connected. Not changed.

Server settings read: `VERCEL_TOKEN`, `VERCEL_TEAM`, `VERCEL_PROJECT`,
`GITHUB_REPO` and `GITHUB_BRANCH` (when a request names none).

Tests: `go-live.mjs` (no token; a made-up token reaches Vercel and is refused),
`vercel-pages.mjs` (the project lookup walks pages), `live-link.mjs`.

### The rule now

- **Go live is the one press.** It pushes (Publish makes the repository on a
  first press, as before), then the deploy route looks for the Vercel project
  connected to that repository and, finding none, makes one: Vercel's
  create-project (`POST /v11/projects`) with `gitRepository`, named after the
  site. Every later push to that repository deploys on its own. The first
  deployment is asked for and waited on, and the production address (the
  shortest alias of a READY deployment) is written on the site
  (`project.live`). The Publish card shows it as a link (`data-live-address`)
  on every later visit and after a plain Push to GitHub; the Builds page
  card already showed it.
- **Said in words:** no Vercel token (as before); Vercel's GitHub app cannot
  see the repository (reason "github-access", with where to grant it and what
  Vercel said); a name Vercel already has gets a suffix, like a repository
  name, and the answer says so (`note`), or, if every suffix to -9 is taken,
  "name-taken"; a failing build ends on Vercel's own `errorMessage`.
- **Never connected to where a site came from:** the route refuses any of
  the `sources` the browser sends (reason "source"), and before it makes a
  project it looks for `site/capture/` with the GitHub token (reason
  "capture"; one it cannot look in, "capture-unknown"; no GitHub token,
  "no-github"). The check is `publish/capture.ts`, shared with Publish.
- **The server's `VERCEL_PROJECT`** is used only for a request that names no
  repository. A site that names its repository deploys from the project
  connected to it, and a project asked for by name that is connected to a
  different repository is refused ("elsewhere") rather than built.
- `VERCEL_API` points the deploy route at a stand-in in tests, as
  `GITHUB_API` does for Publish.

**Measured:** `tests/live-link.mjs` 5 of 16 on b2ba350 (with the override),
16 of 16 here. One press: `POST /v11/projects {name: "kept-live",
gitRepository: {type: "github", repo: "someone/kept-live"}}`, one deployment
from it, READY, `live = https://kept-live.vercel.app`, shown as a link; a
second Go live made no second project and showed the same address, and so
did a plain push.

**Not measured, and cannot be here:** the exact error Vercel gives when its
GitHub app cannot see a repository. The stand-in answers with the message
Vercel is known to give ("To link a GitHub repository, you need to install
the GitHub integration first…"); the route recognises any answer that names
GitHub, a repository, an integration or an install, other than a clash or a
401. The first real run should read which one it gets.
