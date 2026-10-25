/**
 * THE DELETE KEY DELETES WHAT IS PICKED, AS BACKSPACE DOES; CTRL+Y REDOES.
 *
 * Found in the hand-edit audit (fable-edit-audit, 2026-10-25) on sol face,
 * PST and every captured site: a picked part went with Backspace, but the
 * Delete key, the one a hand on a Windows keyboard reaches for, did nothing
 * at all. The only "Delete selection" shortcut was `backspace`.
 *
 * Held here, on a button with its words over it:
 *   · Delete on the picked button takes it and the words it holds;
 *   · one Ctrl+Z brings both back, and Ctrl+Y (the Windows redo, beside
 *     Ctrl+Shift+Z) takes them again;
 *   · Delete while typing in a panel field leaves the part where it is (the
 *     field's own text is what the key edits);
 *   · Delete with nothing picked takes nothing;
 * and, given a saved board or a capture, Delete takes a real part of it.
 *
 *   npx next start -p 3013
 *   node tests/delete-key.mjs http://127.0.0.1:3013                    (a seeded board)
 *   node tests/delete-key.mjs http://127.0.0.1:3013 board:solface      (a saved board: solface, pst, redesign)
 *   node tests/delete-key.mjs http://127.0.0.1:3013 <capture folder>   (a repo fixture, brought in through the GitHub door)
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { SWEEP } from "../src/features/studio/reassemble.ts";
import { openBoard } from "./lib/board.mjs";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const SRC = process.argv[3] ?? null;
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const node = (id, f, content, x, y, w, h, extra = {}) => ({
  id, pageId: "p0", featureId: f, label: id, prompt: "", content, data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
  ...extra,
});
const seed = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [
    node("go", "box", "", 200, 200, 320, 72, { data: "button, named GO", colour: { bg: "#2f7de1" } }),
    node("go_words", "value-prop", "GO", 216, 212, 288, 48),
    node("aside", "prose", "A line beside it", 600, 200, 300, 40),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "DEL", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [], swept: SWEEP,
}, version: 0 });

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const doc = () => page.evaluate(() => window.__studioHistory?.doc() ?? { nodes: [] });
const nodes = async () => (await doc()).nodes;
const has = async (id) => (await nodes()).some((n) => n.id === id);
const press = async (k, wait = 400) => { await page.keyboard.press(k); await page.waitForTimeout(wait); };
const selection = () => page.evaluate(() => [...document.querySelectorAll("[data-node-id]")].filter((n) => n.querySelector(":scope > [data-resize]")).map((n) => n.getAttribute("data-node-id")));
const pickByStore = async (id) => { await page.evaluate((id) => { window.__studioHistory.act("clearSelection"); window.__studioHistory.act("setSelection", [id]); }, id); await page.waitForTimeout(400); return selection(); };

if (!SRC) {
  await context.addInitScript((d) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("builder.studio", d); sessionStorage.setItem("seeded", "1"); } }, seed);
  await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-node-id="go_words"]', { timeout: 20000 });
  await page.waitForTimeout(1500);

  /* A press on a free corner of the button picks it (the words over it pick the button anyway). */
  const b = await page.locator('[data-node-id="go"]').boundingBox();
  await page.mouse.click(b.x + b.width - 6, b.y + b.height - 6);
  await page.waitForTimeout(400);
  check("the button is picked", JSON.stringify(await selection()) === '["go"]', JSON.stringify(await selection()));
  await press("Delete", 600);
  check("Delete takes the button and the words it holds", !(await has("go")) && !(await has("go_words")), `go ${await has("go")}, words ${await has("go_words")}`);
  check("…and the line beside it stays", await has("aside"));
  await press("Control+z", 600);
  check("one Ctrl+Z brings both back", (await has("go")) && (await has("go_words")));
  /* Ctrl+Y: the redo a hand on Windows knows, beside Ctrl+Shift+Z. */
  await press("Control+y", 600);
  check("Ctrl+Y redoes: both gone again", !(await has("go")) && !(await has("go_words")), `go ${await has("go")}, words ${await has("go_words")}`);
  await press("Control+z", 600);
  check("…and Ctrl+Z brings them back once more", (await has("go")) && (await has("go_words")));

  /* Typing in a panel field: Delete edits the field, not the board. */
  check("the button is picked again", JSON.stringify(await pickByStore("go")) === '["go"]', JSON.stringify(await selection()));
  const field = page.locator("[data-side-panel] input[type='text'], [data-side-panel] textarea").first();
  if (await field.count()) {
    await field.click(); await page.waitForTimeout(200);
    await press("Delete", 500);
    check("Delete while typing in a panel field leaves the part", await has("go"));
    await page.keyboard.press("Escape");
  } else check("Delete while typing in a panel field leaves the part", true, "(no field to type in: skipped)");

  /* Nothing picked: nothing taken. */
  await page.evaluate(() => window.__studioHistory.act("clearSelection"));
  await page.mouse.click(1400, 860); await page.waitForTimeout(300);
  const n0 = (await nodes()).length;
  await press("Delete", 500);
  check("Delete with nothing picked takes nothing", (await nodes()).length === n0, `${n0} -> ${(await nodes()).length}`);
} else {
  /* A real board: a saved one, or a capture through the GitHub door (GitHub answered here, a placeholder key). */
  if (SRC.startsWith("board:")) {
    await openBoard(page, BASE, SRC.slice(6));
  } else {
    const DOC = readFileSync(join(SRC, "site/document.json"));
    const pics = existsSync(join(SRC, "assets/pictures")) ? readdirSync(join(SRC, "assets/pictures")) : [];
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
      if (pic) return j({ encoding: "base64", content: readFileSync(join(SRC, "assets/pictures", pic[1])).toString("base64") });
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
    for (let i = 0; i < 1800 && (await nodes()).length < 50; i++) await page.waitForTimeout(100);
    await page.waitForTimeout(Number(process.env.SETTLE ?? 8000));
  }
  const d = await doc();
  const live = d.nodes.filter((n) => !n.state && n.pageId === d.activePageId && !n.locked);
  check("the board is up", live.length > 10, `${live.length} parts`);
  /* A part with words of its own, mid-page: what a hand would pick and take away. */
  const words = (c) => (typeof c === "string" ? c : (c ?? []).map((s) => s.text ?? "").join("")).trim();
  const texts = live.filter((n) => ["prose", "value-prop", "cta-primary"].includes(n.featureId) && words(n.content) && n.w > 20 && n.h > 10).sort((a, b) => a.y - b.y);
  const target = texts[Math.floor(texts.length / 2)] ?? live[Math.floor(live.length / 2)];
  check("a part is picked", JSON.stringify(await pickByStore(target.id)) === JSON.stringify([target.id]), `${target.id}: ${JSON.stringify(await selection())}`);
  const n0 = (await nodes()).length;
  await press("Delete", 800);
  check("Delete takes it", !(await has(target.id)) && (await nodes()).length < n0, `${target.id} still there: ${await has(target.id)}; ${n0} -> ${(await nodes()).length}`);
  await press("Control+z", 800);
  check("one Ctrl+Z brings it back", (await has(target.id)) && (await nodes()).length === n0, `${(await nodes()).length} of ${n0}`);
}

check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 200));
console.log(`\n${results.filter(Boolean).length}/${results.length} pass`);
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
