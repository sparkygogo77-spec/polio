# Tasks

What the owner asked parts of this site to do that the builder's feature library does not cover yet.
Each task is under its part's stable id, which is also that element's `id` on the published page.
The builder rewrites this file on every publish, from the site itself; build a task as a feature
(see the feature contract in AGENTS.md) and name the part in its manifest's `parts`, and the next
publish lists it under Built.

## Open

### `n_ctaprimary_85` — wallet chip

- **Page:** Creator Hub (`index.html`)
- **Part:** cta-primary, showing “kgER...9oP7”
- **Find it:** `document.getElementById("n_ctaprimary_85")`
- **The owner's words:** show the latest transaction hashes from the connected wallet
