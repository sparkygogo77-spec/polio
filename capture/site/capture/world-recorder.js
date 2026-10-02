/*
 * A WORLD HELD STILL, AND WHERE ITS SPRITES WERE DRAWN (worlds.mjs).
 *
 * Runs in the page before its own scripts. Two things, both idle until the
 * capture asks:
 *
 * `__sinkWorld.hold()` stops the page's animation frames: a callback the
 * page asks for while held waits in a queue, and `release()` hands the queue
 * back to the browser. A canvas drawn from requestAnimationFrame (a walking
 * world) stands still on its last picture, and its script's own idea of where
 * everything is stands still with it, so a click lands on what is shown.
 *
 * Every `drawImage` onto a 2d canvas is written down in canvas pixels (the
 * context's transform applied): the source picture, the part of it, and the
 * box it was drawn into. A draw or fill covering the whole canvas starts a
 * new picture, so `last(canvas)` is the list of what the last whole picture
 * was drawn from. Nothing is kept beyond the picture being drawn and the one
 * before it.
 */
(function () {
  if (window.__sinkWorld) return;
  var raf = window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : null;
  var queue = [];
  var held = false;
  var lists = new WeakMap();
  if (raf) {
    window.requestAnimationFrame = function (cb) {
      if (held) { queue.push(cb); return -queue.length; }
      return raf(cb);
    };
  }
  var P = window.CanvasRenderingContext2D && window.CanvasRenderingContext2D.prototype;
  function at(ctx) {
    var l = lists.get(ctx.canvas);
    if (!l) { l = { cur: [], last: [] }; lists.set(ctx.canvas, l); }
    return l;
  }
  function box(ctx, x, y, w, h) {
    var m = ctx.getTransform ? ctx.getTransform() : { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
    var xs = [m.a * x + m.c * y + m.e, m.a * (x + w) + m.c * y + m.e, m.a * x + m.c * (y + h) + m.e, m.a * (x + w) + m.c * (y + h) + m.e];
    var ys = [m.b * x + m.d * y + m.f, m.b * (x + w) + m.d * y + m.f, m.b * x + m.d * (y + h) + m.f, m.b * (x + w) + m.d * (y + h) + m.f];
    var x0 = Math.min.apply(null, xs), y0 = Math.min.apply(null, ys);
    return { x: x0, y: y0, w: Math.max.apply(null, xs) - x0, h: Math.max.apply(null, ys) - y0 };
  }
  function whole(ctx, b) {
    var c = ctx.canvas;
    return b.x <= 1 && b.y <= 1 && b.x + b.w >= c.width - 1 && b.y + b.h >= c.height - 1;
  }
  function start(l, sky) { if (l.cur.length) { l.last = l.cur; l.lastSky = l.sky; } l.cur = []; l.sky = sky || null; }
  /* A picture drawn from: its address, or a canvas (a sheet the page drew itself) named and kept so its pixels can be read later. */
  var clean = null;
  var sources = [], named = new WeakMap();
  var srcOf = function (img) {
    if (img && (img.currentSrc || img.src)) return img.currentSrc || img.src;
    if (!img || typeof img !== "object") return "?";
    if (!named.has(img)) { named.set(img, "canvas#" + sources.length); sources.push(img); }
    return named.get(img);
  };
  var flipped = function (ctx) { var m = ctx.getTransform ? ctx.getTransform() : null; return !!(m && m.a < 0); };
  var paint = function (v) { return typeof v === "string" ? v : null; };
  if (P && P.drawImage) {
    var drawImage = P.drawImage;
    P.drawImage = function (img) {
      try {
        var a = Array.prototype.slice.call(arguments, 1);
        var iw = img && (img.naturalWidth || img.videoWidth || img.width) || 0, ih = img && (img.naturalHeight || img.videoHeight || img.height) || 0;
        var sx = 0, sy = 0, sw = iw, sh = ih, dx, dy, dw, dh;
        if (a.length >= 8) { sx = a[0]; sy = a[1]; sw = a[2]; sh = a[3]; dx = a[4]; dy = a[5]; dw = a[6]; dh = a[7]; }
        else if (a.length >= 4) { dx = a[0]; dy = a[1]; dw = a[2]; dh = a[3]; }
        else { dx = a[0]; dy = a[1]; dw = iw; dh = ih; }
        var b = box(this, dx, dy, dw, dh), l = at(this);
        var d = { t: "img", k: srcOf(img), s: [sx, sy, sw, sh], x: b.x, y: b.y, w: b.w, h: b.h, flip: flipped(this) };
        /* Drawing the world without its characters (`clean`): their sprites are left out. */
        if (clean && clean.has(d.k + "|" + d.s.map(Math.round).join(","))) return undefined;
        /* A picture over the whole canvas starts a picture, and is its first background. */
        if (whole(this, b)) { start(l); l.cur.push(d); }
        else if (l.cur.length < 4000) l.cur.push(d);
      } catch (e) { /* the page's draw goes on whatever this could not read */ }
      return drawImage.apply(this, arguments);
    };
  }
  ["fillRect", "clearRect"].forEach(function (f) {
    if (!P || !P[f]) return;
    var own = P[f];
    P[f] = function (x, y, w, h) {
      try {
        var b = box(this, x, y, w, h), l = at(this);
        /* …and the boxes behind their labels. */
        if (clean && f === "fillRect" && !whole(this, b) && b.h >= 7 && b.h <= 14 && b.w >= 10 && b.w < this.canvas.width / 2) return undefined;
        /* A fill over the whole canvas starts a picture; its colour is the world's sky. A smaller fill is kept (a label's box). */
        if (whole(this, b)) start(l, f === "fillRect" ? paint(this.fillStyle) : null);
        else if (f === "fillRect" && l.cur.length < 4000) l.cur.push({ t: "fill", x: b.x, y: b.y, w: b.w, h: b.h, style: paint(this.fillStyle) });
      } catch (e) { /* as above */ }
      return own.apply(this, arguments);
    };
  });
  /* Words drawn on the canvas (a character's label): what, where, in what face and colour. */
  if (P && P.fillText) {
    var fillText = P.fillText;
    P.fillText = function (text, x, y) {
      if (clean) return undefined;
      try {
        var l = at(this), w = this.measureText ? this.measureText(String(text)).width : 0;
        var align = this.textAlign || "start", x0 = align === "center" ? x - w / 2 : align === "right" || align === "end" ? x - w : x;
        var b = box(this, x0, y, w, 1);
        if (l.cur.length < 4000) l.cur.push({ t: "text", text: String(text), x: b.x, y: b.y, w: b.w, h: 0, font: this.font, style: paint(this.fillStyle), baseline: this.textBaseline });
      } catch (e) { /* as above */ }
      return fillText.apply(this, arguments);
    };
  }
  /*
   * WHAT A PRESS DID, where the page cannot be watched from outside it
   * (worlds.mjs presses each control of a dialog): the words it put on the
   * clipboard, what it asked the machine to share, the address it opened a
   * window on, the form it tried to send. While a press is read (`pressing`)
   * none of them happens: a window is not opened, a form is not sent.
   */
  var said = [];
  var pressing = false;
  try {
    var clip = navigator.clipboard;
    if (clip && clip.writeText) {
      var writeText = clip.writeText.bind(clip);
      clip.writeText = function (t) { said.push({ copy: String(t) }); return pressing ? Promise.resolve() : writeText(t); };
    }
  } catch (e) { /* no clipboard to watch */ }
  if (document.execCommand) {
    var exec = document.execCommand.bind(document);
    document.execCommand = function (c) {
      if (String(c).toLowerCase() === "copy") { var s = String(window.getSelection && window.getSelection() || ""); var f = document.activeElement; said.push({ copy: s || (f && f.value) || "" }); if (pressing) return true; }
      return exec.apply(document, arguments);
    };
  }
  var heard = function (d) { said.push({ share: { title: d && d.title || "", text: d && d.text || "", url: d && d.url || "" } }); };
  if (navigator.share) {
    var share = navigator.share.bind(navigator);
    navigator.share = function (d) { heard(d); return pressing ? Promise.resolve() : share(d); };
  } else {
    /* A machine with no share sheet (this one): offered only while a press is read, so a page that asks for one is heard; otherwise absent, as it was. */
    try { Object.defineProperty(navigator, "share", { configurable: true, get: function () { return pressing ? function (d) { heard(d); return Promise.resolve(); } : undefined; } }); } catch (e) { /* left as it is */ }
  }
  var open = window.open;
  window.open = function (u, t) { if (pressing) { said.push({ open: String(u || ""), target: String(t || "_blank") }); return null; } return open.apply(window, arguments); };
  document.addEventListener("submit", function (e) {
    if (!pressing) return;
    e.preventDefault(); e.stopImmediatePropagation();
    var f = e.target, a = f && f.getAttribute && f.getAttribute("action");
    said.push({ submit: new URL(a || location.href, location.href).href, method: String(f && f.method || "get").toUpperCase() });
  }, true);
  /* `form.submit()` sends with no submit event: held the same way. */
  if (window.HTMLFormElement) {
    var submit = HTMLFormElement.prototype.submit;
    HTMLFormElement.prototype.submit = function () {
      if (!pressing) return submit.apply(this, arguments);
      said.push({ submit: new URL(this.getAttribute("action") || location.href, location.href).href, method: String(this.method || "get").toUpperCase() });
    };
  }
  window.__sinkWorld = {
    press: function (on) { pressing = !!on; if (on) said = []; return said; },
    said: function () { return said.slice(); },
    hold: function () { held = true; },
    release: function () {
      held = false;
      var q = queue.splice(0);
      for (var i = 0; i < q.length; i++) raf(q[i]);
    },
    held: function () { return held; },
    /* What the last whole picture on this canvas was drawn from (the one being drawn, when a frame is not yet over). */
    last: function (canvas) {
      var l = lists.get(canvas);
      if (!l) return [];
      return l.cur.length ? l.cur.slice() : l.last.slice();
    },
    /* Draw on without these sprites (their names, as `last` gives them), without words and without the boxes behind them; null draws everything again. */
    clean: function (names) { clean = names ? new Set(names) : null; },
    /* A canvas (or bitmap) a picture was drawn from, by the name `last` gave it. */
    source: function (name) { var m = /^canvas#(\d+)$/.exec(name || ""); return m ? sources[+m[1]] || null : null; },
    /* The colour the last whole picture began with. */
    sky: function (canvas) {
      var l = lists.get(canvas);
      if (!l) return null;
      return l.cur.length ? l.sky : l.lastSky || null;
    },
  };
})();
