#!/usr/bin/env node
/**
 * THE AGENTS BUTTON, THE DOCK FRAME AND ASK AGENTS (J, 2026-10-25, Q9).
 *
 * `src/features/agents/`: an Agents button in the top bar opens a dock on
 * the right, a frame the helper serves at 127.0.0.1:47821/dock. The Builder
 * hands it context as data and nothing else: no pairing token, no control.
 * A part's wheel (its right-press) has Ask agents in its tray, with five
 * actions; each opens the dock with the action and the part's chips.
 *
 *   1. pure: the context for a part carries its id, kind, page, a shot
 *      reference and its System tokens; the gate refuses a token, a control
 *      and anything shaped like a key;
 *   2. the button opens the dock frame at the helper's address (stubbed);
 *   3. a helper that can't be reached shows the setup state: Start the
 *      helper (polio-helper://start), the setup steps and the fallback page;
 *   4. right-press a part, Ask agents → Security check: the frame gets one
 *      context message with action "security" and the part's chips, from the
 *      Builder's origin, and no token or control in any message;
 *   5. with capture folders: each site brought in, the same steps on a part
 *      of it, and the board identical part by part; no page errors.
 *
 *   npx next start -p 3171
 *   node tests/agents-entry.mjs http://127.0.0.1:3171 [capture/sites/<name> …]
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { SWEEP } from "../src/features/studio/reassemble.ts";

const BASE = (process.argv[2] ?? "http://127.0.0.1:3171").replace(/\/$/, "");
const SITES = process.argv.slice(3);
const HELPER = "http://127.0.0.1:47821";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

/* 1. Pure. */
let C = null;
try { C = await import("../src/features/agents/context.ts"); } catch (e) { check("the agents context module loads", false, String(e?.message ?? e).slice(0, 120)); }
if (C) {
  check("the five part actions, in the contract's order", JSON.stringify(C.PART_ACTIONS) === JSON.stringify(["change", "features", "security", "backend", "explain"]));
  check("the dock is the helper's page on loopback", C.DOCK_URL === `${HELPER}/dock` && C.START_LINK === "polio-helper://start");
  const system = { id: "sysA", tokens: { colour: [{ id: "c1", name: "accent", value: "#ff0044" }], type: { faces: [], scale: null, steps: [{ id: "t1", name: "body", px: 16 }] }, space: [], radius: [{ id: "r1", name: "round", px: 8 }], shadow: [], motion: { durations: [], easings: [] } } };
  const part = { id: "b2", featureId: "cta-primary", label: "Buy now", pageId: "p0", x: 100, y: 600, w: 220, h: 56, sys: { s: "sysA", f: { "colour.bg": "c1", radius: "r1", "font.px": "gone" } } };
  const ctx = C.contextFor("security", part, { id: "p0", name: "Home", path: "/" }, 1440, system);
  check("the context has the part's id and kind, and its page", ctx.part?.id === "b2" && ctx.part.kind === "cta-primary" && ctx.page?.id === "p0", JSON.stringify(ctx.part));
  check("chips: the part, the page and a shot reference", JSON.stringify(ctx.chips.map((c) => c.kind)) === '["part","page","shot"]' && ctx.chips[2].ref === "board:p0@1440#b2", JSON.stringify(ctx.chips));
  check("the part's System tokens, by name and value; a dangling link is left out", JSON.stringify(ctx.systemTokens) === JSON.stringify([{ field: "colour.bg", tokenId: "c1", name: "accent", value: "#ff0044" }, { field: "radius", tokenId: "r1", name: "round", value: "8px" }]), JSON.stringify(ctx.systemTokens));
  check("the gate passes a clean context", C.checkContext(ctx).length === 0, C.checkContext(ctx).join("; "));
  check("…and refuses a pairing token", C.checkContext({ ...ctx, token: "abc" }).length > 0);
  check("…a control", C.checkContext({ ...ctx, kind: "control" }).length > 0 && C.checkContext({ ...ctx, part: { ...ctx.part, control: { do: "approve" } } }).length > 0);
  check("…and anything shaped like a key, at any depth", C.checkContext({ ...ctx, chips: [{ kind: "part", id: "x", name: "ghp_" + "a".repeat(30) }] }).length > 0);
  check("…and an unknown action", C.checkContext({ ...ctx, action: "deploy" }).length > 0);
}

const node = (id, f, content, x, y, w, h, extra = {}) => ({
  id, pageId: "p0", featureId: f, label: id, prompt: "", content, data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
  ...extra,
});
const from = (selector) => ({ from: { url: "https://x.test/", host: "x.test", selector, at: 1 } });
const S = (i) => `body > main > section:nth-of-type(${i})`;
const doc = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [
    node("main", "box", "", 0, 0, 1440, 1100, { colour: { bg: "rgb(20, 20, 30)" }, ...from("body > main") }),
    node("s1", "box", "", 0, 0, 1440, 400, { colour: { bg: "rgb(200, 60, 60)" }, ...from(S(1)) }),
    node("h1", "value-prop", "FIRST", 100, 100, 400, 60, { ...from(`${S(1)} > h2`) }),
    node("s2", "box", "", 0, 420, 1440, 300, { colour: { bg: "rgb(60, 200, 60)" }, ...from(S(2)) }),
    node("b2", "cta-primary", "Buy now", 100, 500, 220, 56, { colour: { bg: "rgb(30, 30, 200)", text: "#ffffff" }, ...from(`${S(2)} > a.btn`) }),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "AGENTS", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [], swept: SWEEP,
}, version: 0 });

/* The dock, stubbed: it keeps every message it is handed, with where it came from. */
const STUB = `<!doctype html><title>dock stub</title><body>dock<script>window.got=[];addEventListener("message",(e)=>got.push({origin:e.origin,data:e.data}));</script>`;
const helperUp = (ctx) => ctx.route(`${HELPER}/**`, (r) => r.fulfill({ status: 200, contentType: "text/html", headers: { "access-control-allow-origin": "*" }, body: STUB }));
const helperDown = (ctx) => ctx.route(`${HELPER}/**`, (r) => r.abort("connectionrefused"));

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });

const board = (page) => page.evaluate(() => {
  const drawn = [...document.querySelectorAll("[data-node-id]")].map((el) => { const r = el.getBoundingClientRect(); return `${el.getAttribute("data-node-id")}:${Math.round(r.x * 10)},${Math.round(r.y * 10)},${Math.round(r.width * 10)},${Math.round(r.height * 10)}`; });
  const stored = (window.__studioHistory?.doc().nodes ?? []).map((n) => `${n.id}:${n.x},${n.y},${n.w},${n.h}`);
  return { drawn, stored };
});
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const diff = (a, b) => { const bs = new Set(b.drawn); const moved = a.drawn.filter((d) => !bs.has(d)); return `${moved.length} of ${a.drawn.length} drawn moved${moved.length ? `: ${moved.slice(0, 3).join(" ")}` : ""}; stored ${same(a.stored, b.stored) ? "same" : "changed"}`; };
const closeWheel = async (page) => { for (let i = 0; i < 4 && (await page.locator("[data-radial]").count()); i++) { await page.keyboard.press("Escape"); await page.waitForTimeout(250); } };
const frameMsgs = async (page) => { const f = page.frames().find((x) => x.url().startsWith(HELPER)); return f ? f.evaluate(() => window.got ?? []) : null; };

/** Right-press a part, open the tray, Ask agents…, then an action. Returns what the chooser and the frame saw. */
async function askOn(page, id, action) {
  await closeWheel(page);
  const b = await page.locator(`[data-node-id="${id}"]`).first().boundingBox();
  await page.mouse.click(b.x + Math.min(20, b.width / 2), b.y + Math.min(20, b.height / 2), { button: "right" });
  await page.waitForTimeout(700);
  const tray = page.locator('[data-tray="part"]').first();
  if (!(await tray.count())) return { tray: false };
  await tray.hover(); await page.waitForTimeout(400);
  const item = page.locator('[data-tray="part"] [data-tray-item="ask-agents"]').first();
  if (!(await item.count())) return { tray: true, item: false };
  await item.click(); await page.waitForTimeout(400);
  const chooser = await page.evaluate(() => { const m = document.querySelector("[data-agents-ask]"); return m ? { part: m.getAttribute("data-agents-ask"), actions: [...m.querySelectorAll("[data-agents-action]")].map((b) => b.getAttribute("data-agents-action")) } : null; });
  if (!chooser) return { tray: true, item: true, chooser: null };
  await page.locator(`[data-agents-action="${action}"]`).click();
  for (let i = 0; i < 20 && !((await frameMsgs(page)) ?? []).some((m) => m.data?.action === action); i++) await page.waitForTimeout(250);
  return { tray: true, item: true, chooser, msgs: await frameMsgs(page) };
}
const FORBIDDEN = ["token", "pairToken", "auth", "authorization", "secret", "apiKey", "control", "controls", "do", "press"];
const leaks = (msgs) => { const out = []; const walk = (v, at) => { if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${at}[${i}]`)); else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { if (FORBIDDEN.includes(k)) out.push(`${at}.${k}`); walk(x, `${at}.${k}`); } else if (typeof v === "string" && /gh[pousr]_|github_pat_|sk-[A-Za-z0-9]{10}|Bearer /.test(v)) out.push(at); }; msgs.forEach((m, i) => { walk(m.data, `msg${i}`); if (m.data?.kind !== "context") out.push(`msg${i}.kind=${m.data?.kind}`); }); return out; };

/* 2 and 4. The small site, helper up. */
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript((d) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("builder.studio", d); sessionStorage.setItem("seeded", "1"); } }, doc);
await helperUp(ctx);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForSelector('[data-node-id="b2"]', { timeout: 30000 });
await page.waitForTimeout(1500);
const b0 = await board(page);

const button = page.locator("[data-agents-button]");
check("the top bar has an Agents button", (await button.count()) === 1);
if (await button.count()) { await button.click(); await page.waitForTimeout(1200); }
const frame = await page.evaluate(() => { const f = document.querySelector("[data-agents-dock] iframe[data-agents-frame]"); const d = document.querySelector("[data-agents-dock]")?.getBoundingClientRect(); return f ? { src: f.getAttribute("src"), w: Math.round(d.width), right: Math.round(d.right) } : null; });
check("the button opens the dock: a frame at the helper's /dock, 380px on the right", frame?.src === `${HELPER}/dock` && frame.w === 380 && frame.right === 1440, JSON.stringify(frame));
const first = (await frameMsgs(page)) ?? [];
check("the open dock is handed context only, with no action yet", first.length >= 1 && first.every((m) => m.data?.kind === "context") && first[0].data.action === null, JSON.stringify(first.map((m) => m.data?.action)));
await page.locator("[data-agents-close]").click(); await page.waitForTimeout(400);
check("Close shuts it", (await page.locator("[data-agents-dock]").count()) === 0);

const r = await askOn(page, "b2", "security");
check("right-press a part: its wheel's tray has Ask agents", r.tray && r.item, JSON.stringify(r));
check("…which offers the five actions, for that part", r.chooser?.part === "b2" && JSON.stringify(r.chooser.actions) === '["change","features","security","backend","explain"]', JSON.stringify(r.chooser));
const sec = (r.msgs ?? []).filter((m) => m.data?.action === "security");
const m = sec.at(-1)?.data;
check("Security check opens the dock and hands it the action and the part's chips", !!m && m.part?.id === "b2" && m.part.kind === "cta-primary" && m.chips.some((c) => c.kind === "part" && c.id === "b2") && m.chips.some((c) => c.kind === "page" && c.id === "p0") && m.chips.some((c) => c.kind === "shot"), JSON.stringify(m));
check("…from the Builder's own origin", sec.length > 0 && sec.every((x) => x.origin === new URL(BASE).origin), JSON.stringify(sec.map((x) => x.origin)));
check("the dock header names the action", /Security check/.test((await page.locator("[data-agents-dock] header").textContent().catch(() => "")) ?? ""));
const all = (await frameMsgs(page)) ?? [];
check("no token or control ever crossed postMessage", all.length > 0 && leaks(all).length === 0, leaks(all).join(", ") || `${all.length} messages`);
await page.locator("[data-agents-close]").click().catch(() => {}); await closeWheel(page); await page.waitForTimeout(500);
const b1 = await board(page);
check("the board is identical part by part", same(b0.stored, b1.stored) && same(b0.drawn, b1.drawn), diff(b0, b1));
await ctx.close();

/* 3. The helper can't be reached. */
const c3 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await c3.addInitScript((d) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("builder.studio", d); sessionStorage.setItem("seeded", "1"); } }, doc);
await helperDown(c3);
const p3 = await c3.newPage();
p3.on("pageerror", (e) => errors.push(e.message));
await p3.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await p3.waitForSelector('[data-node-id="b2"]', { timeout: 30000 });
await p3.locator("[data-agents-button]").click().catch(() => {});
await p3.waitForSelector("[data-agents-setup]", { timeout: 6000 }).catch(() => {});
const setup = await p3.evaluate(() => { const s = document.querySelector("[data-agents-setup]"); return s ? { start: s.querySelector("[data-agents-start]")?.getAttribute("href"), steps: !!s.querySelector("[data-agents-setup-steps]") && /Set up the helper/.test(s.textContent), fallback: s.querySelector("[data-agents-fallback]")?.getAttribute("href"), frame: !!document.querySelector("[data-agents-frame]") } : null; });
check("an unreachable helper shows the setup state, not a frame", !!setup && !setup.frame, JSON.stringify(setup));
check("…with Start the helper (polio-helper://start), Set up the helper and the fallback page", setup?.start === "polio-helper://start" && setup.steps && setup.fallback === `${HELPER}/dock`, JSON.stringify(setup));
await c3.close();

/* 5. Each capture folder brought in, as tests/builder-whats-new.mjs brings one. */
for (const SINK of SITES) {
  const name = SINK.replace(/[\\/]+$/, "").split(/[\\/]/).pop();
  if (!existsSync(join(SINK, "site/document.json"))) { check(`${name}: a capture folder`, false, SINK); continue; }
  const DOC = readFileSync(join(SINK, "site/document.json"));
  const pics = existsSync(join(SINK, "assets/pictures")) ? readdirSync(join(SINK, "assets/pictures")) : [];
  const REPO = "/repos/sparkygogo77-spec/sink";
  const tree = [{ path: "package.json", type: "blob", sha: "pkg", size: 10 }, { path: "site/document.json", type: "blob", sha: "doc", size: DOC.length }, ...pics.map((p) => ({ path: `assets/pictures/${p}`, type: "blob", sha: `pic:${p}`, size: 100 }))];
  const c2 = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  await helperUp(c2);
  const p2 = await c2.newPage();
  const errs = [];
  p2.on("pageerror", (e) => errs.push(e.message));
  await p2.route("https://api.github.com/**", (rt) => {
    const u = new URL(rt.request().url());
    const j = (b, code = 200) => rt.fulfill({ status: code, contentType: "application/json", body: JSON.stringify(b) });
    if (!u.pathname.startsWith(REPO)) return j({ message: "no" }, 404);
    const rest = u.pathname.slice(REPO.length);
    if (!rest) return j({ default_branch: "main", homepage: "" });
    if (rest.startsWith("/git/trees/")) return j({ tree });
    if (rest === "/git/blobs/doc") return j({ encoding: "base64", content: DOC.toString("base64") });
    const pic = decodeURIComponent(rest).match(/^\/git\/blobs\/pic:(.+)$/);
    if (pic) return j({ encoding: "base64", content: readFileSync(join(SINK, "assets/pictures", pic[1])).toString("base64") });
    return j({ message: "no" }, 404);
  });
  await p2.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
  await p2.evaluate(() => { const env = (s) => JSON.stringify({ state: s, version: 0 }); localStorage.setItem("builder.builds", env({ projects: [{ id: "s3", name: "Site 3", updatedAt: Date.now() }], activeId: "s3" })); localStorage.setItem("builder.studio", env({ nodes: [] })); });
  await p2.reload({ waitUntil: "networkidle" }); await p2.waitForTimeout(1200);
  const keys = p2.locator("[data-keys-panel]");
  await p2.getByRole("button", { name: "Keys", exact: true }).click(); await p2.waitForTimeout(500);
  const skip = keys.getByRole("button", { name: /Skip the PIN|Hold the key for this tab/ });
  if (await skip.count()) { await skip.first().click(); await p2.waitForTimeout(300); }
  await keys.locator('[data-service="github"] input[type="password"]').first().fill("not-a-token-placeholder-xxxx");
  await keys.getByRole("button", { name: /Save to this browser|Hold in this tab/ }).first().click(); await p2.waitForTimeout(500);
  await keys.getByRole("button", { name: "Close keys" }).click(); await p2.waitForTimeout(500);
  await p2.locator("[data-github-button]").first().click(); await p2.waitForTimeout(700);
  await p2.locator("[data-repo-bring]").fill("sparkygogo77-spec/sink");
  await p2.locator("[data-repo-pull]").click(); await p2.waitForTimeout(300);
  if (await p2.locator("[data-repo-bring-go]").count()) await p2.locator("[data-repo-bring-go]").click();
  const count = () => p2.evaluate(() => window.__studioHistory?.doc().nodes.length ?? 0).catch(() => 0);
  for (let i = 0; i < 1500 && (await count()) < 20; i++) await p2.waitForTimeout(1000);
  let a = await board(p2);
  for (let i = 0; i < 60; i++) { await p2.waitForTimeout(3000); const b = await board(p2); if (same(a, b)) break; a = b; }
  for (let i = 0; i < 4 && (await p2.locator("[data-repo-panel], [role='dialog']").count()); i++) { await p2.keyboard.press("Escape"); await p2.waitForTimeout(300); }
  await p2.waitForTimeout(1500);
  const s0 = await board(p2);
  /* A part on screen that a press reaches: the topmost part at its own top-left corner. */
  const target = await p2.evaluate(() => {
    for (const el of document.querySelectorAll("[data-node-id]")) {
      const r = el.getBoundingClientRect();
      if (r.width < 30 || r.height < 20 || r.top < 80 || r.bottom > innerHeight - 160 || r.left < 0 || r.right > innerWidth - 420) continue;
      const hit = document.elementFromPoint(r.x + Math.min(20, r.width / 2), r.y + Math.min(20, r.height / 2))?.closest("[data-node-id]");
      if (hit === el) return el.getAttribute("data-node-id");
    }
    return null;
  });
  const ra = target ? await askOn(p2, target, "security") : { tray: false };
  const got = (ra.msgs ?? []).filter((x) => x.data?.action === "security").at(-1)?.data;
  check(`${name}: ${s0.stored.length} parts; right-press ${target}, Ask agents → Security check hands the dock that part`, got?.part?.id === target && got.chips.some((c) => c.kind === "part" && c.id === target), JSON.stringify({ ...ra, msgs: undefined, got: got && { part: got.part, chips: got.chips } }).slice(0, 300));
  check(`${name}: no token or control crossed`, (ra.msgs ?? []).length > 0 && leaks(ra.msgs).length === 0, leaks(ra.msgs ?? []).join(", "));
  await p2.locator("[data-agents-close]").click().catch(() => {}); await closeWheel(p2); await p2.waitForTimeout(800);
  const s1 = await board(p2);
  check(`${name}: the board is identical part by part`, same(s0, s1), diff(s0, s1));
  check(`${name}: no page errors`, errs.length === 0, errs.join(" | ").slice(0, 200));
  await c2.close();
}

check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 200));
console.log(`\n${results.filter(Boolean).length}/${results.length} pass`);
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
