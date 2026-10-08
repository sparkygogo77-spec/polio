"use client";
/**
 * The fix loop on the board (`fixLoop.ts` holds the rules): the problems the
 * board's check finds now, as issues by hook, and the ticks kept on the board.
 */
import * as React from "react";
import { useStudio, useSteady } from "./store";
import { readBoard } from "./PublishCheck";
import { NO_LOOP, type FixIssue, type FixLoop } from "./fixLoop";

/** The board's problems now, each named by its part's data-hook and its page's name. */
export async function issuesNow(): Promise<FixIssue[]> {
  const problems = await readBoard();
  const s = useStudio.getState();
  return problems.map((p) => ({
    key: p.key,
    kind: p.kind,
    hook: s.nodes.find((n) => n.id === p.id)?.hooks?.["data-hook"] ?? null,
    page: s.pages.find((x) => x.id === p.pageId)?.name ?? p.pageId,
    says: p.says,
  }));
}

/** The issues, read again a moment after the board stops changing. */
export function useIssues(): FixIssue[] {
  const nodes = useSteady(useStudio((s) => s.nodes));
  const [issues, setIssues] = React.useState<FixIssue[]>([]);
  React.useEffect(() => {
    let live = true;
    const t = window.setTimeout(() => { void issuesNow().then((x) => { if (live) setIssues(x); }).catch(() => {}); }, 600);
    return () => { live = false; window.clearTimeout(t); };
  }, [nodes]);
  return issues;
}

export const fixLoopOf = (look: unknown): FixLoop => ({ ...NO_LOOP, ...((look as { fixLoop?: FixLoop } | null)?.fixLoop ?? {}) });

export const useFixLoop = (): FixLoop => fixLoopOf(useStudio((s) => s.look));

export function setFixLoop(next: FixLoop): void {
  useStudio.getState().setLook({ fixLoop: next } as never);
}
