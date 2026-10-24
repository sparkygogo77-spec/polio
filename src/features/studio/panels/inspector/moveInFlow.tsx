"use client";
/**
 * MOVE UP / MOVE DOWN, in a part's Position and size (J, 2026-10-23).
 *
 * The panel's door to Alt+↑ / Alt+↓ on the board: the picked part trades
 * places with the one beside it in its holder and column, with everything it
 * holds, in one step of undo (`board/tradePlaces.ts`). A way it cannot go is
 * shown shut, not hidden, so the pair reads the same on every part.
 */
import * as React from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useHeldStudio } from "../../board/store";
import { canTrade, tradePlaces } from "../../board/tradePlaces";
import { play } from "@/core/audio/engine";
import { Button } from "@/core/ui/button";
import { Tooltip } from "@/core/ui/tooltip";

export function MoveInFlow({ id }: { id: string }) {
  const nodes = useHeldStudio((s) => s.nodes);
  const [up, down] = React.useMemo(() => [canTrade(id, -1), canTrade(id, 1)], [id, nodes]);
  const go = (dir: -1 | 1) => play(tradePlaces(id, dir) ? "tap" : "deny");
  return (
    <div className="flex gap-1" data-move-in-flow="">
      <Tooltip content="Trade places with the part above it (Alt+↑)">
        <Button size="xs" variant="outline" className="flex-1" data-move-up="" disabled={!up} onClick={() => go(-1)}><ArrowUp />Move up</Button>
      </Tooltip>
      <Tooltip content="Trade places with the part below it (Alt+↓)">
        <Button size="xs" variant="outline" className="flex-1" data-move-down="" disabled={!down} onClick={() => go(1)}><ArrowDown />Move down</Button>
      </Tooltip>
    </div>
  );
}
