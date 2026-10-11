/**
 * Motion sampled from the browser, on any page (`--behaviours`, called by
 * behaviours-drive.mjs; the fields are in docs/behaviours.md, "Motion
 * sampled"). Nothing here reads a page's code: it watches what is drawn,
 * the way a visitor sees it, so a planet turned by a stylesheet and one
 * turned by `requestAnimationFrame` come out the same, each said with who
 * did it (`via: css` or `script`).
 *
 *   idle     3.6 s at the top, the pointer away: every element whose
 *            computed turn (`transform`'s angle plus the `rotate`
 *            property) only ever grows or only ever shrinks is a SPIN (its
 *            period and direction); one whose computed place (`transform`'s
 *            translation plus `translate`) goes out and comes back is a
 *            FLOAT (its axis, travel, period, curve). A stylesheet's own
 *            animation is read exactly, by playing its keyframes on a
 *            stand-in off the page. Every canvas is looked at 12 frames
 *            running: one that repaints and draws specks is a PARTICLE
 *            canvas (how many, their colours, their size, which way and how
 *            fast they go), with its box and the elements painted either
 *            side of it (the canvas itself is no part).
 *   hover    every element a pointer listener was put on (the recorder
 *            patched `addEventListener`), every one a `:hover` rule moves,
 *            every `[data-tilt]`: the pointer held away, at its middle, at
 *            a quarter and at three quarters of it, then away again. What
 *            it or anything inside it did is a TILT (degrees per whole
 *            element of pointer travel across and down, the lift, the
 *            depth, the perspective, the pace) or a LIFT (moved, turned,
 *            scaled the same wherever the pointer is over it).
 *   scroll   a marquee (a loop the idle pass found) scrolled under at a
 *            steady 8 and then 80 px a frame: its step at rest, the boost
 *            per px of scroll a frame, and the cap (SCROLL SPEED). Then down
 *            the page in tenths of a window: an element whose width (or
 *            height) grows with the scroll, one way only, is a SCROLL GROW
 *            (how much of its holder, from where its top is in the window
 *            to where).
 *
 * Every element is named by the recorder's id (`b<n>`), as the rest of the
 * behaviours section is. Nothing here changes the page, other than the
 * pointer and the scroll a visitor would move.
 */

/* ------------------------------------------------------------------ idle */

export async function idleMotion(page, { skip = [] } = {}) {
  return page.evaluate(async ({ skip }) => {
    const B = window.__sinkBehaviours;
    const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
    const skipped = new Set(skip);
    const all = Array.from(document.body.querySelectorAll("*")).filter((el) => {
      if (skipped.has(B.idOf(el))) return false;
      if (el instanceof SVGElement && el.tagName.toLowerCase() !== "svg") return false;
      const r = el.getBoundingClientRect();
      return r.width >= 4 && r.height >= 4 && getComputedStyle(el).display !== "none";
    });
    /** The turn (deg) and place (px) the browser draws the element at, from `transform` and the individual properties. */
    const pose = (el) => {
      const cs = getComputedStyle(el);
      let m;
      try { m = new DOMMatrix(cs.transform === "none" ? undefined : cs.transform); } catch { m = new DOMMatrix(); }
      const rot = /(-?[\d.]+)deg\s*$/.exec(cs.rotate ?? "");
      const tr = String(cs.translate ?? "none").split(/\s+/).map((v) => parseFloat(v));
      return {
        a: Math.atan2(m.m12, m.m11) * 180 / Math.PI + (rot ? Number(rot[1]) : 0),
        x: m.m41 + (Number.isFinite(tr[0]) ? tr[0] : 0),
        y: m.m42 + (Number.isFinite(tr[1]) ? tr[1] : 0),
      };
    };
    /* Two looks 300 ms apart: what moved at all, and every element a forever animation plays on. */
    const first = new Map(all.map((el) => [el, pose(el)]));
    await new Promise((r) => setTimeout(r, 300));
    const moving = all.filter((el) => { const p = pose(el), q = first.get(el); return Math.abs(p.a - q.a) > 0.05 || Math.abs(p.x - q.x) > 0.2 || Math.abs(p.y - q.y) > 0.2; });
    for (const an of document.getAnimations()) {
      const t = an.effect?.target;
      if (t && !an.effect.pseudoElement && an.effect.getTiming?.().iterations === Infinity && all.includes(t) && !moving.includes(t)) moving.push(t);
    }
    const series = moving.map(() => []);
    const t0 = performance.now();
    while (performance.now() - t0 < 3600) { await frame(); const t = performance.now() - t0; moving.forEach((el, i) => series[i].push({ t, ...pose(el) })); }

    /** A stylesheet's animation on the element that moves its turn or place: played on a stand-in, off the page, at 48 points of one cycle. */
    const cssOf = (el) => {
      for (const an of el.getAnimations()) {
        if (an.effect?.pseudoElement || an.effect?.getTiming?.().iterations !== Infinity) continue;
        const frames = an.effect.getKeyframes?.() ?? [];
        if (!frames.some((f) => f.transform !== undefined || f.rotate !== undefined || f.translate !== undefined)) continue;
        const timing = an.effect.getTiming();
        const r = el.getBoundingClientRect();
        const probe = document.createElement("div");
        probe.style.cssText = `position:fixed;left:-10000px;top:0;width:${el.offsetWidth || r.width}px;height:${el.offsetHeight || r.height}px;visibility:hidden;pointer-events:none`;
        document.body.appendChild(probe);
        const clean = frames.map((f) => { const o = {}; for (const k of ["offset", "easing", "transform", "rotate", "translate", "composite"]) if (f[k] !== undefined && f[k] !== null && !(k === "composite" && f[k] === "auto")) o[k] = f[k]; return o; });
        let pts = [];
        try {
          const p = probe.animate(clean, { duration: 1000, easing: timing.easing, direction: timing.direction, iterations: 1, fill: "both" });
          p.pause();
          for (let k = 0; k <= 48; k++) { p.currentTime = k / 48 * 1000; pts.push(pose(probe)); }
          p.cancel();
        } catch { pts = []; }
        probe.remove();
        if (!pts.length) continue;
        const cycle = Number(timing.duration) * (/alternate/.test(timing.direction) ? 2 : 1);
        const ease = frames.find((f) => f.easing && f.easing !== "linear")?.easing ?? timing.easing;
        return { name: an.animationName ?? null, duration: Number(timing.duration), cycle, direction: timing.direction, easing: ease && ease !== "linear" ? ease : (timing.easing || "linear"), pts };
      }
      return null;
    };
    const unwrap = (as) => { const out = [as[0]]; for (let i = 1; i < as.length; i++) { let d = as[i] - as[i - 1]; while (d > 180) d -= 360; while (d < -180) d += 360; out.push(out[i - 1] + d); } return out; };
    /** How often a series comes back: the best sine over periods from 0.4 s to 12 s. */
    const sine = (ts, vs) => {
      /* v = A sin wt + C cos wt + D, least squares at each period (the middle is fitted, not assumed: a window shorter than a cycle has no fair mean). */
      const n = ts.length;
      const solve3 = (M, y) => {
        const m = M.map((row, i) => [...row, y[i]]);
        for (let c = 0; c < 3; c++) {
          let p = c; for (let r = c + 1; r < 3; r++) if (Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r;
          [m[c], m[p]] = [m[p], m[c]];
          if (Math.abs(m[c][c]) < 1e-9) return null;
          for (let r = 0; r < 3; r++) { if (r === c) continue; const f = m[r][c] / m[c][c]; for (let k = c; k < 4; k++) m[r][k] -= f * m[c][k]; }
        }
        return [m[0][3] / m[0][0], m[1][3] / m[1][1], m[2][3] / m[2][2]];
      };
      let best = { err: Infinity, period: 0, amp: 0 };
      for (let P = 400; P <= 12000; P *= 1.01) {
        const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], y = [0, 0, 0];
        for (let i = 0; i < n; i++) { const w = 2 * Math.PI * ts[i] / P, f = [Math.sin(w), Math.cos(w), 1]; for (let r = 0; r < 3; r++) { y[r] += f[r] * vs[i]; for (let c = 0; c < 3; c++) M[r][c] += f[r] * f[c]; } }
        const x = solve3(M, y);
        if (!x) continue;
        let err = 0;
        for (let i = 0; i < n; i++) { const w = 2 * Math.PI * ts[i] / P; const d = vs[i] - x[0] * Math.sin(w) - x[1] * Math.cos(w) - x[2]; err += d * d; }
        /* A longer period can always fit a shorter stretch by a bigger swing: a swing past twice what was seen is not believed. */
        const amp = Math.hypot(x[0], x[1]);
        if (amp > (Math.max(...vs) - Math.min(...vs)) * 1.2) continue;
        if (err < best.err) best = { err, period: P, amp };
      }
      return best;
    };
    const turns = (vs) => { let k = 0, dir = 0; for (let i = 1; i < vs.length; i++) { const d = vs[i] - vs[i - 1]; if (Math.abs(d) < 0.05) continue; const s = Math.sign(d); if (dir && s !== dir) k++; dir = s; } return k; };
    const r1 = (v) => Math.round(v * 10) / 10, r0 = Math.round;

    const spin = [], float = [];
    moving.forEach((el, i) => {
      const s = series[i];
      if (s.length < 10) return;
      const id = B.idOf(el);
      const css = cssOf(el);
      if (css) {
        const as = unwrap(css.pts.map((p) => p.a)), xs = css.pts.map((p) => p.x), ys = css.pts.map((p) => p.y);
        const turned = as.at(-1) - as[0];
        if (Math.abs(turned) >= 350) { spin.push({ el: id, period: r0(css.cycle * 360 / Math.abs(turned)), direction: turned > 0 ? "cw" : "ccw", via: "css", name: css.name, easing: css.easing }); return; }
        for (const [axis, vs] of [["y", ys], ["x", xs]]) {
          const travel = Math.max(...vs) - Math.min(...vs);
          if (travel < 1.5) continue;
          const back = Math.abs(vs.at(-1) - vs[0]) < travel * 0.2;
          if (!back) continue;
          const lo = Math.min(...vs), hi = Math.max(...vs);
          float.push({ el: id, axis, travel: r1(travel), amplitude: r1(travel / 2), toward: Math.abs(hi) > Math.abs(lo) ? "+" : "-", period: r0(css.cycle), easing: css.easing, via: "css", name: css.name });
          return;
        }
        return;
      }
      /* The page's script: read from the frames drawn. */
      const ts = s.map((p) => p.t), as = unwrap(s.map((p) => p.a));
      const da = as.at(-1) - as[0];
      if (Math.abs(da) >= 3 && turns(as) <= 1) {
        const n = ts.length, mt = ts.reduce((a, b) => a + b, 0) / n, ma = as.reduce((a, b) => a + b, 0) / n;
        let num = 0, den = 0;
        for (let k = 0; k < n; k++) { num += (ts[k] - mt) * (as[k] - ma); den += (ts[k] - mt) ** 2; }
        const rate = num / den; /* degrees a ms */
        spin.push({ el: id, period: r0(360 / Math.abs(rate)), direction: rate > 0 ? "cw" : "ccw", via: "script", degPerSec: r1(rate * 1000) });
        return;
      }
      for (const axis of ["y", "x"]) {
        const vs = s.map((p) => p[axis]);
        const travel = Math.max(...vs) - Math.min(...vs);
        if (travel < 1.5 || turns(vs) < 1) continue;
        const fit = sine(ts, vs);
        float.push({ el: id, axis, travel: r1(Math.max(travel, 2 * fit.amp)), amplitude: r1(Math.max(travel / 2, fit.amp)), period: r0(fit.period), easing: "ease-in-out", via: "script" });
        return;
      }
    });

    /* ---------------------------------------------------------- canvases */
    const canvases = [];
    const hex = (r, g, b) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
    for (const cv of Array.from(document.querySelectorAll("canvas"))) {
      const r = cv.getBoundingClientRect();
      if (r.width < 40 || r.height < 40 || !cv.width || !cv.height || getComputedStyle(cv).visibility === "hidden") continue;
      /* Looked at through a small copy, 12 frames running: how many frames it was drawn again. */
      const small = document.createElement("canvas"); small.width = 64; small.height = 40;
      const sx = small.getContext("2d", { willReadFrequently: true });
      let sum = null, changed = 0, looked = 0, readable = true;
      for (let k = 0; k < 13; k++) {
        await frame();
        try { sx.clearRect(0, 0, 64, 40); sx.drawImage(cv, 0, 0, 64, 40); const d = sx.getImageData(0, 0, 64, 40).data; let h = 0; for (let j = 0; j < d.length; j += 3) h = (h * 31 + d[j]) >>> 0; if (sum !== null) { looked++; if (h !== sum) changed++; } sum = h; } catch { readable = false; break; }
      }
      const rec = { el: B.idOf(cv), box: [r.left + scrollX, r.top + scrollY, r.width, r.height].map(r0), host: cv.parentElement ? B.idOf(cv.parentElement) : null, below: cv.previousElementSibling ? B.idOf(cv.previousElementSibling) : null, above: cv.nextElementSibling ? B.idOf(cv.nextElementSibling) : null, zIndex: getComputedStyle(cv).zIndex, readable };
      if (!readable) { canvases.push({ ...rec, kind: "unknown" }); continue; }
      rec.repaints = looked ? Math.round(changed / looked * 100) / 100 : 0;
      if (rec.repaints < 0.5) { canvases.push({ ...rec, kind: "still" }); continue; }
      /* The specks: blobs of drawn pixels, at the canvas's own resolution, twice, half a second apart. */
      const k = cv.width / r.width;
      const grab = () => { const c = document.createElement("canvas"); c.width = cv.width; c.height = cv.height; const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(cv, 0, 0); return x.getImageData(0, 0, cv.width, cv.height); };
      const blobs = (im) => {
        const { width: W, height: H, data } = im, seen = new Uint8Array(W * H), out = [];
        for (let p = 0; p < W * H; p++) {
          if (seen[p] || data[p * 4 + 3] < 40) continue;
          const stack = [p]; seen[p] = 1;
          let n = 0, sx2 = 0, sy2 = 0, best = -1, bestA = -1;
          while (stack.length) {
            const q = stack.pop(); n++; const qx = q % W, qy = (q - qx) / W; sx2 += qx; sy2 += qy;
            if (data[q * 4 + 3] > bestA) { bestA = data[q * 4 + 3]; best = q; }
            for (const nb of [q - 1, q + 1, q - W, q + W]) { if (nb < 0 || nb >= W * H || seen[nb] || data[nb * 4 + 3] < 40) continue; if ((nb === q - 1 && qx === 0) || (nb === q + 1 && qx === W - 1)) continue; seen[nb] = 1; stack.push(nb); }
            if (n > 20000) break;
          }
          if (n > 20000) continue;
          out.push({ x: sx2 / n / k, y: sy2 / n / k, area: n / (k * k), colour: hex(data[best * 4], data[best * 4 + 1], data[best * 4 + 2]), alpha: bestA / 255 });
        }
        return out;
      };
      let A, Bb, frames = 0, dt = 0;
      try {
        A = blobs(grab());
        const s0 = performance.now();
        while (performance.now() - s0 < 500) { await frame(); frames++; }
        dt = performance.now() - s0;
        Bb = blobs(grab());
      } catch { canvases.push({ ...rec, kind: "unknown" }); continue; }
      const specks = A.filter((b) => b.area >= 1 && b.area <= 1500);
      if (specks.length < 4) { canvases.push({ ...rec, kind: "repaint", blobs: A.length }); continue; }
      /* Each speck matched to the nearest in the later look: which way, how fast. */
      const moves = [];
      for (const a of specks) {
        let best = null, bd = 60;
        for (const b of Bb) { const d = Math.hypot(b.x - a.x, b.y - a.y); if (d < bd && b.colour === a.colour) { bd = d; best = b; } }
        if (best) moves.push([best.x - a.x, best.y - a.y]);
      }
      const med = (xs) => { const q = [...xs].sort((p, v) => p - v); return q.length ? q[Math.floor(q.length / 2)] : 0; };
      const mx = med(moves.map((m) => m[0])), my = med(moves.map((m) => m[1]));
      const perFrame = frames ? Math.hypot(mx, my) / frames : 0;
      /* The colours, most drawn first, near shades folded into the commonest. */
      /* Each shade said by its most opaque speck: a faint one's colour comes back off by a unit or two (it is stored premultiplied). */
      const counts = new Map();
      for (const b of specks) { const had = counts.get(b.colour); counts.set(b.colour, { n: (had?.n ?? 0) + 1, a: Math.max(had?.a ?? 0, b.alpha) }); }
      const ranked = [...counts].sort((p, q) => q[1].n - p[1].n);
      const rgb = (h) => [1, 3, 5].map((j) => parseInt(h.slice(j, j + 2), 16));
      const kept = [];
      for (const [c, { n, a }] of ranked) { const near = kept.find((q) => rgb(q.c).every((v, j) => Math.abs(v - rgb(c)[j]) <= 6)); if (near) { near.n += n; if (a > near.a) { near.a = a; near.c = c; } } else kept.push({ c, n, a }); }
      const colours = kept.filter((q) => q.n >= Math.max(2, specks.length * 0.03)).slice(0, 8).map((q) => q.c);
      const radii = specks.map((b) => Math.sqrt(b.area / Math.PI));
      canvases.push({
        ...rec, kind: "particles",
        specks: specks.length, spacing: r0(r.width / specks.length), size: r1(med(radii)),
        colours, alpha: Math.round(med(specks.map((b) => b.alpha)) * 100) / 100,
        drift: Math.abs(my) >= Math.abs(mx) ? (my < 0 ? "up" : "down") : (mx < 0 ? "left" : "right"),
        perFrame: Math.round(perFrame * 1000) / 1000, speed: r1(Math.hypot(mx, my) / dt * 1000), fps: r0(frames / dt * 1000),
      });
    }
    return { spin, float, canvases };
  }, { skip });
}

/* ------------------------------------------------------------------ hover */

/** Every function in a written transform, by name, in px or deg. */
const PARSE = `(t) => {
  const out = {};
  for (const m of String(t || "").matchAll(/(perspective|rotateX|rotateY|rotateZ|rotate|translateX|translateY|translateZ|translate3d|translate|scale)\\(([^)]*)\\)/g)) {
    const v = m[2].split(",").map((s) => parseFloat(s));
    if (m[1] === "translate3d" || m[1] === "translate") { out.translateX = (out.translateX || 0) + (v[0] || 0); out.translateY = (out.translateY || 0) + (v[1] || 0); if (m[1] === "translate3d") out.translateZ = (out.translateZ || 0) + (v[2] || 0); }
    else out[m[1]] = (out[m[1]] || 0) + (v[0] || 0);
  }
  return out;
}`;

export async function hoverMotion(page) {
  const vw = page.viewportSize();
  const list = await page.evaluate(() => {
    const B = window.__sinkBehaviours;
    const cands = new Set();
    for (const el of B.pointerListened ?? []) if (el instanceof Element && el.isConnected && el !== document.body && el !== document.documentElement) cands.add(el);
    for (const el of document.querySelectorAll("[data-tilt]")) cands.add(el);
    /* A `:hover` rule that moves something: the element hovered is the part before `:hover`. */
    const walk = (rules) => {
      for (const r of Array.from(rules)) {
        if (r instanceof CSSStyleRule && /:hover/.test(r.selectorText) && /(^|;)\s*(transform|translate|rotate|scale)\s*:/.test(r.style.cssText)) {
          for (const one of r.selectorText.split(",")) {
            const i = one.indexOf(":hover");
            if (i < 0) continue;
            const subject = one.slice(0, i).trim();
            try { for (const el of document.querySelectorAll(subject)) cands.add(el); } catch { /* a selector the page may use and this cannot */ }
          }
        } else if (r.cssRules && !(r instanceof CSSKeyframesRule)) walk(r.cssRules);
      }
    };
    for (const sheet of Array.from(document.styleSheets)) { try { walk(sheet.cssRules); } catch { /* cross-origin */ } }
    const out = [];
    for (const el of cands) {
      const r = el.getBoundingClientRect();
      if (r.width < 16 || r.height < 16 || getComputedStyle(el).display === "none") continue;
      /* One inside another listed with a pointer listener of its own is looked at on its own. */
      out.push(B.idOf(el));
      if (out.length >= 40) break;
    }
    window.__sinkHoverEls = new Map(out.map((id) => [id, B.byId(id)]));
    return out;
  });
  const results = [];
  for (const id of list) {
    const box = await page.evaluate((id) => {
      const el = window.__sinkHoverEls.get(id);
      el.scrollIntoView({ block: "center", inline: "nearest" });
      const r = el.getBoundingClientRect();
      return [r.left, r.top, r.width, r.height];
    }, id);
    /* Off the page: a corner of the window can be over something with a hover of its own. */
    const away = [-5, -5];
    await page.mouse.move(away[0], away[1], { steps: 2 });
    await page.waitForTimeout(450);
    const read = () => page.evaluate(({ id, PARSE }) => {
      const parse = new Function(`return ${PARSE}`)();
      const el = window.__sinkHoverEls.get(id);
      const B = window.__sinkBehaviours;
      const els = [el, ...Array.from(el.querySelectorAll("*")).slice(0, 80)];
      return els.map((e) => {
        const cs = getComputedStyle(e);
        return { id: B.idOf(e), inline: e.style?.transform ?? "", computed: cs.transform, rotate: cs.rotate, translate: cs.translate, scale: cs.scale, parsed: parse(e.style?.transform ?? "") };
      });
    }, { id, PARSE });
    const base = await read();
    const at = async (fx, fy) => { await page.mouse.move(Math.round(box[0] + box[2] * fx), Math.round(box[1] + box[3] * fy), { steps: 4 }); await page.waitForTimeout(450); return read(); };
    const mid = await at(0.5, 0.5), q3 = await at(0.75, 0.75), q1 = await at(0.25, 0.25);
    await page.mouse.move(away[0], away[1], { steps: 4 });
    await page.waitForTimeout(450);
    const after = await read();
    const found = await page.evaluate(({ base, mid, q1, q3, after, host }) => {
      const B = window.__sinkBehaviours;
      const out = [];
      const m = (s) => { try { return new DOMMatrix(!s.computed || s.computed === "none" ? undefined : s.computed); } catch { return new DOMMatrix(); } };
      const idx = new Map(base.map((b, i) => [b.id, i]));
      for (const b of base) {
        const i = idx.get(b.id), c = mid[i], a = q1[i], z = q3[i], back = after[i];
        if (!c || !a || !z) continue;
        const same = (p, q) => p.computed === q.computed && p.rotate === q.rotate && p.translate === q.translate && p.scale === q.scale;
        if (same(b, c) && same(b, a) && same(b, z)) continue;
        const el = B.byId(b.id);
        /* One a forever animation moves anyway (a floating eye): it moved with the clock, not with the pointer. */
        if (el && el.getAnimations().some((an) => !an.effect?.pseudoElement && an.effect?.getTiming?.().iterations === Infinity)) continue;
        const cs = el ? getComputedStyle(el) : null;
        const script = c.inline !== b.inline || z.inline !== b.inline;
        const r1 = (v) => Math.round(v * 10) / 10;
        if (script && (z.parsed.rotateY !== undefined || z.parsed.rotateX !== undefined) && (z.parsed.rotateY !== a.parsed.rotateY || z.parsed.rotateX !== a.parsed.rotateX)) {
          const persp = z.parsed.perspective ?? (el?.parentElement ? parseFloat(getComputedStyle(el.parentElement).perspective) : NaN);
          out.push({
            el: b.id, host, kind: "tilt", via: "script",
            across: r1(((z.parsed.rotateY ?? 0) - (a.parsed.rotateY ?? 0)) / 0.5),
            down: r1(-((z.parsed.rotateX ?? 0) - (a.parsed.rotateX ?? 0)) / 0.5),
            lift: r1(-(c.parsed.translateY ?? 0)),
            depth: r1(c.parsed.translateZ ?? 0),
            perspective: Number.isFinite(persp) ? Math.round(persp) : null,
            perspectiveOn: z.parsed.perspective !== undefined ? "self" : "holder",
            pace: cs?.transition ?? null,
            back: back?.inline === b.inline,
            at: [{ pointer: [0.25, 0.25], transform: a.inline }, { pointer: [0.5, 0.5], transform: c.inline }, { pointer: [0.75, 0.75], transform: z.inline }],
          });
          continue;
        }
        /* The same wherever the pointer is over it: a lift (moved, turned, scaled). */
        const mb = m(b), mc = m(c);
        const tr = (s) => String(s.translate ?? "none").split(/\s+/).map((v) => parseFloat(v) || 0);
        const rot = (s) => { const q = /(-?[\d.]+)deg\s*$/.exec(s.rotate ?? ""); return q ? Number(q[1]) : 0; };
        const dx = mc.m41 - mb.m41 + tr(c)[0] - tr(b)[0], dy = mc.m42 - mb.m42 + (tr(c)[1] ?? 0) - (tr(b)[1] ?? 0);
        const turn = Math.atan2(mc.m12, mc.m11) * 180 / Math.PI - Math.atan2(mb.m12, mb.m11) * 180 / Math.PI + rot(c) - rot(b);
        const k = Math.hypot(mc.m11, mc.m12) / (Math.hypot(mb.m11, mb.m12) || 1);
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(turn) < 0.5 && Math.abs(k - 1) < 0.01) continue;
        out.push({ el: b.id, host, kind: "lift", via: script ? "script" : "css", lift: r1(-dy), x: r1(dx), turn: r1(turn), scale: Math.round(k * 1000) / 1000, pace: cs?.transition ?? null });
      }
      return out;
    }, { base, mid, q1, q3, after, host: id });
    for (const f of found) if (!results.some((r) => r.el === f.el)) results.push(f);
  }
  await page.evaluate(() => scrollTo(0, 0));
  return results;
}

/* ------------------------------------------------------------------ scroll */

export async function scrollMotion(page, { loops = [] } = {}) {
  return page.evaluate(async ({ loops }) => {
    const B = window.__sinkBehaviours;
    const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
    const byId = new Map(Array.from(document.body.querySelectorAll("*")).map((el) => [B.idOf(el), el]));
    const xOf = (el) => { try { return new DOMMatrix(getComputedStyle(el).transform === "none" ? undefined : getComputedStyle(el).transform).m41; } catch { return NaN; } };
    const H = document.documentElement.scrollHeight - innerHeight;
    const med = (xs) => { const q = [...xs].sort((p, v) => p - v); return q.length ? q[Math.floor(q.length / 2)] : NaN; };
    /** The track's step a frame, the last `n` of `frames` frames scrolling `v` px each (0: standing still). */
    const stepAt = async (el, v, frames, n) => {
      /* Back at the top, and still until the track's step stops changing: the page eases its measure of the scroll's pace, and the jump back to the top is a fast scroll too. */
      scrollTo(0, 0);
      let prev = NaN;
      for (let round = 0; round < 40; round++) {
        const st = []; let lx = xOf(el);
        for (let k = 0; k < 10; k++) { await frame(); const x = xOf(el); if (Math.abs(x - lx) < el.scrollWidth / 8) st.push(Math.abs(x - lx)); lx = x; }
        const m = med(st);
        /* At least 120 frames first: after a long jump the step sits at the page's cap, and a cap is steady too. */
        if (round >= 11 && Math.abs(m - prev) < 0.01) break;
        prev = m;
      }
      const steps = []; let last = xOf(el), y = 0;
      for (let k = 0; k < frames; k++) {
        if (v) { y = Math.min(H, y + v); scrollTo(0, y); }
        await frame();
        const x = xOf(el), d = x - last; last = x;
        if (k >= frames - n && Math.abs(d) < el.scrollWidth / 8) steps.push(Math.abs(d));
      }
      return med(steps);
    };
    const scrollSpeed = [];
    for (const id of loops) {
      const el = byId.get(id);
      if (!el || H < 400) continue;
      const base = await stepAt(el, 0, 20, 12);
      const slow = await stepAt(el, 8, Math.min(40, Math.floor(H / 8)), 6);
      const fast = await stepAt(el, 80, Math.min(22, Math.floor(H / 80)), 4);
      if (!Number.isFinite(base) || !Number.isFinite(slow) || slow - base < 0.1) continue;
      scrollSpeed.push({ el: id, base: Math.round(base * 1000) / 1000, perScroll: Math.round((slow - base) / 8 * 1000) / 1000, max: Math.round((fast - base) * 10) / 10, at: [{ v: 0, step: base }, { v: 8, step: slow }, { v: 80, step: fast }] });
    }
    /* Down the page in tenths of a window: what grows with the scroll. */
    scrollTo(0, 0); for (let k = 0; k < 20; k++) await frame();
    const all = Array.from(document.body.querySelectorAll("*")).filter((el) => !(el instanceof SVGElement) && el.parentElement && getComputedStyle(el).display !== "none");
    const seen = all.map(() => []);
    for (let y = 0; y <= H + 1; y += Math.max(40, Math.round(innerHeight / 10))) {
      scrollTo(0, y); await frame(); await frame(); await frame();
      all.forEach((el, i) => {
        /* A row the page took away while it was scrolled (a live feed rebuilt): not sampled again. */
        const p = el.parentElement;
        if (!el.isConnected || !p) { seen[i].gone = true; return; }
        const pw = p.clientWidth, ph = p.clientHeight;
        const top = el.getBoundingClientRect().top;
        seen[i].push({ top: top / innerHeight, w: pw ? el.offsetWidth / pw * 100 : 0, h: ph ? el.offsetHeight / ph * 100 : 0 });
      });
    }
    scrollTo(0, 0); await frame();
    const scrollGrow = [];
    all.forEach((el, i) => {
      const s = seen[i];
      if (s.gone || !el.isConnected) return;
      for (const prop of ["w", "h"]) {
        const vs = s.map((q) => q[prop]);
        const lo = Math.min(...vs), hi = Math.max(...vs);
        if (hi - lo < 20) continue;
        /* One way only, as the page goes down. */
        let down = 0, up = 0; for (let k = 1; k < vs.length; k++) { if (vs[k] > vs[k - 1] + 0.2) up++; if (vs[k] < vs[k - 1] - 0.2) down++; }
        if (down && up) continue;
        const mid = s.filter((q) => q[prop] > lo + 0.5 && q[prop] < hi - 0.5);
        if (mid.length < 2) continue;
        const n = mid.length, mt = mid.reduce((a, q) => a + q.top, 0) / n, mv = mid.reduce((a, q) => a + q[prop], 0) / n;
        let num = 0, den = 0; for (const q of mid) { num += (q.top - mt) * (q[prop] - mv); den += (q.top - mt) ** 2; }
        const slope = num / den;
        if (!Number.isFinite(slope) || !slope) continue;
        const r3 = (v) => Math.round(v * 1000) / 1000;
        const p = el.parentElement.getBoundingClientRect();
        scrollGrow.push({ el: B.idOf(el), prop: prop === "w" ? "width" : "height", from: Math.round(lo * 10) / 10, to: Math.round(hi * 10) / 10, start: r3(mt + (lo - mv) / slope), end: r3(mt + (hi - mv) / slope), holder: [Math.round(p.width), Math.round(p.height)], full: [el.parentElement.clientWidth, el.parentElement.clientHeight] });
        (window.__sinkScrollGrow ??= []).push({ el, prop: prop === "w" ? "width" : "height" });
        break;
      }
    });
    return { scrollSpeed, scrollGrow };
  }, { loops });
}
