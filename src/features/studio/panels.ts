/**
 * THE PAGE'S DATA PANELS, EACH WITH ITS OWN STATES (J, 2026-10-06).
 *
 * The Panels page (`PanelsPage.tsx`) lists every panel of a page that shows
 * data, and down a side list each panel's states. Read from the page's parts
 * and its screens (`boardStates.ts#ScreenRead`), the same for any site:
 *
 *   · a panel is a hooked block holding at least two hooked parts that
 *     changes between the site's screens: what it draws inside comes, goes or
 *     says other words, or the block itself comes and goes. The page's own
 *     frame (body, main, a block as wide as the page and half as tall) is not
 *     one. Panels inside panels are their own; a block whose changes all
 *     happen in the panels inside it is a wrapper, not listed;
 *   · a state of a panel is one set of parts drawn inside it. Screens drawing
 *     the same parts inside it with other words are samples of that state
 *     (won, lost, draw), never states of their own;
 *   · a state draws only what is visible in it: a part is drawn only when it
 *     and every block round it are drawn there, and what sits in a shut
 *     <details> stays shut (the balance panel's help text and deposit
 *     confirmation were drawn over its contents).
 *
 * Pure: `tests/panels-page.mjs`.
 */
import { stateFrames } from "./stateFrames";
import { groupHook, inDetails, screenKey, stepLook, linedParts, type PlaceBox, type ScreenRead, type StepLook } from "./boardStates";

export interface PanelNode {
  id: string;
  pageId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  hooks?: Record<string, string> | null;
  state?: { group: string; option: number } | null;
  from?: { selector?: string } | null;
  label?: string;
  content?: unknown;
}

/** One way a panel looks: its parts drawn, and the screens that draw it so (each a sample of its data). */
export interface PanelState {
  key: string;
  label: string;
  /** Null: as the page opens. */
  samples: { key: string; label: string; screen: ScreenRead | null }[];
}
export interface Panel {
  id: string;
  hook: string;
  /** Its plain name, where the site gives one (`data-label`, BUILDER-RULES.md rule 21). */
  label?: string;
  states: PanelState[];
}

const selOf = (n: PanelNode) => n.from?.selector?.replace(/ ::line\(\d+\)$/, "") ?? null;
const hookOf = (n: PanelNode) => n.hooks?.["data-hook"] ?? null;
const tagOf = (sel: string) => (sel.split(" > ").pop() ?? "").replace(/[:.[].*$/, "");
/** A screen's label without its "Kind:" lead. */
const said = (s: ScreenRead) => s.step || (s.label || s.name).replace(/^[^:]{1,40}:\s*/, "").trim();

/** Each part's blocks round it, nearest first, by the element path it came from. */
function ancestry(nodes: readonly PanelNode[]): Map<string, PanelNode[]> {
  const bySel = new Map<string, PanelNode>();
  for (const n of nodes) { const s = n.from?.selector; if (s && !s.includes("::line")) bySel.set(`${n.pageId}|${s}`, n); }
  const out = new Map<string, PanelNode[]>();
  for (const n of nodes) {
    const full = n.from?.selector;
    if (!full) continue;
    const up: PanelNode[] = [];
    /* A line of words is held by the element it is a line of. */
    let s = full.includes("::line") ? selOf(n)! : full.slice(0, Math.max(0, full.lastIndexOf(" > ")));
    for (let i = 0; s && i < 60; i++) {
      const p = bySel.get(`${n.pageId}|${s}`);
      if (p && p.id !== n.id) up.push(p);
      const cut = s.lastIndexOf(" > ");
      s = cut > 0 ? s.slice(0, cut) : "";
    }
    out.set(n.id, up);
  }
  return out;
}

/** The parts inside a part, by element path (its lines included), else by box. */
function inside(nodes: readonly PanelNode[], p: PanelNode, up: ReadonlyMap<string, PanelNode[]>): PanelNode[] {
  if (selOf(p)) return nodes.filter((n) => n.pageId === p.pageId && n.id !== p.id && (up.get(n.id) ?? []).some((a) => a.id === p.id));
  return nodes.filter((n) => n.pageId === p.pageId && n.id !== p.id && n.w * n.h < p.w * p.h && n.x >= p.x - 2 && n.y >= p.y - 2 && n.x + n.w <= p.x + p.w + 2 && n.y + n.h <= p.y + p.h + 2);
}

/**
 * Is a part drawn in this screen (null: as the page opens)? It, and every
 * block round it, must be: its hook on the screen (a part with no hook goes
 * with its group, else with the blocks round it), and no shut <details>
 * round it unless the screen opened it.
 */
export function drawnIn(n: PanelNode, screen: ScreenRead | null, up: readonly PanelNode[], shutBy: string | undefined, upTo?: string): boolean {
  const one = (x: PanelNode) => {
    const h = hookOf(x);
    if (!screen) return !x.state;
    const shows = screen.shows;
    if (h) return shows.includes(h);
    return !x.state || shows.includes(groupHook(x.state.group));
  };
  /* The panel itself is drawn in the state picked: only what is inside it is weighed. */
  for (const a of [n, ...up]) { if (a.id === upTo) break; if (!one(a)) return false; }
  if (shutBy && !(screen?.opened ?? []).includes(shutBy)) return false;
  return true;
}

/** The page's data panels and each one's states, in the page's order (top to bottom, then left to right). */
export function pagePanels(nodes: readonly PanelNode[], pageId: string, screens: readonly ScreenRead[]): Panel[] {
  const page = nodes.filter((n) => n.pageId === pageId);
  if (!page.length) return [];
  const up = ancestry(page);
  const W = Math.max(...page.map((n) => n.x + n.w)) - Math.min(...page.map((n) => n.x));
  const H = Math.max(...page.map((n) => n.y + n.h)) - Math.min(...page.map((n) => n.y));
  /* The screens of the page as a whole: an overlay's capture (the tour, a menu) draws next to none of it. */
  const most = Math.max(0, ...screens.map((s) => s.shows.length));
  const whole = screens.filter((s) => s.shows.length >= 0.5 * most);
  const hooked = page.filter((n) => hookOf(n) && !n.state?.group.startsWith("hidden:template:"));
  const candidates = hooked.filter((n) => {
    const s = selOf(n);
    if (s && ["body", "html", "main"].includes(tagOf(s))) return false;
    if (n.w >= 0.9 * W && n.h >= 0.5 * H) return false;
    if (n.w < 96 || n.h < 40) return false;
    return inside(page, n, up).filter(hookOf).length >= 3;
  });
  const isCandidate = new Set(candidates.map((n) => n.id));
  /* A block whose script swaps faces inside it (`stateFrames.ts`: loading, idle, result) has states even where no screen was captured. */
  const frames = stateFrames(page as never);
  const faced = (n: PanelNode) => (frames.byFrame.get(n.id)?.steps.length ?? 0) > 1;
  const showingOf = (n: PanelNode) => whole.filter((s) => s.shows.includes(hookOf(n)!)).map((s) => s.name).join(" ");
  /* Deepest first, so a block knows which of its parts belong to a panel inside it. */
  const depth = (n: PanelNode) => (up.get(n.id) ?? []).length;
  candidates.sort((a, b) => depth(b) - depth(a));
  const accepted: PanelNode[] = [];
  const of = new Map<string, PanelNode>();
  for (const p of candidates) {
    const h = hookOf(p)!;
    const all = inside(page, p, up).filter(hookOf);
    const ownHooks = [...new Set(all.filter((n) => !of.has(n.id)).map((n) => hookOf(n)!))];
    const showing = whole.filter((s) => s.shows.includes(h));
    const sig = (s: ScreenRead) => ownHooks.map((x) => (s.shows.includes(x) ? `${x}=${s.texts?.[x] ?? ""}` : "")).join("|");
    const changes = new Set(showing.map(sig)).size > 1;
    /* It comes and goes on its own: not just with the block round it. */
    const holder = (up.get(p.id) ?? []).find((a) => isCandidate.has(a.id) || hookOf(a));
    const comes = showing.length > 0 && showingOf(p) !== (holder ? showingOf(holder) : whole.map((s) => s.name).join(" "));
    if (!changes && !comes && !faced(p)) continue;
    accepted.push(p);
    for (const n of all) if (!of.has(n.id)) of.set(n.id, p);
  }
  /*
   * A block round a panel of nearly its size is the same panel twice: the
   * outer one is kept. A block holding several panels that take turns in its
   * place (a side column's wallet, new wallet and player card) is a column,
   * not a panel: the panels are kept.
   */
  const inOf = (q: PanelNode, p: PanelNode) => (up.get(q.id) ?? []).some((a) => a.id === p.id);
  const twin = (q: PanelNode, p: PanelNode) => p !== q && inOf(q, p) && q.w * q.h >= 0.85 * p.w * p.h;
  const holds = (p: PanelNode) => accepted.filter((q) => q !== p && inOf(q, p) && !accepted.some((m) => m !== q && m !== p && inOf(q, m) && inOf(m, p))).length;
  const kept = accepted.filter((q) => !accepted.some((p) => twin(q, p) && holds(p) === 1) && !(holds(q) > 1 && accepted.some((c) => twin(c, q))));
  kept.sort((a, b) => a.y - b.y || a.x - b.x);
  return kept.map((p) => ({ id: p.id, hook: hookOf(p)!, states: panelStates(page, p, faced(p) ? [...screens, ...faceScreens(page, p, frames, whole)] : screens, up) }));
}

/** A swapping block's faces as screens of their own, after the captured ones (a face a screen already drew is a sample of that state): each draws that face's parts where the page has them. */
function faceScreens(page: readonly PanelNode[], p: PanelNode, frames: ReturnType<typeof stateFrames>, screens: readonly ScreenRead[]): ScreenRead[] {
  /* A face a captured screen draws is that screen's; what it opens with is the page as it opens. */
  const faces = frames.byFrame.get(p.id)?.steps ?? [];
  const steps = faces.filter((s) => s.key !== "open" && !(s.hook && screens.some((x) => x.shows.includes(s.hook!))));
  const byId = new Map(page.map((n) => [n.id, n]));
  /* What sits in the block but in no face (its frame, its title) is drawn with every face. */
  const inFace = new Set(faces.flatMap((s) => s.parts));
  const always = page.filter((n) => frames.inFrame.get(n.id) === p.id && !inFace.has(n.id) && !n.state).map(hookOf).filter((h): h is string => !!h);
  if (!steps.length) return [];
  return steps.map((s) => ({
    name: `face:${s.key}`,
    label: s.label,
    page: "",
    shows: [...new Set([hookOf(p)!, ...always, ...s.parts.map((id) => byId.get(id)).filter((n): n is PanelNode => !!n).flatMap((n) => [hookOf(n), n.state ? groupHook(n.state.group) : null]).filter((h): h is string => !!h)])],
  }));
}

/** A panel's states: as the page opens (when it is drawn then), then each set of parts a screen draws inside it, its screens' words as samples. */
function panelStates(page: readonly PanelNode[], p: PanelNode, screens: readonly ScreenRead[], up: ReadonlyMap<string, PanelNode[]>): PanelState[] {
  const h = hookOf(p)!;
  const inner = inside(page, p, up).filter(hookOf);
  const shut = inDetails(page as never);
  const drawnHooks = (s: ScreenRead | null) => [...new Set(inner.filter((n) => drawnIn(n, s, up.get(n.id) ?? [], shut.get(n.id), p.id)).map((n) => hookOf(n)!))].sort().join(" ");
  const words = (s: ScreenRead) => inner.map((n) => (s.shows.includes(hookOf(n)!) ? s.texts?.[hookOf(n)!] ?? "" : "")).join("|");
  const states: (PanelState & { shape: string; words: string[] })[] = [];
  const opens = !p.state && !(up.get(p.id) ?? []).some((a) => a.state);
  if (opens) states.push({ key: "open", label: "As the page opens", samples: [{ key: "open", label: "as the page opens", screen: null }], shape: drawnHooks(null), words: [] });
  for (const s of screens) {
    if (!s.shows.includes(h)) continue;
    const shape = drawnHooks(s);
    let st = states.find((x) => x.shape === shape);
    if (!st) { st = { key: screenKey(s.name), label: said(s), samples: [], shape, words: [] }; states.push(st); }
    const w = words(s);
    /* The same words twice is the same sample. */
    if (st.words.includes(w)) continue;
    st.words.push(w);
    st.samples.push({ key: screenKey(s.name), label: said(s), screen: s });
  }
  /* A panel the page hides that no screen draws: shown as its script would show it. */
  if (!states.length) states.push({ key: "open", label: "As its script shows it", samples: [{ key: "open", label: "as its script shows it", screen: null }], shape: "", words: [] });
  return states.map(({ shape: _s, words: _w, ...x }) => x);
}

/**
 * What one sample of a panel draws: the panel's box as that screen has it
 * and the parts drawn inside it, placed where the screen draws them from the
 * panel's corner, with that screen's words.
 */
export function panelDrawing(nodes: readonly PanelNode[], panelId: string, screen: ScreenRead | null): { box: { w: number; h: number }; placed: { node: PanelNode; x: number; y: number; w: number; h: number; look: StepLook | null }[]; around: PanelNode[] } {
  const p = nodes.find((n) => n.id === panelId);
  if (!p) return { box: { w: 0, h: 0 }, placed: [], around: [] };
  const page = nodes.filter((n) => n.pageId === p.pageId);
  const up = ancestry(page);
  const shut = inDetails(page as never);
  const lined = linedParts(page as never);
  const inner = inside(page, p, up);
  const shown = inner.filter((n) => {
    /* As the page opens, a hidden panel is drawn as its script would show it: only what is inside it is weighed. */
    return drawnIn(n, screen, up.get(n.id) ?? [], shut.get(n.id), p.id);
  });
  const fb = screen?.boxes?.[hookOf(p)!];
  const k = fb && fb[2] > 8 ? (Math.abs(p.w / fb[2] - 1) < 0.02 ? 1 : p.w / fb[2]) : 1;
  const box = { w: p.w, h: fb ? Math.max(8, Math.round(k * fb[3])) : p.h };
  const target = new Map<string, PlaceBox>();
  if (fb) for (const n of shown) {
    const b = hookOf(n) ? screen!.boxes?.[hookOf(n)!] : undefined;
    if (b) target.set(n.id, { x: Math.round(p.x + k * (b[0] - fb[0])), y: Math.round(p.y + k * (b[1] - fb[1])), w: Math.round(k * b[2]), h: Math.round(k * b[3]) });
  }
  /* A part the screen gives no box goes with the nearest block round it that moved. */
  const placeOf = (n: PanelNode): PlaceBox => {
    const t = target.get(n.id);
    if (t) return t;
    for (const a of up.get(n.id) ?? []) {
      if (a.id === p.id) break;
      const at = target.get(a.id);
      if (at) return { x: n.x + (at.x - a.x), y: n.y + (at.y - a.y), w: n.w, h: n.h };
    }
    return { x: n.x, y: n.y, w: n.w, h: n.h };
  };
  const placed = [p, ...shown].map((n) => {
    const b = n.id === p.id ? { x: p.x, y: p.y, w: box.w, h: box.h } : placeOf(n);
    const look = screen && n.id !== p.id ? stepLook(n as never, screen, lined) : null;
    return { node: { ...n, ...(look ?? {}), state: null, x: b.x, y: b.y, w: b.w, h: b.h } as PanelNode, x: b.x, y: b.y, w: b.w, h: b.h, look };
  });
  /* The parts the panel sits in (the page's dotted ground, the card round it), so it is seen on what it really sits on. */
  return { box, placed, around: up.get(p.id) ?? [] };
}
