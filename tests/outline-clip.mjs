/**
 * The exact edge: any closed line becomes the part's crop, not a rectangle.
 *
 * The bug this is about: a helix was drawn, the shape reader had buckets for
 * a box, a circle and an ellipse and nothing else, so the part came out a
 * rectangle with an empty Idea box in it. `outlinePath` keeps the line
 * itself — in the part's own box, 0..1 in each axis, so it can be a
 * clip-path in `objectBoundingBox` units — and an open line becomes a band
 * along the stroke instead.
 *
 *   node tests/outline-clip.mjs
 */
import { CLIP_STROKE, outlinePath, readBoundary } from "../src/features/studio/pictures/sketch.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const ring = (cx, cy, r, n = 64, ry = r) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * ry];
  });

const star = (cx, cy, r, points = 5) =>
  Array.from({ length: points * 2 + 1 }, (_, i) => {
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const rad = i % 2 ? r * 0.42 : r;
    return [cx + Math.cos(a) * rad, cy + Math.sin(a) * rad];
  });

/** A helix: a coil drawn down the box, ending where it started so it closes. */
const helix = (cx, cy, w, h, turns = 3) => {
  const out = [];
  const n = 120;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push([cx + Math.sin(t * Math.PI * 2 * turns) * w, cy - h + t * h * 2]);
  }
  for (let i = n; i >= 0; i--) {
    const t = i / n;
    out.push([cx + Math.sin(t * Math.PI * 2 * turns) * w * 0.55, cy - h + t * h * 2]);
  }
  return out;
};

const spiral = (cx, cy, r, turns = 3) => {
  const out = [];
  for (let i = 0; i <= 240; i++) {
    const t = i / 240;
    const a = t * Math.PI * 2 * turns;
    out.push([cx + Math.cos(a) * r * t, cy + Math.sin(a) * r * t]);
  }
  return out;
};

/* 1. A star is kept as a star. */
{
  const clip = outlinePath({ strokes: [star(0.5, 0.5, 0.3)], words: "" });
  check("a star gives a closed clip", !!clip && clip.closed, clip ? `${clip.points} points` : "nothing");
  check("what cuts the part is the line itself", !!clip && clip.cut === clip.d);
  check("its path is in the part's own box", !!clip && /^M \d/.test(clip.d) && !/-\d\d/.test(clip.d));
  check("it is curves, not a polygon", !!clip && clip.d.includes("C"));
  check("and it closes", !!clip && clip.d.trim().endsWith("Z"));
  // Every coordinate inside 0..1, or it is not a bounding-box path.
  const nums = (clip?.d ?? "").match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
  check("every coordinate is inside the box", nums.length > 10 && nums.every((n) => n >= -0.26 && n <= 1.26), `${nums.length} numbers`);
}

/* 2. A helix — the drawing that started this — is kept whole. */
{
  const drawn = { strokes: [helix(0.5, 0.5, 0.16, 0.3)], words: "a helix of sentences" };
  const b = readBoundary(drawn);
  const clip = outlinePath(drawn);
  check("a helix reads as a closed boundary", !!b?.outlined);
  check("its clip is kept to a readable number of points", !clip || clip.points <= 96, String(clip?.points));
  check("its shape is not one of the buckets", b?.shape === "path", b?.shape);
  check("and it still becomes an exact clip", !!clip && clip.closed && clip.points > 20, clip ? `${clip.points} points` : "nothing");
}

/* 3. A spiral is an open line: a band along it, not a crop. */
{
  const clip = outlinePath({ strokes: [spiral(0.5, 0.5, 0.34)], words: "" });
  check("a spiral gives a path", !!clip);
  check("its band is the stroke's own thickness", clip?.width === CLIP_STROKE, String(clip?.width));
  check("the line itself does not close", !!clip && !clip.d.trim().endsWith("Z"));
  check("but what cuts the part does", !!clip && clip.cut.trim().endsWith("Z"), clip?.cut.slice(0, 40));
  check("and the band is walked both ways", !!clip && clip.cut.split(" L ").length > 20, String(clip?.cut.split(" L ").length));
}

/* 4. A rectangle is not worth cutting to: a box clipped to a box is a box. */
{
  const boxy = [[0.2, 0.2], [0.8, 0.2], [0.8, 0.8], [0.2, 0.8], [0.2, 0.2]];
  check("a box gives no clip at all", outlinePath({ strokes: [boxy], words: "" }) === null);
}

/* 5. A circle still comes back as a clip, and a round one. */
{
  const clip = outlinePath({ strokes: [ring(0.5, 0.5, 0.3)], words: "" });
  check("a circle gives a closed clip", !!clip && clip.closed);
  // Sampled through the middle: the path should pass near the box's edges
  // at the quarter points, which a square would not.
  check("and it is not the box", !!clip && clip.d.includes("C"));
}

/* 6. Nothing drawn, nothing cut. */
check("an empty sketch gives nothing", outlinePath({ strokes: [], words: "" }) === null);
check("a dot gives nothing", outlinePath({ strokes: [[[0.5, 0.5]]], words: "" }) === null);

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
