/**
 * SMOOTH, SNAP AND DEPTH SCROLLING THAT A PERSON CAN SEE (J, 2026-10-10:
 * "smooth scrolling depth scrolling and snap scrolling still do nothing, i
 * expected where i set my part (smooth scrolling) to act as a stop for a
 * single scroll wheel to glide to").
 *
 * What they did before, and why it looked like nothing:
 *   · Smooth eased each wheel notch over a third of a second. The browser
 *     already eases a wheel notch, so the page scrolled as it always had.
 *   · Snap set `scroll-snap-type: proximity` and made every one of a page's
 *     parts (two hundred on PonsStars, words and buttons among them) a snap
 *     point. With a point every few pixels nothing ever visibly snapped.
 *   · Depth moved the page's background picture. A page whose background is
 *     one colour (PonsStars) has nothing there to move.
 *
 * Now, in one script the Preview (`live/LiveShell.tsx`, on its scroller), a
 * published page (`siteMotion.ts`) and the kit's `vendor/builder-motion.js`
 * all run:
 *   · SMOOTH: a part given Smooth scrolling is a stop. One wheel notch glides
 *     the page to the next stop (or the one before, scrolling up), however
 *     far it is. Past the last stop, and on a page with none, a notch glides
 *     its own distance and eases to rest.
 *   · SNAP: the page's sections (the parts given Snap scrolling, or else the
 *     big blocks: wide, tall, holding no other big block) are stops too. A
 *     notch goes to the next section when it is within a screen; a longer
 *     section scrolls as usual. Scrolled any other way (keys, the bar, a
 *     finger), the page settles onto a section close by.
 *   · DEPTH: a part given Depth scrolling is a background layer. It moves
 *     slower than the content round it, and sits where it was drawn when it
 *     is in the middle of the window.
 *
 * `scrollMotion(box, o)`: `box` is the element that scrolls, or null for the
 * window. `o`: { smooth, strength ("light" | "heavy"), stops(), snap,
 * sections(), depth (0..1), layers() }; `stops` and `sections` return
 * elements, `layers` returns groups of elements that move as one (a part and
 * what it holds, in a Preview whose parts are drawn flat). Returns what
 * turns it all off. `sectionsOf(elements, box)` picks the big blocks.
 *
 * Left to the browser: a pinch (ctrl + wheel), a sideways scroll, and a
 * wheel over a part that scrolls on its own and still can. Anyone who asks
 * for less motion gets none of it (the caller checks).
 */
export const SCROLL_MOTION_JS = `function sectionsOf(els, box) {
  var r0 = box ? box.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight };
  var big = [];
  for (var i = 0; i < els.length; i++) {
    var r = els[i].getBoundingClientRect();
    if (r.width >= r0.width * 0.4 && r.height >= r0.height * 0.2) big.push({ n: els[i], r: r });
  }
  return big.filter(function (a) {
    return !big.some(function (b) {
      return b !== a && b.r.top >= a.r.top - 1 && b.r.bottom <= a.r.bottom + 1 && b.r.left >= a.r.left - 1 && b.r.right <= a.r.right + 1 && (b.r.height < a.r.height - 2 || b.r.width < a.r.width - 2);
    });
  }).map(function (a) { return a.n; });
}
function scrollMotion(box, o) {
  var win = !box, el = box || document.scrollingElement || document.documentElement;
  var heavy = o.strength === "heavy";
  /* A notch's own glide: how much of the way is covered each frame (at 60 a second). */
  var ease = heavy ? 0.055 : 0.11;
  var target = null, cur = 0, raf = 0, last = 0, mine = -1, glide = null;
  var held = false, lastDir = 0, quiet = 0, wheeled = 0, settle = 0, cache = null, cacheAt = 0;
  function top() { return win ? (window.scrollY || el.scrollTop || 0) : el.scrollTop; }
  function viewH() { return win ? window.innerHeight : el.clientHeight; }
  function room() { return Math.max(0, el.scrollHeight - viewH()); }
  /* Where a part is, in the scroller's own pixels: a Preview's page can be drawn scaled. */
  function yOf(n) {
    if (win) return top() + n.getBoundingClientRect().top;
    var b = el.getBoundingClientRect(), k = b.height > 0 ? el.clientHeight / b.height : 1;
    return top() + (n.getBoundingClientRect().top - b.top) * k;
  }
  function set(y) { mine = y; (win ? window : el).scrollTo({ top: y, behavior: "instant" }); }
  function own(t, dy) {
    for (var n = t; n && n.nodeType === 1 && n !== el && n !== document.body; n = n.parentElement) {
      if (n.scrollHeight <= n.clientHeight + 1) continue;
      if (!/(auto|scroll|overlay)/.test(getComputedStyle(n).overflowY)) continue;
      if (dy > 0 ? n.scrollTop + n.clientHeight < n.scrollHeight - 1 : n.scrollTop > 0) return true;
    }
    return false;
  }
  /* The stops, top to bottom: a part given Smooth is a hard stop (always glided to), a section a soft one, the page's two ends soft. */
  function points() {
    var now = Date.now();
    if (cache && now - cacheAt < 400) return cache;
    var hard = o.stops ? o.stops() : [], soft = o.snap && o.sections ? o.sections() : [];
    if (!hard.length && !soft.length) { cache = null; cacheAt = now; return null; }
    var max = room(), ps = [];
    function put(n, h) { ps.push({ y: Math.max(0, Math.min(max, Math.round(yOf(n)))), hard: h }); }
    hard.forEach(function (n) { put(n, true); });
    soft.forEach(function (n) { put(n, false); });
    ps.push({ y: 0, hard: false }, { y: max, hard: false });
    ps.sort(function (a, b) { return a.y - b.y || (b.hard ? 1 : 0) - (a.hard ? 1 : 0); });
    cache = ps.filter(function (p, i) { return i === 0 || p.y - ps[i - 1].y > 8; });
    cacheAt = now;
    return cache;
  }
  function next(ps, from, dir) {
    var hit = null;
    for (var i = 0; i < ps.length; i++) {
      if (dir > 0 && ps[i].y > from + 2) return ps[i];
      if (dir < 0 && ps[i].y < from - 2) hit = ps[i];
    }
    return hit;
  }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; target = null; glide = null; last = 0; }
  function step(now) {
    if (glide) {
      var t = Math.max(0, Math.min(1, (now - glide.t0) / glide.ms));
      var k = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      if (t >= 1) { set(glide.to); stop(); return; }
      set(glide.from + (glide.to - glide.from) * k);
      raf = requestAnimationFrame(step);
      return;
    }
    var dt = last ? Math.min(64, now - last) : 16.67;
    last = now;
    cur += (target - cur) * (1 - Math.pow(1 - ease, dt / 16.67));
    if (Math.abs(target - cur) < 0.5) { set(target); stop(); return; }
    set(cur);
    raf = requestAnimationFrame(step);
  }
  function run() { if (!raf) { last = 0; raf = requestAnimationFrame(step); } }
  /* A glide to a stop: eased in and out, longer the further it goes. */
  function glideTo(y) {
    var from = top();
    target = null;
    glide = { from: from, to: y, t0: performance.now(), ms: Math.min(1100, 380 + Math.abs(y - from) * 0.3) * (heavy ? 1.35 : 1) };
    run();
  }
  function wheel(e) {
    if (e.ctrlKey || e.defaultPrevented || Math.abs(e.deltaX) > Math.abs(e.deltaY) || !e.deltaY) return;
    if (own(e.target, e.deltaY)) return;
    var dir = e.deltaY > 0 ? 1 : -1, now = Date.now();
    wheeled = now;
    var ps = points();
    if (ps) {
      /* One gesture, one stop: while it glides, and until the wheel has rested a moment, more of the same way is held (a trackpad sends dozens). */
      if (held && dir === lastDir && (glide || now - quiet < 220)) { quiet = now; e.preventDefault(); return; }
      var to = next(ps, glide ? glide.to : top(), dir);
      if (to && (to.hard || Math.abs(to.y - top()) <= viewH() * 1.05)) {
        e.preventDefault();
        held = true; lastDir = dir; quiet = now;
        glideTo(to.y);
        return;
      }
    }
    held = false; lastDir = dir;
    if (!o.smooth) return;
    var dy = e.deltaY * (e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? viewH() : 1);
    e.preventDefault();
    if (glide) { cur = top(); glide = null; target = cur; }
    if (target === null) { cur = top(); target = cur; }
    target = Math.max(0, Math.min(room(), target + dy));
    run();
  }
  /* Something else moved the page (a scrollbar, a key, a link): the glide lets go, and with Snap the page settles on a section close by. */
  function scrolled() {
    if (raf && Math.abs(top() - mine) > 2) stop();
    if (layers.length) paint();
    if (!o.snap || raf) return;
    clearTimeout(settle);
    settle = setTimeout(function () {
      if (raf || Date.now() - wheeled < 450) return;
      var ps = points(), y = top(), best = null;
      if (!ps) return;
      ps.forEach(function (p) { if (!best || Math.abs(p.y - y) < Math.abs(best.y - y)) best = p; });
      if (best && Math.abs(best.y - y) > 2 && Math.abs(best.y - y) < viewH() * 0.3) glideTo(best.y);
    }, 160);
  }
  /* Depth: each layer's middle as drawn, then each scroll it moves by how far that is from the window's middle. */
  var layers = [], painting = 0;
  function measure() {
    var groups = o.depth > 0 && o.layers ? o.layers() : [];
    layers.forEach(function (g) { g.els.forEach(function (n) { n.style.translate = ""; }); });
    layers = groups.filter(function (g) { return g && g.length; }).map(function (g) {
      var r = g[0].getBoundingClientRect(), b = win ? null : el.getBoundingClientRect(), k = b && b.height > 0 ? el.clientHeight / b.height : 1;
      return { els: g, mid: yOf(g[0]) + (r.height * k) / 2 };
    });
    paint();
  }
  function paint() {
    if (painting) return;
    painting = requestAnimationFrame(function () {
      painting = 0;
      var mid = top() + viewH() / 2;
      layers.forEach(function (g) {
        var ty = Math.round(-(g.mid - mid) * o.depth * 10) / 10;
        g.els.forEach(function (n) { n.style.translate = "0 " + ty + "px"; });
      });
    });
  }
  var on = win ? window : el;
  on.addEventListener("wheel", wheel, { passive: false });
  on.addEventListener("scroll", scrolled, { passive: true });
  window.addEventListener("resize", measure);
  measure();
  /* Once the page has laid itself out (pictures, fonts). */
  var later = setTimeout(measure, 400);
  return function () {
    stop(); clearTimeout(settle); clearTimeout(later); if (painting) cancelAnimationFrame(painting);
    layers.forEach(function (g) { g.els.forEach(function (n) { n.style.translate = ""; }); });
    on.removeEventListener("wheel", wheel); on.removeEventListener("scroll", scrolled); window.removeEventListener("resize", measure);
  };
}`;
