/**
 * A SCRATCH SITE IS NOT AIMED AT THE REAL REPOSITORY.
 *
 * Driven by hand on the live site: a brand new site that had never been
 * connected already claimed the server's repository on its trunk branch,
 * on the Builds page and on the GitHub button, and the line underneath said
 * Publish pushes there. It did: a publish that named no repository fell
 * back to the server's `GITHUB_REPO`. The Repos tab field also lost an
 * edit that was blurred rather than entered.
 *
 * So, against a server started with a `GITHUB_REPO` of its own:
 *   · a site with none says so in words, on the page and on the button,
 *     and its branch field says main, not the server's branch;
 *   · a publish carrying a name to make a repository under never touches
 *     the server's repository;
 *   · an edit in the Repos tab field is kept on blur, and after a reload.
 *
 * GitHub is answered by this file. No token is used; the header the calls
 * carry is a placeholder the stub never reads, and `GITHUB_REPO` is a
 * repository name, not a secret.
 *
 *   node tests/scratch-site.mjs
 */
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* ------------------------------------------------------------ the stub */
const GH_PORT = 4322;
const APP_PORT = 3014;
const seen = [];
const stub = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  seen.push(`${req.method} ${path}`);
  const json = (code, body) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
  if (path === "/user") return json(200, { login: "him" });
  /* Making a repository is refused here: the point is what is asked, not what is made. */
  if (req.method === "POST" && path === "/user/repos") return json(403, { message: "Resource not accessible by integration" });
  if (path.startsWith("/repos/him/real")) return json(200, { default_branch: "trunk", object: { sha: "0".repeat(40) }, sha: "0".repeat(40), tree: [] });
  return json(404, { message: `stub has no ${req.method} ${path}` });
});
await new Promise((r) => stub.listen(GH_PORT, "127.0.0.1", r));

const app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(APP_PORT)], {
  env: { ...process.env, GITHUB_API: `http://127.0.0.1:${GH_PORT}`, GITHUB_TOKEN: "", GITHUB_REPO: "him/real", GITHUB_BRANCH: "trunk", GITHUB_REPOS: "" },
  stdio: "ignore",
});
const BASE = `http://localhost:${APP_PORT}`;
let up = false;
for (let i = 0; i < 40 && !up; i++) {
  try { up = (await fetch(`${BASE}/builder`)).ok; } catch { /* not yet */ }
  if (!up) await new Promise((r) => setTimeout(r, 500));
}
check("a server started with a repository of its own answers", up);
const stop = async () => { app.kill(); stub.close(); };
if (!up) { await stop(); process.exit(1); }

/* ------------------------------------------------------------ the route */
const HEAD = { "x-github-token": "not-a-token-at-all", "content-type": "application/json" };
const status = await (await fetch(`${BASE}/api/studio/publish`)).json();
check("the server admits which repository it holds", status.github?.repo === "him/real" && status.github?.branch === "trunk", JSON.stringify(status.github));

seen.length = 0;
const scratch = await (await fetch(`${BASE}/api/studio/publish`, { method: "POST", headers: HEAD, body: JSON.stringify({ files: [{ path: "index.html", content: "<p>hi</p>" }], message: "A page", create: "scratch site" }) })).json();
check("a publish from a site with none asks GitHub to make one", seen.includes("POST /user/repos"), seen.join(", "));
check("and never touches the server's repository", !seen.some((s) => s.includes("/repos/him/real")), seen.join(", "));
check("with the refusal said in words rather than a push somewhere else", scratch.ok === false && typeof scratch.message === "string" && !/him\/real/.test(scratch.message), scratch.message);

seen.length = 0;
await fetch(`${BASE}/api/studio/publish`, { method: "POST", headers: HEAD, body: JSON.stringify({ files: [{ path: "index.html", content: "<p>hi</p>" }], message: "A page" }) });
check("only a request that names no site at all still goes to the server's", seen.some((s) => s.includes("/repos/him/real")), seen.slice(0, 3).join(", "));

/* THE LOCK, AT THE ROUTE. A site bound to one repository is refused into another before a byte moves. */
seen.length = 0;
const locked = await (await fetch(`${BASE}/api/studio/publish`, { method: "POST", headers: HEAD, body: JSON.stringify({ files: [{ path: "index.html", content: "<p>hi</p>" }], message: "A page", repo: "him/real", boundTo: "him/mine" }) })).json();
check("a publish from a site bound to one repository into another is refused in words", locked.ok === false && locked.reason === "bound" && /This site belongs to him\/mine and cannot be published into him\/real/.test(locked.message), locked.message);
check("before anything reaches the repository", !seen.some((s) => s.includes("/repos/him/real")), seen.join(", ") || "nothing sent");
seen.length = 0;
await fetch(`${BASE}/api/studio/publish`, { method: "POST", headers: HEAD, body: JSON.stringify({ files: [{ path: "index.html", content: "<p>hi</p>" }], message: "A page", repo: "him/real", boundTo: "him/real" }) });
check("the repository it is bound to still takes it", seen.some((s) => s.includes("/repos/him/real")));

/* -------------------------------------------------------------- the bar */
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
const button = await page.evaluate(() => {
  const b = document.querySelector("[data-github-button]");
  return { present: !!b, repo: b?.getAttribute("data-repo") ?? null, label: b?.getAttribute("aria-label") ?? null };
});
check("the GitHub button on a site with none does not wear the server's name", button.present && button.repo === "" && /no repository yet/.test(button.label ?? ""), JSON.stringify(button));
await page.locator("[data-github-button]").first().click();
await page.waitForTimeout(700);
const panel = await page.evaluate(() => ({
  points: document.querySelector("[data-repo-points]")?.textContent?.trim() ?? null,
  words: (document.querySelector("[data-repo-panel]")?.innerText ?? "").replace(/\s+/g, " "),
}));
check("and its panel says no repo of its own yet (his word for them, tests/repo-control.mjs), and what the first publish does", panel.points === "No repo of its own yet" && /first Update live site makes a private repository/i.test(panel.words) && !/him\/real/.test(panel.words), panel.points ?? "-");
await page.keyboard.press("Escape");

/* ---------------------------------------------------- the Builds page */
await page.goto(`${BASE}/builds`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.getByText("Repos", { exact: true }).first().click({ timeout: 5000 });
await page.waitForTimeout(500);
const row = await page.evaluate(() => {
  const field = document.querySelector("input[aria-label^='Publish'][aria-label$='to this repository']");
  const branch = document.querySelector("input[aria-label^='Publish'][aria-label$='to this branch']");
  const li = field?.closest("li");
  return { placeholder: field?.getAttribute("placeholder"), value: field?.value, branch: branch?.value, none: !!li?.querySelector("[data-repo-none]"), text: li?.innerText.replace(/\s+/g, " ") ?? "" };
});
check("the Repos tab field is empty with owner/name as its placeholder, not the server's repository", row.placeholder === "owner/name" && row.value === "", `${row.placeholder} / ${row.value}`);
check("its branch field reads main, not the server's branch", row.branch === "main", row.branch);
check("and the line under it says the site has none of its own yet", row.none && /No repository of its own yet/.test(row.text) && !/him\/real/.test(row.text), row.text);

/* Typed, then blurred by a click elsewhere: the gesture from the field. */
const field = page.locator("input[aria-label^='Publish'][aria-label$='to this repository']").first();
await field.fill("him/other");
await page.locator("h1").first().click();
await page.waitForTimeout(400);
const held = () => page.evaluate(() => { const v = JSON.parse(localStorage.getItem("builder.builds") || "null"); const p = (v?.state?.projects ?? [])[0]; return p?.repo ? `${p.repo.owner}/${p.repo.name}@${p.repo.branch}` : "none"; });
check("an edit blurred out of the field is kept", (await held()) === "him/other@main", await held());
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(800);
check("and is still there after a reload", (await held()) === "him/other@main", await held());
await page.getByText("Repos", { exact: true }).first().click({ timeout: 5000 });
await page.waitForTimeout(400);
const shown = await page.evaluate(() => document.querySelector("input[aria-label^='Publish'][aria-label$='to this repository']")?.value ?? null);
check("and the field shows it", shown === "him/other", shown ?? "-");

/* The status the button reads follows the keys, not the first page load. */
const src = readFileSync("src/features/studio/GithubButton.tsx", "utf8");
check("the button asks again whether a publish can push whenever the keys change", /useKeys\.subscribe\(ask\)/.test(src));

await browser.close();
await stop();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
