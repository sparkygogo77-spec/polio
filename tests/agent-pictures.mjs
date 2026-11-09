#!/usr/bin/env node
/**
 * EYES: site.shot ANSWERS A REAL PICTURE (handovers/INTERFACE-OPTIONS.md,
 * section 3, card 4).
 *
 *   1. pure: the tool takes part, screen and side; a result with a picture is
 *      answered as an image the model sees, a refusal as words;
 *   2. on a board, through a stub of the dock frame: a part's shot decodes,
 *      is the part's size with a margin, is no bigger than asked, and looks
 *      like the browser's own screenshot of the same place (mean colour
 *      difference); the screen's shot is what is on screen; a shot is a read:
 *      no undo step, the version stands; another page, a part not on the board,
 *      a part on another page and a bad side are refused plainly; the reply
 *      fits the helper's limit;
 *   3. the same on every repo fixture.
 *
 *   npx next start -p 3361
 *   node tests/agent-pictures.mjs                                (part 1)
 *   node tests/agent-pictures.mjs http://127.0.0.1:3361          (parts 1, 2 on sol face)
 *   node tests/agent-pictures.mjs http://127.0.0.1:3361 <sink>   (and on every repo fixture)
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { openBoard } from "./lib/board.mjs";

const BASE = process.argv[2]?.replace(/\/$/, "") ?? null;
const SINK = process.argv[3] ?? process.env.SINK ?? null;
const HELPER = "http://127.0.0.1:47821";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

process.env.POLIO_SITE_NO_MAIN = "1";
const M = await import("../helper/mcp/site.ts");

/* 1. Pure. */
const tool = M.SITE_TOOLS.find((t) => t.name === "site.shot");
check("1. the tool takes part, screen and side", ["part", "screen", "side"].every((k) => k in tool.inputSchema.properties) && /picture/i.test(tool.description));
const req = M.toRequest("site.shot", { part: "n1", side: 400 }, "i");
check("…and passes them on", req.op === "shot" && req.part === "n1" && req.side === 400 && !("screen" in req) && M.toRequest("site.shot", { screen: true }, "i").screen === true);
const pic = await M.handle({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "site.shot", arguments: { part: "n1" } } }, async () => ({ ok: true, result: { ref: "r", picture: { mime: "image/webp", width: 2, height: 2, data: "AAAA" }, missing: [] } }));
check("a result with a picture is answered as an image the model sees, and the rest as words", pic.result.content[0].type === "image" && pic.result.content[0].data === "AAAA" && pic.result.content[0].mimeType === "image/webp" && pic.result.content[1].type === "text" && /"ref":"r"/.test(pic.result.content[1].text) && !/AAAA/.test(pic.result.content[1].text), JSON.stringify(pic.result).slice(0, 200));
const no = await M.handle({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "site.shot", arguments: { part: "n9" } } }, async () => ({ ok: false, says: "part \"n9\" is not on the open site" }));
check("…a refusal is words, marked as an error", no.result.isError === true && no.result.content[0].type === "text" && /n9/.test(no.result.content[0].text));

/* 2. On a board. */
const STUB = `<!doctype html><title>dock stub</title><body>dock<script>
window.ask = (req) => new Promise((done) => { const on = (e) => { if (e.data && e.data.kind === "site" && e.data.id === req.id) { removeEventListener("message", on); done(e.data); } }; addEventListener("message", on); parent.postMessage(req, "*"); setTimeout(() => { removeEventListener("message", on); done({ timeout: true }); }, 90000); });
</script>`;
const AT = process.env.PLAYWRIGHT_CHROMIUM;
const launch = () => chromium.launch({ args: ["--no-sandbox"], ...(AT ? { executablePath: AT } : {}) });
let browser = await launch();
/* A headless board under swiftshader can stall for good mid-site (tests/agent-commands.mjs says where): a site past this many minutes is marked, its
   browser thrown away, and the next site gets a new one. */
const SITE_MINUTES = Number(process.env.SITE_MINUTES) || 5;
async function guarded(label, doc) {
  let t;
  const stall = new Promise((_, rej) => { t = setTimeout(() => rej(new Error(`stalled for ${SITE_MINUTES} minutes`)), SITE_MINUTES * 60_000); });
  try { await Promise.race([onBoard(label, doc), stall]); }
  catch (e) {
    check(`${label}: ran to the end (the headless renderer ${e.message})`, false, String(e.stack ?? e).split("\n").slice(0, 2).join(" "));
    const old = browser;
    await Promise.race([old.close().catch(() => {}), new Promise((r) => setTimeout(r, 10_000))]);
    try { old.process()?.kill("SIGKILL"); } catch {}
    browser = await launch();
  } finally { clearTimeout(t); }
}
const errors = [];

async function onBoard(label, doc) {
  const say = (name, ok, detail) => check(`${label}: ${name}`, ok, detail);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route(`${HELPER}/**`, (r) => r.fulfill({ status: 200, contentType: "text/html", headers: { "access-control-allow-origin": "*" }, body: STUB }));
  await ctx.route("https://api.github.com/**", (r) => r.abort());
  const page = await ctx.newPage();
  page.setDefaultTimeout(180_000);
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  await openBoard(page, BASE, "solface");
  if (doc) { await page.evaluate((d) => window.__studioLoadDoc(d), { ...doc, activePageId: doc.pages[0].id }); await page.waitForTimeout(1500); }
  await page.locator("[data-agents-button]").click();
  await page.locator("[data-agents-frame]").waitFor({ timeout: 120_000 });
  /* The dock opens on its Chats tab, 1040px wide (lanes-board); the shots below are of parts clear of the Helper tab's 380px. */
  await page.locator('[data-agents-tab="helper"]').click({ timeout: 5000 }).catch(() => {});
  const dock = page.frames().find((f) => f.url().startsWith(HELPER));
  await page.waitForTimeout(1500);
  let n = 0;
  const ask = (more) => dock.evaluate((r) => window.ask(r), { source: "polio-dock", kind: "site", v: 1, id: `s${++n}`, ...more });
  const past = () => page.evaluate(() => window.__agents.board().past);

  /* The picture, decoded in the browser: its size, and how far it is from the browser's own screenshot of the same place. */
  const measure = (data, mime, against) => page.evaluate(async ({ data, mime, against }) => {
    const load = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error("won't decode")); i.src = src; });
    const ours = await load(`data:${mime};base64,${data}`);
    const c = document.createElement("canvas"); c.width = ours.naturalWidth; c.height = ours.naturalHeight;
    const g = c.getContext("2d"); g.drawImage(ours, 0, 0);
    const a = g.getImageData(0, 0, c.width, c.height).data;
    const colours = new Set(); for (let i = 0; i < a.length; i += 16) colours.add((a[i] >> 4) * 4096 + (a[i + 1] >> 4) * 256 + (a[i + 2] >> 4) * 16 + (a[i + 3] >> 4));
    let diff = null;
    if (against) {
      const theirs = await load(`data:image/png;base64,${against}`);
      const d = document.createElement("canvas"); d.width = c.width; d.height = c.height;
      const h = d.getContext("2d"); h.drawImage(theirs, 0, 0, c.width, c.height);
      const b = h.getImageData(0, 0, c.width, c.height).data;
      let sum = 0, count = 0;
      for (let i = 0; i < a.length; i += 4) { sum += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); count += 3; }
      diff = sum / count;
    }
    return { w: ours.naturalWidth, h: ours.naturalHeight, colours: colours.size, diff };
  }, { data, mime, against });

  const outline = await ask({ op: "outline" });
  const home = outline.result.activePageId;
  const v0 = outline.result.version;
  const p0 = await past();
  /* A part fully on screen and clear of the dock (the right 380 px) and the top bar, with words, not picked. */
  const geo = await page.evaluate(() => {
    const frame = document.querySelector("[data-frame]").getBoundingClientRect();
    const out = {};
    for (const el of document.querySelectorAll("[data-node-id]")) { const id = el.getAttribute("data-node-id"); if (out[id]) continue; const r = el.getBoundingClientRect(); if (r.width && r.height) out[id] = { x: r.x, y: r.y, w: r.width, h: r.height }; }
    return { frame: { x: frame.x, y: frame.y, w: frame.width, h: frame.height }, parts: out };
  });
  await page.evaluate(() => window.__studioSelect([]));
  const onPage = outline.result.pages.find((p) => p.id === home).parts;
  const fits = (r) => r && r.x >= 2 && r.y >= 60 && r.x + r.w <= 1050 && r.y + r.h <= 890 && r.w >= 40 && r.h >= 20 && r.w <= 700;
  const target = onPage.find((p) => p.words && fits(geo.parts[p.id])) ?? onPage.find((p) => fits(geo.parts[p.id]));
  if (!target) { say("a part on screen to shoot", false, "none clear of the dock"); await ctx.close(); return; }
  const r = geo.parts[target.id];
  const scale = geo.frame.w / outline.result.frameWidth;

  const shot = await ask({ op: "shot", part: target.id });
  const pic = shot.result?.picture;
  say("a part's shot answers a picture, its crop the part with a margin, in the page's pixels", shot.ok === true && pic && typeof pic.data === "string" && pic.data.length > 100 && pic.crop.w >= r.w / scale && pic.crop.h >= r.h / scale && pic.crop.w <= r.w / scale + 40 && pic.crop.h <= r.h / scale + 40 && Array.isArray(shot.result.missing), JSON.stringify(shot.says ?? { crop: pic?.crop, r, scale }));
  if (pic) {
    const against = (await page.screenshot({ clip: { x: geo.frame.x + pic.crop.x * scale, y: geo.frame.y + pic.crop.y * scale, width: pic.crop.w * scale, height: pic.crop.h * scale } })).toString("base64");
    const m = await measure(pic.data, pic.mime, against);
    say("…it decodes, at the size it says, no longer than 800 on its long side, and not blown up", m.w === pic.width && m.h === pic.height && Math.max(m.w, m.h) <= 800 && pic.scale <= 1 && Math.abs(m.w - pic.crop.w * pic.scale) <= 1, JSON.stringify({ m, scale: pic.scale }));
    say("…it is a real picture of that place: more than one colour, and close to the browser's own screenshot", m.colours > 1 && m.diff !== null && m.diff < 40, `${m.colours} colours, mean difference ${m.diff?.toFixed(1)} of 255`);
    say("…and fits the helper's reply limit", JSON.stringify(shot).length < 1_000_000, `${JSON.stringify(shot).length} characters`);
    if (shot.result.missing.length) console.log(`       (not drawn: ${shot.result.missing.join("; ")})`);
  }
  const small = await ask({ op: "shot", part: target.id, side: 120 });
  /* A part already under the side asked for stays as it is: it is not blown up. */
  const bigger = Math.max(pic?.width ?? 0, pic?.height ?? 0) > 120, sm = small.result?.picture;
  say(bigger ? "a smaller side makes a smaller picture" : "a side past a small part leaves it its own size", small.ok === true && !!sm && Math.max(sm.width, sm.height) <= 120 && (bigger ? sm.data.length < pic.data.length : sm.width === pic.width && sm.height === pic.height), small.says ?? JSON.stringify({ small: [sm?.width, sm?.height, sm?.data?.length], full: [pic?.width, pic?.height, pic?.data?.length] }));

  const screen = await ask({ op: "shot" });
  const sp = screen.result?.picture;
  if (sp) {
    const m = await measure(sp.data, sp.mime, null);
    const seenW = (Math.min(geo.frame.x + geo.frame.w, 1440) - Math.max(geo.frame.x, 0)) / scale, seenH = (Math.min(geo.frame.y + geo.frame.h, 900) - Math.max(geo.frame.y, 0)) / scale;
    say("with no part, the shot is what J sees of the board", screen.ok === true && Math.abs(sp.crop.w - seenW) <= 2 && Math.abs(sp.crop.h - seenH) <= 2 && Math.max(m.w, m.h) <= 800 && m.colours > 1, JSON.stringify({ crop: sp.crop, seenW: Math.round(seenW), seenH: Math.round(seenH), m }));
  } else say("with no part, the shot is what J sees of the board", false, screen.says);
  say("a shot is a read: no undo step, and the version stands", (await past()) === p0 && (await ask({ op: "outline" })).result.version === v0);

  const gone = await ask({ op: "shot", part: "n_nope" });
  say("a part not on the board is refused", gone.ok === false && /n_nope/.test(gone.says), gone.says);
  const other = outline.result.pages.find((p) => p.id !== home);
  if (other) {
    const away = await ask({ op: "shot", page: other.id });
    say("…so is a page that isn't the open one, saying which is", away.ok === false && /isn't drawn/.test(away.says) && away.says.includes(home), away.says);
    const far = other.parts[0];
    if (far) { const r2 = await ask({ op: "shot", part: far.id }); say("…and a part on it", r2.ok === false && /isn't drawn/.test(r2.says), r2.says); }
  }
  const bad = await ask({ op: "shot", part: target.id, side: 5000 });
  say("…and a side past the range", bad.ok === false && /100 to 1600/.test(bad.says), bad.says);
  await ctx.close();
}

if (BASE) {
  const only = process.env.ONLY_SITE;
  if (!only) await guarded("sol face", null);
  if (SINK) {
    for (const site of ["share-xyz", "trumpmorty-fun", "gotchi-gg", "stonkfun-xyz", "parasiteonsol-fun", "trendtrader-pro"]) {
      if (only && only !== site) continue;
      const file = join(SINK, "sites", site, "site", "document.json");
      if (!existsSync(file)) { check(`${site}: its capture is here`, false, file); continue; }
      await guarded(site, JSON.parse(readFileSync(file, "utf8")));
    }
  } else console.log("  --   the fixtures skipped: no fixtures folder given (argv 3 or SINK)");
} else console.log("  --   part 2 skipped: no Builder address given");

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await Promise.race([browser.close().catch(() => {}), new Promise((r) => setTimeout(r, 10_000))]);
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
