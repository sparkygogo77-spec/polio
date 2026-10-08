"use client";
/**
 * THE BOARD'S LAST CHANGE, WRITTEN ON ITS SITE.
 *
 * The studio store says when a person changes the board (`onBoardEdit`);
 * this writes the time on the open site (`Project.editedAt`), which is what
 * the Builds page and the save line read. Written at most once a second: a
 * run of typing is many edits and one line in the site list.
 */
import { onBoardEdit } from "@/features/studio/board/store";
import { useBuilds } from "./store";

/** The latest edit, before it is written: `now()` answers it at once. */
let latest = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let started = false;

const flush = () => {
  timer = null;
  const { activeId, setEdited, projects } = useBuilds.getState();
  if (!activeId || !latest) return;
  if (projects.find((p) => p.id === activeId)?.editedAt === latest) return;
  setEdited(activeId, latest);
};

/** When the open board was last changed, including an edit not yet written down. */
export function lastEdit(): number | null {
  const { activeId, projects } = useBuilds.getState();
  const kept = projects.find((p) => p.id === activeId)?.editedAt ?? 0;
  return Math.max(kept, latest) || null;
}

/** Write any edit still waiting, now: before a publish reads the time. */
export function flushEdits(): void {
  if (timer) { clearTimeout(timer); flush(); }
}

export function startEditClock(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  onBoardEdit(() => {
    latest = Date.now();
    if (!timer) timer = setTimeout(flush, 1000);
  });
  /* A switch of site ends the last one's run: its edit time is its own. */
  let was = useBuilds.getState().activeId;
  useBuilds.subscribe((s) => {
    if (s.activeId === was) return;
    if (timer) { clearTimeout(timer); timer = null; const id = was; const at = latest; if (id && at) useBuilds.getState().setEdited(id, at); }
    latest = 0;
    was = s.activeId;
  });
}
