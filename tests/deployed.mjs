/**
 * The deployment's front door, checked on the deployment.
 *
 * Everything else in this repository is checked against a dev server, which
 * is why a live site could serve a Builder with no bar while every suite
 * stayed green: the thing that was wrong was a redirect, and a redirect is
 * not in the markup. This asks the deployment itself three questions.
 *
 * It speaks HTTP rather than driving a browser, and through `curl`, because
 * that is what can reach outside from here.
 *
 *   node tests/deployed.mjs [url]     # default https://polio-two.vercel.app
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const URL_ = (process.argv[2] ?? "https://polio-two.vercel.app").replace(/\/$/, "");

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/** Status and redirect target, without following it. */
async function head(path) {
  const { stdout } = await run("curl", ["-s", "-o", "/dev/null", "-w", "%{http_code} %{redirect_url}", `${URL_}${path}`], { timeout: 60000 });
  const [code, to = ""] = stdout.trim().split(" ");
  return { code: Number(code), to };
}
async function body(path) {
  const { stdout } = await run("curl", ["-sL", `${URL_}${path}`], { timeout: 60000, maxBuffer: 32 * 1024 * 1024 });
  return stdout;
}

const root = await head("/");
check(
  "the root is the app, not a redirect to the published site",
  root.code < 300 || !/\/site(\/|$)/.test(root.to),
  `${root.code}${root.to ? ` → ${root.to}` : ""}`,
);

const builder = await head("/builder");
check("the Builder answers", builder.code === 200, String(builder.code));

const html = await body("/builder");
const bar = /class="([^"]*bg-panel\/60 px-2 py-1\.5[^"]*)"/.exec(html)?.[1] ?? "";
check("its bar is served laid out, not hidden", /\bflex\b/.test(bar) && !/\bhidden\b/.test(bar), bar || "no bar in the markup");

// Publishing is not broken by any of this: the site is still at /site.
const site = await head("/site");
check("and the published site is still where Publish puts it", site.code === 200, String(site.code));

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed  ·  ${URL_}`);
process.exit(failed.length ? 1 : 0);
