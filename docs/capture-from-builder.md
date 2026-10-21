# Capture a site, from the Builder

Paste any address into the Builder and it is captured and brought in. The
capturer lives in this repository now (`capture/`, folded in from sink), and
what it captures is never committed: it comes back as the run's artifact and
lands in the Builder's own store.

## The shape

```
Builder (his browser, his token)          GitHub                          polio (Actions)
──────────────────────────────            ──────                          ───────────────
"Capture a site" dialog
  address, name, [pages]
  ── POST workflow_dispatch ──────────▶  capture.yml on the default branch, inputs url/name/pages
  ── GET workflow runs (newest) ──────▶  the run it started
  ── GET run, GET run/jobs (every 5s) ▶  status, the step it is on ◀── install browser
                                                                        capture-site.mjs → capture/sites/<name>/
                                                                        upload-artifact: capture-<name> (30 days)
  ── GET run/artifacts ───────────────▶  capture-<name>
  "Bring <name> in"
  ── bringRepoIn("owner/polio@run:<id>", { path: "sites/<name>" })
       readRepoSite → captureArtifact.ts
         ── GET /api/studio/capture-artifact?…&last=65557 ─▶ our route ─▶ GitHub 302 ─▶ storage, a byte range
         ── …the zip's directory, then the document and the pictures it names, by range
       copyFrom → the same copy as a repository's folder → the board, the Builder's store
```

- **The workflow**: `.github/workflows/capture.yml`. `contents: read`, no
  secret, no commit, no push. `--hide-gate` always: observe only.
- **The importer**: a site from a run is named `owner/polio/sites/<name>@run:<id>`.
  `readRepoSite` sees the `run:` ref and reads the run's artifact instead of
  a git tree (`captureArtifact.ts`), then builds the same copy a repository's
  folder gives (`copyFrom` in `repoRun.ts`): the document, its source, the
  pictures it names, the stand-in reads. So Bring in again, Replace and keep
  my changes work on it unchanged; Bring in again after 30 days says the
  capture expired.
- **The route**: `src/app/api/studio/capture-artifact/route.ts`. GitHub's
  artifact download redirects to storage that sends no CORS headers, so the
  browser cannot read it (the zipball's problem, `repoRun.ts`). The route
  follows the redirect for one byte range (≤ 3.5 MB, under a function's
  4.5 MB answer) with the token riding in `x-github-token`, as the publish
  and repo routes take it, and keeps nothing. The token goes to GitHub only;
  the storage is asked with the signed address.
- **Recapture**: for a site from a run, the record (`capture/run.json`) is
  read out of that run's artifact, and the workflow runs again on polio's
  default branch; the new run's artifact is offered through the repo menu's
  Replace prompt.

## Why an artifact, and not the Builder's server

Two places a capture could go other than git: the run's artifact, or a store
of the Builder's own (a blob store on the deployment). The artifact needs
nothing set up: every run can upload one, every key that can start the run
can read it, and nothing about a site sits on our server. A store would need
a secret on the workflow, a blob store on the deployment and a write route
guarded by that secret, all for a file the Builder keeps itself once the
site is brought in. The artifact's 30 days only bound how long a capture
waits to be brought in.

## In the dialog

Address, then a name that follows the address's host until one is typed
(`example.com` → `example`; letters, digits, dashes, never a path). Under
**Advanced**: the pages to capture as a comma list of paths (`/, /docs`),
the capturer repository (`sparkygogo77-spec/polio` by default) and the
branch it runs on (empty: the default branch). Typing a capturer that
commits (sink) brings back the old road: a branch made for the capture,
`capture/<name>-<date>`, and the owner's tick before its main line changes.

## Bringing in sink's captures

Unchanged: Bring a repository in with
`sparkygogo77-spec/sink/sites/<name>@<branch>`. sink stays as it was.

## The key

A fine-grained token with **Actions: Read and write** on polio (start the
run, read its artifact). The dialog says so on a 403.

## Running it by hand

```
node capture/site/capture/capture-site.mjs --url https://example.com --name example --pages "/, /docs" --hide-gate
npm run capture:check
node tests/capture-artifact.mjs      # the Builder's half, against a stand-in GitHub
node tests/capture-branch.mjs
```

## Parts onto the board while a capture runs — the plan, not built

Not simple enough to do in this change, so written down:

1. **The workflow** uploads each page as its own artifact as soon as the
   converter has it (`capture-<name>-page_<id>`): `capture-site.mjs` would
   convert after each page instead of once at the end (the converter already
   takes one routes file; `capture-to-document.mjs` would be run per page
   into a page folder, and once more at the end for the whole site, so the
   whole-site joins — twins, shared pictures, templates — still happen).
2. **The Builder** asks for the run's artifacts every 10 s while it runs
   (`GET /runs/<id>/artifacts`, the same call `findArtifact` makes), and
   lands each new page's document as a page of a draft site, read through
   the same `artifactFiles` + `copyFrom` path.
3. **At the end** the whole-site document replaces the draft in one step
   (one undo), so what was streamed is never the final word.

The cost: a second conversion per page on the runner, more artifacts per
run (fine: the limit is per repository storage, not count), and a draft
board that changes under the owner while he looks at it, which needs its
own design pass (`docs/DESIGN.md`) before it is built.

The same key is the account key (J, 2026-10-21): with it in Keys, the
Builder signs in to the Account by itself, so saved sites and the
remembered capture runs follow it into any browser (`account/`,
`api/account/core.ts`). The server takes it for the owner's when GitHub
says it belongs to `POLIO_GITHUB_OWNERS`, else to the owner of the
repository the deployment is built from.
With a GitHub sign-in the account is kept in a private repository of the
owner's, `<login>/polio-saves` (`api/account/github.ts`), made by the key
on its first save, rather than the Vercel Blob store.
