#!/usr/bin/env node
/**
 * GO LIVE IN THE TOP BAR. THE OWNER'S RULING: it was only at the foot of the
 * book of updates, and he could not find it.
 *
 * Held here:
 *   · a labelled Go live, with the globe, sits beside the GitHub button;
 *   · with no keys it is blocked, never a dead button: it says which key and
 *     Ctrl+Shift+K, and a press opens the keys panel; with
 *     only the GitHub key it names the Vercel one; with both it is enabled;
 *   · pressed, it runs the same Go live as the book (one function): the book,
 *     opened mid-build, shows the same progress; once READY the site holds the
 *     address, and the book's row still has Go live;
 *   · once live it reads Update live site and pushes and redeploys again, with
 *     the same progress; the address is a small link of its own beside it.
 *
 * Stand-ins for GitHub and Vercel, as tests/live-link.mjs; each deployment
 * stays BUILDING for its first four polls.
 *
 *   npm run build
 *   env -u GITHUB_TOKEN -u GITHUB_REPO -u VERCEL_TOKEN -u VERCEL_PROJECT -u VERCEL_TEAM \
 *     GITHUB_API=http://127.0.0.1:4333 VERCEL_API=http://127.0.0.1:4334 npx next start -p 3013
 *   node tests/go-live-bar.mjs http://127.0.0.1:3013
 */
import http from "node:http";
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const GH_PORT = Number(process.env.GH_PORT ?? 4333);
const VC_PORT = Number(process.env.VC_PORT ?? 4334);
const GH_TOKEN = "not-a-token-placeholder-xxxx";
const VC_TOKEN = "not-a-vercel-token-placeholder";
const ADDRESS = "https://top-bar.vercel.app";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const readBody = (req) => new Promise((ok) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => ok(Buffer.concat(c).toString("utf8"))); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ghSeen = [];
let lastCommit = "c0ffee0000";
const gh = http.createServer(async (req, res) => {
  const body = await readBody(req);
  const path = new URL(req.url, "http://x").pathname;
  ghSeen.push(`${req.method} ${path}`);
  const send = (s, o) => { res.writeHead(s, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
  if (path === "/user/repos" && req.method === "POST") return send(201, { full_name: `someone/${JSON.parse(body || "{}").name}` });
  const m = path.match(/^\/repos\/([^/]+\/[^/]+)(\/.*)?$/);
  if (!m) return send(404, { message: "Not Found" });
  const rest = m[2] ?? "";
  if (!rest) return send(200, { default_branch: "main" });
  if (rest.startsWith("/contents/site/capture")) return send(404, { message: "Not Found" });
  if (rest.startsWith("/git/ref/heads/")) return send(200, { object: { sha: "tip0" } });
  if (rest.startsWith("/git/commits/")) return send(200, { tree: { sha: "tree0" } });
  if (rest === "/git/blobs") return send(201, { sha: `b${ghSeen.length}` });
  if (rest === "/git/trees") return send(201, { sha: "tree1" });
  if (rest === "/git/commits") { lastCommit = `c0ffee${String(ghSeen.length).padStart(4, "0")}`; return send(201, { sha: lastCommit, html_url: "https://example.invalid/c" }); }
  if (rest.startsWith("/git/refs")) {
    /* Vercel's Git link, played: a push to a repository a project is linked to
       deploys that project on its own, a moment later (tests/go-live-linked.mjs). */
    const [org, name] = m[1].split("/");
    const linked = projects.find((p) => p.link?.org === org && p.link?.repo === name);
    if (linked && req.method !== "GET") { const s = lastCommit; setTimeout(() => deployments.push({ id: `dpl_${deployments.length + 1}`, polls: 0, by: "git", project: linked.id, sha: s, at: Date.now() }), 600); }
    return send(200, { object: { sha: lastCommit } });
  }
  return send(404, { message: "Not Found" });
});

const vcSeen = [];
const projects = [];
/** Every deployment asked for, and how many times each has been polled. */
const deployments = [];
const vc = http.createServer(async (req, res) => {
  const body = await readBody(req);
  const path = new URL(req.url, "http://x").pathname;
  vcSeen.push(`${req.method} ${path}`);
  const send = (s, o) => { res.writeHead(s, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
  if (!/^Bearer .{9,}/.test(req.headers.authorization ?? "")) return send(403, { error: { code: "forbidden", message: "Not authorized" } });
  if (path === "/v9/projects" && req.method === "GET") return send(200, { projects, pagination: { next: null } });
  if (/^\/v\d+\/projects$/.test(path) && req.method === "POST") {
    const b = JSON.parse(body || "{}");
    const [org, name] = String(b.gitRepository?.repo ?? "").split("/");
    const p = { id: `prj_${projects.length + 1}`, name: b.name, link: { type: "github", org, repo: name, repoId: 1000 } };
    projects.push(p);
    return send(200, p);
  }
  /* The list the route reads to find a push's own deployment, by its commit. */
  if (/^\/v\d+\/deployments$/.test(path) && req.method === "GET") {
    const projectId = new URL(req.url, "http://x").searchParams.get("projectId");
    return send(200, { deployments: deployments.filter((x) => x.by === "git" && x.project === projectId).map((x) => ({ uid: x.id, id: x.id, readyState: x.polls >= 5 ? "READY" : "BUILDING", url: `top-bar-${x.id}.vercel.app`, created: x.at, meta: { githubCommitSha: x.sha, githubCommitRef: "main" } })) });
  }
  if (path === "/v13/deployments" && req.method === "POST") {
    const id = `dpl_${deployments.length + 1}`;
    deployments.push({ id, polls: 0, by: "api" });
    return send(200, { id, readyState: "QUEUED", url: `top-bar-${id}.vercel.app` });
  }
  const d = path.match(/^\/v13\/deployments\/(dpl_\d+)$/);
  if (d && req.method === "GET") {
    const dep = deployments.find((x) => x.id === d[1]);
    if (!dep) return send(404, { error: { code: "not_found", message: "Deployment not found" } });
    dep.polls++;
    if (dep.polls < 5) return send(200, { readyState: "BUILDING", url: `top-bar-${dep.id}.vercel.app` });
    return send(200, { readyState: "READY", url: `top-bar-${dep.id}.vercel.app`, alias: ["top-bar-git-main-someone.vercel.app", "top-bar.vercel.app"] });
  }
  if (path === "/v13/deployments/probe") return send(404, { error: { code: "not_found", message: "Deployment not found" } });
  return send(404, { error: { code: "not_found", message: "Not found" } });
});
await new Promise((ok) => gh.listen(GH_PORT, "127.0.0.1", ok));
await new Promise((ok) => vc.listen(VC_PORT, "127.0.0.1", ok));
const stop = () => { gh.close(); vc.close(); };

/* Both stand-ins answer for the server, or nothing is pressed. */
{
  const headers = { "content-type": "application/json", "x-github-token": GH_TOKEN, "x-vercel-token": VC_TOKEN };
  await fetch(`${BASE}/api/studio/publish`, { method: "POST", headers, body: JSON.stringify({ files: [{ path: "index.html", content: "x" }], repo: "stand-in/probe", branch: "main", deploy: false }) }).catch(() => null);
  await fetch(`${BASE}/api/studio/deploy?id=probe`, { headers }).catch(() => null);
  if (!ghSeen.some((l) => l.includes("/repos/stand-in/probe")) || !vcSeen.includes("GET /v13/deployments/probe")) {
    console.error(`The server at ${BASE} is not pointed at the stand-ins on ${GH_PORT} and ${VC_PORT}. Start it with GITHUB_API and VERCEL_API set and no tokens of its own.`);
    stop();
    process.exit(2);
  }
  ghSeen.length = 0;
  vcSeen.length = 0;
}

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1763, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
/* Nothing from the browser reaches either service: the server speaks for it. */
await page.route(/https:\/\/api\.(github|vercel)\.com\/.*/, (r) => r.fulfill({ status: 404, contentType: "application/json", body: "{}" }));
const project = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.builds") || "{}").state?.projects?.find((p) => p.id === "s1") ?? null);

await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => {
  const env = (s) => JSON.stringify({ state: s, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "s1", name: "Top Bar", updatedAt: Date.now() }], activeId: "s1" }));
  localStorage.setItem("builder.studio", env({
    pages: [{ id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
    activePageId: "page_home", groups: [], selection: [], threads: [], spaces: [], shapes: [], nodes: [],
  }));
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1500);

const bar = () => page.locator("header [data-go-live]");
const state = async () => ((await bar().count()) ? bar().first().getAttribute("data-go-live-state") : null);
const tip = async () => {
  await page.mouse.move(5, 500);
  await page.waitForTimeout(300);
  await bar().first().locator("xpath=..").hover();
  await page.waitForTimeout(900);
  const t = page.locator('[role="tooltip"]');
  return (await t.count()) ? (await t.first().textContent())?.replace(/\s+/g, " ").trim() ?? "" : "";
};
const keysIn = async (fill) => {
  const keys = page.locator("[data-keys-panel]");
  await page.getByRole("button", { name: "Keys", exact: true }).click();
  await page.waitForTimeout(500);
  const skip = keys.getByRole("button", { name: /Skip the PIN|Hold the key for this tab/ });
  if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(300); }
  for (const [service, value] of fill) await keys.locator(`[data-service="${service}"] input[type="password"]`).first().fill(value);
  await keys.getByRole("button", { name: /Save to this browser|Hold in this tab/ }).first().click();
  await page.waitForTimeout(500);
  await keys.getByRole("button", { name: "Close keys" }).click();
  await page.waitForTimeout(1200);
};

console.log("1. Where it is, and with no keys");
{
  const order = await page.evaluate(() => {
    const header = document.querySelector("header");
    const all = [...(header?.querySelectorAll("[data-github-button], [data-go-live]") ?? [])];
    return all.map((e) => (e.hasAttribute("data-github-button") ? "github" : "golive"));
  });
  const n = await bar().count();
  const label = n ? (await bar().first().innerText()).replace(/\s+/g, " ").trim() : "";
  const globe = n ? await bar().first().evaluate((e) => !!e.querySelector("svg.lucide-globe")) : false;
  check("a labelled Go live with the globe is in the top bar", n === 1 && label === "Go live" && globe, `${n} found, label ${JSON.stringify(label)}, globe ${globe}`);
  /* The GitHub control draws nothing until a token or a repository exists, so beside it is read once keys are in. */
  const disabled = n ? (await state()) === "blocked" : null;
  const says = await tip();
  check("with no keys it is blocked, and says which keys and Ctrl+Shift+K", disabled === true && /GitHub/.test(says) && /Vercel/.test(says) && /Ctrl\+Shift\+K/.test(says), `disabled ${disabled}; ${JSON.stringify(says)}; order ${order.join(",")}`);
}
console.log("2. With the GitHub key only");
await keysIn([["github", GH_TOKEN]]);
{
  const disabled = (await state()) === "blocked";
  const says = await tip();
  check("still blocked, and names only the Vercel key", disabled && /Vercel/.test(says) && !/GitHub/.test(says) && /Ctrl\+Shift\+K/.test(says), `disabled ${disabled}; ${JSON.stringify(says)}`);
}
console.log("3. With both keys");
await keysIn([["github", GH_TOKEN], ["vercel", VC_TOKEN]]);
{
  const disabled = (await state()) === "blocked";
  check("enabled", disabled === false && (await state()) === "ready", `disabled ${disabled}, state ${await state()}`);
  const order = await page.evaluate(() => [...document.querySelectorAll("header [data-github-button], header [data-go-live]")].map((e) => (e.hasAttribute("data-github-button") ? "github" : "golive")));
  const beside = await page.evaluate(() => {
    const g = document.querySelector("header [data-github-button]")?.getBoundingClientRect();
    const l = document.querySelector("header [data-go-live]")?.getBoundingClientRect();
    return g && l ? Math.round(l.left - g.right) : null;
  });
  check("beside the GitHub button", order.join(",") === "github,golive" && beside !== null && beside >= 0 && beside <= 16, `order ${order.join(",")}, gap ${beside}px`);
}

console.log("4. Pressed: the same Go live, the same progress, and the address");
{
  const n = deployments.length;
  await bar().first().click();
  for (let i = 0; i < 300 && !(deployments[n]?.polls >= 1); i++) await sleep(100);
  const busyState = await state();
  /* The button says it is working; the step, in plain words, is the line beside it (tests/publish-status-line.mjs). */
  const busyLabel = `${(await bar().first().innerText()).replace(/\s+/g, " ").trim()} | ${await page.evaluate(() => document.querySelector("header [data-go-live-step]")?.textContent ?? "")}`;
  check("the button shows the run in progress", busyState === "busy" && /Going live…|Updating…/.test(busyLabel) && /waiting for Vercel|Saving to GitHub/.test(busyLabel), `${busyState}: ${JSON.stringify(busyLabel)}`);
  await page.evaluate(() => window.__studioOpenBrief?.());
  await page.waitForTimeout(1200);
  const book = await page.evaluate(() => {
    const c = document.querySelector("[data-brief-publish]");
    const go = [...(c?.querySelectorAll("button") ?? [])].find((b) => /Go live/.test(b.textContent ?? ""));
    return { text: (c?.textContent ?? "").replace(/\s+/g, " "), goDisabled: go ? go.disabled : null };
  });
  check("the book, opened mid-build, shows the same run", /building…|queued…/i.test(book.text) && book.goDisabled === true, `Go live disabled: ${book.goDisabled}; ${book.text.slice(0, 160)}`);
  let p = null;
  for (let i = 0; i < 60; i++) { p = await project(); if (p?.live?.url) break; await sleep(500); }
  await page.waitForTimeout(1200);
  const bookLink = await page.evaluate(() => document.querySelector("[data-brief-publish] [data-live-address]")?.getAttribute("href") ?? null);
  check("once READY the site records the address, and the book shows it", p?.live?.url === ADDRESS && bookLink === ADDRESS, `live ${p?.live?.url ?? null}, book ${bookLink}`);
  const bookGo = await page.evaluate(() => { const b = [...document.querySelectorAll("[data-brief-publish] button")].find((x) => /Go live/.test(x.textContent ?? "")); return b ? !b.disabled : null; });
  check("the book's row keeps its Go live", bookGo === true, `enabled ${bookGo}`);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  check("one project was made on Vercel, and one deployment", projects.length === 1 && deployments.length === n + 1, `${projects.length} projects, ${deployments.length - n} deployments`);
}

/*
 * THE OWNER'S RULING: once live, the top-bar button still pushes. It became
 * "Live site" and only opened the address, so a changed board could not be
 * republished from the bar and nothing he changed showed. Its main action
 * is always the push and the redeploy, "Update live site" once live, and the
 * address is a small link of its own beside it.
 */
console.log("5. Live: the button updates the site, and the address is a link beside it");
{
  const label = (await bar().first().innerText()).replace(/\s+/g, " ").trim();
  const enabled = await bar().first().evaluate((b) => b.tagName === "BUTTON" && !b.disabled);
  check("the top-bar button reads Update live site, and can be pressed", label === "Update live site" && enabled, `${await state()}: ${JSON.stringify(label)}, a pressable button: ${enabled}`);
  const link = await page.evaluate(() => {
    const a = document.querySelector("header [data-go-live-address]");
    const b = document.querySelector("header [data-go-live]");
    if (!a || !b) return null;
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    return { href: a.getAttribute("href"), target: a.getAttribute("target"), apart: !b.contains(a) && !a.contains(b), gap: Math.round(ra.left - rb.right), small: ra.width <= rb.width, name: a.getAttribute("aria-label") ?? "" };
  });
  check("the address is its own small link beside it, opening in a new tab", !!link && link.href === ADDRESS && link.target === "_blank" && link.apart && link.gap >= 0 && link.gap <= 16 && link.small && /top-bar\.vercel\.app/.test(link.name), JSON.stringify(link));

  /* The board changes, and the button puts the change on the site. */
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("builder.studio"));
    raw.state.brief = { ...(raw.state.brief ?? {}), name: "Top Bar", gimmick: "", master: "" };
    localStorage.setItem("builder.studio", JSON.stringify(raw));
  });
  const commits = ghSeen.filter((l) => /POST \/repos\/.*\/git\/commits$/.test(l)).length;
  const askedBefore = vcSeen.filter((l) => l === "POST /v13/deployments").length;
  const n = deployments.length;
  await bar().first().click().catch(() => {});
  for (let i = 0; i < 300 && !(deployments[n]?.polls >= 1); i++) await sleep(100);
  const busyState = await state();
  const busyLabel = `${(await bar().first().innerText()).replace(/\s+/g, " ").trim()} | ${await page.evaluate(() => document.querySelector("header [data-go-live-step]")?.textContent ?? "")}`;
  check("pressed, it shows the same progress", busyState === "busy" && /Updating…/.test(busyLabel) && /waiting for Vercel|Saving to GitHub/.test(busyLabel), `${busyState}: ${JSON.stringify(busyLabel)}`);
  for (let i = 0; i < 60 && (await state()) === "busy"; i++) await sleep(500);
  await page.waitForTimeout(800);
  const pushed = ghSeen.filter((l) => /POST \/repos\/.*\/git\/commits$/.test(l)).length - commits;
  /* Once the project is linked to the repository, the push is the deployment:
     the Builder follows it and never asks for a second one (two a press is
     what spent the plan's hundred a day). */
  const askedAgain = vcSeen.filter((l) => l === "POST /v13/deployments").length - askedBefore;
  check("…and pushes the board again, and the push's own deployment puts it live", pushed === 1 && deployments.length === n + 1 && deployments[n]?.by === "git" && deployments[n]?.polls >= 1 && projects.length === 1, `${pushed} commits, ${deployments.length - n} deployments (${deployments.slice(n).map((d) => d.by).join(", ")}), ${projects.length} projects`);
  check("…without asking Vercel for a second deployment", askedAgain === 0, `${askedAgain} asked for`);
  const after = (await bar().first().innerText()).replace(/\s+/g, " ").trim();
  const p = await project();
  check("then it is Update live site again, the address still recorded", after === "Update live site" && p?.live?.url === ADDRESS, `${JSON.stringify(after)}, ${p?.live?.url}`);
}
check("no page error on the way", errors.length === 0, errors.join(" / "));

await browser.close();
stop();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
