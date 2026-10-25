# Agents panel: a proposal for J

**Status:** proposal only. Nothing is built. J approves or changes it first.
**Written:** 2026-10-24 by lane agents-panel-design, for coordinator #3.
**J's ask:** an Agents panel in the Builder. He types what to change and picks what it is for: the site he is building (and its export), the Builder's look, or the Builder's engine. A helper on his PC runs as many Claude Code agents as the job needs, side by side, and shows their progress in the panel. Browser checks and on-PC abilities stay.

---

## The short version

1. **The panel** sits in the Builder as a dock on the right. J types a request, picks a target, and the picked part, the page and a screenshot go with it on their own.
2. **The helper** is a small program on J's PC. It installs once, starts with Windows, and only talks to the Builder it was paired with.
3. **Inside the helper, a coordinator** does what coordinator #3 does by hand today:
   - it splits the request into lanes that don't share files;
   - it runs them in parallel, each in its own git worktree;
   - it tests red to green, merges on green, checks the result live, and reports with P-levels.
4. **Safety.**
   - Only the paired Builder can drive the helper.
   - Keys are never shown.
   - Pause and Stop are buttons only J can press.
   - Spending stops at a cap.
   - Test networks only.
5. **The one new idea: the panel is drawn by the helper.** It appears inside the Builder as a frame, but its buttons, its pairing token and its Start, Approve, Pause and Stop all live on the helper's own page. A script on the Builder page, such as one from a captured site, can't read the token or press the buttons. Details are in "Safety".

Words used below:
- **Request:** one thing J typed, such as "make the hero calmer on mochi".
- **Lane:** one agent working on one set of files on one branch, as today.
- **Lead:** the agent that reads a request and splits it into lanes.
- **Helper:** the program on the PC that runs the agents. It is plain code, not an agent.
- **Live check:** a headless browser opens https://polio-two.vercel.app after a merge and checks the change.

---

## 1. What J sees

### Where it lives

There is a new **Agents** button in the Builder's top bar. Its mark shows what's going on at a glance: `Agents ◐3 !1` means three agents are working and one needs J. Pressing it opens a dock on the right, over the side panel, 380 px wide (its edge drags, like the side panel's). A picked part also gets **Ask agents** on the wheel, which opens the dock with that part already attached.

```
+--------------------------------------------------------------------------------------+
| Polio  mochi   [Pages v]   Undo Redo   ...                    [Agents ◐3 !1]  [Go live]|
|--------------------------------------------------------------------------------------|
|                                                        | AGENTS                  [x] |
|        the board                                       |  helper: on, paired, 3 of 4 |
|                                                        |  today $4.10 of $15  [====--]|
|                                                        |-----------------------------|
|                                                        |  (the dock, below)          |
|                                                        |                             |
+--------------------------------------------------------------------------------------+
```

### The prompt box

```
+-----------------------------------------------------------+
| WHAT SHOULD CHANGE?                                        |
| [ The hero feels crowded. Fewer badges, calmer heading,  ] |
| [ and the Sign up button should match the nav buttons.   ] |
|                                                           |
| For   (o) This site and its export     mochi              |
|       ( ) The Builder's look            panels, board, UI  |
|       ( ) The Builder's engine          capture, export,   |
|                                         saving, routes     |
|                                                           |
| Goes with it (press one to drop it)                        |
|   [part: Hero heading  h1#hero-title  x]                   |
|   [page: Home  x]  [screenshot: board at 1440  x]          |
|   [live commit 2060faf]  [+ add a file or picture]         |
|                                                           |
| How   [Plan first, then I press Start  v]                  |
|                                     [Plan it]             |
+-----------------------------------------------------------+
```

- **For** sets where the work happens:
  - **This site and its export:** the agents change the open site's board, through the Builder's own steps, so every change is a named undo step. If the site has been exported, they also update its repo.
  - **The Builder's look:** the polio repo's front end (panels, board, wheel). It merges on green and is live-checked.
  - **The Builder's engine:** the polio repo's server side (capture, converter, export, saving, `api/studio/*`). Same as the look, plus the capture sites' "nothing moved" check.
- **Goes with it** is filled in on its own:
  - the picked part, with its name, id and hook;
  - the page;
  - a screenshot of the board as J sees it;
  - the live commit.

  Each chip can be dropped.
- **How** has two choices:
  - **Plan first** (the default): the lead shows its lanes, files and estimated cost, and J presses Start.
  - **Just do it:** small requests start straight away, within the cap.

### The plan card (when How is "Plan first")

```
+-----------------------------------------------------------+
| PLAN: "hero calmer, fewer badges, Sign up like nav"        |
|-----------------------------------------------------------|
| 2 lanes, about 25 min, about $3 (cap left today: $10.90)   |
|                                                           |
|  hero-calm      site board: Hero section, 9 parts          |
|                 type down one step, one badge row hidden   |
|  signup-match   site board: Sign up -> Button / nav        |
|                 links it to the house System component     |
|                                                           |
| Both change the board only. Nothing merges to the Builder. |
| New control?  none                                        |
|                       [Change the plan]  [Start]          |
+-----------------------------------------------------------+
```

If a lane would add a new control to the Builder, the card says **"New control: yes"** with a sketch, and the lane waits for J's yes. This is his standing rule.

### The agent list

Each row has a drawn mark, the lane's name, a one-line note of what it's doing, and its buttons. The marks are drawn small shapes, not emojis:

```
  ◐  working     a ring with a gap that turns
  ?  question    a ring with a soft amber halo
  !  only you    a ring with a notch cut out, red
  ✓  done        a closed ring, blue
  ‖  paused      two bars inside the ring
  ~  checking    the ring fills in steps (tests or live check running)
```

```
+-----------------------------------------------------------+
| RUNNING (4)                                [Pause all]    |
|-----------------------------------------------------------|
| ◐ hero-calm        This site (mochi)                      |
|   lifting heading contrast, 6 of 9 parts done   $0.80 12m |
|                              [Steer] [Pause] [Stop]       |
|-----------------------------------------------------------|
| ~ wrap-in-column   Builder engine     tests 13/16 -> 16/16 |
|   running the closest tests: edit-widen, size-widens       |
|                              [Steer] [Pause] [Stop]       |
|-----------------------------------------------------------|
| ? export-gallery   Builder look                           |
|   "Gallery page: one per component, or one long page?"     |
|   [One per component] [One long page] [Type an answer]     |
|-----------------------------------------------------------|
| ! keys-row         Builder look                           |
|   adds a new control: "Copy key name" on the Keys panel    |
|   [see the sketch]           [Approve] [Say no] [Stop]    |
|-----------------------------------------------------------|
| ‖ capture-frog     Builder engine   paused by you 14:02    |
|                              [Resume] [Stop]               |
|-----------------------------------------------------------|
| Closed today: boxes-hug, one-line-wraps, hover-edit +6    |
+-----------------------------------------------------------+
```

Pressing a row opens it:

```
+-----------------------------------------------------------+
| ◐ hero-calm                                   [Steer] ... |
|-----------------------------------------------------------|
| Branch   none (site board only)                           |
| Owns     Hero section of mochi / Home                     |
| Steps    14:10 read the hero (9 parts)                    |
|          14:11 heading 64 -> 52, one undo step            |
|          14:12 hid badge row 3          [Undo this one]   |
|          14:13 checking contrast ... 4.8 to 1 ok          |
| Spent    $0.80   tokens 210k in / 18k out                 |
| Seen by  board screenshot 14:13  [open]                   |
+-----------------------------------------------------------+
```

- **Steer** sends a line into the running agent, such as "keep the second badge row".
  - The helper lets the current step finish, interrupts the turn, and sends the line into the same session.
  - The agent keeps everything it knew and doesn't start over.
  - "Steer later" queues the line for when the turn ends instead.
- **Pause** does the same interrupt, but sends nothing until **Resume**, which tells the agent to carry on. Nothing is lost: the session is saved on the PC.
- **Stop** ends the agent and everything it started, leaving its branch as it is. Stop can't be undone, so it asks once.
- **Approve** appears only when an agent needs J. The reasons are his standing list: a new control, money, keys, accounts or rules, or a merge if J picked "approve each merge".

### On your PC now

This section is read from Windows itself every 5 seconds, not from what the agents say.

```
+-----------------------------------------------------------+
| ON YOUR PC NOW                     memory 19.2 of 32 GB   |
|-----------------------------------------------------------|
|  claude agent   hero-calm       12m   cpu 3%   410 MB     |
|  claude agent   wrap-in-column  31m   cpu 1%   380 MB     |
|  node next build  wrap-in-column  2m  cpu 88%  3.1 GB     |
|  node next start  :3112 (wrap-in-column)  idle   520 MB   |
|  chrome headless  live check #405         cpu 22%  640 MB |
|  ---- not started by the helper (left alone) ----         |
|  node  :3061  (another session)                           |
|  Blender? no.  Claude desktop: open                       |
|                                                           |
|  Builds waiting their turn: 1 (one big build at a time)   |
+-----------------------------------------------------------+
```

Everything the helper started has a [Pause] and a [Stop]. Anything it didn't start is listed, greyed, and has no buttons. This is J's rule: never kill a process you didn't start.

### The merge feed

```
+-----------------------------------------------------------+
| MERGES                                   live: 2060faf    |
|-----------------------------------------------------------|
| P1  boxes-hug           merged #405  live 14:31  checked  |
|     Selection boxes sit on the part as drawn (frog).      |
|     tests 4/10 -> 10/10 + 6 near tests        gen 5       |
|     [before | after]  sol face, mochi, sunkcoin: 0 px     |
|     +------------+ +------------+                         |
|     | (shot)     | | (shot)     |   [open PR] [undo merge]|
|     +------------+ +------------+                         |
|-----------------------------------------------------------|
| P2  one-line-wraps      tests green, waiting for CI 3m    |
|-----------------------------------------------------------|
| P3  bigger-row-grows    waits on one-line-wraps (stacked) |
|-----------------------------------------------------------|
| !   live check failed: hover-edit on gotchi               |
|     hover lift 0px, expected 2px     [see shots] [revert] |
+-----------------------------------------------------------+
```

- A line leads with what J will notice, as in the project chat today.
- The two screenshots come from the live check: before is the old live commit, after is the new one, at 1440 px.
- **Undo merge** opens a revert PR. It goes through the same tests.

### The spend meter

```
+-----------------------------------------------------------+
| SPEND                 today $4.10 of $15      [========--]|
|-----------------------------------------------------------|
|  this request     $1.30   (estimate was $3)               |
|  per agent        hero-calm $0.80, wrap-in-column $0.50   |
|  this week        $31.20                                  |
|  At $12 the panel warns. At $15 every agent pauses        |
|  (nothing lost) and asks you.                             |
+-----------------------------------------------------------+
```

On a Claude plan (Pro or Max) the dollar figures are what the work *would* cost at API prices, and the meter also shows how much of the plan's usage window is left. On an API key they are the real bill. Either way they come from the SDK's own per-run cost and token counts. The Builder's `spend.ts` already prices tokens the same way.

---

## 2. The local helper

### What it is

**Polio Helper** is a small Node program. It uses the Claude Agent SDK, which runs Claude Code inside it.
- It runs no shell window and has a tray icon with three items: Open, Pause all, Quit.
- It listens only on `127.0.0.1:47821`, so nothing outside the PC can reach it.
- Its code lives in the polio repo under `helper/`, so it is tested and merged like everything else.

### Install once

1. In the Builder, the Agents dock shows **Set up the helper** when it can't find one. It gives one PowerShell line to paste. The line fetches a script from the polio repo, so J can read it first.
2. The script:
   - puts the helper in `C:\Users\Josh\PolioHelper\`;
   - checks Node 24 and Git;
   - registers the link `polio-helper://` (used only to start the helper);
   - adds a Windows "at log on" task so it starts with Windows, hidden.
3. Claude sign-in: the helper uses J's existing Claude Code sign-in if there is one, or asks once for an API key (see Q6 and the risk on plan terms). The key goes into Windows Credential Manager, never into a file.
4. GitHub: none needed if merges keep going through the project chat (Q4). If J picks GitHub on the PC, the helper asks for a fine-grained token for `sparkygogo77-spec/polio` only. The token goes into Credential Manager.

### Starting

- It starts with Windows.
- If it isn't running, the dock shows **Start the helper**. That is a `polio-helper://start` link, and Windows asks "Open Polio Helper?" the first time. The link carries no commands: it can only start the helper or bring up its window.

### Pairing with the Builder

```
 Builder dock                         PC
 ------------                         --
 [Pair with this PC]  ------------>   helper shows a window:
                                      "Pair with polio-two.vercel.app?
                                       Code: 418 207    [Deny]"
 [ 4 1 8 2 0 7 ]  [Pair]  -------->   code matches -> paired
 "Paired with JOSH-PC"                tray: "Paired: Builder"
```

1. The first time, Chrome asks "polio-two.vercel.app wants to connect to devices on your local network". J presses Allow. This is Chrome's Local Network Access prompt (see "Research").
2. The code shows only on the PC screen. So no website can pair on its own: someone has to be at the PC to read the code.
3. Five wrong codes lock pairing for 10 minutes.
4. On a match, the helper makes a long random token. The token is held in the helper's own page inside the dock (see "Safety"), not by the Builder page.
5. **Unpair** is in the tray and in the dock.

### Where the work happens

- **Site requests:** the board is in J's browser, so the agents don't touch files for it. The helper gives them tools (a small MCP server, the standard way to give Claude Code tools):
  - `site.read` returns parts, the System and pages;
  - `site.shot` returns a screenshot;
  - `site.apply` sends board steps to the dock, which applies them through the Builder's own store as named undo steps, then returns what changed.

  For a big change (more than about 20 parts), the lead makes a duplicate first and opens Compare, as "Make a better version" does.
- **Builder look and engine requests:** each lane gets:
  - a git worktree under `C:\Users\Josh\Downloads\Pleo\agents\<lane>`, on a branch `claude/<lane>` from base;
  - its own port from 3100 to 3199;
  - a brief made from `lane-rules.md`.

  All the worktrees share one `node_modules` folder, as today's live-check kit does, so a new lane doesn't run `npm ci` from nothing.

---

## 3. The coordinator inside the helper

Most of today's coordinator work is bookkeeping, so the helper does that part in plain code: ports, worktrees, queues, CI waits, `/api/version` loops. It costs nothing and does the same thing every time. Agents do only the parts that need judgement:
- the **lead** plans the request;
- the **lanes** write the code;
- a **checker** reads the live screenshots and writes the P-level line.

### Splitting a request into lanes

1. The lead reads the request, the context chips, and `handovers/owners.json`, a map of who owns which files.
   - The helper keeps this map from the lane handovers and git history.
   - Example: `shelf/parts/*` belongs to editable-imports, and `system/*` to system-panel.
2. It returns a plan: lanes, each with the files it will touch, a test it will turn from red to green, and a size.
3. The helper checks the plan:
   - **Two lanes on one file** can't run side by side. The second one is stacked: it starts from the first one's branch and merges after it, as MERGE-QUEUE item 11 does today.
   - **A file owned by a running lane** makes the new lane wait. If the file was given up by a lane that's done, the new lane goes ahead.
   - **A new Builder control** marks the lane "only you".

### How many run at once

- The default is 3 and J's setting goes up to 5, his standing limit. The dock shows "3 of 4".
- One `next build` at a time. A build needs about 3 GB, and two at once have run out of memory on this PC. Other steps carry on in parallel.
- A new agent doesn't start below 4 GB of free memory. It waits with the note "waiting for memory".
- Models follow J's rules:
  - the lead and design-heavy lanes use Opus 5.5;
  - contained lanes use Sonnet 5.5;
  - live screenshots are read by Sonnet;
  - no Fable unless J asks.

### Each lane's steps (the same as today, checked by the helper)

```
 brief -> red test on base -> fix -> green -> closest tests -> tsc
       -> push branch -> PR body (P-level, generality) -> CI
       -> merge on green, no conflicts -> wait for /api/version
       -> live check -> report in the merge feed
```

- The helper won't push a branch until it has seen the new test **fail on base and pass on the branch**. It runs both runs itself, so an agent can't just claim them.
- **Merge:**
  - **project chat** (today's way): the helper writes the labelled lines (PR, Fixes, Before, Ask) and the dock shows them with a Copy button. Or it types them into the chat, if Q4 says so.
  - **GitHub on the PC:** the helper merges through GitHub's API when CI is green and there are no conflicts. It never merges with a failed check and never uses force.
- **Live check:** after `/api/version` shows the new commit, headless Playwright runs in a fresh browser profile.
  - It uses the GPU flags from `lane-rules.md`.
  - It imports sol face, mochi and sunkcoin into **new** sites, never J's.
  - It runs the "nothing moved by a pixel" check plus the lane's own check.
  - It takes before and after shots at 1440.
- **Report:** the checker writes one line with a P-level and generality. A failed live check goes to the top of the feed as "!", with [revert] next to it.

### Handover and memory

Each lane still keeps `handovers/<lane>.md` (MEASURED vs BELIEVED). If the helper or the PC restarts, the helper reads them and the SDK's saved sessions, and resumes each lane where it was. Stopped lanes stay stopped.

---

## 4. Safety

| Rule | How it's held |
|---|---|
| **Only the paired Builder can drive it** | The helper listens on 127.0.0.1 only and checks the `Host` header, which stops DNS rebinding (a trick where a site's address quietly points at your PC). Every request needs the pairing token. CORS (the browser's cross-site rule) allows exactly `https://polio-two.vercel.app` and nothing else. Pairing needs the code shown on the PC. |
| **Builder scripts can't drive it either** | The Builder draws captured sites, so any script running on the Builder page could read what the page stores. So the dock is a frame served by the helper itself: `http://127.0.0.1:47821/dock`, with `frame-ancestors https://polio-two.vercel.app`. The token lives in that frame. Start, Approve, Pause and Stop are clicks inside it. The Builder page can only pass it context (the picked part, a screenshot), and only as data. |
| **Agents can't drive it** | Agents get neither the token nor the helper's port in their environment. A hook (a small check run before every tool call) refuses any agent command that touches the helper's port, its folder or its settings. |
| **Keys never shown** | Claude, GitHub and Vercel keys sit in Windows Credential Manager. The dock shows only "held" or "missing". Every line from an agent passes a filter that blanks anything shaped like a key before it reaches the dock or a log. A hook refuses commands that print the environment. The Builder's own keys stay in the browser and never go to the helper. |
| **Pause and Stop are J's only** | The pause flags live in the helper's memory and can only be set from inside the dock. Pause interrupts the agent's turn through the SDK and holds its session until Resume. As a second guard, a hook checks the flag before every tool call and refuses the call while paused. Stop ends that agent and the Windows process tree the helper started for it (held in a Windows job object), and nothing else. |
| **Spend cap** | There is a cap per day and a cap per request, and each agent gets its own budget, which the SDK enforces. At 80% the dock warns. At 100% every agent pauses and nothing is lost. Raising the cap is a click in the dock, never an agent's choice. |
| **Test networks only** | Permission rules and hooks deny: mainnet RPC (blockchain node) addresses, `vercel --prod` and deploy commands, certificate and trust-store tools (`certutil`, `Import-Certificate`), and `taskkill` or `Stop-Process` on processes the helper didn't start. Pushes to `sparkygogo77-spec/sink` are refused (read only). Agents run in **auto** mode, as today's sessions do: a checker reviews each action before it runs, and the deny rules are checked first and always win. Never "bypass permissions". A lane that keeps getting blocked falls back to asking, and its row turns "?". |
| **J's boards** | Live checks import into new sites in a fresh profile. Site requests change only the site J has open, as undo steps J can see. |

Not a wall: Claude Code's sandbox (which locks file and network access at the system level) doesn't run on native Windows (see Research). The hooks and rules above are checks, not a jail. Agents still run as J's Windows user. Their work stays in their worktrees by rule and by hook, not by the system.

---

## 5. Build order, in lanes that don't share files

| Step | Lane | Owns | Needs first | Size |
|---|---|---|---|---|
| 0 | **helper-contract** | `helper/contract.ts`: the messages between dock and helper (request, plan, lane row, step, pause, stop, merge line, spend), plus a fake helper for tests | nothing | small |
| 1 | **helper-core** | `helper/server/*` (loopback server, Host and Origin checks, pairing, token), `helper/agents/*` (Agent SDK runs, worktrees, ports, stream to the dock), `helper/jobs/*` (process trees) | contract | large |
| 1 | **dock-ui** | `helper/dock/*`: the dock page with the prompt box, plan card, list, PC now, merges and spend, built against the fake helper | contract | medium |
| 1 | **guard-hooks** | `helper/hooks/*` (pause wait, deny lists, key filter), `helper/settings/*` (permission rules) | contract | medium |
| 1 | **pc-now** | `helper/pc/*` (Windows process and memory reader) | contract | small |
| 2 | **lead-and-queue** | `helper/coordinator/*` (lead prompt, `owners.json`, stacking, how many at once, memory gate, build queue) | helper-core | large |
| 2 | **merge-and-check** | `helper/merge/*` (project-chat lines, or GitHub merge), `helper/livecheck/*` (headless Playwright, shots, checker) | helper-core | medium |
| 2 | **builder-entry** | `src/features/agents/*` (the Agents button, the frame, the context chips, the wheel entry) | dock-ui | small, but touches the top bar and wheel: agree with edit-ui-2 |
| 3 | **site-bridge** | `helper/mcp/site.ts`, `src/features/agents/bridge.ts` (`site.read`, `site.shot`, `site.apply` through the store's own steps) | builder-entry; agreed with the store's owner | medium |
| 3 | **installer** | `helper/install/*` (PowerShell script, at-log-on task, `polio-helper://` link, tray) | helper-core | small |
| 4 | **phone** (if Q5 says yes) | `helper/relay/*`, a relay route in `src/app/api/agents/*` | all of the above | medium |

Notes:
- **Step 1 runs four lanes at once.** They meet only at the contract, which comes first.
- **Only builder-entry and site-bridge touch `src/`.** Everything else is in a new `helper/` folder that no other lane owns.
- Each lane ends with a red-to-green test in `tests/`:
  - pairing: another origin gets refused, a missing token gets refused, a wrong Host gets refused;
  - pause: a fake agent's tool call waits until Resume;
  - stop: only the started process tree ends;
  - key filter: a key-shaped line is blanked;
  - stacking: two lanes on one file don't run side by side.
- **The first useful point is the end of step 2.** At that point J can type a Builder request in the dock and watch it go through to a merge.
- Site requests (step 3) come later because they touch the Builder's store, which other lanes own.

---

## 6. Risks

- **Plan terms and cost.** Anthropic's docs say third parties may not offer claude.ai login for apps built on the Agent SDK, and they point SDK apps to API keys. They don't cover a tool J runs only for himself on his own login. If J wants to use his plan, the likely route is the helper running Claude Code's own headless mode (`claude -p`) under his login. That must be checked against the terms before building. On an API key, parallel Opus agents spend real money fast. Remember the merge thread that grew to 142M tokens. Hence the cap, the per-agent budgets, and short lanes that start fresh rather than one long thread.
- **Chrome's local-network prompt.** It appears once per site, and some setups block it. The Claude desktop app's built-in browser pane may not show it at all (not tested). Safari won't allow it. If the frame can't load, the same dock opens as its own page at `http://127.0.0.1:47821`, which needs no prompt.
- **No sandbox on Windows.** Agents run with J's rights, and a hook is a check, not a wall. The worktrees, deny lists, auto mode (never bypass) and Stop keep the risk small, not zero. WSL2 (Linux inside Windows) would give a real sandbox, but it is slower and more to install, so it's left for later.
- **The token is powerful.** Whoever holds it can send prompts, and prompts become code. It stays in the helper's frame, never goes in a URL, and can be revoked with Unpair. An agent can't read it.
- **Memory.** Five agents plus builds can fill 32 GB. The build queue and the memory gate slow work down instead of crashing.
- **Lanes clash anyway.** A shared file the map missed (like `side.tsx`) causes a merge conflict. The helper stacks the later lane and re-runs its tests rather than forcing.
- **Live checks are flaky.** Pictures arrive late, as the system-panel lane found on gotchi. The checker waits for the board to hold still and repeats a failure once before reporting it.
- **The Builder's store moves under site requests.** `site.apply` uses the store's own steps, so a change in the store needs the bridge updated with it. The bridge has its own test against the three capture sites.
- **J leaves the PC.** The helper keeps working with the dock closed, and the merge feed waits for him. Questions to J wait. Other lanes carry on.

---

## 7. Questions for J

Answer as many as you like in one go. Each has a recommendation.

1. **Panel in the Builder, or a separate local page?**
   *Recommended: both, as one thing.* It shows as a dock in the Builder, drawn by the helper. The same dock opens on its own at `http://127.0.0.1:47821` when the Builder isn't open, or if Chrome blocks the frame.
2. **Merge on its own when tests are green, or ask you each time?**
   *Recommended: on its own for P2 and P3 Builder fixes, as your standing rule says.* It asks you first for a new control, anything touching keys, accounts or saving, and any engine change to capture or export. You see every merge in the feed with shots and can undo it.
3. **A daily spend cap?**
   *Recommended: $15 a day and $5 per request, with a warning at 80%. At the cap every agent pauses.* You can raise it in the dock for the day.
4. **GitHub sign-in on the PC, or keep the project chat?**
   *Recommended: GitHub on the PC, with a fine-grained token for `polio` only, merging only on green CI.* The project chat costs a long thread per merge and once failed to send silently, and the helper can watch CI itself. If you'd rather keep the chat, the helper writes the lines and you press Copy and send.
5. **PC only, or your phone too?**
   *Recommended: PC first. Phone after step 4, view and steer only.* Claude's own Remote Control can't do this: it needs a plan login, not an API key, and it shows one session, not the dock. From the phone you could see the list and merges, steer, pause, stop and approve, but not start new requests or change the cap. It works through a relay on polio-two.vercel.app that the helper calls out to, so nothing on the PC opens to the internet. You would pair the phone with a QR code shown on the PC.
6. **Which Claude sign-in pays for it?**
   *Recommended: an API key with the cap above, so it's clearly within the terms and the meter shows the real bill.* Using your plan instead needs the check in "Risks" first.
7. **How many agents at once?**
   *Recommended: 3 by default, 5 at most (your current limit).*
8. **New controls in this proposal** need your yes:
   - the Agents button in the top bar;
   - the dock;
   - Ask agents on the wheel.

   *Recommended: yes to all three.*
9. **The look of the status marks:** the turning-gap ring above (from your Lantern "Orbit"), or the edge stripe ("Rail")?
   *Recommended: the ring.* It reads at the dock's small size and has a place for every state, including "checking".

---

## Research: what was checked

Read on 2026-10-24.
- **VERIFIED** means a current doc says it, or this PC showed it.
- **BELIEVED** means it is inferred, and the first lane must test it.

**Running Claude Code without a window**
- VERIFIED ([headless](https://code.claude.com/docs/en/headless.md), [CLI reference](https://code.claude.com/docs/en/cli-reference.md)):
  - `claude -p` runs a prompt with no window.
  - `--output-format stream-json` streams each step as a line of JSON. With `--input-format stream-json`, more messages can be fed in.
  - `--resume <session>` carries on a saved session.
  - `--max-turns`, `--allowedTools`, `--disallowedTools`, `--permission-mode`, `--append-system-prompt` and `--max-budget-usd` all exist.
  - Since 2.1.302, `-p` with no mode set refuses anything that needs approval, so a mode or an allow list must be given.
- VERIFIED ([setup](https://code.claude.com/docs/en/setup.md)): native Windows is supported (Windows 10 1809 and later). Git for Windows gives the Bash tool; without it, the PowerShell tool is used.
- VERIFIED on this PC: there is no `claude` on PATH. The Claude desktop app keeps its own copy (2.1.308) under `AppData\Roaming\Claude\claude-code`. The helper can't count on that copy, so it brings its own through the SDK.

**Claude Agent SDK** (TypeScript, `@anthropic-ai/claude-agent-sdk`)
- VERIFIED ([TS reference](https://code.claude.com/docs/en/agent-sdk/typescript.md), [streaming input](https://code.claude.com/docs/en/agent-sdk/streaming-input.md), [cost](https://code.claude.com/docs/en/agent-sdk/cost-tracking.md)):
  - `query()` takes `cwd`, `permissionMode`, `canUseTool`, in-process `hooks`, `abortController`, `maxTurns`, `maxBudgetUsd`, `settingSources`, `resume` and `env`.
  - In streaming input mode you can add messages, `interrupt()` a turn, and change the permission mode.
  - Messages sent mid-turn queue until the turn ends.
  - The result gives `total_cost_usd`, which is an estimate, not the bill, plus `usage` and the `session_id`.
  - The SDK bundles the Claude Code program for each platform.
- BELIEVED: Steer works as interrupt, then send. Pause works as interrupt, then hold. Both rest on the verified calls above.

**Permission modes**
- VERIFIED ([modes](https://code.claude.com/docs/en/permission-modes.md), [permissions](https://code.claude.com/docs/en/permissions.md)):
  - The modes are default, `acceptEdits`, `plan`, `auto`, `dontAsk` and `bypassPermissions`.
  - In `auto`, a checker reviews each action, and after repeated blocks it falls back to asking.
  - Rules are `allow`, `ask` and `deny` lists, checked deny first.
- VERIFIED ([sandboxing](https://code.claude.com/docs/en/sandboxing.md)): the sandbox runs on macOS, Linux and WSL2, **not native Windows**.

**Hooks and progress**
- VERIFIED ([hooks](https://code.claude.com/docs/en/hooks.md), [SDK hooks](https://code.claude.com/docs/en/agent-sdk/hooks.md)):
  - Events include PreToolUse, PostToolUse, Notification, Stop, SubagentStop, UserPromptSubmit, SessionStart, SessionEnd and PermissionRequest.
  - A PreToolUse hook can refuse a call, with exit code 2 or a JSON "deny".
  - HTTP hooks exist.
  - Progress comes from the stream (each step as JSON), and a partial-message option shows text as it is written.
- BELIEVED, and test first: a hook that *waits* while paused. The two docs disagree on what happens when a hook times out. So the design pauses by interrupting the turn, and uses the hook only to refuse calls.

**Parallel worktrees**
- VERIFIED ([worktrees](https://code.claude.com/docs/en/worktrees.md)):
  - `claude --worktree <name>` makes `.claude/worktrees/<name>` on its own branch.
  - Subagents can each get a worktree.
- The helper makes its own worktrees with plain `git worktree`, so it controls branch names (`claude/<lane>`) and folders.
- VERIFIED ([agent view](https://code.claude.com/docs/en/agent-view.md)): `claude --bg` and `claude agents` are a terminal-only research preview that runs background agents in worktrees. They overlap this idea but have no Builder dock, lanes or merges.

**Sign-in**
- VERIFIED ([authentication](https://code.claude.com/docs/en/authentication.md), [SDK overview](https://code.claude.com/docs/en/agent-sdk/overview.md)):
  - An `ANTHROPIC_API_KEY` in the environment wins over a plan login, so the helper must set it on purpose and not inherit a stray one.
  - Third parties may not offer claude.ai login in SDK apps.
  - `claude setup-token` makes a one-year plan token.
- BELIEVED: personal use on J's own login is a grey area (see Risks and Q6).

**A web page talking to localhost**
- VERIFIED ([Chrome LNA](https://developer.chrome.com/blog/local-network-access)):
  - Chrome's **Local Network Access** replaced the older Private Network Access idea, along with its `Access-Control-Allow-Private-Network` preflight.
  - A public HTTPS page reaching a loopback address (127.0.0.1) needs a one-time permission prompt. It launched in Chrome 142.
  - It covers `fetch` and frames (subframe navigation).
  - It can only be asked for from HTTPS pages.
- BELIEVED: WebSockets are now gated too (Chrome 147, per one vendor page), so the helper uses plain `fetch` with streamed replies, not WebSockets.
- BELIEVED (old Chrome and Firefox bugs, and the LNA rule on IP literals): `http://127.0.0.1` from an HTTPS page isn't blocked as mixed content. The helper uses the IP, not the name `localhost`.
- CORS is separate from LNA: the helper still has to allow only `https://polio-two.vercel.app`, and check `Origin` and `Host` itself.
- Not checked: whether the Claude desktop app's built-in browser shows the LNA prompt.

**Links that open a local app**
- VERIFIED on this PC (registry): `claude://` opens the Claude desktop app.
- VERIFIED ([deep links](https://code.claude.com/docs/en/deep-links.md)):
  - `claude-cli://open?q=...&cwd=...` opens a terminal with a prompt filled in. It never sends the prompt and can't report back.
  - On this PC it isn't registered yet: that happens after the first prompt sent in a terminal.
- Neither is a control channel, so the helper registers its own `polio-helper://start`, which only starts it.

**Remote Control**
- VERIFIED ([remote control](https://code.claude.com/docs/en/remote-control.md)): it lets claude.ai/code or the Claude app drive a local session. It needs a Pro, Max, Team or Enterprise plan, and API keys aren't supported. That's why the phone option uses its own relay.

---

## J's answers (2026-10-25), and what changes

1. **Where the agents run: hybrid.**
   - Cloud is the default.
   - Local runs only for tasks that need the PC: local captures, J's boards, his desktop apps.
   - The helper decides per lane and shows "cloud" or "PC" on each row.
   - Local lanes keep the memory gate and one build at a time.
2. **Panel:** a dock in the Builder, with a fallback page.
3. **Merges:**
   - automatic on green for P2/P3 fixes;
   - J is asked first for new controls, keys, accounts, saving, and capture or export engine changes;
   - a merge feed with Undo.
4. **Spending:** two meters, because J will test both ways of paying (7).
   - On an API key the cap is in dollars, since the key bills per token.
   - On his Claude plan the cap is in tokens, or a share of his plan's limits.
   - Both meters count tokens per lane and per request, so the two ways can be compared.
5. **GitHub:** open. J asked how the agents, the repo, his desktop and the Builder fit together; see the explainer in the coordinator's reply. Keep the project chat until he picks.
6. **Phone:** full control from the start if it can be made safe. If not, from the phone he can watch, steer, pause and approve.
7. **Who pays:** both, as a test.
   - Desktop or local runs use his plan (`claude -p` under his login), after a terms check.
   - Cloud runs use cloud sessions.
   - Measure tokens and time for each and show them side by side.
8. **Agents at once:** 3 by default, 5 at most.
9. **Controls:** yes to the Agents button, the dock, and "Ask agents" on the wheel. He also asked for **part actions** (below).
10. **Status mark:** a ring that fills toward done.
    - A lane has known steps: brief, red test, fix, green, push, CI, merge, live check. The ring is split into those 8 segments, which fill as the steps finish.
    - The step under way fills and empties (breathes) in its own segment.
    - The time left is estimated from past lanes of the same size, shown as "~12 min" beside the ring.

### New: part actions (J, Q9)

Right-click any part on the board, choose **Ask agents**, then pick one:

| Action | The agent gets | It returns |
|---|---|---|
| Change this | the part's data, screenshot, System tokens, layout position | the change, as undo steps, or code if the Builder must change |
| Suggest features | the above, plus the section and page, and the site's export files for the part (mapped by `polio/export.json` and `design/record.json`) | 3–5 feature cards you can pick from |
| Security check | the part's links, forms, embeds and scripts, and for exported sites the matching files and routes | findings with a P-level and fixes as cards |
| Build its backend | the part, if it is a form, signup, wallet button, counter or feed | backend options (API route plus storage choice, validation, rate limit), each with a cost note. Picking one starts a lane |
| Explain | the Builder source file that draws this kind of part (`shelf/parts/<kind>.tsx`) and the docs (DESIGN.md, AGENTS.md, the framework docs) | where it comes from and what can be changed |

- A captured site's original backend can't be seen (only the page was captured). The agent infers what the part needs and offers to build it.
- Every card is an option; nothing runs until J picks one.
