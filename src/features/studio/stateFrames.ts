/**
 * A PART'S STATES, LOCKED TO THE FRAME AROUND THEM.
 *
 * PonsStars' TV message box (`chart-tv-box`) is one part with three faces:
 * connecting (the loading bar), then "Find a match" between matches, then
 * the result. On the page each face is a block inside the box, and the
 * page's script shows one at a time; brought in, the faces after the first
 * come as hidden groups (`hidden:chart-tv-idle`, `boardStates.ts`). J
 * (2026-10-03): the states are tied to the frame around them, so they move
 * and resize with it and cannot spill outside it.
 *
 * A state's frame is read off the page's own structure: the nearest
 * element round the hidden block that is a part of its own (by element
 * path, `from.selector`). Its steps are the faces in the page's order:
 * what the frame shows as the page opens, then each hidden group in it.
 * The board carries a frame's steps when the frame moves or is resized
 * (`frameRiders`), keeps a moved or resized state inside its frame
 * (`clampMove`, `keepInFrame`), and the States timeline lists the steps
 * (`StatesTimeline.tsx`). `spills` is the same rule for a check to read.
 *
 * Pure: `tests/state-frames.mjs` holds it on PonsStars' TV.
 */

export interface Box { x: number; y: number; w: number; h: number }

export interface FrameNode extends Box {
  id: string;
  pageId: string;
  hooks?: Record<string, string> | null;
  state?: { group: string; option: number } | null;
  from?: { selector?: string } | null;
  locked?: boolean;
}

export interface StateStep {
  /** `open` for what the frame shows as the page opens, else the hidden group (`hidden:chart-tv-idle`). */
  key: string;
  /** Its name, plain: the block's hook less what it shares with the frame's ("idle"). */
  label: string;
  /** The hook of the block that is this face, when it has one. */
  hook: string | null;
  /** Every part of this face, in the page's order. */
  parts: string[];
}

export interface StateFrame {
  /** The frame's part id. */
  frame: string;
  hook: string | null;
  pageId: string;
  /** In the page's order: the face it opens with first when it has one. */
  steps: StateStep[];
}

export interface FramesRead {
  frames: StateFrame[];
  byFrame: Map<string, StateFrame>;
  /** A state's part, to its frame. Parts of the open face are not here: they are not states. */
  frameOf: Map<string, string>;
  /** Any part of any face (the open one too), to its step's key, in its innermost frame. */
  stepOf: Map<string, string>;
  /** Any part of any face (the open one too), to its innermost frame. */
  inFrame: Map<string, string>;
}

/** What a step is switched on by on the board: `step:<frame id>=<step key>` (`boardStates.ts`). */
export const stepKey = (frame: string, step: string) => `step:${frame}=${step}`;
export const readStepKey = (k: string): { frame: string; step: string } | null => {
  const m = /^step:([^=]+)=(.+)$/.exec(k);
  return m ? { frame: m[1]!, step: m[2]! } : null;
};

const UP = " > ";
const parentPath = (sel: string): string | null => {
  const at = sel.lastIndexOf(UP);
  return at > 0 ? sel.slice(0, at) : null;
};
const depth = (sel: string) => sel.split(UP).length;
const hookOf = (n: FrameNode | undefined) => n?.hooks?.["data-hook"] ?? n?.hooks?.id ?? null;

/** "chart-tv-idle" in "chart-tv-box" is "idle". */
export function plainName(hook: string, frameHook: string | null): string {
  if (!frameHook) return hook;
  const a = hook.split("-"), b = frameHook.split("-");
  let i = 0;
  while (i < a.length - 1 && i < b.length && a[i] === b[i]) i++;
  return a.slice(i).join("-") || hook;
}

const cache = new WeakMap<readonly FrameNode[], FramesRead>();

/** Every frame that holds states, with its steps. */
export function stateFrames(nodes: readonly FrameNode[]): FramesRead {
  const had = cache.get(nodes);
  if (had) return had;
  const sel = (n: FrameNode) => n.from?.selector?.trim() || null;
  const at = new Map<string, FrameNode>();
  const order = new Map<string, number>();
  nodes.forEach((n, i) => {
    order.set(n.id, i);
    const s = sel(n);
    if (s && !/::(before|after)$/.test(s)) { const k = `${n.pageId}\u0000${s}`; if (!at.has(k)) at.set(k, n); }
  });
  const groups = new Map<string, FrameNode[]>();
  for (const n of nodes) {
    const g = n.state?.group;
    /* A template's copies are the script's to place, not faces of one part. */
    if (!g || !g.startsWith("hidden:") || g.startsWith("hidden:template:")) continue;
    groups.set(g, [...(groups.get(g) ?? []), n]);
  }
  const byFrame = new Map<string, StateFrame>();
  const frameOf = new Map<string, string>();
  const stepOf = new Map<string, string>();
  const hidden: { frame: FrameNode; group: string; root: FrameNode; parts: FrameNode[] }[] = [];
  for (const [group, parts] of groups) {
    const rooted = parts.filter((p) => sel(p) && !/::(before|after)$/.test(sel(p)!));
    if (!rooted.length) continue;
    const want = group.replace(/^hidden:/, "");
    const root = rooted.reduce((a, b) => (depth(sel(b)!) < depth(sel(a)!) || (depth(sel(b)!) === depth(sel(a)!) && hookOf(b) === want && hookOf(a) !== want) ? b : a));
    /* The nearest element round it that is a part, and not a part of this same face. */
    let up = parentPath(sel(root)!), frame: FrameNode | undefined;
    while (up && !frame) {
      const f = at.get(`${root.pageId}\u0000${up}`);
      if (f && f.state?.group !== group) frame = f;
      else up = parentPath(up);
    }
    /* The page's own outermost box (body > main) is the page, not a frame. */
    if (!frame || depth(sel(frame)!) < 3) continue;
    hidden.push({ frame, group, root, parts });
  }
  for (const h of hidden) {
    const fh = hookOf(h.frame);
    let fr = byFrame.get(h.frame.id);
    if (!fr) {
      /* What it shows as the page opens: its own parts inside it that no state hides. */
      const base = `${sel(h.frame)}${UP}`;
      const open = nodes.filter((n) => n.pageId === h.frame.pageId && !n.state && sel(n)?.startsWith(base));
      const steps: StateStep[] = [];
      if (open.length) {
        const tops = open.filter((n) => parentPath(sel(n)!) === sel(h.frame));
        const only = tops.length === 1 ? hookOf(tops[0]) : null;
        steps.push({ key: "open", label: only ? plainName(only, fh) : "as it opens", hook: only, parts: open.map((n) => n.id) });
      }
      fr = { frame: h.frame.id, hook: fh, pageId: h.frame.pageId, steps };
      byFrame.set(h.frame.id, fr);
    }
    const hook = hookOf(h.root);
    fr.steps.push({ key: h.group, label: hook ? plainName(hook, fh) : h.group.replace(/^hidden:/, ""), hook, parts: h.parts.map((p) => p.id) });
  }
  /*
   * A frame is a part whose faces sit inside it: the page says so
   * (`data-state` on it, as PonsStars' TV box has), or every hidden face was
   * read inside its box. A panel the page shows below the rest, growing
   * its column, is not a face of that column.
   */
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const [id, fr] of [...byFrame]) {
    const f = byId.get(id)!;
    if (f.hooks?.["data-state"] !== undefined) continue;
    const fits = fr.steps.every((s) => s.key === "open" || inside(byId.get(rootOf(s, byId) ?? "") ?? null, f));
    if (!fits) byFrame.delete(id);
  }
  /* A hidden block inside a face that is not a frame of its own (the idle face's button) goes with that face. */
  const placed = new Map<string, StateStep>();
  for (const fr of byFrame.values()) for (const st of fr.steps) for (const id of st.parts) placed.set(id, st);
  const loose = nodes.filter((n) => n.state?.group?.startsWith("hidden:") && !placed.has(n.id) && sel(n)).sort((a, b) => depth(sel(a)!) - depth(sel(b)!));
  for (const n of loose) {
    const own = sel(n)!, pseudo = /::(before|after)$/.exec(own);
    let up = pseudo ? own.slice(0, pseudo.index) : parentPath(own), st: StateStep | undefined;
    while (up && !st) { const a = at.get(`${n.pageId}\u0000${up}`); st = a ? placed.get(a.id) : undefined; if (!st) up = parentPath(up); }
    if (st) { st.parts.push(n.id); placed.set(n.id, st); }
  }
  const inFrame = new Map<string, string>();
  /* Deepest frame first: a part is in the innermost frame round it (the TV box's loading face, not the screen's opening). */
  for (const fr of [...byFrame.values()].sort((a, b) => depth(sel(byId.get(b.frame)!)!) - depth(sel(byId.get(a.frame)!)!))) {
    const first = (s: StateStep) => Math.min(...s.parts.map((id) => order.get(id) ?? Infinity));
    fr.steps.sort((a, b) => first(a) - first(b));
    for (const s of fr.steps) for (const id of s.parts) {
      if (inFrame.has(id)) continue;
      inFrame.set(id, fr.frame);
      stepOf.set(id, s.key);
      if (s.key !== "open") frameOf.set(id, fr.frame);
    }
  }
  const frames = [...byFrame.values()].sort((a, b) => (order.get(a.frame) ?? 0) - (order.get(b.frame) ?? 0));
  const read = { frames, byFrame, frameOf, stepOf, inFrame };
  cache.set(nodes, read);
  return read;
}

/** A face's own block: the part with its hook, else its first part. */
function rootOf(s: StateStep, byId: Map<string, FrameNode>): string | null {
  return s.parts.find((id) => s.hook && hookOf(byId.get(id)) === s.hook) ?? s.parts[0] ?? null;
}
/** Is the box inside the frame, give or take a pixel or two? */
export const inside = (n: Box | null, f: Box, slack = 2) => !!n && n.x >= f.x - slack && n.y >= f.y - slack && n.x + n.w <= f.x + f.w + slack && n.y + n.h <= f.y + f.h + slack;

/**
 * THE FACES IN THEIR PLACE. The page shows one face of a `data-state` frame
 * at a time, each where the first one is; read in place one by one with the
 * first still showing, a later face came in under it and out of the frame
 * (the TV box's "Find a match" 76px low, its result's scores under the
 * box's edge). Each face is set back to where the face it opens with
 * starts. Returns the new places, by part id.
 */
export function seatStates(nodes: readonly FrameNode[]): Record<string, { x: number; y: number }> {
  const r = stateFrames(nodes);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out: Record<string, { x: number; y: number }> = {};
  for (const fr of r.frames) {
    const f = byId.get(fr.frame)!;
    if (f.hooks?.["data-state"] === undefined) continue;
    const open = fr.steps.find((s) => s.key === "open");
    const first = open ? byId.get(rootOf(open, byId) ?? "") : null;
    const top = first ? first.y : f.y;
    for (const s of fr.steps) {
      if (s.key === "open") continue;
      const root = byId.get(rootOf(s, byId) ?? "");
      if (!root) continue;
      const dy = top - root.y;
      if (!dy) continue;
      for (const id of s.parts) { const n = byId.get(id)!; out[id] = { x: n.x, y: Math.max(0, n.y + dy) }; }
    }
  }
  return out;
}

/** The frame a part's states belong to: the frame itself, or the frame round a state's part. */
export function frameFor(nodes: readonly FrameNode[], id: string): StateFrame | null {
  const r = stateFrames(nodes);
  return r.byFrame.get(id) ?? r.byFrame.get(r.inFrame.get(id) ?? "") ?? null;
}

/** What a frame takes with it when it is moved or resized: every part of every one of its faces. */
export function frameRiders(nodes: readonly FrameNode[], ids: readonly string[]): string[] {
  const r = stateFrames(nodes);
  if (!r.frames.length) return [];
  const hand = new Set(ids);
  const locked = new Set(nodes.filter((n) => n.locked).map((n) => n.id));
  const out: string[] = [];
  const take = (id: string) => {
    const fr = r.byFrame.get(id);
    if (!fr) return;
    for (const s of fr.steps) for (const p of s.parts) if (!hand.has(p) && !locked.has(p)) { hand.add(p); out.push(p); take(p); }
  };
  for (const id of ids) take(id);
  return out;
}

/** A box kept inside its frame: no bigger than it, and moved in until no edge is out. */
export function keepInFrame(box: Box, frame: Box): Box {
  const w = Math.min(box.w, frame.w), h = Math.min(box.h, frame.h);
  return { x: Math.min(Math.max(box.x, frame.x), frame.x + frame.w - w), y: Math.min(Math.max(box.y, frame.y), frame.y + frame.h - h), w, h };
}

/**
 * How far a hand-moved set may go: a state's part in it whose frame is not
 * moving with it stops at its frame's edge, and the whole set stops with it.
 */
export function clampMove(nodes: readonly FrameNode[], ids: readonly string[], origin: Record<string, Box>, dx: number, dy: number): { dx: number; dy: number } {
  const r = stateFrames(nodes);
  if (!r.frameOf.size) return { dx, dy };
  const moving = new Set(ids);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  let lox = -Infinity, hix = Infinity, loy = -Infinity, hiy = Infinity;
  for (const id of ids) {
    const f = r.frameOf.get(id);
    if (!f || moving.has(f)) continue;
    const fr = byId.get(f), o = origin[id];
    if (!fr || !o) continue;
    lox = Math.max(lox, Math.min(0, fr.x - o.x));
    hix = Math.min(hix, Math.max(0, fr.x + fr.w - (o.x + o.w)));
    loy = Math.max(loy, Math.min(0, fr.y - o.y));
    hiy = Math.min(hiy, Math.max(0, fr.y + fr.h - (o.y + o.h)));
  }
  return { dx: Math.min(Math.max(dx, lox), Math.max(lox, hix)), dy: Math.min(Math.max(dy, loy), Math.max(loy, hiy)) };
}

/**
 * A face that fills its frame cannot move inside it, so a drag on it moves the frame.
 *
 * J (2026-10-08): "some items especially on PST are totally undraggable". A
 * face shown on the board (the TV's idle face, a panel's state) is as big as
 * the box round it, so `clampMove` left it no room and the drag went nowhere.
 * Now a picked face with no room either way is swapped for its frame, which
 * takes every face with it (`frameRiders`); a face with room still moves in it.
 */
export function liftToFrame(nodes: readonly FrameNode[], ids: readonly string[], slack = 2): string[] {
  const r = stateFrames(nodes);
  if (!r.frameOf.size) return [...ids];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out: string[] = [];
  for (const id of ids) {
    const f = r.frameOf.get(id), n = byId.get(id), fr = f ? byId.get(f) : undefined;
    const stuck = !!n && !!fr && !ids.includes(fr.id) && !fr.locked && n.w >= fr.w - slack && n.h >= fr.h - slack;
    const to = stuck ? fr!.id : id;
    if (!out.includes(to)) out.push(to);
  }
  return out;
}

/** States whose box has left its frame: what a check fails on. */
export function spills(nodes: readonly FrameNode[], slack = 1): { part: string; frame: string }[] {
  const r = stateFrames(nodes);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out: { part: string; frame: string }[] = [];
  for (const [id, f] of r.frameOf) {
    const n = byId.get(id), fr = byId.get(f);
    if (!n || !fr) continue;
    if (n.x < fr.x - slack || n.y < fr.y - slack || n.x + n.w > fr.x + fr.w + slack || n.y + n.h > fr.y + fr.h + slack) out.push({ part: id, frame: f });
  }
  return out;
}

/** What a face holds, said plainly: its words, the values it shows, and the settings its page gave it. */
export function stepData(nodes: readonly (FrameNode & { content?: unknown; options?: Record<string, unknown> | null })[], step: StateStep): { words: string[]; values: string[]; settings: string[] } {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const words: string[] = [], values: string[] = [], settings: string[] = [];
  const add = (list: string[], v: string) => { if (v && !list.includes(v)) list.push(v); };
  for (const id of step.parts) {
    const n = byId.get(id);
    if (!n) continue;
    const c = n.content;
    const said = (typeof c === "string" ? c : Array.isArray(c) ? c.map((s) => (s && typeof s === "object" ? (s as { text?: string }).text ?? "" : "")).join("") : "").replace(/\s+/g, " ").trim();
    if (said && said !== "-") add(words, said.length > 60 ? `${said.slice(0, 59)}…` : said);
    const o = n.options ?? {};
    if (typeof o.value === "string" && o.value) add(values, `${o.label ?? "value"}: ${o.value}`);
    if (o.checked === "yes") add(values, `${o.label ?? "box"}: ticked`);
    const name = hookOf(n) ?? "";
    for (const [k, v] of Object.entries(n.hooks ?? {})) {
      if (k === "aria-valuenow") add(values, `${name}: ${v}${n.hooks?.["aria-valuemax"] ? ` of ${n.hooks["aria-valuemax"]}` : ""}`);
      else if (k.startsWith("data-") && k !== "data-hook" && v !== "") add(settings, `${name} ${k.slice(5)}=${v}`);
    }
  }
  if (step.key !== "open") settings.unshift(`hidden until its code shows it (${step.hook ?? step.key.replace(/^hidden:/, "")})`);
  return { words, values, settings };
}
