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
/** A rule that applies while the element (`self`) or an ancestor is hovered, pressed or focused. */
export interface MotionState { selector?: string; self?: boolean; state?: string; style?: Record<string, string> }
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
}
/** A frame of another page (sink `node.embed`). */
export interface NodeEmbed { src: string; allow?: string; sandbox?: string; title?: string; loading?: string; size?: { w: number; h: number } }
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

/** The parts inside `host` on the page, by element path (the capture's own nesting; on the board they are siblings). */
function inside(host: MotionNode, nodes: readonly MotionNode[]): MotionNode[] {
  const sel = host.from?.selector;
  if (!sel) return [];
  return nodes.filter((x) => x.id !== host.id && ID.test(x.id) && x.pageId === host.pageId && x.from?.selector?.startsWith(`${sel} > `));
}

const MOVES = new Set(["transform", "translate", "rotate", "scale"]);

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
export function motionCss(nodes: readonly MotionNode[], keyframes: readonly CapturedKeyframes[] | undefined, at: (id: string) => string): string {
  const rules: string[] = [];
  for (const n of nodes) {
    const m = n.motion;
    if (!m || !ID.test(n.id)) continue;
    const box = `.mo-${n.id}`;
    const own: string[] = [];
    const anim = animationsValue(m.animation);
    if (anim) own.push(`animation: ${anim}`);
    const trans = transitionValue(m.transition);
    if (trans) own.push(`transition: ${trans}`);
    if (own.length) rules.push(`${box} { ${own.join("; ")}; }`);
    const kids = inside(n, nodes);
    const moveTrans = transitionValue((m.transition ?? []).filter((t) => t.property === "all" || MOVES.has(t.property)));
    for (const [kind, list] of [["hover", m.hover], ["active", m.active], ["focus", m.focus]] as const) {
      for (const r of list ?? []) {
        const decl = declarations(r.style, true);
        if (!decl) continue;
        const pseudo = kind === "hover" ? ":hover" : kind === "active" ? ":active" : r.state === "focus-visible" ? ":focus-visible" : ":focus-within";
        const host = r.self !== false ? n : hoverHost(n, r, nodes);
        if (!host || !ID.test(host.id)) continue;
        const group = [host, ...inside(host, nodes)];
        const when = group.length === 1 ? `${box}${pseudo}` : `:root:has(${group.map((x) => `${at(x.id)}${pseudo}`).join(", ")}) ${box}`;
        rules.push(`${when} { ${decl}; }`);
        /* What it moves, the parts inside it move with it. */
        const moves = Object.fromEntries(Object.entries(r.style ?? {}).filter(([k]) => MOVES.has(k)));
        const moveDecl = declarations(moves, true);
        if (!moveDecl || !kids.length) continue;
        const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
        /* The group is never the host alone here: the parts inside it are in it. */
        const trigger = `:root:has(${group.map((x) => `${at(x.id)}${pseudo}`).join(", ")})`;
        for (const k of kids) {
          const origin = `transform-origin: ${Math.round(cx - k.x)}px ${Math.round(cy - k.y)}px`;
          if (moveTrans) rules.push(`@media (prefers-reduced-motion: no-preference) { ${at(k.id)} { transition: ${moveTrans}; } }`);
          rules.push(`${trigger} ${at(k.id)} { ${moveDecl}; ${origin} !important; }`);
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

/** The sandbox an embed runs in: the page's own when it wrote one, else scripts in their own origin and nothing on this page. */
export const EMBED_SANDBOX = "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox";

/** An embed's address, when it is one a frame may load. */
export function embedSrc(e: NodeEmbed | null | undefined): string | null {
  const s = (e?.src ?? "").trim();
  try { const u = new URL(s); return u.protocol === "https:" || u.protocol === "http:" ? u.href : null; } catch { return null; }
}
