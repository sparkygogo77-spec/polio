# Capture a site, from the Builder

Paste any address into the Builder and it is captured and brought in, with
every captured site kept side by side. The root `site/` of the sink
repository (SOLCINERATOR, captured by hand) is never written.

## The shape

```
Builder (his browser, his token)          GitHub                       sink repository (Actions)
──────────────────────────────            ──────                       ─────────────────────────
"Capture a site" dialog
  address, name, [pages]
  ── POST workflow_dispatch ──────────▶  capture.yml, inputs url/name/pages
  ── GET workflow runs (newest) ──────▶  the run it started
  ── GET run, GET run/jobs (every 5s) ▶  status, the step it is on ◀── install browser
                                                                        capture-site.mjs:
                                                                          capture-route.mjs per page
                                                                          capture-to-document.mjs
                                                                        commit sites/<name>/ → branch captures/<name>
  "Bring sites/<name> in"
  ── bringRepoIn("owner/sink@captures/<name>", { path: "sites/<name>" })
```

Two halves, one per repository:

- **sink** — `site/capture/capture-site.mjs` and `.github/workflows/capture.yml`.
  The script plans the same capture and converter that made the root site,
  into `sites/<name>/` (`capture/routes.json`, `capture/routes/<id>.json`,
  `capture/ledger.txt`, `capture/run.json`, `assets/source`,
  `site/document.json`, `assets/pictures`). The plan is data, so its check
  (`site/capture/check-capture-site.mjs`) opens no browser. The workflow
  takes `url`, `name` and `pages` by `workflow_dispatch`, installs
  Playwright's Chromium, runs the script, and pushes the folder to
  `captures/<name>` with `GITHUB_TOKEN` and no other secret
  (`permissions: contents: write`).
- **polio** — `src/features/studio/captureSite.ts` (the GitHub calls, pure:
  `fetch` and `sleep` are handed in, so the check stands a GitHub in) and
  `src/features/studio/CaptureSiteDialog.tsx` (the dialog and its door in
  the bar, beside "Bring a repository in"). The token is read from the Keys
  panel in the browser, rides in the `Authorization` header of each call,
  and reaches our server never, exactly as the importer and a publish.

## In the dialog

Address, then a name that follows the address's host until one is typed
(`example.com` → `example`; letters, digits, dashes, never a path, never
one of sink's own folder names). Under **Advanced**: the pages to capture
as a comma list of paths (`/, /docs`), the capturer repository
(`sparkygogo77-spec/sink` by default, remembered in the browser), and the
branch its workflow is on (empty means the repository's default). The
Capture button dispatches the run, the dialog says the step the run is on
with a link to its log, and when the run ends it offers **Bring
sites/<name> in**, which goes through the one importer door,
`bringRepoIn`.

## What the importer is expected to take

The importer (`repoRun.ts`) reads the root `site/document.json` of a
repository at a ref today. Another lane is adding a path setting to it.
This lane does not touch `repoRun.ts`, `fluidSite.ts` or `exportSite.ts`;
it calls the door with the ref in the `want` string and the path beside
it, and expects:

```ts
// bringRepo.ts
export interface Bringing { …; path?: string }   // "sites/<name>", a folder holding site/document.json and assets/
// repoRun.ts
readRepoSite(repo, token, say, { path?: string }) // reads <path>/site/document.json and <path>/assets/pictures instead of the root's
```

`captureSite.ts#capturePlace(name)` is the single place that says both
values: `{ ref: "captures/<name>", path: "sites/<name>" }`. Until the path
lands in `repoRun.ts`, the press reads the branch's root `site/`, which on
`captures/<name>` is the root site of the branch the workflow ran on.

## Running it by hand

```
# sink, once the branch is merged (or with the branch named under Advanced):
node site/capture/capture-site.mjs --url https://example.com --name example --pages "/, /docs"
node site/capture/check-capture-site.mjs

# polio:
node --experimental-strip-types tests/capture-site.mjs
```

## What is left

- The path setting in `repoRun.ts` (the other lane); until then the import
  press reads the root site.
- A browser check that presses the door and the buttons against a stand-in
  GitHub (the module's check covers the calls; the dialog is typechecked).
- The workflow's token needs `actions: write` on the token he holds
  (a fine-grained token: Actions read and write, Contents read and write
  on sink) — the dialog says so on a 403.
- `--wallet` and `--agree` (the SOLCINERATOR stand-ins) are not exposed in
  the dialog; the script takes them.
