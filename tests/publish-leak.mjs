#!/usr/bin/env node
/**
 * A published repository holds the built site and nothing else.
 *
 * WHAT PUBLISH SENDS TODAY, read off the request the real button makes: an
 * index.html per page and a stylesheet (`staticSite.ts`), the pictures, and
 * `site/document.json`, `site/BLUEPRINT.md` and `site/blueprint.json`. The
 * last three are the design document and two descriptions of it, and they
 * carry the capture and the owner's own working: every captured part's
 * prompt reads "Captured from ccc-woad.vercel.app/ … as body > div > …",
 * and the blueprint carries his prompt drafts and Claude's critiques with
 * their timestamps and model names.
 *
 * THE TEST IS OF THE TREE, NOT OF A FILE. It presses Push to GitHub on a
 * board brought in through the real door, catches the push, and reads every
 * file in it, whatever the files are called. So a file added later cannot
 * leak past it by being new.
 *
 * WHAT COUNTS AS A LEAK, all of it read off the board, none of it written
 * in here:
 *   · any authoring-only string the board holds: a part's prompt and its
 *     notes, where it was captured from (address, host, element path), a
 *     page's prompt, the brief, the prompt trail (drafts, critiques, the
 *     prompts proposed, the model that proposed them);
 *   · the capture's signatures: the words "Captured from", the captured
 *     host, an element path, a Claude model name.
 * Strings shorter than 16 characters are not searched for: a short prompt
 * like "Home" is also a word the site shows.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/publish-leak.mjs http://127.0.0.1:3013 <path to a sink checkout>
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { gunzipSync } from "node:zlib";

const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const SINK = process.argv[3];
const OUT = process.argv[4] ?? null;
if (!SINK || !existsSync(join(SINK, "site/document.json"))) {
  console.error("usage: node tests/publish-leak.mjs <builder url> <path to a sink checkout>");
  process.exit(2);
}
const DOC = readFileSync(join(SINK, "site/document.json"));
const doc = JSON.parse(DOC.toString("utf8"));
const byId = new Map(doc.nodes.map((n) => [n.id, n]));
const pics = existsSync(join(SINK, "assets/pictures")) ? readdirSync(join(SINK, "assets/pictures")) : [];
const REPO = "/repos/sparkygogo77-spec/sink";
const tree = [
  { path: "package.json", type: "blob", sha: "pkg", size: 10 },
  { path: "site/document.json", type: "blob", sha: "doc", size: DOC.length },
  ...pics.map((p) => ({ path: `assets/pictures/${p}`, type: "blob", sha: `pic:${p}`, size: 100 })),
];

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1763, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
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

const state = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {});
/** Every part's [page, y, h] as saved. */
const positions = async () => Object.fromEntries(((await state()).nodes ?? []).map((n) => [n.id, [n.pageId, n.y, n.h]]));

/* An empty site, opened first. */
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => {
  const env = (s) => JSON.stringify({ state: s, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "s3", name: "Site 3", updatedAt: Date.now() }], activeId: "s3" }));
  localStorage.setItem("builder.studio", env({ nodes: [] }));
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);

/* A placeholder token, through the Keys panel, the way his goes in. */
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

/* The door. */
await page.locator("[data-github-button]").first().click();
await page.waitForTimeout(700);
await page.locator("[data-repo-bring]").fill("sparkygogo77-spec/sink");
await page.locator("[data-repo-pull]").click();
for (let i = 0; i < 90 && ((await state()).nodes?.length ?? 0) < 100; i++) await page.waitForTimeout(1000);
await page.waitForTimeout(3000);

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* His working, as his board holds it: a draft he wrote and a critique Claude
   gave, with the time and the model. A fresh import carries none, so the
   test puts one of each in, the shape the store keeps them in. */
const DRAFT = "Make the wallet chip feel like a terminal readout, green on near black";
const CRITIQUE = "The wallet chip repeats its own address; drop the duplicate label and keep the two spans";
const PROPOSED = "A terminal style wallet chip: address in green monospace, the age under it in grey";
const MODEL = "claude-opus-5-5";
await page.evaluate(([d, c, p, m]) => {
  const raw = JSON.parse(localStorage.getItem("builder.studio"));
  const t = Date.now();
  raw.state.trail = [
    { id: "tr1", at: t - 60000, stage: "author", target: { kind: "site", id: "site", label: "Site" }, text: d, parentId: null },
    { id: "tr2", at: t, stage: "critique", target: { kind: "site", id: "site", label: "Site" }, text: c, parentId: "tr1", prompt: p, kind: "note", model: m },
  ];
  localStorage.setItem("builder.studio", JSON.stringify(raw));
}, [DRAFT, CRITIQUE, PROPOSED, MODEL]);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(2500);

/* ------------------------------------------------------------------ */
/* What is his and not the site's, read off the board                  */
/* ------------------------------------------------------------------ */

const s = await state();
const secrets = new Map(); // string -> what it is
const add = (v, what) => { if (typeof v === "string" && v.trim().length >= 16) secrets.set(v.trim(), what); };
for (const n of s.nodes ?? []) {
  add(n.prompt, "a part's prompt");
  add(n.data, "a part's notes");
  add(n.from?.url, "where a part was captured");
  add(n.from?.selector, "a captured element's path");
}
for (const p of s.pages ?? []) add(p.prompt, "a page's prompt");
add(s.brief?.master, "the brief");
add(s.brief?.gimmick, "the brief");
for (const t of s.trail ?? []) { add(t.text, `a ${t.stage} in the prompt trail`); add(t.prompt, "a prompt Claude proposed"); }
const hosts = [...new Set((s.nodes ?? []).map((n) => n.from?.host).filter(Boolean))];
const SIGNS = [
  [/Captured from/g, "the words \"Captured from\""],
  ...hosts.map((h) => [new RegExp(h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), `the captured host ${h}`]),
  [/body > (div|header|main|aside|footer|section|nav)\b/g, "an element path"],
  [/claude-(opus|sonnet|haiku|fable)[-\d.a-z]*/gi, "a Claude model name"],
];
console.log(`  searching for ${secrets.size} authoring-only strings and ${SIGNS.length} signatures`);

/* ------------------------------------------------------------------ */
/* What Publish sends: the real button, the push caught                 */
/* ------------------------------------------------------------------ */

let pushed = null;
await page.route("**/api/studio/publish", async (r) => {
  if (r.request().method() === "POST") {
    pushed = JSON.parse(r.request().postData() ?? "{}");
    /* Text goes packed (`publish()` in agent.ts): read what the route will commit. */
    pushed.files = (pushed.files ?? []).map((f) => (f.encoding === "gzip" ? { path: f.path, content: gunzipSync(Buffer.from(f.content, "base64")).toString("utf8") } : f));
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, sha: "0", commitUrl: "https://example.invalid/c", branch: "main", repo: "someone/site", files: pushed.files?.length ?? 0, deployed: false, hook: false }) });
  }
  return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ github: { configured: true, token: "browser", repo: "someone/site", branch: "main", missing: [], allow: null }, vercel: { hook: false } }) });
});
await page.evaluate(() => window.__studioOpenBrief?.());
await page.waitForTimeout(1500);
await page.getByRole("button", { name: /Push to GitHub/ }).first().click({ timeout: 15000 });
for (let i = 0; i < 120 && !pushed; i++) await page.waitForTimeout(500);
await browser.close();

check("Push to GitHub sent a tree to read", !!pushed?.files?.length, pushed ? `${pushed.files.length} files` : "nothing was pushed");
const files = pushed?.files ?? [];
console.log(`  the tree: ${files.map((f) => `${f.path} (${Math.round((f.content?.length ?? 0) / 1024)} KB)`).join(", ")}`);

/* ------------------------------------------------------------------ */
/* Every file, every leak                                              */
/* ------------------------------------------------------------------ */

const per = [];
for (const f of files) {
  const text = String(f.content ?? "");
  const kinds = new Map();
  let hits = 0;
  for (const [v, what] of secrets) {
    let at = text.indexOf(v), n = 0;
    while (at !== -1) { n++; at = text.indexOf(v, at + v.length); }
    if (n) { hits += n; kinds.set(what, (kinds.get(what) ?? 0) + n); }
  }
  for (const [re, what] of SIGNS) {
    const n = (text.match(re) ?? []).length;
    if (n) { hits += n; kinds.set(what, (kinds.get(what) ?? 0) + n); }
  }
  per.push({ path: f.path, hits, kinds });
}
for (const p of per.filter((p) => p.hits)) console.log(`    ${p.path}: ${p.hits} — ${[...p.kinds].map(([k, n]) => `${k} ×${n}`).join(", ")}`);
const leaking = per.filter((p) => p.hits);
check("no file in the published tree carries the capture or his working", files.length > 0 && leaking.length === 0,
  leaking.length ? `${leaking.length} of ${files.length} files leak, ${leaking.reduce((a, p) => a + p.hits, 0)} hits` : "");
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
