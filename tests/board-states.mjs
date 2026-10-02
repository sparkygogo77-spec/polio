#!/usr/bin/env node
/**
 * THE PAGE'S HIDDEN STATES, DESIGNED ON THE BOARD.
 *
 * J (2026-10-02): on PonsStars brought in from its repository, 375 of the
 * 620 parts start hidden (the match panel, the chart, the result, the
 * pop-ups), so they took no room on the board, could not be seen or
 * arranged, and picking the chart panned to empty space. The States control
 * on the page strip lists the hidden groups by hook and the repository's
 * preview screens, and switches them on for the board alone
 * (`boardStates.ts`). Through the real door, against a GitHub stood in:
 *
 *   · the preview screens are read as the repository's own code builds
 *     them, and the States control lists them with the hidden groups;
 *   · a screen on (mid-match) shows exactly what that screen shows: its
 *     hidden parts drawn in place, the parts it hides hidden;
 *   · picking a hidden part with its state off switches the state on, so it
 *     is drawn and the board pans to it;
 *   · moved and resized while the state is on, the chart and the trade
 *     buttons go back as rules under their hooks in the style layer, on a
 *     new style/ branch with its pull request open; the default branch is
 *     not touched;
 *   · a part deleted on the board is listed in the pull request by its
 *     hook, with the code that finds it, for the code to remove;
 *   · the parts keep their state: the published page still opens with them
 *     hidden.
 *
 * The repository is PonsStars when a checkout is given (its HEAD, or REV),
 * else the kit's own starter (kit/), whose builder.json lists its screens.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/board-states.mjs http://127.0.0.1:3013 [a PonsStars checkout]
 *
 * Covers: src/features/studio/boardStates.ts, src/features/studio/StudioPage.tsx, src/app/api/studio/zip/route.ts, src/features/studio/styleLayerRun.ts
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const here = dirname(fileURLToPath(import.meta.url));
const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const PST = process.argv[3] ?? null;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* The repository, and what this test does on it. */
let names, read;
if (PST) {
  const REV = process.env.REV ?? "HEAD";
  names = execFileSync("git", ["-C", PST, "ls-tree", "-r", "--name-only", REV], { encoding: "utf8" }).trim().split("\n").filter((f) => !/\.(png|jpe?g|gif|webp|mp4|zip|ico|woff2?)$/i.test(f));
  read = (f) => execFileSync("git", ["-C", PST, "show", `${REV}:${f}`], { maxBuffer: 64 << 20 });
} else {
  const root = join(here, "..", "kit");
  const walk = (d) => readdirSync(d).flatMap((x) => (statSync(join(d, x)).isDirectory() ? (x === "node_modules" ? [] : walk(join(d, x))) : [relative(root, join(d, x))]));
  names = walk(root);
  read = (f) => readFileSync(join(root, f));
}
const PLAN = PST
  ? { del: "chart-attribution", screen: "mid-match", group: "hidden:match-panel", target: "chart", moves: [["chart", 30, 0], ["trade-row-buy", 0, 20], ["trade-row-sell", 0, 20]], sizes: [["chart", 40, 0], ["trade-buy-100", 20, 0]] }
  : { del: "email-error", screen: "contact-sent", group: "hidden:form-sent", target: "form-sent", moves: [["form-sent", 30, 0]], sizes: [["form-sent", 40, 0]] };
const REPO = "him/pst";
const MAIN = "main";
const tree = names.map((f, i) => ({ path: f, type: "blob", sha: `f${i}`, size: 100 }));

const blobs = new Map();
const trees = new Map();
const commits = new Map();
const refs = new Map([[MAIN, "c0"]]);
const pulls = [];
let made = 0;
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route("https://api.github.com/**", (r) => {
  const req = r.request();
  const u = new URL(req.url());
  const j = (b, code = 200) => r.fulfill({ status: code, contentType: "application/json", body: JSON.stringify(b) });
  const mm = u.pathname.match(/^\/repos\/him\/pst(\/.*)?$/);
  if (!mm) return j({ message: "Not Found" }, 404);
  const rest = mm[1] ?? "";
  const body = req.postData() ? JSON.parse(req.postData()) : null;
  if (req.method() === "POST") {
    const sha = `w${++made}`;
    if (rest === "/git/blobs") { blobs.set(sha, body.encoding === "base64" ? Buffer.from(body.content, "base64") : Buffer.from(body.content, "utf8")); return j({ sha }, 201); }
    if (rest === "/git/trees") { trees.set(sha, body); return j({ sha }, 201); }
    if (rest === "/git/commits") { commits.set(sha, body); return j({ sha }, 201); }
    if (rest === "/git/refs") { const name = body.ref.replace(/^refs\/heads\//, ""); if (refs.has(name)) return j({ message: "Reference already exists" }, 422); refs.set(name, body.sha); return j({ ref: body.ref }, 201); }
    if (rest === "/pulls") { pulls.push(body); return j({ html_url: `https://github.com/${REPO}/pull/${pulls.length}`, number: pulls.length }, 201); }
    return j({ message: "no" }, 404);
  }
  if (req.method() !== "GET") return j({ message: "no" }, 405);
  if (!rest) return j({ default_branch: MAIN, homepage: "" });
  if (rest.startsWith("/git/trees/")) return j({ tree });
  const b = /\/git\/blobs\/f(\d+)$/.exec(rest);
  if (b) return j({ encoding: "base64", content: read(names[Number(b[1])]).toString("base64") });
  if (rest.startsWith("/contents/")) { const f = decodeURIComponent(rest.slice(10)); return names.includes(f) ? j({ content: read(f).toString("base64") }) : j({ message: "Not Found" }, 404); }
  const ref = /^\/git\/ref\/heads\/(.+)$/.exec(rest);
  if (ref) { const sha = refs.get(decodeURIComponent(ref[1])); return sha ? j({ object: { sha } }) : j({ message: "Not Found" }, 404); }
  if (rest.startsWith("/git/commits/")) return j({ sha: "c0", tree: { sha: "t0" } });
  if (rest.startsWith("/commits/")) return j({ sha: "c0" });
  return j({ message: "Not Found" }, 404);
});

const state = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {});
const act = (name, ...args) => page.evaluate(({ name, args }) => window.__studioHistory.act(name, ...args), { name, args });
const live = (fn) => page.evaluate(fn);
/* Drawn on the board: its element there has a box. */
const drawn = (id) => page.evaluate((id) => { const el = document.querySelector(`[data-node-id="${id}"]`); return !!el && getComputedStyle(el).display !== "none" && el.getClientRects().length > 0; }, id);

try {
  await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
  await page.evaluate(() => { const env = (s) => JSON.stringify({ state: s, version: 0 }); localStorage.setItem("builder.builds", env({ projects: [{ id: "s1", name: "States", updatedAt: Date.now() }], activeId: "s1" })); localStorage.setItem("builder.studio", env({ nodes: [] })); });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  const keys = page.locator("[data-keys-panel]");
  await page.getByRole("button", { name: "Keys", exact: true }).click();
  await page.waitForTimeout(500);
  const skip = keys.getByRole("button", { name: /Skip the PIN|Hold the key for this tab/ });
  if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(300); }
  await keys.locator('[data-service="github"] input[type="password"]').first().fill("STANDIN_GITHUB_TOKEN_placeholder");
  await keys.getByRole("button", { name: /Save to this browser|Hold in this tab/ }).first().click();
  await page.waitForTimeout(500);
  await keys.getByRole("button", { name: "Close keys" }).click();
  await page.waitForTimeout(500);
  await page.locator("[data-github-button]").first().click();
  await page.waitForTimeout(700);
  await page.locator("[data-repo-bring]").fill(REPO);
  await page.locator("[data-repo-pull]").click();

  /* The import, then its screens, read in the background. */
  let st = await state();
  for (let i = 0; i < 240 && !(st.nodes?.length && st.look?.styleSource?.screens?.length); i++) { await page.waitForTimeout(1000); st = await state(); }
  const screens = st.look?.styleSource?.screens ?? [];
  const hidden = (st.nodes ?? []).filter((n) => n.state);
  check("the repository came in with its hidden parts in state groups", hidden.length > 0 && hidden.every((n) => /^hidden:/.test(n.state.group)), `${st.nodes?.length} parts, ${hidden.length} hidden`);
  const scr = screens.find((x) => x.name === PLAN.screen);
  check(`its preview screens are read as its code builds them (${PLAN.screen} among them, showing ${PLAN.target})`, !!scr && scr.shows.includes(PLAN.target), `${screens.length} screens: ${screens.map((x) => `${x.name} (${x.page}, ${x.shows.length})`).join(", ")}`);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  const target = st.nodes.find((n) => n.hooks?.["data-hook"] === PLAN.target);
  await act("setActivePage", target.pageId);
  await act("clearSelection");
  await page.waitForTimeout(800);
  check(`${PLAN.target} starts hidden on the board`, !(await drawn(target.id)) && target.state?.group === PLAN.group, JSON.stringify(target.state));

  /* The States control: the screens and the hidden groups of this page, by hook. */
  await page.locator("[data-states-button]").click();
  await page.waitForTimeout(400);
  const menu = page.locator("[data-states-menu]");
  const listed = { screens: await menu.locator("[data-screen-toggle]").count(), groups: await menu.locator("[data-state-toggle]").count() };
  check("the States control lists this page's screens and its hidden groups by hook", listed.screens >= 1 && listed.groups >= 1 && (await menu.locator(`[data-state-toggle="${PLAN.group}"]`).count()) === 1, JSON.stringify(listed));
  if (await menu.locator(`[data-screen-toggle="${PLAN.screen}"]`).count()) await menu.locator(`[data-screen-toggle="${PLAN.screen}"]`).click();
  await page.waitForTimeout(800);
  await page.keyboard.press("Escape");
  st = await state();
  const pageNodes = st.nodes.filter((n) => n.pageId === target.pageId);
  const shows = new Set(scr?.shows ?? []);
  const wrong = [];
  for (const n of pageNodes) {
    const h = n.hooks?.["data-hook"];
    if (!h) continue;
    const want = shows.has(h);
    if ((await drawn(n.id)) !== want) wrong.push(`${h}${want ? " (missing)" : " (extra)"}`);
  }
  check(`${PLAN.screen} on: the board shows exactly what that screen shows`, wrong.length === 0, wrong.length ? `${wrong.length} off: ${wrong.slice(0, 10).join(", ")}` : `${pageNodes.filter((n) => shows.has(n.hooks?.["data-hook"])).length} parts shown, the rest of the page hidden`);
  const at = await page.evaluate((id) => { const el = document.querySelector(`[data-node-id="${id}"]`); return el ? { left: el.style.left, top: el.style.top } : null; }, target.id);
  check(`${PLAN.target} is drawn in place, where the page has it`, (await drawn(target.id)) && at?.left === `${target.x}px` && at?.top === `${target.y}px`, JSON.stringify(at));

  /* Picking a hidden part switches its state on, so it is drawn and the board goes to it. */
  await act("setStatesOn", []);
  await page.waitForTimeout(300);
  await act("setSelection", [target.id]);
  await page.waitForTimeout(800);
  st = await state();
  const inView = await page.evaluate((id) => { const el = document.querySelector(`[data-node-id="${id}"]`); if (!el) return false; const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0; }, target.id);
  check("picking a hidden part switches its group on: it is drawn, so the board pans to it", (st.statesOn ?? []).includes(PLAN.group) && inView, JSON.stringify(st.statesOn));
  await act("setStatesOn", [`screen:${PLAN.screen}`]);
  await page.waitForTimeout(500);

  /* Move and resize, with the state on: by the arrows, and by the size fields as the Inspector writes them. */
  const before = st.nodes;
  const byHook = (h) => before.find((n) => n.hooks?.["data-hook"] === h && n.pageId === target.pageId);
  for (const [h, dx, dy] of PLAN.moves) {
    const n = byHook(h);
    await act("setSelection", [n.id]);
    await page.mouse.move(1400, 880);
    for (let i = 0; i < dx / 10; i++) { await page.keyboard.press("Shift+ArrowRight"); await page.waitForTimeout(100); }
    for (let i = 0; i < dy / 10; i++) { await page.keyboard.press("Shift+ArrowDown"); await page.waitForTimeout(100); }
  }
  for (const [h, dw] of PLAN.sizes) {
    const n = (await state()).nodes.find((x) => x.id === byHook(h).id);
    await act("updateNode", n.id, { w: n.w + dw, byHand: true, ...(n.byHand ? {} : { handFrom: { x: n.x, y: n.y, w: n.w, h: n.h } }) });
  }
  await act("clearSelection");
  await page.waitForTimeout(500);
  st = await state();
  const moved = PLAN.moves.map(([h]) => { const a = byHook(h), b = st.nodes.find((n) => n.id === a.id); return `${h} ${b.x - a.x}/${b.y - a.y}`; });
  console.log(`       moved: ${moved.join(", ")}`);

  /* One part deleted: Send the design back lists its hook for the code to remove. */
  const delNode = st.nodes.find((n) => n.hooks?.["data-hook"] === PLAN.del);
  if (delNode) await act("removeNodes", [delNode.id]);
  await page.waitForTimeout(300);

  /* Send the design back. */
  await page.locator("[data-github-button]").first().click();
  await page.waitForTimeout(800);
  const sec = page.locator("[data-style-layer-panel]");
  await sec.locator("[data-style-layer-send]").click();
  let said = "";
  for (let i = 0; i < 120 && !/pull request|compare|Refused|would not|problem/i.test(said); i++) { await page.waitForTimeout(500); said = await sec.locator("[data-style-layer-said]").innerText().catch(() => ""); }
  const branch = [...refs.keys()].find((b) => b !== MAIN);
  check("the design goes to a new style/ branch, and its pull request is opened", !!branch && branch.startsWith("style/") && pulls.length === 1 && pulls[0].head === branch && pulls[0].base === MAIN && refs.get(MAIN) === "c0", `${branch}; ${said.slice(0, 200)}`);
  const commit = commits.get(refs.get(branch));
  const files = (trees.get(commit?.tree)?.tree ?? []).map((e) => ({ path: e.path, text: blobs.get(e.sha)?.toString("utf8") ?? "" }));
  const layerPath = st.look?.styleSource?.layerFile ?? "";
  const layer = files.find((f) => f.path === layerPath)?.text ?? "";
  const rule = (h) => new RegExp(`\\[data-hook="${h}"\\]\\s*\\{([^}]*)\\}`).exec(layer)?.[1] ?? "";
  const movesOk = PLAN.moves.every(([h, dx, dy]) => (dx ? new RegExp(`left: ${dx}px`).test(rule(h)) : true) && (dy ? new RegExp(`top: ${dy}px`).test(rule(h)) : true));
  const sizesOk = PLAN.sizes.every(([h, dw]) => new RegExp(`width: ${byHook(h).w + dw}px`).test(rule(h)));
  check(`the moves and sizes made with ${PLAN.screen} on are rules under their hooks in ${layerPath}`, movesOk && sizesOk, [...new Set([...PLAN.moves, ...PLAN.sizes].map(([h]) => h))].map((h) => `${h} {${rule(h).replace(/\s+/g, " ").trim().slice(0, 120)}}`).join(" | ") || files.map((f) => f.path).join(", "));
  check(`the pull request lists ${PLAN.del}, deleted on the board, for the code to remove`, !!delNode && /Deleted on the board/.test(pulls[0]?.body ?? "") && new RegExp(`- \`${PLAN.del}\`[^\n]*: (found by|no script finds it)`).test(pulls[0]?.body ?? "") && said.includes(PLAN.del), (pulls[0]?.body ?? "").split("\n").filter((l) => l.includes(PLAN.del)).join(" | ").slice(0, 300));
  check("nothing but the style layer (and the hooks map made from it) is written", files.every((f) => f.path === layerPath || /hooks\.json$/.test(f.path)), files.map((f) => f.path).join(", "));

  /* The parts keep their state: the page still opens with them hidden. */
  st = await state();
  const still = st.nodes.find((n) => n.id === target.id);
  const exported = await page.evaluate(async (id) => {
    const files = await window.__studioExport();
    for (const f of files) {
      if (!/\.html$/.test(f.path) || typeof f.content !== "string" || !f.content.includes(`id="${id}"`)) continue;
      const doc = new DOMParser().parseFromString(f.content, "text/html");
      const el = doc.getElementById(id);
      for (let e = el; e; e = e.parentElement) if (e.hidden || /display:\s*none/.test(e.getAttribute("style") ?? "") || e.hasAttribute("data-state-hidden") || e.closest("[data-live-state]")) return { file: f.path, hidden: true };
      return { file: f.path, hidden: false, html: el?.outerHTML.slice(0, 200) };
    }
    return null;
  }, target.id);
  check("the parts keep their state, and the published page opens with them hidden", still.state?.group === PLAN.group && (exported === null || exported.hidden), JSON.stringify(exported));
  check("no script errors", errors.length === 0, errors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
}

const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
