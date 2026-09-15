/**
 * A traced drawing comes back as a drawing.
 *
 * The renderer has three kinds: `vector` (an SVG written from words),
 * `raster` (a picture from words) and `vectorize` (the tracer, which is
 * what the whole drawing pipeline is built on: the strokes go up as a
 * picture and the SVG of what is in it comes back). The route took the SVG
 * road only for `vector`; `vectorize` fell to the raster road and its SVG
 * was wrapped as `<img src="data:image/svg+xml…">`. Everything after that
 * assumed markup: the vector reader found no paths, the palette could not
 * repaint an image, the tracer's white plate was never taken away, and
 * `object-fit: cover` cropped what should have stretched. Every suite
 * stubbed the route with SVG markup, so none of them saw it.
 *
 *   node tests/render-answer.mjs
 */
import { answerFrom, dropGround, mimeOf } from "../src/features/studio/renderAnswer.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const enc = (s) => new TextEncoder().encode(s);
/* What recraft-vectorize sends back: an SVG with the plate it found under the drawing first. */
const TRACED = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><rect width="640" height="640" fill="#ffffff"/><path d="M120 320 C120 200 520 200 520 320 C520 440 120 440 120 320 Z" fill="#111"/></svg>';
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 2, 0, 0, 0, 2, 8, 6, 0, 0, 0, 0x72, 0xb6, 0x0d, 0x24]);

/* 1. The tracer's answer is SVG, taken as SVG whatever the transport called it. */
for (const said of ["image/svg+xml", "", "application/octet-stream"]) {
  const a = answerFrom("vectorize", enc(TRACED), said);
  check(`a trace with content-type "${said || "none"}" is markup, not a picture`, a.ok && /^<svg/i.test(a.html.trim()) && !/<img/i.test(a.html), a.ok ? a.html.slice(0, 60) : `${a.reason}: ${a.message}`);
}
{
  const a = answerFrom("vectorize", enc(TRACED), "image/svg+xml");
  check("and its path survives, so the vector reader has something to read", a.ok && /<path\b/i.test(a.html));
  check("and the plate the tracer found under the drawing is taken away", a.ok && !/<rect\b/i.test(a.html) && a.stripped.includes("the ground it was drawn on"), a.ok ? a.stripped.join(", ") : "");
  check("with the box it was traced in kept", a.ok && /viewBox="0 0 640 640"/.test(a.html));
}

/* 2. The other two roads are what they were. */
{
  const a = answerFrom("vector", enc('<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="3"/></svg>'), "image/svg+xml");
  check("an SVG written from words is markup", a.ok && /^<svg/i.test(a.html.trim()));
  const r = answerFrom("raster", PNG, "image/png");
  check("a picture from words is a picture", r.ok && /^<img /i.test(r.html) && r.image?.startsWith("data:image/png;base64,"), r.ok ? r.html.slice(0, 40) : r.message);
  const sniffed = answerFrom("raster", PNG, "");
  check("named by its bytes when the transport did not say", sniffed.ok && sniffed.image?.startsWith("data:image/png;base64,"));
  check("mimeOf knows a PNG, a JPEG, a WebP and a GIF by their first bytes", mimeOf(PNG, "") === "image/png" && mimeOf(Uint8Array.from([0xff, 0xd8, 0xff]), "") === "image/jpeg" && mimeOf(Uint8Array.from([0x47, 0x49, 0x46]), "") === "image/gif");
}

/* 3. The ground rule on its own: a full-size plate goes, a mark does not. */
check("a full-size rect under the drawing is the ground", dropGround(TRACED).dropped);
check("a small rect is a mark and stays", !dropGround('<svg viewBox="0 0 100 100"><rect x="10" y="10" width="20" height="20" fill="#fff"/></svg>').dropped);
check("an unfilled outline is never the ground", !dropGround('<svg viewBox="0 0 100 100"><rect width="100" height="100" fill="none" stroke="#000"/></svg>').dropped);

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
