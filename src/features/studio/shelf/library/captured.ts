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
import { usesOf, withWork, type WorkUse } from "./works.ts";

type Rec = Record<string, unknown>;
interface Node {
  id: string;
  pageId?: string;
  featureId?: string;
  data?: string;
  x?: number; y?: number; w?: number; h?: number;
  from?: { selector?: string } | null;
  art?: Rec | null;
  motion?: { animation?: { name?: string; duration?: string; timing?: string; delay?: string; iterations?: string; direction?: string; fill?: string }[] } & Rec;
  link?: { kind?: string; target?: string } | null;
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

/** A captured animation as one `animation` value under the name its keyframes are written by (`cap-<name>`, parts/capturedMotion.ts); null when anything in it is not a plain value. */
function capturedAnimation(a: { name?: string; duration?: string; timing?: string; delay?: string; iterations?: string; direction?: string; fill?: string }): string | null {
  if (!a.name || !/^[A-Za-z_][\w-]{0,63}$/.test(a.name)) return null;
  const rest = [a.duration, a.timing, a.delay, a.iterations, a.direction, a.fill].filter((v): v is string => typeof v === "string" && v.trim() !== "");
  if (rest.some((v) => !/^[\w\s().,%-]+$/.test(v))) return null;
  return [...rest, `cap-${a.name}`].join(" ");
}

/**
 * The nodes with what their page's script did attached. `keyframes` is the
 * document's `@keyframes`, to tell a blink (a light taken to nothing and
 * back) from any other loop.
 */
export function attachCaptured<N extends Node>(nodes: readonly N[], behaviours: unknown, keyframes?: unknown): N[] {
  const b = behaviours as Rec | null;
  const out = nodes.map((n) => ({ ...n }));
  const byId = new Map(out.map((n) => [n.id, n]));
  /* What the document already says of a feature (the owner's ribbons: "Centre in its band", a text size) stands over what the capture says of it. */
  const give = (id: unknown, use: WorkUse) => {
    const n = typeof id === "string" ? byId.get(id) : undefined;
    const had = n ? usesOf(n.work).find((u) => u.id === use.id) : undefined;
    if (n) n.work = withWork(n.work, had ? { ...use, inputs: { ...(use.inputs ?? {}), ...had.inputs }, ...(had.off ? { off: true } : {}) } : use);
    return !!n;
  };
  /* ---------------------------------------------------------------- a canvas that followed the scroll (the capturer's `depths`, carried on the picture itself: sunkcoin.fun's sea and minimap) */
  for (const n of out) {
    const d = (n as { picture?: { depths?: { bands?: number } | null } | null }).picture?.depths;
    if (d && typeof d.bands === "number" && d.bands > 1) give(n.id, { id: "scroll-depths", inputs: { bands: String(d.bands) } });
  }
  if (!b || typeof b !== "object" || b.version !== 1) return out;
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
    /* When it switched off from the navigation's start (sink `loader.nav.off`): the moment the page showed through on the original, on a visitor's clock. */
    const at = num((loader.nav as Rec | undefined)?.off);
    if (host) give(host.id, { id: "crt-loader", inputs: {
      title: String(loader.title ?? ""), ticker: String(loader.ticker ?? ""),
      channel: String(loader.channel ?? ""), label: String(loader.label ?? ""),
      ...(off ? { hold: String(round(off / 1000, 10)) } : {}),
      ...(at && at > 0 ? { at: String(round(at / 1000, 100)) } : {}),
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
    /* Stepped by the page every frame (sink `clock: "frame"`, told apart by sampling at two frame rates): so much a frame here too, so a 144 Hz screen runs it as fast as the original did there. */
    const step: Record<string, string> = l.clock === "frame" && perFrame ? { step: str(perFrame) } : {};
    /* A stylesheet marquee (capture-to-document.mjs `cssMarquee`): the gap its row set between its words is the gap between loops too. */
    give(l.part, { id: "marquee", inputs: { speed: String(Math.round(speed)), ...step, direction: l.direction === "right" ? "right" : "left", pause: "no", gap: String(Math.max(0, num(l.gap) ?? 0)) } });
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
    /* The parts the header holds are parts of their own (its logo, nav pill, buttons): named, so the bar carries them as its padding closes. */
    const hd = byId.get(String(s.part));
    const parts = padding && hd ? inside(hd).map((k) => k.id).join(",") : "";
    give(s.part, { id: "scroll-header", inputs: { at: String(at), background: fill, edge, ...(padding ? { padding } : {}), ...(parts ? { parts } : {}), ...(t ? { duration: String(Math.round(Number(t[1]) * (t[2] === "s" ? 1000 : 1))) } : {}) } });
  }

  /* The lights: an idle loop taking the part to no opacity. The captured blink is handed over, so the switch stops it. */
  const frames = new Map<string, Rec[]>();
  for (const k of Array.isArray(keyframes) ? (keyframes as Rec[]) : []) if (typeof k.name === "string" && Array.isArray(k.frames)) frames.set(k.name, k.frames as Rec[]);
  /* The loops handed to a feature, by part: their stops are still the rule's (below). */
  const handed = new Map<string, string[]>();
  const goesDark = (name: string) => (frames.get(name) ?? []).some((f) => { const o = num((f.style as Rec | undefined)?.opacity); return o !== null && o <= 0.05; });
  for (const i of (b.idle as Rec[]) ?? []) {
    if (!i.part || i.folded || i.pseudo || typeof i.name !== "string" || !goesDark(i.name)) continue;
    const n = byId.get(String(i.part));
    if (!n) continue;
    const anim = (n.motion?.animation ?? []).find((a) => a.name === i.name);
    const ms = num(i.duration) ?? (anim?.duration ? parseFloat(anim.duration) * (/ms$/.test(anim.duration) ? 1 : 1000) : 1000);
    /* The page's own animation, every longhand, over its own keyframes: a `steps(2)` over one 50% stop is three stages, not two (library/behaviours.ts, BLINK). */
    const css = anim ? capturedAnimation(anim) : null;
    give(n.id, { id: "blink", inputs: { every: str(ms / 1000), how: /steps/.test(anim?.timing ?? "steps") ? "steps" : "fade", ...(css ? { css } : {}) } });
    handed.set(n.id, [...(handed.get(n.id) ?? []), i.name]);
    if (n.motion?.animation) {
      const rest = n.motion.animation.filter((a) => a.name !== i.name);
      const { animation: _gone, ...m } = n.motion;
      void _gone;
      n.motion = rest.length ? { ...m, animation: rest } : m;
    }
    if (n.art?.animation === i.name) { const { animation: _a, ...art } = n.art; void _a; n.art = art; }
  }

  /*
   * A LOOP'S STOPS ARE THE RULE'S, NOT THE MOMENT'S. A keyframe rule with no
   * 0% or 100% of its own (`blink`, `50% { opacity: 0 }`) starts from and
   * returns to the element's own opacity, and the part's captured opacity is
   * drawn on its box. A light read while its blink held it dark came in at 0
   * (the remote's LED): drawn so, every stop of its blink was 0 and it never
   * showed. So a part running a loop that takes its opacity somewhere with an
   * open end keeps no captured opacity: what it starts from is the element's
   * own, as the page's rule says, and a value read mid-loop is the loop's.
   */
  {
    const open = (name: string) => {
      const fr = frames.get(name) ?? [];
      const keys = fr.flatMap((f) => String(f.key ?? "").split(",").map((k) => k.trim())).map((k) => (k === "from" ? "0%" : k === "to" ? "100%" : k));
      return fr.some((f) => (f.style as Rec | undefined)?.opacity !== undefined) && (!keys.includes("0%") || !keys.includes("100%"));
    };
    for (const n of out) {
      const names = [...(n.motion?.animation ?? []).map((a) => a.name ?? ""), ...(handed.get(n.id) ?? [])];
      if (typeof (n as { opacity?: unknown }).opacity === "number" && names.some(open)) delete (n as { opacity?: unknown }).opacity;
    }
  }

  /* ---------------------------------------------------------------- what a press shows (sink `behaviours.states`) */
  for (const st of Array.isArray(b.states) ? (b.states as Rec[]) : []) {
    const shows = (Array.isArray(st.shows) ? st.shows : []).filter((id) => typeof id === "string" && byId.has(id)) as string[];
    const hides = (Array.isArray(st.hides) ? st.hides : []).filter((id) => typeof id === "string" && byId.has(id)) as string[];
    if (!shows.length || typeof st.part !== "string") continue;
    /* What it flashed (sink presses.mjs): each part's time and where it came in from. */
    const timing = (Array.isArray(st.timing) ? (st.timing as Rec[]) : []).filter((t) => typeof t.part === "string" && byId.has(t.part)).map((t) => {
      const from = t.from && typeof t.from === "object" ? (t.from as Rec) : null;
      const f = from ? Object.fromEntries(["x", "y", "opacity"].map((k) => [k, num(from[k])]).filter(([, v]) => v !== null)) : null;
      return { part: t.part as string, ...(num(t.lasts) !== null ? { lasts: num(t.lasts)! } : {}), ...(f && Object.keys(f).length ? { from: f } : {}) };
    });
    give(st.part, { id: "press-shows", inputs: { shows: shows.join(","), hides: hides.join(","), group: String(st.group ?? ""), ...(st.opening === true ? { opening: "yes" } : {}), ...(timing.length ? { timing: JSON.stringify(timing) } : {}) } });
  }

  /* ---------------------------------------------------------------- what a press copied (sink `behaviours.presses`) */
  /* The copy itself; quiet where the page's own flash was captured, which then says it (a "COPIED!", a toast), not a toast of the library's. */
  const flashes = new Set((Array.isArray(b.states) ? (b.states as Rec[]) : []).filter((st) => Array.isArray(st.timing) && st.timing.length).map((st) => String(st.part)));
  for (const c of Array.isArray(b.presses) ? (b.presses as Rec[]) : []) {
    if (c.does !== "copy" || typeof c.part !== "string" || typeof c.copy !== "string" || !byId.has(c.part)) continue;
    give(c.part, { id: "copy-toast", inputs: { text: c.copy, ...(flashes.has(c.part) ? { quiet: "yes" } : {}) } });
  }

  /* ---------------------------------------------------------------- how a link goes to its place (sink `behaviours.glide`) */
  const g = b.glide && typeof b.glide === "object" ? (b.glide as Rec) : null;
  if (g && (g.how === "script" || g.how === "css")) {
    const ms = (g.ms && typeof g.ms === "object" ? g.ms : {}) as Rec;
    const curve = Array.isArray(g.curve) ? (g.curve as unknown[]).map(num).filter((v): v is number => v !== null) : [];
    const inputs: Record<string, string> = g.how === "css" ? { how: "css" } : {
      how: "script",
      base: str(num(ms.base) ?? 600), perPx: str(num(ms.perPx) ?? 0),
      ...(num(ms.max) ? { max: str(num(ms.max)!) } : {}),
      ease: typeof g.ease === "string" ? g.ease : curve.length > 2 ? "measured" : "ease-in-out-cubic",
      ...(curve.length > 2 && typeof g.ease !== "string" ? { curve: curve.join(",") } : {}),
      offset: str(num(g.offset) ?? 0),
    };
    for (const n of out) if (n.link?.kind === "node" && typeof n.link.target === "string" && byId.has(n.link.target)) give(n.id, { id: "glide", inputs: { to: n.link.target, ...inputs } });
  }

  /* ---------------------------------------------------------------- a canvas world's characters (sink `behaviours.worlds`, the part's `world`) */
  for (const w of Array.isArray(b.worlds) ? (b.worlds as Rec[]) : []) {
    const n = typeof w.part === "string" ? byId.get(w.part) : undefined;
    if (n && (n as { world?: unknown }).world) give(n.id, { id: "world-dialogs", inputs: {} });
  }

  /* ---------------------------------------------------------------- motion sampled (sink `behaviours.motion`) */
  const M = (b.motion ?? null) as Rec | null;
  if (M && typeof M === "object") {
    const list = (k: string) => (Array.isArray(M[k]) ? (M[k] as Rec[]) : []);
    /** A stylesheet's own loop the part already carries (captured CSS, played as it was): not given twice. */
    const plays = (n: Node, name: unknown) => typeof name === "string" && ((n.motion?.animation ?? []).some((a) => a.name === name) || n.art?.animation === name);
    const ms = (v: unknown) => transitionOf(v).duration;

    /* A spin, a float: the page's script did it, or its stylesheet did and the part does not carry it. */
    for (const sp of list("spin")) {
      const n = typeof sp.part === "string" ? byId.get(sp.part) : undefined;
      if (!n || sp.folded || (sp.via === "css" && plays(n, sp.name))) continue;
      const period = num(sp.period);
      if (!period) continue;
      give(n.id, { id: "spin", inputs: { period: str(period / 1000), direction: sp.direction === "ccw" ? "ccw" : "cw" } });
    }
    for (const f of list("float")) {
      const n = typeof f.part === "string" ? byId.get(f.part) : undefined;
      if (!n || f.folded || (f.via === "css" && plays(n, f.name))) continue;
      const travel = num(f.travel), period = num(f.period);
      if (!travel || !period) continue;
      give(n.id, { id: "float", inputs: { travel: str(travel), period: str(period / 1000), axis: f.axis === "x" ? "x" : "y", toward: f.toward === "+" ? "+" : "-", ...(typeof f.easing === "string" && !/steps/.test(f.easing) ? { ease: f.easing } : {}) } });
    }

    /* Under the pointer: a tilt the page's script made (the TV, the cards), carrying the parts on it; a lift its script made. A stylesheet's :hover is carried as captured CSS already. */
    for (const h of list("hover")) {
      const n = typeof h.part === "string" ? byId.get(h.part) : undefined;
      if (!n || h.folded || h.via !== "script") continue;
      if (h.kind === "tilt") {
        const parts = inside(n).map((k) => k.id).join(",");
        const area = typeof h.host === "string" && h.host !== n.id && byId.has(h.host) ? h.host : "";
        const pace = ms(h.pace);
        give(n.id, { id: "tilt", inputs: {
          mode: "mouse", axis: "both",
          across: str(num(h.across) ?? 20), down: str(num(h.down) ?? 20),
          lift: str(num(h.lift) ?? 0), depth: str(num(h.depth) ?? 0),
          ...(num(h.perspective) ? { perspective: String(num(h.perspective)) } : {}),
          ...(pace ? { pace } : {}),
          ...(parts ? { parts } : {}), ...(area ? { area } : {}),
        } });
      } else if (h.kind === "lift") {
        const pace = ms(h.pace);
        give(n.id, { id: "hover-lift", inputs: { lift: str(num(h.lift) ?? 0), x: str(num(h.x) ?? 0), turn: str(num(h.turn) ?? 0), scale: str(num(h.scale) ?? 1), ...(pace ? { pace } : {}) } });
      }
    }

    /* A marquee the scroll hurries: its own step, plus the scroll's pace times the boost, to the cap. */
    for (const q of list("scrollSpeed")) {
      const n = typeof q.part === "string" ? byId.get(q.part) : undefined;
      if (!n || q.folded) continue;
      const boost = num(q.perScroll), cap = num(q.max), base = num(q.base);
      if (!boost) continue;
      const had = usesOf(n.work).find((u) => u.id === "marquee");
      const inputs = { ...(had?.inputs ?? { speed: String(Math.round((base ?? 0.6) * 60)), direction: "left", pause: "no", gap: "0" }), boost: str(boost), ...(cap !== null ? { cap: str(cap) } : {}) };
      n.work = withWork(n.work, { id: "marquee", inputs, ...(had?.off ? { off: true } : {}) });
    }

    /* A line the scroll grows. */
    for (const g of list("scrollGrow")) {
      const n = typeof g.part === "string" ? byId.get(g.part) : undefined;
      if (!n || g.folded) continue;
      give(n.id, { id: "scroll-grow", inputs: { prop: g.prop === "height" ? "height" : "width", start: str(num(g.start) ?? 0.9), end: str(num(g.end) ?? 0.2), from: str(num(g.from) ?? 0), to: str(num(g.to) ?? 100), ...(num(g.kept) ? { kept: str(num(g.kept)!) } : {}) } });
    }

    /* A canvas the page repaints with specks: no part of its own, so a layer is made at its box, painted where it was (just over the part below it), carrying Dust. */
    let k = 0;
    for (const c of list("canvases")) {
      if (c.kind !== "particles") continue;
      const box = Array.isArray(c.box) ? (c.box as unknown[]).map(num) : [];
      if (box.length !== 4 || box.some((v) => v === null)) continue;
      const below = typeof c.below === "string" ? byId.get(c.below) : undefined;
      const above = typeof c.above === "string" ? byId.get(c.above) : undefined;
      const host = typeof c.host === "string" ? byId.get(c.host) : undefined;
      const ref = below ?? above ?? host ?? out[0];
      if (!ref) continue;
      const id = `n_dust_${++k}`;
      if (byId.has(id)) continue;
      const [x, y, w, h] = box as number[];
      const speed = num(c.perFrame);
      /* A bare box, every field a new part has and nothing of the part beside it: it draws nothing of its own, and takes no press. */
      const layer = {
        id, pageId: ref.pageId, featureId: "box", label: "Dust (a canvas the page repainted)",
        prompt: "A layer of specks drifting over the page, drawn on a canvas by the page's script: the Dust feature draws it here.",
        content: "", data: "", x, y, w, h, groupId: null, options: {}, priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null,
        colour: null, font: null, anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", shape: null, outline: null, kind: null, vector: null, role: null,
        cube: null, mesh: null, code: null, aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null, art: null, work: null,
        from: { ...(ref.from ?? {}), selector: typeof c.selector === "string" ? c.selector : `${ref.from?.selector ?? ""} ~ canvas` },
        inert: true,
      } as unknown as N;
      layer.work = withWork(null, { id: "dust-canvas", inputs: {
        ...(Array.isArray(c.colours) && c.colours.length ? { colours: (c.colours as unknown[]).map(String).join(", ") } : {}),
        ...(num(c.spacing) ? { spacing: str(num(c.spacing)!) } : {}),
        /* The feature's specks rise 0.275 px a frame on average at speed 1. */
        ...(speed ? { speed: str(round(speed / 0.275, 100)) } : {}),
        ...(num(c.size) ? { size: str(num(c.size)!) } : {}),
        direction: c.drift === "down" ? "down" : "up",
      } });
      const at = below ? out.indexOf(below as N) + 1 : above ? out.indexOf(above as N) : host ? out.indexOf(host as N) + 1 : out.length;
      out.splice(Math.max(0, at), 0, layer);
      byId.set(id, layer);
    }
  }
  return out;
}
