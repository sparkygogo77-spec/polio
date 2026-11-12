# Harness research: how to lose less time between chats

12 Nov 2026. One round of reading, judged against what cost time on 11 Nov.
I can't see the PC's harness files, so the file names under "How" are proposals.
Only `.claude/settings.json`, `.claude/hooks/catch-up.sh` and `scripts/` are names I checked in this repo.

## The changes

**1. One STATE.md, and the coordinator can't end a turn without it**
- What: the coordinator rewrites `STATE.md` every turn (lanes, open questions, next step). A handover is "read STATE.md".
- Why: the 11 Nov handout pointed at a notes file that didn't exist. A file checked every turn can't go missing at handover.
- How: a `Stop` hook on the coordinator (`.claude/hooks/state-check.sh`) exits 2 if `STATE.md` wasn't changed this turn or names a path that isn't on disk. A `SessionStart` hook prints `STATE.md` into the new chat.

**2. Hand over when the chat is full, not every five turns**
- What: hand over at about 60% of the context window. Five short turns stay in one chat; one huge turn hands over early.
- Why: fewer handovers means fewer chances for a bad handout. Anthropic dropped fixed resets once the models stopped rushing near the limit.
- How: hooks get no context size, but the status line script does (`context_window.used_percentage`). It writes the number to a file; the `Stop` hook from change 1 reads it and says "hand over now". A `PreCompact` hook tells the summary to keep `STATE.md`.

**3. A merge request is five lines and a pointer**
- What: branch and the commit it started from, the files it was allowed to touch, the checks file, what J should look at, what is not done. Detail lives in a file on the branch.
- Why: requests ran to 3,800 characters. Anthropic has workers save their work and "pass lightweight references back"; Telerik's handoff is four fields: scope, interface, base, evidence.
- How: a `PreToolUse` hook on whatever sends the request (`.claude/hooks/merge-request-size.sh`) denies anything over 800 characters and names the file to move the rest into.

**4. A checks file per lane, tied to the commit, with the widths in it**
- What: `lane/checks.json`: one row per check with `passes`, the test name, the width it ran at, and the commit it ran on.
- Why: the merge ran twice because one test failed at 1100 px. If the lane had to show a pass at the merge's widths, the first merge is the only one.
- How: `scripts/lane-checks.mjs` runs `npm run test:changed` at the merge chat's widths and writes the file. The hook from change 3 also denies a request whose `checks.json` is for an older commit or has a `false`. JSON, because Anthropic found chats rewrite it less carelessly than Markdown.

**5. On a failed merge check, rerun the one test, not the suite**
- What: the merge chat reruns only the failing test after the fix, then merges.
- Why: the 11 Nov rerun took 15 more minutes for one test at one width.
- How: the merge chat's rules plus a `--only <test>` path in `scripts/test-all.mjs`. `npm run test:nightly` still runs everything, so nothing goes unchecked for long.

**6. A short second look inside the lane before it asks to merge**
- What: a fresh read-only helper reads the diff against the lane's brief and looks at a board picture at each merge width. Pass or fail, one pass, at the end.
- Why: catches the 1100 px kind of miss before the merge chat spends 15 minutes on it. A chat marks its own work too kindly; a fresh one doesn't.
- How: `.claude/agents/pre-merge-review.md` (tools: Read, Grep, Glob, Bash; no edits). It uses `npm run board -- shot pst`. Its verdict is one row in `checks.json`. Keep it short: Anthropic kept the evaluator only where the builder is unreliable.

**7. J's pictures travel as files with a place, not as descriptions**
- What: every picture J sends is saved to a shared folder with the page, the width and the part it is about. Lanes open the file themselves.
- Why: screenshots never reached the lanes; the coordinator re-described and guessed. Messages between chats are text only, so the picture must be a file both can read.
- How: the phone page and console save uploads to `inbox/pictures/<id>.png` plus `<id>.json` (route, width, part, note). No Claude Code hook can do this: the prompt hook only receives text. The record shape is borrowed from nit and Agentation (element, route, viewport).

**8. A question has a number, an owner and a default; any answer closes it**
- What: each question is a small file: id, the chat that asked, the choices, and "if no answer by then, I will do X". Picture rounds get three buttons: Good, Again, Skip.
- Why: 17 were open and answering in words closed nothing. With a default, 48 hours ends in a decision instead of a hidden question.
- How: `questions/<id>.json`. The coordinator's turn starts by matching J's words to open ids and closing them in `STATE.md`. At 48 hours the asker takes its default and says so in one line. Cap open questions at five.

**9. Answers go to the question, not to a window**
- What: a button writes `answers/<id>.json`. The chat that owns the id picks it up. Nothing is sent to "the chat in front".
- Why: a button sent J's yes into the wrong chat. Also, Claude Code says a message relayed from another chat "never counts as your consent", so the coordinator must not pass a yes along.
- How: extend `.claude/hooks/catch-up.sh` to print answers for ids the chat owns. Name every chat (`claude --name lane-2`) and store the name in the question. For new chats from the phone, keep `claude remote-control --spawn worktree` running on the PC: the phone can then start chats, each in its own checkout.

**10. One merge watcher that no chat owns**
- What: the watcher runs as a Windows scheduled task and writes a heartbeat file. Chats only read it.
- Why: the watcher died with the chat that started it. Claude Code says the same of its own timers and background commands: they stop when the session exits.
- How: `scripts/merge-watch.mjs`, started by Task Scheduler at logon, writing `merge-watch.json` every minute. The `SessionStart` hook warns in one line if the heartbeat is over two minutes old.

## Your eight ideas, in one line each

- STATE.md: yes, with the Stop hook that makes it true (1).
- Hooks blocking a bad handout or a long request: yes, both are possible today (1, 3).
- Pass/fail checklist with test names: yes, as JSON, tied to the commit and the width (4).
- One shared watcher: yes, but outside every chat (10).
- Auto-copying pasted images: not with a hook; do it in the phone page and console (7).
- Evaluator in the lane: yes, one short pass at the end (6).
- Questions folding at 48 hours: changed. They close on a stated default, they don't hide (8).
- Handover by context size: yes, through the status line script (2).
- Not adopted: Claude Code "agent teams". Still experimental, the lead can't be replaced, helpers don't survive a resume, and split panes don't work in Windows Terminal.

## Sources

- Anthropic, Effective harnesses for long-running agents (26 Nov 2025): feature list with a `passes` field, progress file, test like a user. https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
- Anthropic, Harness design for long-running apps (24 Mar 2026): planner, generator, evaluator; resets dropped, evaluator moved to one pass at the end. https://www.anthropic.com/engineering/harness-design-long-running-apps
- Anthropic, How we built our multi-agent research system (13 Jun 2025): what a brief needs; save work, pass references. https://www.anthropic.com/engineering/multi-agent-research-system
- Claude Code, Hooks reference: Stop, PreToolUse, SessionStart, PreCompact; exit 2 blocks; prompt hook gets text only. https://code.claude.com/docs/en/hooks
- Claude Code, Status line: the only place the context percentage is handed to a script. https://code.claude.com/docs/en/statusline
- Claude Code, Subagents: read-only helpers with a fresh context. https://code.claude.com/docs/en/sub-agents
- Claude Code, Skills: a merge-request or handover routine as a skill. https://code.claude.com/docs/en/skills
- Claude Code, Memory: CLAUDE.md is context, not enforcement; use a hook to block. https://code.claude.com/docs/en/memory
- Claude Code, Worktrees: one checkout per chat; hooks read the checkout from `cwd`. https://code.claude.com/docs/en/worktrees
- Claude Code, Remote Control: server mode starts new chats from the phone; photos from the phone reach only that chat. https://code.claude.com/docs/en/remote-control
- Claude Code, Cross-session messaging: chats are addressed by name; text only; can't carry J's approval. https://code.claude.com/docs/en/cross-session-messaging
- Claude Code, Scheduled tasks: timers and background commands end with the session. https://code.claude.com/docs/en/scheduled-tasks
- Claude Code, Desktop scheduled tasks: a second way to run the watcher, needs the app open. https://code.claude.com/docs/en/desktop-scheduled-tasks
- Claude Code, Agent teams: read and not adopted. https://code.claude.com/docs/en/agent-teams
- Claude Code, Channels: phone chat bridges, still a preview; not needed if change 9 is done. https://code.claude.com/docs/en/channels
- Agentation: click a part, get its selector and position; needs React 18 and a desktop browser, no phone. https://github.com/benjitaylor/agentation
- nit: click to annotate, stores element, route and viewport; before and after pictures; Verified, Reopen, Skip. AGPL. https://github.com/SpaceParrots/nit
- Vibe Annotations: browser extension for local pages; its README doesn't say what each note stores. https://github.com/RaphaelRegnier/vibe-annotations
- Telerik, Multi-agent orchestration patterns (Adam Bertram, 23 Sep 2026): the handoff is a versioned file with scope, interface, base commit and evidence; test the combined state; the merge decision stays with a person. https://www.telerik.com/blogs/multi-agent-orchestration-software-delivery-patterns-multi-repository-workflows
- Augment, Multi-agent orchestration guide (4 May 2026): split, route, shared state, recovery; a hub that owns the state is easiest to debug; a third of failures in the studies it cites are coordination failures. https://www.augmentcode.com/guides/multi-agent-orchestration-architecture-guide
- Cursor, Design Mode: each note carries what you picked plus a screenshot; notes can be collected as numbered pins and sent in one go. https://cursor.com/docs/agent/design-mode

## Message

- You get: ten changes, each tied to something that cost time on 11 Nov; change 1 (STATE.md with its Stop hook) and change 4 (checks file with widths) are the two to do first.
- Look at: change 7 and change 9. Both need work in your phone page and console, not in Claude Code, so they are yours to say yes to.
- Not done: nothing was built or tested on the PC, and the file names under "How" are proposals until someone checks them against the real harness.
