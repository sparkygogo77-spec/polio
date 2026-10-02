/**
 * HOW THE PAGE GOES TO ITS OWN PLACES. trumpmorty.fun's nav (Lore, How to
 * buy, Chart, Roadmap) and its remote's keys are links to `#lore`, `#buy`,
 * … on the same page, and pressed they glide there: its script scrolls the
 * window over `min(1600, 500 + distance × 0.25)` ms on an ease-in-out
 * cubic, stopping a header's height short. A copy that jumps there is a
 * different page. A page can also glide by its stylesheet alone
 * (`scroll-behavior: smooth`), or jump.
 *
 * So each in-page link with a place of its own (up to `most`, spread over
 * the page, one per place) is pressed from the top as a visitor would, by a
 * click on the link itself (its script's handler, or the browser's own
 * jump), and the window's scroll is read every frame until it has been
 * still for a while: where it started and stopped, the place's own top,
 * how long it took, and the way it got there as the share of the distance
 * covered at each twentieth of the time (`curve`, 21 points). Nothing is
 * sent, and nothing but the scroll changes; the address's `#` is put back.
 *
 * `capture-to-document.mjs` reads the presses as one rule (`glideRule`):
 * the time for a distance, the curve, and where it stops against the place.
 * `check-glide.mjs`.
 */
export async function readGlides(page, { most = 4, stillMs = 350, longest = 3500 } = {}) {
  const found = await page.evaluate((most) => {
    const out = [], seen = new Set();
    for (const a of Array.from(document.querySelectorAll('a[href^="#"]'))) a.removeAttribute("data-sink-glide");
    const all = [];
    for (const a of Array.from(document.querySelectorAll('a[href^="#"]'))) {
      let id = "";
      try { id = decodeURIComponent(a.getAttribute("href").slice(1)); } catch { continue; }
      if (!id || seen.has(id)) continue;
      const t = document.getElementById(id);
      const r = a.getBoundingClientRect(), cs = getComputedStyle(a);
      if (!t || r.width < 2 || r.height < 2 || cs.visibility === "hidden") continue;
      seen.add(id);
      all.push({ a, id, top: Math.round(t.getBoundingClientRect().top + scrollY) });
    }
    /* Spread over the page: the nearest, the farthest and what lies between, so one rule can be read for any distance. */
    all.sort((p, q) => p.top - q.top);
    const pick = all.length <= most ? all : Array.from({ length: most }, (_, i) => all[Math.round((i * (all.length - 1)) / (most - 1))]);
    pick.forEach((x, i) => { x.a.setAttribute("data-sink-glide", String(i)); out.push({ i, id: x.id, top: x.top }); });
    const root = getComputedStyle(document.documentElement), body = getComputedStyle(document.body);
    return { links: out, css: root.scrollBehavior === "smooth" || body.scrollBehavior === "smooth" ? "smooth" : "auto", padTop: parseFloat(root.scrollPaddingTop) || 0, max: document.documentElement.scrollHeight - innerHeight };
  }, most).catch(() => null);
  if (!found?.links.length) return null;
  const links = [];
  for (const l of found.links) {
    /* From the top, at rest, jumped there whatever the page's own scroll-behavior says. */
    await page.evaluate(() => { const h = document.documentElement, was = h.style.scrollBehavior; h.style.scrollBehavior = "auto"; scrollTo(0, 0); h.style.scrollBehavior = was; }).catch(() => {});
    await page.waitForTimeout(500);
    const read = await page.evaluate(({ i, stillMs, longest }) => new Promise((done) => {
      const a = document.querySelector(`[data-sink-glide="${i}"]`);
      if (!a) return done(null);
      const from = scrollY, t0 = performance.now(), got = [[0, from]];
      let lastMove = t0, moved = false;
      a.click();
      const step = (now) => {
        const y = scrollY;
        if (y !== got[got.length - 1][1]) { lastMove = now; moved = true; }
        got.push([Math.round((now - t0) * 10) / 10, y]);
        if ((moved && now - lastMove >= stillMs) || (!moved && now - t0 >= 1200) || now - t0 >= longest) return done({ from, got });
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }), { i: l.i, stillMs, longest }).catch(() => null);
    if (!read) continue;
    const to = read.got[read.got.length - 1][1], dist = to - read.from;
    const moveAt = read.got.findIndex(([, y]) => y !== read.from);
    /* When it got there: the first frame at its last place, timed from the click (a script starts its clock in the click's handler). */
    const arrived = read.got.find(([, y]) => Math.abs(y - to) < 0.5)?.[0] ?? 0;
    /* Arrived on the first frame it moved: a jump, not a glide. */
    const jumped = !dist || moveAt < 0 || arrived <= read.got[moveAt][0] + 1;
    /* Every frame up to where it came to rest, for the rule to fit (`glideRule`). */
    const frames = jumped ? null : read.got.filter(([t]) => t <= arrived + 50).map(([t, y]) => [t, Math.round((y - read.from) * 10) / 10]);
    links.push({ id: l.id, top: l.top, from: read.from, to, ms: jumped ? 0 : Math.round(arrived), ...(frames ? { frames } : {}) });
  }
  await page.evaluate(() => { const h = document.documentElement, was = h.style.scrollBehavior; h.style.scrollBehavior = "auto"; if (location.hash) history.replaceState(history.state, "", location.pathname + location.search); scrollTo(0, 0); h.style.scrollBehavior = was; for (const a of Array.from(document.querySelectorAll("[data-sink-glide]"))) a.removeAttribute("data-sink-glide"); }).catch(() => {});
  await page.waitForTimeout(400);
  return links.length ? { css: found.css, padTop: found.padTop, links } : null;
}

/* The easings a page's own script most often writes, by the name polio plays them under. */
const EASINGS = {
  linear: (p) => p,
  "ease-in-out-quad": (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2),
  "ease-in-out-cubic": (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
  "ease-in-out-quart": (p) => (p < 0.5 ? 8 * p ** 4 : 1 - Math.pow(-2 * p + 2, 4) / 2),
  "ease-in-out-sine": (p) => -(Math.cos(Math.PI * p) - 1) / 2,
  "ease-out-quad": (p) => 1 - (1 - p) * (1 - p),
  "ease-out-cubic": (p) => 1 - Math.pow(1 - p, 3),
  "ease-out-quart": (p) => 1 - Math.pow(1 - p, 4),
  "ease-out-expo": (p) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p)),
};
export const GLIDE_EASINGS = Object.keys(EASINGS);

/** A glide's way there as the share of the distance at each twentieth of `ms`, read off its frames. */
function curveOf(l, ms) {
  const f = l.frames, dist = l.to - l.from;
  const at = (t) => { for (let k = 1; k < f.length; k++) { const [t1, y1] = f[k], [t0, y0] = f[k - 1]; if (t1 >= t) return y0 + (y1 - y0) * (t1 === t0 ? 1 : (t - t0) / (t1 - t0)); } return dist; };
  return Array.from({ length: 21 }, (_, k) => Math.round((at((k / 20) * ms) / dist) * 1000) / 1000);
}
/** How far a named easing over `ms` is from a glide's frames: the worst share of the distance it is off by. */
function offBy(l, f, ms) {
  const dist = l.to - l.from;
  let worst = 0;
  for (const [t, y] of l.frames) worst = Math.max(worst, Math.abs(f(Math.min(1, t / ms)) - y / dist));
  return worst;
}

/**
 * The presses as one rule: `{ how, ms: { base, perPx, max }, ease, curve,
 * offset }`. `how` is `script` (it glided and the stylesheet does not say
 * smooth), `css` (the stylesheet's `scroll-behavior: smooth`) or `jump`.
 * Each glide's frames are fitted with each of `EASINGS` over the time that
 * fits it best: the easing that is off by the least across the presses is
 * named when it is within 2 % of the distance at every frame, and its times
 * are the glides' times (an ease-in-out is within half a pixel of its end
 * well before its time is up, so where it came to rest is early). Otherwise
 * the times are where each came to rest and `curve` is their average shape.
 * The time is a line through the distances pressed (least squares), capped
 * where the farthest presses fall under it. `offset` is where it stops
 * against the place's own top (a header's height short: negative).
 */
export function glideRule(read) {
  const links = (read?.links ?? []).filter((l) => l.to !== l.from);
  if (!links.length) return null;
  const glided = links.filter((l) => l.ms > 0 && (l.frames?.length || l.curve));
  const offsets = links.map((l) => l.to - l.top).filter((o) => Math.abs(o) < 400).sort((a, b) => a - b);
  const offset = offsets.length ? offsets[Math.floor(offsets.length / 2)] : 0;
  if (!glided.length) return { how: "jump", offset };
  /* The easing, and each glide's own time under it. */
  let ease = null, times = glided.map((l) => l.ms), best = Infinity;
  if (glided.every((l) => l.frames?.length > 3)) {
    for (const [name, f] of Object.entries(EASINGS)) {
      const fitted = glided.map((l) => {
        let bt = l.ms, be = Infinity;
        for (let ms = Math.round(l.ms * 0.9); ms <= Math.round(l.ms * 1.25); ms += 2) { const e = offBy(l, f, ms); if (e < be) { be = e; bt = ms; } }
        return [bt, be];
      });
      const worst = Math.max(...fitted.map((x) => x[1]));
      if (worst < best) { best = worst; ease = name; times = fitted.map((x) => x[0]); }
    }
    if (best > 0.02) { ease = null; times = glided.map((l) => l.ms); }
  }
  const pts = glided.map((l, i) => [Math.abs(l.to - l.from), times[i]]).sort((a, b) => a[0] - b[0]);
  const fit = (ps) => {
    const n = ps.length, mx = ps.reduce((s, p) => s + p[0], 0) / n, my = ps.reduce((s, p) => s + p[1], 0) / n;
    const sxx = ps.reduce((s, p) => s + (p[0] - mx) ** 2, 0);
    const perPx = n > 1 && sxx > 0 ? ps.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0) / sxx : 0;
    return { base: my - perPx * mx, perPx };
  };
  const off = (f, ps) => Math.max(...ps.map(([d, ms]) => Math.abs(f.base + f.perPx * d - ms)));
  let use = pts, line = fit(pts), max = null;
  /* The farthest presses under the line the nearer ones make: a cap they reached. */
  while (use.length > 2 && off(line, use) > 40) {
    const nearer = use.slice(0, -1), f = fit(nearer);
    if (off(f, nearer) >= off(line, use)) break;
    use = nearer; line = f; max = Math.round(pts.slice(use.length).reduce((s, p) => s + p[1], 0) / (pts.length - use.length));
  }
  const perPx = Math.abs(line.perPx) < 0.005 ? 0 : Math.round(line.perPx * 1000) / 1000;
  const base = Math.round(perPx ? line.base : pts.reduce((s, p) => s + p[1], 0) / pts.length);
  const curves = glided.map((l, i) => l.curve ?? curveOf(l, times[i]));
  const curve = Array.from({ length: 21 }, (_, k) => Math.round((curves.reduce((s, c) => s + c[k], 0) / curves.length) * 1000) / 1000);
  return { how: read.css === "smooth" ? "css" : "script", ms: { base, perPx, ...(max !== null ? { max } : {}) }, ...(ease ? { ease } : {}), curve, offset };
}
