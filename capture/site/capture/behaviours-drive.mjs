/**
 * Driving the page to see what its scripts do (`--behaviours` on
 * capture-route.mjs). `behaviours-recorder.js`, injected before the page's
 * scripts, has been watching since the page opened (the loader, the
 * `animate()` calls, every class its script changed); this moves the
 * pointer and the scroll the way a visitor would and measures what moved:
 *
 *   idle      at the top, the pointer never moved: an element whose inline
 *             transform changes on its own is a loop (a marquee: its speed
 *             and direction measured over a second and a half); every CSS
 *             animation running forever is listed (a blink, a scanline);
 *   pointer   the pointer at two places in the window, held long enough for
 *             an eased follow to arrive: an element whose inline transform
 *             differs between them moves with the pointer (its factor per
 *             layer, px per whole window) or turns toward it;
 *   scroll    down in 5px steps to 120px (where a header changes), then half
 *             a window at a time to the bottom and back to the top: a class
 *             the script added as the page scrolled is a reveal (kept) or a
 *             scrolled state (taken off again at the top), with the styles
 *             before and after; a layer that moved with the pointer is
 *             measured again 200px down, for its factor per px of scroll.
 *
 * Returns the capture's `behaviours` section, every element named by the
 * recorder's id (`b<n>`), which `mark()` then writes on the element for the
 * dump to carry as `bh`. Nothing here changes the page.
 */

import { idleMotion, hoverMotion, scrollMotion } from "./motion-drive.mjs";

const P1 = [0.25, 0.3], P2 = [0.75, 0.55];

export async function driveBehaviours(page, { shots = null, shot = async () => {} } = {}) {
  const wait = (ms) => page.waitForTimeout(ms);
  const vw = page.viewportSize();
  await page.evaluate(() => scrollTo(0, 0));
  /* The loader, if one stood, is gone before anything is measured. */
  for (let i = 0; i < 60; i++) {
    const standing = await page.evaluate(() => (window.__sinkBehaviours?.loaders ?? []).some((l) => l.gone === null && l.hidden === null));
    if (!standing) break;
    await wait(250);
  }
  await wait(600);
  await page.evaluate(() => window.__sinkBehaviours.phase("idle"));
  if (shots) await shot("idle");

  /* ------------------------------------------------------------ idle */
  const idle = await page.evaluate(async () => {
    const B = window.__sinkBehaviours;
    const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
    const inline = () => new Map(Array.from(document.body.querySelectorAll("*")).map((el) => [el, el.style?.transform ?? ""]));
    const a = inline(); await new Promise((r) => setTimeout(r, 250)); const b = inline();
    const moving = [...b].filter(([el, t]) => t && t !== a.get(el)).map(([el]) => el);
    const xOf = (el) => { try { return new DOMMatrix(el.style.transform).m41; } catch { return NaN; } };
    const yOf = (el) => { try { return new DOMMatrix(el.style.transform).m42; } catch { return NaN; } };
    /*
     * Sampled at two frame rates: the page's own, and again with every frame
     * held about 30 ms longer (a busy frame of ours). A loop the page steps
     * by so much a frame (trumpmorty.fun's ribbons: 0.6 px) keeps its step
     * and halves its speed; one timed by the clock (a CSS or Web Animation,
     * a script reading performance.now) keeps its speed. A 144 Hz screen
     * runs the first kind more than twice as fast as a 60 Hz one.
     */
    const sampleAll = async (ms, hold) => {
      const out = moving.map(() => []);
      const t0 = performance.now();
      while (performance.now() - t0 < ms) {
        await frame();
        const t = performance.now();
        moving.forEach((el, i) => out[i].push([t, xOf(el), yOf(el)]));
        if (hold) { const until = performance.now() + hold; while (performance.now() < until) { /* a long frame */ } }
      }
      return out;
    };
    const samples = await sampleAll(1500, 0);
    const slowed = await sampleAll(1500, 30);
    const median = (xs) => { const s = [...xs].sort((p, q) => p - q); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
    /** Distance a frame and a second, the wrap left out. */
    const rateOf = (s) => {
      const steps = [];
      for (let k = 1; k < s.length; k++) steps.push({ dt: s[k][0] - s[k - 1][0], d: Math.hypot(s[k][1] - s[k - 1][1], s[k][2] - s[k - 1][2]) });
      const m = median(steps.map((q) => q.d));
      const kept = steps.filter((q) => q.d <= Math.max(1, m * 5));
      const d = kept.reduce((n, q) => n + q.d, 0), dt = kept.reduce((n, q) => n + q.dt, 0);
      return kept.length && dt ? { perFrame: d / kept.length, perSecond: d / dt * 1000, fps: kept.length / dt * 1000 } : null;
    };
    const loops = [];
    moving.forEach((el, i) => {
      const s = samples[i];
      const steps = [];
      for (let k = 1; k < s.length; k++) steps.push({ dt: s[k][0] - s[k - 1][0], dx: s[k][1] - s[k - 1][1], dy: s[k][2] - s[k - 1][2] });
      const m = Math.abs(median(steps.map((q) => q.dx)));
      /* A step that jumps back by a whole loop is the wrap, not the speed. */
      const kept = steps.filter((q) => Math.abs(q.dx) <= Math.max(1, m * 5));
      const dx = kept.reduce((n, q) => n + q.dx, 0), dy = kept.reduce((n, q) => n + q.dy, 0), dt = kept.reduce((n, q) => n + q.dt, 0);
      if (!dt) return;
      const speed = Math.hypot(dx, dy) / dt * 1000;
      if (speed < 2) return;
      /* The words written k times over: the loop is one k-th of the track. */
      const text = (el.textContent ?? "").trim();
      let copies = 1;
      for (let k = 8; k >= 2; k--) { const n = text.length / k; if (Number.isInteger(n) && n > 0 && text === text.slice(0, n).repeat(k)) { copies = k; break; } }
      if (copies === 1) { const raw = el.textContent ?? ""; for (let k = 8; k >= 2; k--) { const n = raw.length / k; if (Number.isInteger(n) && n > 0 && raw === raw.slice(0, n).repeat(k)) { copies = k; break; } } }
      /* The page moves it by so much a frame: the rate its frames came at here is said beside it, so the speed on a 60 Hz screen can be worked out. */
      const fps = kept.length / dt * 1000;
      /* Which clock moves it: the step a frame held at both rates, or the speed. Said only when the two rates were far enough apart to tell. */
      const r1 = rateOf(s), r2 = rateOf(slowed[i]);
      let clock = null;
      if (r1 && r2 && r1.fps / r2.fps > 1.4) {
        const frameErr = Math.abs(r2.perFrame - r1.perFrame) / r1.perFrame, timeErr = Math.abs(r2.perSecond - r1.perSecond) / r1.perSecond;
        clock = frameErr < 0.15 && frameErr < timeErr ? "frame" : timeErr < 0.15 && timeErr < frameErr ? "time" : null;
      }
      const at2 = r2 ? { fps: Math.round(r2.fps), perFrame: Math.round(r2.perFrame * 1000) / 1000, speed: Math.round(r2.perSecond * 10) / 10 } : null;
      loops.push({ el: B.idOf(el), ...(clock ? { clock } : {}), ...(at2 ? { slowed: at2 } : {}), kind: Math.abs(dx) >= Math.abs(dy) ? "marquee" : "drift", speed: Math.round(speed * 10) / 10, fps: Math.round(fps), perFrame: Math.round(Math.hypot(dx, dy) / kept.length * 1000) / 1000, direction: Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? "left" : "right") : (dy < 0 ? "up" : "down"), copies, width: Math.round(el.scrollWidth), loopWidth: Math.round(el.scrollWidth / copies), sample: el.style.transform });
    });
    const forever = [];
    for (const an of document.getAnimations()) {
      const t = an.effect?.getTiming?.(), target = an.effect?.target;
      if (!t || t.iterations !== Infinity || !target) continue;
      const pseudo = an.effect.pseudoElement ?? null;
      forever.push({ el: B.idOf(target), pseudo, name: an.animationName ?? null, css: !!an.animationName, duration: t.duration, easing: t.easing, delay: t.delay, direction: t.direction });
    }
    window.__sinkIdleLoops = loops.map((l) => l.el);
    return { loops, forever };
  });

  /* What else moves at rest, sampled as drawn (motion-drive.mjs): spins, floats, canvases repainted. */
  /*
   * A drift up or down, read over 1.5 s, may be half a bob: a moon a script
   * bobs every 5 s, sampled while it rose, read as a drift and was never
   * sampled again. Only a marquee is left out here; a drift the longer read
   * finds coming back is a float, not a loop (check-motion-sample.mjs).
   */
  const still = await idleMotion(page, { skip: idle.loops.filter((l) => l.kind === "marquee").map((l) => l.el) });
  {
    const floats = new Set((still?.float ?? []).map((f) => f.el));
    idle.loops = idle.loops.filter((l) => l.kind === "marquee" || !floats.has(l.el));
  }

  /* ------------------------------------------------------------ pointer */
  await page.evaluate(() => window.__sinkBehaviours.phase("pointer"));
  const inlineAll = () => page.evaluate(() => { const B = window.__sinkBehaviours; return Array.from(document.body.querySelectorAll("*")).map((el) => [B.idOf(el), el.style?.transform ?? ""]).filter(([, t]) => t); });
  const at = [];
  for (const [fx, fy] of [P1, P2]) {
    const x = Math.round(vw.width * fx), y = Math.round(vw.height * fy);
    await page.mouse.move(x, y, { steps: 8 });
    await wait(2600);
    at.push({ pointer: [x, y], n: [x / vw.width - 0.5, y / vw.height - 0.5], transforms: new Map(await inlineAll()) });
    if (shots) await shot(`pointer-${at.length}`);
  }
  const pointer = await page.evaluate(({ at }) => {
    const B = window.__sinkBehaviours;
    const [a, b] = at.map((p) => ({ ...p, transforms: new Map(p.transforms) }));
    const ids = new Set([...a.transforms.keys(), ...b.transforms.keys()]);
    const out = [];
    const els = new Map(Array.from(document.body.querySelectorAll("*")).map((el) => [B.idOf(el), el]));
    for (const id of ids) {
      const ta = a.transforms.get(id) ?? "", tb = b.transforms.get(id) ?? "";
      if (ta === tb) continue;
      /* A loop moves on its own; it is not the pointer's. */
      if ((window.__sinkIdleLoops ?? []).includes(id)) continue;
      const m = (t) => { try { return new DOMMatrix(t || "none"); } catch { return null; } };
      const ma = m(ta), mb = m(tb);
      if (!ma || !mb) continue;
      const turned = (mm) => Math.abs(mm.m12) > 1e-3 || Math.abs(mm.m21) > 1e-3 || Math.abs(mm.m13) > 1e-3 || Math.abs(mm.m23) > 1e-3 || Math.abs(mm.m11 - 1) > 1e-3;
      const kind = turned(ma) || turned(mb) ? "turn" : "move";
      const dnx = b.n[0] - a.n[0], dny = b.n[1] - a.n[1];
      const el = els.get(id);
      out.push({
        el: id, kind,
        at: [{ pointer: a.pointer, transform: ta }, { pointer: b.pointer, transform: tb }],
        ...(kind === "move" ? { perX: Math.round((mb.m41 - ma.m41) / dnx * 100) / 100, perY: Math.round((mb.m42 - ma.m42) / dny * 100) / 100 } : {}),
        depth: el?.getAttribute?.("data-depth") ?? null,
      });
    }
    return out;
  }, { at: at.map((p) => ({ ...p, transforms: [...p.transforms] })) });
  if (shots) { await page.mouse.move(Math.round(vw.width * P1[0]), Math.round(vw.height * P1[1]), { steps: 4 }); await wait(1500); }

  /* ------------------------------------------------------------ scroll */
  await page.evaluate(() => { window.__sinkBehaviours.phase("scroll"); window.__sinkBefore = window.__sinkBehaviours.snap(); });
  const moveIds = pointer.filter((p) => p.kind === "move").map((p) => p.el);
  const scroll = await page.evaluate(async ({ moveIds }) => {
    const B = window.__sinkBehaviours;
    const frames = (n) => new Promise((r) => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
    const els = new Map(Array.from(document.body.querySelectorAll("*")).map((el) => [B.idOf(el), el]));
    const ty = (id) => { try { return new DOMMatrix(els.get(id)?.style.transform || "none").m42; } catch { return NaN; } };
    const y0 = new Map(moveIds.map((id) => [id, ty(id)]));
    for (let y = 5; y <= 120; y += 5) { scrollTo(0, y); await frames(3); }
    scrollTo(0, 200); await frames(6);
    const perScroll = moveIds.map((id) => ({ el: id, perScroll: Math.round((ty(id) - y0.get(id)) / (scrollY - 0) * 1000) / 1000 }));
    const h = document.documentElement.scrollHeight;
    for (let y = 200; y < h; y += Math.round(innerHeight / 2)) { scrollTo(0, y); await frames(4); await new Promise((r) => setTimeout(r, 60)); }
    scrollTo(0, h); await frames(4);
    await new Promise((r) => setTimeout(r, 1600));
    window.__sinkAfter = B.snap();
    return { perScroll, height: h };
  }, { moveIds });
  if (shots) await shot("bottom");
  /* The pointer over whatever listens to it or has a :hover rule that moves it; then the scroll's own motion (motion-drive.mjs). */
  await page.evaluate(() => window.__sinkBehaviours.phase("hover"));
  const hover = await hoverMotion(page);
  await page.evaluate(() => window.__sinkBehaviours.phase("scroll-motion"));
  const scrolled = await scrollMotion(page, { loops: idle.loops.filter((l) => l.kind === "marquee").map((l) => l.el) });
  const motion = { ...still, hover, ...scrolled };
  await page.evaluate(async () => {
    window.__sinkBehaviours.phase("top");
    scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 800));
    window.__sinkTop = window.__sinkBehaviours.snap();
  });
  if (shots) { await page.evaluate(() => scrollTo(0, 60)); await wait(900); await shot("scrolled-60"); await page.evaluate(() => scrollTo(0, 0)); await wait(600); await shot("top-again"); }

  /* ------------------------------------------------------------ the report */
  return page.evaluate(({ idle, pointer, scroll, motion }) => {
    const B = window.__sinkBehaviours;
    const before = window.__sinkBefore, after = window.__sinkAfter, top = window.__sinkTop;
    const pick = (s) => s && { opacity: Number(s.opacity), transform: s.transform, background: s.backgroundColor, boxShadow: s.boxShadow, paddingTop: s.paddingTop, paddingBottom: s.paddingBottom };
    const ms = (v) => { const m = /^(-?[\d.]+)(ms|s)$/.exec(String(v ?? "").split(",")[0].trim()); return m ? Math.round(Number(m[1]) * (m[2] === "s" ? 1000 : 1)) : 0; };
    /* The rules a class brings (`.site-header.scrolled{…}`), each declaration as written, a custom property resolved against the root: what the scrolled state is, beside what it measured. */
    const rootStyle = getComputedStyle(document.documentElement);
    const resolve = (v) => { for (let i = 0; i < 8 && /var\(/.test(v); i++) v = v.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\)[^()]*)*))?\)/g, (m, n, fb) => rootStyle.getPropertyValue(n).trim() || (fb ?? "").trim()); return v; };
    const rulesFor = (cls) => {
      const out = [];
      const re = new RegExp(`\\.${cls.replace(/[^\w-]/g, "\\$&")}(?![\\w-])`);
      const walk = (list) => {
        for (const r of Array.from(list)) {
          if (r instanceof CSSStyleRule && re.test(r.selectorText)) {
            const style = {};
            for (const d of r.style.cssText.split(";")) { const i = d.indexOf(":"); if (i > 0) style[d.slice(0, i).trim()] = resolve(d.slice(i + 1).trim()); }
            out.push({ selector: r.selectorText, style });
          } else if (r instanceof CSSMediaRule) { if (matchMedia(r.conditionText ?? r.media.mediaText).matches) walk(r.cssRules); }
          else if (r.cssRules && !(r instanceof CSSKeyframesRule)) walk(r.cssRules);
        }
      };
      for (const sheet of Array.from(document.styleSheets)) { try { walk(sheet.cssRules); } catch { /* cross-origin */ } }
      return out;
    };
    const scrolled = [], reveal = [];
    const byEl = new Map();
    for (const c of B.classes) { if (!byEl.has(c.el)) byEl.set(c.el, []); byEl.get(c.el).push(c); }
    for (const [el, list] of byEl) {
      if (el === document.body || el === document.documentElement || !el.isConnected) continue;
      for (const c of list.filter((q) => q.phase === "scroll")) {
        for (const cls of c.added) {
          /* Taken off again later: on the way back to the top, or by the hover and scroll-motion passes after it (they scroll too). */
          const off = list.find((q) => q.t > c.t && q.removed.includes(cls) && ["top", "scroll", "hover", "scroll-motion"].includes(q.phase));
          const b = before.get(el), a = after.get(el);
          if (off) {
            if (scrolled.some((s) => s.el === B.idOf(el) && s.class === cls)) continue;
            scrolled.push({ el: B.idOf(el), class: cls, at: c.y, toggles: off.phase !== "scroll" || off.y < c.y, offAt: off.y, before: pick(b), after: pick(a), transition: b?.transition ?? null, rules: rulesFor(cls) });
          } else {
            const r = el.getBoundingClientRect();
            const topAt = Math.round(r.top + scrollY);
            reveal.push({ el: B.idOf(el), class: cls, atScroll: c.y, top: topAt, enterAt: Math.round((topAt - c.y) / innerHeight * 1000) / 1000, delayMs: ms(c.delay), rest: pick(b), shown: pick(a), transition: b?.transition ?? null });
          }
        }
      }
      /* Taken back at the top without having been added on the way down (added at load, already over 40px): still a scrolled state. */
    }
    const intro = B.animations.filter((a) => a.el.isConnected).map((a) => ({ el: B.idOf(a.el), keyframes: a.keyframes, duration: a.duration, delay: a.delay, easing: a.easing, fill: a.fill, iterations: a.iterations, t: a.t, phase: a.phase }));
    const loaders = B.loaders.map((l) => ({ from: l.from, gone: l.gone, hidden: l.hidden, removed: l.removed, texts: l.texts, words: l.words, pictures: l.pictures, canvases: l.canvases, animations: l.animations, bodyClass: l.bodyClass,
      off: (() => { const c = B.classes.find((q) => q.el === l.el && q.added.length); return c ? { class: c.added[0], afterMs: c.t - l.from } : null; })(),
      bodyOff: (() => { const c = B.classes.find((q) => q.el === document.body && q.removed.length); return c ? { removed: c.removed, afterMs: c.t - l.from } : null; })(),
      /* The same moments from the navigation's start, as a visitor's clock runs: seen, switched off (its class, else hidden), gone. */
      nav: (() => { const c = B.classes.find((q) => q.el === l.el && q.added.length); const t0 = B.t0 ?? 0; const at = (v) => (v === null || v === undefined ? null : Math.round(t0 + v)); return { shown: at(l.from), off: at(c ? c.t : l.hidden ?? l.gone), gone: at(l.gone ?? l.hidden) }; })() }));
    void top;
    return { version: 1, viewport: [innerWidth, innerHeight], height: scroll.height, loaders, intro, reveal, scrolled, pointer: pointer.map((p) => ({ ...p, ...(scroll.perScroll.find((q) => q.el === p.el) ?? {}) })), loops: idle.loops, forever: idle.forever, motion };
  }, { idle, pointer, scroll, motion });
}
