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
  /** The one part this scene is a state of (rule 31): the builder shows it as that panel's state, never as a page state. */
  part?: string;
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
    out.push({ name: o.name, label: typeof o.label === "string" && o.label.trim() ? o.label : o.name, page: page.startsWith("/") ? page.slice(1) : `${base}${page}`, ...(typeof o.screen === "string" ? { screen: o.screen } : {}), panels, ...(typeof o.part === "string" && o.part ? { part: o.part } : {}) });
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

/**
 * A declared scene as a screen of the board, plus where live differs from it
 * (hooks the capture of it draws that the scene does not, and the other way).
 * `part`: the one panel it changes, so it is that panel's state and not a
 * page state; `sameAs`: the page state it does not differ from (rule 31).
 */
export interface SceneScreen extends ScreenRead { declared: true; panels: Record<string, string>; differs?: { extra: string[]; missing: string[] }; part?: string; sameAs?: string }

/** Is this scene one of its page's states (not folded into one part's state, rule 31)? */
export const isPageState = (s: Pick<SceneScreen, "part" | "sameAs">): boolean => !s.part && !s.sameAs;

/** Each panel on a page and the panel round it (null: none). */
function panelParents(d: Declared, pageId: string): Map<string, string | null> {
  const out = new Map<string, string | null>();
  for (const p of d.panels.values()) {
    const root = p.roots.map((r) => d.byId.get(r)!).find((r) => r.pageId === pageId);
    if (!root) continue;
    const owner = d.byId.get(d.ownerOf.get(root.id) ?? "");
    out.set(p.id, owner ? panelId(owner) : null);
  }
  return out;
}
const within = (parents: Map<string, string | null>, id: string, part: string) => { for (let q: string | null | undefined = id, i = 0; q && i < 40; q = parents.get(q), i++) if (q === part) return true; return false; };

/** The parts one scene changes against another: the panels in another state, leaving out a panel inside one that changes too (the TV's duel circles come and go with the TV). */
export function partsChanged(d: Declared, parents: Map<string, string | null>, a: Pick<DeclaredScene, "panels">, b: Pick<DeclaredScene, "panels">): string[] {
  const changed = [...parents.keys()].filter((id) => stateIn(d.panels.get(id)!, a) !== stateIn(d.panels.get(id)!, b));
  const set = new Set(changed);
  return changed.filter((id) => { for (let q = parents.get(id), i = 0; q && i < 40; q = parents.get(q), i++) if (set.has(q)) return false; return true; });
}

/**
 * Rule 31 (J, 2026-10-06): a page state changes more than one part at once.
 * A scene that changes one part, against a page state before it on its page,
 * is that part's state: its capture is that state's look, and it leaves the
 * page states. A scene that changes nothing is the same page state twice. A
 * scene that names its `part` folds into it when everything it changes, against
 * any scene before it, is inside that part (the six Chart TV scenes of
 * PonsStars are the TV's states). Gives each folded scene its part, or the
 * page state it is the same as.
 */
export function foldScenes(nodes: readonly RuleNode[], files: readonly { file: string; pageId: string }[], scenes: readonly DeclaredScene[]): Map<string, { part: string } | { sameAs: string }> {
  const d = readDeclared(nodes);
  const out = new Map<string, { part: string } | { sameAs: string }>();
  const parentsOf = new Map<string, Map<string, string | null>>();
  const seen = new Map<string, DeclaredScene[]>(), kept = new Map<string, DeclaredScene[]>();
  for (const sc of scenes) {
    const pageId = files.find((f) => f.file === sc.page)?.pageId;
    if (!pageId) continue;
    if (!parentsOf.has(pageId)) parentsOf.set(pageId, panelParents(d, pageId));
    const parents = parentsOf.get(pageId)!;
    const before = seen.get(pageId) ?? [], pages = kept.get(pageId) ?? [];
    seen.set(pageId, [...before, sc]);
    if (sc.part && parents.has(sc.part) && before.some((b) => partsChanged(d, parents, sc, b).every((id) => within(parents, id, sc.part!)))) { out.set(sc.name, { part: sc.part }); continue; }
    let best: { by: DeclaredScene; parts: string[] } | null = null;
    for (const k of pages) { const parts = partsChanged(d, parents, sc, k); if (!best || parts.length < best.parts.length) best = { by: k, parts }; }
    if (best && best.parts.length === 0) out.set(sc.name, { sameAs: best.by.name });
    else if (best && best.parts.length === 1 && stateIn(d.panels.get(best.parts[0]!)!, sc) !== "off") out.set(sc.name, { part: best.parts[0]! });
    else kept.set(pageId, [...pages, sc]);
  }
  return out;
}

/**
 * The site's scenes as screens the board draws (`boardStates.ts`): each
 * page's parts with every panel in its scene's state. `files` maps page
 * files to the board's pages; `captured` are the live captures, by name.
 */
export function sceneScreens(nodes: readonly RuleNode[], files: readonly { file: string; pageId: string }[], scenes: readonly DeclaredScene[], captured: readonly ScreenRead[] = []): SceneScreen[] {
  const d = readDeclared(nodes);
  const out: SceneScreen[] = [];
  const folded = foldScenes(nodes, files, scenes);
  for (const sc of scenes) {
    const pageId = files.find((f) => f.file === sc.page)?.pageId;
    if (!pageId) continue;
    let shows = showsOf(nodes, d, pageId, (id) => { const p = d.panels.get(id); return p ? stateIn(p, sc) : "on"; });
    const cap = captured.find((c) => c.name === (sc.screen ?? sc.name));
    /*
     * A part the rules say nothing about (no data-show, not a panel), which
     * the live screen of this scene does not draw though it draws the part
     * round it: the site's own code hides it there, so the board does too
     * (J, 2026-10-06: the TV's static, shown by the site only while the
     * server is offline, sat over the chart in "Match starting").
     */
    if (cap) {
      const live = new Set(cap.shows);
      const quiet = new Set(nodes.filter((n) => n.pageId === pageId && attr(n, "data-show") === undefined && panelId(n) === null).map((n) => attr(n, "data-hook")));
      const holderDrawn = (h: string) => {
        const n = nodes.find((x) => x.pageId === pageId && attr(x, "data-hook") === h);
        const up = n ? (d.up.get(n.id) ?? []).find((a) => attr(a, "data-hook")) : undefined;
        return !!up && live.has(attr(up, "data-hook")!);
      };
      shows = shows.filter((h) => live.has(h) || !quiet.has(h) || !holderDrawn(h));
    }
    const screen: SceneScreen = { name: sc.name, label: sc.label, page: sc.page, shows, ...lent(cap), declared: true, panels: { ...sc.panels }, ...(folded.get(sc.name) ?? {}) };
    if (cap) {
      const mine = new Set(shows), live = new Set(cap.shows);
      const extra = cap.shows.filter((h) => !mine.has(h)), missing = shows.filter((h) => !live.has(h));
      if (extra.length || missing.length) screen.differs = { extra, missing };
    }
    out.push(screen);
  }
  return out;
}

/** Words with their numbers taken out: "Ahead by 1.16 points" and "Ahead by 1.83 points" are one shape, "Behind by 1.83 points" another. */
export const wordShape = (t: string) => t.toLowerCase().replace(/[-+]?[\d.,]*\d[\d.,%]*/g, "#").replace(/\s+/g, " ").trim();
/** A hook's samples that fit what a state shows there (same shape of words); all of them when the state shows nothing to go by, or none fit. */
export function samplesFor(list: readonly string[], shown: string | undefined): string[] {
  if (!shown) return [...list];
  const want = wordShape(shown);
  const fit = list.filter((x) => wordShape(x) === want);
  return fit.length ? fit : [...list];
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
    /* Rule 31: the scenes folded into this panel (or one round it) are its states' own captures, the accurate ones (the TV's scenes for the TV); a page state lends one only where none is (J, 2026-10-06). */
    const parents = panelParents(d, pageId);
    const ownScenes = mine.filter((x) => x.part && within(parents, p.id, x.part));
    const states: PanelState[] = p.states.filter((s) => s !== "off").map((s) => {
      /* Its own scenes each a chip; a part inside a folded one (the duel circles in the TV) takes the first of them. */
      const own = ownScenes.filter((x) => x.panels[p.id] === s && x.part === p.id);
      if (!own.length) { const round = ownScenes.find((x) => x.panels[p.id] === s); if (round) own.push(round); }
      const sources: (SceneScreen | null)[] = own.length ? own : [mine.find((x) => isPageState(x) && x.panels[p.id] === s) ?? mine.find((x) => x.panels[p.id] === s) ?? null];
      const samplesOf = sources.flatMap((scene, at) => {
        const tag = at ? `${scene!.name}:` : "";
        const stateOf = (id: string) => (id === p.id ? s : scene ? stateIn(d.panels.get(id)!, scene) : d.panels.get(id)!.start);
        const shows = showsOf(nodes, d, pageId, stateOf);
        const base: ScreenRead = { name: `${p.id}:${s}${at ? `:${scene!.name}` : ""}`, label: s, page: pageFile ?? "", shows, ...(scene ? lent(scene) : {}) };
        /* Only the samples that fit this state: where its scene says "Ahead by 0.5 points", "Ahead by 1.16" and "Ahead by 1.83" are its chips, "Level" and "Behind by …" are not (J, 2026-10-06). */
        const fits = new Map(sampled.map((h) => [h, samplesFor(samples![h]!, base.texts?.[h])]));
        const lead = sampled.find((h) => new Set(fits.get(h)).size > 1) ?? sampled[0];
        /* Rows: where the lead's every sample fits this state, the hooks with as many samples go row by row with it (the tour's step 4 is its own "Step 4 of 10", title and text), never thinned to the one the scene shows (J, 2026-10-06). */
        const rows = lead ? samples![lead]!.length : 0;
        if (rows > 1 && fits.get(lead!)!.length === rows) for (const h of sampled) if (samples![h]!.length === rows) fits.set(h, [...samples![h]!]);
        const many = Math.max(0, ...[...fits.values()].map((l) => l.length));
        const list = most && many ? Array.from({ length: many }, (_, i) => {
          const texts = { ...(base.texts ?? {}) };
          for (const h of sampled) { const l = fits.get(h)!; texts[h] = l[i % l.length]!; }
          return { key: `${tag}${s}:${i}`, label: (texts[lead!] ?? `sample ${i + 1}`).slice(0, 40), screen: { ...base, texts } };
        }) : [{ key: at ? `${tag}${s}` : s, label: sources.length > 1 && scene ? (scene.label ?? s).replace(/^[^:]*:\s*/, "").slice(0, 40) : s, screen: base }];
        return list;
      });
      return { key: s, label: s, samples: samplesOf };
    });
    /* One state that a whole-page scene shows (a lone text block) is no panel: it is edited on its page in that scene. One that no scene shows (a pop-up such as the sign panel) stays, and so does one with sample chips to step through (the intro tour's steps) (J, 2026-10-06). */
    if (states.length < 2 && (states[0]?.samples.length ?? 0) < 2 && mine.some((x) => x.panels[p.id] && x.panels[p.id] !== "off" && x.part !== p.id && (isPageState(x) || within(parents, p.id, x.part ?? "")))) continue;
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
