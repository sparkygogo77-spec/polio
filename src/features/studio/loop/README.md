# studio/loop

The build loop: the timeline of builds (Finish), threads and the strands that
link them, the lanes, the build queue, and the agent that turns the board into
code chats. A module of the builder audit's split (item 11).

**Doors.** Other files import this module only through its doors; anything
deeper fails `tests/module-doors.mjs`. Files in here import each other freely.

- `index.ts`: the pure loop. No React, no store, every import ends in `.ts`,
  so node tests load it: `threads.ts`, `strand.ts`, `lanes.ts`,
  `lanesSample.ts`, `queue.ts`.
- `run.ts`: the agent (`agent.ts`) and the timeline's vines
  (`timeline/vines.ts`), which need the bundler's imports.
- `ui.ts`: the Timeline (`Timeline.tsx`, `timeline/`) and the Lanes
  (`Lanes.tsx`).
