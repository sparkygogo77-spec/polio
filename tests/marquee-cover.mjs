/**
 * A marquee takes only what it fully covers, and can be started across a
 * part that holds other parts.
 *
 * HIS RULINGS. A marquee takes only parts it FULLY covers, so dragging a box
 * over a region never picks up what lies behind it. And on a captured board
 * every point is covered by some part — the banner, the panels, the page
 * wrapper — so a marquee could never start: every press grabbed a part and
 * dragged it. So a press on a part that OWNS other parts (wholly contains
 * them) starts a marquee, unless that part is a CONTROL — a button, anything
 * with a link or a button or link role — which is always grabbed, because
 * all eight sidebar buttons on his home page hold their icon; a press on a
 * leaf grabs the leaf; the held
 * modifier (Ctrl, or ⌘ on a Mac) is what draws the marquee across it, since
 * J turned the rule round on 2026-10-06 ("Always moves": a plain drag moves
 * the container); and a plain press on the container with no drag still
 * picks it.
 *
 * Every drag asserts it happened: the marquee rectangle is looked for while
 * the hand is still down, the press point is checked to be over the part the
 * case is about, and a move is read back off the part's own rect.
 *
 *   npx next start -p 3013
 *   node tests/marquee-cover.mjs http://127.0.0.1:3013
 */
import { createRequire } from "node:module";
const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_ = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const node = (id, f, content, x, y, w, h, extra = {}) => ({
  id, pageId: "p0", featureId: f, label: id, prompt: "", content, data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
  ...extra,
});

const doc = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [
    /* A panel, as a capture draws one: a box that holds other parts. */
    node("panel", "box", "", 100, 100, 800, 400, { colour: { bg: "rgb(21, 25, 34)" } }),
    node("a", "value-prop", "A", 150, 160, 120, 60),
    node("b", "value-prop", "B", 320, 160, 120, 60),
    /* Inside the panel, only partly inside the marquee. */
    node("c", "value-prop", "C", 470, 160, 200, 60),
    /* A leaf on its own, for the grab. */
    node("d", "value-prop", "D", 1000, 160, 160, 60),
    /* HIS CASE. A sidebar button whose icon was captured as a part inside it
       (n_ctaprimary_59 holding n_drawnicon_60, and all eight on his home
       page). It owns a part, and it is a control, so it is grabbed. A button
       with nothing inside would pass under either rule and prove nothing. */
    node("btn", "cta-primary", "Creator Hub", 100, 800, 223, 44, { data: "button, named \u201cCreator Hub\u201d", link: { kind: "page", target: "p0" } }),
    node("btnIcon", "drawn-icon", "", 116, 812, 20, 20, { role: "icon" }),
    /* A captured box the browser called a button, with a part inside it: a control too. */
    node("boxBtn", "box", "", 400, 800, 32, 32, { data: "button, named \u201cDocs\u201d" }),
    node("boxIcon", "drawn-icon", "", 408, 808, 16, 16, { role: "icon" }),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "MARQUEE", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [],
}, version: 0 });

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"], ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await context.addInitScript((d) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("builder.studio", d); sessionStorage.setItem("seeded", "1"); } }, doc);
const page = await context.newPage();
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);

/* Board → screen, measured off the panel as it is drawn now (read fresh each time, never kept across a scroll). */
const map = async () => {
  const r = await page.locator('[data-node-id="panel"]').boundingBox();
  const k = r.width / 800;
  return (x, y) => [r.x + (x - 100) * k, r.y + (y - 100) * k];
};
const rectOf = (id) => page.locator(`[data-node-id="${id}"]`).boundingBox();
const picked = () => page.evaluate(() => [...document.querySelectorAll("[data-node-id]")].filter((n) => n.querySelector('[data-mode="live"]')).map((n) => n.getAttribute("data-node-id")).sort());
const ownerAt = (x, y) => page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest("[data-node-id]")?.getAttribute("data-node-id") ?? (document.elementFromPoint(x, y)?.closest("[data-frame]") ? "frame" : "elsewhere"), [x, y]);
const backgroundPicked = () => page.evaluate(() => !!document.querySelector("[data-frame][data-selected]"));

/* A drag in steps, looking for the marquee while the hand is still down. */
const drag = async (from, to, mods = []) => {
  for (const m of mods) await page.keyboard.down(m);
  await page.mouse.move(...from);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(from[0] + ((to[0] - from[0]) * i) / 8, from[1] + ((to[1] - from[1]) * i) / 8);
  await page.waitForTimeout(150);
  const drawn = await page.evaluate(() => {
    const m = document.querySelector("[data-marquee]");
    const r = m?.getBoundingClientRect();
    return r && r.width > 2 && r.height > 2 ? [r.width, r.height] : null;
  });
  await page.mouse.up();
  for (const m of mods) await page.keyboard.up(m);
  await page.waitForTimeout(500);
  return drawn;
};

/* 1. A marquee across the panel takes a and b, which it covers, and not c or the panel. */
let at = await map();
const start = at(120, 130), end = at(480, 240);
check("the press point is over the panel and nothing else", (await ownerAt(...start)) === "panel", await ownerAt(...start));
const panelBefore = await rectOf("panel");
const drawn = await drag(start, end, ["Control"]);
check("with Ctrl held, a press-drag on a part that holds others draws a marquee", !!drawn, JSON.stringify(drawn));
const panelAfter = await rectOf("panel");
check("…and does not move the panel", Math.abs(panelAfter.x - panelBefore.x) < 1 && Math.abs(panelAfter.y - panelBefore.y) < 1, `${panelBefore.x},${panelBefore.y} → ${panelAfter.x},${panelAfter.y}`);
const got = await picked();
check("…and takes exactly the parts it fully covers: a and b", JSON.stringify(got) === JSON.stringify(["a", "b"]), got.join(", ") || "nothing");

/* 2. A marquee on the bare page that catches nothing leaves nothing picked, not the background. */
at = await map();
const bare0 = at(100, 560), bare1 = at(300, 640);
check("the press point is on the bare page", (await ownerAt(...bare0)) === "frame", await ownerAt(...bare0));
const drawn2 = await drag(bare0, bare1);
check("a drag on the bare page draws a marquee", !!drawn2, JSON.stringify(drawn2));
check("…and catching nothing, picks nothing", (await picked()).length === 0, (await picked()).join(", "));
check("…not even the page background behind it", (await backgroundPicked()) === false);

/* 3. A plain press on the panel, with no drag, still picks it. */
at = await map();
const tap = at(120, 460);
check("the tap point is over the panel", (await ownerAt(...tap)) === "panel", await ownerAt(...tap));
await page.mouse.click(...tap);
await page.waitForTimeout(500);
check("a plain press on a part that holds others picks it", JSON.stringify(await picked()) === JSON.stringify(["panel"]), (await picked()).join(", ") || "nothing");

/* 4. A leaf is grabbed and moved, as before. */
at = await map();
const dRect = await rectOf("d");
const dAt = [dRect.x + 10, dRect.y + dRect.height - 6];
check("the press point is over the leaf", (await ownerAt(...dAt)) === "d", await ownerAt(...dAt));
const k = (await rectOf("panel")).width / 800;
await drag(dAt, [dAt[0] + 60 * k, dAt[1]]);
const dAfter = await rectOf("d");
check("a press-drag on a leaf moves the leaf", Math.abs((dAfter.x - dRect.x) / k - 60) < 12, `${((dAfter.x - dRect.x) / k).toFixed(1)} board px`);

/* 4b. A control that holds a part is still grabbed: his sidebar button, and a captured box the browser called a button. */
for (const [id, w, kid] of [["btn", 223, "btnIcon"], ["boxBtn", 32, "boxIcon"]]) {
  // Into view first, and every rect read after the scroll, never before it.
  // Centred: at the edge of the pane the Builder's own chrome covers the board.
  await page.evaluate((id) => document.querySelector(`[data-node-id="${id}"]`).scrollIntoView({ block: "center" }), id);
  await page.waitForTimeout(300);
  const r0 = await rectOf(id);
  const kk = r0.width / w;
  // Clear of the icon inside it, so the press is on the control itself.
  const at2 = [r0.x + r0.width - 4 * kk, r0.y + r0.height - 3 * kk];
  check(`${id}: the press point is over the control, not its icon`, (await ownerAt(...at2)) === id, await ownerAt(...at2));
  /* Holding is decided from the parts' stored boxes, which is what the rule
     reads: a drawn icon with no drawing in it renders taller than its box,
     so its drawn rect is not the question. */
  const boxes = await page.evaluate(([a, b]) => {
    const all = JSON.parse(localStorage.getItem("builder.studio") ?? "{}").state?.nodes ?? [];
    return [a, b].map((x) => { const n = all.find((m) => m.id === x); return n ? [n.x, n.y, n.x + n.w, n.y + n.h] : null; });
  }, [id, kid]);
  const [A, B] = boxes;
  const ownsKid = !!A && !!B && B[0] >= A[0] && B[1] >= A[1] && B[2] <= A[2] && B[3] <= A[3];
  check(`${id}: it really does hold a part (else this proves nothing)`, ownsKid, JSON.stringify(boxes));
  // Diagonal, so a marquee under the old rule would have height to be seen by.
  const marquee = await drag(at2, [at2[0] + 50 * kk, at2[1] + 20 * kk]);
  const r1 = await rectOf(id);
  check(`${id}: a press-drag on it draws no marquee`, marquee === null, JSON.stringify(marquee));
  check(`${id}: …and moves it`, Math.abs((r1.x - r0.x) / kk - 50) < 12, `${((r1.x - r0.x) / kk).toFixed(1)} board px`);
}

/* 5. A plain drag moves the panel, like any part (J, 2026-10-06: "Always moves"). */
at = await map();
const p0 = await rectOf("panel");
const grab = at(120, 460);
check("the press point is over the panel", (await ownerAt(...grab)) === "panel", await ownerAt(...grab));
await drag(grab, [grab[0] + 40 * k, grab[1]]);
const p1 = await rectOf("panel");
check("a plain press-drag on the panel moves the panel", Math.abs((p1.x - p0.x) / k - 40) < 12, `${((p1.x - p0.x) / k).toFixed(1)} board px`);

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
