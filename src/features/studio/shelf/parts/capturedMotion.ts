/**
 * A captured page's own motion, replayed (sink `docs/motion.md`).
 *
 * The capture records a page's `@keyframes` (`doc.keyframes`, carried in
 * `look.keyframes`), each element's animations and transitions, the
 * `:hover` / `:focus` rules that move it (`node.motion`), a title's
 * per-letter runs, and the frames it embeds (`node.embed`). This turns them
 * into one stylesheet, the same on the preview and the published page:
 *
 *   · each `@keyframes` under a prefixed name (`cap-<name>`), so a page's
 *     `spin` can never be the Builder's own;
 *   · a part's animation and transitions on its box (`.mo-<id>`, the
 *     `[data-part-box]` wrapper `blocks.tsx` puts round it, which also
 *     wears its captured transform, so an animation of `transform` replaces
 *     it exactly as it did on the page);
 *   · a `:hover` / `:active` / `:focus` rule on the part's own box when the element
 *     itself was hovered (`self`), and, when an ancestor was (`.tv:hover
 *     .knob`), keyed on that ancestor: the part that holds it by selector,
 *     and every part inside that one, since hovering anything inside the TV
 *     hovers the TV. The declarations win over the box's own inline style,
 *     as the page's did over its resting rule;
 *   · and nothing moves for a visitor who asked for less motion.
 *
 * Nothing here reads the store: `parts/` ships with a generated site. Every
 * name and value came from a capture of somebody's page, so each is checked
 * before it is written into a stylesheet.
 */
import type { NodeLink } from "./types";

/** One animation, every longhand as the browser computed it. */
export interface MotionAnimation { name: string; duration?: string; timing?: string; delay?: string; iterations?: string; direction?: string; fill?: string }
/** One transitioned property. */
export interface MotionTransition { property: string; duration?: string; timing?: string; delay?: string }
/**
 * A rule that applies while the element (`self`) or an ancestor is hovered,
 * pressed or focused. `pseudo` (`::before`, `::after`): it paints that
 * pseudo-element of the element, one not drawn at rest, whose look at rest
 * is `base`. On a pseudo-element's own part, `of` says whose state paints
 * it: the element that bears it (`host`) or one that element sits in.
 */
export interface MotionState { selector?: string; self?: boolean; state?: string; style?: Record<string, string>; pseudo?: string; base?: Record<string, string>; of?: string }
/** What a node does over time (sink `node.motion`). */
export interface NodeMotion {
  animation?: MotionAnimation[];
  transition?: MotionTransition[];
  hover?: MotionState[];
  /** Pressed (`:active`): its own state, written after the hover so a press wins over the hover it happens under. */
  active?: MotionState[];
  focus?: MotionState[];
  /** The animation every letter of a folded title shares. */
  letter?: { animation?: MotionAnimation[] } | null;
  /** Turned off in the Motion tab: kept as captured, and played nowhere. */
  off?: boolean;
}
/** A frame of another page (sink `node.embed`). */
export interface NodeEmbed { src: string; allow?: string; sandbox?: string; title?: string; loading?: string; size?: { w: number; h: number }; /** The address the capture found, kept once J changes it in the embed box (`EmbedBox.tsx`): Publish asks the code for the new one. */ was?: string }
/** A `@keyframes` rule as the capture read it. */
export interface CapturedKeyframes { name: string; frames: { key: string; style: Record<string, string> }[]; sheet?: string }

/** The node, as far as motion reads it. */
export interface MotionNode { id: string; pageId?: string; x: number; y: number; w: number; h: number; motion?: NodeMotion | null; embed?: NodeEmbed | null; from?: { selector?: string } | null; colour?: { bg?: string } | null; edge?: { width?: number; shadow?: string } | null; picture?: unknown; art?: { background?: string } | null; link?: NodeLink | null }

const NAME = /^[A-Za-z_][\w-]{0,63}$/;
const PROP = /^-{0,2}[A-Za-z][\w-]{0,63}$/;
/** A value from somebody's page: kept when it cannot leave its declaration. */
const safeValue = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s || s.length > 600 || /[{};<>\\]|\/\*|expression\s*\(|javascript:/i.test(s)) return null;
  return s;
};
const ID = /^[A-Za-z0-9_-]{1,80}$/;

/** The name a page's keyframes go by here. */
export function capName(name: string): string | null {
  return NAME.test(name) ? `cap-${name}` : null;
}

/** An animation as one `animation` value, under its prefixed name; null when nothing safe is left. */
export function animationValue(a: MotionAnimation): string | null {
  const name = capName(a.name ?? "");
  if (!name) return null;
  const rest = [a.duration, a.timing, a.delay, a.iterations, a.direction, a.fill].map(safeValue);
  if (rest.some((v, i) => v === null && [a.duration, a.timing, a.delay, a.iterations, a.direction, a.fill][i] !== undefined)) return null;
  return [...rest.map((v) => v ?? ""), name].filter(Boolean).join(" ");
}

export function animationsValue(list: readonly MotionAnimation[] | undefined): string | null {
  const got = (list ?? []).map(animationValue).filter((v): v is string => !!v);
  return got.length ? got.join(", ") : null;
}

function transitionValue(list: readonly MotionTransition[] | undefined): string | null {
  const got = (list ?? []).map((t) => {
    const p = t.property === "all" || PROP.test(t.property ?? "") ? t.property : null;
    const vals = [t.duration, t.timing, t.delay].map(safeValue);
    return p && vals.every((v, i) => v !== null || [t.duration, t.timing, t.delay][i] === undefined) ? [p, ...vals.filter(Boolean)].join(" ") : null;
  }).filter((v): v is string => !!v);
  return got.length ? got.join(", ") : null;
}

function declarations(style: Record<string, string> | undefined, important: boolean): string {
  const out: string[] = [];
  for (const [p, raw] of Object.entries(style ?? {})) {
    const v = safeValue(raw);
    if (!PROP.test(p) || v === null) continue;
    out.push(`${p}: ${v.replace(/\s*!important$/i, "")}${important ? " !important" : ""}`);
  }
  return out.join("; ");
}

/** The keyframes, each under its prefixed name. */
export function keyframesCss(list: readonly CapturedKeyframes[] | undefined): string {
  const out: string[] = [];
  for (const k of list ?? []) {
    const name = capName(k?.name ?? "");
    if (!name || !Array.isArray(k.frames)) continue;
    const frames = k.frames.map((f) => {
      const key = typeof f?.key === "string" && /^(from|to|\d{1,3}(\.\d+)?%)(\s*,\s*(from|to|\d{1,3}(\.\d+)?%))*$/.test(f.key.trim()) ? f.key.trim() : null;
      const decl = declarations(f.style, false);
      return key && decl ? `  ${key} { ${decl} }` : null;
    }).filter(Boolean);
    if (frames.length) out.push(`@keyframes ${name} {\n${frames.join("\n")}\n}`);
  }
  return out.join("\n");
}

/** Does this node move, or embed, so it needs a box to carry it? */
export function hasMotion(n: { motion?: NodeMotion | null; embed?: NodeEmbed | null }): boolean {
  const m = n.motion;
  if (m?.off) return !!n.embed?.src;
  return !!(m && (m.animation?.length || m.transition?.length || m.hover?.length || m.active?.length || m.focus?.length)) || !!n.embed?.src;
}

/** The class a node's box wears, so the stylesheet can reach it on every surface (the export keeps classes). */
export const motionClass = (id: string): string | null => (ID.test(id) ? `mo mo-${id}` : null);

/**
 * The part a hover on an ancestor is keyed on. The capture keeps the rule's
 * selector (`.tv:hover .knob:first-child`) and the part's own element path,
 * never the classes, so the ancestor is found by path: at least as many
 * levels up as the selector has compounds after the hovered one, the
 * nearest part there that paints a surface of its own (a fill, an edge, a
 * picture: the thing a visitor sees and points at), else the nearest part
 * that far up at all.
 */
export function hoverHost(node: MotionNode, rule: MotionState, nodes: readonly MotionNode[]): MotionNode | null {
  const sel = node.from?.selector;
  if (!sel) return null;
  /* A pseudo-element's part (`… > a::before`): the element that bears it is hovered, or one that element sits in. */
  const cut = sel.indexOf("::");
  if (cut > 0) {
    const own = sel.slice(0, cut);
    const bearer = nodes.find((n) => n.id !== node.id && n.pageId === node.pageId && n.from?.selector === own) ?? null;
    if (rule.of === "host") return bearer;
    return hoverHost({ ...node, from: { ...node.from, selector: own } }, rule, nodes) ?? bearer;
  }
  const compounds = (rule.selector ?? "").split(/\s*[\s>+~]\s*/).filter(Boolean);
  const at = compounds.findIndex((c) => /:(hover|active|focus)/.test(c));
  const up = at >= 0 ? Math.max(1, compounds.length - 1 - at) : 1;
  const depth = (s: string) => s.split(" > ").length;
  const mine = depth(sel);
  const ancestors = nodes
    .filter((n) => n.id !== node.id && n.pageId === node.pageId && n.from?.selector && sel.startsWith(`${n.from.selector} > `) && mine - depth(n.from.selector) >= up)
    .sort((a, b) => depth(b.from!.selector!) - depth(a.from!.selector!));
  const paints = (n: MotionNode) => !!(n.colour?.bg || (n.edge && ((n.edge.width ?? 0) > 0 || n.edge.shadow)) || n.picture || n.art?.background);
  return ancestors.find(paints) ?? ancestors[0] ?? null;
}

/** Is `kid`'s element path inside `parent`'s? Its pseudo-elements are its own (`a::before`: a remote key's gloss strip). As `owns.ts#under`. */
export function underPath(parent: string, kid: string): boolean {
  if (!parent || !kid || kid === parent) return false;
  return kid.startsWith(`${parent} > `) || (kid.startsWith(parent) && /^::(before|after)$/.test(kid.slice(parent.length)));
}

/** The parts inside `host` on the page, by element path (the capture's own nesting; on the board they are siblings). */
export function inside<N extends MotionNode>(host: N, nodes: readonly N[]): N[] {
  const sel = host.from?.selector?.trim();
  if (!sel) return [];
  return nodes.filter((x) => x.id !== host.id && ID.test(x.id) && x.pageId === host.pageId && underPath(sel, x.from?.selector?.trim() ?? ""));
}

/**
 * `inside` for every part of a page at once, by walking each part's path up
 * rather than asking every part of every other: a page of 18,000 parts
 * asked it 18,000 times over 18,000 parts. The same answer, in the same order.
 */
export function insideIndex<N extends MotionNode>(nodes: readonly N[]): (host: N) => N[] {
  const bySel = new Map<string, N[]>();
  for (const n of nodes) {
    const sel = n.from?.selector?.trim();
    if (!sel) continue;
    const key = `${n.pageId ?? ""}\u0000${sel}`;
    const list = bySel.get(key);
    if (list) list.push(n); else bySel.set(key, [n]);
  }
  const kids = new Map<N, Set<N>>();
  for (const x of nodes) {
    const sel = x.from?.selector?.trim();
    if (!sel || !ID.test(x.id)) continue;
    const seen = new Set<string>();
    const up = (p: string) => {
      if (seen.has(p)) return;
      seen.add(p);
      for (const h of bySel.get(`${x.pageId ?? ""}\u0000${p}`) ?? []) if (h !== x && h.id !== x.id) { let s = kids.get(h); if (!s) kids.set(h, (s = new Set())); s.add(x); }
    };
    const pseudo = /::(before|after)$/.exec(sel);
    if (pseudo) up(sel.slice(0, pseudo.index));
    let at = sel.lastIndexOf(" > ");
    while (at > 0) { up(sel.slice(0, at)); at = sel.lastIndexOf(" > ", at - 1); }
  }
  const order = new Map(nodes.map((n, i) => [n, i]));
  const cache = new Map<N, N[]>();
  return (host) => {
    let got = cache.get(host);
    if (!got) cache.set(host, (got = [...(kids.get(host) ?? [])].sort((a, b) => order.get(a)! - order.get(b)!)));
    return got;
  };
}

/**
 * Every part's element path as a short code, one token a step (`3.1f.a2.`):
 * a part stands under another's path exactly when its code begins with the
 * other's and is longer, as `underPath` has it (a `::before` a step of its
 * element). Tokens are shared by every part the codes are made for, so make
 * them once for the whole site. Null for a part with no path.
 */
export function pathCodes(nodes: readonly MotionNode[]): (id: string) => string | null {
  const token = new Map<string, string>();
  const tok = (p: string) => { let t = token.get(p); if (!t) token.set(p, (t = token.size.toString(36))); return t; };
  const codes = new Map<string, string>();
  for (const n of nodes) {
    const sel = n.from?.selector?.trim();
    if (!sel || !ID.test(n.id)) continue;
    const steps: string[] = [];
    const pseudo = /::(before|after)$/.exec(sel);
    const base = pseudo ? sel.slice(0, pseudo.index) : sel;
    for (let at = base.indexOf(" > "); at > 0; at = base.indexOf(" > ", at + 3)) steps.push(base.slice(0, at));
    steps.push(base);
    if (pseudo) steps.push(sel);
    codes.set(n.id, steps.map((p) => `${tok(p)}.`).join(""));
  }
  return (id) => codes.get(id) ?? null;
}

/** A selector list's selectors, split at its own commas and never at one inside `:has(…)` or `:not(…)`. */
function topLevel(list: string): string[] {
  const out: string[] = [];
  let depth = 0, from = 0;
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (c === "," && depth === 0) { out.push(list.slice(from, i).trim()); from = i + 1; }
  }
  out.push(list.slice(from).trim());
  return out;
}

export const MOVES = new Set(["transform", "translate", "rotate", "scale"]);

/** Does a hover, press or focus on the part itself move it (a key that rises under the pointer and sinks when pressed)? */
export function movesItself(n: MotionNode): boolean {
  const m = n.motion;
  return [m?.hover, m?.active, m?.focus].some((list) => (list ?? []).some((r) => r.self !== false && Object.keys(r.style ?? {}).some((k) => MOVES.has(k))));
}

/**
 * The whole stylesheet for a page's parts. `at(id)` is how a part's own
 * element is reached on this surface (`[data-live-node="…"]` in the preview,
 * `#…` in the export).
 *
 * A HOVER IS THE ELEMENT'S AND EVERYTHING IN IT. On the page, the words and
 * the icon of a link were inside it, so pointing at them was pointing at the
 * link, and they moved with it. Here they are parts of their own, drawn over
 * its box, so the rule fires when the element or any part inside it is
 * hovered, and a move it makes (transform, translate, rotate, scale) is
 * made by the parts inside as well, about the element's own centre, with
 * the element's transition, so they travel together as they did.
 */
export function motionCss(nodes: readonly MotionNode[], keyframes: readonly CapturedKeyframes[] | undefined, at: (id: string) => string, nested?: ReadonlySet<string>, pathCode?: (id: string) => string | null, usedCodes?: Set<string>): string {
  const rules: string[] = [];
  const within = insideIndex(nodes);
  /*
   * WHAT FIRES A GROUP'S RULE. Said as every part of the group by name, a
   * rule on a box with 400 parts in it (parasiteonsol.fun's panels) was 3 KB
   * long, and 8,085 of them made the published stylesheet 24 MB of its 26.
   * Given `pathCode`, every part wears its element path as a short code
   * (`data-at`, which the caller writes: one token a step, `3.1f.a2.`), and
   * the rule names the host and whatever stands under its path: the same
   * elements (a part at the host's own path, its twin in another state, is
   * not under it, as `inside` has it), one selector long. `usedCodes` hears
   * which paths a rule names, so only the parts under them need the code.
   */
  const trigger = (host: MotionNode, group: readonly MotionNode[], pseudo: string) => {
    const code = pathCode?.(host.id);
    if (!code) return `:root:has(${group.map((x) => `${at(x.id)}${pseudo}`).join(", ")})`;
    usedCodes?.add(code);
    return `:root:has(${at(host.id)}${pseudo}, [data-at^="${code}"]:not([data-at="${code}"])${pseudo})`;
  };
  for (const n of nodes) {
    const m = n.motion;
    if (!m || m.off || !ID.test(n.id)) continue;
    const box = `.mo-${n.id}`;
    const own: string[] = [];
    const anim = animationsValue(m.animation);
    if (anim) own.push(`animation: ${anim}`);
    const trans = transitionValue(m.transition);
    if (trans) own.push(`transition: ${trans}`);
    if (own.length) rules.push(`${box} { ${own.join("; ")}; }`);
    const kids = within(n);
    const moveTrans = transitionValue((m.transition ?? []).filter((t) => t.property === "all" || MOVES.has(t.property)));
    for (const [kind, list] of [["hover", m.hover], ["active", m.active], ["focus", m.focus]] as const) {
      for (const r of list ?? []) {
        const decl = declarations(r.style, true);
        if (!decl) continue;
        const pseudo = kind === "hover" ? ":hover" : kind === "active" ? ":active" : r.state === "focus-visible" ? ":focus-visible" : ":focus-within";
        const host = r.self !== false ? n : hoverHost(n, r, nodes);
        if (!host || !ID.test(host.id)) continue;
        const group = [host, ...within(host)];
        /*
         * The part's own element is its box and everything drawn in its
         * frame with it: a link stretched over the part (`link-fills-part`)
         * sits over the box, and the pointer on it was on the box too
         * (trumpmorty.fun's nav: `.nav a:hover` paints a yellow pill behind
         * "How to buy", and under the stretched link nothing matched).
         */
        const own = kind === "focus" ? `${box}${pseudo}` : `${at(host.id)}${pseudo} ${box}, ${box}${pseudo}`;
        const when = group.length === 1 ? own : `${trigger(host, group, pseudo)} ${box}`;
        /*
         * A pseudo-element the state brings (`.nav a:hover::before`, a pill
         * not drawn at rest): drawn from its look at rest and the state's,
         * inside the part's box as it was inside the element. One there at
         * rest (content, however faint) is drawn at rest too, so the state
         * eases from it over its own transition.
         */
        if (r.pseudo === "::before" || r.pseudo === "::after") {
          const base = declarations(r.base, false);
          const there = !!r.base?.content && !/^(none|normal)$/.test(r.base.content.trim());
          const on = topLevel(when).map((w) => `${w}${r.pseudo}`).join(", ");
          rules.push(`${box} { position: relative; }`);
          if (there && base) rules.push(`${box}${r.pseudo} { ${base}; }`);
          rules.push(`${on} { ${[base, decl].filter(Boolean).join("; ")}; }`);
          continue;
        }
        rules.push(`${when} { ${decl}; }`);
        /* What it moves, the parts inside it move with it. */
        const moves = Object.fromEntries(Object.entries(r.style ?? {}).filter(([k]) => MOVES.has(k)));
        const moveDecl = declarations(moves, true);
        if (!moveDecl || !kids.length) continue;
        const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
        /* The group is never the host alone here: the parts inside it are in it. */
        const fires = trigger(host, group, pseudo);
        /* A part the export puts inside the box (`nested`, exportSite.ts#carryOwned) moves with it already. */
        for (const k of kids) {
          if (nested?.has(k.id)) continue;
          const origin = `transform-origin: ${Math.round(cx - k.x)}px ${Math.round(cy - k.y)}px`;
          if (moveTrans) rules.push(`@media (prefers-reduced-motion: no-preference) { ${at(k.id)} { transition: ${moveTrans}; } }`);
          rules.push(`${fires} ${at(k.id)} { ${moveDecl}; ${origin} !important; }`);
        }
      }
    }
  }
  const frames = keyframesCss(keyframes);
  if (!frames && !rules.length) return "";
  return [
    frames,
    ...rules,
    /* A visitor who asked for less motion gets the page at rest. */
    "@media (prefers-reduced-motion: reduce) { .mo, .mo *, .mo-l { animation: none !important; transition: none !important; } }",
  ].filter(Boolean).join("\n");
}

/**
 * A part drawn again somewhere else on the page (a "What's new" step's live
 * preview), with its own motion.
 *
 * The copy's pieces are the page's parts drawn a second time, so the page's
 * rules either miss them (a hover keyed on another element: the TV's knobs
 * turn when the TV is pointed at, `.tv:hover .knob`, reached by the TV's
 * id) or hit them for the wrong reason. So each piece is renamed for the
 * copy (`idOf`: its box wears `mo-<new id>`, which no page rule names) and
 * every rule its part had, its own animation, transition, hover, press
 * and focus, the moves its words make with it, is written again for the
 * copy alone, reaching each piece by `data-copy-node`. Pointing at the
 * copied TV turns the copied knobs and not the page's; pointing at the
 * page's turns its own and not the copy's.
 */
export function copyMotion<N extends MotionNode>(nodes: readonly N[], of: string): { idOf: (id: string) => string; css: string } {
  const idOf = (id: string) => {
    const plain = `cp-${of}-${id}`;
    if (ID.test(plain)) return plain;
    let h = 5381;
    for (const ch of plain) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0;
    return `cp-${h.toString(36)}-${id}`.slice(0, 80);
  };
  const renamed = nodes.map((n) => ({ ...n, id: idOf(n.id) }));
  return { idOf, css: motionCss(renamed, undefined, (id) => `[data-copy-node="${id}"]`) };
}

/** The sandbox an embed runs in: the page's own when it wrote one, else scripts in their own origin and nothing on this page. */
export const EMBED_SANDBOX = "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox";

/** An embed's address, when it is one a frame may load. */
export function embedSrc(e: NodeEmbed | null | undefined): string | null {
  const s = (e?.src ?? "").trim();
  try { const u = new URL(s); return u.protocol === "https:" || u.protocol === "http:" ? u.href : null; } catch { return null; }
}
