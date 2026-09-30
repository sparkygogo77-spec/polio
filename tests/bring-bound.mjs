/**
 * A SITE BOUND TO A REPO BRINGS THAT REPO WITHOUT TYPING IT, AND SAYS FIRST
 * WHAT IT WILL REPLACE.
 *
 * His words: "If I'm selected to a repo I should be able to select Bring it
 * with the knowledge that it deletes my existing board. It should always stay
 * locked to the repo it is selected to, so I don't have to retype it."
 *
 * MEASURED on 9bc39df: the panel names the site's repo at the top ("The repo
 * this site goes to"), and the only Bring is the typed "Bring a repo in"
 * field below, so bringing the bound repo meant typing its name again. And
 * nothing said the board would go: the lock refuses a DIFFERENT repository,
 * so bringing the bound one into a board with work on it was accepted, and
 * replaced the whole document.
 *
 * Since the owner's ruling that Publish never writes into the repository a
 * site came from, the repo a site is locked to for a Bring is its SOURCE,
 * and it is a field of its own (`tests/publish-source.mjs`); the fixture is
 * a board brought in from him/sink, which publishes nowhere yet.
 *
 * So: a Bring beside the bound repo's name, and one line before it runs,
 * naming the repo and how many parts are about to go, which he can accept or
 * decline. Not a block; he has said he wants to go ahead knowing. The typed
 * field stays for bringing a different one. GitHub is answered by a stand-in
 * serving the fixture, so nothing leaves this machine.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/bring-bound.mjs http://127.0.0.1:3013
 */
import { existsSync, readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const DOC = readFileSync(new URL("./fixtures/sink-pages.json", import.meta.url));
const doc = JSON.parse(DOC.toString("utf8"));
const tree = [
  { path: "package.json", type: "blob", sha: "pkg", size: 10 },
  { path: "site/document.json", type: "blob", sha: "doc", size: DOC.length },
];
/* His board before the Bring: three parts of his own on one page. */
const part = (id, y) => ({
  id, pageId: "page_home", featureId: "custom-idea", label: id, prompt: "", content: "", data: "",
  x: 100, y, w: 400, h: 120, groupId: null, options: {}, priority: "must", custom: true,
  glyph: null, hue: null, locked: false, link: null, colour: null, font: null, anim: null, animSpeed: 1,
  animDelay: 0, animEase: "smooth", shape: null, outline: null, kind: null, vector: null, role: null,
  cube: null, mesh: null, code: null, aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null, plan: null,
});
const MINE = [part("mine_a", 100), part("mine_b", 300), part("mine_c", 500)];
const BOUND = { owner: "him", name: "sink", branch: "main" };

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1763, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("dialog", (d) => { errors.push(`a browser dialog opened: ${d.message()}`); void d.dismiss(); });
await page.route("https://api.github.com/**", (r) => {
  const u = new URL(r.request().url());
  const j = (b, code = 200) => r.fulfill({ status: code, contentType: "application/json", body: JSON.stringify(b) });
  const rest = u.pathname.startsWith("/repos/him/sink") ? u.pathname.slice("/repos/him/sink".length) : null;
  if (rest === null) return j({ message: "no" }, 404);
  if (!rest) return j({ default_branch: "main", homepage: "" });
  if (rest.startsWith("/git/trees/")) return j({ tree });
  if (rest === "/git/blobs/doc") return j({ encoding: "base64", content: DOC.toString("base64") });
  return j({ message: "no" }, 404);
});
/* The list the menu shows and what is in the repo, answered here rather than by the Builder's route asking GitHub. */
await page.route("**/api/studio/repo", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, repos: [{ name: "him/sink", private: false, branch: "main" }] }) }));
await page.route("**/api/studio/repo/choices**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, base: "main", ref: "main", branches: ["main"], sites: [] }) }));
const state = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {});
const ids = (s) => (s.nodes ?? []).map((n) => n.id);

await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate(([mine, bound]) => {
  const env = (s) => JSON.stringify({ state: s, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "s3", name: "Site 3", updatedAt: Date.now(), source: bound }], activeId: "s3" }));
  localStorage.setItem("builder.studio", env({
    pages: [{ id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
    activePageId: "page_home", groups: [], selection: [], threads: [], spaces: [], shapes: [], nodes: mine,
  }));
}, [MINE, BOUND]);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);
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
await page.locator("[data-github-button]").first().click();
await page.waitForTimeout(700);

const bound = `${BOUND.owner}/${BOUND.name}`;
check("the panel names the repo the site was brought in from", (await page.locator("[data-repo-source]").getAttribute("data-repo-source")) === bound);
const own = page.locator("[data-repo-bring-own]");
check("there is a Bring for that repo beside its name, with nothing to type", (await own.count()) === 1 && (await own.isVisible()),
  `${await own.count()} found`);
check("the typed field is still there, for bringing a different one", (await page.locator("[data-repo-bring]").count()) === 1);

/*
 * A SITE WHOSE RECORD NAMES NO FOLDER CHOOSES ONE FIRST. Bring in again used
 * to read the root of the default branch in silence, and brought SOLCINERATOR
 * in over a trumpmorty.fun board (`RepoPicker.tsx`, bringAgain). This
 * fixture's source names none, so the press opens the picker on its
 * repository and he chooses the whole repo; the one line comes after that.
 */
const pressOwn = async () => {
  await own.click();
  await page.waitForTimeout(400);
  if (await page.locator("[data-repo-again-says]").count()) {
    await page.locator('[data-repo-folder=""]').first().click();
    await page.locator("[data-repo-bring-chosen]").first().click();
    await page.waitForTimeout(400);
  }
};
if (await own.count()) {
  await pressOwn();
  const ask = page.locator("[data-repo-bring-confirm]");
  const says = (await ask.count()) ? (await ask.innerText()).replace(/\s+/g, " ") : "";
  check("pressing it first says, in one line, what will be replaced and how many parts go",
    says.includes(bound) && new RegExp(`\\b${MINE.length} parts\\b`).test(says), JSON.stringify(says));
  check("…and has not touched the board yet", JSON.stringify(ids(await state())) === JSON.stringify(MINE.map((n) => n.id)));

  await page.locator("[data-repo-bring-keep]").click();
  await page.waitForTimeout(300);
  check("declining leaves the board as it was and the line goes",
    JSON.stringify(ids(await state())) === JSON.stringify(MINE.map((n) => n.id)) && (await page.locator("[data-repo-bring-confirm]").count()) === 0);

  await pressOwn();
  await page.locator("[data-repo-bring-go]").click();
  let s = {};
  for (let i = 0; i < 60; i++) { await page.waitForTimeout(1000); s = await state(); if (ids(s).some((id) => doc.nodes.some((n) => n.id === id))) break; }
  await page.waitForTimeout(1500);
  s = await state();
  check("accepting brings the bound repo in: the board is the repo's now, and his three parts are gone",
    ids(s).some((id) => doc.nodes.some((n) => n.id === id)) && !MINE.some((n) => ids(s).includes(n.id)),
    `${ids(s).length} parts, mine left: ${MINE.filter((n) => ids(s).includes(n.id)).length}`);
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("builder.builds")).state.projects.find((p) => p.id === "s3"));
  check("and the site is still brought in from the same repo, and publishes nowhere yet", after?.source && `${after.source.owner}/${after.source.name}` === bound && !after.repo, JSON.stringify({ source: after?.source, repo: after?.repo }));
}
check("with no browser dialog and no page error on the way", errors.length === 0, errors.join(" / "));

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
