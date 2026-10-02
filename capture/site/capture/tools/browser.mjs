/**
 * The browser the comparison tools drive: the same one capture-route.mjs
 * launches (the full Chromium, through the machine's HTTPS proxy, with any
 * switches `CHROMIUM_ARGS` names), and the argument reading they share.
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";

export async function chromium() {
  const require = createRequire(import.meta.url);
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright", "playwright-core"].filter(Boolean)) {
    try { return require(c).chromium; } catch { /* the next */ }
  }
  throw new Error("no playwright: set PLAYWRIGHT_MODULE");
}

export async function launch() {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const exe = process.env.CHROMIUM ?? "/opt/pw-browsers/chromium";
  return (await chromium()).launch({
    ...(existsSync(exe) ? { executablePath: exe } : {}),
    headless: true,
    ...(process.env.CHROMIUM_ARGS ? { args: process.env.CHROMIUM_ARGS.trim().split(/\s+/) } : {}),
    ...(proxy ? { proxy: { server: proxy, bypass: "localhost,127.0.0.1" } } : {}),
  });
}

/** `--name value` arguments, and bare flags. */
export function args(argv = process.argv.slice(2)) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) { const v = argv[i + 1]; if (v !== undefined && !v.startsWith("--")) { o[a.slice(2)] = v; i++; } else o[a.slice(2)] = true; } else o._.push(a);
  }
  return o;
}
export const list = (v, d) => String(v ?? d).split(",").map((x) => x.trim()).filter(Boolean);
