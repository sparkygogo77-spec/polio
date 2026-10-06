/**
 * THE STATE RULES, READ: PANELS, THEIR DECLARED STATES AND THE SITE'S SCENES (J, 2026-10-06).
 *
 * A site that follows the state rules (kit/BUILDER-RULES.md, rules 12 to 20)
 * says in its markup what changes and how, so nothing is guessed from
 * captures:
 *
 *   · a panel's root has `data-panel="id"` (its own hook), `data-states="a b"`
 *     and a starting `data-state`; a panel that can be absent has an `off`;
 *   · a part inside it says where it shows with `data-show="a b"` (none: in
 *     every state); a panel inside another is its own, with its own state;
 *   · the scene file (builder.json "scenes") lists each scene: its page and
 *     every panel present with its state. A panel left out is off (or, with
 *     no off state, as its markup starts);
 *   · the samples file (builder.json "samples") holds sample words by hook:
 *     data is not a state, so they are chips, never states.
 *
 * So a panel has exactly its declared states, and a scene is the page with
 * each panel in one of them. This reads that off the parts as imported (every
 * data- attribute rides on `hooks`, and parts hidden as the page opens are
 * read in place), and turns it into the screens the board already draws
 * (`boardStates.ts#ScreenRead`): a scene is a screen, a panel's state is a
 * screen of that panel. A capture of the same scene, when the site has one,
 * only lends where things sit and what they say, and says where live differs.
 *
 * A site with no data-panel does not follow the rules yet: it keeps the
 * captured reading (`panels.ts`, `scenes.ts`) and `stateRuleNotes` says why.
 *
 * Pure: `tests/state-rules.mjs`.
 */
import type { Panel, PanelNode, PanelState } from "./panels";
import type { ScreenRead } from "./boardStates";

export interface DeclaredScene {
  name: string;
  label: string;
  /** The page file it is a scene of, from the repository's root. */
  page: string;
  /** The preview screen that shows it on the live site, when there is one. */
  screen?: string;
  /** Every panel present, by id, and its state. */
  panels: Record<string, string>;
}
/** Sample words by hook (builder.json "samples"). */
export type Samples = Record<string, string[]>;

/** The scene file's scenes (paths made from the repository's root with `base`, the folder builder.json is in), or null when it is not one. */
export function readScenes(text: string | null | undefined, base = ""): DeclaredScene[] | null {
  if (!text) return null;
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return null; }
  const list = (raw as { scenes?: unknown })?.scenes;
  if (!Array.isArray(list)) return null;
  const out: DeclaredScene[] = [];
  for (const s of list) {
    if (!s || typeof s !== "object") continue;
    const o = s as Record<string, unknown>;
    if (typeof o.name !== "string" || typeof o.page !== "string") continue;
    const panels: Record<string, string> = {};
    if (o.panels && typeof o.panels === "object") for (const [k, v] of Object.entries(o.panels as Record<string, unknown>)) if (typeof v === "string") panels[k] = v;
    const page = o.page.replace(/^\.\//, "");
    out.push({ name: o.name, label: typeof o.label === "string" && o.label.trim() ? o.label : o.name, page: page.startsWith("/") ? page.slice(1) : `${base}${page}`, ...(typeof o.screen === "string" ? { screen: o.screen } : {}), panels });
  }
  return out;
}

/** The samples file's words by hook, or null when it is not one. */
export function readSamples(text: string | null | undefined): Samples | null {
  if (!text) return null;
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return null; }
  const hooks = (raw as { hooks?: unknown })?.hooks;
  if (!hooks || typeof hooks !== "object") return null;
  const out: Samples = {};
  for (const [k, v] of Object.entries(hooks as Record<string, unknown>)) if (Array.isArray(v)) { const l = v.filter((x): x is string => typeof x === "string"); if (l.length) out[k] = l; }
  return out;
}

type RuleNode = Pick<PanelNode, "id" | "pageId" | "hooks" | "from" | "state">;

/** One declared panel: its id (its root's hook), its states in order, the state its markup starts in, and its roots (one id in several places is one panel, rule 19). */
export interface DeclaredPanel {
  id: string;
  states: string[];
  start: string;
  roots: string[];
}

export interface Declared {
  panels: Map<string, DeclaredPanel>;
  /** Each part's blocks round it, nearest first. */
  up: Map<string, RuleNode[]>;
  /** The panel root a part is a part of (the nearest round it), by part. */
  ownerOf: Map<string, string>;
  byId: Map<string, RuleNode>;
}

const attr = (n: RuleNode | undefined, a: string) => n?.hooks?.[a];
const words = (v: string | undefined) => (v ?? "").split(/\s+/).filter(Boolean);
const isTemplate = (n: RuleNode) => !!n.state?.group.startsWith("hidden:template:");
const panelId = (n: RuleNode) => attr(n, "data-panel") ?? null;

/** Does the site follow the state rules: does any part declare a panel? */
export const followsStateRules = (nodes: readonly RuleNode[], pageId?: string): boolean => nodes.some((n) => (!pageId || n.pageId === pageId) && panelId(n) !== null && !isTemplate(n));

/** The panels, and which panel each part belongs to, read off the parts by where each was read. */
export function readDeclared(nodes: readonly RuleNode[]): Declared {
  const bySel = new Map<string, RuleNode>();
  for (const n of nodes) { const s = n.from?.selector; if (s && !s.includes("::line") && !isTemplate(n)) bySel.set(`${n.pageId}|${s}`, n); }
  const up = new Map<string, RuleNode[]>();
  for (const n of nodes) {
    const full = n.from?.selector;
    if (!full || isTemplate(n)) continue;
    const chain: RuleNode[] = [];
    let s = full.includes("::line") ? full.replace(/ ::line\(\d+\)$/, "") : full.slice(0, Math.max(0, full.lastIndexOf(" > ")));
    for (let i = 0; s && i < 80; i++) {
      const p = bySel.get(`${n.pageId}|${s}`);
      if (p && p.id !== n.id) chain.push(p);
      const cut = s.lastIndexOf(" > ");
      s = cut > 0 ? s.slice(0, cut) : "";
    }
    up.set(n.id, chain);
  }
  const panels = new Map<string, DeclaredPanel>();
  const ownerOf = new Map<string, string>();
  for (const n of nodes) {
    if (isTemplate(n)) continue;
    const id = panelId(n);
    if (id !== null) {
      const states = words(attr(n, "data-states"));
      const known = panels.get(id);
      if (known) known.roots.push(n.id);
      else panels.set(id, { id, states, start: attr(n, "data-state") ?? states[0] ?? "", roots: [n.id] });
    }
    const owner = (up.get(n.id) ?? []).find((a) => panelId(a) !== null);
    if (owner) ownerOf.set(n.id, owner.id);
  }
  return { panels, up, ownerOf, byId: new Map(nodes.map((n) => [n.id, n])) };
}

/** A panel's state in a scene: as the scene says, else off where it can be, else as its markup starts. */
export function stateIn(p: DeclaredPanel, scene: Pick<DeclaredScene, "panels"> | null): string {
  const said = scene?.panels[p.id];
  if (said !== undefined) return said;
  if (!scene) return p.start;
  return p.states.includes("off") ? "off" : p.start;
}

/**
 * Is a part drawn with its panels in these states? It, and every block
 * round it, must be: a panel root is drawn unless it is off, and a part
 * with data-show only in a state it lists, of the panel round it.
 */
export function drawnWith(d: Declared, nodeId: string, stateOf: (panel: string) => string): boolean {
  const n = d.byId.get(nodeId);
  if (!n) return false;
  for (const e of [n, ...(d.up.get(nodeId) ?? [])]) {
    const id = panelId(e);
    if (id !== null && stateOf(id) === "off") return false;
    const show = attr(e, "data-show");
    if (show !== undefined) {
      const owner = d.byId.get(d.ownerOf.get(e.id) ?? "");
      const pid = owner ? panelId(owner) : null;
      if (pid !== null && !words(show).includes(stateOf(pid))) return false;
    }
  }
  return true;
}

/** The states a part shows in, of the panel it is a part of (null: not in a panel, or in every state). */
export function statesOfPart(d: Declared, nodeId: string): { panel: string; states: string[] } | null {
  const ownerId = d.ownerOf.get(nodeId);
  const owner = ownerId ? d.byId.get(ownerId) : undefined;
  const pid = owner ? panelId(owner) : null;
  if (!pid) return null;
  const p = d.panels.get(pid)!;
  const states = p.states.filter((s) => s !== "off" && drawnWith(d, nodeId, (q) => (q === pid ? s : stateIn(d.panels.get(q)!, null))));
  return { panel: pid, states };
}

/** The hooks drawn on a page with its panels in these states. */
function showsOf(nodes: readonly RuleNode[], d: Declared, pageId: string, stateOf: (panel: string) => string): string[] {
  const out = new Set<string>();
  for (const n of nodes) {
    const h = attr(n, "data-hook");
    if (n.pageId !== pageId || !h || isTemplate(n)) continue;
    if (drawnWith(d, n.id, stateOf)) out.add(h);
  }
  return [...out];
}

/** The capture of a screen, lending its places, words and pictures (never what is shown). */
const lent = (c: ScreenRead | undefined): Partial<ScreenRead> => (c ? { ...(c.boxes ? { boxes: c.boxes } : {}), ...(c.texts ? { texts: c.texts } : {}), ...(c.sizes ? { sizes: c.sizes } : {}), ...(c.stills ? { stills: c.stills } : {}), ...(c.opened ? { opened: c.opened } : {}) } : {});

/** A declared scene as a screen of the board, plus where live differs from it (hooks the capture of it draws that the scene does not, and the other way). */
export interface SceneScreen extends ScreenRead { declared: true; panels: Record<string, string>; differs?: { extra: string[]; missing: string[] } }

/**
 * The site's scenes as screens the board draws (`boardStates.ts`): each
 * page's parts with every panel in its scene's state. `files` maps page
 * files to the board's pages; `captured` are the live captures, by name.
 */
export function sceneScreens(nodes: readonly RuleNode[], files: readonly { file: string; pageId: string }[], scenes: readonly DeclaredScene[], captured: readonly ScreenRead[] = []): SceneScreen[] {
  const d = readDeclared(nodes);
  const out: SceneScreen[] = [];
  for (const sc of scenes) {
    const pageId = files.find((f) => f.file === sc.page)?.pageId;
    if (!pageId) continue;
    const shows = showsOf(nodes, d, pageId, (id) => { const p = d.panels.get(id); return p ? stateIn(p, sc) : "on"; });
    const cap = captured.find((c) => c.name === (sc.screen ?? sc.name));
    const screen: SceneScreen = { name: sc.name, label: sc.label, page: sc.page, shows, ...lent(cap), declared: true, panels: { ...sc.panels } };
    if (cap) {
      const mine = new Set(shows), live = new Set(cap.shows);
      const extra = cap.shows.filter((h) => !mine.has(h)), missing = shows.filter((h) => !live.has(h));
      if (extra.length || missing.length) screen.differs = { extra, missing };
    }
    out.push(screen);
  }
  return out;
}

/**
 * A page's declared panels as the Panels page lists them (`panels.ts#Panel`):
 * every state but off, each a screen of the page with that panel in that
 * state and the rest as the first scene that has it so; with samples, one
 * screen per sample (data is not a state: the same parts, other words).
 */
export function declaredPagePanels(nodes: readonly RuleNode[], pageId: string, pageFile: string | null, scenes: readonly SceneScreen[] = [], samples: Samples | null = null): Panel[] {
  const d = readDeclared(nodes);
  const out: Panel[] = [];
  const mine = scenes.filter((s) => !pageFile || s.page === pageFile);
  for (const p of d.panels.values()) {
    const root = p.roots.map((r) => d.byId.get(r)!).find((r) => r.pageId === pageId);
    if (!root) continue;
    const inner = nodes.filter((n) => n.pageId === pageId && (d.up.get(n.id) ?? []).some((a) => a.id === root.id));
    const sampled = [...new Set(inner.map((n) => attr(n, "data-hook")).filter((h): h is string => !!h && !!samples?.[h]))];
    const most = Math.max(0, ...sampled.map((h) => samples![h]!.length));
    const states: PanelState[] = p.states.filter((s) => s !== "off").map((s) => {
      const scene = mine.find((x) => x.panels[p.id] === s) ?? null;
      const stateOf = (id: string) => (id === p.id ? s : scene ? stateIn(d.panels.get(id)!, scene) : d.panels.get(id)!.start);
      const shows = showsOf(nodes, d, pageId, stateOf);
      const base: ScreenRead = { name: `${p.id}:${s}`, label: s, page: pageFile ?? "", shows, ...(scene ? lent(scene) : {}) };
      const samplesOf = most ? Array.from({ length: most }, (_, i) => {
        const texts = { ...(base.texts ?? {}) };
        for (const h of sampled) texts[h] = samples![h]![i % samples![h]!.length]!;
        return { key: `${s}:${i}`, label: (texts[sampled[0]!] ?? `sample ${i + 1}`).slice(0, 40), screen: { ...base, texts } };
      }) : [{ key: s, label: s, screen: base }];
      return { key: s, label: s, samples: samplesOf };
    });
    /* One state that a whole-page scene shows (a lone text block) is no panel: it is edited on its page in that scene. One that no scene shows (a pop-up such as the sign panel) stays (J, 2026-10-06). */
    if (states.length < 2 && mine.some((x) => x.panels[p.id] && x.panels[p.id] !== "off")) continue;
    out.push({ id: root.id, hook: p.id, ...(attr(root, "data-label") ? { label: attr(root, "data-label")! } : {}), states });
  }
  return out.sort((a, b) => { const x = d.byId.get(a.id) as PanelNode | undefined, y = d.byId.get(b.id) as PanelNode | undefined; return (x?.y ?? 0) - (y?.y ?? 0) || (x?.x ?? 0) - (y?.x ?? 0); });
}

/**
 * What the state rules find wrong on a page, in plain words: the same
 * checks kit:check makes on markup and scenes (its script checks need the
 * code, so they stay with kit:check). A page with no panel says only that.
 */
export function stateRuleNotes(nodes: readonly RuleNode[], pageId: string, scenes: readonly DeclaredScene[] | null, pageFile: string | null): string[] {
  if (!followsStateRules(nodes, pageId)) return ["No part on this page declares a panel (data-panel, data-states, data-show), so its states are read from captures and may overlap. kit/BUILDER-RULES.md, rules 12 to 20, says how to declare them; then run npm run kit:check."];
  const d = readDeclared(nodes);
  const out: string[] = [];
  for (const n of nodes) {
    if (n.pageId !== pageId || isTemplate(n)) continue;
    const id = panelId(n), hook = attr(n, "data-hook") ?? n.id;
    if (id !== null) {
      if (id !== attr(n, "data-hook")) out.push(`Panel "${id}" is not its root's hook ("${attr(n, "data-hook") ?? ""}").`);
      if (!words(attr(n, "data-states")).length) out.push(`Panel "${id}" lists no states.`);
      const outer = d.ownerOf.get(n.id);
      for (const e of d.up.get(n.id) ?? []) { if (e.id === outer) break; if (attr(e, "data-show") !== undefined) { out.push(`Panel "${id}" sits inside a state of another panel (${attr(e, "data-hook") ?? "a part"} shows only in "${attr(e, "data-show")}").`); break; } }
    }
    const show = attr(n, "data-show");
    if (show !== undefined) {
      const owner = d.byId.get(d.ownerOf.get(n.id) ?? "");
      if (!owner) out.push(`${hook} has data-show but sits in no panel.`);
      else for (const s of words(show)) if (!words(attr(owner, "data-states")).includes(s)) out.push(`${hook} shows in "${s}", which panel "${panelId(owner)}" does not declare.`);
    }
  }
  if (!scenes) out.push("The site has panels but no scene file (builder.json \"scenes\"), so the board cannot step through its scenes.");
  else for (const sc of scenes.filter((x) => !pageFile || x.page === pageFile)) for (const [id, s] of Object.entries(sc.panels)) {
    const p = d.panels.get(id);
    if (!p) out.push(`Scene "${sc.name}" names panel "${id}", which no page declares.`);
    else if (!p.states.includes(s)) out.push(`Scene "${sc.name}" puts panel "${id}" in "${s}", which it does not declare.`);
  }
  return [...new Set(out)];
}

/** The key a panel's own state is switched on by, on the board, over whatever scene is on (right-click, States). */
export const panelKey = (panel: string, state: string) => `panel:${panel}=${state}`;
export const readPanelKey = (k: string): { panel: string; state: string } | null => { const m = /^panel:(.+)=([^=]+)$/.exec(k); return m ? { panel: m[1]!, state: m[2]! } : null; };

/**
 * What a panel switched on the board by itself decides: each part inside
 * it drawn or not as that state has it (a panel inside it keeps the state
 * the scene gives it). By part id, as `boardShows` takes it.
 */
export function panelDecides(nodes: readonly RuleNode[], on: readonly string[], scene: Pick<DeclaredScene, "panels"> | null): Map<string, boolean> {
  const picked = new Map(on.map(readPanelKey).filter((x): x is { panel: string; state: string } => !!x).map((x) => [x.panel, x.state]));
  const out = new Map<string, boolean>();
  if (!picked.size) return out;
  const d = readDeclared(nodes);
  const stateOf = (id: string) => picked.get(id) ?? (d.panels.get(id) ? stateIn(d.panels.get(id)!, scene) : "on");
  for (const [id] of picked) {
    const p = d.panels.get(id);
    if (!p) continue;
    const roots = new Set(p.roots);
    for (const n of nodes) {
      if (!roots.has(n.id) && !(d.up.get(n.id) ?? []).some((a) => roots.has(a.id))) continue;
      out.set(n.id, drawnWith(d, n.id, stateOf));
    }
  }
  return out;
}

/**
 * WHAT THE BUILDER LABELS SAY OF A PART (BUILDER-RULES.md rules 21 to 24):
 * its plain name (`data-label`), what its text is (`data-kind`: money,
 * number, percent, time, date, address, hash, text), the template its rows
 * come from when it is a list (`data-list`), and the style group it is edited
 * with (`data-group`).
 */
export function labelsOf(n: Pick<RuleNode, "hooks"> | undefined): { label?: string; kind?: string; list?: string; group?: string } {
  const out: { label?: string; kind?: string; list?: string; group?: string } = {};
  for (const [k, a] of [["label", "data-label"], ["kind", "data-kind"], ["list", "data-list"], ["group", "data-group"]] as const) { const v = attr(n as RuleNode, a); if (v) out[k] = v; }
  return out;
}
