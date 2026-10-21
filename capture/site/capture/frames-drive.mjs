/**
 * Pictures of what moves, and only of what moves (`--behaviours`, called by
 * behaviours-drive.mjs after the idle pass; the fields are in
 * docs/behaviours.md, "Frames of what moves"). The rest of the behaviours
 * section says motion in numbers: a spin's period, a float's travel, a
 * canvas's specks. This keeps the look of it: a short run of frames of each
 * part the screen shows changing, cropped to that part, so the Builder can
 * play the thing back as it was drawn rather than show one still of it
 * (a shimmer, a blink, a shader, a water, a ticker, a cursor's trail).
 *
 * Time is spent only where something moves:
 *
 *   find    the page a window at a time (`bands`, at most 8 windows deep),
 *           the pointer off the page. Three looks at each window, 0, 250
 *           and 800 ms apart, at half size as PNGs, compared tile by tile
 *           (16 × 16 CSS px). Tiles that changed in either later look are
 *           grouped by touch; each group is one moving thing, and the part
 *           it belongs to is the deepest element under at least half of
 *           its tiles (each tile looked at in five places, the smallest
 *           thing found standing for it). A window where nothing changed
 *           costs those three looks and nothing more. A forever animation
 *           the stylesheet runs on a part in the window (a blink slower than
 *           the looks) is added even when the looks missed it.
 *   record  every window that has moving parts, once: the window shot as a
 *           JPEG every `every` ms (100) for `seconds` (3.2, or one full
 *           cycle of the slowest stylesheet loop in it, at most 6), the
 *           pointer still off the page. Each moving part is cut from every
 *           shot at its own box, scaled to at most 512 px a side, a frame
 *           it already showed kept once, and the time each frame stood is
 *           kept with it (`steps`, as the canvas flipbooks do). A 2d canvas
 *           of a million px or fewer is left out: capture-route.mjs reads
 *           its pixels itself (`--frames`). A WebGL canvas, or a bigger
 *           one, is pictured here, since its pixels read back blank.
 *   read    the frames of a part, compared through 16 × 16 greys: all the
 *           same is STILL (dropped: the looks caught a one-off); the run
 *           coming back on itself every L frames is a LOOP (its period);
 *           changing and then holding is ONCE; drawing ever further from
 *           its first frame is a DRIFT (a marquee, a scrolling texture);
 *           anything else is LIVE (a shader, a ticker, a noise). Beside the
 *           kind: the properties that changed on the part or inside it
 *           (`what`: opacity, background-position, …), whether its words
 *           changed (`text`, and the words it showed), and who moves it
 *           (`via`: css, script, canvas, video).
 *   pointer at the top of the page: one look with the pointer off the page,
 *           then two with it moved across the window. What changed only
 *           then, and was not moving on its own, is a POINTER part (a
 *           trail, a follower, a spotlight), recorded while the pointer is
 *           swept round a slow circle, the pointer's place kept with every
 *           frame (`pointer`). Something that appears only beside the
 *           pointer belongs to no part: its frames are cut round the sweep.
 *   scroll  at the top of the page: a look at rest and one scrolled 160 px,
 *           the first shifted up by the same, compared. What changed beyond
 *           the shift, and was not moving on its own, is a SCROLL part (a
 *           parallax layer, a header that shrinks, a bar that fills),
 *           recorded over a scroll from 0 to 320 px in 16 steps, the scroll
 *           kept with every frame (`scroll`). A fixed thing that only
 *           stayed put comes out STILL and is dropped.
 *
 * Nothing here changes the page, other than the pointer and the scroll a
 * visitor would move. Every part is named by the recorder's id (`b<n>`).
 * The budget: at most `most` parts a page (16), 36 frames and 2.5 MB a part.
 */

const AWAY = [-5, -5];
const TILE = 16;        /* CSS px a tile when looking for change */
const LOOK_SCALE = 0.5; /* the looks, half size */
const SIDE = 1024;      /* a frame's longest side: a film of a part up to 40% of the window is kept at about its own size, never stretched over the board */

/* ------------------------------------------------------------ in the page */

/** Loads a data address as an image. */
const LOAD = `(src) => new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => no(new Error("no image")); im.src = src; })`;

/**
 * Tiles that differ between two looks of the same window (data addresses,
 * both at `scale`), look B shifted up `shift` CSS px against A (a scroll).
 * Returns the tile grid's size and the changed tiles as [col, row].
 */
const DIFF = `async ({ a, b, scale, tile, shift }) => {
  const load = ${LOAD};
  const [A, B] = await Promise.all([load(a), load(b)]);
  const W = Math.min(A.width, B.width), H = Math.min(A.height, B.height);
  const draw = (im) => { const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(im, 0, 0); return x.getImageData(0, 0, W, H).data; };
  const da = draw(A), db = draw(B);
  const t = Math.max(4, Math.round(tile * scale)), sh = Math.round(shift * scale);
  const cols = Math.floor(W / t), rows = Math.floor((H - sh) / t);
  const out = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    let n = 0;
    for (let y = 0; y < t; y++) {
      const ya = (r * t + y + sh) * W, yb = (r * t + y) * W;
      for (let x = 0; x < t; x++) {
        const pa = (ya + c * t + x) * 4, pb = (yb + c * t + x) * 4;
        if (Math.abs(da[pa] - db[pb]) + Math.abs(da[pa + 1] - db[pb + 1]) + Math.abs(da[pa + 2] - db[pb + 2]) > 48) n++;
      }
    }
    if (n >= 4 && n >= t * t * 0.02) out.push([c, r]);
  }
  return { cols, rows, changed: out, t: t / scale };
}`;

/**
 * Changed tiles grouped by touch, each group's part: the deepest element
 * under most of its tiles whose box holds the whole group. Returns groups
 * as { el (recorder id), box (viewport px), tiles, kind of element }.
 */
const GROUPS = `({ changed, cols, rows, t, skipIds, skip2d }) => {
  const B = window.__sinkBehaviours;
  const set = new Set(changed.map(([c, r]) => c + "," + r));
  const seen = new Set();
  const groups = [];
  for (const [c0, r0] of changed) {
    const k0 = c0 + "," + r0;
    if (seen.has(k0)) continue;
    const stack = [[c0, r0]], tiles = [];
    seen.add(k0);
    while (stack.length) {
      const [c, r] = stack.pop(); tiles.push([c, r]);
      for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) {
        const k = (c + dc) + "," + (r + dr);
        if ((dc || dr) && set.has(k) && !seen.has(k)) { seen.add(k); stack.push([c + dc, r + dr]); }
      }
    }
    groups.push(tiles);
  }
  const skipped = new Set(skipIds ?? []);
  /* What the pointer passes through (pointer-events none: a trail, a follower, a glow), and what is drawn (a canvas, a video: a water behind the words, a trail over them), each with its box: neither is what a hit test under a tile returns. */
  const ghosts = [], drawn = [];
  const seen2 = (e) => { const cs = getComputedStyle(e); if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) return null; const b = e.getBoundingClientRect(); return b.width >= 2 && b.height >= 2 && b.bottom > 0 && b.right > 0 && b.top < innerHeight && b.left < innerWidth ? b : null; };
  for (const e of document.body.querySelectorAll("canvas, video")) { const b = seen2(e); if (b) drawn.push([e, b]); if (drawn.length >= 200) break; }
  for (const e of document.body.querySelectorAll("*")) {
    if (ghosts.length >= 400) break;
    if (getComputedStyle(e).pointerEvents !== "none" || /^(CANVAS|VIDEO)$/.test(e.tagName)) continue;
    const b = seen2(e);
    if (b) ghosts.push([e, b]);
  }
  const drawnAt = (x, y) => { let best = null, area = Infinity; for (const [e, b] of drawn) if (x >= b.left && x <= b.right && y >= b.top && y <= b.bottom && b.width * b.height < area) { best = e; area = b.width * b.height; } return best; };
  const out = [], left = [];
  for (const tiles of groups) {
    const cs = tiles.map(([c]) => c), rs = tiles.map(([, r]) => r);
    const box = [Math.min(...cs) * t, Math.min(...rs) * t, (Math.max(...cs) - Math.min(...cs) + 1) * t, (Math.max(...rs) - Math.min(...rs) + 1) * t];
    /* The element under each tile's middle, and every ancestor of it. A thing the pointer passes through (a trail, a follower, a glow: pointer-events none) is under no hit test, so the smallest such thing over the middle is taken instead. */
    const count = new Map();
    let n = 0;
    const areaOf = (e) => { const b = e.getBoundingClientRect(); return b.width * b.height; };
    for (const [c, r] of tiles) {
      /* Five places in the tile; the smallest thing found under any of them stands for the tile (a 6 px light in a 16 px tile). */
      let el = null, area = Infinity;
      for (const [fx, fy] of [[0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
        const x = c * t + t * fx, y = r * t + t * fy;
        const hit = document.elementFromPoint(x, y);
        if (hit && hit !== document.documentElement) { const a = hit === document.body ? Infinity : areaOf(hit); if (a < area || (el === null)) { el = hit; area = a; } }
        /* A canvas or video under the place, over or behind what the hit test found, is what is drawn there and changes: it stands for the tile. Else a thing the pointer passes through wins when it is smaller. */
        const dr = /^(CANVAS|VIDEO)$/.test(el?.tagName ?? "") ? el : drawnAt(x, y);
        if (dr) { el = dr; area = 0; continue; }
        for (const [e, b] of ghosts) if (x >= b.left && x <= b.right && y >= b.top && y <= b.bottom && b.width * b.height < area) { el = e; area = b.width * b.height; }
      }
      if (!el) continue;
      n++;
      for (let e = el; e && e !== document.documentElement; e = e.parentElement) count.set(e, (count.get(e) ?? 0) + 1);
    }
    if (!n) continue;
    const depth = (e) => { let d = 0; for (; e; e = e.parentElement) d++; return d; };
    let best = null;
    for (const [e, k] of count) {
      const r = e.getBoundingClientRect();
      if (k < n * 0.5 || r.width < 4 || r.height < 4) continue;
      if (!best || depth(e) > depth(best)) best = e;
    }
    if (!best) best = document.body;
    /* The page itself, or a holder as tall as several windows (a main that holds everything): not one moving thing. Its patches are cut round the changed tiles instead. */
    if (best !== document.body) { const r = best.getBoundingClientRect(); if (r.width * r.height > innerWidth * innerHeight * 2) best = document.body; }
    /* A 2d canvas the capture reads itself, or a part already recorded: left out. */
    if (skip2d && best.tagName === "CANVAS" && best.width * best.height <= 1000000) { let gl = null; try { gl = best.getContext("webgl2") || best.getContext("webgl"); } catch { gl = null; } if (!gl) { left.push(B.idOf(best)); continue; } }
    const id = B.idOf(best);
    if (skipped.has(id)) continue;
    const r = best === document.body ? { left: box[0], top: box[1], width: box[2], height: box[3] } : best.getBoundingClientRect();
    const had = out.find((g) => g.el === id);
    if (had) {
      had.tiles += tiles.length;
      /* Two patches of the page itself (a trail's dots): one box round both. */
      if (best === document.body) { const [x0, y0, x1, y1] = [Math.min(had.box[0], box[0]), Math.min(had.box[1], box[1]), Math.max(had.box[0] + had.box[2], box[0] + box[2]), Math.max(had.box[1] + had.box[3], box[1] + box[3])]; had.box = [x0, y0, x1 - x0, y1 - y0]; }
      continue;
    }
    out.push({ el: id, tiles: tiles.length, box: [r.left, r.top, r.width, r.height].map(Math.round), tag: best.tagName.toLowerCase(), self: best !== document.body });
  }
  /* Three or more alike under one parent (a row of bubbles, a string of lights) are one moving thing: the parent, at its box. */
  const byParent = new Map();
  for (const g of out) { const el = B.byId(g.el); if (!el || el === document.body || !el.parentElement || el.parentElement === document.body) continue; const key = el.parentElement; if (!byParent.has(key)) byParent.set(key, []); byParent.get(key).push(g); }
  for (const [parent, gs] of byParent) {
    if (gs.length < 3) continue;
    const alike = gs.every((g) => { const e = B.byId(g.el); return e.tagName === B.byId(gs[0].el).tagName && e.className === B.byId(gs[0].el).className; });
    if (!alike) continue;
    const r = parent.getBoundingClientRect();
    if (r.width * r.height > innerWidth * innerHeight * 2) continue;
    const id = B.idOf(parent);
    if (skipped.has(id)) continue;
    for (const g of gs) out.splice(out.indexOf(g), 1);
    const had = out.find((g) => g.el === id);
    if (had) had.tiles += gs.reduce((s, g) => s + g.tiles, 0);
    else out.push({ el: id, tiles: gs.reduce((s, g) => s + g.tiles, 0), box: [r.left, r.top, r.width, r.height].map(Math.round), tag: parent.tagName.toLowerCase(), self: true, alike: gs.length });
  }
  /* left: the 2d canvases left to the canvas pass; they move on their own, so the pointer and scroll passes leave them too. */
  return { groups: out, left };
}`;

/**
 * Every forever animation of the stylesheet on an element in the window
 * that is not a plain spin or float (those are read exactly elsewhere):
 * its recorder id, box and cycle.
 */
const CSS_LOOPS = `({ skipIds, most }) => {
  const B = window.__sinkBehaviours;
  const skipped = new Set(skipIds ?? []);
  const out = [];
  for (const an of document.getAnimations()) {
    const el = an.effect?.target;
    if (!el || an.effect.pseudoElement || !(el instanceof Element)) continue;
    const t = an.effect.getTiming?.(); if (!t || t.iterations !== Infinity) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
    const dur = Number(t.duration); if (!(dur > 0) || dur > 12000) continue;
    /* One that only moves or turns the part is a spin or a float, read exactly elsewhere (motion-drive.mjs); a look that changes (opacity, colour, a background, a filter) is what wants pictures. */
    let frames = []; try { frames = an.effect.getKeyframes?.() ?? []; } catch { frames = []; }
    if (!frames.some((f) => Object.keys(f).some((k) => !["offset", "easing", "composite", "computedOffset", "transform", "rotate", "translate", "scale"].includes(k)))) continue;
    const id = B.idOf(el);
    if (skipped.has(id) || out.some((o) => o.el === id)) continue;
    const cycle = dur * (/alternate/.test(t.direction) ? 2 : 1);
    out.push({ el: id, box: [r.left, r.top, r.width, r.height].map(Math.round), tag: el.tagName.toLowerCase(), self: true, cycle, name: an.animationName ?? null, tiles: 0 });
    if (out.length >= most) break;
  }
  return out;
}`;

/**
 * What a part looks like now, for telling what changed later: the
 * properties that move on it and inside it (up to 60 descendants), and its
 * words.
 */
/**
 * A FILM MAY ONLY RECORD PIXELS THE ELEMENT ITSELF PAINTS. Left out, with the
 * reason: a canvas or video is its own pixels and always stays; any other
 * element is left out when
 *   - it covers over 40% of the window: a copy over the real parts (the hero
 *     section, 1440 x 991 on thesolface);
 *   - something in it moves by a transform that loops (a spin, a float, a
 *     marquee): the parts in it already carry that motion (the ticker);
 *   - it is a landmark (section, main, header, footer, nav, article, aside)
 *     holding parts of its own (words, pictures, controls);
 *   - it is blended with, or blurs, what is behind it (`mix-blend-mode`,
 *     `backdrop-filter`): its pixels are the page under it (the cursor glow);
 *   - it is a picture, or holds one (an img, a picture, an svg): the picture is
 *     already a part, drawn from its own file (the frog on thesolface was
 *     filmed 409 x 512 and shown at 632 x 881 over the real art);
 *   - it is a bare decoration painted as a translucent gradient or a blur (the
 *     hero's glow): its pixels are the page behind it;
 *   - a fixed part with words, a picture or a control of its own (the header)
 *     lies over it: the shot would hold that part too.
 */
const FILM_OK = `({ ids, side }) => {
  const B = window.__sinkBehaviours;
  const out = {};
  const fixedOnes = Array.from(document.body.querySelectorAll("*")).filter((e) => {
    const cs = getComputedStyle(e);
    if (cs.position !== "fixed" && cs.position !== "sticky") return false;
    if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) < 0.05) return false;
    const r = e.getBoundingClientRect(); if (r.width < 4 || r.height < 4) return false;
    return !!(e.querySelector("a, button, img, svg, picture, input") || (e.textContent ?? "").trim());
  });
  for (const id of ids) {
    const el = B.byId ? B.byId(id) : null;
    out[id] = null;
    if (!el || el === document.body || /^(CANVAS|VIDEO)$/.test(el.tagName)) continue;
    const r = el.getBoundingClientRect();
    if (r.width * r.height > innerWidth * innerHeight * 0.4) { out[id] = "covers over 40% of the window (" + Math.round(r.width) + " x " + Math.round(r.height) + ")"; continue; }
    let loops = false; try { loops = el.getAnimations({ subtree: true }).some((a) => { const t = a.effect?.getTiming?.(); if (!t || t.iterations !== Infinity) return false; const ks = a.effect.getKeyframes?.() ?? []; return ks.length > 0 && ks.every((f) => Object.keys(f).every((k) => ["offset", "easing", "composite", "computedOffset", "transform", "rotate", "translate", "scale"].includes(k))); }); } catch { loops = false; }
    if (loops && el.children.length) { out[id] = "its parts already carry the looping move inside it"; continue; }
    if (/^(SECTION|MAIN|HEADER|FOOTER|NAV|ARTICLE|ASIDE)$/.test(el.tagName) && (el.querySelector("a, button, img, svg, picture, input, h1, h2, h3, p, li") || (el.textContent ?? "").trim())) { out[id] = "a landmark holding parts of its own"; continue; }
    const cs = getComputedStyle(el);
    if (/^(IMG|PICTURE|SVG)$/i.test(el.tagName) || el.querySelector("img, picture, svg")) { out[id] = "a picture, or holding one: the picture is already a part"; continue; }
    if (!el.children.length && !(el.textContent ?? "").trim() && ((cs.filter && /blur\\(/.test(cs.filter)) || /gradient\\(.*(rgba\\([^)]*,\\s*0?\\.\\d+\\)|rgba\\([^)]*,\\s*0\\)|transparent)/.test(cs.backgroundImage))) { out[id] = "a translucent gradient or a blur: its pixels are the page behind it"; continue; }
    if (cs.mixBlendMode !== "normal" || (cs.backdropFilter && cs.backdropFilter !== "none")) { out[id] = "its pixels are the page behind it (blend or backdrop)"; continue; }
    const over = fixedOnes.find((f) => { if (f === el || f.contains(el) || el.contains(f)) return false; const q = f.getBoundingClientRect(); return q.left < r.right && q.right > r.left && q.top < r.bottom && q.bottom > r.top; });
    if (over) out[id] = "a fixed part with parts of its own lies over it";
  }
  return out;
}`;

/** Which of these parts is fixed to the window (itself or an ancestor): its box is a place in the window, whatever the scroll. */
const FIXED_IDS = `({ ids }) => {
  const B = window.__sinkBehaviours;
  return ids.filter((id) => { const el = B.byId ? B.byId(id) : null; for (let n = el; n && n !== document.documentElement; n = n.parentElement) if (getComputedStyle(n).position === "fixed") return true; return false; });
}`;

const LOOK_STYLE = `({ ids }) => {
  const B = window.__sinkBehaviours;
  const PROPS = ["opacity", "transform", "rotate", "translate", "scale", "background-position", "background-color", "background-image", "color", "filter", "clip-path", "width", "height", "left", "top", "box-shadow", "border-color", "visibility", "stroke-dashoffset", "fill", "mask-position"];
  const out = {};
  for (const id of ids) {
    const el = B.byId ? B.byId(id) : null;
    if (!el) { out[id] = null; continue; }
    const els = [el, ...Array.from(el.querySelectorAll("*")).slice(0, 60)];
    const styles = els.map((e) => { const cs = getComputedStyle(e); const o = {}; for (const p of PROPS) o[p] = cs.getPropertyValue(p); return o; });
    let via = "script";
    if (el.tagName === "CANVAS") via = "canvas";
    else if (el.tagName === "VIDEO" || el.querySelector("video")) via = "video";
    else { try { if (el.getAnimations({ subtree: true }).some((a) => a.effect?.getTiming?.().iterations === Infinity || a.playState === "running")) via = "css"; } catch { /* no animations api */ } }
    out[id] = { styles, text: (el.innerText ?? el.textContent ?? "").trim().slice(0, 400), via, n: els.length };
  }
  return out;
}`;

/**
 * The window's shots, each part cut out at its box: a frame it already
 * showed is kept once, with how long each stood (`steps`); a 16 × 16 grey
 * of each frame comes back for the reading. `boxes` are viewport px per
 * shot (a part under the scroll moves; the rest keep one box).
 */
const CROP = `async ({ shots, parts, side }) => {
  const load = ${LOAD};
  const images = [];
  for (const s of shots) images.push(await load(s.src));
  const out = parts.map((p) => ({ el: p.el, frames: [], steps: [], seq: [], times: [], greys: [], bytes: 0, index: new Map(), spoilt: false }));
  const cut = document.createElement("canvas"), cx = cut.getContext("2d", { willReadFrequently: true });
  const tiny = document.createElement("canvas"); tiny.width = 16; tiny.height = 16; const tx = tiny.getContext("2d", { willReadFrequently: true });
  shots.forEach((s, i) => {
    const im = images[i];
    parts.forEach((p, k) => {
      const o = out[k]; if (o.spoilt) return;
      let b = p.boxes ? p.boxes[i] : p.box;
      if (!b) return;
      /* Only what the window shows: a box half off the window is cut at its edge. */
      const x0 = Math.max(0, b[0]), y0 = Math.max(0, b[1]), x1 = Math.min(im.width, b[0] + b[2]), y1 = Math.min(im.height, b[1] + b[3]);
      b = [x0, y0, x1 - x0, y1 - y0];
      if (b[2] < 2 || b[3] < 2) return;
      const scale = Math.min(1, side / Math.max(b[2], b[3]));
      const w = Math.max(1, Math.round(b[2] * scale)), h = Math.max(1, Math.round(b[3] * scale));
      cut.width = w; cut.height = h;
      cx.drawImage(im, b[0], b[1], b[2], b[3], 0, 0, w, h);
      const png = Math.max(w, h) <= 96;
      let url;
      try { url = png ? cut.toDataURL("image/png") : cut.toDataURL("image/jpeg", 0.82); } catch { o.spoilt = true; return; }
      let at = o.index.get(url);
      if (at === undefined) {
        if (o.frames.length >= 120 || o.bytes + url.length > 24000000) { o.spoilt = true; return; }
        at = o.frames.length; o.frames.push(url); o.index.set(url, at); o.bytes += url.length;
        tx.drawImage(cut, 0, 0, 16, 16);
        const d = tx.getImageData(0, 0, 16, 16).data, g = [];
        for (let j = 0; j < d.length; j += 4) g.push(Math.round((d[j] * 299 + d[j + 1] * 587 + d[j + 2] * 114) / 1000));
        o.greys.push(g);
        o.scale = scale; o.w = w; o.h = h;
      }
      o.seq.push(at); o.times.push(s.at);
      const prev = o.steps[o.steps.length - 1];
      if (prev && prev[0] === at) prev[1] += s.dt; else o.steps.push([at, s.dt]);
    });
  });
  return out.map((o) => ({ el: o.el, frames: o.frames, steps: o.steps, seq: o.seq, times: o.times, greys: o.greys, spoilt: o.spoilt, scale: o.scale ?? 1, w: o.w ?? 0, h: o.h ?? 0 }));
}`;

/* -------------------------------------------------------------- the reading */

/** Mean absolute difference of two 16 × 16 greys. */
const dist = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; };

/**
 * What a run of frames does: still, loop (with its period), once, drift or
 * live. `seq` is the frame shown at each shot, `times` when each shot was
 * taken (ms), `greys` one 16 × 16 grey per distinct frame, `every` the
 * pace asked for (a shot can come late, so a loop is looked for in time,
 * not in shots).
 */
export function readRun(seq, greys, times = null, every = 100) {
  const n = seq.length;
  const ts = times ?? seq.map((_, i) => i * every);
  if (greys.length < 2 || n < 3) return { kind: "still" };
  const g = (i) => greys[seq[i]];
  const D = (i, j) => (seq[i] === seq[j] ? 0 : dist(g(i), g(j)));
  let peak = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) peak = Math.max(peak, D(i, j));
  if (peak < 1.5) return { kind: "still" };
  const noise = Math.max(2, peak * 0.12);
  /* Held at the end: changed, then the same frame for the last 40 %. */
  let tail = 0;
  for (let i = n - 1; i > 0 && D(i, i - 1) < noise; i--) tail++;
  if (tail >= n * 0.4 && tail < n - 1) return { kind: "once", peak };
  /* Back on itself every P ms: every shot matched to the shot nearest P later, seen at least twice over. */
  const span = ts[n - 1] - ts[0];
  const slack = every * 0.6;
  for (let P = every * 2.5; P <= span / 2; P += every / 2) {
    /* A shot that lands on a step's edge (a blink read just as it switched) is forgiven: at most a fifth of the pairs may differ. */
    let pairs = 0, off = 0, sum = 0;
    for (let i = 0; i < n; i++) {
      let j = -1, bd = slack;
      for (let k = i + 1; k < n; k++) { const d = Math.abs(ts[k] - ts[i] - P); if (d < bd) { bd = d; j = k; } }
      if (j < 0) continue;
      pairs++; sum += ts[j] - ts[i];
      if (D(i, j) >= noise) off++;
    }
    if (pairs < 3 || off > pairs * 0.2) continue;
    /* Moving within the period, not the same frame throughout. */
    let within = 0;
    for (let i = 0; i < n; i++) for (let k = i + 1; k < n && ts[k] - ts[i] < P; k++) within = Math.max(within, D(i, k));
    if (within < Math.max(noise, peak * 0.7)) continue;
    return { kind: "loop", period: Math.round(sum / pairs), peak };
  }
  /* Ever further from the first frame. */
  let up = 0, down = 0;
  for (let i = 1; i < n; i++) { const d = D(0, i) - D(0, i - 1); if (d > noise * 0.2) up++; else if (d < -noise * 0.2) down++; }
  if (up >= (n - 1) * 0.6 && down <= (n - 1) * 0.15) return { kind: "drift", peak };
  return { kind: "live", peak };
}

/** Which properties differ between two looks of a part's styles, and whether its words did. */
function whatChanged(a, b) {
  if (!a || !b) return { what: [], text: false };
  const what = new Set();
  const m = Math.min(a.styles.length, b.styles.length);
  for (let i = 0; i < m; i++) for (const p of Object.keys(a.styles[i])) if (a.styles[i][p] !== b.styles[i][p]) what.add(p);
  return { what: [...what], text: a.text !== b.text };
}

/** The places of the part and what is inside it (each one's transform's translation, background-position, left and top) read from a look. */
function placeOf(look) {
  if (!look?.styles?.length) return null;
  const nums = (v) => String(v ?? "").match(/-?[\d.]+(?:e-?\d+)?/g)?.map(Number) ?? [];
  return look.styles.flatMap((s) => {
    const m = nums(s.transform);
    const tx = m.length === 16 ? m[12] : m.length === 6 ? m[4] : 0, ty = m.length === 16 ? m[13] : m.length === 6 ? m[5] : 0;
    const bp = nums(s["background-position"]);
    return [tx, ty, bp[0] ?? 0, bp[1] ?? 0, nums(s.left)[0] ?? 0, nums(s.top)[0] ?? 0];
  });
}
/** Whether three looks show one of the part's places only ever growing or only ever shrinking. */
function slides(a, b, c) {
  const A = placeOf(a), B = placeOf(b), C = placeOf(c);
  if (!A || !B || !C || A.length !== B.length || B.length !== C.length) return false;
  return A.some((v, i) => { const d1 = B[i] - v, d2 = C[i] - B[i]; return Math.abs(d1) >= 1 && Math.abs(d2) >= 1 && Math.sign(d1) === Math.sign(d2); });
}

/** Frames thinned to the budget (36 pictures, 2.5 MB), the steps retimed to the kept ones. */
function thin(rec) {
  const bytes = rec.frames.reduce((s, f) => s + f.length, 0);
  const n = Math.max(1, Math.ceil(Math.max(rec.frames.length / 36, bytes / 2_500_000)));
  if (n === 1) return rec;
  const keep = rec.frames.map((_, i) => i).filter((i) => i % n === 0);
  const to = new Map(keep.map((i, k) => [i, k]));
  const steps = [];
  for (const [f, d] of rec.steps) { const k = to.get(f - (f % n)); const prev = steps[steps.length - 1]; if (prev && prev[0] === k) prev[1] += d; else steps.push([k, d]); }
  return { ...rec, frames: keep.map((i) => rec.frames[i]), greys: keep.map((i) => rec.greys[i]), steps };
}

/* ------------------------------------------------------------------ drive */

export async function movingFrames(page, { every = 100, seconds = 3.2, most = 16, bands = 8, skip = [], skip2d = true, late = () => false, log = () => {} } = {}) {
  const vw = page.viewportSize();
  const cdp = await page.context().newCDPSession(page);
  /* The window as it stands: the clip is in page coordinates, so the scroll is the clip's top (`atY`, kept by whoever scrolls). */
  let atY = 0;
  const shot = async (scale = 1, format = "jpeg") => {
    const { data } = await cdp.send("Page.captureScreenshot", { format, ...(format === "jpeg" ? { quality: 85 } : {}), clip: { x: 0, y: atY, width: vw.width, height: vw.height, scale }, fromSurface: true });
    return `data:image/${format};base64,${data}`;
  };
  /* Instant, whatever the page's scroll-behavior; the scroll is read again after the wait, since a page may ease it anyway. */
  const scrollTo = async (y) => { atY = await page.evaluate((y) => { scrollTo({ top: y, left: 0, behavior: "instant" }); return scrollY; }, y); return atY; };
  const readY = async () => { atY = await page.evaluate(() => scrollY); return atY; };
  const wait = (ms) => page.waitForTimeout(ms);
  const evalFn = (src, arg) => page.evaluate(`(${src})(${JSON.stringify(arg)})`);
  const hasById = await page.evaluate(() => typeof window.__sinkBehaviours?.byId === "function");
  /* Parts that may be filmed (FILM_OK); the rest are left out, once, with the reason. A patch of the page itself (no element of its own) is kept. */
  const filmable = async (parts, where) => {
    const ids = parts.filter((p) => p.self !== false).map((p) => p.el);
    if (!ids.length) return parts;
    const why = await evalFn(FILM_OK, { ids, side: SIDE });
    for (const p of parts) if (why[p.el]) { skipped.add(p.el); log(`frames: ${where}: ${p.tag ?? "a part"} at ${JSON.stringify(p.box)} left out of the films: ${why[p.el]}`); }
    return parts.filter((p) => !why[p.el]);
  };
  if (!hasById) { log("frames: the recorder keeps no element list; nothing recorded"); return { frames: [], looked: 0 }; }

  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const nBands = Math.max(1, Math.min(bands, Math.ceil(height / vw.height)));
  await page.mouse.move(AWAY[0], AWAY[1], { steps: 2 });
  const skipped = new Set(skip);
  const found = [];
  const results = [];
  const began = Date.now();

  /** The window shot every `every` ms for `ms`, `boxes` read per shot when `boxesOf` is given. */
  const record = async (ms, { tick = null, count = Infinity } = {}) => {
    const shots = [];
    const t0 = Date.now();
    let last = t0;
    while (shots.length < count && (count !== Infinity || Date.now() - t0 < ms) && !late()) {
      if (tick) await tick(shots.length);
      const began = Date.now();
      const src = await shot(1, "jpeg");
      const now = Date.now();
      shots.push({ src, dt: now - last, at: now - t0 });
      last = now;
      const left = every - (Date.now() - began);
      if (left > 0) await wait(left);
    }
    if (shots.length) shots[0].dt = Math.max(shots[0].dt, every);
    return shots;
  };
  /** Each part's frames read into a record of what it does. */
  /** Two looks after the recording, 130 ms apart: a loop whose cycle divides the window shows the same look twice, so the second tells what moves. */
  const lookAfter = async (ids) => { const a = await evalFn(LOOK_STYLE, { ids }); await wait(130); const b = await evalFn(LOOK_STYLE, { ids }); return { a, b }; };
  const finish = async (cuts, parts, before, after, extra = () => ({})) => {
    for (const cut of cuts) {
      const part = parts.find((p) => p.el === cut.el);
      if (!part || cut.spoilt || cut.frames.length < 2) continue;
      const run = readRun(cut.seq, cut.greys, cut.times, every);
      if (process.env.FRAMES_DEBUG) { try { (await import("node:fs")).appendFileSync(process.env.FRAMES_DEBUG, JSON.stringify({ el: cut.el, seq: cut.seq, times: cut.times, greys: cut.greys, run, box: part.box, boxes: parts.find((p) => p.el === cut.el)?.boxes?.slice(0, 4), frames: cut.frames.length <= 12 ? cut.frames.slice(0, 6) : [] }) + "\n"); } catch { /* debug only */ } }
      if (run.kind === "still") continue;
      const total = cut.steps.reduce((s, [, d]) => s + d, 0);
      const c1 = whatChanged(before[cut.el], after.a[cut.el]), c2 = whatChanged(after.a[cut.el], after.b[cut.el]);
      const change = { what: [...new Set([...c1.what, ...c2.what])], text: c1.text || c2.text };
      const rec = thin({ frames: cut.frames, greys: cut.greys, steps: cut.steps });
      const words = change.text ? [...new Set([before[cut.el]?.text, after.a[cut.el]?.text, after.b[cut.el]?.text].filter(Boolean))] : undefined;
      const more = extra(part, cut, change);
      if (more === null) continue;
      const period = run.kind === "loop" ? run.period : part.cycle ? Math.round(part.cycle) : undefined;
      let kind = run.kind === "live" && part.cycle ? "loop" : run.kind;
      /* Words that changed and never came back (a clock, a price) are no loop, whatever the pictures say. */
      if (kind === "loop" && change.text && !part.cycle) kind = "live";
      /* A pattern slid along (words, a texture) comes back to look like its first frame at every repeat: a place that only ever grows or only ever shrinks across the three looks says it is a drift. */
      if (kind === "live" && slides(before[cut.el], after.a[cut.el], after.b[cut.el])) kind = "drift";
      results.push({
        el: part.el, kind, box: part.pageBox, w: cut.w, h: cut.h, scale: Math.round(cut.scale * 1000) / 1000, every, ms: Math.round(total),
        frames: rec.frames, steps: rec.steps.map(([f, d]) => [f, Math.round(d)]),
        ...(period ? { period } : {}), ...(part.name ? { name: part.name } : {}), ...(part.alike ? { alike: part.alike } : {}),
        what: change.what, ...(change.text ? { text: true, words } : {}), via: before[cut.el]?.via ?? "script", self: part.self !== false,
        ...more,
      });
      skipped.add(part.el);
    }
  };

  /* ------------------------------------------------------------ find and record, a window at a time */
  /* Past the run's deadline (capture-route.mjs `--deadline`), no more is looked for: what was recorded is kept. */
  for (let band = 0; band < nBands && results.length < most && !late(); band++) {
    let scrollY = await scrollTo(band * vw.height);
    if (band && scrollY < band * vw.height - vw.height / 2) break;
    await wait(band === 0 ? 300 : 900);
    scrollY = await readY();
    const a = await shot(LOOK_SCALE, "png");
    await wait(250);
    const b = await shot(LOOK_SCALE, "png");
    await wait(550);
    const c = await shot(LOOK_SCALE, "png");
    const d1 = await evalFn(DIFF, { a, b, scale: LOOK_SCALE, tile: TILE, shift: 0 });
    const d2 = await evalFn(DIFF, { a, b: c, scale: LOOK_SCALE, tile: TILE, shift: 0 });
    const changed = [...new Map([...d1.changed, ...d2.changed].map((t) => [t.join(","), t])).values()];
    const { groups, left } = changed.length ? await evalFn(GROUPS, { changed, cols: d1.cols, rows: d1.rows, t: d1.t, skipIds: [...skipped], skip2d }) : { groups: [], left: [] };
    for (const id of left) skipped.add(id);
    const loops = await evalFn(CSS_LOOPS, { skipIds: [...skipped, ...groups.map((g) => g.el)], most });
    const picked = [...groups.sort((p, q) => q.tiles - p.tiles), ...loops].slice(0, most - results.length);
    /* A fixed part is at the same place in the window in every window: its box is not moved down by the scroll. */
    const fixedHere = new Set(picked.length ? await evalFn(FIXED_IDS, { ids: picked.map((g) => g.el) }) : []);
    const parts = await filmable(picked.map((g) => ({ ...g, pageBox: [g.box[0], g.box[1] + (fixedHere.has(g.el) ? 0 : scrollY), g.box[2], g.box[3]] })), "window " + (band + 1));
    found.push({ band, changed: changed.length, parts: parts.length });
    if (!parts.length) continue;
    const ids = parts.map((p) => p.el);
    const cycle = Math.max(0, ...parts.map((p) => p.cycle ?? 0));
    const ms = Math.round(Math.max(seconds * 1000, Math.min(6000, cycle + 300)));
    const before = await evalFn(LOOK_STYLE, { ids });
    const shots = await record(ms);
    const after = await lookAfter(ids);
    const cuts = await evalFn(CROP, { shots, parts: parts.map((p) => ({ el: p.el, box: p.box })), side: SIDE });
    await finish(cuts, parts, before, after);
    log(`frames: window ${band + 1} of ${nBands}: ${changed.length} tiles changed, ${parts.length} moving part${parts.length === 1 ? "" : "s"}, ${shots.length} shots over ${ms} ms`);
  }

  /* ------------------------------------------------------------ the pointer */
  await scrollTo(0);
  await page.mouse.move(AWAY[0], AWAY[1], { steps: 2 });
  await wait(400);
  if (results.length < most && !late()) {
    const a = await shot(LOOK_SCALE, "png");
    const p1 = [Math.round(vw.width * 0.3), Math.round(vw.height * 0.35)], p2 = [Math.round(vw.width * 0.65), Math.round(vw.height * 0.6)];
    await page.mouse.move(p1[0], p1[1], { steps: 12 });
    await wait(120);
    const b = await shot(LOOK_SCALE, "png");
    await page.mouse.move(p2[0], p2[1], { steps: 12 });
    await wait(400);
    const c = await shot(LOOK_SCALE, "png");
    const d1 = await evalFn(DIFF, { a, b, scale: LOOK_SCALE, tile: TILE, shift: 0 });
    const d2 = await evalFn(DIFF, { a, b: c, scale: LOOK_SCALE, tile: TILE, shift: 0 });
    const changed = [...new Map([...d1.changed, ...d2.changed].map((t) => [t.join(","), t])).values()];
    /* Read while the pointer is still over the page: what follows it is there to be found. A 2d canvas is pictured here too: the canvas pass never moves the pointer. */
    const { groups } = changed.length ? await evalFn(GROUPS, { changed, cols: d1.cols, rows: d1.rows, t: d1.t, skipIds: [...skipped], skip2d: false }) : { groups: [] };
    await page.mouse.move(AWAY[0], AWAY[1], { steps: 2 });
    const parts = await filmable(groups.sort((p, q) => q.tiles - p.tiles).slice(0, most - results.length).map((g) => ({ ...g, pageBox: [g.box[0], g.box[1], g.box[2], g.box[3]] })), "pointer");
    if (parts.length) {
      /* The pointer round a slow circle through the middle of the window; a trail that belongs to no part is cut round the circle. */
      const cx = vw.width / 2, cy = vw.height / 2, rx = vw.width * 0.22, ry = vw.height * 0.22;
      const ms = Math.round(seconds * 1000);
      const steps = Math.ceil(ms / every);
      const path = [];
      const at = (k) => [Math.round(cx + rx * Math.cos((k / steps) * 2 * Math.PI)), Math.round(cy + ry * Math.sin((k / steps) * 2 * Math.PI))];
      const sweep = [Math.round(cx - rx - 40), Math.round(cy - ry - 40), Math.round(2 * rx + 80), Math.round(2 * ry + 80)];
      for (const p of parts) if (!p.self) { p.box = sweep; p.pageBox = sweep; }
      await page.mouse.move(...at(0), { steps: 6 });
      await wait(200);
      const ids = parts.map((p) => p.el);
      const before = await evalFn(LOOK_STYLE, { ids });
      const shots = await record(ms, { tick: async (k) => { const p = at(k); await page.mouse.move(p[0], p[1], { steps: 3 }); path.push(p); } });
      const after = await lookAfter(ids);
      await page.mouse.move(AWAY[0], AWAY[1], { steps: 2 });
      const cuts = await evalFn(CROP, { shots, parts: parts.map((p) => ({ el: p.el, box: p.box })), side: SIDE });
      /* A run that comes back on itself, or a stylesheet loop, moves with the clock, not the pointer: it is kept as what it is. */
      await finish(cuts, parts, before, after, (part, cut) => (part.cycle || readRun(cut.seq, cut.greys, cut.times, every).kind === "loop" ? {} : { kind: "pointer", pointer: path.slice(0, shots.length) }));
      log(`frames: pointer: ${changed.length} tiles changed, ${parts.length} part${parts.length === 1 ? "" : "s"} moving with it`);
    }
    found.push({ band: "pointer", changed: changed.length, parts: parts.length });
  }

  /* ------------------------------------------------------------ the scroll */
  if (results.length < most && height > vw.height + 200 && !late()) {
    const SHIFT = 160;
    await scrollTo(0);
    await wait(300);
    const a = await shot(LOOK_SCALE, "png");
    await scrollTo(SHIFT);
    await wait(500);
    const b = await shot(LOOK_SCALE, "png");
    const d = await evalFn(DIFF, { a, b, scale: LOOK_SCALE, tile: TILE, shift: SHIFT });
    /* The groups are read on the scrolled page, where its tiles are. */
    const { groups } = d.changed.length ? await evalFn(GROUPS, { changed: d.changed, cols: d.cols, rows: d.rows, t: d.t, skipIds: [...skipped], skip2d: false }) : { groups: [] };
    const parts = await filmable(groups.sort((p, q) => q.tiles - p.tiles).slice(0, most - results.length).map((g) => ({ ...g, pageBox: [g.box[0], g.box[1] + SHIFT, g.box[2], g.box[3]] })), "scroll");
    if (parts.length) {
      await scrollTo(0);
      await wait(300);
      const ids = parts.map((p) => p.el);
      const before = await evalFn(LOOK_STYLE, { ids });
      const ys = [], boxes = parts.map(() => []);
      const n = 16, step = 20;
      /* Three shots held at the end: a part still changing with the scroll stopped moves on its own (a follower settling), not with the scroll. */
      const shots = await record(n * every, { count: n + 3, tick: async (k) => {
        const y = await scrollTo(Math.min(k, n) * step);
        const rects = await page.evaluate(async ({ ids }) => { await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); const B = window.__sinkBehaviours; return ids.map((id) => { const el = B.byId(id); if (!el || el === document.body) return null; const r = el.getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map(Math.round); }); }, { ids });
        ys.push(y);
        rects.forEach((r, i) => boxes[i].push(r ?? parts[i].box));
      } });
      const after = await lookAfter(ids);
      const cuts = await evalFn(CROP, { shots, parts: parts.map((p, i) => ({ el: p.el, box: p.box, boxes: boxes[i].slice(0, shots.length) })), side: SIDE });
      /* The scroll's own part changes something of its own with the scroll (a position, a size, a colour, its words): a fixed thing with the page passing behind its corners does not. */
      await finish(cuts, parts, before, after, (part, cut, change) => { const m = cut.seq.length; const own = change.what.length || change.text; const settled = !(m >= 3 && cut.seq[m - 1] !== cut.seq[m - 2] && dist(cut.greys[cut.seq[m - 1]], cut.greys[cut.seq[m - 2]]) >= 2); return own && settled ? { kind: "scroll", scroll: ys.slice(0, shots.length) } : null; });
      log(`frames: scroll: ${d.changed.length} tiles changed beyond the shift, ${parts.length} part${parts.length === 1 ? "" : "s"} moving with it`);
    }
    found.push({ band: "scroll", changed: d.changed.length, parts: parts.length });
  }

  await scrollTo(0);
  await page.mouse.move(AWAY[0], AWAY[1], { steps: 2 });
  await cdp.detach().catch(() => {});
  log(`frames: ${results.length} moving part${results.length === 1 ? "" : "s"} pictured (${results.map((r) => r.kind).join(", ") || "none"}) in ${Math.round((Date.now() - began) / 100) / 10} s`);
  return { frames: results, looked: found };
}
