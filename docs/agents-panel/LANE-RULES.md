# Rules for every Polio lane (coordinator #3, 2026-10-24)

Coordinator #3 = session local_2f123766-90d8-4b53-ab5c-849c3851e891. Report to it with SendMessage (`to` = that id) only when blocked; results are relayed automatically when you end a turn.

## J's rules
- One branch, one PR per item. Push the branch and write the PR body to `handovers/<branch-name-with-dashes>-pr-body.md` (no `gh` on this PC). The coordinator sends it to the project chat, which merges on green tests with no conflicts. Never merge yourself.
- First line of every report and PR body: P1 (broken, visitor-visible, or loses data) / P2 (wrong with a workaround, or Builder-only) / P3 (polish). Score generality 5 (every site) … 1 (one site).
- Fixes are general (builder or kit), never one-site hacks.
- **Test on every repo fixture** (share-xyz, trumpmorty-fun, gotchi-gg, stonkfun-xyz, parasiteonsol-fun, trendtrader-pro), not only the local captures. CI runs on the fixtures, and on 2026-10-24 three PRs passed locally but were held on gotchi-gg and share-xyz.
- Each item ends with a red-to-green test in `tests/` (red on base, green on the branch) plus the closest existing test. No screenshots; the coordinator checks live.
- Test networks only. Never print or commit keys. Never touch certificates or trust stores. `sparkygogo77-spec/sink` is read only.
- Never edit J's boards or the built-in browser pane (it holds J's keys and sites). Use your own headless Playwright.
- Never kill processes you didn't start. Never touch another session's `work-*` folder or the old non-git `polio-claude-template-ui-website-builder-11bfgl`.
- Keep `handovers/<lane>.md` current (MEASURED vs BELIEVED, branches table, how to run), so a successor can carry on.
- Ask only when blocked, in one short message. No UI controls J hasn't approved (CREATE-SYSTEM-PROPOSAL.md lists what he approved).
- Short plain messages, abbreviations spelled out the first time. No backtick-ruled "Insight" boxes.

- **Leave nothing running** (J, 2026-10-24: too many processes on his PC). Before ending a turn with nothing in flight, stop your own dev server (`solface-scratch/stop-port.ps1 -Port <yours>`) and any headless browsers or background loops you started. Run one build or server at a time, never several.
- **Notify J** (J, 2026-10-24): when you finish a piece (pushed and queued) or get blocked, call `PushNotification` (load it with ToolSearch "select:PushNotification") with one line: P-level, what finished or what blocks you, and what's next. Example: "P1 boxes-hug pushed, queued as item 8; next #29".

## Windows notes (from editable-imports.md)
- Repo `https://github.com/sparkygogo77-spec/polio`, base branch `claude/template-ui-website-builder-11bfgl`.
- Node 24 at `C:\Program Files\nodejs` (prepend to PATH in bash). `npm run test:changed` doesn't run on Windows; run tests one at a time with node.
- Playwright headless shell needs `--disable-gpu --use-angle=swiftshader --in-process-gpu`; `solface-scratch/pw-args.mjs` (load with `node --import file:///C:/Users/Josh/Downloads/Pleo/solface-scratch/pw-args.mjs`) sets it up.
- Probe/step file paths must be Windows absolute `file:///C:/...`, not `/c/...`.
- Use a unique port per lane (listed in your brief). `next build` can run out of heap if memory is tight; if so, say so rather than killing other processes.
- Captures for tests: `work-editable/capture/sites/{thesolface3,mochi3,sunk2}` and the repo fixtures (share-xyz, trumpmorty-fun, gotchi-gg, stonkfun-xyz). Copy them into your own folder (untracked); don't write into work-editable.
- Driver: `handovers/probes/editable-imports/` (`_edit-pass.mjs`, `_edit-probe.mjs`, `_edit-lib.mjs`). Read the store via `window.__studioHistory.doc()`; scroll a published page through before measuring.
- Check for every lane: import sol face, mochi and sunkcoin and confirm the board doesn't move by a pixel unless a change was asked for.
