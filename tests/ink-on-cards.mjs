/**
 * THE INK ON A CARD, AGAINST THE CARD'S OWN FACE.
 *
 * J's note was that the marks on a card matched the card instead of standing
 * out from it, and the reason it happened is worth keeping: a construct's
 * face is one of his renders, which is not one value. It is near-black
 * between the filaments and bright along them, so a colour picked against
 * "the green" is picked against an average that exists nowhere on the card.
 * Small print at 0.62 lightness measured 2.8:1 on the dark parts and worse
 * on the lit ones, and three quarters of every small line on a board was
 * under 4.5:1.
 *
 * So this measures rather than asserts, and it measures the right thing:
 * every mark is shot twice, once as it is and once with that one node
 * hidden. The pixels that changed are the mark; the same pixels in the
 * second shot are the face directly behind it. The number is the mark
 * against its own face, pixel for pixel, not against an average of anything.
 *
 * Only the core of a mark counts. An antialiased glyph edge is a blend of
 * ink and face by definition and would fail every design ever drawn, so the
 * reading is the pixels the mark actually covers — those whose change is
 * most of the largest change in the patch.
 *
 * Two bars, and they are WCAG's own: 4.5:1 for the tenth-worst pixel in a
 * hundred, and 3:1 for the very worst, which is where the core cut still has
 * a little of the edge in it.
 *
 *   node tests/ink-on-cards.mjs [url]     # default http://localhost:3000
 */
import { readFileSync } from "node:fs";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const timeline = readFileSync("src/features/studio/Timeline.tsx", "utf8");
const drawn = timeline.slice(timeline.indexOf("export function Drawn("), timeline.indexOf("function Card("));

/* ------------------------------------------------------------------ */
/* 1. The drawing, at the size a card gives it                         */
/* ------------------------------------------------------------------ */

/*
 * A drawing on a card was a stamp in the middle of it: the view was the unit
 * square on the reasoning that the strokes are normalised into it, and they
 * are not — a line across the middle of a board normalises to a band through
 * the middle of that square. So the mark arrived small, with air all round
 * it, and the ink was a fraction of the square rather than a width in
 * pixels, which meant the bigger the drawing the fatter its lines, and any
 * drawing with detail in it closed into a mesh.
 */
check("a drawing is framed on its own bounds, not on a square it may not fill",
  /Math\.min\(\.\.\.xs\)/.test(drawn) && /Math\.max\(\.\.\.ys\)/.test(drawn)
  && /viewBox=\{`\$\{vx/.test(drawn) && !/viewBox="0 0 1 1"/.test(drawn));
check("…with a margin, and a floor under the extent so a straight line is not divided by nothing",
  /const pad = span \/ 12;/.test(drawn) && /Math\.max\(0\.04,/.test(drawn));
check("…and it keeps its proportions rather than being stretched to the box",
  /preserveAspectRatio="xMidYMid meet"/.test(drawn));
check("the line's weight is in pixels, so scaling the drawing up does not fatten its ink",
  (drawn.match(/vectorEffect="non-scaling-stroke"/g) ?? []).length === 2);
/*
 * A bird put on the board in fifteen strokes is one drawing everywhere else
 * in this app: the ink groups it as one, the ring round it counts fifteen,
 * one Make real is drawn for it. It was `slice(0, 12)` here, so the same
 * bird lost three strokes on the card that is meant to be a picture of it.
 */
check("every stroke is on the card: a fifteen-stroke bird is not a twelve-stroke bird",
  !/strokes\.slice\(0, \d+\)/.test(drawn));
check("…and the cost is bounded by how much line there is, not by how many times the hand lifted",
  /Math\.floor\(600 \/ Math\.max\(1, strokes\.length\)\)/.test(drawn));
check("a card gives the drawing the room the element would have had",
  /width=\{PIECE\.w - 22\} height=\{PIECE\.h - 66\}/.test(timeline));

/* ------------------------------------------------------------------ */
/* 2. In the browser: every mark against its own face                  */
/* ------------------------------------------------------------------ */

const url = process.argv[2] || "http://localhost:3000";
let live = false;
try { live = (await fetch(`${url}/builder`, { signal: AbortSignal.timeout(8000) })).ok; } catch { live = false; }
check("the Builder answers", live, live ? url : `${url} — skipped the live half`);

if (live) {
  const { chromium } = await import("playwright-core");
  const seed = () => {
    const strokes = [];
    for (let k = 0; k < 15; k++) {
      const s = [];
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        s.push([0.18 + 0.64 * t, 0.3 + 0.34 * Math.sin(t * 5 + k) * (0.3 + 0.1 * k)]);
      }
      strokes.push(s);
    }
    const pages = [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }];
    const part = (id, featureId, label, x, y, w, h) => ({
      id, pageId: "p0", featureId, label, prompt: "", content: "", data: "", x, y, w, h,
      groupId: null, options: {}, priority: "must", custom: false, colour: null, font: null,
      anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", shape: null, outline: null,
      code: null, aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null, link: null,
    });
    const nodes = [
      part("n1", "sticky-header", "Top bar", 0, 0, 1440, 64),
      part("n2", "hero-split", "Hero", 40, 90, 1360, 420),
      part("n3", "feature-cards", "What it does", 40, 540, 1360, 300),
      part("n4", "cta-primary", "Join", 560, 880, 320, 64),
    ];
    const brief = { name: "Orbit", gimmick: "", master: "" };
    const doc = { pages, nodes, groups: [], shapes: [], format: {}, look: {}, motion: [], activePageId: "p0", frameWidth: 1440, brief };
    const threads = [
      { id: "g0", at: 0, mode: "plan", state: "done", ask: "Lay out the home page with a hero and three cards", answer: "Done.", changes: ["Top bar placed", "Hero placed", "Join placed"], parentId: null, doc },
      // Nearly formed, and nothing made yet: the moment the drawing stands in
      // for the element, which is the only time a card shows one.
      { id: "d1", at: 1, mode: "drawing", state: "done", ask: "A bird over the hero", answer: "Done.", changes: ["A bird", "and a second thing"], parentId: "g0", sketch: { strokes, words: "a bird" }, form: { p: 0.9995, gen: 0 } },
      { id: "g2", at: 2, mode: "build", state: "done", ask: "Add a footer", answer: "Done.", changes: ["Footer placed"], parentId: "g0",
        doc: { ...doc, nodes: [...nodes, part("n5", "footer-simple", "Footer", 0, 980, 1440, 120)] } },
    ];
    localStorage.setItem("builder.studio", JSON.stringify({ state: {
      pages, nodes, groups: [], shapes: [], format: {}, look: {}, motion: [],
      activePageId: "p0", frameWidth: 1440, brief,
      threads, threadSpots: { "box:g0": { x: 70, y: 110 }, "box:d1": { x: 770, y: 110 }, "box:g2": { x: 70, y: 410 } },
      openThreadId: null, trail: [], liveThreadId: "g2", pinnedThreads: [], bookPinned: false,
      hiddenFeatures: [], companion: null, draftPieces: [], sentPieces: {},
    }, version: 0 }));
  };

  const b = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium" });
  const p = await b.newPage({ viewport: { width: 1400, height: 980 } });
  await p.addInitScript(seed);
  await p.goto(`${url}/builder`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1300);
  await p.locator("[data-finish]").first().click();
  await p.waitForTimeout(2400);

  /* Every leaf on a construct that paints a mark: a run of words, or a drawing. */
  const marks = await p.evaluate(() => {
    const out = [], seen = new Set();
    for (const box of document.querySelectorAll("[data-box], [data-piece]")) {
      for (const el of box.querySelectorAll("*")) {
        if (seen.has(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4 || r.width > 600) continue;
        // The site preview is the site's own design, not this surface's.
        if (el.closest("[data-site-shot]") || el.closest("[data-made]")) continue;
        const svg = el.tagName.toLowerCase() === "svg";
        const words = !svg && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        if (!svg && !words) continue;
        seen.add(el);
        el.setAttribute("data-mark", String(out.length));
        out.push({ i: out.length, svg, label: svg ? "a drawing" : (el.textContent ?? "").trim().slice(0, 26) });
      }
    }
    return out;
  });

  const READ = async ([b64, b64b]) => {
    const load = async (s) => { const i = new Image(); i.src = "data:image/png;base64," + s; await i.decode(); return i; };
    const [i1, i2] = [await load(b64), await load(b64b)];
    const grab = (img) => { const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
      c.getContext("2d").drawImage(img, 0, 0); return c.getContext("2d").getImageData(0, 0, img.width, img.height).data; };
    const [A, B] = [grab(i1), grab(i2)];
    const lin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    const Y = (d, i) => 0.2126 * lin(d[i] / 255) + 0.7152 * lin(d[i + 1] / 255) + 0.0722 * lin(d[i + 2] / 255);
    const ds = [];
    for (let i = 0; i < A.length; i += 4) ds.push(Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]));
    const cut = Math.max(45, Math.max(...ds) * 0.7);
    const pairs = [];
    let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
    const ratio = (a, c) => (Math.max(a, c) + 0.05) / (Math.min(a, c) + 0.05);
    for (let k = 0; k < ds.length; k++) {
      if (ds[k] < cut) continue;
      const i = k * 4, x = k % i1.width, y = (k / i1.width) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      pairs.push(ratio(Y(A, i), Y(B, i)));
    }
    if (pairs.length < 8) return null;
    pairs.sort((a, c) => a - c);
    const at = (q) => +pairs[Math.min(pairs.length - 1, Math.floor(pairs.length * q))].toFixed(2);
    return { n: pairs.length, worst: at(0.02), tenth: at(0.1),
      fills: +Math.max((x1 - x0 + 1) / i1.width, (y1 - y0 + 1) / i1.height).toFixed(2) };
  };

  const rows = [];
  for (const m of marks) {
    const sel = `[data-mark="${m.i}"]`;
    const box = await p.locator(sel).boundingBox();
    if (!box || box.width < 4 || box.height < 4) continue;
    const clip = { x: Math.round(box.x), y: Math.round(box.y), width: Math.max(4, Math.round(box.width)), height: Math.max(4, Math.round(box.height)) };
    const before = (await p.screenshot({ clip })).toString("base64");
    await p.evaluate((s) => { document.querySelector(s).style.visibility = "hidden"; }, sel);
    await p.waitForTimeout(80);
    const after = (await p.screenshot({ clip })).toString("base64");
    await p.evaluate((s) => { document.querySelector(s).style.visibility = ""; }, sel);
    const r = await p.evaluate(READ, [before, after]);
    if (r) rows.push({ ...m, ...r });
  }
  await b.close();

  check("there are marks on the cards to read", rows.length >= 8, `${rows.length} read`);
  const low = rows.filter((r) => r.tenth < 4.5).sort((a, c) => a.tenth - c.tenth);
  check("every mark on a card clears 4.5:1 against its own face, at the tenth-worst pixel in a hundred",
    low.length === 0,
    low.length ? low.slice(0, 4).map((r) => `${r.label} ${r.tenth}`).join(", ")
      : `worst of ${rows.length} is ${Math.min(...rows.map((r) => r.tenth))}:1`);
  const floor = rows.filter((r) => r.worst < 3).sort((a, c) => a.worst - c.worst);
  check("…and nothing at all on one falls under 3:1, edge pixels included",
    floor.length === 0,
    floor.length ? floor.slice(0, 4).map((r) => `${r.label} ${r.worst}`).join(", ")
      : `worst of ${rows.length} is ${Math.min(...rows.map((r) => r.worst))}:1`);
  /*
   * And the drawing is not a stamp in the middle of an empty card. It runs
   * the whole way across the room it is given in one direction — which one
   * depends on whether the drawing is taller or wider than the space, and
   * the other is whatever its own proportions ask for, because a drawing
   * stretched to fit is a different drawing. Not the whole way to the edge:
   * a twelfth of margin at each end is deliberate, and the outermost pixel
   * of a stroke is half ink anyway, so the bar is seven tenths — enough to
   * catch a return to a stamp in the middle of an empty card, which is what
   * this was.
   */
  const pics = rows.filter((r) => r.svg && r.n > 200);
  check("a drawing on a card runs the whole way across the room it is given", pics.length > 0 && pics.every((r) => r.fills >= 0.7),
    pics.map((r) => `${Math.round(r.fills * 100)}% of the room`).join(", ") || "no drawing was on a card to read");
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed === results.length ? "all good" : "FAILED"} — ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
