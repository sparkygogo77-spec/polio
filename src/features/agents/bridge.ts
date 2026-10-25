"use client";
/**
 * THE SITE BRIDGE: THE DOCK ASKS, THE BOARD ANSWERS (AGENTS-PANEL-PROPOSAL.md,
 * "Where the work happens", site requests).
 *
 * An agent working on the open site never touches a file for it: the board
 * is in J's browser. The helper gives the agent three tools
 * (`helper/mcp/site.ts`): `site.read`, `site.shot` and `site.apply`. Each one
 * travels helper → dock frame → this page as a `postMessage`, and the answer
 * goes back the same way.
 *
 * What holds here:
 *   - only the paired dock frame is heard: the message must come from the
 *     helper's origin AND from the frame's own window (`listen(frame)`). A
 *     script on this page (a captured site draws here) posts from this
 *     page's origin, so it is refused before it is read;
 *   - `site.apply` runs only through the store's own actions, never a write
 *     to storage, and the whole request is one undo step (`historyMark` →
 *     `oneStepSince`), named on the timeline as "Agent: …" (`landThread`);
 *   - a request names the site it is for; another site, or a part that is
 *     not on the board, refuses the whole request, and nothing is applied;
 *   - a step can't reach keys, the Account or publishing: there is no op for
 *     them, and a patch that names one, or carries a key-shaped value, is
 *     refused (`checkApply`);
 *   - a change that touches more than BIG_CHANGE parts first makes a
 *     Duplicate (the before) and offers Compare, as "Make a better version"
 *     does.
 *
 * The shapes and the gate (`checkApply`, `planApply`) are in `siteSteps.ts`,
 * which imports nothing, so `tests/agents-site-bridge.mjs` reads them straight;
 * `listen` and `apply` here touch the stores.
 */
import { useStudio, type StudioNode } from "@/features/studio/board/store";
import { useBuilds } from "@/features/builds/store";
import { compareHref } from "@/features/studio/compare/model";
import { setToken, siteSystem } from "@/features/studio/system/api";
import { HELPER_ORIGIN } from "./context";
import { useAgents } from "./store";

export { BIG_CHANGE, SITE_OPS, checkApply, partsTouched, planApply, type BoardLike, type SiteStep, type SiteRequest, type SiteReply } from "./siteSteps";
import { BIG_CHANGE, checkApply, planApply, type BoardLike, type SiteRequest, type SiteReply, type SiteStep } from "./siteSteps";

/* ---- the board ---- */

/* A part as the agent reads it: what it can see and change, none of the board's bookkeeping. */
const READ_FIELDS = ["id", "pageId", "featureId", "label", "content", "data", "x", "y", "w", "h", "groupId", "colour", "font", "shape", "outline", "link", "locked", "sys", "options", "art", "widths"] as const;


const tokenIds = (): Set<string> => {
  const out = new Set<string>();
  const walk = (v: unknown) => {
    if (Array.isArray(v)) for (const t of v) { if (t && typeof t === "object" && typeof (t as { id?: unknown }).id === "string") out.add((t as { id: string }).id); }
    else if (v && typeof v === "object") for (const x of Object.values(v)) walk(x);
  };
  walk(siteSystem()?.tokens);
  return out;
};

function boardNow(): BoardLike {
  const s = useStudio.getState();
  return { site: useBuilds.getState().activeId, nodeIds: new Set(s.nodes.map((n) => n.id)), pageIds: new Set(s.pages.map((p) => p.id)), tokenIds: tokenIds() };
}

/** The parts a step reaches on the board as it is. */
function reachOf(step: SiteStep): string[] {
  const s = useStudio.getState();
  switch (step.op) {
    case "updateNode": return [step.id];
    case "removeNodes": return step.ids;
    case "updatePage": return s.nodes.filter((n) => n.pageId === step.id).map((n) => n.id);
    case "setLook": return s.nodes.map((n) => n.id);
    case "setToken": return s.nodes.filter((n) => Object.values(n.sys?.f ?? {}).includes(step.id)).map((n) => n.id);
  }
}

function read(): unknown {
  const s = useStudio.getState();
  const pick = (node: StudioNode) => { const n = node as unknown as Record<string, unknown>; return Object.fromEntries(READ_FIELDS.filter((k) => n[k] !== undefined && n[k] !== null).map((k) => [k, n[k]])); };
  return {
    site: useBuilds.getState().activeId,
    name: s.brief.name,
    frameWidth: s.frameWidth,
    activePageId: s.activePageId,
    pages: s.pages.map((p) => ({ id: p.id, name: p.name, path: p.path })),
    parts: s.nodes.map(pick),
    look: s.look,
    system: siteSystem(),
  };
}

/** A shot is a reference the helper takes, not pixels: the Builder has no screenshot library (agents-entry.md). */
function shot(page?: string, part?: string): unknown {
  const s = useStudio.getState();
  const pg = s.pages.find((p) => p.id === (page ?? s.activePageId));
  if (!pg) return { ok: false, says: `page ${JSON.stringify(page)} is not on the open site` };
  const node = part ? s.nodes.find((n) => n.id === part) : null;
  if (part && !node) return { ok: false, says: `part ${JSON.stringify(part)} is not on the open site` };
  const el = typeof document !== "undefined" ? document.querySelector(part ? `[data-node-id="${part}"]` : "[data-frame]") : null;
  const r = el?.getBoundingClientRect();
  return { ok: true, result: { ref: `board:${pg.id}@${s.frameWidth}${node ? `#${node.id}` : ""}`, width: s.frameWidth, box: node ? { x: node.x, y: node.y, w: node.w, h: node.h } : null, onScreen: r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null } };
}

/** Every request the bridge took, for the tests and a look in the console. */
export interface Applied { id: string; name: string; touched: number; duplicate: string | null; compare: string | null; at: number }
const applied: Applied[] = [];
const refused: { id: string; says: string }[] = [];

/**
 * One request → one undo step. Every action is the store's own; the fold
 * (`oneStepSince`) makes the request a single Ctrl+Z. The Duplicate for a
 * big change is made before anything moves, so it is the before.
 */
export async function apply(r: Extract<SiteRequest, { op: "apply" }>): Promise<SiteReply> {
  const reply = (body: { ok: true; result: unknown } | { ok: false; says: string }): SiteReply => ({ source: "polio-builder", kind: "site", v: 1, id: r.id, ...body });
  const why = checkApply(r, boardNow());
  if (why.length) { refused.push({ id: r.id, says: why.join("; ") }); return reply({ ok: false, says: why.join("; ") }); }
  const st = useStudio.getState();
  const { touched, big } = planApply(r.steps, reachOf);
  let duplicate: string | null = null;
  let compare: string | null = null;
  const site = useBuilds.getState().activeId!;
  if (big) {
    const before = new Set(useBuilds.getState().projects.map((p) => p.id));
    await useBuilds.getState().duplicate(site);
    duplicate = useBuilds.getState().projects.find((p) => !before.has(p.id))?.id ?? null;
    if (duplicate) {
      compare = compareHref(duplicate, site);
      useAgents.setState({ compare: { href: compare, name: r.name } });
    }
  }
  const mark = st.historyMark();
  const did: string[] = [];
  for (const s of r.steps) {
    switch (s.op) {
      case "updateNode": st.updateNode(s.id, s.patch as Partial<StudioNode>); did.push(`${s.id}: ${Object.keys(s.patch).join(", ")}`); break;
      case "updatePage": st.updatePage(s.id, s.patch); did.push(`page ${s.id}: ${Object.keys(s.patch).join(", ")}`); break;
      case "setLook": st.setLook(s.patch); did.push(`look: ${Object.keys(s.patch).join(", ")}`); break;
      case "removeNodes": st.removeNodes(s.ids); did.push(`removed ${s.ids.length} part${s.ids.length === 1 ? "" : "s"}`); break;
      case "setToken": { const t = setToken(s.id, s.value) as { ok?: false; says?: string }; did.push(t.ok === false ? `token ${s.id}: ${t.says}` : `token ${s.id} → ${s.value}`); break; }
    }
  }
  st.oneStepSince(mark);
  /* Named on the timeline, as an update: "Agent: calmer hero". Threads are not in the document, so this is no undo step of its own. */
  const name = `Agent: ${r.name.trim()}`;
  useStudio.getState().landThread({ mode: "agent", ask: name, answer: `${touched} part${touched === 1 ? "" : "s"} changed in one step`, changes: did, state: "done" });
  const entry: Applied = { id: r.id, name, touched, duplicate, compare, at: Date.now() };
  applied.push(entry);
  return reply({ ok: true, result: { name, touched, steps: did, undo: "one step", duplicate, compare } });
}

async function answer(r: SiteRequest): Promise<SiteReply> {
  const base = { source: "polio-builder" as const, kind: "site" as const, v: 1 as const, id: r.id };
  const site = useBuilds.getState().activeId;
  if (r.op !== "apply" && r.site !== undefined && r.site !== site) return { ...base, ok: false, says: `the request is for site ${JSON.stringify(r.site)}, but the open site is ${JSON.stringify(site)}` };
  switch (r.op) {
    case "read": return { ...base, ok: true, result: read() };
    case "shot": { const s = shot(r.page, r.part) as { ok: true; result: unknown } | { ok: false; says: string }; return { ...base, ...s }; }
    case "apply": return apply(r);
    default: return { ...base, ok: false, says: `unknown op` };
  }
}

const isRequest = (d: unknown): d is SiteRequest => !!d && typeof d === "object" && (d as SiteRequest).source === "polio-dock" && (d as SiteRequest).kind === "site" && typeof (d as SiteRequest).id === "string";

/**
 * Hear the paired dock frame, and only it. Returns the stop.
 *
 * Two checks, both needed: the origin is the helper's (set by the browser,
 * not the sender), and the sender is the frame's own window (a second frame
 * or a popup on the same origin is not the dock J opened).
 */
export function listen(frame: HTMLIFrameElement): () => void {
  const on = (e: MessageEvent) => {
    if (e.origin !== HELPER_ORIGIN) return;
    if (!frame.contentWindow || e.source !== frame.contentWindow) return;
    if (!isRequest(e.data)) return;
    const to = e.source as Window;
    void answer(e.data).then((reply) => to.postMessage(reply, HELPER_ORIGIN)).catch((err: unknown) => {
      to.postMessage({ source: "polio-builder", kind: "site", v: 1, id: e.data.id, ok: false, says: String((err as Error)?.message ?? err) } satisfies SiteReply, HELPER_ORIGIN);
    });
  };
  window.addEventListener("message", on);
  return () => window.removeEventListener("message", on);
}

if (typeof window !== "undefined") {
  const w = window as unknown as { __agents?: Record<string, unknown> };
  w.__agents = { ...(w.__agents ?? {}), applied, refused, BIG_CHANGE, board: () => { const s = useStudio.getState(); return { past: s.past.length, future: s.future.length, threads: s.threads.map((t) => ({ ask: t.ask, mode: t.mode })) }; } };
}
