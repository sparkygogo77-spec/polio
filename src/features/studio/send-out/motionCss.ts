/**
 * MOTION AS CSS, FOR A SITE FROM CODE.
 *
 * J (2026-10-10, polio/shelf-items-audit.md fix 3): an effect put on a
 * PonsStars part, or a whole-site motion switched on, reached the site only
 * as a polio/NEXT.md line for a code chat to build. Most of them are plain
 * CSS, so the style layer writes them itself, keyed by the part's data-hook:
 *
 *   · Lift on hover and Push on press: `:hover` / `:active` on the
 *     `translate`, `rotate` and `scale` properties (they add to any transform
 *     the page set). Push on press left at its defaults presses the way the
 *     site's own parts press (J: "stretch that over a new panel"): PST's
 *     buttons sink 3px and lose their shadow, so a panel given it does too.
 *   · Float, Spin, Blink and Switch on: keyframes, played on the part.
 *   · Reveal on scroll: a scroll-driven animation (`animation-timeline:
 *     view()`); where a browser has none it simply shows.
 *   · The whole-site switches CSS can carry: smooth scrolling, snap
 *     scrolling, appear on scroll (each panel, `[data-panel]`, with what it
 *     holds), the scroll progress bar, the opening fade, a picture cursor.
 *
 * What needs a script (Tilt following the pointer, back to top, depth
 * scrolling, the dot cursor, a burst) is still a NEXT.md line
 * (`codeAsks.ts`); `carriedEffect` / `carriedSite` say which, so the two
 * never both ask. Everything moving is held still for a visitor who asks
 * for less motion. Pure: no store, no React.
 */

export interface EffectUse { id: string; inputs?: Record<string, string>; off?: boolean }

export interface MotionRule { selector: string; declarations: string[] }

export interface MotionCss {
  /** Declarations for the part's own rule (a transition, an animation). */
  own: string[];
  /** Rules of their own: its `:hover`, its `:active`. */
  rules: MotionRule[];
  /** Keyframes, by name, to write once. */
  frames: Map<string, string>;
  /** The effects it wrote, by id. */
  done: string[];
}

const num = (v: string | undefined, d: number) => { const n = Number(v); return v === undefined || v === "" || !Number.isFinite(n) ? d : n; };
const px = (v: number) => `${Math.round(v * 100) / 100}px`;
const name = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").replace(/-+$/, "");
const EASE = /^[\w\s.,()-]+$/;

/** The effects the style layer writes as CSS. */
export const CSS_EFFECTS: ReadonlySet<string> = new Set(["hover-lift", "press-push", "float", "spin", "blink", "reveal", "switch-on"]);
/** The whole-site motions the style layer writes as CSS (a cursor only when it is a picture). */
export const CSS_SITE: ReadonlySet<string> = new Set(["smooth-scroll", "scroll-snap", "reveal-on-scroll", "scroll-progress", "page-load", "cursor-effects"]);

export const carriedEffect = (id: string) => CSS_EFFECTS.has(id);

/**
 * A PART YOU PRESS LOOKS PRESSABLE (J, 2026-10-10: "push on press works well
 * but it doesnt make the cursor the click hand"). Push on press is the
 * shelf's press effect with nothing else to do: the others already act on a
 * press (Show on press, Copy, Glide) and set their own cursor. A part wearing
 * it takes the pointing hand everywhere it runs, and is offered "When
 * pressed, go to" so the press can lead somewhere.
 */
type WorkLike = { id: string; off?: boolean; also?: { id: string; off?: boolean }[] } | null | undefined;
export const pushedOnPress = (work: WorkLike): boolean => !!work && [work, ...(work.also ?? [])].some((u) => u.id === "press-push" && !u.off);
export function carriedSite(featureId: string, options?: Record<string, string> | null): boolean {
  if (featureId === "cursor-effects") return options?.style === "picture" && /^data:image\//.test(options?.picture ?? "");
  if (featureId === "smooth-scroll") return (options?.strength ?? "light") !== "off";
  return CSS_SITE.has(featureId);
}

/**
 * The site's own press, as its parts wear it (`source.was.states.active`):
 * the one most of them share, kept to what moves (transform, translate,
 * scale, rotate, box-shadow, filter). Null when the site presses nothing.
 */
export function sitePress(states: readonly (Record<string, string> | undefined)[]): string[] | null {
  const count = new Map<string, number>();
  for (const s of states) {
    const a = s?.active;
    if (!a) continue;
    const moving = [...new Map(a.split(/;(?![^(]*\))/).map((d) => d.trim()).filter(Boolean).map((d) => [d.slice(0, d.indexOf(":")).trim(), d] as const))]
      .filter(([k]) => /^(transform|translate|scale|rotate|box-shadow|filter)$/.test(k)).map(([, d]) => d.replace(/\s*:\s*/, ": "));
    if (!moving.length) continue;
    const key = moving.join("; ");
    count.set(key, (count.get(key) ?? 0) + 1);
  }
  const best = [...count].sort((a, b) => b[1] - a[1])[0];
  return best && best[1] >= 2 ? best[0].split("; ") : null;
}

/** An effect's CSS on one part (`sel`, its hook's selector). */
export function effectCss(sel: string, uses: readonly EffectUse[], o: { press?: string[] | null } = {}): MotionCss {
  const out: MotionCss = { own: [], rules: [], frames: new Map(), done: [] };
  const anims: string[] = [];
  /* Which of `anims` follow the scroll (Reveal); the rest keep time, so a float beside a reveal still bobs. */
  const scrolled = new Set<number>();
  const trans: string[] = [];
  /*
   * A float on a part that also lifts or pushes adds to its `translate`
   * instead of owning it: an animation outranks `:hover` / `:active`, so the
   * lift and the push would only move the float's resting point (audit
   * 2026-10-11). Alone it still replaces, as it always has.
   */
  const moved = uses.some((u) => !u.off && (u.id === "hover-lift" || u.id === "press-push"));
  const adds = new Set<number>();
  for (const u of uses) {
    if (u.off || !CSS_EFFECTS.has(u.id)) continue;
    const i = u.inputs ?? {};
    if (u.id === "hover-lift") {
      const lift = num(i.lift, 4), x = num(i.x, 0), turn = num(i.turn, 0), k = num(i.scale, 1), ms = Math.max(0, num(i.pace, 200));
      trans.push(`translate ${ms}ms ease`, `rotate ${ms}ms ease`, `scale ${ms}ms ease`);
      out.rules.push({ selector: `${sel}:hover`, declarations: [`translate: ${px(x)} ${px(-lift)}`, ...(turn ? [`rotate: ${turn}deg`] : []), ...(k !== 1 ? [`scale: ${k}`] : [])] });
    } else if (u.id === "press-push") {
      out.own.push("cursor: pointer");
      const set = Object.values(i).some((v) => v !== "" && v !== undefined);
      const ms = Math.max(0, num(i.pace, 80));
      if (!set && o.press?.length) {
        /* Left at its defaults: pressed the way the site's own parts press. */
        trans.push(`transform ${ms}ms ease`, `translate ${ms}ms ease`, `box-shadow ${ms}ms ease`);
        out.rules.push({ selector: `${sel}:active`, declarations: [...o.press] });
      } else {
        const down = num(i.down, 2), x = num(i.x, 0), k = num(i.scale, 1), sh = String(i.shadow ?? "").trim();
        trans.push(`translate ${ms}ms ease`, `scale ${ms}ms ease`, `box-shadow ${ms}ms ease`);
        out.rules.push({ selector: `${sel}:active`, declarations: [`translate: ${px(x)} ${px(down)}`, ...(k !== 1 ? [`scale: ${k}`] : []), ...(sh && !/[;{}]/.test(sh) ? [`box-shadow: ${sh}`] : [])] });
      }
    } else if (u.id === "float") {
      const d = num(i.travel, 12), t = Math.max(0.1, num(i.period, 6)), sign = i.toward === "+" ? 1 : -1, axis = i.axis === "x" ? "x" : "y";
      const ease = EASE.test(i.ease ?? "") ? i.ease! : "ease-in-out";
      const far = px(sign * d), f = name(`pb-float-${axis}-${sign * d}${moved ? "-add" : ""}`);
      out.frames.set(f, `@keyframes ${f} {\n${moved ? "  0%, 100% { translate: 0px 0px; }\n" : ""}  50% { translate: ${axis === "x" ? `${far} 0px` : `0px ${far}`}; }\n}`);
      if (moved) adds.add(anims.length);
      anims.push(`${f} ${t}s ${ease} infinite`);
    } else if (u.id === "spin") {
      const t = Math.max(0.1, num(i.period, 20)), f = i.direction === "ccw" ? "pb-spin-ccw" : "pb-spin-cw";
      out.frames.set(f, `@keyframes ${f} {\n  to { rotate: ${f.endsWith("ccw") ? "-" : ""}360deg; }\n}`);
      anims.push(`${f} ${t}s linear infinite`);
    } else if (u.id === "blink") {
      const t = Math.max(0.1, num(i.every, 1));
      if (i.css && EASE.test(i.css)) { anims.push(i.css); }
      else if (i.how === "fade") { out.frames.set("pb-blink-fade", "@keyframes pb-blink-fade {\n  50% { opacity: 0; }\n}"); anims.push(`pb-blink-fade ${t}s ease-in-out infinite`); }
      else { out.frames.set("pb-blink", "@keyframes pb-blink {\n  50% { opacity: 0; }\n}"); anims.push(`pb-blink ${t}s step-end infinite`); }
    } else if (u.id === "reveal") {
      const d = Math.max(0, num(i.distance, 32)), dir = i.direction || "up", k = num(i.scale, 1);
      const from = dir === "up" ? `0px ${px(d)}` : dir === "down" ? `0px ${px(-d)}` : dir === "left" ? `${px(d)} 0px` : dir === "right" ? `${px(-d)} 0px` : "0px 0px";
      const f = name(`pb-reveal-${dir}-${d}${k !== 1 ? `-s${k}` : ""}`);
      out.frames.set(f, `@keyframes ${f} {\n  from { opacity: 0; translate: ${from};${k !== 1 ? ` scale: ${k};` : ""} }\n}`);
      scrolled.add(anims.length);
      anims.push(`${f} linear both`);
    } else if (u.id === "switch-on") {
      out.frames.set("pb-switch-on", "@keyframes pb-switch-on {\n  0% { scale: 1 0.02; filter: brightness(3); opacity: 0.6; }\n  45% { scale: 1 1; filter: brightness(1.8); opacity: 1; }\n  100% { filter: none; }\n}");
      anims.push("pb-switch-on 0.9s cubic-bezier(.2,.8,.2,1) both");
    }
    out.done.push(u.id);
  }
  if (trans.length) out.own.push(`transition: ${[...new Set(trans)].join(", ")}`);
  /* The timeline names come after the shorthand, which would reset them: one per animation, in its order. */
  if (scrolled.size) {
    const each = (v: string, t: string) => anims.map((_, k) => (scrolled.has(k) ? v : t)).join(", ");
    out.own.push(`animation-timeline: ${each("view()", "auto")}`, `animation-range: ${each("entry 0% entry 60%", "normal")}`);
  }
  if (anims.length) out.own.unshift(`animation: ${anims.join(", ")}`);
  if (adds.size) out.own.push(`animation-composition: ${anims.map((_, j) => (adds.has(j) ? "add" : "replace")).join(", ")}`);
  return out;
}

/** The whole-site motions that are on (`featureId` and the part's options), as CSS for the site. */
export function siteCss(on: readonly { featureId: string; options?: Record<string, string> | null }[], o: { accent?: string } = {}): { rules: MotionRule[]; tail: string[]; done: string[] } {
  const rules: MotionRule[] = [];
  const tail: string[] = [];
  const done: string[] = [];
  const seen = new Set<string>();
  for (const s of on) {
    if (seen.has(s.featureId) || !carriedSite(s.featureId, s.options)) continue;
    seen.add(s.featureId);
    const opt = s.options ?? {};
    if (s.featureId === "smooth-scroll") rules.push({ selector: ":root", declarations: ["scroll-behavior: smooth"] });
    if (s.featureId === "scroll-snap") {
      rules.push({ selector: ":root", declarations: [`scroll-snap-type: ${opt.axis === "horizontal" ? "x" : "y"} proximity`] });
      rules.push({ selector: "[data-region]", declarations: ["scroll-snap-align: start"] });
    }
    if (s.featureId === "reveal-on-scroll") {
      /* Each panel with everything it holds: the page's own nesting moves them as one. */
      tail.push("@keyframes pb-site-reveal {\n  from { opacity: 0; translate: 0px 24px; }\n}", "@supports (animation-timeline: view()) {\n  [data-panel] { animation: pb-site-reveal linear both; animation-timeline: view(); animation-range: entry 0% entry 50%; }\n}");
    }
    if (s.featureId === "scroll-progress") {
      tail.push("@keyframes pb-progress {\n  from { scale: 0 1; }\n  to { scale: 1 1; }\n}", `@supports (animation-timeline: scroll()) {\n  body::before { content: ""; position: fixed; inset: 0 0 auto 0; height: 3px; --builder-progress: ${o.accent && /^[#\w(),.%\s-]+$/.test(o.accent) ? o.accent : "currentColor"}; background: var(--builder-progress); transform-origin: 0 50%; z-index: 2147483647; pointer-events: none; animation: pb-progress linear both; animation-timeline: scroll(root); }\n}`);
    }
    if (s.featureId === "page-load") {
      tail.push("@keyframes pb-open {\n  from { opacity: 0; }\n}");
      rules.push({ selector: "body", declarations: ["animation: pb-open 0.6s ease-out both"] });
    }
    if (s.featureId === "cursor-effects") rules.push({ selector: ":root", declarations: [`cursor: url("${opt.picture!.replace(/"/g, "%22")}") 0 0, auto`] });
    done.push(s.featureId);
  }
  return { rules, tail, done };
}

/** Everything moving, still for a visitor who asks for less motion. */
export function stillTail(selectors: readonly string[]): string[] {
  const all = [...new Set(selectors)];
  if (!all.length) return [];
  return ["@media (prefers-reduced-motion: reduce) {", `  ${all.join(", ")} { animation: none !important; transition: none !important; }`, "}"];
}
