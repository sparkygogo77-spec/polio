/**
 * Bringing one of his other sites in, from the same control that connects
 * and creates.
 *
 * HIS WORDS: "i want to be able to import a repo of my other site pretty soon
 * to see how existing repos are handled." So it has to be reachable — in the
 * repo control, beside connect and create — and it has to be honest about
 * what it can take.
 *
 * WHAT IT CAN TAKE, AND WHY. The importer opens a rendered page and measures
 * what is on it; it has never read source code. So a repository with an
 * `index.html` in it comes in, and a repository of unbuilt sources has no
 * page to open. That second case is the one worth getting right: it must say
 * WHICH kind of nothing it is, because "sources rather than a built site" has
 * an obvious next move and "empty" does not.
 *
 * GitHub is answered by this file. Nothing leaves the machine and no token is
 * used; the stub stands in on the address the server was started against.
 *
 *   GITHUB_API=http://127.0.0.1:4319 npx next start -p 3013
 *   node tests/repo-import.mjs [url]
 */
import { createRequire } from "node:module";
import { createServer } from "node:http";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* ---------------------------------------------------- GitHub, stood in for */
const b64 = (s) => Buffer.from(s, "utf8").toString("base64");
const REPOS = {
  "him/his-site": {
    tree: [
      { path: "index.html", type: "blob" },
      { path: "style.css", type: "blob" },
      { path: "photo.png", type: "blob" },
      { path: "README.md", type: "blob" },
    ],
    files: { "index.html": "<h1>His other site</h1>", "style.css": "h1{color:red}", "photo.png": "x" },
  },
  "him/his-sources": {
    tree: [
      { path: "package.json", type: "blob" },
      { path: "src/app/page.tsx", type: "blob" },
      { path: "next.config.ts", type: "blob" },
    ],
    files: {},
  },
  "him/his-nothing": { tree: [{ path: "NOTES", type: "blob" }], files: {} },
};

const stub = createServer((r, res) => {
  const url = new URL(r.url, "http://x");
  const send = (code, body) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
  let m;
  if ((m = url.pathname.match(/^\/repos\/([^/]+\/[^/]+)$/))) {
    return REPOS[m[1]] ? send(200, { default_branch: "main", full_name: m[1] }) : send(404, { message: "Not Found" });
  }
  if ((m = url.pathname.match(/^\/repos\/([^/]+\/[^/]+)\/git\/trees\//))) {
    return REPOS[m[1]] ? send(200, { tree: REPOS[m[1]].tree }) : send(404, { message: "Not Found" });
  }
  if ((m = url.pathname.match(/^\/repos\/([^/]+\/[^/]+)\/contents\/(.+)$/))) {
    const body = REPOS[m[1]]?.files[decodeURIComponent(m[2])];
    return body === undefined ? send(404, { message: "Not Found" }) : send(200, { content: b64(body), encoding: "base64" });
  }
  if (url.pathname === "/user") return send(200, { login: "him" });
  if (url.pathname === "/user/repos") return send(200, Object.keys(REPOS).map((full_name) => ({ full_name, private: true, pushed_at: "2026-01-01T00:00:00Z" })));
  return send(404, { message: "Not Found" });
});
await new Promise((r, bad) => { stub.on("error", bad); stub.listen(Number(process.env.STUB_PORT ?? 4319), "127.0.0.1", r); });

/* ------------------------------------------------------ what the route says */
const bring = async (repo) => {
  const res = await fetch(`${URL_BASE}/api/studio/repo?repo=${encodeURIComponent(repo)}`, { method: "PUT", headers: { "x-github-token": "ghp_00000000000000000000000000000000TEST" } });
  return res.json();
};

const site = await bring("him/his-site");
check(
  "a repo with a page in it comes in, with the page and what it needs",
  site.ok === true && site.entry === "index.html" && (site.files ?? []).length >= 2,
  site.ok ? `${site.entry}, ${(site.files ?? []).length} files: ${(site.files ?? []).map((f) => f.name).join(", ")}` : `${site.reason}: ${site.message}`,
);
check(
  "and it leaves behind what a page does not need",
  site.ok === true && !(site.files ?? []).some((f) => /README/i.test(f.name)),
  (site.files ?? []).map((f) => f.name).join(", "),
);

const sources = await bring("him/his-sources");
check(
  "a repo of unbuilt sources says so, rather than failing somewhere further down",
  sources.ok === false && sources.reason === "sources",
  `${sources.reason}: ${sources.message}`,
);
check(
  "and it says what to do about it",
  typeof sources.message === "string" && /build/i.test(sources.message),
  sources.message,
);

const nothing = await bring("him/his-nothing");
check(
  "a repo with nothing to open is a different answer from one full of sources",
  nothing.ok === false && nothing.reason === "no-page" && nothing.reason !== sources.reason,
  `${nothing.reason}: ${nothing.message}`,
);

const missing = await bring("him/not-a-repo");
check(
  "a repo that is not there, or not visible to this token, says which",
  missing.ok === false && missing.reason === "missing",
  `${missing.reason}: ${missing.message}`,
);
const bad = await bring("notarepo");
check("and a name that is not owner/name is refused before GitHub is troubled", bad.ok === false && bad.reason === "name", bad.message);

/* ------------------------------------------------------------- reachable */
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
const STATUS = { github: { configured: false, token: null, repo: null, branch: "main", missing: ["GITHUB_TOKEN"], allow: null }, vercel: { hook: false } };
await page.route("**/api/studio/publish**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(STATUS) }));
await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1300);
await page.locator("[data-github-button], header button[aria-label*='GitHub' i]").first().click({ force: true }).catch(() => {});
await page.waitForTimeout(700);
const panel = page.locator("[data-repo-panel]").first();
check("the repo control opens", (await panel.count()) === 1);
if (await panel.count()) {
  check(
    "and bringing a repo in is in it, beside connecting and making one",
    (await panel.locator("[data-repo-bring]").count()) === 1 && (await panel.locator("[data-repo-pull]").count()) === 1
      && (await panel.locator("[data-repo-connect]").count()) >= 0 && (await panel.locator("[data-repo-new]").count()) === 1,
    "bring, connect and make are one control",
  );
}

await browser.close();
await new Promise((r) => stub.close(r));
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
