/**
 * Is the live site the site we think it is, and does it work?
 *
 * This exists because of a real evening: J drew a cube on the live site and
 * got nothing back, because the cube had never reached trunk and nothing
 * anywhere said so. Every suite in this repository was green, and every one
 * of them was talking to a dev server on this machine. A deployment that is
 * eleven commits behind looks exactly like one that is current.
 *
 * So this asks the deployment itself, in two halves:
 *
 * 1. **Which commit is it serving**, next to trunk's head, in one line.
 *    `/api/version` answers the first; git answers the second.
 * 2. **Does the Builder actually work there** — the things that have each
 *    broken at least once, every one of them asked by *visibility* rather
 *    than by existence, because a control with `display: none` exists: it
 *    has a role, it has a name, `count()` finds it, and nobody can press it.
 *    That is precisely how a Builder with no bar at all shipped green.
 *
 * Nothing here follows a redirect. A redirect is how the Builder vanished
 * once — the root sent everyone to the published site — and a check that
 * follows one cannot see it.
 *
 *   node tests/deploy-check.mjs [url]        # default https://polio-two.vercel.app
 *   node tests/deploy-check.mjs --no-write   # do not touch docs/DEPLOY-CHECK.md
 *   node tests/deploy-check.mjs --wait-for <sha>   # after a push: wait for
 *       the deployment to be serving that commit before asking it anything,
 *       because a check that runs while the old build is still up is a check
 *       of the old build.
 *
 * It writes what it found to `docs/DEPLOY-CHECK.md`, so there is a record
 * rather than a scroll.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const run = promisify(execFile);
const args = process.argv.slice(2);
const URL_ = (args.find((a) => !a.startsWith("--")) ?? "https://polio-two.vercel.app").replace(/\/$/, "");
const WRITE = !args.includes("--no-write");
/** The branch the deployment is built from. */
const TRUNK = process.env.DEPLOY_TRUNK ?? "claude/template-ui-website-builder-11bfgl";

const rows = [];
const check = (what, ok, found = "") => {
  rows.push({ what, ok, found });
  console.log(`${ok ? "  ok  " : " MISSING " } ${what}${found ? ` — ${found}` : ""}`);
};
const note = (what, found) => {
  rows.push({ what, ok: null, found });
  console.log(`  ·     ${what}${found ? ` — ${found}` : ""}`);
};

/* ------------------------------------------------------------------ */
/* 1. The front door, following nothing                                */
/* ------------------------------------------------------------------ */

/** Status and where it would have sent us, without going there. */
async function knock(p) {
  try {
    const { stdout } = await run("curl", ["-s", "-o", "/dev/null", "-w", "%{http_code} %{redirect_url}", `${URL_}${p}`], { timeout: 60_000 });
    const [code, to = ""] = stdout.trim().split(" ");
    return { code: Number(code), to };
  } catch (err) {
    return { code: 0, to: "", err: err instanceof Error ? err.message : String(err) };
  }
}
async function get(p) {
  try {
    const { stdout } = await run("curl", ["-s", `${URL_}${p}`], { timeout: 60_000, maxBuffer: 64 * 1024 * 1024 });
    return stdout;
  } catch (err) {
    return "";
  }
}

console.log(`\nThe deployment at ${URL_}\n`);

/* After a push, give the deployment time to become the thing being asked. */
const waitFor = args.includes("--wait-for") ? args[args.indexOf("--wait-for") + 1] : null;
if (waitFor) {
  const until = Date.now() + 12 * 60_000;
  let saw = null;
  process.stdout.write(`  waiting for ${waitFor.slice(0, 7)}`);
  while (Date.now() < until) {
    try {
      saw = JSON.parse(await get("/api/version"))?.commit ?? null;
    } catch { saw = null; }
    if (saw === waitFor) break;
    process.stdout.write(".");
    await new Promise((r) => setTimeout(r, 15_000));
  }
  console.log(saw === waitFor ? " there" : ` gave up after 12 minutes — it is serving ${saw ? saw.slice(0, 7) : "a build that cannot say"}`);
}

const root = await knock("/");
check("the root answers", root.code >= 200 && root.code < 400, root.err ?? `HTTP ${root.code}`);
check(
  "and it is the app rather than a redirect away from it",
  root.code < 300 || !root.to,
  root.code >= 300 && root.to ? `HTTP ${root.code} → ${root.to}` : `HTTP ${root.code}, nowhere else`,
);
const builder = await knock("/builder");
check("the Builder answers", builder.code === 200, builder.err ?? `HTTP ${builder.code}${builder.to ? ` → ${builder.to}` : ""}`);

/* ------------------------------------------------------------------ */
/* 2. Which commit, next to trunk's head                               */
/* ------------------------------------------------------------------ */

let version = null;
try {
  version = JSON.parse(await get("/api/version"));
} catch {
  version = null;
}

let trunkHead = null;
let behind = null;
let known = false;
try {
  await run("git", ["fetch", "origin", TRUNK], { timeout: 120_000 }).catch(() => undefined);
  trunkHead = (await run("git", ["rev-parse", `origin/${TRUNK}`], { timeout: 30_000 })).stdout.trim();
  if (version?.commit) {
    known = await run("git", ["cat-file", "-e", `${version.commit}^{commit}`], { timeout: 30_000 }).then(() => true).catch(() => false);
    if (known) {
      behind = Number((await run("git", ["rev-list", "--count", `${version.commit}..${trunkHead}`], { timeout: 60_000 })).stdout.trim());
    }
  }
} catch { /* git is not always there; the line below says so */ }

const short = (s) => (s ? s.slice(0, 7) : "—");
if (!version) {
  check("the deployment names the commit it is serving", false, "no /api/version — this build predates it, so nothing can say how old it is");
} else if (!version.commit) {
  check("the deployment names the commit it is serving", false, version.note ?? "no commit in the build");
} else {
  check("the deployment names the commit it is serving", true, `${short(version.commit)} on ${version.branch ?? "an unnamed branch"}${version.builtAt ? `, built ${version.builtAt}` : ""}`);
  check(
    "and it is serving trunk's head",
    behind === 0,
    behind === null
      ? `deploy ${short(version.commit)} · trunk ${short(trunkHead)} · ${known ? "could not count" : "the deployed commit is not in this clone — unmerged work, or a different repository"}`
      : behind === 0
        ? `deploy ${short(version.commit)} is trunk's head`
        : `deploy ${short(version.commit)} is ${behind} commit${behind === 1 ? "" : "s"} behind trunk ${short(trunkHead)}`,
  );
  if (version.branch && version.branch !== TRUNK) {
    note("the branch it was built from is not trunk", `${version.branch}, not ${TRUNK}`);
  }
}

/* ------------------------------------------------------------------ */
/* 3. The Builder, asked by visibility                                 */
/* ------------------------------------------------------------------ */

const req = createRequire(import.meta.url);
const chromium = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c).chromium; } catch { /* next */ }
  }
  return null;
})();

/*
 * On the screen, not merely in the document.
 *
 * A node counts as seen when it has a non-zero rectangle that overlaps the
 * window, is not `display: none` or `visibility: hidden`, and is not fully
 * transparent. `offsetParent` is one signal among those rather than the
 * gate: it is null for every `position: fixed` element, which would fail a
 * fixed toolbar or an open dialog for entirely the wrong reason.
 */
function seenIn(sel) {
  return [...document.querySelectorAll(sel)].map((el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    const fixed = s.position === "fixed" || s.position === "sticky";
    const inView = r.bottom > 0 && r.right > 0 && r.top < window.innerHeight && r.left < window.innerWidth;
    return {
      name: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 40) || el.tagName.toLowerCase(),
      on: r.width > 0 && r.height > 0 && inView && s.display !== "none" && s.visibility !== "hidden" && Number(s.opacity) !== 0
        && (fixed || el === document.body || !!el.offsetParent),
      box: Math.round(r.width) + "\u00d7" + Math.round(r.height),
    };
  });
}

let browserReached = false;
let browserWhy = "";
if (!chromium) {
  browserWhy = "no Playwright on this machine — npm i -D playwright, or set PLAYWRIGHT_MODULE";
} else {
  // The proxy, but not for a server on this machine: a local address through
  // an egress proxy is a connection that goes nowhere.
  const local = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/.test(URL_);
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox"],
    ...(process.env.HTTPS_PROXY && !local ? { proxy: { server: process.env.HTTPS_PROXY } } : {}),
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${URL_}/builder`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(3500);
    browserReached = true;
    const seen = (sel) => page.evaluate(seenIn, sel);
    /** Every one of these is on the screen, or the ones that are not name themselves. */
    const all = async (what, sel, least = 1) => {
      const found = await seen(sel);
      const on = found.filter((f) => f.on);
      const off = found.filter((f) => !f.on).map((f) => f.name);
      check(what, found.length >= least && off.length === 0,
        found.length === 0 ? "nothing matched" : off.length ? `${off.length} of ${found.length} not on the screen: ${off.slice(0, 6).join(", ")}` : `${on.length} on the screen`);
    };

    await all("the Builder's bar", "[data-studio-bar]");
    await all("and every control in it", "[data-studio-bar] button, [data-studio-bar] a, [data-studio-bar] input, [data-studio-bar] [role=radio], [data-studio-bar] [role=switch]", 6);
    await all("the category shelf", "[data-drawer] [data-category]", 8);
    await all("the parts search", "[data-parts-search] input");
    await all("the command search on the bar", "[data-tool-search]");
    await all("a side panel", "[data-side-panel]");
    await all("the nebula", "[data-cloud-layer]", 1);
    await all("the Finish key", "[data-finish]");

    /* The keys panel, which is where a person learns whether anything can
       run at all. Both services have to be listed by name. */
    const keyButton = page.locator('button[aria-label="Keys"]').first();
    if (await keyButton.count()) {
      await keyButton.click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(1200);
    }
    const vault = await page.evaluate(() => {
      const box = document.querySelector("[data-keys-panel]") ?? document.querySelector("[role=dialog]");
      if (!box) return { there: false, says: "" };
      const r = box.getBoundingClientRect();
      const s = getComputedStyle(box);
      const on = r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden" && Number(s.opacity) !== 0
        && r.bottom > 0 && r.right > 0 && r.top < window.innerHeight && r.left < window.innerWidth;
      return { there: on, says: (box.textContent || "").replace(/\s+/g, " ").trim() };
    });
    check("the Keys panel opens", vault.there, vault.there ? "on the screen" : "it did not come up");
    check("and it lists Claude", vault.there && /claude/i.test(vault.says), /claude/i.test(vault.says) ? "named" : "not named");
    check("and it lists Replicate", vault.there && /replicate/i.test(vault.says), /replicate/i.test(vault.says) ? "named" : "not named");
    await page.keyboard.press("Escape").catch(() => undefined);
    await page.waitForTimeout(600);

    /* The cube: the part J drew that was not there. Found by searching the
       shelf the way a person would, not by reading the catalog. */
    const box = page.locator("[data-parts-search] input").first();
    let cube = { on: false, how: "no search to type in" };
    if (await box.count()) {
      await box.fill("cube").catch(() => undefined);
      await page.waitForTimeout(1200);
      // A part on the shelf is a draggable tile with its name under it, not
      // a button: asked for the way a person sees them.
      const hits = await seen("[data-drawer] [draggable=true]");
      const lit = hits.filter((h) => h.on && /cube/i.test(h.name));
      cube = { on: lit.length > 0, how: lit.length ? `${lit.length} on the screen` : `searched "cube", ${hits.filter((h) => h.on).length} parts showing, none of them a cube` };
    }
    check("the cube is in the shelf", cube.on, cube.how);
  } catch (err) {
    browserWhy = err instanceof Error ? err.message.split("\n")[0] : String(err);
  } finally {
    await browser.close().catch(() => undefined);
  }
}

/*
 * A failure part-way through is a failure, said out loud.
 *
 * The first draft of this only reported a browser problem when the page had
 * never opened, so a throw *after* it opened left the Builder's checks
 * silently missing and the run still saying "nothing missing" — which is the
 * exact shape of the bug this whole file exists to catch.
 */
if (browserWhy) {
  check(browserReached ? "the Builder's own checks all ran" : "the Builder could be opened in a browser", false, browserWhy);
  console.log(`\n  Some or all of the Builder's checks did not run. Everything above them is HTTP and did.`);
}

/* ------------------------------------------------------------------ */
/* 4. The record                                                       */
/* ------------------------------------------------------------------ */

const failed = rows.filter((r) => r.ok === false).length;
const ran = rows.filter((r) => r.ok !== null).length;
console.log(`\n${ran - failed}/${ran} · ${failed ? `${failed} missing` : "nothing missing"}\n`);

if (WRITE) {
  const when = new Date().toISOString().replace("T", " ").slice(0, 16) + "Z";
  const head = version?.commit
    ? `serving \`${short(version.commit)}\`${version.branch ? ` from \`${version.branch}\`` : ""}${behind === 0 ? ", which is trunk's head" : behind ? `, **${behind} commit${behind === 1 ? "" : "s"} behind** trunk \`${short(trunkHead)}\`` : known === false ? ", **a commit this clone has never seen**" : ""}`
    : "**not saying which commit it is serving**";
  const md = [
    "# The deploy check",
    "",
    "What the live site was actually serving, and whether it worked, the last",
    "time anybody asked. Written by `tests/deploy-check.mjs`; run it with",
    "`npm run check:deploy`, or let the trunk push do it.",
    "",
    "This is a record rather than a scroll: the one thing it is here to make",
    "obvious in a line is a deployment that is stale or was never merged, which",
    "is how a cube drawn on the live site did nothing and nobody knew.",
    "",
    `## ${URL_}`,
    "",
    `**${when}** — ${head}. ${failed ? `**${failed} of ${ran} missing.**` : `All ${ran} present.`}`,
    "",
    "| | what was asked | what was found |",
    "|---|---|---|",
    ...rows.map((r) => `| ${r.ok === null ? "·" : r.ok ? "ok" : "**missing**"} | ${r.what} | ${(r.found || "").replace(/\|/g, "\\|")} |`),
    "",
    "Everything above is asked by **visibility** — a non-zero rectangle inside",
    "the window, not `display:none`, not `visibility:hidden`, not transparent —",
    "because a control that merely exists is one nobody can press, and that is",
    "exactly how a Builder with no bar shipped green. Nothing follows a",
    "redirect, because a redirect is how the Builder vanished once.",
    "",
    ...(browserWhy && /ERR_CONNECTION_RESET|ERR_PROXY|tunnel/i.test(browserWhy)
      ? [
          "> The browser could not reach the deployment **from wherever this was",
          "> run**, which is not the same as the deployment being down: the HTTP",
          "> rows above got through. An agent container behind an egress proxy",
          "> often cannot open a full page, and the Builder's own rows are then",
          "> absent rather than failed. Run it again from a machine with ordinary",
          "> network, or read the workflow's artifact.",
          "",
        ]
      : []),
  ].join("\n");
  const out = path.join(process.cwd(), "docs", "DEPLOY-CHECK.md");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, md);
  console.log(`written to docs/DEPLOY-CHECK.md`);
}

process.exit(failed ? 1 : 0);
