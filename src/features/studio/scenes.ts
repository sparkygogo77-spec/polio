/**
 * THE PAGE'S SCENES: ITS REAL MOMENTS, IN THE ORDER A VISITOR MEETS THEM.
 *
 * J (2026-10-06): PonsStars came in with 22 page states for about seven real
 * moments. Several were the same capture twice (connecting and "TV: waking
 * the server", "server offline" and "TV: offline", the lobby and "TV: between
 * matches" and "Player card"), the tour and the phone menu sat among them as
 * if they were moments of the game, and eight of them came after the draw.
 *
 * So a page's screens are read as scenes, each one layout of the page:
 *
 *   · a scene (a state) exists only where the layout changes: a panel comes
 *     or goes, parts move or resize (J, 2026-10-06). Screens drawing the same
 *     hooks at the same boxes are one scene whatever their words say, and so
 *     are two captures of one moment drawing nearly the same parts (`nearlySame`:
 *     a draw adding its rematch offer is still the result); its variants are
 *     samples of its data (won, lost, draw; connecting, offline);
 *   · a scene is named by its moment of the site's flow (connecting, sign in,
 *     lobby, queue, match, result), in that order;
 *   · two screens of the same layout saying the same words are one variant,
 *     the first named (the others are listed as `same`);
 *   · a screen that is not a moment of the page but something over it (the
 *     tour, a menu, a banner, a pop-up with no step) goes in its own "on top" row,
 *     switched on over whichever scene is on (`boardStates.ts#topKey`).
 *
 * The moments are known by the site's own words for them (its preview's
 * `data-preview-step`, else the screen's name and label); a step that is
 * none of them is a scene of its own, after them, in the order the site
 * lists it. Pure: `tests/page-scenes.mjs`.
 */
import { screenKey, topKey, type ScreenRead } from "./boardStates";

export interface SceneVariant {
  /** The capture this variant is drawn from: positions and words together. */
  screen: ScreenRead;
  /** Its plain name inside the scene ("offline", "you lost"). */
  label: string;
  /** Its key in `statesOn`: `screen:<name>`, or `top:<name>` for an overlay. */
  key: string;
  /** Screens folded into it: the same step drawing the same parts (PST's "TV: offline"). */
  same: string[];
}
export interface Scene {
  key: string;
  name: string;
  variants: SceneVariant[];
}
export interface PageScenes {
  scenes: Scene[];
  /** What goes over a scene rather than being one: the tour, a menu. */
  onTop: SceneVariant[];
}

/** The moments a site's flow goes through, in the order a visitor meets them, and the words that name each. Tried result-first so "between matches" is the lobby and "connect a wallet" is signing in. */
const MOMENTS: { key: string; name: string; words: RegExp }[] = [
  { key: "connecting", name: "Connecting", words: /\b(connecting|offline|waking|wake|loading|reconnect\w*)\b/ },
  { key: "sign-in", name: "Sign in", words: /\b(wallets?|sign(ed)?[ -]?in|log[ -]?in|first[ -]visit|devnet|test sol)\b/ },
  { key: "lobby", name: "Lobby", words: /\b(lobby|between matches|idle|signed in)\b/ },
  { key: "queue", name: "Queue", words: /\b(queue|queued|rules?|waiting)\b/ },
  { key: "match", name: "Match", words: /\b(match (starting|live|in progress)|starting|countdown|last seconds|in progress|mid[ -]match)\b/ },
  { key: "result", name: "Result", words: /\b(result|won|win|lost|loss|lose|draw|tie|rematch)\b/ },
];
const TRY = ["result", "match", "queue", "lobby", "sign-in", "connecting"];
const OVER = /\b(tour|menu|pop[ -]?up|dialog|modal|overlay|toast|tooltip|banner)\b/;

const plain = (s: string) => s.toLowerCase().replace(/[-_]+/g, " ");
function momentOf(text: string): (typeof MOMENTS)[number] | null {
  const t = plain(text);
  for (const k of TRY) { const m = MOMENTS.find((x) => x.key === k)!; if (m.words.test(t)) return m; }
  return null;
}
/** A screen's label without its "Kind:" lead ("Error: the game server is offline" is "the game server is offline"). */
const rest = (s: ScreenRead) => (s.label || s.name).replace(/^[^:]{1,40}:\s*/, "").trim();
/** An overlay's own name: the label's lead ("Intro tour: one step" is "Intro tour"), else its first phrase ("Phone menu, open (...)" is "Phone menu"). */
const overName = (s: ScreenRead) => { const l = (s.label || s.name).trim(); const lead = /^([^:]{1,40}):/.exec(l); return (lead ? lead[1]! : l.split(/[,(]/)[0]!).trim(); };
const sameDrawing = (a: ScreenRead, b: ScreenRead) => a.shows.length === b.shows.length && [...a.shows].sort().join(" ") === [...b.shows].sort().join(" ");

/**
 * Do two captures draw the same layout? The same hooks, each at the same
 * place and size (8px, or a tenth of its size, either way). A hook whose
 * words differ between the two is not measured: its box is its words' (J,
 * 2026-10-06: "different data within the same frame doesnt classify a
 * different state").
 */
export function sameLayout(a: ScreenRead, b: ScreenRead): boolean {
  if (!sameDrawing(a, b)) return false;
  const ab = a.boxes ?? {}, bb = b.boxes ?? {};
  const near = (p: number, q: number, size = 0) => Math.abs(p - q) <= Math.max(8, size / 10);
  for (const h of a.shows) {
    const p = ab[h], q = bb[h];
    if (!p || !q || (a.texts?.[h] ?? "") !== (b.texts?.[h] ?? "")) continue;
    if (!near(p[0], q[0]) || !near(p[1], q[1]) || !near(p[2], q[2], Math.max(p[2], q[2])) || !near(p[3], q[3], Math.max(p[3], q[3]))) return false;
  }
  return true;
}
/**
 * Two captures of one moment drawing nearly the same parts (nine in ten of
 * them shared) are one state: won, lost and draw are the result whether or
 * not a draw adds its rematch offer (J, 2026-10-06: "won, lost and draw
 * should be sample chips"). Each sample still draws from its own capture.
 */
export function nearlySame(a: ScreenRead, b: ScreenRead): boolean {
  const A = new Set(a.shows), B = new Set(b.shows);
  let both = 0;
  for (const h of A) if (B.has(h)) both++;
  const any = A.size + B.size - both;
  return any > 0 && both / any >= 0.85;
}
const sameWords = (a: ScreenRead, b: ScreenRead) => (a.step ?? "") === (b.step ?? "") && JSON.stringify(a.texts ?? {}) === JSON.stringify(b.texts ?? {});

/**
 * The states of one page, from its screens (`pageFile` keeps the page's own;
 * a screen naming no page is kept). A state is a layout: screens drawing the
 * same parts at the same places are one state, whatever their words say, and
 * each is a sample of its data (won, lost, draw). A state is named by the
 * moment of its first screen, and they come in the order of the game.
 */
export function pageScenes(screens: readonly ScreenRead[] | null | undefined, pageFile: string | null): PageScenes {
  const mine = (screens ?? []).filter((s) => !pageFile || !s.page || s.page === pageFile);
  const scenes: (Scene & { rank: number; moment: string })[] = [];
  const onTop: SceneVariant[] = [];
  mine.forEach((s, at) => {
    /* The site's word for the moment first; a screen with none is known by its name and label. */
    const m = s.step ? momentOf(s.step) ?? null : momentOf(`${s.name} ${s.label ?? ""}`);
    /* A screen with no step of the flow whose own kind is something over the page ("Pop-up: create a new wallet", "Devnet banner") goes on top, whatever words follow. */
    const kind = /^([^:]{1,40}):/.exec(s.label ?? "")?.[1] ?? "";
    if (!s.step && (OVER.test(plain(kind || s.name)) || (!m && OVER.test(plain(`${s.name} ${s.label ?? ""}`))))) {
      const twin = onTop.find((v) => sameDrawing(v.screen, s));
      if (twin) twin.same.push(s.name);
      else onTop.push({ screen: s, label: overName(s), key: topKey(s.name), same: [] });
      return;
    }
    /* A capture that drew nothing of the page (read at a width that hides it) is folded into its moment's state. */
    const blank = !s.shows.length && m ? scenes.find((x) => x.moment === m.key) : undefined;
    if (blank) { blank.variants[0]!.same.push(s.name); return; }
    /* The same layout is the same state, whichever moment it was captured at. */
    let scene = scenes.find((x) => sameLayout(x.variants[0]!.screen, s)) ?? (m ? scenes.find((x) => x.moment === m.key && x.variants.some((v) => nearlySame(v.screen, s))) : undefined);
    if (!scene) {
      const moment = m?.key ?? `step:${plain(s.step || s.name)}`;
      const name = m?.name ?? (s.step ? s.step.charAt(0).toUpperCase() + s.step.slice(1) : rest(s));
      scene = { key: moment, moment, name, variants: [], rank: m ? MOMENTS.indexOf(m) : 100 + at };
      scenes.push(scene);
    }
    /* The same words in the same layout is the same capture taken twice: the first is kept. */
    const twin = scene.variants.find((v) => sameWords(v.screen, s));
    if (twin) { twin.same.push(s.name); return; }
    scene.variants.push({ screen: s, label: "", key: screenKey(s.name), same: [] });
  });
  /* Each sample named by its step where that tells it from the others, else by its label. */
  for (const sc of scenes) {
    const steps = sc.variants.map((v) => v.screen.step ?? "");
    for (const v of sc.variants) {
      const st = v.screen.step ?? "";
      v.label = st && steps.filter((x) => x === st).length === 1 ? st : rest(v.screen);
    }
  }
  scenes.sort((a, b) => a.rank - b.rank);
  /* Two layouts of one moment (the match starting, then live): each keyed and named apart by its first sample. */
  for (const sc of scenes) {
    const twins = scenes.filter((x) => x.moment === sc.moment);
    if (twins.length < 2) continue;
    const n = twins.indexOf(sc);
    if (n > 0) sc.key = `${sc.moment}-${n + 1}`;
    sc.name = `${sc.name}: ${sc.variants[0]!.label}`;
  }
  return { scenes: scenes.map(({ rank: _rank, moment: _moment, ...s }) => s), onTop };
}

/** Every variant, scenes in order then the ones on top. */
export const allVariants = (p: PageScenes): SceneVariant[] => [...p.scenes.flatMap((s) => s.variants), ...p.onTop];
