/**
 * A SPRITE WORLD, DRAWN AGAIN LIVE (parts/World.tsx `stage`, sink worlds.mjs).
 *
 * The owner, comparing at 2000 wide: the page's world is no loop. Its pets
 * wander on paths of their own, drawn by the page's script at the canvas's
 * own size, so a wider window is a wider meadow and the pets stay their size;
 * a flipbook scaled to cover the box made them huge and cut them off. So the
 * capture keeps what the world is made of, and this draws it:
 *
 *   · the scale: art pixels drawn `px` CSS pixels each, the page's own choice
 *     at the window width nearest below this one (`scaleAt`), so the art is
 *     as wide as the box allows and nothing is stretched or cut;
 *   · each scene: its fill, its backgrounds stood on the foot of the box and
 *     repeated across it, and its props flickering in place;
 *   · each character at home a share of the way across, wandering either
 *     side of it: a pace of its own that drifts, a stop now and then, a turn
 *     and a pause at the edge of its range, a one-pixel bob as it walks, its
 *     sprite turned to the way it goes; a rider carried on its host where it
 *     sat, turned with it; a label over the tallest of them;
 *   · a scene switch that pans, as the page's does, over 900ms.
 *
 * It places each character's press area (`[data-world-hit]`, the part's own
 * buttons) where it draws it, every frame, so the dialogs open from where
 * the pets are. A visitor asking for less motion gets the world standing.
 *
 * Plain browser JavaScript as a string, part of the `world-dialogs`
 * feature's script: the Preview and the published page run the same code.
 * `runStage(layer, data)` returns { setScene, scene, boxes }.
 */
export const STAGE_ENGINE = String.raw`
function runStage(layer, data) {
  var cv = layer.querySelector("canvas[data-world-canvas]");
  if (!cv || !cv.getContext) return null;
  var g = cv.getContext("2d");
  var calm = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var tick = 0;
  var imgs = (data.images || []).map(function (src) { var im = new Image(); im.onload = function () { kick(); }; im.src = src; return im; });
  var ready = function (i) { var im = imgs[i]; return !!(im && im.complete && im.naturalWidth); };
  var M = data.motion || { speed: 7, pause: [1.5, 4], stop: 0.08 };
  var LB = data.label || null;
  var scenes = data.scenes && data.scenes.length ? data.scenes : [{ layers: [], props: [] }];
  var S = data.px || 3, b = 1, T = 1, scene = Math.min(scenes.length - 1, data.start || 0);
  var cam = scene, camFrom = scene, camAt = -1e9, PAN = 900;
  var seed = function (s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
  var all = (data.chars || []).map(function (c, k) {
    var p = seed(String(c.key || k));
    return { c: c, k: k, phase: p, x: 0, dir: (c.face || (p < 0.5 ? -1 : 1)), pause: 0, pace: 1, placed: false, box: null, face: 1 };
  });
  var walkers = all.filter(function (a) { return a.c.sprite && !(typeof a.c.rides === "number" && all[a.c.rides]); });
  var riders = all.filter(function (a) { return a.c.sprite && typeof a.c.rides === "number" && all[a.c.rides]; });
  var hits = {};
  Array.prototype.forEach.call(layer.querySelectorAll("[data-world-hit]"), function (h) { hits[h.getAttribute("data-world-hit")] = h; });

  function scaleFor(w) {
    var s = data.px || 3, best = -1;
    (data.scaleAt || []).forEach(function (p) { if (p[0] <= w + 1 && p[0] > best) { best = p[0]; s = p[1]; } });
    if (best < 0 && data.scaleAt && data.scaleAt.length) { var lo = data.scaleAt.slice().sort(function (a, b) { return a[0] - b[0]; })[0]; s = lo[1]; }
    return s > 0 ? s : 3;
  }
  function fit() {
    var r = layer.getBoundingClientRect();
    if (!r.width || !r.height) return;
    S = scaleFor(r.width);
    b = Math.max(1, Math.ceil(r.width / S)); T = Math.max(1, Math.ceil(r.height / S));
    if (cv.width !== b || cv.height !== T) { cv.width = b; cv.height = T; }
    g.imageSmoothingEnabled = false;
    walkers.forEach(function (a) {
      a.home = Math.max(8, Math.min(b - 8, (a.c.at == null ? 0.5 : a.c.at) * b));
      a.range = Math.max(0, (a.c.range || 0) * b);
      if (!a.placed) { a.x = a.home + (a.phase - 0.5) * a.range; a.placed = true; }
      a.x = Math.max(a.home - a.range, Math.min(a.home + a.range, a.x));
    });
    kick();
  }
  function sp(id) { var s = data.sprites && data.sprites[id]; return s && ready(s[0]) ? s : null; }
  function put(id, x, y, flip) {
    var s = sp(id); if (!s) return;
    if (flip) { g.save(); g.translate(Math.round(x) + s[3], Math.round(y)); g.scale(-1, 1); g.drawImage(imgs[s[0]], s[1], s[2], s[3], s[4], 0, 0, s[3], s[4]); g.restore(); }
    else g.drawImage(imgs[s[0]], s[1], s[2], s[3], s[4], Math.round(x), Math.round(y), s[3], s[4]);
  }
  /* A character's sprite for the way it goes: its own for that side, else the other turned. */
  function look(a, dir) {
    var sr = a.c.sprite || {};
    if (dir > 0) return sr.r ? { id: sr.r, flip: false } : { id: sr.l, flip: true };
    return sr.l ? { id: sr.l, flip: false } : { id: sr.r, flip: true };
  }
  function ground(sc, x0) {
    g.fillStyle = sc.sky || "#000"; g.fillRect(x0, 0, b, T);
    /*
     * The ground the page painted, as captured at this scale (its widest box):
     * stood on the foot, centred, cut to the box; a box wider or taller than it
     * is filled by drawing its edge columns and top row out.
     */
    var bgs = (sc.backgrounds || []).filter(function (q) { return ready(q.img); });
    if (bgs.length) {
      var at = bgs.filter(function (q) { return q.px === S; });
      var pool = at.length ? at : bgs;
      var bg = pool.filter(function (q) { return q.w >= b; })[0] || pool[pool.length - 1];
      var im = imgs[bg.img], x = x0 + Math.round((b - bg.w) / 2), y = T - bg.h;
      g.save(); g.beginPath(); g.rect(x0, 0, b, T); g.clip();
      g.drawImage(im, x, y);
      if (x > x0) { g.drawImage(im, 0, 0, 1, bg.h, x0, y, x - x0, bg.h); }
      if (x + bg.w < x0 + b) { g.drawImage(im, bg.w - 1, 0, 1, bg.h, x + bg.w, y, x0 + b - x - bg.w, bg.h); }
      if (y > 0) { g.drawImage(im, 0, 0, bg.w, 1, x, 0, bg.w, y); if (x > x0) g.drawImage(im, 0, 0, 1, 1, x0, 0, x - x0, y); if (x + bg.w < x0 + b) g.drawImage(im, bg.w - 1, 0, 1, 1, x + bg.w, 0, x0 + b - x - bg.w, y); }
      g.restore();
      return;
    }
    (sc.layers || []).forEach(function (L) {
      if (!ready(L.img)) return;
      var y = T - L.bottom - L.h;
      g.save(); g.beginPath(); g.rect(x0, 0, b, T); g.clip();
      if (L.repeat) {
        var d = L.side === "left" ? 0 : Math.round((b - L.w) / 2);
        while (d > 0) d -= L.w;
        for (; d < b; d += L.w) g.drawImage(imgs[L.img], L.sx, L.sy, L.sw, L.sh, x0 + d, y, L.w, L.h);
      } else {
        var x = L.side === "right" ? b - L.x - L.w : L.side === "centre" ? Math.round((b - L.w) / 2) : L.x;
        g.drawImage(imgs[L.img], L.sx, L.sy, L.sw, L.sh, x0 + x, y, L.w, L.h);
      }
      g.restore();
    });
  }
  function props(sc, x0, t) {
    (sc.props || []).forEach(function (p) {
      var id = p.frames[Math.floor(t * 1000 / (p.every || 200)) % p.frames.length], s = sp(id); if (!s) return;
      put(id, x0 + (p.side === "right" ? b - p.x - s[3] : p.x), T - p.bottom - s[4], false);
    });
  }
  function label(text, cx, y, x0) {
    if (!LB || !text) return;
    g.font = LB.font;
    var w = Math.ceil(g.measureText(text).width) + LB.pad * 2;
    var x = Math.round(Math.max(x0 + 1, Math.min(x0 + b - w - 1, cx - w / 2))), yy = Math.round(y);
    if (LB.edge) { g.fillStyle = LB.edge; g.fillRect(x - 1, yy - 1, w + 2, LB.h + 2); }
    g.fillStyle = LB.bg; g.fillRect(x, yy, w, LB.h);
    g.fillStyle = LB.fg; g.textBaseline = "top"; g.fillText(text, x + LB.pad, yy + 1);
  }
  var last = 0, t0 = performance.now();
  function frame(now) {
    tick = 0;
    var dt = Math.min(0.1, last ? (now - last) / 1000 : 0), t = (now - t0) / 1000;
    last = now;
    var e = Math.min(1, (now - camAt) / PAN), ease = e < 0.5 ? 4 * e * e * e : 1 - Math.pow(-2 * e + 2, 3) / 2;
    cam = calm ? scene : camFrom + (scene - camFrom) * ease;
    var ox = Math.round(cam * b);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.translate(-ox, 0);
    var shown = [];
    for (var i = 0; i < scenes.length; i++) if (i * b < ox + b && i * b + b > ox) shown.push(i);
    shown.forEach(function (i) { ground(scenes[i], i * b); props(scenes[i], i * b, t); });
    /* The walkers: back rows first (the higher foot), then left to right. */
    var list = walkers.filter(function (a) { return shown.indexOf(a.c.scene || 0) >= 0; }).sort(function (p, q) { return (q.c.foot || 0) - (p.c.foot || 0) || p.x - q.x; });
    list.forEach(function (a) {
      if (!calm) {
        if (a.pause > 0) a.pause -= dt;
        else {
          a.pace += (Math.random() - 0.5) * dt * 0.8; a.pace = Math.max(0.55, Math.min(1.45, a.pace));
          a.x += a.dir * (a.c.speed || M.speed) * a.pace * dt;
          if (a.range > 0 && Math.abs(a.x - a.home) > a.range) {
            a.x = a.home + (a.x > a.home ? 1 : -1) * a.range; a.dir *= -1;
            a.pause = M.pause[0] + Math.random() * (M.pause[1] - M.pause[0]);
          } else if (Math.random() < dt * M.stop) {
            a.pause = 1 + Math.random() * 3;
            if (Math.random() < 0.35) a.dir *= -1;
          }
        }
      }
      var moving = !calm && a.pause <= 0 && a.range > 0;
      var bob = moving && Math.floor(t * 5 + a.phase * 7) % 2 ? -1 : 0;
      var lk = look(a, a.dir), s = sp(lk.id);
      if (!s) { a.box = null; return; }
      var x0 = (a.c.scene || 0) * b;
      a.box = { x: x0 + Math.round(a.x - s[3] / 2), y: T - (a.c.foot || 0) - s[4] + bob, w: s[3], h: s[4] };
      a.face = a.dir;
      put(lk.id, a.box.x, a.box.y, lk.flip);
      /* Its riders, where they sat on it, turned with it. */
      carry(a, 0);
    });
    function carry(host, depth) {
      if (depth > 4) return;
      riders.forEach(function (r) {
        if (all[r.c.rides] !== host || !host.box) return;
        var turned = (r.c.face || 1) !== host.face;
        var lk = look(r, turned ? -(r.c.face || 1) : (r.c.face || 1)), s = sp(lk.id);
        if (!s) { r.box = null; return; }
        var dx = r.c.ride ? r.c.ride[0] : 0, dy = r.c.ride ? r.c.ride[1] : 0;
        if (turned) dx = host.box.w - dx - s[3];
        r.box = { x: host.box.x + dx, y: host.box.y + dy, w: s[3], h: s[4] };
        r.face = turned ? -(r.c.face || 1) : (r.c.face || 1);
        put(lk.id, r.box.x, r.box.y, lk.flip);
        carry(r, depth + 1);
      });
    }
    /* Labels over the tallest of each walker's stack. */
    if (LB) list.forEach(function (a) {
      if (!a.box || !a.c.label) return;
      var top = a.box.y;
      riders.forEach(function (r) { var h = r; while (h && typeof h.c.rides === "number") { h = all[h.c.rides]; if (h === a) { if (r.box) top = Math.min(top, r.box.y); break; } } });
      label(a.c.label, a.box.x + a.box.w / 2, Math.max(1, top - LB.h - 3), (a.c.scene || 0) * b);
    });
    place(ox);
    if (!calm || now - camAt < PAN + 50) kick();
  }
  /* Each press area where its character is drawn, in the part's own CSS pixels; smaller ones on top, as the page's hit test prefers. */
  function place(ox) {
    var r = layer.getBoundingClientRect(), k = r.width / b, kh = r.height / T;
    var boxes = all.map(function (a) { return a.box && a.box.x - ox + a.box.w > 0 && a.box.x - ox < b ? a : null; });
    var order = boxes.filter(Boolean).sort(function (p, q) { return q.box.w * q.box.h - p.box.w * p.box.h; });
    all.forEach(function (a) {
      var h = hits[a.k]; if (!h) return;
      if (!a.box || boxes[a.k] === null) { h.style.visibility = "hidden"; return; }
      h.style.left = ((a.box.x - ox - 2) * k) + "px"; h.style.top = ((a.box.y - 2) * kh) + "px";
      h.style.width = ((a.box.w + 4) * k) + "px"; h.style.height = ((a.box.h + 4) * kh) + "px";
      h.style.visibility = "visible"; h.style.zIndex = String(order.indexOf(a) + 1);
    });
  }
  var inView = true;
  function kick() { if (!tick && inView && !document.hidden) tick = requestAnimationFrame(frame); }
  if (window.IntersectionObserver) new IntersectionObserver(function (es) { inView = es[es.length - 1].isIntersecting; if (inView) { last = 0; kick(); } }, { rootMargin: "80px" }).observe(layer);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) { last = 0; kick(); } });
  if (window.ResizeObserver) new ResizeObserver(fit).observe(layer); else window.addEventListener("resize", fit);
  fit();
  return {
    setScene: function (i) { i = Math.max(0, Math.min(scenes.length - 1, i)); if (i === scene) return; camFrom = cam; camAt = performance.now(); scene = i; kick(); },
    scene: function () { return scene; },
    boxes: function () { return all.map(function (a) { return a.box; }); },
  };
}
`;
