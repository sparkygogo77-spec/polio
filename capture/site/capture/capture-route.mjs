#!/usr/bin/env node
/**
 * A mechanical dump of one live page, or one state of it.
 *
 * The same shape as `ccc-capture.json`, the dump his page was first taken
 * as: a tree from `body` down, every visible element with its real box,
 * its own words and its computed styles, as the browser reports them.
 * Nothing is inferred. Three things are recorded that the first dump did
 * not have, each a fact of the page and not a reading of it:
 *
 *   faces   the page's `@font-face` rules, read off its stylesheets the
 *           way polio's `siteRead.ts#FACES` reads them, so a face can be
 *           carried one to one instead of named and substituted
 *   d       the geometry of an icon's strokes (a `path`'s own `d`; a
 *           circle, rect, line, polyline, polygon or ellipse written as the
 *           path that draws the same shape), with `fill`, `stroke` and
 *           `sw` as computed, and `vb`, the svg's viewBox
 *   title   a button's or a link's `title` attribute — the words the page
 *           shows for it on hover, when it shows none in the box
 *   role    what the element IS, as the browser's own accessibility tree
 *           computes it (`Accessibility.getFullAXTree`): a search field is
 *           a `searchbox`, a nav is `navigation`, a button is `button`. With
 *           it `name`, the accessible name the tree computed, and `state`,
 *           the states it reports (pressed, expanded, disabled, checked,
 *           selected, current). Nothing is inferred: an element the tree
 *           leaves generic or ignored carries no role.
 *   type    a field's `type`, and `placeholder` its placeholder, as written
 *   sources with `--sources <seconds>`: where each live value comes from
 *           (`sources-recorder.js`, injected before the page's scripts): the
 *           page's fetch, XHR and WebSocket traffic with how often each
 *           repeats and a sample of each answer, secrets stripped, and which
 *           element each answer fed at which JSON path. The page is watched
 *           that many seconds after it settles, so a value that refreshes
 *           is seen refreshing; an element fed carries `feeds`.
 *
 * WHY A WALLET STANDS IN. The sidebar, and every section it leads to, is
 * rendered only when a wallet is connected (`app/page.tsx`: `connected &&
 * <Sidebar/>`). A headless browser has no wallet, so `--wallet` installs a
 * stand-in Phantom provider before the page's scripts run: it answers
 * `connect()` with a fixed public key and signs nothing. The page then
 * shows what it shows any wallet that holds nothing. The key is not his;
 * the address on the wallet button is the stand-in's, and the ledger says
 * so.
 *
 *   behaviours with `--behaviours`: what the page's scripts do to it
 *           (`behaviours-recorder.js`, injected before the page's scripts,
 *           and `behaviours-drive.mjs`, which moves the pointer and the
 *           scroll): a loader, an intro, reveal on scroll, a header that
 *           changes once scrolled, layers that follow the pointer, a
 *           marquee, the loops that run forever. An element named carries
 *           `bh`, ids into the capture's `behaviours` section
 *           (docs/behaviours.md). `--behaviours-shots <dir>` also keeps a
 *           picture of the window at each step.
 *
 *   node capture-route.mjs <url> <out.json> [--wallet] [--agree]
 *        [--click "<words>" [--within <selector>]] [--width 1763 --height 1427]
 *        [--assets <dir>] [--section <id>] [--sources <seconds>]
 *        [--behaviours [--behaviours-shots <dir>] [--no-moving] [--moving-every <ms>] [--moving-seconds <s>] [--moving-most <n>]] [--frames <seconds>]
 *
 * `--click` presses the button holding exactly those words (inside
 * `--within`, when given) and waits for the page to settle, which is how a
 * section of a one-page app is reached. `--assets` downloads every picture
 * the page shows and every font file its faces name into that folder, one
 * file per address (`asset-name.mjs`), for the converter to carry.
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import { DUMP } from "./dump.mjs";
import { assetName } from "./asset-name.mjs";
import { createHash } from "node:crypto";
import { driveBehaviours } from "./behaviours-drive.mjs";
import { WORLD_RECORDER, probeWorlds } from "./worlds.mjs";
import { recordNetwork, guardWrites, keyOfRequest } from "./network.mjs";
import { scanHeld, HIDE_GATE, WRITES, ACCOUNT } from "./held.mjs";
import { PRESS_WATCH, afterPress, holdAfterPress } from "./presses.mjs";
import { readGlides } from "./glide.mjs";
import { waitReady } from "./ready.mjs";
import { SPENDS, WALLET_WORDS } from "./worlds.mjs";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found.");
})();

/* ------------------------------------------------------------------ */
/* Arguments                                                            */
/* ------------------------------------------------------------------ */

const args = process.argv.slice(2);
/** The pointer off the page, and every transition it started run out: what is read after is the page at rest. */
async function restPointer(page) {
  await page.mouse.move(-5, -5).catch(() => {});
  const ms = await page.evaluate(() => {
    let most = 0;
    const secs = (v) => String(v || "").split(",").map((t) => { const n = parseFloat(t); return /ms/.test(t) ? n : n * 1000; });
    for (const el of Array.from(document.querySelectorAll("*")).slice(0, 5000)) {
      const cs = getComputedStyle(el);
      if (cs.transitionProperty === "none" || cs.transitionProperty === "all" && cs.transitionDuration === "0s") continue;
      const d = secs(cs.transitionDuration), w = secs(cs.transitionDelay);
      d.forEach((x, i) => { most = Math.max(most, (x || 0) + (w[i % w.length] || 0)); });
    }
    return most;
  }).catch(() => 600);
  await page.waitForTimeout(Math.min(2000, Math.max(250, ms + 100)));
}

const flag = (name) => args.includes(name);
const opt = (name, d = null) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : d; };
const url = args[0];
const out = args[1];
if (!url || !out || url.startsWith("--")) {
  console.error('usage: node capture-route.mjs <url> <out.json> [--wallet] [--agree] [--click "<words>"] [--within <sel>] [--assets <dir>] [--section <id>] [--sources <seconds>] [--settle <seconds>]');
  process.exit(2);
}
const width = Number(opt("--width", 1763));
const height = Number(opt("--height", 1427));
const assets = opt("--assets");
const click = opt("--click");
const within = opt("--within", "body");
const section = opt("--section");
const watch = opt("--sources") === null ? null : Number(opt("--sources"));
/*
 * THE RUN'S TIME (`--deadline <ms since 1970>`, from capture-site.mjs
 * `--budget`). mochi.trade drew a frame a second on the workflow's machine,
 * and its moving pictures alone took 15 minutes: the run met the workflow's
 * 30 and handed back nothing. Past the deadline the reads that only add
 * (moving pictures, the scroll's own motion, presses, a canvas's frames, a
 * world's characters, the loader's film) are left out or cut short, said on
 * stderr, and the page is still read and written out, so a long page comes
 * back thinner, never not at all.
 */
const deadline = Number(opt("--deadline", 0)) || Infinity;
const late = () => Date.now() > deadline;
const cutShort = new Set();
const leftOut = (what) => { if (cutShort.has(what)) return; cutShort.add(what); console.error(`time: the run's budget is spent: ${what} left out`); };
if (watch !== null && !(watch >= 0)) { console.error("--sources takes the seconds to watch the page for, e.g. --sources 60"); process.exit(2); }

/* ------------------------------------------------------------------ */
/* The stand-in wallet                                                  */
/* ------------------------------------------------------------------ */

/**
 * What `PhantomWalletAdapter` (@solana/wallet-adapter-phantom) asks of the
 * provider it finds at `window.phantom.solana`: `isPhantom`, `connect()`,
 * a `publicKey` with `toBytes()`, and `on()` for disconnect and
 * accountChanged. `walletName` in localStorage is what `autoConnect`
 * reads to pick it without the modal. The key bytes are fixed so every
 * capture shows the same address.
 */
const WALLET = `(() => {
  const bytes = new Uint8Array(32); for (let i = 0; i < 32; i++) bytes[i] = (i * 37 + 11) % 251;
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const b58 = (u8) => { const d = [0]; for (const b of u8) { let c = b; for (let j = 0; j < d.length; j++) { c += d[j] << 8; d[j] = c % 58; c = (c / 58) | 0; } while (c) { d.push(c % 58); c = (c / 58) | 0; } } let s = ""; for (const b of u8) { if (b) break; s += "1"; } for (let j = d.length - 1; j >= 0; j--) s += ALPHABET[d[j]]; return s; };
  const publicKey = { toBytes: () => bytes, toBuffer: () => bytes, toBase58: () => b58(bytes), toString: () => b58(bytes), equals: (o) => o && o.toString() === b58(bytes) };
  const listeners = {};
  const wallet = {
    isPhantom: true, isConnected: false, publicKey: null,
    connect: async () => { wallet.isConnected = true; wallet.publicKey = publicKey; (listeners.connect || []).forEach((f) => f(publicKey)); return { publicKey }; },
    disconnect: async () => { wallet.isConnected = false; wallet.publicKey = null; (listeners.disconnect || []).forEach((f) => f()); },
    on: (e, f) => { (listeners[e] = listeners[e] || []).push(f); }, off: (e, f) => { listeners[e] = (listeners[e] || []).filter((g) => g !== f); },
    removeListener: (e, f) => { listeners[e] = (listeners[e] || []).filter((g) => g !== f); },
    signTransaction: async () => { throw new Error("stand-in wallet signs nothing"); },
    signAllTransactions: async () => { throw new Error("stand-in wallet signs nothing"); },
    signMessage: async () => { throw new Error("stand-in wallet signs nothing"); },
    request: async () => { throw new Error("stand-in wallet answers nothing"); },
  };
  window.phantom = { solana: wallet }; window.solana = wallet;
  try { localStorage.setItem("walletName", JSON.stringify("Phantom")); } catch {}
})();`;

/* ------------------------------------------------------------------ */
/* Drive the page                                                       */
/* ------------------------------------------------------------------ */

/* The full browser, not the headless shell: only the full one reads the machine's own certificate store, and the page is fetched through a proxy that re-terminates TLS. */
/* A page on this machine (a test's own server) is never asked for through the proxy: its bypass list is not honoured for loopback. */
const proxy = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(url) ? null : process.env.HTTPS_PROXY || process.env.https_proxy;
/* Where the time went, said at the end on stderr: each phase in seconds, from the one before it. */
const laps = []; laps.t0 = Date.now(); let lapAt = laps.t0;
const lap = (name) => { const now = Date.now(); laps.push(`${name} ${((now - lapAt) / 1000).toFixed(1)}`); lapAt = now; };
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium",
  headless: true,
  /* Switches for this machine's browser, when it needs one (a proxy's own certificate key, pinned with --ignore-certificate-errors-spki-list): none by default. */
  ...(process.env.CHROMIUM_ARGS ? { args: process.env.CHROMIUM_ARGS.trim().split(/\s+/) } : {}),
  /* Playwright does not read HTTPS_PROXY; the browser is told the same proxy every other tool here goes out through. */
  ...(proxy ? { proxy: { server: proxy, bypass: "localhost,127.0.0.1" } } : {}),
});
const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
if (flag("--wallet")) await context.addInitScript(WALLET);
if (watch !== null) await context.addInitScript(readFileSync(new URL("./sources-recorder.js", import.meta.url), "utf8"));
const behaviours = flag("--behaviours");
const shotsDir = opt("--behaviours-shots");
if (behaviours) await context.addInitScript(readFileSync(new URL("./behaviours-recorder.js", import.meta.url), "utf8"));
/* A canvas world's characters and what each opens (worlds.mjs): its frames can be held and its sprites are written down as drawn. Off with `--no-worlds` or `--frames 0`. */
const worldsOn = !flag("--no-worlds") && Number(opt("--frames", 3)) > 0;
if (worldsOn) await context.addInitScript(WORLD_RECORDER);
/* A long or endless list keeps a little more than one window of its items, on every load (list-trim.js), unless `--keep-lists`. */
if (!flag("--keep-lists")) await context.addInitScript(readFileSync(new URL("./list-trim.js", import.meta.url), "utf8"));
/* What a press did besides changing the page: a navigation by script, a window, a copy (presses.mjs), for the states pass. */
if (flag("--states")) await context.addInitScript(PRESS_WATCH);
const page = await context.newPage();
/* Every data request the page makes on its own (network.mjs), with `--network`: the API map and its samples. */
const net = flag("--network") ? recordNetwork(page) : null;
await net?.ready;
/* A page that marks itself as still building (`body data-preview="loading"`, ready.mjs) is waited for on every settle, up to `--ready` seconds. */
const readyFor = Number(opt("--ready", 120)) * 1000;
/*
 * A page that keeps an EventSource open never goes idle by Playwright's
 * count, so every settle waited its whole 30 s: once one is seen, the wait
 * is for the page's own requests instead (none in flight for half a second,
 * websockets and the feed left out), up to 10 s.
 */
let feedSeen = false;
const inFlightNow = new Set();
page.on("request", (r) => { const t = r.resourceType(); if (t === "eventsource") feedSeen = true; if (!["websocket", "eventsource"].includes(t)) inFlightNow.add(r); });
page.on("requestfinished", (r) => inFlightNow.delete(r)); page.on("requestfailed", (r) => inFlightNow.delete(r));
const quiet = async (most = 10000) => {
  const t0 = Date.now();
  for (let still = 0; still < 500 && Date.now() - t0 < most; ) { await page.waitForTimeout(100); still = inFlightNow.size ? 0 : still + 100; }
};
const settle = async (ms = 1200) => {
  if (feedSeen) await quiet(); else await page.waitForLoadState("networkidle").catch(() => {});
  const waited = await waitReady(page, { most: readyFor });
  if (waited) console.error(`ready: waited ${waited.secs} s for ${waited.marks.join(", ")}${waited.done ? "" : ", and it never said ready"}`);
  await page.waitForTimeout(ms);
};
/*
 * WHAT WAS CUT ON THE WAY IN. Through a proxy a transfer is sometimes cut
 * mid-way (net::ERR_ABORTED): share.xyz, loaded three times, lost one or two
 * of its sixty stylesheets or a face file each time, and a capture of it was
 * of a page in the browser's default blue links and serif words. So every
 * stylesheet, face, picture and script that failed is noted; a failed script
 * reloads the page (up to three times), and a failed stylesheet, face or
 * picture is asked for again in place (up to four rounds) before anything
 * is measured. What still fails is said on stderr and kept in the capture
 * as `missing`.
 */
const failedReq = new Map();
page.on("requestfailed", (r) => { const t = r.resourceType(); if (["document", "stylesheet", "font", "image", "script"].includes(t) && (t !== "document" || r.frame() === page.mainFrame())) failedReq.set(r.url(), t); });
page.on("requestfinished", (r) => failedReq.delete(r.url()));
/* The page itself cut, or a script of it: the page is loaded again. */
const reloads = () => [...failedReq.values()].some((t) => t === "script" || t === "document");
const opened = await page.goto(url, { waitUntil: "load" }).catch((e) => { failedReq.set(url, "document"); console.error(`${url}: ${e.message.split("\n")[0]}`); return null; });
if (opened && !opened.ok()) failedReq.set(url, "document");
const shot = async (name) => { mkdirSync(shotsDir, { recursive: true }); await page.screenshot({ path: join(shotsDir, `${name}.jpg`), type: "jpeg", quality: 72 }); };
if (behaviours && shotsDir) { await page.waitForTimeout(700); await shot("loader"); }
await settle();
lap("load");
/*
 * A TERMS GATE (`--agree`): a dialog over everything with a box to tick
 * ("I have read and agree…") and an Accept that waits for it, as
 * stonkfun.xyz opens. Only a modal dialog is touched, only a box whose
 * words agree to something is ticked, and only a button that agrees is
 * pressed, never a Decline. It goes before the behaviours are read: a
 * gate locks the page's scrolling. Pressed again after a reload.
 */
const agreeGate = async () => {
  /*
   * `--hide-gate`: nothing is ticked or pressed (the owner's rule for his
   * sites: "don't accept it for me, just hide it"). The dialog, and the
   * full-window veil it sits in, are hidden in this browser only; the page's
   * scroll lock and the inert it put on the rest are lifted, so the page is
   * read as it stands behind the gate (check-gates.mjs (3)).
   */
  if (flag("--hide-gate")) {
    await page.evaluate(HIDE_GATE);
    await settle(300);
    return;
  }
  if (!flag("--agree")) return;
  for (let round = 0; round < 3; round++) {
    const dialog = page.locator('[role="dialog"], [role="alertdialog"], [aria-modal="true"], dialog[open]').filter({ hasText: /terms|agree|disclaimer|consent|conditions/i }).first();
    if (!(await dialog.count()) || !(await dialog.isVisible().catch(() => false))) return;
    const boxes = dialog.getByRole("checkbox", { name: /agree|accept|read|understand|confirm/i });
    for (let i = 0; i < (await boxes.count()); i++) await boxes.nth(i).check({ timeout: 2000 }).catch(() => boxes.nth(i).click({ timeout: 2000 }).catch(() => {}));
    const yes = dialog.getByRole("button", { name: /^\s*(i\s+)?(accept|agree|continue|got it|ok|enter)\b/i }).filter({ hasNotText: /decline|reject|cancel/i });
    if (!(await yes.count())) return;
    await yes.last().click({ timeout: 3000 }).catch(() => {});
    await settle(600);
  }
};
await agreeGate();
for (let i = 0; i < 3 && reloads(); i++) {
  console.error(`cut on the way in (${[...failedReq].filter(([, t]) => t === "script" || t === "document").map(([u, t]) => `${t} ${u}`).join(", ")}); loading the page again`);
  failedReq.clear();
  const again = await page.goto(url, { waitUntil: "load" }).catch(() => null);
  if (!again || !again.ok()) failedReq.set(url, "document");
  await settle();
  await agreeGate();
}
for (let i = 0; i < 4 && [...failedReq.values()].some((t) => t !== "script" && t !== "document"); i++) {
  await page.evaluate(async (failed) => {
    const want = new Map(failed);
    const waits = [];
    for (const l of Array.from(document.querySelectorAll('link[rel~="stylesheet"]'))) {
      if (want.get(l.href) !== "stylesheet") continue;
      const again = l.cloneNode();
      waits.push(new Promise((ok) => { again.onload = () => { l.remove(); ok(); }; again.onerror = () => { again.remove(); ok(); }; }));
      l.after(again);
    }
    const rules = [];
    const gather = (list) => { for (const r of Array.from(list)) { if (r instanceof CSSFontFaceRule) rules.push(r); else if (r.cssRules) gather(r.cssRules); } };
    for (const sheet of Array.from(document.styleSheets)) { try { gather(sheet.cssRules); } catch { /* cross-origin */ } }
    for (const r of rules) {
      for (const m of r.style.getPropertyValue("src").matchAll(/url\((["']?)([^)"']+)\1\)/g)) {
        const u = new URL(m[2], r.parentStyleSheet?.href ?? location.href).href;
        if (want.get(u) !== "font") continue;
        const face = new FontFace(r.style.getPropertyValue("font-family").trim().replace(/^["']|["']$/g, ""), `url("${u}")`, { weight: r.style.getPropertyValue("font-weight") || "normal", style: r.style.getPropertyValue("font-style") || "normal", unicodeRange: r.style.getPropertyValue("unicode-range") || "U+0-10FFFF" });
        document.fonts.add(face);
        waits.push(face.load().catch(() => {}));
      }
    }
    for (const img of Array.from(document.images)) {
      if (want.get(img.currentSrc || img.src) !== "image") continue;
      const src = img.getAttribute("src"), set = img.getAttribute("srcset");
      waits.push(new Promise((ok) => { img.addEventListener("load", ok, { once: true }); img.addEventListener("error", ok, { once: true }); }));
      if (set) { img.removeAttribute("srcset"); img.setAttribute("srcset", set); }
      if (src) { img.removeAttribute("src"); img.setAttribute("src", src); }
    }
    await Promise.race([Promise.all(waits), new Promise((ok) => setTimeout(ok, 15000))]);
  }, [...failedReq]);
  await settle(600);
}
/*
 * A PAGE ITS SCRIPT BUILDS AFTER LOAD. The PonsStars design preview builds
 * its thirteen screens one after another over about five seconds, a status
 * line saying "Building …" the while; read once the network had gone quiet,
 * the capture had its first screen (1888px of about 30,800). So the page is
 * read only once it stops changing: no element added or taken out and no
 * change of its height for `--built-quiet` seconds (1.5), no request in
 * flight, at most `--built` seconds (30). How long it took is said, and kept
 * as `built` (check-script-built.mjs (1)). Words that change in place (a
 * clock, a price) are not building: a page that ticks is not waited for.
 */
const builtMost = Number(opt("--built", 30)) * 1000, builtQuiet = Number(opt("--built-quiet", 1.5)) * 1000;
let built = null;
{
  const t0 = Date.now();
  const inFlight = new Set();
  const onReq = (r) => { if (!["websocket", "eventsource"].includes(r.resourceType())) inFlight.add(r); };
  const onDone = (r) => inFlight.delete(r);
  page.on("request", onReq); page.on("requestfinished", onDone); page.on("requestfailed", onDone);
  const h0 = await page.evaluate(() => {
    const w = (window.__sinkBuilt = { changes: 0, last: performance.now(), height: document.documentElement.scrollHeight });
    const els = (list) => Array.from(list).some((n) => n.nodeType === 1);
    new MutationObserver((ms) => { if (ms.some((m) => els(m.addedNodes) || els(m.removedNodes))) { w.changes++; w.last = performance.now(); } }).observe(document.documentElement, { childList: true, subtree: true });
    return w.height;
  }).catch(() => null);
  let quietNet = Date.now(), settled = false, read = null;
  while (h0 !== null && Date.now() - t0 < builtMost) {
    await page.waitForTimeout(250);
    read = await page.evaluate(() => {
      const w = window.__sinkBuilt, h = document.documentElement.scrollHeight;
      if (h !== w.height) { w.height = h; w.changes++; w.last = performance.now(); }
      return { still: performance.now() - w.last, changes: w.changes, height: h };
    }).catch(() => null);
    if (!read) break;
    if (inFlight.size) quietNet = Date.now();
    if (read.still >= builtQuiet && Date.now() - quietNet >= 500) { settled = true; break; }
  }
  page.off("request", onReq); page.off("requestfinished", onDone); page.off("requestfailed", onDone);
  built = { waited: Date.now() - t0, settled, changes: read?.changes ?? 0, height: [h0, read?.height ?? h0] };
  console.error(`built: waited ${(built.waited / 1000).toFixed(1)} s for the page to stop changing${settled ? "" : ` (still changing at ${builtMost / 1000} s; read as it stood)`}: ${built.changes} change${built.changes === 1 ? "" : "s"}, height ${built.height[0]} -> ${built.height[1]} px`);
}
/* Loaded: what it asks for from here on is the page standing open. */
net?.phase("open");
/*
 * An artistic page is not settled when the network is: its web fonts may
 * still be arriving, a loader may stand over it until they have, and its
 * sections may be hidden until scrolled to (reveal-on-scroll). So: wait
 * for the fonts; wait, up to `--settle` seconds (default 12), for any
 * fixed element covering the window to be gone or to have stopped
 * animating; then scroll through the whole page once, so every
 * IntersectionObserver has fired, and come back to the top.
 */
const settleFor = Number(opt("--settle", 12)) * 1000;
/*
 * A fetch through a proxy is sometimes cut mid-transfer; each address is asked
 * for up to three times, a moment apart, before it is given up. An answer that
 * is definite (a 404, a 410, a 401: the file is not there to be had) is given
 * up at once; the proxy's own passing codes (403, 407, 429) are asked again.
 */
const fetchBytes = async (address) => {
  for (let i = 0; i < 3; i++) {
    const res = await context.request.get(address, { timeout: 30000 }).catch(() => null);
    if (res && res.ok()) { try { return await res.body(); } catch { /* cut mid-transfer */ } }
    if (res && res.status() >= 400 && res.status() < 500 && ![403, 407, 429].includes(res.status())) return null;
    await new Promise((r) => setTimeout(r, 500 * (i + 1)));
  }
  return null;
};
await page.evaluate(() => document.fonts?.ready).catch(() => {});
/*
 * A LOADER, WAITED OUT. A fixed element over the whole window that is
 * still animating; or one that is on top of the page (what is under the
 * window's middle and two other points) and holds no control and few
 * words, whatever it does: a spinner that loops forever until the data has
 * come (stonkfun.xyz's home was read behind one). A terms gate holds
 * buttons and is not one; it is hidden, never agreed to (--hide-gate).
 * Waited for on every load, up to `--settle` seconds.
 */
async function waitLoader(most = settleFor) {
  const t0 = Date.now();
  const covering = () => page.evaluate(() => {
    const W = innerWidth, H = innerHeight;
    return Array.from(document.body.querySelectorAll("*")).some((el) => {
      const cs = getComputedStyle(el);
      if (cs.position !== "fixed" || cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) < 0.05 || el.closest("[data-sink-gate]")) return false;
      const r = el.getBoundingClientRect();
      if (r.width < W * 0.9 || r.height < H * 0.9) return false;
      /* Covering, and still doing something: an animation or transition of its own, or a descendant's. */
      const busy = (x) => (x.getAnimations?.({ subtree: true }) ?? []).some((a) => a.playState === "running" && !(a.effect?.getTiming?.().iterations === Infinity && a.timeline?.currentTime > 2000));
      if (busy(el)) return true;
      /* On top, with nothing to press and little to read: a loader, however long it spins. */
      if (el.querySelector('button, a[href], input, select, textarea, [role="button"], [role="dialog"]') || (el.textContent ?? "").trim().length > 120) return false;
      return [[0.5, 0.5], [0.3, 0.3], [0.7, 0.7]].every(([fx, fy]) => { const hit = document.elementFromPoint(W * fx, H * fy); return !!hit && el.contains(hit); });
    });
  }).catch(() => false);
  let waited = false;
  while (Date.now() - t0 < most && (await covering())) { waited = true; await page.waitForTimeout(250); }
  if (waited) console.error(`loader: waited ${Math.round((Date.now() - t0) / 100) / 10} s for it to go`);
  return waited;
}
await waitLoader();
await page.waitForTimeout(400);
lap("built+loader");
/*
 * A STILL SCREEN, RECORDED ONCE. A page that says it is held still (its
 * <html> or <body> marked `data-preview-still`, or asked for with
 * `?still=1`: PonsStars' preview screens) is one fixed state of a design:
 * nothing it does moves and no press shows anything the screen list does
 * not show as a screen of its own. So it is read once, with no behaviours
 * driven and nothing pressed (the states pass, each press of which could
 * cost a page load).
 */
const still = await page.evaluate(() => [document.documentElement, document.body].some((el) => el?.hasAttribute("data-preview-still") || el?.hasAttribute("data-still")) || new URLSearchParams(location.search).get("still") === "1").catch(() => false);
if (still && (behaviours || flag("--states"))) console.error("still: a still screen, read once: no behaviours driven, nothing pressed");
/* What the page's scripts do, measured before the pass below scrolls the page for everything else. */
/* Pictures of what moves (frames-drive.mjs), with the behaviours: `--no-moving` leaves them out; `--moving-every <ms>`, `--moving-seconds <s>`, `--moving-most <n>` set the pace, the window and the budget. A 2d canvas the canvas pass reads itself is left to it. */
const moving = flag("--no-moving") ? null : { every: Number(opt("--moving-every", 100)), seconds: Number(opt("--moving-seconds", 3.2)), most: Number(opt("--moving-most", 16)), skip2d: Number(opt("--frames", 3)) > 0 };
const behaved = behaviours && !still ? await driveBehaviours(page, { shots: shotsDir, shot, frames: moving, late, leftOut, heavyMs: Number(opt("--heavy-ms", 250)) }) : null;
/* How its in-page links take a visitor to their places: a glide by its script or its stylesheet, or a jump (glide.mjs). */
if (behaved) behaved.glide = await readGlides(page);
lap("behaviours");
/*
 * On the way down, every element with no box at the top (a progress fill a
 * script grows with the scroll, width 0 until then) is looked at again at
 * each step, and the largest box it was seen at is kept for the dump
 * (`window.__sinkGrown`): an element the page draws once it is scrolled to
 * is not dropped because the dump is taken at the top.
 */
await page.evaluate(async () => {
  const empty = Array.from(document.body.querySelectorAll("*")).filter((el) => {
    if (el instanceof SVGElement && el.tagName.toLowerCase() !== "svg") return false;
    const r = el.getBoundingClientRect();
    return !(r.width > 0 && r.height > 0) && getComputedStyle(el).display !== "none";
  });
  const grown = new Map();
  /*
   * The box it had when it was settled in view, not the largest it ever
   * grew to: trumpmorty's timeline fill runs 0 → 100% as the page passes,
   * and with its roadmap in the window it stood near three quarters. Its
   * frame is the nearest holder between a third of a window and a window
   * tall (the roadmap round a 14px line), and the box kept is the one seen
   * with that frame's middle nearest the window's.
   */
  const frameOf = (el) => { for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) { const h = n.offsetHeight; if (h >= innerHeight / 3 && h <= innerHeight) return n; } return el; };
  const frames = new Map(empty.map((el) => [el, frameOf(el)]));
  const look = () => {
    for (const el of empty) {
      const r = el.getBoundingClientRect();
      if (!(r.width > 0 && r.height > 0)) continue;
      const f = frames.get(el).getBoundingClientRect();
      const off = Math.abs(f.top + f.height / 2 - innerHeight / 2);
      const g = grown.get(el);
      if (!g || off < g.off) grown.set(el, { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height, off });
    }
  };
  const h = document.documentElement.scrollHeight;
  const frame = () => new Promise((r) => setTimeout(() => requestAnimationFrame(() => r()), 60));
  for (let y = 0; y < h; y += Math.max(100, innerHeight / 6)) { scrollTo(0, y); await frame(); look(); }
  scrollTo(0, h); await frame(); await frame(); look();
  /*
   * A line the page grows with the scroll (motion-drive.mjs, `scrollGrow`)
   * is kept as drawn with its section in view, as above; how much of its
   * holder that is is said beside it (`kept`, per cent), so polio can draw
   * it whole and show as much as the scroll has reached.
   */
  window.__sinkScrollKept = (window.__sinkScrollGrow ?? []).map(({ el, prop }) => {
    const p = el.parentElement, cs = getComputedStyle(p), g = grown.get(el);
    const inner = prop === "width" ? p.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) : p.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const at = g ? (prop === "width" ? g.w : g.h) : prop === "width" ? el.getBoundingClientRect().width : el.getBoundingClientRect().height;
    return { id: window.__sinkBehaviours.idOf(el), kept: inner > 0 ? Math.round(at / inner * 1000) / 10 : null };
  });
  window.__sinkGrown = grown;
  scrollTo(0, 0);
});
await page.waitForTimeout(1200);
if (behaved?.motion?.scrollGrow?.length) {
lap("scroll");
  const kept = await page.evaluate(() => window.__sinkScrollKept ?? []);
  for (const g of behaved.motion.scrollGrow) { const k = kept.find((q) => q.id === g.el); if (k && k.kept !== null) g.kept = k.kept; }
}

/* The disclaimer stands over everything until it is agreed to; the first capture was taken after it. */
if (flag("--agree")) {
  const agree = page.getByRole("button", { name: "AGREE AND CLOSE" });
  if (await agree.count()) { await agree.first().click(); await settle(400); }
}
/* The wallet modal opens itself half a second after load when nothing is connected; with the stand-in it should not, and if it did it is closed. */
if (flag("--wallet")) {
  /* The sidebar is the root site's (routes.json, --section / --click): another site is not made to wait 25 s for an <aside> it has not got. */
  const sidebar = !!(section || click);
  for (let i = 0; i < (sidebar ? 20 : 2); i++) {
    const modal = page.locator(".wallet-adapter-modal-wrapper, .wallet-adapter-modal");
    if (await modal.count()) { await page.keyboard.press("Escape"); await page.waitForTimeout(300); }
    if (sidebar && await page.locator("aside").count()) break;
    await page.waitForTimeout(500);
  }
  /* "Processing items..." holds the sidebar back for three seconds after connecting. */
  if (sidebar) await page.waitForSelector("aside", { timeout: 15000 }).catch(() => {});
  await settle(500);
}
if (click) {
  const target = page.locator(within).getByRole("button", { name: click, exact: true });
  if (!(await target.count())) { console.error(`no button reading "${click}" inside ${within}`); await browser.close(); process.exit(1); }
  await target.first().click();
  /* A section not yet opened shows "Processing items..." for a second before it lands. */
  await page.waitForTimeout(1500);
  await settle(800);
}
/*
 * A CANVAS THAT REPAINTS. gotchi.gg's device screen is a 48×36 canvas its
 * script repaints (the pet asleep, its Zzz rising); read once, it is one
 * frame of it. Each canvas is brought into the window (a page may stop
 * drawing what is off screen) and its pixels read every `--frames-every` ms
 * for `--frames` seconds (default 3; 0 reads none). A canvas that showed
 * more than one picture keeps them all, each once, and the order and time
 * each stood (`frames`, read by dump.mjs), for the converter to play back.
 */
const frameSecs = Number(opt("--frames", 3));
const frameEvery = Math.max(40, Number(opt("--frames-every", 100)));
/* Every canvas in view of `near` (a band of the page, or all of it), brought into the window a band at a time and read for `seconds`. */
const sampleFrames = async (seconds, near = null) => {
  const canvases = await page.evaluate((near) => {
    window.__sinkFrames = {};
    return Array.from(document.querySelectorAll("canvas")).map((c, i) => {
      const r = c.getBoundingClientRect();
      if (!(c.width && c.height && c.width * c.height <= 1_000_000 && r.width > 0 && r.height > 0)) return null;
      const y = r.top + scrollY;
      if (near && (y + r.height < near.y - innerHeight || y > near.y + near.h + innerHeight)) return null;
      c.dataset.sinkCanvas = String(i);
      return { i, y, h: r.height };
    }).filter(Boolean).sort((a, b) => a.y - b.y);
  }, near);
  const view = height;
  while (canvases.length) {
    const top = Math.max(0, canvases[0].y - 40);
    const here = canvases.filter((c) => c.y >= top && c.y + c.h <= top + view);
    const take = here.length ? here : [canvases[0]];
    for (const c of take) canvases.splice(canvases.indexOf(c), 1);
    await page.evaluate((y) => scrollTo(0, y), top);
    await page.waitForTimeout(300);
    await page.evaluate(async ({ ids, ms, every }) => {
      const els = ids.map((i) => document.querySelector(`canvas[data-sink-canvas="${i}"]`));
      const seen = els.map(() => ({ frames: [], index: new Map(), steps: [], bytes: 0, spoilt: false }));
      const t0 = performance.now();
      let last = t0;
      while (performance.now() - t0 < ms) {
        const now = performance.now();
        els.forEach((el, k) => {
          const s = seen[k];
          if (!el || s.spoilt) return;
          let url;
          try { url = el.toDataURL("image/png"); } catch { s.spoilt = true; return; }
          let at = s.index.get(url);
          if (at === undefined) {
            /* A hard stop well past what is kept: the thinning below brings it to the budget. */
            if (s.frames.length >= 200 || s.bytes + url.length > 40_000_000) { s.spoilt = true; return; }
            at = s.frames.length; s.frames.push(url); s.index.set(url, at); s.bytes += url.length;
          }
          const prev = s.steps[s.steps.length - 1];
          if (prev && prev[0] === at) prev[1] += now - last; else s.steps.push([at, now - last]);
        });
        last = now;
        await new Promise((r) => setTimeout(r, every));
      }
      ids.forEach((i, k) => {
        const s = seen[k];
        if (s.spoilt || s.frames.length < 2) return;
        /* The first step's time is the wait before the first read: it stands as long as the reads after it do. */
        s.steps[0][1] = Math.max(s.steps[0][1], every);
        /*
         * OVER THE BUDGET (48 pictures, 3 MB): a big scene repainted every frame
         * (parasiteonsol.fun's hero, ~120 KB a picture) is thinned, not dropped.
         * Every n-th new picture is kept, and each step shows the kept picture
         * last seen at or before it, so the time watched is still all played.
         */
        const n = Math.max(1, Math.ceil(Math.max(s.frames.length / 48, s.bytes / 3_000_000)));
        if (n > 1) {
          const keep = s.frames.map((_, i) => i).filter((i) => i % n === 0);
          const to = new Map(keep.map((i, k) => [i, k]));
          const steps = [];
          for (const [f, d] of s.steps) {
            const k = to.get(f - (f % n));
            const prev = steps[steps.length - 1];
            if (prev && prev[0] === k) prev[1] += d; else steps.push([k, d]);
          }
          s.frames = keep.map((i) => s.frames[i]);
          s.steps = steps;
          if (s.frames.length < 2) return;
        }
        window.__sinkFrames[i] = { frames: s.frames, steps: s.steps.map(([f, d]) => [f, Math.round(d)]), every, ms };
      });
    }, { ids: take.map((c) => c.i), ms: seconds * 1000, every: frameEvery });
  }
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(300);
};
if (frameSecs > 0) { if (late()) leftOut("a canvas's frames"); else await sampleFrames(frameSecs); }
/*
 * A CANVAS THAT FOLLOWS THE SCROLL (J, 2026-10-11, sunkcoin.fun). The sea is
 * a fixed canvas under the whole page whose camera is the scroll (`cam =
 * scrollY`): read once at the top it was the surface, and the deep water
 * below the first screen was never seen. Its minimap, fixed at the right,
 * draws a window where the scroll is: read once it was a still, not the
 * scroll bar J pressed. Every canvas pinned to the window is read again at
 * each depth of the page (every half window, `--depths-every`, at most
 * `--depths` stills), and kept as `depths` (dump.mjs) when what it shows
 * changes with the scroll by more than it changes on its own: the
 * converter lays the stills in one strip, the Builder shows the one for
 * where the scroll is (`scroll-depths`). `check-depths.mjs`.
 */
const depthsMax = Math.max(0, Number(opt("--depths", 48)));
const depthsEvery = Math.max(100, Number(opt("--depths-every", Math.round(height / 2))));
const sampleDepths = async () => {
  const pinned = await page.evaluate(() => Array.from(document.querySelectorAll("canvas")).map((c, i) => {
    const r = c.getBoundingClientRect();
    if (!(c.width && c.height && c.width * c.height <= 4_000_000 && r.width > 0 && r.height > 0)) return null;
    let fixed = false;
    for (let n = c; n && n !== document.body; n = n.parentElement) if (getComputedStyle(n).position === "fixed") { fixed = true; break; }
    if (!fixed) return null;
    c.dataset.sinkCanvas = String(i);
    return i;
  }).filter((i) => i !== null));
  if (!pinned.length) return;
  const pageH = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight));
  const range = Math.max(0, pageH - height);
  if (range < depthsEvery) return;
  const steps = Math.min(depthsMax, Math.floor(range / depthsEvery) + 1);
  if (steps < 2) return;
  const at = Array.from({ length: steps }, (_, k) => Math.round((range * k) / (steps - 1)));
  const read = () => page.evaluate((ids) => ids.map((i) => { const el = document.querySelector(`canvas[data-sink-canvas="${i}"]`); try { return el ? el.toDataURL("image/png") : null; } catch { return null; } }), pinned);
  /* How much a canvas changes on its own, read twice at the top: the measure a depth has to beat. */
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(250);
  const first = await read();
  await page.waitForTimeout(250);
  const again = await read();
  const stills = pinned.map(() => []);
  for (const y of at) {
    await page.evaluate((y) => scrollTo(0, y), y);
    await page.waitForTimeout(250);
    const urls = await read();
    urls.forEach((u, k) => { if (u) stills[k].push([y, u]); });
  }
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(250);
  /*
   * How two pictures differ, read at 128px on the long side (a minimap 25
   * wide and 393 tall squashed to 48 × 48 lost the window it draws): the
   * mean difference per pixel (0 to 255), the share of pixels that changed
   * outright (the minimap's window, moved: few pixels, all of them), and
   * the shift of the average colour (the sea, darker with depth).
   */
  const differ = (a, b) => page.evaluate(async ([a, b]) => {
    const load = (u) => new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = no; im.src = u; });
    const [ia, ib] = await Promise.all([load(a), load(b)]);
    const s = 128 / Math.max(1, ia.naturalWidth, ia.naturalHeight);
    const W = Math.max(1, Math.round(ia.naturalWidth * s)), H = Math.max(1, Math.round(ia.naturalHeight * s));
    const px = (im) => { const c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d"); g.imageSmoothingEnabled = true; g.drawImage(im, 0, 0, W, H); return g.getImageData(0, 0, W, H).data; };
    const pa = px(ia), pb = px(ib), n = pa.length / 4;
    let sum = 0, big = 0; const ma = [0, 0, 0], mb = [0, 0, 0];
    for (let i = 0; i < pa.length; i += 4) { let d = 0; for (let c = 0; c < 3; c++) { d += Math.abs(pa[i + c] - pb[i + c]); ma[c] += pa[i + c]; mb[c] += pb[i + c]; } sum += d; if (d > 96) big++; }
    return { mean: sum / n / 3, frac: big / n, shift: (Math.abs(ma[0] - mb[0]) + Math.abs(ma[1] - mb[1]) + Math.abs(ma[2] - mb[2])) / n / 3 };
  }, [a, b]);
  /* Changed by the scroll: more than it changes on its own at rest, by any of the three measures. */
  const beats = (deep, noise) => deep.mean > noise.mean * 1.5 + 1 || deep.frac > noise.frac * 1.5 + 0.01 || deep.shift > noise.shift * 1.5 + 1.5;
  const fmt = (d) => `${d.mean.toFixed(1)} mean, ${(d.frac * 100).toFixed(1)}% changed, ${d.shift.toFixed(1)} shift`;
  const kept = {};
  for (let k = 0; k < pinned.length; k++) {
    const list = stills[k];
    if (list.length < 2 || !first[k] || !again[k]) continue;
    const noise = await differ(first[k], again[k]);
    /* The depth least like the top: a minimap's window can stand where it stood at the top again at the foot. */
    let deep = null;
    for (const [, u] of list.slice(1)) { const d = await differ(list[0][1], u); if (!deep || d.mean + d.frac * 100 + d.shift > deep.mean + deep.frac * 100 + deep.shift) deep = d; }
    const moved = list.some(([, u]) => u !== list[0][1]);
    if (!moved || !deep || !beats(deep, noise)) { console.error(`depths: canvas ${pinned[k]} is the same at every depth (${deep ? fmt(deep) : "no change"} at most; ${fmt(noise)} on its own); read once`); continue; }
    /*
     * OVER THE BUDGET (3 MB of stills): every n-th depth is kept, the top and
     * the foot always, so the strip still reaches the page's end.
     */
    const bytes = list.reduce((n, [, u]) => n + u.length, 0);
    const n = Math.max(1, Math.ceil(bytes / 3_000_000));
    const chosen = n > 1 ? list.filter((_, i) => i % n === 0 || i === list.length - 1) : list;
    kept[pinned[k]] = { at: chosen.map(([y]) => y), stills: chosen.map(([, u]) => u), view: height, page: pageH, every: depthsEvery };
    console.error(`depths: canvas ${pinned[k]} follows the scroll (${fmt(deep)} at most; ${fmt(noise)} on its own): ${chosen.length} of ${list.length} depths kept, every ${depthsEvery}px${n > 1 ? `, thinned ${n}× to the budget` : ""}`);
  }
  await page.evaluate((kept) => { window.__sinkDepths = kept; }, kept);
};
if (frameSecs > 0 && depthsMax > 0) { if (late()) leftOut("a canvas's depths"); else await sampleDepths(); }
/*
 * A CANVAS WORLD (worlds.mjs): a canvas seen repainting whose sprites open
 * something when pressed. Its frames are read again, held still one by one,
 * with where each character stands in each and the dialog it opens; the
 * flipbook becomes those frames, so the places and the pictures agree.
 */
if (worldsOn && frameSecs > 0 && late()) leftOut("a canvas world's characters");
else if (worldsOn && frameSecs > 0) {
  const n = await probeWorlds(page, { frames: Number(opt("--world-frames", 15)), every: Number(opt("--world-every", 200)), log: (s) => console.error(s) });
  if (n) console.error(`worlds: ${n} canvas${n === 1 ? "" : "es"} with characters to press`);
}
/* Watched as it stands, long enough for a value that refreshes to be seen refreshing. */
if (watch) await page.waitForTimeout(watch * 1000);
await page.evaluate(() => scrollTo(0, 0));
await page.waitForTimeout(200);
lap("frames+worlds");

/*
 * What each element is, by the browser's own accessibility tree, written
 * onto the element as data attributes for the dump to read. The tree is
 * the browser's computation, not a reading of tags: a `div` with
 * role="search" is a search landmark, an `input type="search"` is a
 * searchbox, a `button` is a button. Generic and ignored nodes are left
 * unmarked, so an element with no role in the tree has none here.
 */
const STATES = new Set(["pressed", "expanded", "disabled", "checked", "selected", "current", "required", "invalid", "readonly", "modal", "hidden"]);
const markRoles = async () => {
/* Marks from an earlier read on the same page (a press undone in place) would stay on an element whose state is gone: swept first. */
await page.evaluate(() => { for (const el of document.querySelectorAll("[data-ax-role],[data-ax-name],[data-ax-state]")) { delete el.dataset.axRole; delete el.dataset.axName; delete el.dataset.axState; } }).catch(() => {});
const cdp = await context.newCDPSession(page);
await cdp.send("DOM.enable");
await cdp.send("Accessibility.enable");
const { nodes: ax } = await cdp.send("Accessibility.getFullAXTree");
const marks = [];
for (const n of ax) {
  if (n.ignored || !n.backendDOMNodeId) continue;
  const role = n.role?.value;
  if (!role || role === "generic" || role === "none" || role === "presentation" || role === "StaticText" || role === "InlineTextBox") continue;
  const name = n.name?.value ?? "";
  const state = {};
  for (const p of n.properties ?? []) if (STATES.has(p.name) && p.value?.value !== undefined && p.value.value !== false && p.value.value !== "false") state[p.name] = p.value.value;
  marks.push({ id: n.backendDOMNodeId, role, name, state: Object.keys(state).length ? JSON.stringify(state) : "" });
}
/* Written in batches of a hundred, not two round trips awaited per node: thousands of nodes, three reads and one per press. */
const markOne = async (m) => {
  let object;
  try { ({ object } = await cdp.send("DOM.resolveNode", { backendNodeId: m.id })); } catch { return; }
  await cdp.send("Runtime.callFunctionOn", {
    objectId: object.objectId,
    functionDeclaration: `function (role, name, state) { if (this.nodeType !== 1) return; this.dataset.axRole = role; if (name) this.dataset.axName = name; if (state) this.dataset.axState = state; }`,
    arguments: [{ value: m.role }, { value: m.name }, { value: m.state }],
  }).catch(() => {});
};
for (let i = 0; i < marks.length; i += 100) await Promise.all(marks.slice(i, i + 100).map(markOne));
await cdp.detach().catch(() => {});
};
await markRoles();
lap("roles");
const marked = watch !== null ? await page.evaluate(() => window.__sinkSources?.mark() ?? null) : null;
/*
 * The stylesheets the page cannot read (cross-origin: Google Fonts, a CDN),
 * fetched once with the browser's own user agent: the dump reads their
 * `@keyframes` and `:hover` / `:focus` rules from the text, and their faces
 * are read from it below.
 */
const sheetText = new Map();
for (const href of await page.evaluate(() => Array.from(document.styleSheets).filter((s) => { try { void s.cssRules; return false; } catch { return !!s.href; } }).map((s) => s.href))) {
  const bytes = await fetchBytes(href);
  if (bytes) sheetText.set(href, bytes.toString("utf8"));
}
/*
 * A light that blinks (an animation taking it to nothing and back, the
 * `steps(2)` blink of a LIVE dot) is measured on its visible half: the dump
 * drops what it measures at no opacity, so taken on the other half the dot
 * was not in the capture at all. Only those animations are moved, only when
 * they stand invisible, and each is named in `behaviours.heldVisible`.
 */
if (behaviours) {
  behaved.heldVisible = await page.evaluate(() => {
    const B = window.__sinkBehaviours, held = [];
    for (const an of document.getAnimations()) {
      const target = an.effect?.target, t = an.effect?.getTiming?.();
      if (!target || an.effect.pseudoElement || !t || t.iterations !== Infinity) continue;
      const frames = an.effect.getKeyframes?.() ?? [];
      if (!frames.some((f) => f.opacity !== undefined && Number(f.opacity) <= 0.05)) continue;
      if (Number(getComputedStyle(target).opacity) > 0.05) continue;
      const d = Number(t.duration) || 0;
      for (const at of [0, d * 0.25, d * 0.75, d * 0.1]) { an.currentTime = at - (Number(t.delay) || 0); if (Number(getComputedStyle(target).opacity) > 0.05) break; }
      an.pause();
      held.push({ el: B.idOf(target), name: an.animationName ?? null, opacity: Number(getComputedStyle(target).opacity) });
    }
    return held;
  });
  await page.evaluate(() => window.__sinkBehaviours.mark());
}
/* Past the deadline already, no press is made at all: the pass begins with loads of its own. */
const statesLate = flag("--states") && !still && late();
if (statesLate) leftOut("the presses");
const withStates = flag("--states") && !still && !statesLate;
const sheets = [...sheetText].map(([href, text]) => ({ href, text }));
/*
 * READ AT REST, THE POINTER AWAY. The behaviours drive leaves the pointer
 * where it last moved it, over whatever sits there; a hovered sticker read
 * then is its hover look written as its resting one. The pointer is taken
 * off the page (headless Chromium clears every hover for a point outside the
 * window) and the page given its longest transition to settle.
 */
await restPointer(page);
/* The presses held back (held.mjs): a form's own button, words that spend, sign, connect or write. Marked for the dump. */
const heldHere = await scanHeld(page);
if (heldHere.length) console.error(`held: ${heldHere.length} controls not pressed (${[...new Set(heldHere.map((h) => h.held))].map((w) => `${heldHere.filter((h) => h.held === w).length} ${w}`).join(", ")})`);
const cap = await page.evaluate(DUMP, { sheets, paths: withStates });
lap("dump");
if (built) cap.built = built;
/*
 * WHAT A PRESS SHOWS (`--states`). A row of cards that each open their own
 * panel (gotchi.gg's starters: press pup, and the panel is pup's, the card
 * yellow and tilted), a device's buttons that each change its screen: the
 * page as it opened holds one of them. Each group of pressables side by
 * side — two to twelve buttons, tabs, radios or pressed-toggles under one
 * parent, none a link or a form's — is pressed, one option at a time, on the
 * page as it opened (loaded again before each press), and the page is read
 * again. What changed is kept: the topmost elements whose own look, words or
 * picture changed, or that came or went, each with its place in the page's
 * tree (`p`). A press that changes most of the page (a theme switch) or
 * leaves it (a link) is not a state of it and is not kept.
 */
if (withStates) {
  const choosers = () => page.evaluate(({ spends, writes, account, singlesMax, twins }) => {
    for (const el of Array.from(document.querySelectorAll("[data-sink-choice]"))) el.removeAttribute("data-sink-choice");
    const seen = (el) => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 4 && r.height > 4 && cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0.05; };
    const byParent = new Map();
    /*
     * Never pressed, in a group or on its own: what signs in or makes an
     * account (share.xyz's Log In and Sign Up, side by side), and what
     * connects a wallet (stonkfun.xyz's "Connect wallet" sat in a group with
     * its Search). Held for Learn by held.mjs.
     */
    const AC = new RegExp(account, "i");
    const WALLET = /\bwallet\b|^\s*connect\s*$/i;
    for (const el of Array.from(document.querySelectorAll('button, [role="tab"], [role="radio"], [aria-pressed], details > summary'))) {
      if (el.closest("a[href], form") || el.disabled || !seen(el) || !el.parentElement) continue;
      { const w = `${el.getAttribute("aria-label") ?? ""} ${el.textContent ?? ""}`; if (AC.test(w) || WALLET.test(w) || WALLET.test(el.getAttribute("aria-label") ?? "") || WALLET.test(el.textContent ?? "")) continue; }
      /* A question of a list of closed details (an FAQ) is a press among its siblings': each opens its own answer. */
      const holder = el.tagName === "SUMMARY" ? el.parentElement.parentElement : el.parentElement;
      if (!holder || (el.tagName === "SUMMARY" && el.parentElement.open)) continue;
      const list = byParent.get(holder) ?? [];
      list.push(el);
      byParent.set(holder, list);
    }
    /*
     * NEVER PRESSED: a consent or terms choice (a cookie banner's Accept All
     * and Reject side by side are a "group" too, and pressing one agrees for
     * the owner). A group holding one, or sitting in a box that asks for
     * consent, is left alone whole. What a press would write is not judged
     * by its words here: parasiteonsol.fun's coin cards pair "Open $PCAT"
     * with a "Buy" that only opens a panel, and its ledger's "Burn ledger" is
     * a tab; a word list skipped every such group whole, and said nothing.
     * A press that tries to write is stopped as it is made and held
     * (`guardWrites`, below), and the words that spend are held for Learn by
     * held.mjs.
     */
    const CONSENT = /\b(cookies?|consent|accept|agree|reject|decline|terms|privacy|gdpr|necessary only|allow all|manage preferences)\b/i;
    const wordsOf = (el) => `${el.getAttribute("aria-label") ?? ""} ${el.textContent ?? ""}`;
    const asksConsent = (holder) => { for (let n = holder; n && n !== document.body; n = n.parentElement) { const t = (n.textContent ?? "").slice(0, 2000); if (/\bcookies?\b|\bconsent\b/i.test(t) && (n.textContent ?? "").length < 3000) return true; } return false; };
    const out = [];
    for (const [holder, list] of byParent) {
      if (list.length < 2 || list.length > 12) continue;
      if (list.some((el) => CONSENT.test(wordsOf(el))) || asksConsent(holder)) continue;
      out.push(list);
    }
    /* The option chosen as the page opens: pressed, selected, checked or current. */
    const on = (el) => ["aria-pressed", "aria-selected", "aria-checked"].some((a) => el.getAttribute(a) === "true") || el.checked === true || (el.hasAttribute("aria-current") && el.getAttribute("aria-current") !== "false");
    /*
     * TWINS. A control in an item of a list (a row, a coin card, a dialog of
     * one of many pets: an element whose siblings share its tags and classes
     * two levels down, three or more of them), at the same place in it, whose
     * words are the same once its content is taken out ($TICKER, numbers,
     * addresses), is a version of the same control. One of each is pressed;
     * the others are told what it did, in their own words (`subs`), below.
     */
    const skel = (el, d = 0) => `${el.localName}.${[...el.classList].sort().join(".")}${d < 2 ? `(${[...el.children].map((k) => skel(k, d + 1)).join(",")})` : ""}`;
    const pathOf = (el) => { const out = []; for (let n = el; n && n !== document.body && n.parentElement; n = n.parentElement) { const t = n.tagName.toLowerCase(); let i = 1; for (let s = n.previousElementSibling; s; s = s.previousElementSibling) if (s.tagName === n.tagName) i++; out.unshift(`${t}:${i}`); } return `body>${out.join(">")}`; };
    const liveOf = (el) => { const out = []; for (let n = el; n && n !== document.body; n = n.parentElement) { let i = 1; for (let s = n.previousElementSibling; s; s = s.previousElementSibling) if (s.localName === n.localName) i++; out.unshift(`${n.localName}:nth-of-type(${i})`); } return `body > ${out.join(" > ")}`; };
    /* Its own tags and classes, and the same kind of element at the same place in it: a row one badge longer than the next is still a row of the list. */
    const own = (el) => `${el.localName}.${[...el.classList].sort().join(".")}`;
    const at = (item, rel) => { let n = item; for (const i of rel) { n = n?.children[i]; if (!n) return null; } return n; };
    const relIdx = (item, el) => { const out = []; for (let n = el; n && n !== item; n = n.parentElement) out.unshift([...n.parentElement.children].indexOf(n)); return out; };
    const itemOf = (el) => {
      for (let n = el; n && n.parentElement && n !== document.body; n = n.parentElement) {
        if (n === el) continue;
        const k = own(n), rel = relIdx(n, el);
        if ([...n.parentElement.children].filter((x) => x !== n && own(x) === k && at(x, rel) && own(at(x, rel)) === own(el)).length >= 2) return n;
      }
      return null;
    };
    const norm = (w) => w.replace(/\$\S+/g, "$").replace(/[1-9A-HJ-NP-Za-km-z]{16,}/g, "#").replace(/[+\-−]?\d[\d,.]*\s?[%KMB]?/g, "0").trim().replace(/\s+/g, " ").toLowerCase();
    const relOf = (item, el) => { const out = []; for (let n = el; n && n !== item; n = n.parentElement) { let i = 0; for (let s = n.previousElementSibling; s; s = s.previousElementSibling) i++; out.unshift(i); } return out.join("."); };
    const twinKey = (el) => { if (!twins) return null; const item = itemOf(el); return item ? `${pathOf(item.parentElement)}|${own(item)}|${relOf(item, el)}|${norm(wordsOf(el))}` : null; };
    /* What differs between two versions of one item, walked side by side: its words and the attributes that carry content. */
    const subsOf = (a, b, out = []) => {
      if (!a || !b || a.localName !== b.localName || out.length > 60) return out;
      const own = (e) => Array.from(e.childNodes).filter((n) => n.nodeType === 3).map((n) => n.nodeValue).join("").trim();
      const ta = own(a), tb = own(b);
      if (ta !== tb && ta.length >= 2) out.push([ta, tb]);
      for (const at of ["href", "src", "alt", "title", "aria-label", "value", ...Array.from(a.attributes).map((x) => x.name).filter((n) => n.startsWith("data-") && !n.startsWith("data-sink"))]) {
        const va = a.getAttribute(at), vb = b.getAttribute(at);
        if (va && vb && va !== vb && va.length >= 2) out.push([va, vb]);
      }
      const ka = [...a.children], kb = [...b.children];
      for (let i = 0; i < Math.min(ka.length, kb.length); i++) subsOf(ka[i], kb[i], out);
      return out;
    };
    const keyed = (list) => list.map((el) => twinKey(el));
    const seenKeys = new Map();
    const groups = [], twinsOf = [];
    for (const list of out) {
      const ks = keyed(list);
      const gk = ks.every(Boolean) ? ks.join(";") : null;
      if (gk && seenKeys.has(gk)) { twinsOf.push({ list, of: seenKeys.get(gk) }); continue; }
      if (groups.length >= 8) continue;
      if (gk) seenKeys.set(gk, list);
      groups.push(list);
    }
    /*
     * A BUTTON ON ITS OWN. A "Copy CA", a "Next", a "Resources" that opens a
     * panel: pressed too, each as a press of its own. Not one held for Learn
     * (a form's, words that spend, sign, connect or write: held.mjs), nor a
     * consent choice. One of each kind of twin is pressed.
     */
    const inGroup = new Set([...groups.flat(), ...twinsOf.flatMap((t) => t.list)]);
    const SP = new RegExp(spends, "i"), WR = new RegExp(writes, "i");
    const singles = [];
    for (const el of Array.from(document.querySelectorAll('button, [role="button"], details > summary'))) {
      if (el.localName === "summary" && el.parentElement.open) continue;
      if (inGroup.has(el) || el.closest("a[href], form, [data-sink-choice]") || el.disabled || el.getAttribute("aria-disabled") === "true" || !seen(el)) continue;
      const words = wordsOf(el);
      if (CONSENT.test(words) || SP.test(words) || WR.test(words) || AC.test(words) || WALLET.test(words) || asksConsent(el)) continue;
      const k = twinKey(el);
      if (k && seenKeys.has(k)) { twinsOf.push({ list: [el], of: seenKeys.get(k) }); continue; }
      if (singles.length >= singlesMax) continue;
      if (k) seenKeys.set(k, [el]);
      singles.push([el]);
    }
    const all = [...groups, ...singles];
    const described = all.map((list, g) => list.map((el, o) => { el.setAttribute("data-sink-choice", `${g}:${o}`); return { g, o, on: on(el), single: g >= groups.length, trigger: pathOf(el), name: (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40) }; }));
    /* The twins: each option's own path, live selector and words, and what to put in place of its representative's content. */
    for (const t of twinsOf) {
      const rg = all.indexOf(t.of);
      if (rg < 0) continue;
      const g = described.length;
      described.push(t.list.map((el, o) => {
        const rep = t.of[o];
        const ri = itemOf(rep), ti = itemOf(el);
        el.setAttribute("data-sink-choice", `${g}:${o}`);
        return { g, o, on: on(el), single: rg >= groups.length, twinOf: rg, name: (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40), trigger: pathOf(el), live: liveOf(el), repItem: ri ? pathOf(ri) : null, item: ti ? pathOf(ti) : null, subs: ri && ti ? subsOf(ri, ti).sort((x, y) => y[0].length - x[0].length) : [] };
      }));
    }
    return described;
  }, { spends: SPENDS.source, writes: WRITES.source, account: ACCOUNT.source, singlesMax: Number(opt("--singles-max", 40)), twins: !flag("--no-twins") });
  /* Its look: what the accessibility tree says of it is left out, since a modal opened takes the rest of the page out of the tree without changing how any of it looks. */
  /* Its look: what the accessibility tree says of it is left out, and so is `inert` (a modal opened locks the pointer on everything else without changing how any of it looks). */
  const OWN = (e) => { const { kids, x, y, w, h, bh, feeds, __up, role, name, state, inert, ...own } = e; void kids; void x; void y; void w; void h; void bh; void feeds; void __up; void role; void name; void state; void inert; return JSON.stringify(own); };
  /*
   * THE SAME LOOK, WITHIN A PIXEL OR TWO WHERE IT IS A PLACE. Two loads of
   * trumpmorty.fun set its How-to-buy CA bar 1 px apart (its clip box at y
   * 2348, then 2349: the reveal and the scroll-driven layers settle a hair
   * differently each time), so the bar and all it holds read as changing on
   * their own, and its press's "COPIED!" was taken out as noise. A place (a
   * box, a page-space move, a turning point, a layer's block) agrees within
   * `PLACE_PX`; everything a visitor sees change (words, colours, opacity,
   * a picture) must agree exactly.
   */
  const PLACE_PX = 2;
  /*
   * `rooms`: the room a press made (the distances the page was pushed by).
   * Then a place (an inset, a text box, each run of its own words, a clip
   * box, what it is anchored to, the page's own height) may differ by one of
   * them: a decoration pinned to the foot of a part that grew, a line of text
   * pushed down. A turned element's
   * page matrix moves a little with it too.
   */
  const ROOM_KEYS = new Set(["ins", "tb", "ot", "au", "vu", "box"]);
  const sameLook = (a, b, rooms = []) => {
    const off = (d) => Math.abs(d) <= PLACE_PX || rooms.some((r) => Math.abs(Math.abs(d) - r) <= PLACE_PX);
    const near = (x, y, place) => {
      if (typeof x === "number" && typeof y === "number") return place === "room" ? off(x - y) : place ? Math.abs(x - y) <= PLACE_PX : x === y;
      if (typeof x === "string" && typeof y === "string" && place) {
        const nx = x.match(/-?\d*\.?\d+/g) ?? [], ny = y.match(/-?\d*\.?\d+/g) ?? [];
        return x.replace(/-?\d*\.?\d+/g, "#") === y.replace(/-?\d*\.?\d+/g, "#") && nx.length === ny.length && nx.every((v, i) => (place === "room" ? off(Number(v) - Number(ny[i])) : Math.abs(Number(v) - Number(ny[i])) <= PLACE_PX));
      }
      if (Array.isArray(x) && Array.isArray(y)) return x.length === y.length && x.every((v, i) => near(v, y[i], place));
      if (x && y && typeof x === "object" && typeof y === "object") {
        const ks = new Set([...Object.keys(x), ...Object.keys(y)]);
        for (const k of ks) {
          /* A page-space matrix: its move is a place, its turn and scale a look. */
          /* …and pushed by a room made, a turned element's move takes in its turn times the push. */
          if (k === "ptf" && Array.isArray(x[k]) && Array.isArray(y[k])) { const turn = rooms.length ? Math.max(Math.abs(x[k][1] ?? 0), Math.abs(x[k][2] ?? 0)) * Math.max(...rooms) : 0; if (x[k].length !== y[k].length || !x[k].every((v, i) => (i >= 4 ? Math.abs(v - y[k][i]) <= PLACE_PX + turn : Math.abs(v - y[k][i]) <= 0.001))) return false; continue; }
          if (!near(x[k], y[k], place || (rooms.length && ROOM_KEYS.has(k) ? "room" : PLACE_KEYS.has(k)))) return false;
        }
        return true;
      }
      return x === y;
    };
    /* A list the page redrew (`rows.rebuilt`, a note for the backend) looks as it did when its items do. */
    const look = (e) => { const o = JSON.parse(OWN(e)); if (o.rows) { const { rebuilt, ...rows } = o.rows; void rebuilt; o.rows = rows; } return o; };
    return near(look(a), look(b), false);
  };
  /* What is a place: a box (a clip's, a layer's block), a turning point. */
  const PLACE_KEYS = new Set(["box", "tfo"]);
  const paints = (e) => !!(e.text || e.bg || e.bgi || e.border || e.shadow || e.src || e.drawn || e.svgMarkup || e.d);
  /* A page read while it was changing may hand back an empty place among an element's children: skipped, never read into. */
  const index = (tree) => { const m = new Map(); (function go(e, up) { if (!e) return; e.__up = up; if (e.p) m.set(e.p, e); if (e.kids) e.kids = e.kids.filter(Boolean); (e.kids ?? []).forEach((k) => go(k, e)); })(tree, null); return m; };
  const baseIdx = index(cap.tree);
  const total = baseIdx.size;
  const strip = (e) => { delete e.__up; (e.kids ?? []).forEach(strip); return e; };
  const states = [];
  /* Each option's own path, pressed or not: the opening press below is pressed on its option too. */
  const triggers = new Map();
  let tried = 0;
  const statesMax = Number(opt("--states-max", 40));
  const groups = await choosers();
  const home = page.url();
  /*
   * A press only looks. While one is made, a write it would send is stopped
   * before it leaves (network.mjs `guardWrites`; a read goes on), and the
   * press is not a state: it is held (`held: server-call`), for the owner to
   * Learn. What the page writes on its own (an analytics ping) is no press's.
   */
  const guard = await guardWrites(page, { nav: true });
  /* What a press did besides changing the page (presses.mjs): where it went, what it copied. */
  const pressedOut = [];
  const hasCanvas = frameSecs > 0 && (await page.evaluate(() => !!document.querySelector("canvas")).catch(() => false));
  let dirty = true;
  /* The page is as a load leaves it: loading it again would not bring a control into reach that is out of it now. */
  let asLoaded = false;
  const background = new Set(net ? net.seen.filter((q) => q.phase === "load" || q.phase === "open").flatMap((q) => [keyOfRequest(q.method, q.url, q.body, home), ...(q.sentShapes ?? [])]) : []);
  const heldPresses = [];
  net?.phase("press");
  /* What the page kept as it opened: a press that is remembered (a theme switched off, a sound on) must not open the next press in its state. */
  const kept = await page.evaluate(() => ({ local: Object.entries(localStorage), session: Object.entries(sessionStorage) })).catch(() => ({ local: [], session: [] }));
  const cookies = await context.cookies();
  const restore = async () => {
    await page.evaluate((k) => { localStorage.clear(); sessionStorage.clear(); for (const [a, b] of k.local) localStorage.setItem(a, b); for (const [a, b] of k.session) sessionStorage.setItem(a, b); }, kept).catch(() => {});
    await context.clearCookies();
    if (cookies.length) await context.addCookies(cookies);
  };
  /* The page as it opened, loaded again: its storage put back, scrolled through once as the first read was, so what reveals itself on the way down has. */
  const fresh = async () => {
    await restore();
    const again = await page.goto(url, { waitUntil: "load" }).catch(() => null);
    if (!again) return false;
    await settle(600);
    if (await waitLoader()) await page.waitForTimeout(400);
    await agreeGate();
    await page.evaluate(() => document.fonts?.ready).catch(() => {});
    await page.evaluate(async () => { const h = document.documentElement.scrollHeight; for (let y = 0; y < h; y += Math.max(100, innerHeight / 6)) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } scrollTo(0, 0); });
    await page.waitForTimeout(600);
    await primeGesture();
    reloads++;
    asLoaded = true;
    /* How it opened, twice: what differs between the two changes on its own (a live list, a ticking control) and is not asked to come back. */
    const f0 = await fingerprint();
    await page.waitForTimeout(700);
    const f1 = await fingerprint();
    baseFp = f0 && f1 ? { ...f1, drift: Math.abs(f1.n - f0.n), loose: f0.aria.map((v, i) => v !== f1.aria[i]), ariaN: f0.aria.length !== f1.aria.length, bodyLoose: f0.body !== f1.body } : f1;
    return true;
  };
  /*
   * THE PAGE'S FIRST GESTURE, GIVEN BEFORE ANY PRESS. A page may answer the
   * first gesture of any kind, whatever it touched (a device unlocking its
   * sound and marking its sound button on): then every press carries that
   * change, which is no press's, and no undo takes it back. So each load is
   * given one click on a spot that is no control (nothing pressable, no
   * pointer cursor, not a canvas), with writes stopped, and what that
   * changes is the page's as it opened.
   */
  const primeGesture = async () => {
    const at = await page.evaluate(() => {
      /* A control, not a landmark: <main tabindex="-1"> (a skip link's target) and role="main" or "region" hold the whole page and are no control. */
      const PRESSABLE = 'a, button, input, select, textarea, label, summary, canvas, video, iframe, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="option"], [role="checkbox"], [role="radio"], [role="switch"], [role="slider"], [role="textbox"], [role="combobox"], [onclick], [tabindex]:not([tabindex="-1"]), [contenteditable]';
      for (let y = innerHeight - 6; y > 20; y -= Math.round(innerHeight / 12)) {
        for (let x = 6; x < innerWidth - 6; x += Math.round(innerWidth / 16)) {
          const el = document.elementFromPoint(x, y);
          if (!el || el.closest(PRESSABLE) || el.closest("[data-sink-gate]")) continue;
          let pointer = false; for (let n = el; n && n !== document.documentElement; n = n.parentElement) if (getComputedStyle(n).cursor === "pointer") { pointer = true; break; }
          if (!pointer) return { x, y };
        }
      }
      return null;
    }).catch(() => null);
    if (!at) return;
    const quiet = [];
    await guard.on(quiet);
    await page.mouse.click(at.x, at.y).catch(() => {});
    await page.mouse.move(-5, -5).catch(() => {});
    await page.waitForTimeout(300);
    await guard.off();
    if (page.url() !== home) { await page.goto(url, { waitUntil: "load" }).catch(() => {}); await waitReady(page, { most: readyFor }); }
  };
  /*
   * UNDONE IN PLACE, NOT LOADED AGAIN. After a press is read, what it opened
   * is closed (Escape, the close control of a dialog it brought, the toggle
   * pressed again, the option that was on pressed back) and the page is
   * compared with how it opened: its address, its open dialogs, its selected
   * and expanded controls, <body>'s own look, and about as many elements. Only
   * a page that did not come back (or a press that moved the address) is
   * loaded again.
   */
  let reloads = 0, presses = 0, inferredN = 0, baseFp = null, loadsAfter = 0, undone = 0;
  /* How the last press moved the address, if it did (presses.mjs `pushedBy`). */
  let movedBy = null;
  const fingerprint = () => page.evaluate(() => {
    /* How many elements each large part holds (six deep at most), by its path: where a count changed, when it did. */
    const PARTS = () => {
      const out = {};
      const walk = (el, p, depth) => {
        const n = el.getElementsByTagName("*").length;
        if (n < 25) return;
        out[p] = n;
        if (depth >= 6) return;
        const seen = {};
        for (const c of el.children) { const t = c.localName; seen[t] = (seen[t] ?? 0) + 1; walk(c, `${p}>${t}:${seen[t]}`, depth + 1); }
      };
      walk(document.body, "body", 0);
      return out;
    };
    const seen = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    for (const m of document.querySelectorAll('dialog[open], [aria-modal="true"], [role="dialog"], [role="alertdialog"]')) if (seen(m) && !window.__sinkUndoing) m.setAttribute("data-sink-base-open", "");
    /* Only what is on (a "false" is as good as none: a bar that marks all its icons once one is picked, then none, is as it was), each by its words. */
    const aria = Array.from(document.querySelectorAll("[aria-expanded], [aria-selected], [aria-pressed], [aria-checked]")).map((e) => [e, ["aria-expanded", "aria-selected", "aria-pressed", "aria-checked"].map((a) => { const v = e.getAttribute(a); return v == null || v === "false" ? "" : `${a.slice(5, 8)}=${v}`; }).join("")]).filter(([, v]) => v).map(([e, v]) => `${(e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 24)}:${v}`);
    return {
      url: location.href, aria, n: document.body.getElementsByTagName("*").length, parts: PARTS(),
      modals: Array.from(document.querySelectorAll('dialog[open], [aria-modal="true"], [role="dialog"], [role="alertdialog"]')).filter(seen).length,
      /* The page's own look: <html> and <body>'s style and classes, and their colours as drawn (a theme switched by a data-theme is seen; a data-theme="light" where there was none, drawn the same, is not). */
      body: [document.documentElement, document.body].map((el) => { const cs = getComputedStyle(el); return `${el.getAttribute("style") ?? ""}|${el.className}|${cs.backgroundColor}|${cs.color}|${cs.colorScheme}`; }).join("|"),
      details: Array.from(document.querySelectorAll("details")).map((d) => (d.open ? 1 : 0)).join(""),
    };
  }).catch(() => null);
  /* Came back: the same address, dialogs, <body> and details; its selected and expanded controls as they were, but for the ones that change on their own; about as many elements, give or take what changes on its own. */
  /*
   * Where the count changed, and whether that is away from where the press
   * acted (`at`: its trigger and what it added or took). gotchi.gg's hero holds its
   * row of pets twice for a seamless loop, and once for a few seconds some
   * ten seconds after it loads: some 400 elements that are no press's.
   */
  const awayFrom = (a, b, at) => {
    if (!at?.length || !a.parts || !b.parts) return false;
    const keys = new Set([...Object.keys(a.parts), ...Object.keys(b.parts)]);
    const differ = [...keys].filter((k) => (a.parts[k] ?? 0) !== (b.parts[k] ?? 0));
    /* The deepest parts that changed, and all of the change in them. */
    const leaves = differ.filter((k) => !differ.some((q) => q !== k && q.startsWith(`${k}>`)));
    if (!leaves.length) return false;
    const inLeaves = leaves.reduce((sum, k) => sum + Math.abs((a.parts[k] ?? 0) - (b.parts[k] ?? 0)), 0);
    const related = (k, p) => p === k || p.startsWith(`${k}>`) || k.startsWith(`${p}>`);
    return inLeaves >= Math.abs(a.n - b.n) - 25 && leaves.every((k) => !at.some((p) => related(k, p.split("::")[0])));
  };
  const whyNot = (a, b, at) => {
    if (!a || !b) return "unread";
    if (a.url !== b.url) return "address";
    if (a.modals !== b.modals) return "dialogs";
    if (a.body !== b.body && !b.bodyLoose) return "body";
    if (a.details !== b.details) return "details";
    if (!b.ariaN && (a.aria.length !== b.aria.length || a.aria.some((v, i) => v !== b.aria[i] && !b.loose?.[i]))) return "selected or expanded";
    if (Math.abs(a.n - b.n) > Math.max(20, b.n * 0.03, (b.drift ?? 0) * 3) && !awayFrom(a, b, at)) return `elements ${b.n} -> ${a.n}`;
    return null;
  };
  const sameAsOpened = (a, b, at) => { const w = whyNot(a, b, at); if (w) console.error(`states: not back as it opened (${w}): loaded again`); return !w; };
  /*
   * Runs in the page: every mark a press can switch (selected, pressed,
   * checked, current, expanded; a class that says active, selected, current
   * or open; a <details>' open), each by its path, and `__sinkAt(path)` to
   * find one again.
   */
  const MARKS = () => {
    window.__sinkAt = (p) => { let el = document.body; for (const step of String(p).split(">").slice(1)) { const m = /^([a-z0-9-]+):(\d+)$/i.exec(step); if (!m || !el) return null; let k = 0; el = Array.from(el.children).find((c) => c.localName.toLowerCase() === m[1].toLowerCase() && ++k === Number(m[2])) ?? null; } return el; };
    const pathOf = (el) => { const out = []; for (let n = el; n && n !== document.body && n.parentElement; n = n.parentElement) { const t = n.tagName.toLowerCase(); let i = 1; for (let q = n.previousElementSibling; q; q = q.previousElementSibling) if (q.tagName === n.tagName) i++; out.unshift(`${t}:${i}`); } return `body>${out.join(">")}`; };
    const ARIA = ["aria-selected", "aria-pressed", "aria-checked", "aria-current", "aria-expanded"];
    const ACTIVE = /^(is-)?(active|selected|current|open|on)$/;
    const out = [];
    const els = new Set([...document.querySelectorAll("[aria-selected], [aria-pressed], [aria-checked], [aria-current], [aria-expanded], details")]);
    for (const el of document.body.querySelectorAll("[class]")) if ([...el.classList].some((c) => ACTIVE.test(c))) els.add(el);
    for (const el of els) {
      if (el.closest("[data-sink-gate]")) continue;
      const attrs = Object.fromEntries(ARIA.map((a) => [a, el.getAttribute(a)]));
      const cls = [...el.classList].filter((c) => ACTIVE.test(c));
      const on = ["aria-selected", "aria-pressed", "aria-checked"].some((a) => attrs[a] === "true") || (attrs["aria-current"] && attrs["aria-current"] !== "false") || cls.length > 0;
      const control = /^(button|summary|a|input|select)$/.test(el.localName) || /^(tab|button|radio|checkbox|switch|menuitem|menuitemradio|menuitemcheckbox|option)$/.test(el.getAttribute("role") ?? "");
      const details = el.localName === "details";
      /* A "false" is as good as none (above). */
      const said = Object.fromEntries(Object.entries(attrs).map(([a, v]) => [a, v === "false" ? null : v]));
      out.push({ p: pathOf(el), k: `${JSON.stringify(said)}|${cls.join(".")}|${details ? el.open : ""}`, on: !!on, control, attrs, cls, notCls: [], details, open: details ? el.open : null });
    }
    return out;
  };
  const undoPress = async (opt, found, group, pre, touched) => {
    let restoreLater = null, pressedTrigger = false;
    /* A state kept in the address (the same page, another query): gone back from, as its visitor would. */
    /* Pushed: gone back from. Only replaced (a board's tab in its query): there is no step back, which would leave the page; its address is set back below, once its controls are. */
    if (page.url() !== baseFp?.url && movedBy !== "replace") { await page.evaluate(() => history.back()).catch(() => {}); await page.waitForTimeout(400); }
    await page.evaluate(() => { window.__sinkUndoing = true; for (const d of document.querySelectorAll("dialog[open]")) if (!d.hasAttribute("data-sink-base-open")) d.close(); }).catch(() => {});
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(120);
    await page.evaluate(() => {
      const seen = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      for (const m of document.querySelectorAll('[aria-modal="true"], [role="dialog"], [role="alertdialog"]')) {
        if (m.hasAttribute("data-sink-base-open") || !seen(m)) continue;
        const x = m.querySelector('[data-close], [aria-label*="close" i], button[title*="close" i]') ?? Array.from(m.querySelectorAll("button")).find((b) => /^\s*(close|×|✕|✖|x|cancel|done|back)\s*$/i.test(b.textContent ?? ""));
        if (x) x.click();
      }
    }).catch(() => {});
    /*
     * WHAT THE PRESS SWITCHED, SWITCHED BACK (MARKS: every selected, pressed,
     * checked, current, expanded or class-active element, and every
     * <details>, before the press and now). What was on and is now off is its
     * partner, pressed back (a tab, a segment, the option that was chosen);
     * what the press expanded or opened is pressed again; a <details> is
     * closed or opened as it was. Only what no press puts back, once the
     * page looks as it did, has its attribute or class set back as it was.
     */
    if (pre) {
      /* Both ways: an element that lost its only mark (a tab no longer active) is no longer in the list at all. */
      const bare = (m) => ({ ...m, k: `${JSON.stringify(Object.fromEntries(Object.keys(m.attrs).map((a) => [a, null])))}||${m.details ? false : ""}`, on: false, attrs: Object.fromEntries(Object.keys(m.attrs).map((a) => [a, null])), cls: [], open: m.details ? false : null });
      const diff = (a, b) => {
        const was = new Map(a.map((m) => [m.p, m])), now = new Map(b.map((m) => [m.p, m]));
        const out = [];
        for (const [p, w] of was) { const m = now.get(p) ?? bare(w); if (w.k !== m.k) out.push({ now: m, was: w }); }
        for (const [p, m] of now) if (!was.has(p) && m.k !== bare(m).k) out.push({ now: m, was: bare(m) });
        return out;
      };
      let d = diff(pre, (await page.evaluate(MARKS).catch(() => [])) ?? []);
      if (process.env.SINK_DEBUG_PRESSES) console.error(`undo ${opt.name}: ${d.length} marks switched: ${d.map((x) => x.now.p).join("; ")}`);
      const press = async (p) => { const sel = await page.evaluate((path) => { const el = window.__sinkAt(path); if (!el) return null; el.setAttribute("data-sink-undo", ""); return true; }, p).catch(() => null); if (!sel) return; await page.locator("[data-sink-undo]").first().click({ timeout: 2000 }).catch(() => {}); await page.evaluate(() => { for (const el of document.querySelectorAll("[data-sink-undo]")) el.removeAttribute("data-sink-undo"); }).catch(() => {}); await page.waitForTimeout(120); };
      /* The partner that was on, pressed back. */
      for (const x of d.filter((x) => x.was.on && !x.now.on && x.was.control)) await press(x.was.p);
      d = diff(pre, (await page.evaluate(MARKS).catch(() => [])) ?? []);
      /*
       * On with no partner (a device's icon bar that opened with none
       * chosen, a list's chosen row), before it is pressed again (which on a
       * device runs its icon again): the widget's own way back, a back,
       * cancel, clear or close control beside it (in the nearest part
       * holding both, never past a section or landmark), for what was
       * chosen (what was expanded is pressed again, below), pressed with
       * writes stopped, at most three times,
       * each once what it opened has had a moment (a game or a menu, then
       * the bar). Never a held control.
       */
      const chosen = (x) => x.now.on && !x.was.on && !x.now.details && x.now.attrs?.["aria-expanded"] !== "true";
      for (let k = 0; k < 3 && d.some(chosen); k++) {
        const hit = await page.evaluate((paths) => {
          const BACK = /^\s*(back|go back|cancel|clear|close|deselect|none|×|✕|✖)\s*$/i;
          const words = (b) => (b.getAttribute("aria-label") || b.textContent || b.getAttribute("title") || "").trim();
          const seen = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
          for (const p of paths) {
            let n = window.__sinkAt(p);
            for (let up = 0; n && n !== document.body && up < 6 && !n.matches('section, main, article, header, footer, nav, aside, form, [role="region"], [role="main"]'); up++, n = n.parentElement) {
              const b = Array.from(n.querySelectorAll('button, [role="button"]')).find((b) => !b.hasAttribute("data-sink-held") && !b.closest("[data-sink-gate]") && seen(b) && BACK.test(words(b)));
              if (b) { b.setAttribute("data-sink-undo", ""); return true; }
            }
          }
          return false;
        }, d.filter(chosen).map((x) => x.now.p)).catch(() => false);
        if (!hit) break;
        const stopped = [];
        await guard.on(stopped);
        await page.locator("[data-sink-undo]").first().click({ timeout: 2000 }).catch(() => {});
        await page.evaluate(() => { for (const el of document.querySelectorAll("[data-sink-undo]")) el.removeAttribute("data-sink-undo"); }).catch(() => {});
        /* A device lets its screen change play out (gotchi.gg's wipe) before it takes the next press. */
        await page.waitForTimeout(1000);
        await guard.off();
        d = diff(pre, (await page.evaluate(MARKS).catch(() => [])) ?? []);
      }
      /* What the press expanded, opened or turned on with no partner to turn off: pressed again; a <details> set as it was. */
      for (const x of d) {
        if (x.now.details) await page.evaluate(({ p, open }) => { const el = window.__sinkAt(p); if (el) el.open = open; }, { p: x.now.p, open: x.was.open }).catch(() => {});
        else if (x.now.control) await press(x.now.p);
      }
      d = diff(pre, (await page.evaluate(MARKS).catch(() => [])) ?? []);
      /* Expanded or on by a press made on another element (a row marked open by its button): the press itself made again. */
      if (d.length) { await press(opt.trigger); pressedTrigger = true; }
      d = diff(pre, (await page.evaluate(MARKS).catch(() => [])) ?? []);
      if (d.length) restoreLater = d.map((x) => x.was);
    }
    await page.mouse.move(-5, -5).catch(() => {});
    await page.evaluate(() => { scrollTo(0, 0); window.__sinkUndoing = false; }).catch(() => {});
    /* An address only replaced, its controls now switched back: set back as it was, in place (the page's own router reads it the same). */
    if (movedBy === "replace" && page.url() !== baseFp?.url) await page.evaluate((u) => { try { if (new URL(u).origin === location.origin) history.replaceState(history.state, "", u); } catch (e) { /* */ } }, baseFp.url).catch(() => {});
    /* A dialog the press opened, closing, may have locked the page again under its gate: the gate is hidden again, never agreed to. */
    if (flag("--hide-gate")) await page.evaluate(HIDE_GATE).catch(() => {});
    await page.waitForTimeout(250);
    if (touched && (touched.added.length || touched.removed.length)) {
      /* The words of what is gone, as the page opened with them (deep: a cell's spans). */
      const deepText = (e) => { const out = []; const w = (n) => { if (!n) return; if (n.text) out.push(n.text); for (const k of n.kids ?? []) w(k); }; w(e); return out.join(" "); };
      const goneWords = Object.fromEntries(touched.removed.slice(0, 40).map((p) => [p, deepText(baseIdx.get(p.split("::")[0]))]));
      const stayed = await page.evaluate(({ added, removed, goneWords }) => {
        const at = (p) => { let el = document.body; for (const step of p.split("::")[0].split(">").slice(1)) { const m = /^([a-z0-9-]+):(\d+)$/i.exec(step); if (!m || !el) return null; let k = 0; el = Array.from(el.children).find((c) => c.localName.toLowerCase() === m[1].toLowerCase() && ++k === Number(m[2])) ?? null; } return el; };
        /* Seen: a box, not hidden, and not in a closed <details> (whose content keeps a box under content-visibility). */
        const seen = (el) => { if (!el) return false; if (el.closest("details:not([open])") && !el.closest("summary") && el.localName !== "details") return false; if (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true, opacityProperty: false })) return false; const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.display !== "none" && cs.visibility !== "hidden"; };
        /* A pseudo-element (a ::marker turned, a ::before shown) is its element's, which is there either way: not asked. */
        const own = (p) => !p.includes("::");
        /* Live data, not the press's: a part whose only words are a number (a price ticking, a percentage, a count), redrawn as it changes. */
        const NUMBER = /^[\s$€£¥+\-−–.,:%()#0-9kmbx×]+$/i;
        const live = (t) => !!t && /\d/.test(t) && NUMBER.test(t);
        return [...added.filter(own).filter((p) => { const el = at(p); return seen(el) && !live((el.textContent ?? "").trim()); }).map((p) => `+${p}`), ...removed.filter(own).filter((p) => !seen(at(p)) && !live((goneWords[p] ?? "").trim())).map((p) => `-${p}`)];
      }, { added: touched.added.slice(0, 40), removed: touched.removed.slice(0, 40), goneWords }).catch(() => ["?"]);
      const left = stayed.length;
      /* What fades or animates away is given a moment, once, before it is said to have stayed. */
      /*
       * Still there: given a moment, once (what fades or animates away); and
       * a toggle that marks nothing (a "Show more", a details button that
       * takes a panel's hidden off) is pressed once more, writes stopped.
       */
      if (left && !touched.again) {
        if (!pressedTrigger) {
          const stopped = [];
          await guard.on(stopped);
          const hit = await page.evaluate((p) => { const el = window.__sinkAt?.(p); if (!el) return false; el.setAttribute("data-sink-undo", ""); return true; }, opt.trigger).catch(() => false);
          if (hit) await page.locator("[data-sink-undo]").first().click({ timeout: 2000 }).catch(() => {});
          await page.evaluate(() => { for (const el of document.querySelectorAll("[data-sink-undo]")) el.removeAttribute("data-sink-undo"); }).catch(() => {});
          await page.mouse.move(-5, -5).catch(() => {});
          await guard.off();
        }
        await page.waitForTimeout(700);
        return undoPress(opt, found, group, null, { ...touched, again: true });
      }
      if (left) { console.error(`states: ${opt.name}: not back as it opened (${left} of what the press added or took still so: ${stayed.slice(0, 3).join(" ")}): loaded again`); return false; }
    }
    /* The page looks as it did: a mark nothing pressed back is set back as it was, the last resort before loading the page again. */
    if (restoreLater?.length) await page.evaluate((marks) => { for (const m of marks) { const el = window.__sinkAt(m.p); if (!el) continue; for (const [a, v] of Object.entries(m.attrs)) { if (v === null) el.removeAttribute(a); else el.setAttribute(a, v); } if (m.details) el.open = m.open; for (const c of [...el.classList]) if (/^(is-)?(active|selected|current|open|on)$/.test(c) && !m.cls.includes(c)) el.classList.remove(c); for (const c of m.cls) el.classList.add(c); } }, restoreLater).catch(() => {});
    /* Where the press could have changed a count: its trigger, and what it added or took (not what it only restyled). */
    const at = [opt.trigger, ...(touched?.added ?? []), ...(touched?.removed ?? [])].filter(Boolean);
    /* The page's own look switched (a theme, lights off): the press made once more switches it back, writes stopped. */
    if (whyNot(await fingerprint(), baseFp, at) === "body" && !touched?.again) {
      const stopped = [];
      await guard.on(stopped);
      const hit = await page.evaluate((p) => { const el = window.__sinkAt?.(p); if (!el) return false; el.setAttribute("data-sink-undo", ""); return true; }, opt.trigger).catch(() => false);
      if (hit) { await page.locator("[data-sink-undo]").first().click({ timeout: 2000 }).catch(() => {}); pressedTrigger = true; }
      await page.evaluate(() => { for (const el of document.querySelectorAll("[data-sink-undo]")) el.removeAttribute("data-sink-undo"); }).catch(() => {});
      await page.mouse.move(-5, -5).catch(() => {});
      await page.waitForTimeout(400);
      await guard.off();
    }
    if (!whyNot(await fingerprint(), baseFp, at)) return true;
    await page.waitForTimeout(700);
    return sameAsOpened(await fingerprint(), baseFp, at);
  };
  /*
   * WHAT CHANGES ON ITS OWN. A clock ("3m ago"), a live feed, a pet a
   * script hatches at random: read twice with nothing pressed, what differs
   * from the first read differs without a press, and is no press's.
   */
  const noise = new Set();
  /* The page as a press finds it (the first of these reads, its first gesture given): what a press on a control that changes on its own is told against. */
  let opened = null;
  for (let i = 0; i < 2 && groups.length; i++) {
    if (!(await fresh())) break;
    await page.waitForTimeout(800);
    /*
     * THE CANVASES AS A PRESS FINDS THEM. The first read watched each canvas
     * late in its load (gotchi.gg's demo pet had hatched by then); a press is
     * made a few seconds after a load, on an egg. So the page as it opened
     * keeps the frames read here, on a load like the presses', at the moment
     * they are made.
     */
    if (i === 0 && frameSecs > 0) await sampleFrames(frameSecs);
    await markRoles();
    const idle = index((await page.evaluate(DUMP, { sheets, paths: true })).tree);
    if (i === 0) opened = idle;
    /* A world's frames are the ones its characters were read in, and stay (worlds.mjs). */
    if (i === 0) for (const [p, e] of idle) { const b = baseIdx.get(p); if (b && b.t === "canvas" && e.t === "canvas" && !b.world) { if (e.frames) b.frames = e.frames; else delete b.frames; if (e.drawn) b.drawn = e.drawn; } }
    for (const [p, e] of idle) {
      const b = baseIdx.get(p);
      /* A canvas that repaints is noise only when it shows a picture it was not seen showing. */
      if (b && b.t === "canvas" && e.t === "canvas") { if (e.drawn && e.drawn !== b.drawn && !(b.frames?.frames ?? []).includes(e.drawn)) noise.add(p); continue; }
      if (!b || !sameLook(b, e)) noise.add(p);
    }
    for (const p of baseIdx.keys()) if (!idle.has(p)) noise.add(p);
  }
  const noisy = (p) => { for (const q of noise) if (p === q || p.startsWith(`${q}>`) || p.startsWith(`${q}::`)) return true; return false; };
  /*
   * LIVE DATA, TOLD FROM A PRESS'S CHANGE. What changes on its own between
   * reads (a chart drawn again with live values, its labels the clock, a
   * price ticking) changes in its figures only: read with its numbers
   * blanked, its shape (its parts, their kinds and their words) stays. A
   * press that changes that shape (a range drawing its own bars under its
   * own labels) changed it for real, though it moves on its own too: kept.
   * One whose shape differs between idle reads (a feed of other items) is
   * told no more than before.
   */
  const shape = (e, d = 0) => (!e ? "∅" : `${e.t}:${String(e.text ?? "").replace(/[0-9]+([.,:][0-9]+)*/g, "#").trim().slice(0, 40)}${d < 6 && e.kids?.length ? `(${e.kids.map((k) => shape(k, d + 1)).join(",")})` : ""}`);
  const liveMoved = (p, e, ...idle) => { const b = baseIdx.get(p); if (!b || !e) return false; const s = shape(b); return idle.every((i) => !i || shape(i) === s) && shape(e) !== s; };
  if (noise.size) console.error(`states: ${noise.size} elements change on their own between loads; no press is said to change them`);
  if (process.env.SINK_DEBUG_STATES) console.error(`noise: ${[...noise].join(" | ")}`);
  /* What each pressed option did, by g:o, for its twins. */
  const results = new Map();
  for (const group of groups) {
    /* A twin is not pressed: it is told what its representative did (below). */
    if (group[0]?.twinOf != null) continue;
    for (const opt of group) {
      if (!opt.single && tried++ >= statesMax) break;
      if (late()) { leftOut("the presses not yet made"); break; }
      /* Where each press's time goes (SINK_TIMING=1): the load before it, finding it, the press and its wait, the frames, the read, the undo. */
      const timing = process.env.SINK_TIMING ? { at: Date.now(), laps: [] } : null;
      const tlap = (name) => { if (!timing) return; const now = Date.now(); timing.laps.push(`${name} ${((now - timing.at) / 1000).toFixed(1)}`); timing.at = now; };
      /* The page is loaded again only when the last press could not be undone. */
      if (dirty) { if (!(await fresh())) continue; dirty = false; tlap("load"); }
      /* Found again by its own place, not by its number: a press undone can leave the list of controls in another order. */
      let found = await choosers();
      /* By its place and its words, or by its place alone when its words changed on their own (a sound button the first gesture switched), or by its words alone when a live list above it moved it and no other control has them. */
      const findAgain = (list) => { const all = list.flat(); const byWords = all.filter((o) => o.name && o.name === opt.name); return all.find((o) => o.trigger === opt.trigger && o.name === opt.name) ?? all.find((o) => o.trigger === opt.trigger) ?? (byWords.length === 1 ? byWords[0] : undefined); };
      let cur = findAgain(found);
      if (!cur) { console.error(`states: ${opt.name}: not found again after the page was loaded again: not pressed`); continue; }
      let sel = `[data-sink-choice="${cur.g}:${cur.o}"]`;
      let target = page.locator(sel).first();
      /*
       * A control the pointer cannot reach (something over it, or the page's
       * pointer locked): the gate hidden again, and if that is not enough the
       * page loaded again, before the press, so a press is never made into
       * nothing.
       */
      const reachable = () => target.click({ trial: true, timeout: 1000 }).then(() => true).catch(() => false);
      /*
       * Out of reach: scrolled into it first, which is all most need (a
       * control below the window, or in a box of its own that scrolls). The
       * page is loaded again only when a press may have left it otherwise
       * than a load would; on a page as a load leaves it, a control still out
       * of reach stays so, and is not pressed.
       */
      if (!(await reachable())) await target.scrollIntoViewIfNeeded({ timeout: 1500 }).catch(() => {});
      if (!(await reachable())) {
        if (flag("--hide-gate")) await page.evaluate(HIDE_GATE).catch(() => {});
        if (!(await reachable()) && asLoaded) { console.error(`states: ${opt.name} out of the pointer's reach on the page as loaded: not pressed`); continue; }
        if (!(await reachable()) && (await fresh())) {
          found = await choosers();
          const again = findAgain(found);
          if (!again) continue;
          cur = again;
          sel = `[data-sink-choice="${again.g}:${again.o}"]`;
          target = page.locator(sel).first();
          console.error(`states: ${opt.name} out of the pointer's reach: loaded again`);
        }
        if (!(await reachable())) { console.error(`states: ${opt.name} still out of the pointer's reach: not pressed`); continue; }
      }
      const before = { s: states.length, p: pressedOut.length, h: heldPresses.length };
      tlap("find");
      const pre = await page.evaluate(MARKS).catch(() => null);
      let undo = true;
      /* What the press added to the page and took from it, by path: an undo must leave none of the one and all of the other. */
      let touched = null;
      presses++;
      try {
      const trigger = await target.evaluate((el) => { const out = []; for (let n = el; n && n !== document.body && n.parentElement; n = n.parentElement) { const t = n.tagName.toLowerCase(); let i = 1; for (let s = n.previousElementSibling; s; s = s.previousElementSibling) if (s.tagName === n.tagName) i++; out.unshift(`${t}:${i}`); } return `body>${out.join(">")}`; }).catch(() => null);
      triggers.set(`${opt.g}:${opt.o}`, trigger);
      const near = await target.evaluate((el) => { const r = el.getBoundingClientRect(); return { y: r.top + scrollY, h: r.height }; }).catch(() => null);
      const stopped = [];
      await guard.on(stopped);
      const popups = [];
      const onPopup = (w) => { popups.push(w.url()); w.close().catch(() => {}); };
      page.on("popup", onPopup);
      await page.evaluate(() => window.__sinkPress?.begin()).catch(() => {});
      await target.click({ timeout: 3000 }).catch(() => {});
      asLoaded = false;
      /* Pressed, then let go and the pointer taken away: what the press changed, not the hover it leaves behind. */
      await page.mouse.move(-5, -5).catch(() => {});
      /* What its canvases showed after it, in order, from the moment it was made: the device's screen answering the press ("still an egg." for a second). The read below waits as long, for what moves into place. */
      await page.waitForTimeout(hasCanvas ? 100 : 800);
      /* A panel that arrives late: the page let settle once it moved, or given a while when it did not (presses.mjs). Only a canvas watch stands in for that wait. */
      if (!(hasCanvas && !opt.single)) await afterPress(page);
      page.off("popup", onPopup);
      tlap("press");
      const did = (await page.evaluate(() => window.__sinkPress?.end()).catch(() => null)) ?? { count: 0 };
      movedBy = did.pushedBy ?? null;
      /*
       * WHERE IT WENT. A press whose script loaded another page (answered 204
       * by the guard, so the browser stayed), moved the address by pushState
       * (a router's page), or opened a window: that is where the control goes,
       * kept as its link. The page is loaded again before the next press.
       */
      /*
       * The same page with only its query or its hash changed (a modal kept in
       * the address, `?sign-in=1`; a chart's range, `?zoom=1h`) that changed the
       * page is not somewhere else: it is a state, read like any other, and
       * undone by going back.
       */
      const samePage = (u) => { try { const a = new URL(u), b = new URL(home); return a.origin === b.origin && a.pathname === b.pathname; } catch { return false; } };
      const moved = (u) => !!u && u !== home && !(samePage(u) && did.count > 0);
      const went = stopped.find((q) => q.nav)?.nav ?? (moved(page.url()) ? page.url() : null) ?? (moved(did.pushed) ? did.pushed : null) ?? popups[0] ?? did.opened ?? null;
      if (went) {
        await page.evaluate(() => window.__sinkPress?.releaseAll()).catch(() => {});
        await guard.off();
        if (page.url() !== home) { dirty = true; undo = false; }
        pressedOut.push({ trigger, does: "link", href: went, name: opt.name, ...(popups.length || did.opened ? { target: "_blank" } : {}) });
        console.error(`state ${opt.g}:${opt.o} (${opt.name}) goes to ${went}: kept as its link`);
        continue;
      }
      /* WHAT IT COPIED: kept as the control's copy. What it flashed as it did (a "COPIED!", a toast) is read below as what it showed, for as long as it showed it. */
      if (did.copied != null) {
        pressedOut.push({ trigger, does: "copy", copy: did.copied, name: opt.name });
        console.error(`state ${opt.g}:${opt.o} (${opt.name}) copies "${String(did.copied).slice(0, 40)}"`);
        if (!did.count) { await page.evaluate(() => window.__sinkPress?.releaseAll()).catch(() => {}); await guard.off(); undo = false; continue; }
      }
      /* Nothing moved and no canvas to watch: nothing to read again, and the page is still as it opened. */
      if (opt.single && !did.count && !hasCanvas && !stopped.length) { await page.evaluate(() => window.__sinkPress?.releaseAll()).catch(() => {}); await guard.off(); undo = false; continue; }
      if (frameSecs > 0) await sampleFrames(Math.min(frameSecs, 2.5), near);
      tlap("frames");
      await guard.off();
      const wrote = stopped.filter((q) => !background.has(q.key));
      if (wrote.length) {
        const live = await page.evaluate((sel) => { const el = document.querySelector(sel); if (!el) return null; const out = []; for (let n = el; n && n !== document.body; n = n.parentElement) { let i = 1; for (let s = n.previousElementSibling; s; s = s.previousElementSibling) if (s.localName === n.localName) i++; out.unshift(`${n.localName}:nth-of-type(${i})`); } return `body > ${out.join(" > ")}`; }, sel).catch(() => null);
        heldPresses.push({ trigger, held: "server-call", hook: [...new Set(wrote.map((q) => `${q.method} ${q.url.replace(/^\w+:\/\//, "")}`))].join("; "), label: opt.name, control: opt.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || `press-${opt.g}-${opt.o}`, selector: live });
        console.error(`state ${opt.g}:${opt.o} (${opt.name}) would write (${wrote.map((q) => q.key).join(", ")}): stopped, and held`);
        /* Timers the press armed would otherwise fire under the next press and be read as its own. */
        await page.evaluate(() => window.__sinkPress?.releaseAll()).catch(() => {});
        continue;
      }
      await page.evaluate(() => scrollTo(0, 0));
      await markRoles();
      /* A page that could not be read after the press (it was still changing, or went): no state, and the page loaded again before the next. */
      const now = await page.evaluate(DUMP, { sheets, paths: true }).catch((e) => { console.error(`state ${opt.g}:${opt.o} (${opt.name}): the page could not be read after it (${String(e.message ?? e).split("\n")[0]})`); return null; });
      if (!now?.tree) { dirty = true; continue; }
      tlap("read");
      const nowIdx = index(now.tree);
      /* The distances a block of the page was pushed by, all at once (five or more elements, only moved up or down by exactly that): room made for what the press opened. */
      const roomFor = new Set();
      const heldIt = new Set();
      const growths = new Set();
      {
        const n = new Map();
        for (const [p, e] of nowIdx) { const b = baseIdx.get(p); if (!b || noisy(p) || OWN(b) !== OWN(e) || !paints(e)) continue; if (Math.abs(b.w - e.w) <= 2 && Math.abs(b.h - e.h) <= 2 && Math.abs(b.x - e.x) <= 2 && Math.abs(b.y - e.y) > 2) { const dy = Math.round(e.y - b.y); n.set(dy, (n.get(dy) ?? 0) + 1); } }
        /*
         * …and only when the press put something new into the page about that
         * tall: a block moved as a reveal settles is not making room. What came
         * is measured whole: everything new under one parent, top to bottom
         * (gotchi.gg's games panel draws nothing itself, its buttons do; a
         * list filled into a box that was there, empty); a centred column is
         * pushed by half of what the rest was.
         */
        const spans = new Map();
        for (const [p, e] of nowIdx) { if (baseIdx.has(p) || !(e.h > 0) || !e.__up?.p || !baseIdx.has(e.__up.p)) continue; const sp = spans.get(e.__up.p) ?? { top: Infinity, bottom: -Infinity }; sp.top = Math.min(sp.top, e.y); sp.bottom = Math.max(sp.bottom, e.y + e.h); spans.set(e.__up.p, sp); }
        const opened = [...[...nowIdx].filter(([p, e]) => !baseIdx.has(p) && e.h > 0 && paints(e)).map(([, e]) => e.h), ...[...spans.values()].map((sp) => sp.bottom - sp.top)];
        /*
         * The parts that grew to hold it: showing before, holding something new,
         * as wide and where they were across, and taller by no more than what
         * came (a pane that opens from nothing is what came). What they grew
         * by is room made too: a row centred on its height grows by less than
         * its panel when its other column was taller.
         */
        const newRoots = [...nowIdx].filter(([p, e]) => !baseIdx.has(p) && e.__up?.p && baseIdx.has(e.__up.p)).map(([p]) => p);
        const most = Math.max(0, ...opened);
        for (const [p, e] of nowIdx) { const b = baseIdx.get(p); if (!b || noisy(p) || b.h <= 2 || !newRoots.some((q) => q.startsWith(`${p}>`))) continue; const dh = Math.round(e.h - b.h); if (Math.abs(b.w - e.w) <= 2 && Math.abs(b.x - e.x) <= 2 && dh > 2 && dh <= most + 48) { growths.add(dh); heldIt.add(p); } }
        const makesRoom = (d) => opened.some((h) => d >= h - 2 && d <= h + 48) || [...growths].some((g) => Math.abs(d - g) <= 2);
        for (const [dy, k] of n) if (k >= 5 && makesRoom(Math.abs(dy))) roomFor.add(dy);
        /* A centred column (or what is centred in the part that grew) moves by half, either way. */
        const rooms0 = [...roomFor, ...growths].map((d) => Math.abs(d));
        for (const [dy] of n) if (rooms0.some((r) => Math.abs(2 * Math.abs(dy) - r) <= 4)) roomFor.add(dy);
      }
      const changed = [];
      const why = [];
      /* The room the press made, for places that moved with it (sameLook). */
      const rooms = [...new Set([...roomFor, ...growths].map((d) => Math.abs(d)))];
      const mine = trigger ?? opt.trigger;
      const own = (p) => !!mine && (p === mine || p.startsWith(`${mine}>`));
      for (const [p, e] of nowIdx) {
        /* What changes on its own is no press's, but for the control pressed: a sound button the first gesture switched, switched back by its own press, told against the page as the press found it. */
        /* The control pressed, its mark switched (selected, pressed, checked, expanded, current): a press's plainest doing, though its look may not move (a tab marked by aria-selected alone, over a list that is live). */
        const marks = (x) => JSON.stringify(x?.state ?? null);
        if (noisy(p)) { const o = opened?.get(p); if ((own(p) && o && (!sameLook(o, e) || marks(o) !== marks(e))) || liveMoved(p, e, o)) changed.push(p); continue; }
        const b = baseIdx.get(p);
        if (b && own(p) && marks(b) !== marks(e) && sameLook(b, e)) { changed.push(p); continue; }
        /* A canvas that repaints on its own is unchanged while it shows a picture it was seen showing. */
        /*
         * A canvas that repaints on its own: changed when a picture it showed after the press is one it was not seen showing. One the press did
         * not watch (far from it) is not said to have changed: a still read of it proves only that its own loop moved on.
         */
        if (b && b.t === "canvas" && e.t === "canvas" && b.frames?.frames?.length) {
          const seen = new Set([...b.frames.frames, b.drawn]);
          if (e.frames?.frames?.some((f) => !seen.has(f))) changed.push(p);
          continue;
        }
        /* Moved: its box changed; but pushed down or up by the same distance as the rest of a block (something opened above it) is the page making room, not the press's change. */
        const pure = b && paints(e) && Math.abs(b.w - e.w) <= 2 && Math.abs(b.h - e.h) <= 2 && Math.abs(b.x - e.x) <= 2 && Math.abs(b.y - e.y) > 2;
        const moved = b && paints(e) && !heldIt.has(p) && (Math.abs(b.w - e.w) > 2 || Math.abs(b.h - e.h) > 2 || Math.abs(b.x - e.x) > 2 || (Math.abs(b.y - e.y) > 2 && !(pure && roomFor.has(Math.round(e.y - b.y)))));
        /* Pushed by the room made, its page-space matrix moved with it: told with that push taken out. */
        const pushed = pure && roomFor.has(Math.round(e.y - b.y));
        /* Only what the room moved: pushed, grown to hold what came, or pinned inside what grew. */
        const roomy = pushed || heldIt.has(p) || (!!e.__up?.p && heldIt.has(e.__up.p));
        const looks = !!b && (sameLook(b, e) || (roomy && (sameLook(b, e, rooms) || (Array.isArray(e.ptf) && sameLook(b, { ...e, ptf: e.ptf.map((v, i) => (i === 5 ? v - (e.y - b.y) : v)) }, rooms)))));
        if (!b || !looks || moved) {
          changed.push(p);
          if (why.length < 3) { const ob = b ? JSON.parse(OWN(b)) : {}; const oe = JSON.parse(OWN(e)); why.push(`${p}: ${!b ? "new" : moved ? "moved" : Object.keys({ ...ob, ...oe }).filter((k) => JSON.stringify(ob[k]) !== JSON.stringify(oe[k])).join(",")}`); }
        }
      }
      /* A question opened (details > summary) shows what came into its own details; what below it only moved down made room for it (check-details.mjs). */
      const inside = trigger && /summary:\d+$/.test(trigger) ? trigger.replace(/>summary:\d+$/, "") : null;
      if (inside) for (let i = changed.length - 1; i >= 0; i--) if (!changed[i].startsWith(`${inside}>`)) changed.splice(i, 1);
      const gone = [...baseIdx.keys()].filter((p) => !nowIdx.has(p) && !noisy(p) && (!inside || p.startsWith(`${inside}>`)));
      const within = (p, set) => { for (let n = (nowIdx.get(p) ?? baseIdx.get(p))?.__up; n; n = n.__up) if (n.p && set.has(n.p)) return true; return false; };
      /*
       * Put in or taken out before the press (a row a hero redraws on its own
       * schedule, between the page's first read and this press): no node went
       * in or out there while the press was made, so it is not the press's.
       * Only what is added or gone is told this way; a look can change with
       * no node touched (a checkbox's :checked).
       */
      {
        const nb = await page.evaluate(({ plus, minus }) => window.__sinkPress?.notByPress?.(plus, minus) ?? { plus: [], minus: [] }, { plus: changed.filter((p) => !baseIdx.has(p) && !p.includes("::")), minus: gone.filter((p) => !p.includes("::")) }).catch(() => ({ plus: [], minus: [] }));
        const drop = new Set([...nb.plus, ...nb.minus]);
        if (drop.size) {
          if (process.env.SINK_DEBUG_PRESSES) console.error(`not ${opt.name}'s: ${drop.size} added or gone before it (${[...drop].slice(0, 3).join(" | ")})`);
          for (let i = changed.length - 1; i >= 0; i--) if (drop.has(changed[i])) changed.splice(i, 1);
          for (let i = gone.length - 1; i >= 0; i--) if (drop.has(gone[i])) gone.splice(i, 1);
        }
      }
      /* The page itself changed too (a scroll lock, a class on <body> as a menu opens): its own look is not the state, what changed inside it is. */
      if (changed.length > 1) { const r = changed.indexOf("body"); if (r >= 0) changed.splice(r, 1); }
      touched = { added: changed.filter((p) => !baseIdx.has(p)), removed: gone };
      if (process.env.SINK_DEBUG_PRESSES) console.error(`changed ${opt.name}: ${changed.slice(0, 12).join(" | ")} ; room ${[...roomFor].join(",")}`);
      const all = new Set([...changed, ...gone]);
      if (!all.size) { if (process.env.SINK_DEBUG_PRESSES) console.error(`state ${opt.g}:${opt.o} (${opt.name}): nothing changed (mutations ${did.count})`); continue; }
      /* A button on its own that brought up a wallet's dialog: not a state of the page, a press held for a wallet. */
      const textIn = (e, out = []) => { if (e.text) out.push(e.text); for (const k of e.kids ?? []) if (out.length < 200) textIn(k, out); return out.join(" "); };
      if (opt.single && [...changed].some((p) => { const e = nowIdx.get(p); return e && !baseIdx.has(p) && (/dialog/i.test(`${e.role ?? ""} ${e.t ?? ""}`) || e.state?.includes?.("modal")) && WALLET_WORDS.test(textIn(e)); })) {
        const live = await page.evaluate((sel) => { const el = document.querySelector(sel); if (!el) return null; const out = []; for (let n = el; n && n !== document.body; n = n.parentElement) { let i = 1; for (let s = n.previousElementSibling; s; s = s.previousElementSibling) if (s.localName === n.localName) i++; out.unshift(`${n.localName}:nth-of-type(${i})`); } return `body > ${out.join(" > ")}`; }, sel).catch(() => null);
        heldPresses.push({ trigger, held: "wallet", hook: "asks to connect a wallet", label: opt.name, control: opt.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || `press-${opt.g}-${opt.o}`, selector: live });
        console.error(`state ${opt.g}:${opt.o} (${opt.name}) asks for a wallet: held`);
        continue;
      }
      /*
       * A chosen tab's panel is a state however much of the page it fills
       * (gotchi.gg's shop: each tab swaps a shelf that is most of the page):
       * the control pressed is marked chosen now (selected, pressed, checked,
       * current) and the page's own look is as it was. A theme switched, or a
       * press that swaps the page with no choice marked, is still the whole
       * page.
       */
      /*
       * What was there and changed or went: a dialog or a search that opens
       * over a small page with more parts than the page has is new, not the
       * page changed (stonkfun.xyz's search on its disclaimers).
       */
      const wasThere = [...all].filter((p) => baseIdx.has(p)).length;
      const chosenPanel = wasThere > total * 0.4 && !!trigger && (() => { const b = baseIdx.get("body"), e = nowIdx.get("body"); return !b || !e || sameLook(b, e); })() && (await page.evaluate((p) => { const el = window.__sinkAt?.(p); if (!el) return false; const on = (a) => el.getAttribute(a) === "true"; return on("aria-selected") || on("aria-pressed") || on("aria-checked") || (!!el.getAttribute("aria-current") && el.getAttribute("aria-current") !== "false"); }, trigger).catch(() => false));
      if (wasThere > total * 0.4 && !chosenPanel) { console.error(`state ${opt.g}:${opt.o} (${opt.name}) changed ${wasThere} of ${total} elements: the whole page, not a state of it (${why.join("; ")})`); continue; }
      const tops = [...all].filter((p) => !within(p, all));
      /*
       * WHAT IT FLASHED (presses.mjs). The press's timers were held while the
       * page was read; let go one by one, each puts back what it puts back,
       * and when (`lasts`, ms after the press, by place). A place that came
       * in from somewhere (a toast set below the window, slid up by a
       * transition) keeps where it came from, so it can come the same way:
       * `from`, its move and opacity as the page held it before the press.
       */
      const lasts = await holdAfterPress(page, tops);
      const from = {};
      for (const p of tops) {
        const b = baseIdx.get(p), e = nowIdx.get(p);
        if (!b || !e) continue;
        const shift = (t) => { const m = /matrix\(([^)]+)\)/.exec(t ?? ""); const v = m ? m[1].split(",").map(Number) : [1, 0, 0, 1, 0, 0]; return { x: v[4] || 0, y: v[5] || 0 }; };
        const sb = shift(b.tf), se = shift(e.tf);
        const dx = Math.round(sb.x - se.x), dy = Math.round(sb.y - se.y);
        const op = b.op ?? 1;
        /* Across only when it kept its width: a move written in % of its own width (`translate(-50%, 220px)`) shifts with the words it was given. */
        const across = b.w === e.w ? dx : 0;
        if (across || dy || op !== (e.op ?? 1)) from[p] = { ...(across ? { x: across } : {}), ...(dy ? { y: dy } : {}), ...(op !== (e.op ?? 1) ? { opacity: op } : {}) };
      }
      if (Object.keys(lasts).length) console.error(`state ${opt.g}:${opt.o} (${opt.name}) flashes: ${Object.entries(lasts).map(([p, ms]) => `${p} for ${ms} ms`).join(", ")}`);
      states.push({
        ...(Object.keys(lasts).length ? { lasts } : {}), ...(Object.keys(from).length ? { from } : {}),
        group: opt.g, option: opt.o, name: opt.name, trigger,
        changes: tops.map((p) => {
          const e = nowIdx.get(p), up = e?.__up?.p ?? baseIdx.get(p)?.__up?.p ?? null;
          return { at: p, el: e ? structuredClone(strip(e)) : null, ...(up ? { parent: up } : {}) };
        }),
      });
      } finally {
        results.set(`${opt.g}:${opt.o}`, { trigger: triggers.get(`${opt.g}:${opt.o}`), states: states.slice(before.s), links: pressedOut.slice(before.p), held: heldPresses.slice(before.h) });
        /* `--reload-each`: the page loaded again after every press, as before undoing in place (for the checks' comparison). */
        if (flag("--reload-each")) dirty = true;
        else if (!dirty && undo) { if (await undoPress(cur, found, group, pre, touched)) undone++; else dirty = true; }
        /* A page load this press costs: counted, for the run's summary. */
        if (dirty) loadsAfter++;
        tlap(dirty ? "undo(failed)" : "undo");
        if (timing) console.error(`timing ${opt.g}:${opt.o} (${opt.name}): ${timing.laps.join(", ")} s`);
      }
    }
  }
  /*
   * WHAT A TWIN DOES, TOLD. Each twin gets its representative's result in its
   * own words: its own path for the representative's, its item's for its
   * item's, and each piece of the representative's content (a ticker, an
   * address, a picture) replaced by the twin's at the same place. Marked
   * `inferred`, with what it was inferred from.
   */
  const swap = (v, subs) => { if (typeof v !== "string") return v; let out = v; for (const [a, b] of subs) if (out.includes(a)) out = out.split(a).join(b); return out; };
  const repath = (p, from, to) => (typeof p === "string" && from && to && (p === from || p.startsWith(`${from}>`) || p.startsWith(`${from}::`)) ? to + p.slice(from.length) : p);
  const deep = (v, subs, from, to) => {
    if (Array.isArray(v)) return v.map((x) => deep(x, subs, from, to));
    if (v && typeof v === "object") { const o = {}; for (const [k, x] of Object.entries(v)) o[k] = k === "p" || k === "at" || k === "parent" ? repath(x, from, to) : deep(x, subs, from, to); return o; }
    return swap(v, subs);
  };
  for (const group of groups) {
    for (const opt of group) {
      if (opt.twinOf == null) continue;
      const r = results.get(`${opt.twinOf}:${opt.o}`);
      if (!r) continue;
      const from = { from: r.trigger };
      const subs = opt.subs ?? [];
      for (const st of r.states) { states.push({ ...deep(st, subs, opt.repItem, opt.item), group: opt.g, option: opt.o, name: opt.name, trigger: opt.trigger, inferred: from }); inferredN++; }
      for (const x of r.links) { pressedOut.push({ ...x, trigger: opt.trigger, name: opt.name, ...(x.href ? { href: swap(x.href, subs) } : {}), ...(x.copy != null ? { copy: swap(x.copy, subs) } : {}), inferred: from }); inferredN++; }
      for (const h of r.held) { heldPresses.push({ ...h, trigger: opt.trigger, label: opt.name, selector: opt.live, inferred: from }); inferredN++; }
    }
  }
  /* Read idle once more after every press: what has changed on its own since (a clock gone from "3m ago" to "4m ago") is no press's either. */
  if (states.length && (await fresh())) {
    await page.waitForTimeout(800);
    await markRoles();
    const late = index((await page.evaluate(DUMP, { sheets, paths: true })).tree);
    const drift = new Set();
    for (const [p, e] of late) { const b = baseIdx.get(p); if (b && !(b.t === "canvas") && !sameLook(b, e)) drift.add(p); }
    if (process.env.SINK_DEBUG_STATES) console.error(`drift: ${[...drift].join(" | ")}`);
    /* But a control's own change on its own press (the sound button, switched by the first gesture and back by its press). */
    for (const st of states) st.changes = st.changes.filter((c) => !drift.has(c.at) || (st.trigger && (c.at === st.trigger || c.at.startsWith(`${st.trigger}>`))) || (c.el && liveMoved(c.at, c.el, late.get(c.at))));
    for (let i = states.length - 1; i >= 0; i--) if (!states[i].changes.length) states.splice(i, 1);
    if (drift.size) console.error(`states: ${drift.size} more elements changed on their own while the presses were read; taken out of them`);
  }
  /*
   * THE PAGE AS IT OPENED IS A PRESS TOO. gotchi.gg opens with mochi chosen;
   * pressing mochi there changes nothing, so no state was kept for it, and
   * once pup was pressed mochi could not be chosen again. Each group whose
   * other options were kept gets its opening option (the one pressed,
   * selected, checked or current as the page opens; a row of plain buttons
   * marks none, and has no opening choice) as a press of its own: it shows the page's own
   * elements at every place the group's other presses change (`opens`, no
   * copy of them: they are the page's), besides whatever its own press
   * changed. Pressed after another, it puts back exactly the page as it
   * opened there.
   */
  for (const group of groups) {
    const others = states.filter((st) => st.group === group[0]?.g);
    if (!others.length) continue;
    const opening = group.filter((o) => o.on && triggers.has(`${o.g}:${o.o}`));
    const places = [...new Set(others.flatMap((st) => st.changes.map((c) => c.at)))].filter((p) => baseIdx.has(p));
    const tops = places.filter((p) => !places.some((q) => q !== p && (p.startsWith(`${q}>`) || p.startsWith(`${q}::`))));
    if (!tops.length) continue;
    for (const o of opening) {
      let st = states.find((x) => x.group === o.g && x.option === o.o);
      if (!st) { st = { group: o.g, option: o.o, name: o.name, trigger: triggers.get(`${o.g}:${o.o}`), changes: [] }; states.push(st); }
      st.opening = true;
      const own = (p) => st.changes.some((c) => c.at === p || p.startsWith(`${c.at}>`) || p.startsWith(`${c.at}::`));
      for (const p of tops) {
        if (own(p)) continue;
        const up = baseIdx.get(p)?.__up?.p ?? null;
        st.changes.push({ at: p, opens: true, ...(up ? { parent: up } : {}) });
      }
    }
  }
  states.sort((a, b) => a.group - b.group || a.option - b.option);
  strip(cap.tree);
  if (states.length) cap.states = states;
  console.error(`states: ${states.length} kept from ${groups.length} groups (${groups.map((g) => g.length).join(", ")} options)`);
  console.error(`presses: ${presses} pressed, ${inferredN} told to their twins, ${reloads} page loads (${loadsAfter} after a press, ${undone} presses undone in place)`);
  cap.pressStats = { presses, inferred: inferredN, loads: reloads, afterPress: loadsAfter, undone };
  await guard.dispose();
  if (heldPresses.length) cap.heldPresses = heldPresses;
  if (pressedOut.length) cap.pressed = pressedOut;
  net?.phase("open");
  await restore();
  await page.goto(url, { waitUntil: "load" }).catch(() => {});
}
if (behaved) cap.behaviours = behaved;
lap("states");
/*
 * THE LOADING SCREEN AS IT LOOKED (sunkcoin.fun, J 2026-10-11: "the loading
 * screen also looks like this not the full screen animation"). The
 * behaviours pass kept a loader as its words, pictures and times, and the
 * Builder dressed those in a loader of its own (the CRT one), which is not
 * the site's. So one more load, after everything else has been read: the
 * window pictured while the loader stands over it, from when it was first
 * seen to when it started to switch off (`nav.shown` to `nav.off`), a frame
 * every `--loader-every` ms (120), at most 24, a frame the screen already
 * showed kept once. The converter makes them one svg that plays once and
 * holds its last picture (`behaviours.loader.film`); the Builder shows it
 * full window as the page opens and fades it as the page did.
 */
if (behaved && !flag("--no-loader-film") && late()) leftOut("the loader's film");
else if (behaved && !flag("--no-loader-film")) {
  const l = (behaved.loaders ?? []).find((x) => (x.words ?? []).length || (x.pictures ?? []).length);
  const from = Number(l?.nav?.shown), to = Number(l?.nav?.off ?? l?.nav?.gone);
  if (l && Number.isFinite(from) && Number.isFinite(to) && to > from) {
    const every = Math.max(60, Number(opt("--loader-every", 120)));
    const frames = [], times = [];
    let last = null;
    /*
     * Its times from the earlier load are only a guide: a page that read its
     * data faster this time goes sooner. So each look also asks whether the
     * loader stands whole over the window: its words drawn, and nothing
     * round them faded (every ancestor's opacity multiplied). Pictures are
     * kept from when it does until it no longer does, or the old times
     * have run out a second over.
     */
    const words = (l.words ?? []).map((w) => w.text).filter(Boolean).slice(0, 2);
    const standing = (ws) => {
      const want = ws.map((w) => w.replace(/\s+/g, " ").trim()).filter(Boolean);
      if (!want.length) return null;
      const walker = document.createTreeWalker(document.body ?? document.documentElement, NodeFilter.SHOW_TEXT);
      for (let t = walker.nextNode(); t; t = walker.nextNode()) {
        const said = (t.textContent ?? "").replace(/\s+/g, " ").trim();
        if (!said || !want.some((w) => said === w || said.startsWith(w))) continue;
        const el = t.parentElement;
        const r = el?.getBoundingClientRect();
        if (!r || r.width < 1 || r.height < 1) continue;
        let o = 1;
        for (let e = el; e && o > 0; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.visibility === "hidden" || cs.display === "none") o = 0; else o *= Number(cs.opacity); }
        if (o >= 0.95) return true;
      }
      return false;
    };
    /* As a first visit: nothing cached, so the loader stands as long as a newcomer sees it, not the moment a cached reload gives it. */
    try { const cdp = await page.context().newCDPSession(page); await cdp.send("Network.clearBrowserCache"); await cdp.detach(); } catch { /* not Chromium: a cached load */ }
    await page.goto(url, { waitUntil: "commit" }).catch(() => null);
    const t0 = Date.now();
    let seen = false;
    let end = to;
    while (Date.now() - t0 < to + 4000 && frames.length < 24) {
      const look = await page.evaluate(standing, words).then((up) => ({ up })).catch(() => null);
      const now = await page.evaluate(() => performance.now()).catch(() => null);
      if (now === null || look === null) { await page.waitForTimeout(30); continue; }
      if (look.up === false) { if (seen) { end = now; break; } if (now > to + 1000) break; await page.waitForTimeout(30); continue; }
      if (look.up === null && now >= to) break;
      if (look.up === null && now < from) { await page.waitForTimeout(Math.min(every, from - now)); continue; }
      seen = true;
      const buf = await page.screenshot({ type: "jpeg", quality: 65 }).catch(() => null);
      if (!buf) continue;
      if (last && Buffer.compare(last, buf) === 0) { times[times.length - 1] = now; continue; }
      last = buf;
      frames.push(`data:image/jpeg;base64,${buf.toString("base64")}`);
      times.push(now);
      await page.waitForTimeout(Math.max(0, every - 40));
    }
    if (frames.length) {
      /* Each picture stood until the next one came; the last until the switch-off. */
      if (!(end > times.at(-1))) end = times.at(-1) + every;
      const steps = frames.map((_, i) => [i, Math.max(1, Math.round((i + 1 < times.length ? times[i + 1] : end) - times[i]))]);
      const vp = page.viewportSize() ?? { width: 1440, height: 900 };
      l.film = { frames, steps, w: vp.width, h: vp.height, from: Math.round(times[0]), to: Math.round(end) };
      console.error(`loader: ${frames.length} pictures of it over ${Math.round(end - times[0])} ms`);
    }
    await page.waitForLoadState("load").catch(() => {});
  }
}
lap("loader film");
/* How much the worlds were pressed, and how much told (worlds.mjs, NO PRESS TWICE). */
{ const ws = await page.evaluate(() => window.__sinkWorlds?.stats ?? null).catch(() => null); if (ws) cap.worldStats = ws; }
if (net) { await page.waitForTimeout(300); await net.flush(); cap.network = net.report(); console.error(`network: ${cap.network.endpoints.length} endpoints (${cap.network.endpoints.filter((e) => e.read).length} reads)`); }
if (watch !== null) cap.sources = await page.evaluate(() => window.__sinkSources?.report() ?? null);
if (section) cap.section = section;
if (click) cap.reached = { click, within };
if (flag("--wallet")) cap.wallet = "stand-in";
if (failedReq.size) { cap.missing = [...failedReq].map(([u, t]) => ({ url: u, type: t })); console.error(`still cut after asking again: ${[...failedReq].map(([u, t]) => `${t} ${u}`).join(", ")}`); }

/*
 * The faces a cross-origin stylesheet declares (Google Fonts, a CDN): the
 * page cannot read its rules, so the dump listed only the link. Fetched
 * here with the browser's own user agent, so the server answers with the
 * files it would give the browser (woff2), and read as text.
 */
/*
 * IN THE ORDER THE PAGE DECLARED THEM. Two rules of one family whose ranges
 * overlap are settled by order: the browser takes the one declared last.
 * gotchi.gg declares Google's Pixelify Sans (all of Latin) and then its own
 * digits-only Pixelify Sans (U+30-39), and its digits are drawn in its own;
 * a cross-origin sheet's faces appended after everything would turn that
 * round. So each is set where its link stood (`at`).
 */
lap("network");
const ownFaces = cap.faces.faces;
const linkFaces = new Map();
for (const link of cap.faces.links ?? []) {
  const css = sheetText.get(link.href) ?? (await fetchBytes(link.href))?.toString("utf8");
  if (css === undefined) { console.error(`could not read stylesheet ${link.href}`); continue; }
  const abs = (u) => { try { return new URL(u, link.href).href; } catch { return u; } };
  for (const m of css.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    const body = m[1];
    const prop = (n) => (body.match(new RegExp(`(?:^|;)\\s*${n}\\s*:\\s*([^;]+)`)) ?? [])[1]?.trim() ?? "";
    const fam = prop("font-family").replace(/^["']|["']$/g, "");
    const sources = [];
    for (const u of prop("src").matchAll(/url\((["']?)([^)"']+)\1\)(?:\s*format\((["']?)([^)"']+)\3\))?/g)) sources.push({ url: abs(u[2]), ...(u[4] ? { format: u[4] } : {}) });
    if (!fam || !sources.length) continue;
    const weight = prop("font-weight"), style = prop("font-style"), range = prop("unicode-range");
    if (!linkFaces.has(link)) linkFaces.set(link, []);
    linkFaces.get(link).push({ family: fam, ...(weight ? { weight } : {}), ...(style ? { style } : {}), sources, sheet: link.href, ...(range ? { unicodeRange: range } : {}) });
  }
  link.read = true;
}
{
  const at = (l) => (Number.isInteger(l.at) ? Math.min(l.at, ownFaces.length) : ownFaces.length);
  const ordered = [];
  for (let i = 0; i <= ownFaces.length; i++) {
    for (const [l, fs] of linkFaces) if (at(l) === i) ordered.push(...fs);
    if (i < ownFaces.length) ordered.push(ownFaces[i]);
  }
  cap.faces.faces = ordered;
}

/* The bytes: pictures the page shows and the font files its faces name, one file per address. */
if (assets) {
  mkdirSync(assets, { recursive: true });
  /* An svg kept whole (dump.mjs#svgWhole, #maskWhole) is a file of its own, named by its bytes; a mask it names by address is fetched and written in, since a picture drawn as a file loads nothing. */
  const inlined = new Map();
  const wholes = [];
  (function whole(e) { if (e.svgMarkup) wholes.push(e); (e.kids ?? []).forEach(whole); })(cap.tree);
  for (const st of cap.states ?? []) for (const c of st.changes) if (c.el) (function whole(e) { if (e.svgMarkup) wholes.push(e); (e.kids ?? []).forEach(whole); })(c.el);
  for (const e of wholes) {
    /* A mask's address (its href beside the mark) or an <image>'s in a drawing kept whole (the mark anywhere in its tag). */
    const toInline = [...e.svgMarkup.matchAll(/href="([^"]+)" data-sink-inline="1"/g), ...[...e.svgMarkup.matchAll(/<image\b[^>]*\bdata-sink-inline="1"[^>]*>/g)].map((t) => /\bhref="([^"]+)"/.exec(t[0])).filter((h) => h && !/^data:/.test(h[1]))];
    for (const m of toInline) {
      const address = m[1].replace(/&amp;/g, "&");
      if (!inlined.has(address)) {
        const bytes = await fetchBytes(new URL(address, cap.url).href);
        const type = /\.svg(\?|#|$)/i.test(address) ? "image/svg+xml" : /\.png(\?|#|$)/i.test(address) ? "image/png" : /\.webp(\?|#|$)/i.test(address) ? "image/webp" : /\.jpe?g(\?|#|$)/i.test(address) ? "image/jpeg" : /\.gif(\?|#|$)/i.test(address) ? "image/gif" : /\.avif(\?|#|$)/i.test(address) ? "image/avif" : "image/svg+xml";
        inlined.set(address, bytes ? `data:${type};base64,${bytes.toString("base64")}` : null);
        if (!bytes) console.error(`could not fetch mask ${address}`);
      }
      const data = inlined.get(address);
      if (data) e.svgMarkup = e.svgMarkup.replace(m[0], `href="${data}"`);
    }
    e.svgFile = `svg-${createHash("sha1").update(e.svgMarkup).digest("hex").slice(0, 12)}.svg`;
    writeFileSync(join(assets, e.svgFile), e.svgMarkup);
    delete e.svgMarkup;
  }
  /* A video with no poster: the frame it shows as the page opens, as a canvas keeps what it drew (check-media.mjs). */
  const videos = [];
  (function walk(e) { if (e.t === "video" && e.video) videos.push(e); (e.kids ?? []).forEach(walk); })(cap.tree);
  /* The video's own file, downloaded like a picture (up to 60 MB): the site plays it from itself, never from the address it was captured at (check-media.mjs (4)). */
  const videoFiles = new Map();
  for (const v of videos) {
    const address = v.video.src;
    if (!address || /^blob:|^data:/.test(address)) continue;
    if (!videoFiles.has(address)) {
      const bytes = await fetchBytes(address);
      let name = null;
      if (bytes && bytes.length > 0 && bytes.length <= 60 * 1024 * 1024) {
        const ext = (/\.(mp4|webm|mov|m4v|ogv|ogg)(\?|#|$)/i.exec(address)?.[1] ?? "mp4").toLowerCase();
        name = `video-${createHash("sha1").update(bytes).digest("hex").slice(0, 12)}.${ext}`;
        writeFileSync(join(assets, name), bytes);
      } else console.error(`could not keep video ${address}${bytes ? ` (${bytes.length} bytes)` : ""}`);
      videoFiles.set(address, name);
    }
    if (videoFiles.get(address)) v.video.file = videoFiles.get(address);
  }
  for (const v of videos) {
    if (v.src) { delete v.video.at; continue; }
    const shot = await page.locator("video").nth(v.video.at).screenshot({ timeout: 5000, animations: "disabled" }).catch((err) => { console.error(`video ${v.video.at}: no frame (${String(err.message ?? err).split("\n")[0]})`); return null; });
    if (shot) v.drawn = `data:image/png;base64,${shot.toString("base64")}`;
    delete v.video.at;
  }
  const srcs = new Set();
  const urlsIn = (v) => Array.from(v.matchAll(/url\((["']?)([^)"']+)\1\)/g)).map((m) => m[2]).filter((u) => !/^data:/.test(u));
  (function walk(e) {
    /* A `data:` picture holds its own bytes, kept in the capture: nothing to fetch (check-script-built.mjs (3)). */
    if (e.src && !/^data:/i.test(e.src)) srcs.add(e.src);
    /* A background picture, by its absolute address (the browser computes `url()` absolute). */
    if (e.bgi) for (const u of urlsIn(e.bgi)) { try { srcs.add(new URL(u, cap.url).href); } catch { /* not an address */ } }
    (e.kids ?? []).forEach(walk);
  })(cap.tree);
  for (const f of cap.faces.faces) for (const s of f.sources) if (/^https?:/.test(s.url)) srcs.add(s.url);
  /* The head's share picture and icons (check-head.mjs); a manifest is kept as its address. */
  for (const [k, v] of Object.entries(cap.head?.meta ?? {})) if (/^(og:image(:url|:secure_url)?|twitter:image(:src)?)$/i.test(k) && /^https?:/.test(v)) srcs.add(v);
  for (const l of cap.head?.links ?? []) if (l.rel !== "manifest" && /^https?:/.test(l.href)) srcs.add(l.href);
  /* Six at a time (a font-heavy page names dozens), each written as it lands; one address, one file (asset-name.mjs): by file name alone, every `/_next/image?url=…` was one picture. */
  const queue = [...srcs].filter((src) => !existsSync(join(assets, assetName(src))));
  await Promise.all(Array.from({ length: Math.min(6, queue.length) }, async () => {
    while (queue.length) {
      const src = queue.shift();
      const file = join(assets, assetName(src));
      if (existsSync(file)) continue;
      const bytes = await fetchBytes(src);
      if (!bytes) { console.error(`could not fetch ${src}`); continue; }
      writeFileSync(file, bytes);
    }
  }));
}
lap("faces+assets");

await browser.close();
console.error(`took: ${laps.join(", ")} s, ${((Date.now() - laps.t0) / 1000).toFixed(1)} s in all`);
mkdirSync(join(out, ".."), { recursive: true });
writeFileSync(out, JSON.stringify(cap));
let n = 0; (function count(e) { n++; (e.kids ?? []).forEach(count); })(cap.tree);
console.log(`${out}: ${n} elements, page ${cap.page[0]}×${cap.page[1]}, ${cap.faces.faces.length} face rules, ${cap.keyframes?.length ?? 0} keyframes rules${click ? `, after pressing "${click}"` : ""}${cap.sources ? `, ${cap.sources.sources.length} sources feeding ${marked} elements` : ""}${behaved ? `, behaviours: ${behaved.loaders.length} loader, ${behaved.intro.length} intro, ${behaved.reveal.length} reveal, ${behaved.scrolled.length} scrolled, ${behaved.pointer.length} pointer, ${behaved.loops.length} loops, ${behaved.forever.length} forever` : ""}`);
