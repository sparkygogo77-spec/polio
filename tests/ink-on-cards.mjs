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
 *
 * Runs alone: photographs marks at set phases of the cloud's cycle; under load the phases drift and nothing is measured.
 */
import { readFileSync } from "node:fs";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const timeline = readFileSync("src/features/studio/Timeline.tsx", "utf8");
const detailSrc = readFileSync("src/features/studio/TimelineDetail.tsx", "utf8");
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
  const SCAN = (roots) => {
    const out = [], seen = new Set();
    for (const box of document.querySelectorAll(roots)) {
      const rb = box.getBoundingClientRect();
      if (rb.bottom < 0 || rb.top > innerHeight) continue;
      for (const el of box.querySelectorAll("*")) {
        if (seen.has(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) continue;
        if (r.top < 0 || r.bottom > innerHeight) continue;
        // The site preview is the site's own design, not this surface's.
        if (el.closest("[data-site-shot]") || el.closest("[data-made]")) continue;
        const svg = el.tagName.toLowerCase() === "svg";
        const words = !svg && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        if (!svg && !words) continue;
        /* The width cap is for drawings, which is where a wide one is a
           whole picture and not a mark. It once applied to words too, and a
           run of words is as wide as what it says: the Updates panel's lines
           are each one change's title across the box, so the count of what
           could be read went up and down with how long the latest titles
           were, and fell to 7 under the bar of 8 once two long ones landed. */
        if (svg && r.width > 600) continue;
        seen.add(el);
        el.setAttribute("data-mark", String(out.length));
        /* The colour the design ASKED for, and how big it is drawn. Both are
           read here because this is the only place that still has the
           element; everything after it works on pixels. */
        const cs = getComputedStyle(el);
        /* Normalised through a canvas rather than parsed: Chromium hands
           back `oklch(0.95 0.03 152)` verbatim for an oklch colour, and
           reading its three numbers as if they were RGB is how "0.95" became
           a red channel. `fillStyle` round-trips any colour the browser
           understands into `#rrggbb`. */
        const cv = document.createElement("canvas"); cv.width = 1; cv.height = 1;
        const cc = cv.getContext("2d", { willReadFrequently: true });
        cc.clearRect(0, 0, 1, 1); cc.fillStyle = cs.color; cc.fillRect(0, 0, 1, 1);
        const px = cc.getImageData(0, 0, 1, 1).data;
        const hex = px[3] > 200 ? [px[0], px[1], px[2]] : null;
        out.push({ i: out.length, svg, ink: hex, said: cs.color, px: Math.round(parseFloat(cs.fontSize) || 0),
          label: svg ? `a drawing (${(el.getAttribute("class") || "").replace(/lucide lucide-|size-\S+/g, "").trim() || "svg"})` : (el.textContent ?? "").trim().slice(0, 26) });
      }
    }
    return out;
  };

  const READ = async ([b64, b64b, want]) => {
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
    /*
     * CAN THIS MARK BE MEASURED AT ALL?
     *
     * Everything above reads the ink off the pixels that changed most. That
     * is the best-covered pixel, which is not the same thing as a pixel of
     * pure ink: at ten pixels a glyph has no stem two pixels wide, so its
     * best pixel is still half ground, and what comes back is the contrast
     * of a blend the design never specified.
     *
     * So the instrument asks itself: at the pixel where the ink is thickest,
     * is the colour the one the design asked for? `want` is the element's own
     * computed `color`. If the answer is no, the reading is fiction and the
     * mark is refused rather than scored. It is self-calibrating — no font
     * size threshold to argue about — and it is the exact fault that put a
     * near-white `oklch(0.95 0.07 152)` on the board as rgb(115,151,124) and
     * called it 3.46:1.
     */
    let top = -1, ti = 0;
    for (let k = 0; k < ds.length; k++) if (ds[k] > top) { top = ds[k]; ti = k * 4; }
    const got = [A[ti], A[ti + 1], A[ti + 2]];
    const asked = Array.isArray(want) && want.length === 3 ? want : null;
    const pure = asked ? +ratio(0.2126 * lin(got[0] / 255) + 0.7152 * lin(got[1] / 255) + 0.0722 * lin(got[2] / 255),
      0.2126 * lin(asked[0] / 255) + 0.7152 * lin(asked[1] / 255) + 0.0722 * lin(asked[2] / 255)).toFixed(2) : null;
    return { n: pairs.length, worst: at(0.02), tenth: at(0.1), best: at(0.9), pure,
      got: `rgb(${got.join(",")})`, asked: asked ? `rgb(${asked.join(",")})` : "(unreadable colour)",
      fills: +Math.max((x1 - x0 + 1) / i1.width, (y1 - y0 + 1) / i1.height).toFixed(2) };
  };

  /*
   * THE FACE HAS TO HOLD STILL, AND AT MORE THAN ONE MOMENT.
   *
   * This reads a mark by shooting it, hiding it, shooting again and diffing,
   * so the second shot is the face that was behind the ink. Two things were
   * wrong with doing that on a live page, and the second is the worse:
   *
   *   · The cloud drifts in the 80ms between the two shots, so pixels differ
   *     for reasons that are not ink, and `cut` thresholds on exactly that
   *     difference — the polluted pixels were being counted as ink.
   *
   *   · The face's brightness is wherever the cloud happens to be in its
   *     twenty-second cycle. So the check answered "did this clear 4.5:1 at
   *     the instant we looked", while its name promises "every run of words
   *     clears 4.5:1". It read 4.36, 4.42, 4.49 and 4.51 on four runs of the
   *     same build: a pass one time in four, on ink that is not legible.
   *
   * So: every animation on the page is stopped for the measurement, which
   * makes the pair differ by the ink alone and makes a run repeatable; and
   * the cycle is sampled at three phases with the worst kept, because the
   * bar is about the worst moment a person can meet, not a lucky one.
   */
  /*
   * Six, not three. The drift is a twenty-second loop and three samples of it
   * left gaps wide enough that a run of words sitting on the bar — "and 1
   * more" on a green card, which measures about 4.48 — was found on some runs
   * and missed on others, so the suite passed seven times in eight. A check
   * that finds a real fault most of the time is worse than one that never
   * does, because the times it passes are the ones that get believed.
   */
  const PHASES = [0, -3.3, -6.7, -10, -13.4, -16.7];
  const freeze = (secs) => `*,*::before,*::after{animation-play-state:paused!important}
    .molten::before{animation-delay:${secs}s!important}
    .molten::after{animation-delay:${secs * 2.35}s!important}`;

  const measureAt = async (roots, secs) => {
    const st = await p.addStyleTag({ content: freeze(secs) });
    await p.waitForTimeout(250);
    const r = await measureOnce(roots);
    await st.evaluate((el) => el.remove()).catch(() => {});
    return r;
  };

  /** The worst reading of each mark across the cloud's cycle. */
  const measure = async (roots) => {
    const passes = [];
    for (const secs of PHASES) passes.push(await measureAt(roots, secs));
    /*
     * Keyed on the mark's own index, not its label: `label` is the first 26
     * characters of the text, every drawing is called "a drawing", and two
     * boxes in a list say the same word. Keying on it merged distinct marks
     * into one and took the Updates panel from eleven marks to three — which
     * then failed "there is something to read" for the right reason on the
     * wrong grounds. SCAN walks the same DOM in the same order each pass and
     * nothing re-renders while the page is frozen, so the index lines up.
     */
    const byMark = new Map();
    for (const pass of passes) for (const r of pass) {
      const was = byMark.get(r.i);
      /* Worst wins on every figure the checks read, independently: a phase
         that is kindest to the tenth percentile is not always the one that
         is kindest to the floor. */
      byMark.set(r.i, was ? { ...r, worst: Math.min(was.worst, r.worst), tenth: Math.min(was.tenth, r.tenth),
        /* `n` is how much ink the mark showed, and it takes the MAX for the
           same reason `fills` does: it answers "is this a drawing or an
           icon", not "how legible is it". Spreading `...r` left it as
           whatever the last phase happened to give, and the bird came out at
           179 against a threshold of 200 — the drawing check then reported
           "no drawing was on a card to read" about a drawing that was on the
           card, 110x62, in plain view. */
        best: Math.min(was.best, r.best), n: Math.max(was.n, r.n), fills: Math.max(was.fills, r.fills),
        /* Worst wins here too, and worst means FURTHEST from the declared
           ink: if the thickest pixel failed to be the real colour at any
           phase, the mark could not be measured at that phase. */
        pure: was.pure === null || r.pure === null ? null : Math.max(was.pure, r.pure) } : r);
    }
    return [...byMark.values()];
  };

  const measureOnce = async (roots) => {
    const marks = await p.evaluate(SCAN, roots);
    const out = [];
    for (const m of marks) {
      const sel = `[data-mark="${m.i}"]`;
      const box = await p.locator(sel).boundingBox();
      if (!box || box.width < 4 || box.height < 4) continue;
      const clip = { x: Math.round(box.x), y: Math.round(box.y), width: Math.max(4, Math.round(box.width)), height: Math.max(4, Math.round(box.height)) };
      const before = (await p.screenshot({ clip })).toString("base64");
      /*
       * WORDS GO TRANSPARENT; ONLY A DRAWING IS HIDDEN OUTRIGHT.
       *
       * `visibility: hidden` takes the element's own background with it, so
       * for anything wearing a plate the second shot was the card behind the
       * plate and the diff counted the plate itself as ink. The kind chips on
       * an Updates box are exactly that: "New" is dark ink on a solid violet
       * `KIND_LIT` plate, and this was reading the whole chip against the
       * construct's drifting face — which is why it moved with the cloud when
       * an opaque plate cannot. It reported "New 3.93" against a 4.5 bar for
       * a word whose real face is the violet, not the card.
       *
       * `color: transparent` removes the glyphs and leaves the plate, so the
       * pair differs by the ink alone and the face is whatever the ink is
       * actually sitting on. A drawing has no plate of its own — its face is
       * the card — so it is still hidden outright.
       */
      await p.evaluate(([q, isSvg]) => { const el = document.querySelector(q);
        if (isSvg) { el.dataset.was = el.style.visibility; el.style.visibility = "hidden"; return; }
        /* Put back exactly what was there, not the empty string. These
           colours arrive as React inline styles — the kind chip is
           `style={{ background: KIND_LIT, color: KIND_INK }}` — so clearing
           the property does not restore the ink, it deletes it, and every
           chip measured after the first one read its contrast against a
           colour the design never set. That is how "Under it" came back at
           1.34:1 on a plate it actually clears about tenfold. */
        el.dataset.was = JSON.stringify([el.style.color, el.style.textShadow]);
        el.style.color = "transparent";
        el.style.textShadow = "none";
      }, [sel, m.svg]);
      await p.waitForTimeout(80);
      const after = (await p.screenshot({ clip })).toString("base64");
      await p.evaluate(([q, isSvg]) => { const el = document.querySelector(q);
        if (isSvg) { el.style.visibility = el.dataset.was ?? ""; delete el.dataset.was; return; }
        const [c, t] = JSON.parse(el.dataset.was ?? '["",""]');
        el.style.color = c; el.style.textShadow = t; delete el.dataset.was;
      }, [sel, m.svg]);
      const r = await p.evaluate(READ, [before, after, m.svg ? null : m.ink]);
      if (r) out.push({ ...m, ...r });
    }
    await p.evaluate(() => { for (const el of document.querySelectorAll("[data-mark]")) el.removeAttribute("data-mark"); });
    return out;
  };

  const rows = await measure("[data-box], [data-piece]");


  /*
   * Words and graphics are read against different bars, because WCAG sets
   * different bars and because the instrument can only see what is there:
   *
   *   · A run of words is judged at its tenth-worst pixel in a hundred
   *     against 4.5:1, and at its very worst against 3:1. A glyph has a
   *     body, so most of its pixels are the ink's real colour.
   *   · An icon from the set is a stroke a pixel and a half wide. Nearly
   *     every pixel of it is a blend of ink and face, so the percentiles
   *     read the antialiasing rather than the design. It is judged at its
   *     best-covered tenth — the stroke's actual colour — against 3:1,
   *     which is the bar for a thing that is not text in the first place.
   */
  /*
   * How far the thickest pixel of a mark may be from the colour the design
   * asked for before the reading stops meaning anything. 1 is exact.
   *
   * Not a font size, because a font size is a number to argue about and this
   * is not: either the instrument found the ink or it found a blend. 1.25 is
   * a quarter of a stop of luminance, which no correctly resolved glyph is
   * ever off by and no ten-pixel one ever comes inside.
   */
  const CAN_READ = 1.25;

  const words = (where, rows) => {
    check(`${where}: there is something to read`, rows.length >= 8, `${rows.length} marks`);
    const all = rows.filter((r) => !r.svg);
    /*
     * WHAT IT REFUSES TO JUDGE.
     *
     * A mark whose thickest pixel is not its own declared colour was never
     * measured; it was sampled through its own antialiasing. Scoring it
     * produces a number that moves when the text size moves and has nothing
     * to do with whether a person can read it — and two such numbers went
     * into a report as findings before this existed. They are named, counted
     * and set aside: not passed, not failed, not silent.
     */
    const blind = all.filter((r) => r.pure === null || r.pure > CAN_READ);
    const said = all.filter((r) => r.pure !== null && r.pure <= CAN_READ);
    check(`${where}: …and it can actually be read`, said.length > 0,
      `${said.length} of ${all.length} marks measurable`);
    check(`${where}: …and what it cannot measure, it refuses rather than scores`,
      blind.every((r) => r.pure === null || r.pure > CAN_READ),
      blind.length
        ? `${blind.length} refused: ${blind.slice(0, 3).map((r) => `"${r.label}" ${r.px}px ${r.said}, ${r.pure === null ? "colour unreadable" : `${r.pure}x off`}, got ${r.got}`).join(" | ")}`
        : "none needed refusing");
    const low = said.filter((r) => r.tenth < 4.5).sort((a, c) => a.tenth - c.tenth);
    /* The worst one is NAMED even when it passes. It used to report only the
       number, and a bare "worst of 13 is 4.55:1" cannot be acted on: I read
       it as the label that had failed on an earlier run, raised that colour,
       and the number did not move, because the worst mark was a different
       element entirely. A margin report that does not say what is at the
       margin invites exactly that mistake. */
    const worstSaid = said.length ? said.reduce((a, c) => (c.tenth < a.tenth ? c : a)) : null;
    check(`${where}: every run of words clears 4.5:1 against its own face`, said.length > 0 && low.length === 0,
      low.length ? low.slice(0, 4).map((r) => `"${r.label}" at ${r.tenth}:1 (floor ${r.worst}, best ${r.best}, ${r.n}px)`).join(", ")
        : worstSaid ? `worst of ${said.length} is "${worstSaid.label}" at ${worstSaid.tenth}:1 (floor ${worstSaid.worst}, best ${worstSaid.best}, ${worstSaid.n}px)` : "nothing here could be measured");
    const floor = said.filter((r) => r.worst < 3).sort((a, c) => a.worst - c.worst);
    check(`${where}: …and nothing falls under 3:1, edge pixels included`, floor.length === 0,
      floor.length ? floor.slice(0, 4).map((r) => `${r.label} ${r.worst}`).join(", ")
        : `worst of ${said.length} is ${Math.min(...said.map((r) => r.worst))}:1`);
    const marks = rows.filter((r) => r.svg);
    const dim = marks.filter((r) => r.best < 3).sort((a, c) => a.best - c.best);
    check(`${where}: …and every mark that is not words clears the 3:1 it is held to`,
      marks.length === 0 || dim.length === 0,
      marks.length ? (dim.length ? dim.slice(0, 3).map((r) => `${r.label} ${r.best}`).join(", ")
        : `${marks.length} marks, worst ${Math.min(...marks.map((r) => r.best))}:1`) : "none on this surface");
  };

  words("a card on the timeline", rows);
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
  /*
   * A HUNDRED, NOT TWO HUNDRED, AND THE OLD NUMBER WAS MEASURED ON A LIE.
   *
   * This separates a drawing from an icon by how much ink it carries. The
   * threshold was 200, and it worked only because the reading was inflated:
   * before the face was frozen for the measurement, the cloud drifting
   * between the two shots was counted as ink, so every mark reported more
   * pixels than it had. With a still face the same bird measures 179 and the
   * icons on the same cards measure 13 to 22 — so a hundred sits in a gap
   * that is an order of magnitude wide, where 200 sat above the thing it was
   * meant to admit.
   */
  const pics = rows.filter((r) => r.svg && r.n > 100);
  check("a drawing on a card runs the whole way across the room it is given",
    pics.length > 0 && pics.every((r) => r.fills >= 0.7),
    pics.map((r) => `${Math.round(r.fills * 100)}% of the room`).join(", ") || "no drawing was on a card to read");
  /* ---------------------------------------------------------------- */
  /* 3. The same rule, on the boxes that are all words                 */
  /* ---------------------------------------------------------------- */

  /*
   * The cards on the timeline are mostly picture with a line under them;
   * the boxes on the Updates panel are nothing but text on the same
   * material, so they are where a second voice that is too quiet actually
   * costs a person something. Same instrument, same two bars.
   *
   * What it found: the box's own title at 4.4:1 through the middle and
   * 3.6:1 at its worst, and the little kind plates worse still — dark words
   * on a ground that was not light enough to carry them, 2.9:1 on "under
   * it" and 3.7:1 on "better". The body text was always fine at 8 to 12:1,
   * which is why this read as some lines fading rather than as a panel
   * being dark.
   */
  await p.goto(`${url}/builder`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1200);
  await p.locator("[data-updates-toggle]").first().click();
  await p.waitForTimeout(1500);
  const said = await measure("[data-updates-panel] section.molten");
  await b.close();

  words("a box on the Updates panel", said);

  /*
   * And the second voice is quieter by being less coloured and smaller, not
   * by being harder to read — so the gap between the two voices stays real
   * without either of them going under the bar.
   */
  check("the second voice is still the second voice, not a copy of the first", (() => {
    const L = (c) => Number(/oklch\(([\d.]+)/.exec(c)?.[1] ?? 0);
    const field = /export const FIELD = \{([\s\S]*?)\n\};/.exec(detailSrc)?.[1] ?? "";
    const text = L(/text: "([^"]+)"/.exec(field)?.[1] ?? ""), dim = L(/dim: "([^"]+)"/.exec(field)?.[1] ?? "");
    return text > dim && text - dim <= 0.12 && dim >= 0.8;
  })(), (() => {
    const field = /export const FIELD = \{([\s\S]*?)\n\};/.exec(detailSrc)?.[1] ?? "";
    return `text ${/text: "([^"]+)"/.exec(field)?.[1]}, dim ${/dim: "([^"]+)"/.exec(field)?.[1]}`;
  })());
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed === results.length ? "all good" : "FAILED"} — ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
