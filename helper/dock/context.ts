/**
 * The dock's side of "context, never control" (AGENTS-PANEL-PROPOSAL.md,
 * Safety): the Builder posts the picked part, its page, a picture reference
 * and the part's System tokens (src/features/agents/context.ts). The dock
 * takes it only from the live Builder's origin, keeps only those data
 * fields, and never lets a message start, approve, pause or stop anything,
 * or carry a token.
 *
 * Pure: tests/agents-dock-context.mjs imports it straight.
 */
import { PART_ACTIONS, type Chip, type PartAction } from "../contract.ts";

export const BUILDER_ORIGINS = ["https://polio-two.vercel.app"];

/** Keys a context message may never carry, at any depth. */
const FORBIDDEN = /^(token|pairing|pair|auth|authorization|secret|key|keys|do|control|controls|start|approve|decline|pause|resume|stop|run)$/i;

export type Taken = { chips: Chip[]; action: PartAction | null; part: { id: string; kind: string; name: string } | null; tokens: { field: string; name: string; value: string }[] };
export type Refused = { refused: string };

function forbiddenKey(x: unknown, depth = 0): string | null {
  if (!x || typeof x !== "object" || depth > 6) return null;
  for (const [k, v] of Object.entries(x)) {
    if (FORBIDDEN.test(k)) return k;
    const deeper = forbiddenKey(v, depth + 1);
    if (deeper) return deeper;
  }
  return null;
}

const str = (v: unknown, max = 200) => (typeof v === "string" && v.length <= max ? v : null);

export function takeContext(origin: string, data: unknown, allowed = BUILDER_ORIGINS): Taken | Refused {
  if (!allowed.includes(origin)) return { refused: `origin ${origin}` };
  if (!data || typeof data !== "object") return { refused: "not an object" };
  const m = data as Record<string, unknown>;
  if (m.source !== "polio-builder" || m.kind !== "context") return { refused: "not a context message" };
  const bad = forbiddenKey(m);
  if (bad) return { refused: `carries "${bad}"` };

  const action = m.action == null ? null : (PART_ACTIONS as readonly string[]).includes(m.action as string) ? (m.action as PartAction) : undefined;
  if (action === undefined) return { refused: "unknown action" };

  const chips: Chip[] = [];
  for (const c of Array.isArray(m.chips) ? m.chips : []) {
    const k = (c as Record<string, unknown>)?.kind;
    if (k === "part" && str((c as any).id)) chips.push({ kind: "part", id: (c as any).id, ...(str((c as any).name) ? { name: (c as any).name } : {}) });
    else if (k === "page" && str((c as any).id)) chips.push({ kind: "page", id: (c as any).id });
    else if (k === "shot" && str((c as any).ref, 500)) chips.push({ kind: "shot", ref: (c as any).ref });
  }
  const p = m.part as Record<string, unknown> | null;
  const part = p && str(p.id) && str(p.kind) ? { id: p.id as string, kind: p.kind as string, name: str(p.name) ?? "" } : null;
  const tokens = (Array.isArray(m.systemTokens) ? m.systemTokens : [])
    .filter((t: any) => str(t?.field) && str(t?.name) && str(t?.value))
    .slice(0, 40)
    .map((t: any) => ({ field: t.field, name: t.name, value: t.value }));
  return { chips: chips.slice(0, 12), action, part, tokens };
}
