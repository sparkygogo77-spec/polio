#!/usr/bin/env node
/**
 * A PART PICKED OUT OF A HIDDEN PANEL DOES NOT STAY OVER EVERY PREVIEW.
 *
 * J (2026-10-09): on PonsStars the intro tour's white box sat over the Match
 * preview, and stayed after a reimport. Picking a hidden part (from a list
 * of parts, as the old "Make them readable" list offered the tour's dots)
 * switches its hidden group on so it is drawn (`history.ts#pickedStates`);
 * that key was kept by every step of the Show switch, said nowhere in its
 * bar, and kept by a new document. Now:
 *
 *   1. a picked hidden group is said in the Show bar ("+ tour");
 *   2. the next step of the Show switch lets it go;
 *   3. a document loaded (an import, a reimport) starts as it opens.
 *
 *   node tests/show-picked-off.mjs [builder url]
 *
 * On the kit's starter (its sign-up pop-up is a hidden group). A PonsStars
 * checkout as the second argument is read too, but its board is stored
 * outside local storage, which this test reads.
 *
 * Covers: src/features/studio/states/sceneStep.ts, src/features/studio/states/ShowSwitch.tsx, src/features/studio/board/store/threads.ts
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
  let st = await state();
  for (let i = 0; i < 240 && !(st.nodes?.length && st.look?.styleSource?.screens?.length); i++) { await page.waitForTimeout(1000); st = await state(); }
  await page.waitForTimeout(1500);
  st = await state();
  const hid = (st.nodes ?? []).find((n) => n.pageId === st.activePageId && n.state?.group?.startsWith("hidden:") && !n.state.group.startsWith("hidden:template:"));
  check("the import has a hidden part on its first page", !!hid, hid?.state?.group);
  await act("setSelection", [hid.id]);
  await page.waitForTimeout(600);
  st = await state();
  check("picking it switches its hidden group on", (st.statesOn ?? []).includes(hid.state.group), JSON.stringify(st.statesOn));
  const bar = await page.locator("[data-scene-now]").innerText();
  check("1. and the Show bar says so", bar.includes(`+ ${hid.state.group.slice(7).replace(/-/g, " ")}`), bar.replace(/\s+/g, " "));
  await page.locator("[data-scene-next]").click();
  await page.waitForTimeout(800);
  st = await state();
  check("2. the next preview lets it go", !(st.statesOn ?? []).some((k) => k.startsWith("hidden:")), JSON.stringify(st.statesOn));
  await act("setSelection", [hid.id]);
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__studioLoadDoc(window.__studioPublishDoc()));
  await page.waitForTimeout(800);
  st = await state();
  check("3. a document loaded starts as it opens", !(st.statesOn ?? []).length, JSON.stringify(st.statesOn));
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
