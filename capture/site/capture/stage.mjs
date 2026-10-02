/**
 * WHAT A CANVAS WORLD IS MADE OF (worlds.mjs `stage`, polio parts/World.tsx).
 *
 * The owner, comparing at 2000 wide: the page's world is no loop. Its pets
 * wander where they like, drawn at the canvas's own size, so a wider window
 * is a wider meadow; a flipbook scaled to cover the box made them huge, cut
 * and looping. So besides where each character stood, the capture reads what
 * the world is drawn from, out of the calls the page made to draw it (the
 * held frames of worlds.mjs, recorded by world-recorder.js), knowing nothing
 * of the page's script:
 *
 *   the fill      the colour a whole-canvas fill painted first (`sky`);
 *   backgrounds   pictures drawn big (a twelfth of the canvas or more): where
 *                 they stand above the foot, and whether they repeat across
 *                 (tiles side by side a picture's width apart) from the left
 *                 or from the middle;
 *   characters    the sprites that answered a press with each one: its body
 *                 (the biggest), the one it shows going right and going left,
 *                 its home and how far it went either side (shares of the
 *                 width), its foot above the ground, its pace; one much
 *                 smaller that kept the same offset on another's upper half
 *                 rides it (a parasite on its host), where it sat;
 *   labels        the words drawn over a character (fillText) and the boxes
 *                 filled behind them: the face, the colours, the height;
 *   props         small pictures no press answered, standing in one place,
 *                 their frames and how long each stood.
 *
 * Pure: the frames in, the stage out. `assemble` is what worlds.mjs calls.
 */

const E = 1.5;
const big = (d, art) => d.w * d.h >= (art.w * art.h) / 12;
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };

/** A sprite's name: its picture and the piece of it. */
export const spriteKey = (d) => `${d.k}|${d.s.map((v) => Math.round(v)).join(",")}`;

/**
 * One scene out of its held frames.
 *   frames: [{ draws: [{ t:"img"|"fill"|"text", ... }], sky, hits: [{ key, s, x, y, w, h }] }] in art px
 *   art:    { w, h } the canvas's own size
 *   every:  ms between frames
 * Returns { sky, layers, props, chars: Map key -> fields, label }.
 */
export function readScene(frames, art, every) {
  const out = { sky: null, layers: [], props: [], chars: new Map(), label: null };
  out.sky = frames.map((f) => f.sky).find(Boolean) ?? null;

  /* Backgrounds: the big pictures of the first frame, grouped by piece and height. */
  const f0 = frames[0]?.draws ?? [];
  const groups = new Map();
  for (const d of f0.filter((d) => d.t === "img" && big(d, art))) {
    const g = `${spriteKey(d)}@${Math.round(d.y)}`;
    (groups.get(g) ?? groups.set(g, []).get(g)).push(d);
  }
  for (const list of groups.values()) {
    const d = list[0], xs = list.map((q) => Math.round(q.x)).sort((a, b) => a - b);
    const repeat = xs.length > 1 && xs.every((x, i) => i === 0 || Math.abs(x - xs[i - 1] - d.w) <= E);
    let side = "left", x = Math.round(d.x);
    if (repeat) {
      /* From the middle when the tiles sit where tiles laid out from the middle would. */
      const centre = ((Math.round((art.w - d.w) / 2) % d.w) + d.w) % d.w, first = ((xs[0] % d.w) + d.w) % d.w;
      side = Math.abs(first - centre) <= E || Math.abs(first - centre) >= d.w - E ? "centre" : "left";
      x = 0;
    } else if (d.x + d.w / 2 > art.w * 0.6) { side = "right"; x = Math.round(art.w - d.x - d.w); }
    out.layers.push({ k: d.k, s: d.s, w: Math.round(d.w), h: Math.round(d.h), bottom: Math.round(art.h - d.y - d.h), repeat, side, x });
  }

  /* Each character's sprites, frame by frame. */
  const seen = new Map(); /* key -> [{ f, s, x, y, w, h }] (its body: the biggest that answered) */
  frames.forEach((fr, f) => {
    const byKey = new Map();
    for (const h of fr.hits ?? []) { const cur = byKey.get(h.key); if (!cur || h.w * h.h > cur.w * cur.h) byKey.set(h.key, h); }
    for (const [key, h] of byKey) (seen.get(key) ?? seen.set(key, []).get(key)).push({ f, s: h.s, x: h.x, y: h.y, w: h.w, h: h.h });
  });
  const cx = (b) => b.x + b.w / 2;
  for (const [key, list] of seen) {
    /* Which way it went in each frame, from the frame before. */
    const dir = new Map();
    for (let i = 1; i < list.length; i++) if (list[i].f === list[i - 1].f + 1) { const dx = cx(list[i]) - cx(list[i - 1]); if (Math.abs(dx) > 0.5) dir.set(list[i].f, Math.sign(dx)); }
    const right = list.find((b) => dir.get(b.f) === 1)?.s, left = list.find((b) => dir.get(b.f) === -1)?.s;
    const face0 = dir.size ? [...dir.values()][0] : 1;
    const sprite = {};
    if (right) sprite.r = right; if (left && left !== right) sprite.l = left;
    if (!right && !left) sprite[face0 > 0 ? "r" : "l"] = list[0].s;
    const xs = list.map(cx), moved = [];
    for (let i = 1; i < list.length; i++) if (list[i].f === list[i - 1].f + 1) moved.push(Math.abs(cx(list[i]) - cx(list[i - 1])));
    const pace = moved.filter((m) => m > 0.5);
    out.chars.set(key, {
      sprite, face: face0,
      at: +(((Math.min(...xs) + Math.max(...xs)) / 2) / art.w).toFixed(4),
      range: +Math.max(0.02, (Math.max(...xs) - Math.min(...xs)) / 2 / art.w).toFixed(4),
      foot: Math.round(art.h - Math.max(...list.map((b) => b.y + b.h))),
      ...(pace.length ? { speed: +(median(pace) / (every / 1000)).toFixed(2) } : {}),
      boxes: list,
    });
  }
  /* A rider: one that kept the same offset on another, bigger one, in every frame both were seen, while that one moved. */
  for (const [key, c] of out.chars) {
    let best = null;
    for (const [hk, h] of out.chars) {
      if (hk === key) continue;
      const pairs = c.boxes.map((b) => [b, h.boxes.find((q) => q.f === b.f)]).filter(([, q]) => q);
      if (pairs.length < Math.max(2, c.boxes.length * 0.6)) continue;
      /*
       * A rider is much smaller than what it rides (under half its size) and
       * sits on its upper half. A host standing still in the row behind
       * another keeps a steady offset too, and overlaps it: that is a
       * neighbour, not a rider (parasiteonsol.fun's back rows came out
       * stacked on the front ones).
       */
      if (!pairs.every(([b, q]) => b.w * b.h < q.w * q.h * 0.5 && b.y + b.h <= q.y + q.h * 0.6 && b.x + b.w / 2 >= q.x - 2 && b.x + b.w / 2 <= q.x + q.w + 2)) continue;
      /* Across, as it sat or as it sits on its host turned the other way (the host's width less its own). */
      const offs = pairs.map(([b, q]) => [b.x - q.x, b.y - q.y, q.w - (b.x - q.x) - b.w]);
      const steady = offs.every(([dx, dy, mx]) => Math.abs(dy - offs[0][1]) <= 2 && (Math.abs(dx - offs[0][0]) <= 2 || Math.abs(mx - offs[0][0]) <= 2));
      if (!steady) continue;
      if (!best || h.boxes[0].w * h.boxes[0].h > best.h.boxes[0].w * best.h.boxes[0].h) best = { hk, h, off: offs[0], face: h.face };
    }
    if (best) { c.rides = best.hk; c.ride = best.off.slice(0, 2).map(Math.round); c.face = best.face; }
  }

  /* Labels: the words drawn just over a character's stack, the boxes filled behind them. */
  const draws = f0;
  for (const [key, c] of out.chars) {
    if (c.rides) continue;
    const b = c.boxes.find((q) => q.f === 0);
    if (!b) continue;
    const texts = draws.filter((d) => d.t === "text" && d.x >= b.x - 40 && d.x <= b.x + b.w + 40 && d.y <= b.y + 2 && d.y >= b.y - 120);
    const t = texts.sort((p, q) => Math.abs(p.x + p.w / 2 - cx(b)) - Math.abs(q.x + q.w / 2 - cx(b)))[0];
    if (!t) continue;
    c.label = t.text;
    if (!out.label) {
      const i = draws.indexOf(t);
      const fills = draws.slice(Math.max(0, i - 3), i).filter((d) => d.t === "fill" && d.x <= t.x + 1 && d.x + d.w >= t.x + t.w - 1);
      const bg = fills[fills.length - 1], edge = fills.length > 1 ? fills[fills.length - 2] : null;
      out.label = { font: t.font, fg: t.style, bg: bg?.style ?? "#ffffff", ...(edge ? { edge: edge.style } : {}), h: Math.round(bg?.h ?? 9), pad: Math.max(0, Math.round(t.x - (bg?.x ?? t.x))) };
    }
  }

  /* Props: small pictures no press answered, in one place across the frames. */
  const answered = new Set(frames.flatMap((f) => (f.hits ?? []).map((h) => `${Math.round(h.x)},${Math.round(h.y)},${h.s}`)));
  const spots = [];
  frames.forEach((fr, f) => {
    for (const d of fr.draws.filter((d) => d.t === "img" && !big(d, art))) {
      const s = spriteKey(d);
      if (answered.has(`${Math.round(d.x)},${Math.round(d.y)},${s}`)) continue;
      let spot = spots.find((p) => Math.abs(p.x - d.x) <= 3 && Math.abs(p.y + p.h - (d.y + d.h)) <= 3 && Math.abs(p.w - d.w) <= 6);
      if (!spot) { spot = { x: d.x, y: d.y, w: d.w, h: d.h, frames: [], seen: new Set(), at: [] }; spots.push(spot); }
      if (!spot.seen.has(f)) { spot.seen.add(f); spot.at.push({ f, s, d }); }
    }
  });
  for (const p of spots) {
    /* In every frame, never moving: a prop. Something that came and went, or moved, is not one. */
    if (p.seen.size < frames.length) continue;
    const order = [];
    for (const a of p.at) if (!order.find((o) => o.s === a.s)) order.push(a);
    const changes = p.at.filter((a, i) => i > 0 && a.s !== p.at[i - 1].s).length;
    const rightSide = p.x + p.w / 2 > art.w / 2;
    out.props.push({
      frames: order.map((o) => ({ k: o.d.k, s: o.d.s })),
      every: changes ? Math.round((frames.length * every) / changes) : 1000,
      side: rightSide ? "right" : "left",
      x: Math.round(rightSide ? art.w - p.x - p.w : p.x),
      bottom: Math.round(art.h - p.y - p.h),
    });
  }
  return out;
}

/**
 * The stage from its scenes: every picture a sprite, a background or a prop
 * is cut from, named once; each sprite `[image, sx, sy, sw, sh]`; each
 * character's fields by key, for worlds.mjs to put on its character.
 */
export function assemble({ scenes, art, px, scaleAt, every }) {
  const images = [], imageOf = new Map(), sprites = {}, spriteOf = new Map();
  const img = (k) => { if (!imageOf.has(k)) { imageOf.set(k, images.length); images.push(k); } return imageOf.get(k); };
  const sprite = (k, s) => {
    const name = `${k}|${s.map((v) => Math.round(v)).join(",")}`;
    if (!spriteOf.has(name)) { const id = `s${spriteOf.size.toString(36)}`; spriteOf.set(name, id); sprites[id] = [img(k), ...s.map((v) => Math.round(v))]; }
    return spriteOf.get(name);
  };
  const byName = (name) => { const i = name.lastIndexOf("|"); return sprite(name.slice(0, i), name.slice(i + 1).split(",").map(Number)); };
  const chars = new Map();
  let label = null;
  const out = scenes.map((sc, n) => {
    label ??= sc.read.label;
    for (const [key, c] of sc.read.chars) {
      if (chars.has(key)) continue;
      chars.set(key, {
        scene: n,
        sprite: Object.fromEntries(Object.entries(c.sprite).map(([f, name]) => [f, byName(name)])),
        face: c.face, at: c.at, range: c.range, foot: c.foot,
        ...(c.speed ? { speed: c.speed } : {}), ...(c.label ? { label: c.label } : {}),
        ...(c.rides ? { ridesKey: c.rides, ride: c.ride } : {}),
      });
    }
    return {
      name: sc.name ?? null, sky: sc.read.sky, ...(sc.tab ? { tab: sc.tab } : {}),
      layers: sc.read.layers.map((l) => ({ img: img(l.k), sx: Math.round(l.s[0]), sy: Math.round(l.s[1]), sw: Math.round(l.s[2]), sh: Math.round(l.s[3]), w: l.w, h: l.h, bottom: l.bottom, repeat: l.repeat, side: l.side, x: l.x })),
      props: sc.read.props.map((p) => ({ frames: p.frames.map((f) => sprite(f.k, f.s)), every: p.every, side: p.side, x: p.x, bottom: p.bottom })),
    };
  });
  const speeds = [...chars.values()].map((c) => c.speed).filter(Boolean);
  return {
    stage: {
      px, ...(scaleAt?.length ? { scaleAt } : {}), art, images, sprites, scenes: out, start: 0,
      ...(label ? { label } : {}),
      motion: { speed: speeds.length ? +median(speeds).toFixed(2) : 7, pause: [1.5, 4], stop: 0.08 },
    },
    chars,
  };
}
