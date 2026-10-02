/**
 * A PAGE THAT SAYS WHEN IT IS READY, waited for.
 *
 * Some pages build themselves after load: PonsStars' preview.html runs its
 * 23 screens in hidden frames and copies each in, and only then sets
 * `data-preview="ready"` on its body. A capture taken at load had one
 * screen's worth of parts. So a page whose `<html>` or `<body>` carries a
 * data attribute that reads as still working (`loading`, `building`,
 * `pending`, `busy`, `starting`), or `aria-busy="true"`, is waited for
 * until none does (any other value, `ready` or `failed`, ends the wait),
 * up to `most` milliseconds.
 *
 * `listValues` is the other half: the values one query field takes across
 * a page's own links and marks (`?screen=<name>` on preview.html), so a
 * list of query-string pages can be asked for as `?screen=*`.
 */

export const BUSY = ["loading", "building", "pending", "busy", "starting", "working"];

/** In the page: the markers still saying "working", as `body data-preview=loading`. */
export const BUSY_MARKS = `(busy) => {
  const out = [];
  for (const el of [document.documentElement, document.body]) {
    if (!el) continue;
    for (const a of Array.from(el.attributes)) {
      const v = a.value.trim().toLowerCase();
      if ((a.name.startsWith("data-") && busy.includes(v)) || (a.name === "aria-busy" && v === "true")) out.push(el.tagName.toLowerCase() + " " + a.name + "=" + a.value);
    }
  }
  return out;
}`;

/** Wait while the page says it is still building. Returns what was waited for and how long, or null when nothing was. */
export async function waitReady(page, { most = 120000, every = 250 } = {}) {
  const marks = () => page.evaluate(`(${BUSY_MARKS})(${JSON.stringify(BUSY)})`).catch(() => []);
  let first = await marks();
  if (!first.length) return null;
  const t0 = Date.now();
  let now = first;
  while (now.length && Date.now() - t0 < most) { await page.waitForTimeout(every); now = await marks(); }
  const secs = Math.round((Date.now() - t0) / 100) / 10;
  return { marks: first, secs, done: !now.length };
}

/** The values a query field takes in a page: in its links' addresses, and in attributes named for it (`data-preview-screen="lobby"`). In page order, once each. */
export const VALUES_OF = `(field) => {
  const out = [];
  const add = (v) => { v = String(v ?? "").trim(); if (v && v !== "*" && !out.includes(v)) out.push(v); };
  for (const a of Array.from(document.querySelectorAll("a[href]"))) {
    let u; try { u = new URL(a.getAttribute("href"), location.href); } catch { continue; }
    if (u.origin === location.origin && u.searchParams.has(field)) add(u.searchParams.get(field));
  }
  const named = new RegExp("^data-(.+-)?" + field.replace(/[^a-z0-9_-]/gi, "") + "$", "i");
  for (const el of Array.from(document.querySelectorAll("*"))) for (const at of Array.from(el.attributes)) if (named.test(at.name)) add(at.value);
  return out;
}`;

/** A query page asked for with `*` (`/preview.html?still=1&screen=*`): the field that takes every value, and the address without it to read them from. */
export function starOf(route) {
  const q = route.indexOf("?");
  if (q < 0) return null;
  const params = new URLSearchParams(route.slice(q + 1));
  const field = [...params.keys()].find((k) => params.get(k) === "*");
  if (!field) return null;
  params.delete(field);
  const rest = params.toString();
  return { field, base: route.slice(0, q) + (rest ? `?${rest}` : "") };
}

/** Every value of `field` across the page at `url`, once it says it is ready. Opens its own browser. */
export async function listValues(url, field, { most = 120000 } = {}) {
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  let chromium = null;
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "playwright-core", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"].filter(Boolean)) {
    try { ({ chromium } = require(c)); break; } catch { /* next */ }
  }
  if (!chromium) throw new Error("No Playwright found.");
  const proxy = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(url) ? null : process.env.HTTPS_PROXY || process.env.https_proxy;
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium",
    headless: true,
    ...(process.env.CHROMIUM_ARGS ? { args: process.env.CHROMIUM_ARGS.trim().split(/\s+/) } : {}),
    ...(proxy ? { proxy: { server: proxy, bypass: "localhost,127.0.0.1" } } : {}),
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(url, { waitUntil: "load" });
    await page.waitForLoadState("networkidle").catch(() => {});
    const waited = await waitReady(page, { most });
    const values = await page.evaluate(`(${VALUES_OF})(${JSON.stringify(field)})`);
    return { values, waited };
  } finally {
    await browser.close();
  }
}
