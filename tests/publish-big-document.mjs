#!/usr/bin/env node
/**
 * A SITE DOCUMENT BIGGER THAN ONE REQUEST STILL PUBLISHES, IN ONE COMMIT.
 *
 * The coordinator's report: republishing parasiteonsol.fun (10,683 parts on
 * 12 pages) was refused with "“site/document.json” is 3.5 MB even packed,
 * more than one request to the Builder carries". The pieces path (20b8a0e)
 * took pictures only: packed text, and the document above all, which the
 * route reads as it commits, had to fit one request. Held here, pushed the
 * way Go live pushes (`window.__studioPublish`) against a stand-in GitHub,
 * with a STANDIN document over 4.5 MB even packed, a picture over it too, a
 * page, and a stylesheet the branch already holds:
 *   · it publishes, every request under 4.5 MB;
 *   · the committed document is the document sent, with `publishedTo` written
 *     into it as a document sent in one request has;
 *   · the picture is its exact bytes; no piece of either is in the commit;
 *   · the stylesheet the branch holds is not sent again, and is in the commit;
 *   · one commit and one move of main.
 *
 *   GITHUB_API=http://127.0.0.1:4337 npx next start -p 3013   (no GITHUB_TOKEN of its own)
 *   node tests/publish-big-document.mjs http://127.0.0.1:3013
 */
import http from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { gzipSync } from "node:zlib";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright-core");
const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const PORT = Number(process.env.GH_PORT ?? 4337);
const KEY = "github_pat_STANDIN_not_a_real_key_0123456789abcdef";
const LIMIT = 4.5 * 1024 * 1024;
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const blobSha = (bytes) => createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
const readBody = (req) => new Promise((ok) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => ok(Buffer.concat(c).toString("utf8"))); });

/* The STANDIN document: parts whose words are random, so packing it hardly shrinks it. */
const nodes = Array.from({ length: 11000 }, (_, i) => ({ id: `n_standin_${i}`, pageId: `page_${i % 12}`, featureId: "prose", x: i % 1440, y: i * 3, w: 200, h: 40, content: `STANDIN ${randomBytes(420).toString("base64")}` }));
const DOC = JSON.stringify({ pages: Array.from({ length: 12 }, (_, i) => ({ id: `page_${i}`, name: `Page ${i}`, path: i ? `/p${i}` : "/" })), nodes });
const CSS = "body{margin:0;background:#fff5e0}";
const BIG = randomBytes(3_900_000);

/* The stand-in GitHub: main with one commit that already holds the stylesheet; every blob it is given kept. */
const store = new Map();
const TREE0 = [{ path: "assets/site.css", mode: "100644", type: "blob", sha: blobSha(Buffer.from(CSS)) }];
let trees = [], commits = 0, refs = 0;
const posted = [];
const gh = http.createServer(async (req, res) => {
  const raw = await readBody(req);
  const send = (code, body) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
  const u = new URL(req.url, "http://x");
  const R = "/repos/owner/site";
  if (req.method === "GET" && u.pathname === R) return send(200, { default_branch: "main", full_name: "owner/site" });
  if (req.method === "GET" && u.pathname === `${R}/git/ref/heads/main`) return send(200, { object: { sha: "base0" } });
  if (req.method === "GET" && u.pathname === `${R}/git/commits/base0`) return send(200, { sha: "base0", tree: { sha: "tree0" } });
  if (req.method === "GET" && u.pathname === `${R}/git/trees/tree0`) return send(200, { sha: "tree0", truncated: false, tree: TREE0 });
  if (req.method === "POST" && u.pathname === `${R}/git/blobs`) {
    const b = JSON.parse(raw);
    const bytes = b.encoding === "base64" ? Buffer.from(b.content, "base64") : Buffer.from(b.content, "utf8");
    const sha = blobSha(bytes);
    store.set(sha, bytes);
    posted.push(sha);
    return send(201, { sha });
  }
  const blob = u.pathname.match(new RegExp(`^${R}/git/blobs/(\\w+)$`));
  if (req.method === "GET" && blob) {
    const bytes = store.get(blob[1]);
    return bytes ? send(200, { sha: blob[1], encoding: "base64", size: bytes.length, content: bytes.toString("base64").replace(/.{60}/g, "$&\n") }) : send(404, { message: "Not Found" });
  }
  if (req.method === "POST" && u.pathname === `${R}/git/trees`) { trees.push(JSON.parse(raw)); return send(201, { sha: "tree1" }); }
  if (req.method === "POST" && u.pathname === `${R}/git/commits`) { commits++; return send(201, { sha: "commit1", html_url: "https://github.example/commit1" }); }
  if (req.method === "PATCH" && u.pathname === `${R}/git/refs/heads/main`) { refs++; return send(200, { object: { sha: "commit1" } }); }
  return send(404, { message: "Not Found" });
});
await new Promise((r) => gh.listen(PORT, "127.0.0.1", r));

const packedSize = gzipSync(Buffer.from(DOC)).toString("base64").length;
check("the STANDIN document is over 4.5 MB even packed", packedSize > LIMIT, `${(DOC.length / 1e6).toFixed(1)} MB, ${(packedSize / 1e6).toFixed(2)} MB packed and encoded`);

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

const got = await page.evaluate(async ({ doc, css, big }) => window.__studioPublish({
  message: "Builder: publish a big document",
  deploy: false,
  repo: "owner/site",
  branch: "main",
  files: [
    { path: "index.html", content: "<!doctype html><title>Big</title><img src=assets/pictures/pic_big.png>" },
    { path: "assets/site.css", content: css },
    { path: "assets/pictures/pic_big.png", content: big, encoding: "base64" },
    { path: "site/document.json", content: doc },
  ],
}), { doc: DOC, css: CSS, big: BIG.toString("base64") });
check("it publishes", got?.ok === true, JSON.stringify(got).slice(0, 240));
check("every request to the Builder is under 4.5 MB", sizes.length > 0 && sizes.every((n) => n < LIMIT), sizes.map((n) => (n / 1e6).toFixed(2)).join(", "));
const tree = trees.at(-1)?.tree ?? [];
const at = (p) => tree.find((e) => e.path === p)?.sha;
const committed = store.get(at("site/document.json"));
let doc = null;
try { doc = JSON.parse(committed?.toString("utf8") ?? ""); } catch { /* checked below */ }
check("the committed document is the document sent", !!doc && doc.nodes?.length === nodes.length && doc.nodes.at(-1)?.content === nodes.at(-1).content, committed ? `${(committed.length / 1e6).toFixed(1)} MB, ${doc?.nodes?.length} parts` : "no document in the commit");
check("…and says where it was published, as one sent whole does", doc?.publishedTo?.repo === "owner/site" && doc?.publishedTo?.branch === "main", JSON.stringify(doc?.publishedTo));
check("the big picture is committed as its exact bytes", at("assets/pictures/pic_big.png") === blobSha(BIG));
check("no piece of either is in the commit", !tree.some((e) => /\.piece\d+$/.test(e.path)), tree.map((e) => e.path).join(", "));
check("the stylesheet the branch holds is not sent again, and is in the commit", at("assets/site.css") === TREE0[0].sha && !posted.includes(TREE0[0].sha), `${at("assets/site.css")}; posted ${posted.includes(TREE0[0].sha)}`);
check("…and the answer counts what changed", got?.changed === 3 && got?.total === 4, JSON.stringify({ changed: got?.changed, total: got?.total }));
check("one commit and one move of main", commits === 1 && refs === 1 && trees.length === 1, `${trees.length} trees, ${commits} commits, ${refs} ref moves`);
check("no page error", errors.length === 0, errors.join(" / "));
await browser.close();
gh.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
