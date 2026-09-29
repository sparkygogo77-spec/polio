#!/usr/bin/env node
/**
 * A PICTURE BIGGER THAN ONE REQUEST STILL PUBLISHES, BYTE FOR BYTE, IN ONE COMMIT.
 *
 * The coordinator's report: Go live on parasiteonsol.fun (sink
 * claude/capture-consolidated, sites/parasiteonsol-fun) was refused with
 * "“assets/pictures/pic_017b184d.png” is 5.1 MB even packed, more than one
 * request to the Builder carries": the picture is 3.8 MB, 5.1 MB encoded, and
 * a request to the Builder on Vercel carries 4.5 MB. Held here with a STANDIN
 * picture of 3.9 MB (5.2 MB encoded) beside one of 2.4 MB, pushed the way Go
 * live pushes (`window.__studioPublish`), against a stand-in GitHub:
 *   · it publishes, every request under 4.5 MB;
 *   · the committed file is the picture's exact bytes (its git sha);
 *   · none of its pieces is in the commit, and it is one commit and one ref move.
 *
 *   GITHUB_API=http://127.0.0.1:4335 npx next start -p 3013   (no GITHUB_TOKEN of its own)
 *   node tests/publish-big-picture.mjs http://127.0.0.1:3013
 */
import http from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright-core");
const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const PORT = Number(process.env.GH_PORT ?? 4335);
const KEY = "github_pat_STANDIN_not_a_real_key_0123456789abcdef";
const LIMIT = 4.5 * 1024 * 1024;
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const blobSha = (bytes) => createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
const readBody = (req) => new Promise((ok) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => ok(Buffer.concat(c).toString("utf8"))); });

/* The stand-in GitHub: a repository with one commit on main, keeping every blob it is given. */
const store = new Map();
let trees = [], commits = 0, refs = 0;
const gh = http.createServer(async (req, res) => {
  const raw = await readBody(req);
  const send = (code, body) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
  const u = new URL(req.url, "http://x");
  const R = "/repos/owner/site";
  if (req.method === "GET" && u.pathname === R) return send(200, { default_branch: "main", full_name: "owner/site" });
  if (req.method === "GET" && u.pathname === `${R}/git/ref/heads/main`) return send(200, { object: { sha: "base0" } });
  if (req.method === "GET" && u.pathname === `${R}/git/commits/base0`) return send(200, { sha: "base0", tree: { sha: "tree0" } });
  if (req.method === "GET" && u.pathname === `${R}/git/trees/tree0`) return send(200, { sha: "tree0", truncated: false, tree: [] });
  if (req.method === "POST" && u.pathname === `${R}/git/blobs`) {
    const b = JSON.parse(raw);
    const bytes = b.encoding === "base64" ? Buffer.from(b.content, "base64") : Buffer.from(b.content, "utf8");
    const sha = blobSha(bytes);
    store.set(sha, bytes);
    return send(201, { sha });
  }
  const blob = u.pathname.match(new RegExp(`^${R}/git/blobs/(\\w+)$`));
  if (req.method === "GET" && blob) {
    const bytes = store.get(blob[1]);
    /* GitHub wraps its base64 at 60 characters. */
    return bytes ? send(200, { sha: blob[1], encoding: "base64", size: bytes.length, content: bytes.toString("base64").replace(/.{60}/g, "$&\n") }) : send(404, { message: "Not Found" });
  }
  if (req.method === "POST" && u.pathname === `${R}/git/trees`) { trees.push(JSON.parse(raw)); return send(201, { sha: "tree1" }); }
  if (req.method === "POST" && u.pathname === `${R}/git/commits`) { commits++; return send(201, { sha: "commit1", html_url: "https://github.example/commit1" }); }
  if (req.method === "PATCH" && u.pathname === `${R}/git/refs/heads/main`) { refs++; return send(200, { object: { sha: "commit1" } }); }
  return send(404, { message: "Not Found" });
});
await new Promise((r) => gh.listen(PORT, "127.0.0.1", r));

const BIG = randomBytes(3_900_000);
const NEAR = randomBytes(2_400_000);
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const sizes = [];
await page.route("**/api/studio/publish", (r) => { if (r.request().method() === "POST") sizes.push(Buffer.byteLength(r.request().postData() ?? "")); return r.continue(); });
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1000);
const keys = page.locator("[data-keys-panel]");
await page.getByRole("button", { name: "Keys", exact: true }).click(); await page.waitForTimeout(500);
const skip = keys.getByRole("button", { name: /Skip the PIN|Hold the key for this tab/ });
if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(300); }
await keys.locator('[data-service="github"] input[type="password"]').first().fill(KEY);
await keys.getByRole("button", { name: /Save to this browser|Hold in this tab/ }).first().click(); await page.waitForTimeout(500);
await keys.getByRole("button", { name: "Close keys" }).click(); await page.waitForTimeout(500);

check("the STANDIN picture is over 4.5 MB encoded", BIG.toString("base64").length > LIMIT, `${(BIG.toString("base64").length / 1e6).toFixed(2)} MB`);
const got = await page.evaluate(async ({ big, near }) => window.__studioPublish({
  message: "Builder: publish a big picture",
  deploy: false,
  repo: "owner/site",
  branch: "main",
  files: [
    { path: "index.html", content: "<!doctype html><title>Big</title><img src=assets/pictures/pic_big.png><img src=assets/pictures/pic_near.png>" },
    { path: "assets/site.css", content: "body{margin:0}" },
    { path: "assets/pictures/pic_big.png", content: big, encoding: "base64" },
    { path: "assets/pictures/pic_near.png", content: near, encoding: "base64" },
    { path: "site/document.json", content: JSON.stringify({ pages: [], nodes: [] }) },
  ],
}), { big: BIG.toString("base64"), near: NEAR.toString("base64") });
check("it publishes", got?.ok === true, JSON.stringify(got).slice(0, 240));
check("every request to the Builder is under 4.5 MB", sizes.length > 0 && sizes.every((n) => n < LIMIT), sizes.map((n) => (n / 1e6).toFixed(2)).join(", "));
const tree = trees.at(-1)?.tree ?? [];
const at = (p) => tree.find((e) => e.path === p)?.sha;
check("the big picture is committed as its exact bytes", at("assets/pictures/pic_big.png") === blobSha(BIG), `${at("assets/pictures/pic_big.png")} against ${blobSha(BIG)}`);
check("…and the one near the line too", at("assets/pictures/pic_near.png") === blobSha(NEAR));
check("no piece of it is in the commit", !tree.some((e) => /\.piece\d+$/.test(e.path)), tree.map((e) => e.path).join(", "));
check("one commit and one move of main", commits === 1 && refs === 1 && trees.length === 1, `${trees.length} trees, ${commits} commits, ${refs} ref moves`);
check("no page error", errors.length === 0, errors.join(" / "));
await browser.close();
gh.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
