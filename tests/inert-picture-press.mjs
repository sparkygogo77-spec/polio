/**
 * AN INERT PICTURE IS STILL PICKED BY A PRESS; ONLY A SHEET LETS IT THROUGH.
 *
 * trumpmorty.fun's planet, a 300px picture beside the hero words, is
 * `pointer-events: none` on the page so the words over it can be selected.
 * The import keeps that as `inert`, and the board let a press on any inert
 * part through to what is under it, which is right for the page's grain (a
 * 1440×900 sheet over everything, `tests/board-inert.mjs`) and for nothing
 * else: the planet could not be picked, moved or swapped by hand at all (the
 * hand-edit audit, 2026-10-25). Words had already been excepted
 * (`tests/inert-words-press.mjs`); now anything narrower than a sheet is.
 *
 * Held here, on a section with an inert picture on it and an inert grain
 * sheet over both:
 *   · a press on the picture picks the picture;
 *   · a drag moves it;
 *   · a press on the bare section still picks the section (the sheet lets it through);
 * and, given a capture, a press on its inert picture picks it (trumpmorty's planet).
 *
 *   npx next start -p 3013
 *   node tests/inert-picture-press.mjs http://127.0.0.1:3013
 *   node tests/inert-picture-press.mjs http://127.0.0.1:3013 capture/sites/trumpmorty-fun [n_picture_11]
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { SWEEP } from "../src/features/studio/reassemble.ts";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const SINK = process.argv[3] ?? null;
const WANT = process.argv[4] ?? null;
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const node = (id, f, x, y, w, h, extra = {}) => ({
  id, pageId: "p0", featureId: f, label: id, prompt: "", content: "", data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
  from: { url: "https://x.test/", host: "x.test", selector: `body > main > ${id}`, at: 1 },
  ...extra,
});
const seed = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [
    node("hero", "box", 0, 0, 1440, 900, { colour: { bg: "#182030" }, from: { url: "https://x.test/", host: "x.test", selector: "body > main > section", at: 1 } }),
    node("planet", "picture", 700, 200, 300, 300, { inert: true, colour: { bg: "#c06030" }, from: { url: "https://x.test/", host: "x.test", selector: "body > main > section > img", at: 1 } }),
    node("grain", "box", 0, 0, 1440, 900, { inert: true, opacity: 0.05, colour: { bg: "#ffffff" }, from: { url: "https://x.test/", host: "x.test", selector: "body > div.grain", at: 1, position: "fixed" } }),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "INERT", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [], swept: SWEEP,
}, version: 0 });

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const context = await browser.newContext({ viewport: { width: 1760, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const doc = () => page.evaluate(() => window.__studioHistory?.doc() ?? { nodes: [] });
const selection = () => page.evaluate(() => [...document.querySelectorAll("[data-node-id]")].filter((n) => n.querySelector(":scope > [data-resize]")).map((n) => n.getAttribute("data-node-id")));
const clear = () => page.evaluate(() => window.__studioHistory.act("clearSelection"));
const centre = (id) => page.evaluate((id) => { const r = document.querySelector(`[data-node-id="${id}"]`).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, id);
const show = async (id) => { await page.evaluate((id) => { const el = document.querySelector(`[data-node-id="${id}"]`); const pane = document.querySelector("[data-studio-pane]"); if (!el || !pane) return; const r = el.getBoundingClientRect(), p = pane.getBoundingClientRect(); pane.scrollTop += r.top - p.top - 250; }, id); await page.waitForTimeout(500); };

if (!SINK) {
  await context.addInitScript((d) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("builder.studio", d); sessionStorage.setItem("seeded", "1"); } }, seed);
  await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-node-id="planet"]', { timeout: 20000 });
  await page.waitForTimeout(1500);

  const [px, py] = await centre("planet");
  await page.mouse.click(px, py); await page.waitForTimeout(500);
  check("a press on the inert picture picks the picture", JSON.stringify(await selection()) === '["planet"]', JSON.stringify(await selection()));

  const before = (await doc()).nodes.find((n) => n.id === "planet");
  await page.mouse.move(px, py); await page.mouse.down();
  for (let i = 1; i <= 8; i++) { await page.mouse.move(px + 10 * i, py + 5 * i); await page.waitForTimeout(16); }
  await page.mouse.up(); await page.waitForTimeout(800);
  const after = (await doc()).nodes.find((n) => n.id === "planet");
  check("a drag moves it", after.x > before.x + 20 && after.y > before.y + 10, `${before.x},${before.y} -> ${after.x},${after.y}`);
  await clear(); await page.keyboard.press("Control+z"); await page.waitForTimeout(600);

  await clear(); await page.waitForTimeout(200);
  const [hx, hy] = await centre("hero");
  await page.mouse.click(hx - 500, hy + 300); await page.waitForTimeout(500);
  check("a press on the bare section still picks the section: the grain sheet lets it through", JSON.stringify(await selection()) === '["hero"]', JSON.stringify(await selection()));
  check("the sheet itself is not what a press picks", !(await selection()).includes("grain"));
} else {
  /* A capture through the GitHub door (GitHub answered here, a placeholder key). */
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
  for (let i = 0; i < 1800 && (await doc()).nodes.length < 50; i++) await page.waitForTimeout(100);
  await page.waitForTimeout(Number(process.env.SETTLE ?? 8000));
  const d = await doc();
  const live = d.nodes.filter((n) => !n.state && n.pageId === d.activePageId);
  check("the site came in", live.length >= 50, `${live.length} parts`);
  /* The inert pictures and icons narrower than a sheet: each is picked by a press on it. A part another part covers is left out: that is EDIT-ISSUES #14's. */
  const pageW = d.frameWidth ?? 1440;
  const inert = live.filter((n) => n.inert && (n.featureId === "picture" || n.featureId === "drawn-icon") && n.w < pageW * 0.9 && n.w >= 40 && n.h >= 40 && (!WANT || n.id === WANT));
  check("the capture has inert pictures to press", inert.length > 0, `${inert.length}: ${inert.slice(0, 5).map((n) => `${n.id} ${n.w}×${n.h}`).join(", ")}`);
  let tried = 0, picked = 0;
  for (const n of inert.slice(0, 6)) {
    await clear(); await show(n.id);
    const at = await page.evaluate((id) => {
      const el = document.querySelector(`[data-node-id="${id}"]`); if (!el) return null;
      const r = el.getBoundingClientRect();
      /* A point of it no other part covers: what a hand would press. */
      for (const [fx, fy] of [[0.5, 0.5], [0.3, 0.3], [0.7, 0.7], [0.3, 0.7], [0.7, 0.3], [0.15, 0.5], [0.85, 0.5]]) {
        const x = r.left + r.width * fx, y = r.top + r.height * fy;
        const hit = document.elementFromPoint(x, y)?.closest("[data-node-id]");
        const over = hit && hit !== el && !el.contains(hit) && !hit.contains(el) && getComputedStyle(hit).pointerEvents !== "none";
        if (!over) return [x, y];
      }
      return null;
    }, n.id);
    if (!at) { console.log(`   (${n.id} is covered by another part: skipped)`); continue; }
    tried++;
    await page.mouse.click(at[0], at[1]); await page.waitForTimeout(500);
    const s = await selection();
    const ok = s.length === 1 && s[0] === n.id;
    if (ok) picked++;
    console.log(`   ${ok ? "ok" : "--"} press on ${n.id} (${n.w}×${n.h}) picks ${JSON.stringify(s)}`);
  }
  check("every inert picture pressed is picked", tried > 0 && picked === tried, `${picked} of ${tried}`);
}

check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 200));
console.log(`\n${results.filter(Boolean).length}/${results.length} pass`);
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
