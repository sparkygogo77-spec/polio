# The deploy check

What the live site was actually serving, and whether it worked, the last
time anybody asked. Written by `tests/deploy-check.mjs`; run it with
`npm run check:deploy`, or let the trunk push do it.

This is a record rather than a scroll: the one thing it is here to make
obvious in a line is a deployment that is stale or was never merged, which
is how a cube drawn on the live site did nothing and nobody knew.

## https://polio-two.vercel.app

**2026-09-11 20:19Z** — **not saying which commit it is serving**. **2 of 5 missing.**

| | what was asked | what was found |
|---|---|---|
| ok | the root answers | HTTP 200 |
| ok | and it is the app rather than a redirect away from it | HTTP 200, nowhere else |
| ok | the Builder answers | HTTP 200 |
| **missing** | the deployment names the commit it is serving | no /api/version — this build predates it, so nothing can say how old it is |
| **missing** | the Builder could be opened in a browser | page.goto: net::ERR_CONNECTION_RESET at https://polio-two.vercel.app/builder |

Everything above is asked by **visibility** — a non-zero rectangle inside
the window, not `display:none`, not `visibility:hidden`, not transparent —
because a control that merely exists is one nobody can press, and that is
exactly how a Builder with no bar shipped green. Nothing follows a
redirect, because a redirect is how the Builder vanished once.

> The browser could not reach the deployment **from wherever this was
> run**, which is not the same as the deployment being down: the HTTP
> rows above got through. An agent container behind an egress proxy
> often cannot open a full page, and the Builder's own rows are then
> absent rather than failed. Run it again from a machine with ordinary
> network, or read the workflow's artifact.
