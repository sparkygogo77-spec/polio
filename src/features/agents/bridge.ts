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
 * The reads are `read`, `outline` (id, kind, box, first words), `picked` and
 * `at` (the parts under a point, topmost first). `select` picks parts on the
 * board and is no change to the site, so it takes no undo step. Everything that
 * changes the site is a step of `apply`, `siteSteps.ts#SiteStep`.
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
 *   - a request sent with `base` must be written against the board as it is
 *     now (`read` and `apply` answer the `version`), and a request that would
 *     change nothing is refused: neither leaves an undo step;
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
import { setTokenValue } from "@/features/studio/system/link";
import { getFeature } from "@/features/studio/shelf";
import { canTrade, tradePlaces } from "@/features/studio/board/tradePlaces";
import { holderPath, holdersFirst } from "@/features/studio/paintOrder";
import { HELPER_ORIGIN } from "./context";
import { SHOT_MAX_SIDE, SHOT_SIDE, shootBoard, type Crop } from "./shot";
import { useAgents } from "./store";

export { BIG_CHANGE, SITE_OPS, checkApply, partsTouched, planApply, versionOf, type BoardLike, type SiteStep, type SiteRequest, type SiteReply } from "./siteSteps";
import { BIG_CHANGE, checkApply, drawnPx, firstWords, fontAfter, planApply, slimPart, underPoint, versionOf, type BoardLike, type Drawn, type SiteRequest, type SiteReply, type SiteStep } from "./siteSteps";

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

/* A part as the agent reads it (READ_FIELDS). */
const pick = (node: StudioNode) => { const n = node as unknown as Record<string, unknown>; return Object.fromEntries(READ_FIELDS.filter((k) => n[k] !== undefined && n[k] !== null).map((k) => [k, n[k]])); };

/** The version of the copy an agent reads: the open page and the zoom are where J is looking, not what the site holds. */
function boardVersion(): string {
  const s = useStudio.getState();
  return versionOf({ site: useBuilds.getState().activeId, parts: s.nodes.map(pick), pages: s.pages, look: s.look, system: siteSystem() });
}

/** The site's base size, as the panel's Size field reads it. */
const baseSize = () => Number(useStudio.getState().format["type.baseSize"]) || 16;

/**
 * A page's parts as the board paints them, bottom to top: the document's
 * order, but a holder beneath what it holds wherever the document lists it
 * (`paintOrder.ts`). A reorder is read and checked against this order, not
 * the list's: "front" means drawn over everything, and a holder can't be.
 */
const painted = (nodes: readonly StudioNode[], pageId: string) => holdersFirst(nodes).filter((n) => n.pageId === pageId);
const pathOf = (n: StudioNode) => (n.from?.selector ?? "").trim();
/** Whether `h` holds `n` on the page: `n`'s path runs up through `h`'s. */
function holdsPart(h: StudioNode, n: StudioNode): boolean {
  const hp = pathOf(h);
  if (!hp || h.state || h.pageId !== n.pageId) return false;
  for (let q = holderPath(pathOf(n)); q; q = holderPath(q)) if (q === hp) return true;
  return false;
}
/** The list after `stackNode(id, other, above)`, without doing it. */
function stacked(nodes: readonly StudioNode[], id: string, other: string, above: boolean): StudioNode[] {
  const moving = nodes.find((n) => n.id === id)!;
  const out = nodes.filter((n) => n.id !== id), at = out.findIndex((n) => n.id === other);
  out.splice(above ? at + 1 : at, 0, moving);
  return out;
}

/** The part a reorder stands the moving one against, and on which side; null when it is already there. A stack is one page's, in its painted order. */
function stackedBy(id: string, to: "front" | "back" | "forward" | "backward"): { other: string; above: boolean } | null {
  const nodes = useStudio.getState().nodes;
  const node = nodes.find((n) => n.id === id);
  if (!node) return null;
  const peers = painted(nodes, node.pageId), at = peers.findIndex((n) => n.id === id);
  const other = to === "front" ? peers.at(-1) : to === "back" ? peers[0] : to === "forward" ? peers[at + 1] : peers[at - 1];
  if (!other || other.id === id) return null;
  return { other: other.id, above: to === "front" || to === "forward" };
}

/** Why a reorder can't be drawn as asked: a holder paints beneath what it holds, whatever the order says. Null when it can, or when it is not this kind of step. */
function reorderWhy(step: SiteStep): string | null {
  if (step.op !== "reorder" || step.to === "earlier" || step.to === "later") return null;
  const nodes = useStudio.getState().nodes, node = nodes.find((n) => n.id === step.id);
  if (!node) return null;
  const by = step.to ? stackedBy(step.id, step.to) : { other: (step.above ?? step.below) as string, above: step.above !== undefined };
  if (!by || !nodes.some((n) => n.id === by.other)) return null;
  const after = painted(stacked(nodes, step.id, by.other, by.above), node.pageId);
  const i = after.findIndex((n) => n.id === step.id), j = after.findIndex((n) => n.id === by.other);
  /* Drawn on the side asked for: a holder moved under a part may be pulled further down, before what it holds, and is still under it. */
  if (by.above ? i > j : i < j) return null;
  const between = by.above ? after.slice(i + 1, j + 1) : after.slice(j, i);
  const names = (ps: StudioNode[]) => ps.slice(0, 3).map((p) => JSON.stringify(p.id)).join(", ") + (ps.length > 3 ? ` and ${ps.length - 3} more` : "");
  const held = between.filter((n) => holdsPart(node, n));
  if (held.length) return `part ${JSON.stringify(step.id)} holds ${names(held)}, and a holder paints beneath what it holds: it can't come over them. Reorder them, or a part it doesn't hold`;
  const holders = between.filter((n) => holdsPart(n, node));
  if (holders.length) return `part ${JSON.stringify(step.id)} is held by ${names(holders)}, which paints beneath it: it can't go under its holder`;
  return `part ${JSON.stringify(step.id)} can't be drawn ${by.above ? "over" : "under"} ${JSON.stringify(by.other)}: a holder paints beneath what it holds`;
}

const holds = (now: unknown, patch: Record<string, unknown>) => { const o = (now ?? {}) as Record<string, unknown>; return Object.keys(patch).every((k) => JSON.stringify(o[k]) === JSON.stringify(patch[k])); };

function boardNow(): BoardLike {
  const s = useStudio.getState();
  const system = siteSystem();
  return {
    site: useBuilds.getState().activeId, nodeIds: new Set(s.nodes.map((n) => n.id)), pageIds: new Set(s.pages.map((p) => p.id)), tokenIds: tokenIds(),
    version: boardVersion(),
    tokenTakes: (id, value) => !!system && setTokenValue(system, id, value) !== null,
    groupIds: new Set(s.groups.map((g) => g.id)),
    hasKind: (featureId) => !!getFeature(featureId),
    pageOf: (id) => s.nodes.find((n) => n.id === id)?.pageId ?? null,
    fontOf: (id) => { const n = s.nodes.find((x) => x.id === id); return n ? { words: !!firstWords(n.content), font: (n.font as Record<string, unknown> | null) ?? null } : null; },
    cannot: (step) => {
      if (step.op === "reorder" && (step.to === "earlier" || step.to === "later") && s.nodes.some((n) => n.id === step.id) && !canTrade(step.id, step.to === "earlier" ? -1 : 1)) return `part ${JSON.stringify(step.id)} has no neighbour to trade places with`;
      const why = reorderWhy(step);
      if (why) return why;
      if (step.op === "setFont" && step.px !== undefined) {
        const n = s.nodes.find((x) => x.id === step.id);
        if (n && Math.abs(drawnPx({ ...n, font: fontAfter(n as never, step, baseSize()) } as never, baseSize()) - step.px) > 0.5) return `part ${JSON.stringify(step.id)} can't be drawn at ${step.px}px`;
      }
      return null;
    },
    unchanged: (step) => {
      switch (step.op) {
        case "updateNode": return holds(s.nodes.find((n) => n.id === step.id), step.patch);
        case "updatePage": return holds(s.pages.find((p) => p.id === step.id), step.patch);
        case "setLook": return holds(s.look, step.patch);
        case "removeNodes": return false;
        case "setToken": return !!system && setTokenValue(system, step.id, step.value) === system;
        case "addNode": case "ungroup": return false;
        case "group": { const g = s.nodes.find((n) => n.id === step.ids[0])?.groupId; return !!g && step.ids.every((id) => s.nodes.find((n) => n.id === id)?.groupId === g); }
        case "reorder": {
          if (step.to === "earlier" || step.to === "later") return false;
          if (step.to) return s.nodes.some((n) => n.id === step.id) && !stackedBy(step.id, step.to);
          const node = s.nodes.find((x) => x.id === step.id);
          const peers = node ? painted(s.nodes, node.pageId) : [], at = peers.findIndex((n) => n.id === step.id);
          return at >= 0 && peers[step.above ? at - 1 : at + 1]?.id === (step.above ?? step.below);
        }
        case "setFont": { const n = s.nodes.find((x) => x.id === step.id); return !!n && JSON.stringify(n.font ?? {}) === JSON.stringify(fontAfter(n as never, step, baseSize())); }
      }
    },
  };
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
    case "addNode": return [step.as ?? `new ${step.featureId} at ${step.x},${step.y}`];
    case "group": return step.ids;
    case "ungroup": return s.nodes.filter((n) => n.groupId === step.group).map((n) => n.id);
    case "reorder": case "setFont": return [step.id];
  }
}

/* A part as the agent reads it in full, with the size its words are drawn at: `font.px` on a captured part is the size its page set. */
const readPart = (n: StudioNode) => ({ ...pick(n), ...(firstWords(n.content) || n.font ? { drawnPx: Math.round(drawnPx(n as never, baseSize()) * 10) / 10 } : {}) });

function read(ids?: unknown): { ok: true; result: unknown } | { ok: false; says: string } {
  const s = useStudio.getState();
  if (ids !== undefined) {
    if (!Array.isArray(ids) || !ids.length) return { ok: false, says: "ids must be a list of part ids; leave it out to read the whole site" };
    const missing = ids.filter((id) => !s.nodes.some((n) => n.id === id));
    if (missing.length) return { ok: false, says: `${missing.map((id) => `part ${JSON.stringify(id)}`).join(", ")} not on the open site` };
  }
  const wanted = ids ? new Set(ids as string[]) : null;
  return { ok: true, result: {
    site: useBuilds.getState().activeId,
    version: boardVersion(),
    name: s.brief.name,
    frameWidth: s.frameWidth,
    activePageId: s.activePageId,
    pages: s.pages.map((p) => ({ id: p.id, name: p.name, path: p.path })),
    groups: s.groups.map((g) => ({ id: g.id, pageId: g.pageId, label: g.label })),
    parts: (wanted ? s.nodes.filter((n) => wanted.has(n.id)) : s.nodes).map(readPart),
    /* Asked for by id, the parts are what was wanted: the look and the System are in the whole read. */
    ...(wanted ? {} : { look: s.look, system: siteSystem() }),
  } };
}

/** The whole site in as little as tells parts apart: id, kind, box and first words, page by page. */
function outline(page?: unknown): { ok: true; result: unknown } | { ok: false; says: string } {
  const s = useStudio.getState();
  if (page !== undefined && !s.pages.some((p) => p.id === page)) return { ok: false, says: `page ${JSON.stringify(page)} is not on the open site` };
  return { ok: true, result: {
    site: useBuilds.getState().activeId,
    version: boardVersion(),
    frameWidth: s.frameWidth,
    activePageId: s.activePageId,
    groups: s.groups.map((g) => ({ id: g.id, label: g.label })),
    pages: s.pages.filter((p) => page === undefined || p.id === page).map((p) => ({ id: p.id, name: p.name, path: p.path, parts: s.nodes.filter((n) => n.pageId === p.id).map(slimPart) })),
  } };
}

/** What J has picked on the board, each part as the outline has it, and its name and drawn size. */
function picked(): unknown {
  const s = useStudio.getState();
  const parts = s.selection.map((id) => s.nodes.find((n) => n.id === id)).filter((n): n is StudioNode => !!n);
  return { ids: parts.map((n) => n.id), background: s.selection.length === 1 && !parts.length, parts: parts.map((n) => ({ ...slimPart(n), name: n.label, pageId: n.pageId, ...(firstWords(n.content) ? { drawnPx: Math.round(drawnPx(n as never, baseSize()) * 10) / 10 } : {}) })) };
}

/** The open page's parts as they are drawn now, in the page's own pixels: the board's zoom is not the frame's drawn scale (INTERFACE-OPTIONS.md, task 4). */
function drawnParts(): (Drawn & { clicks: boolean })[] {
  const s = useStudio.getState();
  const frame = document.querySelector("[data-frame]")?.getBoundingClientRect();
  const scale = frame && frame.width > 0 ? frame.width / s.frameWidth : 1;
  const els = new Map<string, HTMLElement>();
  for (const el of Array.from(document.querySelectorAll<HTMLElement>("[data-node-id]"))) { const id = el.getAttribute("data-node-id")!; if (!els.has(id)) els.set(id, el); }
  const out: (Drawn & { clicks: boolean })[] = [];
  s.nodes.forEach((n, at) => {
    if (n.pageId !== s.activePageId) return;
    const el = els.get(n.id);
    const r = el?.getClientRects().length ? el.getBoundingClientRect() : null;
    /* On the page but not drawn at this width, or in a state that is off. */
    if (el && !r) return;
    const css = el ? getComputedStyle(el) : null;
    const box = r && frame ? { x: (r.left - frame.left) / scale, y: (r.top - frame.top) / scale, w: r.width / scale, h: r.height / scale } : { x: n.x, y: n.y, w: n.w, h: n.h };
    out.push({ id: n.id, ...box, z: Number.parseInt(css?.zIndex ?? "", 10) || 0, at, clicks: css?.pointerEvents !== "none" });
  });
  return out;
}

/**
 * The parts under a point on the open page, topmost first, and whether a click
 * there would reach each. The browser's own hit test gives the order of the
 * parts a click reaches (it knows the stacking; a z-index sort does not, and
 * words that spill out of their box are still their part); the parts a click
 * passes through (`pointer-events: none`: a decoration, a moving picture) are
 * not in it, so they follow, from their drawn boxes, so an agent still learns
 * what covers what J wants.
 */
function at(x: unknown, y: unknown): { ok: true; result: unknown } | { ok: false; says: string } {
  if (typeof x !== "number" || !Number.isFinite(x) || typeof y !== "number" || !Number.isFinite(y)) return { ok: false, says: `x and y must be numbers, in the page's own pixels: ${JSON.stringify(x)}, ${JSON.stringify(y)}` };
  const s = useStudio.getState();
  const frame = document.querySelector("[data-frame]")?.getBoundingClientRect();
  const scale = frame && frame.width > 0 ? frame.width / s.frameWidth : 1;
  const onPage = new Set(s.nodes.filter((n) => n.pageId === s.activePageId).map((n) => n.id));
  const clicked: string[] = [];
  if (frame) for (const el of document.elementsFromPoint(frame.left + x * scale, frame.top + y * scale)) { const id = el.closest("[data-node-id]")?.getAttribute("data-node-id"); if (id && onPage.has(id) && !clicked.includes(id)) clicked.push(id); }
  const through = underPoint(drawnParts(), x, y).filter((p) => !clicked.includes(p.id)) as (Drawn & { clicks: boolean })[];
  const row = (id: string, clicks: boolean) => { const n = s.nodes.find((m) => m.id === id)!; return { ...slimPart(n), name: n.label, clicks }; };
  return { ok: true, result: { page: s.activePageId, x, y, parts: [...clicked.map((id) => row(id, true)), ...through.map((p) => row(p.id, false))] } };
}

/** Pick parts on the board, as a click would. No part of the document changes, so there is no undo step. */
function select(ids: unknown): { ok: true; result: unknown } | { ok: false; says: string } {
  const s = useStudio.getState();
  if (!Array.isArray(ids)) return { ok: false, says: "ids must be a list of part ids; an empty list lets go of what is picked" };
  const nodes = ids.map((id) => s.nodes.find((n) => n.id === id));
  const missing = ids.filter((_, i) => !nodes[i]);
  if (missing.length) return { ok: false, says: `${missing.map((id) => `part ${JSON.stringify(id)}`).join(", ")} not on the open site` };
  const away = nodes.filter((n) => n!.pageId !== s.activePageId).map((n) => n!.id);
  if (away.length) return { ok: false, says: `${away.map((id) => `part ${JSON.stringify(id)}`).join(", ")} on another page; J has ${JSON.stringify(s.activePageId)} open` };
  s.setSelection([...new Set(ids as string[])]);
  return { ok: true, result: picked() };
}

/** Around a part's picture, so its edge and what it sits on are in it. */
const SHOT_MARGIN = 16;

/**
 * A real picture, made in this browser (`shot.ts`): of one part, cropped to
 * its drawn box with a margin, or of what J sees of the board. Only the open
 * page is drawn, so only it can be shot: another page is refused plainly, not
 * answered with a picture of the wrong one. A shot changes nothing and leaves
 * no undo step. The board reference is kept for callers that used it.
 */
async function shot(r: Extract<SiteRequest, { op: "shot" }>): Promise<{ ok: true; result: unknown } | { ok: false; says: string }> {
  const s = useStudio.getState();
  const pg = s.pages.find((p) => p.id === (r.page ?? s.activePageId));
  if (!pg) return { ok: false, says: `page ${JSON.stringify(r.page)} is not on the open site` };
  if (pg.id !== s.activePageId) return { ok: false, says: `page ${JSON.stringify(pg.id)} isn't drawn: J has ${JSON.stringify(s.activePageId)} open, and a picture is of what is drawn` };
  const node = r.part !== undefined ? s.nodes.find((n) => n.id === r.part) : null;
  if (r.part !== undefined && !node) return { ok: false, says: `part ${JSON.stringify(r.part)} is not on the open site` };
  if (node && node.pageId !== pg.id) return { ok: false, says: `part ${JSON.stringify(node.id)} is on page ${JSON.stringify(node.pageId)}, which isn't drawn: J has ${JSON.stringify(s.activePageId)} open` };
  if (r.side !== undefined && !(typeof r.side === "number" && Number.isFinite(r.side) && r.side >= 100 && r.side <= SHOT_MAX_SIDE)) return { ok: false, says: `side ${JSON.stringify(r.side)} is not a length from 100 to ${SHOT_MAX_SIDE} pixels` };
  const frame = document.querySelector("[data-frame]")?.getBoundingClientRect();
  if (!frame || !frame.width) return { ok: false, says: "the board isn't drawn yet" };
  const scale = frame.width / s.frameWidth;
  const toPage = (x: number, y: number) => ({ x: (x - frame.left) / scale, y: (y - frame.top) / scale });
  const pageH = frame.height / scale;
  const clamp = (c: Crop): Crop => { const x = Math.max(0, Math.floor(c.x)), y = Math.max(0, Math.floor(c.y)); return { x, y, w: Math.max(1, Math.min(Math.ceil(c.x + c.w), s.frameWidth) - x), h: Math.max(1, Math.min(Math.ceil(c.y + c.h), pageH) - y) }; };
  const el = node ? document.querySelector(`[data-node-id="${node.id}"]`) : null;
  const rect = el?.getClientRects().length ? el.getBoundingClientRect() : null;
  if (node && !rect) return { ok: false, says: `part ${JSON.stringify(node.id)} isn't drawn at this width, so there is no picture of it` };
  let crop: Crop;
  if (node && rect) { const p = toPage(rect.left, rect.top); crop = clamp({ x: p.x - SHOT_MARGIN, y: p.y - SHOT_MARGIN, w: rect.width / scale + 2 * SHOT_MARGIN, h: rect.height / scale + 2 * SHOT_MARGIN }); }
  else {
    /* What J sees: the window's share of the frame. */
    const a = toPage(Math.max(frame.left, 0), Math.max(frame.top, 0)), b = toPage(Math.min(frame.right, window.innerWidth), Math.min(frame.bottom, window.innerHeight));
    if (b.x <= a.x || b.y <= a.y) return { ok: false, says: "none of the board is on screen" };
    crop = clamp({ x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y });
  }
  const picture = await shootBoard(crop, r.side ?? SHOT_SIDE);
  return { ok: true, result: {
    ref: `board:${pg.id}@${s.frameWidth}${node ? `#${node.id}` : ""}`, width: s.frameWidth,
    box: node ? { x: node.x, y: node.y, w: node.w, h: node.h } : null, onScreen: rect ? { x: rect.x, y: rect.y, w: rect.width, h: rect.height } : { x: frame.x, y: frame.y, w: frame.width, h: frame.height },
    picture: { mime: picture.mime, width: picture.width, height: picture.height, crop: picture.crop, scale: picture.scale, data: picture.data },
    missing: picture.missing,
  } };
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
  const added: { as?: string; id: string; box: { x: number; y: number; w: number; h: number } }[] = [];
  const grouped: { id: string; label: string }[] = [];
  /* What J has picked stays picked: adding and grouping pick as they go. */
  const pickedBefore = st.selection;
  const names = new Map<string, string>();
  const real = (id: string) => names.get(id) ?? id;
  const part = (id: string) => useStudio.getState().nodes.find((n) => n.id === real(id));
  for (const s of r.steps) {
    switch (s.op) {
      case "updateNode": st.updateNode(real(s.id), s.patch as Partial<StudioNode>); did.push(`${s.id}: ${Object.keys(s.patch).join(", ")}`); break;
      case "addNode": {
        const id = st.addNode(s.featureId, s.x, s.y, { ...(s.patch as Partial<StudioNode>), ...(s.page ? { pageId: s.page } : {}) });
        if (s.as) names.set(s.as, id);
        const n = part(id)!;
        added.push({ ...(s.as ? { as: s.as } : {}), id, box: { x: n.x, y: n.y, w: n.w, h: n.h } });
        did.push(`added ${s.featureId}: ${id}`);
        break;
      }
      case "group": {
        const ids = s.ids.map(real);
        const before = new Set(ids.map((id) => part(id)?.groupId).filter(Boolean));
        useStudio.setState({ selection: ids });
        st.groupSelection(s.label);
        const made = useStudio.getState().groups.at(-1)!;
        const pageId = part(ids[0]!)!.pageId;
        /* The group is on its parts' page, whichever is open, and a group they all left is gone. */
        useStudio.setState((now) => ({ groups: now.groups.filter((g) => !before.has(g.id) || now.nodes.some((n) => n.groupId === g.id)).map((g) => (g.id === made.id ? { ...g, pageId } : g)) }));
        grouped.push({ id: made.id, label: made.label });
        did.push(`grouped ${ids.length} parts: ${made.id}`);
        break;
      }
      case "ungroup": st.ungroup(s.group); did.push(`ungrouped ${s.group}`); break;
      case "reorder": {
        const id = real(s.id);
        if (s.to === "earlier" || s.to === "later") { tradePlaces(id, s.to === "earlier" ? -1 : 1); did.push(`${s.id}: ${s.to} on the page`); break; }
        if (s.to) { const by = stackedBy(id, s.to); if (by) st.stackNode(id, by.other, by.above); did.push(`${s.id}: to the ${s.to}`); break; }
        st.stackNode(id, real((s.above ?? s.below)!), !!s.above);
        did.push(`${s.id}: ${s.above ? `above ${s.above}` : `below ${s.below}`}`);
        break;
      }
      case "setFont": {
        const n = part(s.id)!;
        st.updateNode(n.id, { font: fontAfter(n as never, s, baseSize()) as StudioNode["font"] });
        did.push(`${s.id}: font${s.px !== undefined ? ` ${s.px}px` : ""}${s.face !== undefined ? ` ${s.face}` : ""}${s.weight !== undefined ? ` ${s.weight}` : ""}`);
        break;
      }
      case "updatePage": st.updatePage(s.id, s.patch); did.push(`page ${s.id}: ${Object.keys(s.patch).join(", ")}`); break;
      case "setLook": st.setLook(s.patch); did.push(`look: ${Object.keys(s.patch).join(", ")}`); break;
      case "removeNodes": st.removeNodes(s.ids.map(real)); did.push(`removed ${s.ids.length} part${s.ids.length === 1 ? "" : "s"}`); break;
      case "setToken": { const t = setToken(s.id, s.value) as { ok?: false; says?: string }; did.push(t.ok === false ? `token ${s.id}: ${t.says}` : `token ${s.id} → ${s.value}`); break; }
    }
  }
  st.oneStepSince(mark);
  if (added.length || grouped.length) { const alive = new Set(useStudio.getState().nodes.map((n) => n.id)); useStudio.setState({ selection: pickedBefore.filter((id) => alive.has(id)) }); }
  /* Named on the timeline, as an update: "Agent: calmer hero". Threads are not in the document, so this is no undo step of its own. */
  const name = `Agent: ${r.name.trim()}`;
  useStudio.getState().landThread({ mode: "agent", ask: name, answer: `${touched} part${touched === 1 ? "" : "s"} changed in one step`, changes: did, state: "done" });
  const entry: Applied = { id: r.id, name, touched, duplicate, compare, at: Date.now() };
  applied.push(entry);
  return reply({ ok: true, result: { name, touched, steps: did, undo: "one step", duplicate, compare, version: boardVersion(), ...(added.length ? { added } : {}), ...(grouped.length ? { grouped } : {}) } });
}

async function answer(r: SiteRequest): Promise<SiteReply> {
  const base = { source: "polio-builder" as const, kind: "site" as const, v: 1 as const, id: r.id };
  const site = useBuilds.getState().activeId;
  if (r.op !== "apply" && r.site !== undefined && r.site !== site) return { ...base, ok: false, says: `the request is for site ${JSON.stringify(r.site)}, but the open site is ${JSON.stringify(site)}` };
  switch (r.op) {
    case "read": return { ...base, ...read(r.ids) };
    case "outline": return { ...base, ...outline(r.page) };
    case "picked": return { ...base, ok: true, result: picked() };
    case "at": return { ...base, ...at(r.x, r.y) };
    case "select": return { ...base, ...select(r.ids) };
    case "shot": return { ...base, ...(await shot(r)) };
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
