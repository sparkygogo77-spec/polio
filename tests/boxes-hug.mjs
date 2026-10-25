/**
 * A PART'S MARKS STAND WHERE IT IS DRAWN.
 *
 * J (2026-10-24, EDIT-ISSUES #35), sol face on his board at 85%: picking the
 * hero frog ("image … 690×863") drew a selection box whose top-left sat on
 * the frog's hood and which ran far right of the frog, past the board's edge.
 * The capture records the frog's box at x 1049 with the page's
 * `translateX(-50%)`, `matrix(1, 0, 0, 1, -345, 0)`: the board drew the frog
 * 345px to the left, inside a box, a ring and handles that stayed at 1049.
 * Every part a site centres with a translate was off the same way (sol face's
 * corner lines by 670px, its pointer glow by 225 both ways), and every part
 * the page turns or scales (the stickers, mochi's icons at 1.22) had square,
 * unscaled rings round a drawing that was neither.
 *
 * The board now stands a part at its box plus its own shift and draws it
 * unshifted, and its rings turn and scale with it (`pageClip.ts#drawnShift`,
 * `NodeView.tsx#turnOf`). The stored box and the export are the site's.
 *
 * For every part, at 85% and 100%:
 *   1. what it draws lies inside its ring (words: across only; a tall glyph
 *      over a tight line is the page's own, EDIT-ISSUES #24), to 1px;
 *   2. a shifted, turned or scaled part, and every picture, is hugged by it:
 *      every side within 1px;
 * and the part shifted furthest, picked, has its picked ring and its handles
 * on what is drawn; the stored boxes are what they were.
 *
 *   node tests/boxes-hug.mjs http://127.0.0.1:3061                 (a seeded board)
 *   node tests/boxes-hug.mjs http://127.0.0.1:3061 <capture folder> (sol face, mochi, sunkcoin)
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { SWEEP } from "../src/features/studio/reassemble.ts";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const SINK = process.argv[3];
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const context = await browser.newContext({ viewport: { width: 1760, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const doc = () => page.evaluate(() => window.__studioHistory?.doc() ?? { nodes: [] }).catch(() => ({ nodes: [] }));

/** The keyframes the site carries: a part whose lasting motion rewrites its transform is drawn where its turn is. */
let KEYFRAMES = [];
if (SINK) {
  KEYFRAMES = JSON.parse(readFileSync(join(SINK, "site/document.json"), "utf8")).look?.keyframes ?? [];
  /* The capture, brought in through the GitHub door (GitHub answered here, a placeholder key). */
  const DOC = readFileSync(join(SINK, "site/document.json"));
  const pics = existsSync(join(SINK, "assets/pictures")) ? readdirSync(join(SINK, "assets/pictures")) : [];
  const REPO = "/repos/sparkygogo77-spec/sink";
  const tree = [
    { path: "package.json", type: "blob", sha: "pkg", size: 10 },
    { path: "site/document.json", type: "blob", sha: "doc", size: DOC.length },
    ...pics.map((p) => ({ path: `assets/pictures/${p}`, type: "blob", sha: `pic:${p}`, size: 100 })),
  ];
  await page.route("https://api.github.com/**", (r) => {
    const u = new URL(r.request().url());
    const j = (b, code = 200) => r.fulfill({ status: code, contentType: "application/json", body: JSON.stringify(b) });
    if (!u.pathname.startsWith(REPO)) return j({ message: "no" }, 404);
    const rest = u.pathname.slice(REPO.length);
    if (!rest) return j({ default_branch: "main", homepage: "" });
    if (rest.startsWith("/git/trees/")) return j({ tree });
    if (rest === "/git/blobs/doc") return j({ encoding: "base64", content: DOC.toString("base64") });
    const pic = decodeURIComponent(rest).match(/^\/git\/blobs\/pic:(.+)$/);
    if (pic) return j({ encoding: "base64", content: readFileSync(join(SINK, "assets/pictures", pic[1])).toString("base64") });
    return j({ message: "no" }, 404);
  });
  await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    const env = (s) => JSON.stringify({ state: s, version: 0 });
    localStorage.setItem("builder.builds", env({ projects: [{ id: "s3", name: "Site 3", updatedAt: Date.now() }], activeId: "s3" }));
    localStorage.setItem("builder.studio", env({ nodes: [] }));
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const keys = page.locator("[data-keys-panel]");
  await page.getByRole("button", { name: "Keys", exact: true }).click();
  await page.waitForTimeout(500);
  const skip = keys.getByRole("button", { name: /Skip the PIN|Hold the key for this tab/ });
  if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(300); }
  await keys.locator('[data-service="github"] input[type="password"]').first().fill("not-a-token-placeholder-xxxx");
  await keys.getByRole("button", { name: /Save to this browser|Hold in this tab/ }).first().click();
  await page.waitForTimeout(500);
  await keys.getByRole("button", { name: "Close keys" }).click();
  await page.waitForTimeout(500);
  await page.locator("[data-github-button]").first().click();
  await page.waitForTimeout(700);
  await page.locator("[data-repo-bring]").fill("sparkygogo77-spec/sink");
  await page.locator("[data-repo-pull]").click();
  await page.waitForTimeout(300);
  if (await page.locator("[data-repo-bring-go]").count()) await page.locator("[data-repo-bring-go]").click();
  for (let i = 0; i < 180 && (await doc()).nodes.length < 50; i++) await page.waitForTimeout(1000);
  await page.mouse.move(2, 2);
  await page.waitForTimeout(Number(process.env.SETTLE ?? 12000));
  check("the site came in", (await doc()).nodes.length >= 50, `${(await doc()).nodes.length} parts`);
} else {
  /* A board that holds each kind: shifted by its transform (the frog), by its translate, both ways (the glow), turned, scaled, and one a spin owns. */
  const node = (id, f, x, y, w, h, extra = {}) => ({
    id, pageId: "p0", featureId: f, label: id, prompt: "", content: "", data: "", x, y, w, h, groupId: null, options: {},
    priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: { bg: "#2a8a4a" }, font: null,
    anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
    from: { url: "https://x.test/", host: "x.test", selector: `body > div.${id}`, at: 1 }, ...extra,
  });
  const seed = JSON.stringify({ state: {
    pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
    nodes: [
      node("main", "box", 0, 0, 1440, 1400, { colour: { bg: "#101010" }, from: { url: "https://x.test/", host: "x.test", selector: "body > main", at: 1 } }),
      node("frog", "box", 1049, 146, 690, 863, { art: { transform: "matrix(1, 0, 0, 1, -345, 0)", origin: "345px 431.5px" } }),
      node("nudged", "box", 100, 1100, 200, 80, { art: { translate: "40px 20px" } }),
      node("glow", "box", 300, 300, 200, 200, { art: { transform: "matrix(1, 0, 0, 1, -100, -100)" } }),
      node("sticker", "box", 600, 1100, 180, 120, { art: { transform: "matrix(0.9877, 0.1564, -0.1564, 0.9877, 0, 0)" } }),
      node("icon", "box", 900, 1100, 64, 64, { art: { transform: "matrix(1.22, 0, 0, 1.22, 0, 0)" } }),
      node("spun", "box", 1100, 1100, 100, 100, { art: { transform: "matrix(1, 0, 0, 1, -50, 0)" }, motion: { animation: [{ name: "spin", duration: "4s", iterations: "infinite" }] } }),
    ],
    look: { keyframes: [{ name: "spin", frames: [{ key: "100%", style: { transform: "rotate(360deg)" } }] }] },
    groups: [], shapes: [], format: {}, brief: { name: "HUG", gimmick: "", master: "" },
    frameWidth: 1440, activePageId: "p0", trail: [], swept: SWEEP,
  }, version: 0 });
  KEYFRAMES = JSON.parse(seed).state.look.keyframes;
  await context.addInitScript((d) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("builder.studio", d); sessionStorage.setItem("seeded", "1"); } }, seed);
  await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  check("the seeded board is up", (await doc()).nodes.length === 7, `${(await doc()).nodes.length} parts`);
}

const before = new Map((await doc()).nodes.map((n) => [n.id, [n.x, n.y, n.w, n.h].join(",")]));

/** Every part on screen: its ring (the hover ring, which the picked ring matches), what it paints, and the words it sets. */
const measure = () => page.evaluate(() => {
  const out = [];
  const un = (a, r) => (a ? { l: Math.min(a.l, r.left), t: Math.min(a.t, r.top), r: Math.max(a.r, r.right), b: Math.max(a.b, r.bottom) } : { l: r.left, t: r.top, r: r.right, b: r.bottom });
  const see = (r) => r.width > 0.5 && r.height > 0.5;
  /* What of a picture shows under its object-fit and object-position. */
  const imgBox = (img) => {
    const r = img.getBoundingClientRect(), s = getComputedStyle(img), nw = img.naturalWidth, nh = img.naturalHeight;
    if (!nw || !nh || !r.width || !r.height || s.objectFit === "fill" || s.objectFit === "cover") return r;
    let k = Math.min(r.width / nw, r.height / nh);
    if (s.objectFit === "none") k = 1;
    if (s.objectFit === "scale-down") k = Math.min(1, k);
    const w = nw * k, h = nh * k, [px, py] = (s.objectPosition || "50% 50%").split(" ");
    const at = (v, room) => (v?.endsWith("%") ? (parseFloat(v) / 100) * room : parseFloat(v ?? "0") || 0);
    const x = r.left + at(px, r.width - w), y = r.top + at(py ?? "50%", r.height - h);
    return { left: x, top: y, right: x + w, bottom: y + h, width: w, height: h };
  };
  for (const el of document.querySelectorAll("[data-node-id]")) {
    if (getComputedStyle(el).display === "none") continue;
    const host = el.querySelector(":scope > [data-part-drawn]"), ring = el.querySelector(":scope > [data-hover-mark]");
    if (!host) continue;
    const mk = (ring ?? host).getBoundingClientRect();
    if (!see(mk) || mk.bottom < 0 || mk.top > innerHeight) continue;
    let paint = null, ink = null;
    const clipOf = (c) => { let k = null; for (let a = c.parentElement; a && a !== el.parentElement; a = a.parentElement) { const st = getComputedStyle(a); if (/hidden|clip/.test(st.overflowX + st.overflowY)) { const q = a.getBoundingClientRect(); k = k ? { left: Math.max(k.left, q.left), top: Math.max(k.top, q.top), right: Math.min(k.right, q.right), bottom: Math.min(k.bottom, q.bottom) } : { left: q.left, top: q.top, right: q.right, bottom: q.bottom }; } } return k; };
    const cut = (r, c) => { const k = clipOf(c); if (!k) return r; const o = { left: Math.max(r.left, k.left), top: Math.max(r.top, k.top), right: Math.min(r.right, k.right), bottom: Math.min(r.bottom, k.bottom) }; o.width = o.right - o.left; o.height = o.bottom - o.top; return o; };
    const add = (r, c) => { const q = cut(r, c); if (see(q)) paint = un(paint, q); };
    const walk = (n) => {
      for (const c of n.children) {
        if (c.hasAttribute("data-node-id")) continue;
        const s = getComputedStyle(c);
        if (s.display === "none" || s.visibility === "hidden" || +s.opacity === 0) continue;
        const r = c.getBoundingClientRect();
        if (c.tagName === "IMG") { if (c.naturalWidth && see(r)) add(imgBox(c), c); continue; }
        if (["svg", "CANVAS", "VIDEO", "IFRAME"].includes(c.tagName)) { if (see(r)) add(r, c); continue; }
        const bg = s.backgroundColor, bi = s.backgroundImage;
        if (see(r) && ((bg && !/, 0\)$/.test(bg) && bg !== "transparent") || (bi && bi !== "none") || parseFloat(s.borderTopWidth) > 0 || parseFloat(s.borderLeftWidth) > 0)) add(r, c);
        for (const t of c.childNodes) if (t.nodeType === 3 && t.textContent.trim()) { const g = document.createRange(); g.selectNodeContents(t); for (const q of g.getClientRects()) { const z = cut(q, t); if (see(z)) ink = un(ink, z); } }
        walk(c);
      }
    };
    walk(host);
    if (!paint && !ink) continue;
    const P = (x) => (x ? [x.l, x.t, x.r, x.b] : null);
    /* The drawn element: the part's own box as the browser draws it, its transform and all. */
    const be = host.querySelector("[data-part-box]") ?? host.querySelector("[data-part]");
    const b = be ? be.getBoundingClientRect() : null;
    out.push({ id: el.getAttribute("data-node-id"), mark: [mk.left, mk.top, mk.right, mk.bottom], paint: P(paint), ink: P(ink), box: b && see(b) ? [b.left, b.top, b.right, b.bottom] : null });
  }
  return out;
});

const nodes = new Map((await doc()).nodes.map((n) => [n.id, n]));
const pure = (tf) => /^matrix\(1, 0, 0, 1, /.test(tf ?? "");
/** Moved, turned or scaled by its own transform or translate. */
const own = (n) => !!(n?.art && ((n.art.transform && n.art.transform !== "none" && n.art.transform !== "matrix(1, 0, 0, 1, 0, 0)") || n.art.translate || n.art.rotate || n.art.scale));
const turns = new Set(KEYFRAMES.filter((k) => k.frames.some((f) => f.style && ("transform" in f.style || "rotate" in f.style || "scale" in f.style))).map((k) => k.name));
/* Its lasting motion rewrites its transform (a spin): drawn wherever it is in its turn, not a still drawing to hold or hug. A float on `translate` is held at its first frame like the rest. */
const lasting = (n) => (n?.motion?.animation ?? []).some((a) => (a.iterations === "infinite" || /forwards|both/.test(a.fill ?? "")) && turns.has(a.name));
/* Every motion held at its first frame, so a look is of the parts and not of the moment. */
const hold = () => page.evaluate(() => { for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = 0; } catch { /* a finished one */ } } });
let furthest = null;
for (const zoom of [0.85, 1]) {
  await page.evaluate((z) => window.__studioHistory.act("setZoom", z), zoom);
  await page.waitForTimeout(900);
  const scale = await page.evaluate(() => { const f = document.querySelector("[data-frame]"); return f ? f.getBoundingClientRect().width / 1440 : 1; });
  const pane = await page.evaluate(() => { const p = document.querySelector("[data-studio-pane]"); return { h: p.scrollHeight, v: p.clientHeight }; });
  const all = new Map();
  for (let y = 0; y < pane.h; y += Math.max(400, pane.v - 150)) {
    await page.evaluate((y) => { document.querySelector("[data-studio-pane]").scrollTop = y; }, y);
    await page.waitForTimeout(400);
    await hold();
    for (const m of await measure()) all.set(m.id, m);
  }
  let held = 0, hugged = 0, owned = 0, spill = 0;
  const off = [], loose = [];
  for (const m of all.values()) {
    const n = nodes.get(m.id);
    if (n && pure(n.art?.transform)) {
      const shift = Math.abs(Number(n.art.transform.split(",")[4]));
      if (!furthest || shift > furthest.shift) furthest = { id: n.id, shift };
    }
    if (lasting(n)) { held++; continue; }
    const d = (a, i) => (a ? (a[i] - m.mark[i]) / scale : 0);
    /* What it paints. Words whose ink runs past the ring are counted apart: set in this machine's fonts they can need more than the captured width (a words-fit matter, EDIT-ISSUES #29, not the ring's); a shifted line of words is held to its ring by the hug below. */
    const e = [d(m.paint, 0), d(m.paint, 1), d(m.paint, 2), d(m.paint, 3)];
    if (e[0] >= -1 && e[1] >= -1 && e[2] <= 1 && e[3] <= 1) held++;
    else off.push(`${m.id} ${n?.featureId} ${e.map(Math.round).join(",")}`);
    if (m.ink && (d(m.ink, 0) < -1 || d(m.ink, 2) > 1)) spill++;
    const pic = n?.featureId === "picture" && m.paint && !m.ink;
    if (own(n) || pic) {
      owned++;
      const p = pic ? m.paint : m.box ?? m.paint ?? m.ink, g = [0, 1, 2, 3].map((i) => Math.abs(p[i] - m.mark[i]) / scale);
      if (Math.max(...g) <= 1) hugged++;
      else loose.push(`${m.id} ${n?.featureId} ${g.map(Math.round).join(",")}`);
    }
  }
  console.log(`       zoom ${zoom}: ${all.size} parts drawn; ${held} inside their ring; ${hugged}/${owned} shifted, turned, scaled or pictures hugged; ${spill} with words wider than the ring`);
  check(`zoom ${Math.round(zoom * 100)}%: what every part draws lies inside its ring, to 1px`, off.length === 0, `${off.length} not: ${off.slice(0, 6).join("; ")}`);
  check(`zoom ${Math.round(zoom * 100)}%: every shifted, turned or scaled part and every picture is hugged by its ring, to 1px`, loose.length === 0, `${loose.length} not: ${loose.slice(0, 6).join("; ")}`);
}

/* The part shifted furthest (the frog), picked: its picked ring and its corner handles are on it. */
/* J's own case first: sol face's hero frog, when the site is sol face. */
const frog = [...nodes.values()].find((n) => /frog in a black hoodie/.test(n.label ?? "") && !n.state);
if (frog) furthest = { id: frog.id, shift: Math.abs(Number(frog.art?.transform?.split(",")[4] ?? 0)) };
if (furthest) {
  const id = furthest.id;
  await page.evaluate((id) => { const el = document.querySelector(`[data-node-id="${id}"]`); const pane = document.querySelector("[data-studio-pane]"); pane.scrollTop += el.getBoundingClientRect().top - pane.getBoundingClientRect().top - 120; }, id);
  await page.waitForTimeout(600);
  await page.evaluate((id) => window.__studioHistory.act("setSelection", [id]), id);
  await page.waitForTimeout(600);
  await hold();
  const got = await page.evaluate((id) => {
    const el = document.querySelector(`[data-node-id="${id}"]`);
    const host = el.querySelector(":scope > [data-part-drawn]");
    const ring = el.querySelector(":scope > [data-turned-mark]") ?? host;
    const drawn = host.querySelector("img") ?? host.querySelector("[data-part-box]") ?? host;
    const R = (e) => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; };
    const c = (h) => { const e = el.querySelector(`:scope > [data-resize="${h}"]`); if (!e) return null; const r = e.getBoundingClientRect(); return [(r.left + r.right) / 2, (r.top + r.bottom) / 2]; };
    return { picked: el.hasAttribute("data-picked"), outline: getComputedStyle(ring).outlineStyle, ring: R(ring), drawn: R(drawn), nw: c("nw"), se: c("se") };
  }, id);
  const scale = await page.evaluate(() => { const f = document.querySelector("[data-frame]"); return f ? f.getBoundingClientRect().width / 1440 : 1; });
  const gap = Math.max(...[0, 1, 2, 3].map((i) => Math.abs(got.ring[i] - got.drawn[i]))) / scale;
  check(`picked, ${id} (shifted ${furthest.shift}px by its own transform) wears its ring on what is drawn, to 1px`, got.picked && got.outline === "solid" && gap <= 1, `ring ${got.ring.map(Math.round)} drawn ${got.drawn.map(Math.round)}`);
  const near = (p, x, y) => p && Math.hypot(p[0] - x, p[1] - y) / scale <= 12;
  check(`its corner handles are at the drawn corners`, near(got.nw, got.drawn[0], got.drawn[1]) && near(got.se, got.drawn[2], got.drawn[3]), `nw ${got.nw?.map(Math.round)} se ${got.se?.map(Math.round)}`);
  await page.evaluate(() => window.__studioHistory.act("setSelection", []));
}

if (!SINK) {
  /* A spin owns the transform: the board leaves the part at its box, as the page does while it turns. */
  const spun = await page.evaluate(() => document.querySelector('[data-node-id="spun"]')?.style.left);
  check("a part whose lasting motion owns its transform stays at its box (left 1100px)", spun === "1100px", String(spun));
}

const after = new Map((await doc()).nodes.map((n) => [n.id, [n.x, n.y, n.w, n.h].join(",")]));
const moved = [...before].filter(([id, b]) => after.get(id) !== b);
check("the stored boxes are what they were (the board's marks moved, not the parts)", moved.length === 0, `${moved.length} moved: ${moved.slice(0, 4).map(([id, b]) => `${id} ${b} → ${after.get(id)}`).join("; ")}`);
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
