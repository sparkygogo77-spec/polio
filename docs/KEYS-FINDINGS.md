# The Keys panel, proven on the deploy

Every person who visits the site enters their own keys in the Keys panel.
The keys are held in that person's own browser and ride along with each
call that person makes, as one header on the site's own route, which
hands the key to the provider and drops it. Nothing goes in the server's
environment. `tests/keys-live.mjs` runs two browsers against the deployed
site and proves five claims, each as its own tally. A check that would be
green only because the thing it watches was never there (no call was
made, or the server holds a key so the browser's is never the one tried)
reports itself as unproven instead of counting.

    node tests/keys-live.mjs https://polio-two.vercel.app

## The five claims, at e0fe117

| claim | deployed, e0fe117 | this branch, local |
|---|---|---|
| 1. A key entered in one browser is on that person's next call, and goes nowhere else | 6 of 6 | 6 of 6 |
| 2. A second browser with no key is asked plainly for one, and never sees the first's | 5 of 6 | 5 of 6 |
| 3. Forget removes it, and the next call asks again | 5 of 6 | 5 of 6 |
| 4. A rejected key and a malformed key each say what to fix | 3 of 4 | 4 of 4 |
| 5. Nothing prints the key, whole or in part | 3 of 3 | 3 of 3 |

What the numbers rest on: 47 requests watched in the first browser, 4 of
them carrying a key header, all to the site's own `/api/`; Anthropic and
Replicate each answered about the key ("rejected the browser's key"), so
the provider call was made with it; 234 things read for eight-character
windows of either key (console lines, page errors, answers, addresses,
bodies, every other header, the page) and none held one.

## What fails, and whose it is

- **The ask for a missing key is not on the board.** A drawing made real
  with no Claude key calls the reshape route, which answers `no-key`, and
  the line "No Claude key yet. Put ANTHROPIC_API_KEY on the server, or
  paste one under the key button (⌘⇧K) and press Try it." goes to the News
  panel only. On the board the part lands at the drawing's proportion and
  nothing names a key. A person who has not opened News sees a silent
  failure. Two checks (2 and 3) fail on it. The line is published from
  `reshapeRun.ts` with `toast: true` and the queue republishes every
  queued job's news with `toast: false`, which is what keeps it off the
  board (`DrawQueue.tsx`). The studio's, not the panel's.
- **The same line tells the person to put the key on the server.** The
  architecture is that nothing goes in the server's environment; the
  wording in `agent.ts` (`noKeyMessage`) still offers it first. The
  studio's.
- **A key too short to be one was answered "nothing offered by this
  browser".** Every route drops a key of eight characters or fewer rather
  than send it anywhere, and the test route said none was offered. Fixed
  on this branch: "The key held in this browser is too short to be one.
  Paste it whole, from its first character to its last, and try again."
  Fails on the deploy until it lands.

## What the suite cannot see

The server's own log. The routes were read instead: no `console` line in
`src/app/api/keys` or the studio routes writes a header or a key, and
every route trims the header, uses it for the one call, and returns a
sentence with no key in it. The image route also scrubs a token out of
any library message before it leaves (`safe()`).

## Where a key is written down, and what that is worth

One entry, `builder.keys`, and it is always a sealed box. Under a PIN when
the PIN setting is on (PBKDF2, 310,000 iterations, AES-GCM — see
`crypto.ts`), and otherwise under a key this browser generated for itself
and cannot export (`keyring.ts`). There is no second entry and no readable
copy under any name.

There used to be. `builder.keys.plain` held the key as itself, in
localStorage, so that it survived a reload, and it sat beside the sealed
one — which meant the sealing was worth nothing while it was there. It is
gone. A browser that still holds one has it read, folded into the sealed
entry and deleted on the next load, under a PIN or not. `tests/no-plain-key.mjs`
walks every name and value in localStorage and sessionStorage looking for a
pasted key, rather than checking the entry it expects, because a copy under
a name nobody thought of is exactly what that check is for.

**What the browser's own key is worth, stated so nobody is told otherwise.**
It is real against anything that reads storage without running code here: a
copied profile, a synced backup, a glance at the Application tab, a snippet
that dumps localStorage. It is worth nothing against code running on this
origin, which can ask for the key exactly as the app does. Only a secret
that is not stored — the PIN, while locked — keeps a key from code on the
page, and only the server keeps it from the browser altogether.

## What a browser can reach on its own, measured on the deploy

Measured from the deployed page's own origin, and worth knowing before
anyone builds a server for a job that does not need one.

| call | from the page | note |
|---|---|---|
| Anthropic API | refused outright without `anthropic-dangerous-direct-browser-access: true`; a real 401 on a dummy key with it | so the call reaches them: a visitor's key can call the model from the visitor's own browser, which is what the architecture wants, but only with that header |
| GitHub API | 200 | reachable |
| Vercel API | 403 on a dummy token | reachable: the answer came back |
| example.com, nytimes.com, vercel.com, stripe.com, apple.com | all refused | ordinary pages do not allow it |

Two things follow. The publishing path — repository first, then Vercel —
needs no server of ours at all. And importing an element from a URL is the
one job that genuinely does need either a small server or a browser
extension, because an ordinary page will not answer a browser that asks
from somewhere else.
