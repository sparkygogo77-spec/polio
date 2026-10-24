/**
 * A PICKED PART TRADES PLACES WITH THE ONE BESIDE IT, UP OR DOWN THE PAGE.
 *
 * The one step both doors take: Alt+↑ / Alt+↓ on the board
 * (`DesktopCanvas.tsx`) and Move up / Move down in the side panel's
 * Position and size (`panels/inspector/Panel.tsx`, J, 2026-10-23). The moves
 * are `swapInFlow`'s (`flowOrder.ts`); this writes them as one step of undo.
 */
import { resolvePalette } from "../shelf/run";
import { swapInFlow } from "./flowOrder";
import { boxOf } from "./helpers";
import { useStudio } from "./store";

/** Can the part move this way at all (a neighbour in its holder and column)? */
export function canTrade(id: string, dir: -1 | 1): boolean {
  const s = useStudio.getState();
  return !!swapInFlow(s.nodes, id, dir, resolvePalette(s.format, s.look))?.size;
}

/** Trade places; false when there is nothing to trade with. */
export function tradePlaces(id: string, dir: -1 | 1): boolean {
  const s = useStudio.getState();
  const moves = swapInFlow(s.nodes, id, dir, resolvePalette(s.format, s.look));
  if (!moves?.size) return false;
  s.commit();
  useStudio.setState({ nodes: s.nodes.map((n) => (moves.has(n.id) ? { ...n, y: n.y + moves.get(n.id)!, ...(n.byHand ? {} : { byHand: true, handFrom: boxOf(n) }) } : n)) });
  return true;
}
