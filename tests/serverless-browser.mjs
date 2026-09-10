/**
 * The browser a serverless function can carry, and the one thing it cannot do.
 *
 * The routes that open the site prefer a full Playwright install and fall to
 * `playwright-core` driving `@sparticuz/chromium` when there is none — which
 * is every serverless host, where a six-hundred-megabyte Chromium will not fit
 * in a function bundle. That pairing opens pages perfectly well and cannot
 * record one: recording is written by an ffmpeg that a full install ships and
 * `playwright-core` does not carry. The code says so and refuses before it
 * launches anything, so this checks the claim rather than trusting it.
 *
 * The pairing is a dependency, and has to be. It was left out of
 * `package.json` once on the grounds that this box already had a browser, and
 * the deployed site then answered `available: false` with "Cannot find module
 * 'playwright-core'" — a host installs what the manifest lists and nothing
 * else. So the first check here is the manifest itself.
 *
 *   node tests/serverless-browser.mjs [url]    # default http://localhost:3000
 */
import { createRequire } from "node:module";
import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const URL = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

// 0. The manifest. A host installs this and nothing else, so a pairing that
// is only in node_modules is a pairing the deployment will not have.
const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
const listed = (name) => !!(pkg.dependencies?.[name] ?? pkg.optionalDependencies?.[name]);
check("package.json lists playwright-core", listed("playwright-core"),
  pkg.dependencies?.["playwright-core"] ?? "missing — the deployment will not install it");
check("package.json lists @sparticuz/chromium", listed("@sparticuz/chromium"),
  pkg.dependencies?.["@sparticuz/chromium"] ?? "missing — the deployment will not install it");

// The routes import these by name; this reaches them the same way.
const outside = createRequire(process.cwd() + "/");
let pw = null;
let chromium = null;
try {
  pw = outside("playwright-core");
  const mod = outside("@sparticuz/chromium");
  chromium = mod.default ?? mod;
} catch (err) {
  check("the pairing is installed here", false, String(err).split("\n")[0].slice(0, 120));
  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed`);
  process.exit(1);
}

// 1. What the server says it can do, which is what the console reads.
try {
  const res = await fetch(`${URL}/api/studio/screenshot`, { cache: "no-store" });
  const data = await res.json();
  check("the server says whether it has a browser and whether it records",
    typeof data.available === "boolean" && typeof data.video === "boolean",
    JSON.stringify(data));
} catch (err) {
  check("the server says whether it has a browser and whether it records", false, String(err).slice(0, 80));
}

// 2. The cut-down Chromium unpacks and opens a page.
const exe = await chromium.executablePath();
check("the packed Chromium unpacks to a binary", typeof exe === "string" && exe.length > 0, exe);
const browser = await pw.chromium.launch({ headless: true, args: chromium.args, executablePath: exe });
try {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 500 } });
  const page = await ctx.newPage();
  await page.goto(`${URL}/builder`, { waitUntil: "networkidle", timeout: 60_000 });
  const shot = await page.screenshot();
  check("it opens the Builder and photographs it", shot.length > 2000, `${shot.length} bytes`);
  await ctx.close();

  /*
   * 3. And cannot record, for the reason the code gives.
   *
   * In a child process, because `playwright-core` reads the browsers path once
   * when it is loaded: setting it here would be setting it far too late. The
   * path is pointed somewhere empty, since this box has a full install's
   * ffmpeg sitting on the real one and a serverless host has nothing of the
   * kind.
   */
  const probe = `
    const { createRequire } = require("node:module");
    const outside = createRequire(process.cwd() + "/");
    const pw = outside("playwright-core");
    const mod = outside("@sparticuz/chromium");
    const chromium = mod.default ?? mod;
    (async () => {
      const b = await pw.chromium.launch({ headless: true, args: chromium.args, executablePath: await chromium.executablePath() });
      try {
        const ctx = await b.newContext({ viewport: { width: 400, height: 300 }, recordVideo: { dir: process.env.VID_DIR, size: { width: 400, height: 300 } } });
        await ctx.newPage();
        await ctx.close();
        console.log("RECORDED");
      } catch (e) { console.log("ERROR " + String(e).split("\\n").slice(0, 3).join(" ")); }
      await b.close().catch(() => {});
    })();
  `;
  const why = await new Promise((resolve) => {
    execFile(process.execPath, ["-e", probe], {
      cwd: process.cwd(),
      env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: mkdtempSync(join(tmpdir(), "no-ffmpeg-")), VID_DIR: mkdtempSync(join(tmpdir(), "vid-")) },
      timeout: 120_000,
    }, (_err, stdout) => resolve(String(stdout)));
  });
  check("it cannot record, and says it is ffmpeg that is missing", /ffmpeg/i.test(why),
    why.trim().split("\n")[0]?.slice(0, 120) || "no output at all, which is the surprise");
} finally {
  await browser.close().catch(() => undefined);
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
