/**
 * What a captured page's scripts did, attached as features on import.
 *
 * sink records what only a page's script does (`doc.behaviours`, sink
 * `docs/behaviours.md`): its loader, its intro, what it revealed as it
 * scrolled, a header that changed once scrolled, layers that followed the
 * pointer, a marquee, the lights that blink. Each is named by the part it
 * was recorded on. Here each becomes the library feature that does the same
 * thing, attached to that part with the settings measured, so the Preview
 * and the published page play it and the board, as ever, stays still. The
 * owner switches any of them off in the Element panel's Working block.
 *
 * WHAT IS NOT ATTACHED, AND WHY. A turn toward the pointer (the TV's tilt):
 * a captured page is flat, the TV's screen, knobs and words are parts of
 * their own beside it, and turning the TV's box alone would tear it apart.
 * A reveal or an intro on a container is given to the parts inside it too,
 * for the same reason, scaling about the container's centre.
 *
 * Pure: no store, no React. `docTake.ts` calls it when a document carrying
 * the section is taken in; a document without one comes in untouched.
 */
import { withWork, type WorkUse } from "./works.ts";

type Rec = Record<string, unknown>;
interface Node {
  id: string;
  pageId?: string;
  featureId?: string;
  data?: string;
  x?: number; y?: number; w?: number; h?: number;
  from?: { selector?: string } | null;
  art?: Rec | null;
  motion?: { animation?: { name?: string; duration?: string; timing?: string }[] } & Rec;
  work?: WorkUse | null;
}

const num = (v: unknown): number | null => { const n = Number(v); return v !== null && v !== "" && Number.isFinite(n) ? n : null; };
const round = (n: number, k = 100) => Math.round(n * k) / k;
const str = (n: number) => String(round(n, 1000));

/** A computed `matrix(a, b, c, d, e, f)` (or none) as its scale and translation. */
function matrixOf(t: unknown): { k: number; x: number; y: number } {
  const m = /matrix\(([^)]+)\)/.exec(String(t ?? ""));
  if (!m) return { k: 1, x: 0, y: 0 };
  const [a, b, , , e, f] = m[1]!.split(",").map((v) => Number(v.trim()));
  return { k: Math.hypot(a ?? 1, b ?? 0), x: e ?? 0, y: f ?? 0 };
}
/** `translateY(40px) scale(.9)`, as written in a keyframe. */
function writtenOf(t: unknown): { k: number; x: number; y: number } {
  const s = String(t ?? "");
  const tr = /translate(?:3d)?\(\s*(-?[\d.]+)px(?:\s*,\s*(-?[\d.]+)px)?/.exec(s);
  const tx = /translateX\(\s*(-?[\d.]+)px/.exec(s), ty = /translateY\(\s*(-?[\d.]+)px/.exec(s);
  const sc = /scale\(\s*([\d.]+)/.exec(s);
  return { k: sc ? Number(sc[1]) : 1, x: tx ? Number(tx[1]) : tr ? Number(tr[1]) : 0, y: ty ? Number(ty[1]) : tr?.[2] ? Number(tr[2]) : 0 };
}
/** Where a part comes in from, as Reveal says it: a direction and a distance. */
function direction(dx: number, dy: number): { direction: string; distance: string } {
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return { direction: "none", distance: "0" };
  if (Math.abs(dy) >= Math.abs(dx)) return { direction: dy > 0 ? "up" : "down", distance: str(Math.abs(dy)) };
  return { direction: dx > 0 ? "left" : "right", distance: str(Math.abs(dx)) };
}
/** The transform's duration and curve out of a computed `transition`. */
function transitionOf(t: unknown): { duration: string | null; ease: string | null } {
  const parts: string[] = [];
  let depth = 0, cur = "";
  for (const ch of String(t ?? "")) { if (ch === "(") depth++; if (ch === ")") depth--; if (ch === "," && !depth) { parts.push(cur.trim()); cur = ""; } else cur += ch; }
  if (cur.trim()) parts.push(cur.trim());
  const one = parts.find((p) => /^transform\b/.test(p)) ?? parts.find((p) => /^all\b/.test(p));
  if (!one) return { duration: null, ease: null };
  const d = /(\d*\.?\d+)(ms|s)\b/.exec(one);
  const e = /(cubic-bezier\([^)]*\)|steps\([^)]*\)|ease-in-out|ease-in|ease-out|ease|linear)/.exec(one.replace(/^transform\s+/, ""));
  return { duration: d ? String(Math.round(Number(d[1]) * (d[2] === "s" ? 1000 : 1))) : null, ease: e ? e[1]! : null };
}

/**
 * The nodes with what their page's script did attached. `keyframes` is the
 * document's `@keyframes`, to tell a blink (a light taken to nothing and
 * back) from any other loop.
 */
export function attachCaptured<N extends Node>(nodes: readonly N[], behaviours: unknown, keyframes?: unknown): N[] {
  const b = behaviours as Rec | null;
  if (!b || typeof b !== "object" || b.version !== 1) return [...nodes];
  const out = nodes.map((n) => ({ ...n }));
  const byId = new Map(out.map((n) => [n.id, n]));
  const give = (id: unknown, use: WorkUse) => {
    const n = typeof id === "string" ? byId.get(id) : undefined;
    if (n) n.work = withWork(n.work, use);
    return !!n;
  };
  /** The parts inside a part: every one on its page whose element sits under its element. */
  const inside = (n: Node): Node[] => {
    const sel = n.from?.selector?.trim();
    if (!sel) return [];
    return out.filter((o) => o.pageId === n.pageId && o.id !== n.id && !!o.from?.selector && (o.from.selector.startsWith(`${sel} > `) || o.from.selector.startsWith(`${sel}::`)));
  };
  const own = new Set<string>();
  /** A reveal on a part and, the same way, on every part inside it that has none of its own. */
  const reveal = (id: unknown, inputs: Record<string, string>) => {
    const n = typeof id === "string" ? byId.get(id) : undefined;
    if (!n) return;
    give(n.id, { id: "reveal", inputs });
    own.add(n.id);
    const cx = (n.x ?? 0) + (n.w ?? 0) / 2, cy = (n.y ?? 0) + (n.h ?? 0) / 2;
    for (const k of inside(n)) {
      if (own.has(k.id)) continue;
      /* Scaled about the container's centre, as the page scaled the element they were in; a part turned on its own keeps its own. */
      const origin = inputs.scale !== "1" && !k.art?.transform ? `${round(cx - (k.x ?? 0))}px ${round(cy - (k.y ?? 0))}px` : "";
      give(k.id, { id: "reveal", inputs: { ...inputs, ...(origin ? { origin } : {}) } });
    }
  };

  const loader = b.loader as Rec | undefined;
  const loaderGoes = !!loader;

  /* The loader: on the part that shows its picture, else the first part of the first page. */
  if (loader) {
    const stem = (u: unknown) => String(u ?? "").split(/[?#]/)[0]!.split("/").pop()!.replace(/\.[a-z0-9]+$/i, "").toLowerCase();
    const want = ((loader.pictures as unknown[]) ?? []).map(stem).filter(Boolean);
    const pic = out.find((n) => n.featureId === "picture" && want.some((w) => { const s = stem(n.data); return !!s && (s === w || s.startsWith(`${w}-`)); }));
    const host = pic ?? out[0];
    const off = num((loader.off as Rec | undefined)?.afterMs) ?? num(loader.lastedMs);
    if (host) give(host.id, { id: "crt-loader", inputs: {
      title: String(loader.title ?? ""), ticker: String(loader.ticker ?? ""),
      channel: String(loader.channel ?? ""), label: String(loader.label ?? ""),
      ...(off ? { hold: String(round(off / 1000, 10)) } : {}),
    } });
  }

  /* Reveals first (a part's own), then the intro. */
  for (const r of (b.reveal as Rec[]) ?? []) {
    if (!r.part || r.folded) continue;
    const rest = matrixOf((r.rest as Rec | undefined)?.transform), shown = matrixOf((r.shown as Rec | undefined)?.transform);
    const t = transitionOf(r.transition);
    reveal(r.part, {
      ...direction(rest.x - shown.x, rest.y - shown.y),
      scale: str(shown.k ? rest.k / shown.k : 1),
      delay: String(num(r.delayMs) ?? 0),
      ...(t.duration ? { duration: t.duration } : {}),
      ...(t.ease ? { ease: t.ease } : {}),
      once: "yes",
    });
  }
  for (const a of (b.intro as Rec[]) ?? []) {
    if (!a.part || a.folded) continue;
    const frames = Array.isArray(a.keyframes) ? (a.keyframes as Rec[]) : [];
    const first = writtenOf(frames[0]?.transform), last = writtenOf(frames.at(-1)?.transform);
    reveal(a.part, {
      ...direction(first.x - last.x, first.y - last.y),
      scale: str(last.k ? first.k / last.k : 1),
      delay: String(num(a.delay) ?? 0),
      duration: String(num(a.duration) ?? 700),
      ...(typeof a.easing === "string" ? { ease: a.easing } : {}),
      once: "yes",
      ...(loaderGoes ? { after: "loader" } : {}),
    });
  }

  /* The marquees: the page's own step a frame, at 60 frames a second. */
  for (const l of (b.loops as Rec[]) ?? []) {
    if (l.kind !== "marquee" || !l.part || l.folded) continue;
    const perFrame = num(l.perFrame);
    const speed = perFrame !== null ? perFrame * 60 : num(l.speed) ?? 60;
    give(l.part, { id: "marquee", inputs: { speed: String(Math.round(speed)), direction: l.direction === "right" ? "right" : "left", pause: "no", gap: "0" } });
  }

  /* Layers that follow the pointer and the scroll. */
  for (const p of (b.pointer as Rec[]) ?? []) {
    if (p.kind !== "move" || !p.part || p.folded) continue;
    give(p.part, { id: "follow-pointer", inputs: { how: "layer", x: String(num(p.perX) ?? 0), y: String(num(p.perY) ?? 0), scroll: String(num(p.perScroll) ?? 0) } });
  }

  /* A class the page's script put on once scrolled: a header's bar. */
  for (const s of (b.scrollClass as Rec[]) ?? []) {
    if (!s.part || s.folded) continue;
    const before = (s.before ?? {}) as Rec, after = (s.after ?? {}) as Rec;
    /* The page's own rule, when sink recorded it (`rules`): its fill, edge and padding as written; else the states either side (tests/header-bar-captured.mjs). */
    const rule = ((Array.isArray(s.rules) ? (s.rules as Rec[]) : []).find((r) => r && typeof r.style === "object")?.style ?? {}) as Rec;
    const said = (k: string) => (typeof rule[k] === "string" && String(rule[k]).trim() ? String(rule[k]).trim() : "");
    const fill = said("background") || said("background-color") || (after.background !== before.background ? String(after.background ?? "") : "");
    const edge = said("box-shadow") || (after.boxShadow !== before.boxShadow && after.boxShadow !== "none" ? String(after.boxShadow ?? "") : "");
    const padTop = said("padding-top") || (after.paddingTop !== before.paddingTop ? String(after.paddingTop ?? "") : "");
    const padBottom = said("padding-bottom") || (after.paddingBottom !== before.paddingBottom ? String(after.paddingBottom ?? "") : "");
    const padding = padTop || padBottom ? `${padTop || String(before.paddingTop ?? "")} ${padBottom || String(before.paddingBottom ?? "")}`.trim() : "";
    if (!fill && !edge && !padding) continue;
    const t = /background\s+(\d*\.?\d+)(ms|s)/.exec(String(s.transition ?? ""));
    /* Measured in 5 px steps: `at` is the first with it on, so the last without it is 5 px before. */
    const at = Math.max(0, (num(s.at) ?? 45) - 5);
    give(s.part, { id: "scroll-header", inputs: { at: String(at), background: fill, edge, ...(padding ? { padding } : {}), ...(t ? { duration: String(Math.round(Number(t[1]) * (t[2] === "s" ? 1000 : 1))) } : {}) } });
  }

  /* The lights: an idle loop taking the part to no opacity. The captured blink is handed over, so the switch stops it. */
  const frames = new Map<string, Rec[]>();
  for (const k of Array.isArray(keyframes) ? (keyframes as Rec[]) : []) if (typeof k.name === "string" && Array.isArray(k.frames)) frames.set(k.name, k.frames as Rec[]);
  const goesDark = (name: string) => (frames.get(name) ?? []).some((f) => { const o = num((f.style as Rec | undefined)?.opacity); return o !== null && o <= 0.05; });
  for (const i of (b.idle as Rec[]) ?? []) {
    if (!i.part || i.folded || i.pseudo || typeof i.name !== "string" || !goesDark(i.name)) continue;
    const n = byId.get(String(i.part));
    if (!n) continue;
    const anim = (n.motion?.animation ?? []).find((a) => a.name === i.name);
    const ms = num(i.duration) ?? (anim?.duration ? parseFloat(anim.duration) * (/ms$/.test(anim.duration) ? 1 : 1000) : 1000);
    give(n.id, { id: "blink", inputs: { every: str(ms / 1000), how: /steps/.test(anim?.timing ?? "steps") ? "steps" : "fade" } });
    if (n.motion?.animation) {
      const rest = n.motion.animation.filter((a) => a.name !== i.name);
      const { animation: _gone, ...m } = n.motion;
      void _gone;
      n.motion = rest.length ? { ...m, animation: rest } : m;
    }
    if (n.art?.animation === i.name) { const { animation: _a, ...art } = n.art; void _a; n.art = art; }
  }
  return out;
}
