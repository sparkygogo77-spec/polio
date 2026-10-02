# capture/ — the capture tool, folded in from sink

The capturer, the converter, their checks and the comparison tools came over
from `sparkygogo77-spec/sink` (main plus `claude/wonderful-pascal-105n6y`, at
sink `3538c80`: the script-built page fixes, the settle wait, `data:` chart
pictures and per-piece word boxes included). One repository, one branch per
change, one merge path. sink is kept as it was; nothing here reads it.

The folder keeps sink's layout, so every script works unchanged with this
folder where sink's root was:

```
capture/
  site/capture/          the capturer and the converter (README.md there says what each file is)
    check-*.mjs          the capture checks, each on stand-in pages served on 127.0.0.1
    tools/               compare-geometry, compare-shots, motion-timing, and their check
    routes.json          SOLCINERATOR's pages (the plan capture-all reads)
  docs/                  behaviours.md, motion.md, fidelity/*.md (the reports; their screenshots stay in sink)
  fixtures/              the captures the tests read, one pack per capture version, and unpack.mjs
  run-checks.mjs         every capture check, then one table
  ── git-ignored, never committed ──
  site/document.json, site/capture/routes/, site/capture/ledger.txt, assets/   SOLCINERATOR, unpacked
  sites/<name>/          the other captures, unpacked; and anything captured here by hand
  versions/sink-0ee06fa/ the older captures most polio tests were written against, laid out the same way
```

## Captures are not kept in git

A capture is a site document. polio's workflow (`.github/workflows/capture.yml`,
"Capture a site") runs `capture-site.mjs` into `capture/sites/<name>/` on the
runner and hands the folder back as the run's artifact, `capture-<name>`,
kept 30 days. It commits nothing and reads no secret.

The Builder's **Capture a site** and **Recapture** dispatch that workflow and,
when the run ends, bring the artifact in: the site is named
`owner/polio/sites/<name>@run:<id>`, read by the same importer as a
repository's folder (`src/features/studio/captureArtifact.ts`, through
`api/studio/capture-artifact`, which follows GitHub's redirect for one byte
range at a time), and lands in the Builder's own store like any site brought
in. Why an artifact rather than the Builder's server: it needs no store, no
secret and no setting beyond what Actions already gives every run; and the
Builder keeps the site once brought in, so the artifact's 30 days only bound
how long a capture waits to be brought in. Bring in again on a site whose
run has expired says so; Recapture makes a new run.

Captures already in sink still come in the old way: Bring a repository in
with `sparkygogo77-spec/sink/sites/<name>@<branch>`, or sink typed as the
capturer under the dialog's Advanced (it commits to `captures/<name>` as before).

## The fixtures

The tests read seven captures: SOLCINERATOR (the root `site/`), and
trumpmorty.fun, gotchi.gg, share.xyz, stonkfun.xyz, trendtrader.pro and
parasiteonsol.fun under `sites/`, in two versions, one folder each:

| pack | unpacked to | what reads it |
|---|---|---|
| `sink-3538c80.tar.xz` (sink main 75a7bcc's captures) | `capture/` | the capturer's own checks (they convert these byte for byte) and `tests/fluid-site.mjs` |
| `sink-0ee06fa.tar.xz` (the older captures) | `capture/versions/sink-0ee06fa/` | every other polio test: test-all hands it to them, and their defaults name it; with `history/7b7ee04/`, the earlier trumpmorty.fun conversion the re-import tests compare against |

Only what a test or a check opens is packed: every document and recorded API
map, SOLCINERATOR's raw captures and assets, trumpmorty.fun whole, share.xyz's
capture and assets, and the other sites' pictures but parasiteonsol.fun's.

```
npm run capture:fixtures        # unpack both (test-all and the capture checks do it for you)
```

Frozen copies for the tests, not sites anyone edits. To move a test onto a
newer capture, point it at the newer folder (test-all's `ARGS`), or pack a
new version the same way.

## Running it

```
npm run capture:check                      # every capture check, then a table
npm run capture:check -- script-built svg  # only those
node capture/site/capture/capture-site.mjs --url https://example.com --name example --pages "/, /docs" --hide-gate
```

A page that builds itself after it loads and says when it is done (its
`<html>` or `<body>` carries a `data-*` attribute reading `loading`,
`building` and the like, or `aria-busy="true"`) is waited for until that
changes, up to `--ready` seconds (120): PonsStars' preview.html sets
`data-preview="ready"` once its 23 screens are built (`site/capture/ready.mjs`).
Such a page's lists are left whole, since its sections are the design.
A page may carry a query string, and becomes a Builder page of its own at
a plain path (`/preview.html?still=1&screen=lobby` is `/preview-lobby`,
named Lobby); `?screen=*` takes every value of `screen` the page lists in
its links once it is ready, one Builder page each:

```
node capture/site/capture/capture-site.mjs --url https://pst-server-beige.vercel.app --pages "/preview.html?still=1&screen=*, /gallery.html" --hide-gate
```

Observe only, always: a capture never signs, connects a wallet, submits a
form, or agrees to a terms or cookie dialog (`--hide-gate` hides the gate in
the capture's own browser). `--wallet` and `--agree` are SOLCINERATOR's
stand-ins and are not in the workflow.
