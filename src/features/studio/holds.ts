import type { StudioNode } from "./board/store";

/**
 * Does this part hold others: wholly contain at least one smaller part on
 * its page? On a captured board these are the banner, the panels and the
 * page wrapper — the things that cover every point, and the things a
 * marquee is drawn ACROSS rather than moved (Canvas.tsx), and a drawing is
 * made OVER rather than into (reshapeRun.ts).
 */
export function ownsOthers(nodes: readonly Pick<StudioNode, "id" | "pageId" | "x" | "y" | "w" | "h">[], c: Pick<StudioNode, "id" | "pageId" | "x" | "y" | "w" | "h">): boolean {
  return nodes.some((n) => n.id !== c.id && n.pageId === c.pageId
    && n.x >= c.x && n.y >= c.y && n.x + n.w <= c.x + c.w && n.y + n.h <= c.y + c.h
    && n.w * n.h < c.w * c.h);
}
