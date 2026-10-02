#!/usr/bin/env node
/**
 * LEARN ON CLICK, CAPTURE SIDE: the held presses the owner chose, pressed.
 *
 * An automatic capture only looks: what would write to a server, ask for a
 * wallet or leave the site is held (`doc.held`, held.mjs and worlds.mjs).
 * The Builder lets the owner choose held server calls to Learn, and sends
 * them to the capture workflow as its `learn` input:
 *
 *   { targets: [{ page, part, control, selector, values }], pressesPerControl: 1, stopOnWallet: true, cap }
 *
 * This presses those and nothing else, on the live site, after the capture:
 *
 *   - only a control the fresh capture still holds as a server call (a
 *     wallet control is never pressed; off the site is not a press);
 *   - each at most once, at least 2 s after the one before, no more than
 *     `cap` in the run;
 *   - a form gets the values the owner typed (name=value), and only those;
 *   - a wallet prompt ends the run where it is seen: a provider asked to
 *     connect or sign (a stand-in that refuses everything: nothing is ever
 *     connected or signed), or a dialog that asks for a wallet;
 *   - a terms or cookie gate is hidden, never agreed to (`--hide-gate`);
 *   - a control inside a canvas world's dialog is reached as the capture
 *     reached it: the world's frames held, its sprites pressed until its
 *     character's dialog opens (nothing leaves while it looks), then pressed
 *     by its recorded place in that dialog (`openCharacter`, `controlAt`).
 *
 * What each press did is recorded: the requests it made and their answers
 * (network.mjs: addresses redacted, sample answers with secrets out, what
 * was sent as its shape only, never the owner's values), and the screen it
 * left (a picture, the address, the words of any dialog or alert). The
 * document gets `learned` (one entry a control pressed, with the part it is
 * on in this capture) and `learned: true` on its held entry, so the Builder
 * clears the orange mark; `learn/run.json` holds the whole run, and the
 * API map gains what the presses asked for.
 *
 *   node capture/site/capture/learn.mjs --site sites/<name> --url <address> --learn '<json>' [--width 1440 --height 900]
 *
 * `parseLearn` and `planLearn` are pure: `check-learn.mjs` reads them with
 * no browser, then runs a press on a STANDIN page.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { recordNetwork, mapOf, NETWORK_VERSION } from "./network.mjs";
import { HIDE_GATE } from "./held.mjs";
import { WALLET_WORDS, WORLD_RECORDER } from "./worlds.mjs";
import { isRead } from "./network.mjs";

/** At most this many presses in one run, whatever is asked. */
export const HARD_CAP = 25;
/** The least time between two presses. */
export const APART_MS = 2000;

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);
export const keyOf = (t) => `${t.part}|${t.control ?? t.selector}`;

/**
 * The request, read strictly. Anything that would press more than once, or
 * keep going past a wallet, is refused whole; a target without a page, a
 * part or a selector is left out and said.
 */
export function parseLearn(raw) {
  let j = raw;
  if (typeof raw === "string") { try { j = JSON.parse(raw); } catch { return { ok: false, says: "the learn input is not JSON" }; } }
  if (j && typeof j === "object" && j.learn && typeof j.learn === "object") j = j.learn;
  if (!j || typeof j !== "object" || !Array.isArray(j.targets)) return { ok: false, says: "the learn input has no targets" };
  if (j.pressesPerControl !== 1) return { ok: false, says: "pressesPerControl must be 1: a control is pressed at most once" };
  if (j.stopOnWallet !== true) return { ok: false, says: "stopOnWallet must be true: a wallet prompt always ends the run" };
  const cap = Math.max(0, Math.min(HARD_CAP, Math.floor(Number(j.cap) || 0)));
  const targets = [], left = [], seen = new Set();
  for (const t of j.targets) {
    const page = str(t?.page), part = str(t?.part), selector = str(t?.selector), control = str(t?.control);
    if (!page || !part || !selector) { left.push({ target: t, why: "a target needs a page, a part and a selector" }); continue; }
    const values = t.values && typeof t.values === "object" && !Array.isArray(t.values)
      ? Object.fromEntries(Object.entries(t.values).filter(([k, v]) => str(k) && typeof v === "string").map(([k, v]) => [k.trim(), v]))
      : null;
    const one = { page, part, control, selector, values: values && Object.keys(values).length ? values : null };
    if (seen.has(keyOf(one))) { left.push({ target: one, why: "asked twice: pressed once" }); continue; }
    seen.add(keyOf(one));
    targets.push(one);
  }
  return { ok: true, targets, cap, left };
}

/**
 * What will be pressed, against the fresh capture: each target matched to
 * what the document holds now (its control on that page, else its selector,
 * else its part), and refused unless it is a server call on the live page.
 * The first `cap` go; the rest are said.
 */
export function planLearn(parsed, doc, routes) {
  const held = Array.isArray(doc?.held) ? doc.held : [];
  const pathOf = new Map((routes?.pages ?? []).map((p) => [p.id, p.route ?? p.path]));
  const press = [], refused = [...(parsed.left ?? [])];
  for (const t of parsed.targets) {
    const on = held.filter((h) => h.page === t.page);
    /* Its own selector first: one part may hold many controls of one name (a world's dialogs, one a character). */
    const h = on.find((x) => x.selector === t.selector && (!t.control || x.control === t.control))
      ?? (t.control && on.find((x) => x.control === t.control && x.part === t.part))
      ?? on.find((x) => x.selector === t.selector)
      ?? (t.control ? on.find((x) => x.control === t.control) : null)
      ?? null;
    if (!h) { refused.push({ target: t, why: "this capture no longer holds it on that page" }); continue; }
    if (h.held === "wallet") { refused.push({ target: t, why: "a wallet control is never pressed" }); continue; }
    if (h.held !== "server-call") { refused.push({ target: t, why: `held: ${h.held} is not a press to learn` }); continue; }
    /* Inside a canvas world's dialog: reached by pressing its character on live, then pressed by its recorded place in the dialog. */
    const world = !h.live;
    if (world && !(Array.isArray(h.character) && h.character.length && Number.isInteger(h.el))) { refused.push({ target: t, why: "inside a canvas world's dialog, captured before its place was kept: capture again" }); continue; }
    const path = pathOf.get(t.page);
    if (!path) { refused.push({ target: t, why: "its page is not one this capture took" }); continue; }
    if (press.length >= parsed.cap) { refused.push({ target: t, why: `past today's cap of ${parsed.cap}` }); continue; }
    press.push({ target: t, held: h, path, ...(world ? { world: { characters: h.character, el: h.el } } : {}) });
  }
  return { press, refused };
}

/** Put into a page before its scripts: wallets that refuse everything, and say they were asked. Nothing is ever connected or signed. */
export const WALLET_TRAP = `(() => {
  const asked = (what) => { window.__sinkWalletAsked = window.__sinkWalletAsked || what; };
  const no = (what) => async () => { asked(what); const e = new Error("User rejected the request."); e.code = 4001; throw e; };
  const sol = { isPhantom: true, isConnected: false, publicKey: null, connect: no("connect"), disconnect: async () => {}, signTransaction: no("sign"), signAllTransactions: no("sign"), signMessage: no("sign"), signAndSendTransaction: no("sign"), request: no("request"), on() {}, off() {}, removeListener() {} };
  const eth = { isMetaMask: true, request: async (a) => { if (a && /^(eth_chainId|net_version)$/.test(a.method)) return "0x1"; if (a && a.method === "eth_accounts") return []; return no(a && a.method || "request")(); }, on() {}, removeListener() {} };
  try { Object.defineProperty(window, "phantom", { value: { solana: sol }, configurable: true }); window.solana = sol; window.ethereum = eth; } catch (e) { /* the page's own */ }
})();`;

/** Runs in the page: whether a wallet was asked for, by a provider or a dialog, and the words of any dialog or alert now shown. */
function screenNow(walletWords) {
  const W = new RegExp(walletWords, "i");
  const seen = (e) => { const cs = getComputedStyle(e), r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && cs.display !== "none" && cs.visibility !== "hidden"; };
  const boxes = Array.from(document.querySelectorAll('dialog[open], [role="dialog"], [role="alertdialog"], [aria-modal="true"], [role="alert"], [role="status"], .wallet-adapter-modal')).filter(seen);
  const said = boxes.map((b) => (b.textContent || "").replace(/\s+/g, " ").trim().slice(0, 300)).filter(Boolean);
  const walletBox = boxes.find((b) => /dialog|modal/i.test(`${b.getAttribute("role") ?? ""} ${b.localName} ${b.className}`) && W.test(b.textContent || ""));
  return { wallet: window.__sinkWalletAsked || (walletBox ? "a dialog asks for a wallet" : null), said: [...new Set(said)].slice(0, 6), title: document.title };
}

/** Runs in the page: the owner's values put into the form the control sends. Returns the names it could not find. */
function fillForm({ selector, values }) {
  const el = document.querySelector(selector);
  const form = el?.form ?? el?.closest("form");
  if (!form) return Object.keys(values);
  const missing = [];
  for (const [name, value] of Object.entries(values)) {
    const f = form.elements.namedItem(name);
    if (!f) { missing.push(name); continue; }
    const one = f instanceof RadioNodeList ? Array.from(f).find((x) => x.value === value) ?? f[0] : f;
    if (one.type === "checkbox" || one.type === "radio") one.checked = /^(1|true|on|yes)$/i.test(value) || one.value === value;
    else {
      const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(one), "value")?.set;
      if (set) set.call(one, value); else one.value = value;
    }
    one.dispatchEvent(new Event("input", { bubbles: true }));
    one.dispatchEvent(new Event("change", { bubbles: true }));
  }
  return missing;
}

/**
 * Put into the page before its scripts when a world is to be searched (an init
 * script runs whatever the page's content security policy says): the dialogs
 * open now, and the key a world's dialog names its character by, as
 * worlds.mjs reads it (its id-like data attributes and its heading).
 */
export const LEARN_HELP = `window.__sinkLearnHelp = {
  openDialogs: function () {
    var open = function (el) { var cs = getComputedStyle(el), b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0 && cs.display !== "none" && cs.visibility !== "hidden"; };
    return Array.from(document.querySelectorAll('dialog[open], [aria-modal="true"], [role="dialog"], [role="alertdialog"]')).filter(open);
  },
  dialogKey: function (d) {
    var idLike = Array.from(d.attributes).filter(function (a) { return /^data-/.test(a.name) && a.value.length >= 6 && !/\\s/.test(a.value); }).map(function (a) { return a.value; });
    var h = d.querySelector("h1,h2,h3,h4,[role=heading]");
    var head = ((h && h.textContent) || "").trim().replace(/\\s+/g, " ");
    return idLike.concat(head ? [head] : []).join("|") || d.textContent.trim().replace(/\\s+/g, " ").slice(0, 80);
  },
};`;

/**
 * A world's character found and its dialog opened, as the capture found it:
 * each canvas's frames held, the sprites its script drew pressed at their
 * middles until the dialog that opens is the one named. While it looks,
 * nothing leaves: a navigation is answered 204 (No Content) and a write is
 * stopped; a dialog of another character is closed. `window.__sinkLearnOpen`
 * is the dialog. False when no press opened it.
 */
export async function openCharacter(page, keys, { tries = 120 } = {}) {
  const want = keys.map((k) => String(k).replace(/^d:/, ""));
  let looking = true;
  const route = (r) => {
    const q = r.request();
    if (looking && q.isNavigationRequest() && q.frame() === page.mainFrame()) return r.fulfill({ status: 204, body: "" }).catch(() => {});
    if (looking && !/^(image|font|stylesheet|media|script|manifest|texttrack)$/.test(q.resourceType()) && !isRead(q.method(), (() => { try { return q.postData(); } catch { return null; } })())) return r.abort().catch(() => {});
    return r.fallback().catch(() => {});
  };
  await page.route("**/*", route);
  try {
    const has = await page.evaluate(() => !!window.__sinkWorld).catch(() => false);
    if (!has) return false;
    const canvases = await page.evaluate(() => Array.from(document.querySelectorAll("canvas")).map((c, i) => { c.setAttribute("data-sink-learn-canvas", String(i)); const r = c.getBoundingClientRect(); return { i, y: r.top + scrollY, w: r.width, h: r.height }; }).filter((c) => c.w > 40 && c.h > 40));
    let n = 0;
    for (const c of canvases) {
      const top = Math.max(0, Math.round(c.y - 40));
      for (let round = 0; round < 8 && n < tries; round++) {
        await page.evaluate((y) => scrollTo(0, y), top);
        await page.waitForTimeout(round ? 250 : 500);
        await page.evaluate(() => window.__sinkWorld.hold());
        await page.waitForTimeout(60);
        const points = await page.evaluate(({ i }) => {
          const cv = document.querySelector(`canvas[data-sink-learn-canvas="${i}"]`);
          if (!cv || !cv.width) return [];
          const r = cv.getBoundingClientRect(), k = r.width / cv.width, kh = r.height / cv.height, area = cv.width * cv.height;
          const out = [];
          for (const s of window.__sinkWorld.last(cv)) {
            if ((s.t || "img") !== "img" || !(s.w > 0 && s.h > 0) || s.w * s.h >= area / 12) continue;
            const x = r.left + (s.x + s.w / 2) * k, y = r.top + (s.y + s.h / 2) * kh;
            if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight || document.elementFromPoint(x, y) !== cv) continue;
            if (out.some((p) => Math.abs(p.x - x) < 2 && Math.abs(p.y - y) < 2)) continue;
            out.push({ x, y });
          }
          return out;
        }, { i: c.i });
        if (!points.length) { await page.evaluate(() => window.__sinkWorld.release()); break; }
        for (const at of points) {
          if (n++ >= tries) break;
          await page.evaluate(() => { window.__sinkLearnBefore = new Set(window.__sinkLearnHelp.openDialogs()); });
          await page.mouse.click(at.x, at.y);
          await page.waitForTimeout(120);
          const key = await page.evaluate(() => {
            const d = window.__sinkLearnHelp.openDialogs().find((el) => !window.__sinkLearnBefore.has(el));
            if (!d) return null;
            window.__sinkLearnOpen = d;
            return window.__sinkLearnHelp.dialogKey(d);
          }).catch(() => null);
          if (key && want.includes(key)) { await page.evaluate(() => window.__sinkWorld.release()); return true; }
          if (key) await page.evaluate(() => { const d = window.__sinkLearnOpen; if (d.localName === "dialog" && d.open) d.close(); else { const x = d.querySelector('[data-close], [aria-label="Close" i], [aria-label="close" i]'); if (x) x.click(); else d.style.display = "none"; } window.__sinkLearnOpen = null; });
          if (await page.evaluate(() => !!window.__sinkWalletAsked)) return false;
        }
        await page.evaluate(() => window.__sinkWorld.release());
      }
    }
    return false;
  } finally {
    looking = false;
    await page.unroute("**/*", route).catch(() => {});
  }
}

/**
 * Runs in the page: the control at its recorded place in the open dialog
 * (its index among the dialog and its elements, as the capture numbered
 * them), marked `data-sink-learn`. When a name was recorded and the element
 * there answers to another, the control that answers to the name stands in;
 * none does: null.
 */
function controlAt({ el, control }) {
  const d = window.__sinkLearnOpen;
  if (!d) return null;
  const slug = (s) => String(s || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
  const labelOf = (e) => e.getAttribute("aria-label") || e.getAttribute("title") || (e.localName === "input" || e.localName === "select" || e.localName === "textarea" ? (e.labels?.[0]?.textContent || e.getAttribute("placeholder") || e.getAttribute("name")) : e.textContent) || "";
  const all = [d, ...d.querySelectorAll("*")];
  const nameOf = (e, i) => slug(labelOf(e).trim().replace(/\s+/g, " ")) || `${e.localName}-${i}`;
  let i = el;
  if (!all[i] || (control && nameOf(all[i], i) !== control)) i = control ? all.findIndex((e, k) => /^(button|input|select|textarea|summary|a)$/.test(e.localName) && nameOf(e, k) === control) : -1;
  if (i < 0 || !all[i]) return null;
  all[i].setAttribute("data-sink-learn", "1");
  return { at: i, name: nameOf(all[i], i) };
}

/** Run the plan on the live site. Returns every result, in order. */
export async function runLearn({ chromium, origin, plan, outDir, viewport = [1440, 900], log = () => {} }) {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium", headless: true,
    ...(process.env.CHROMIUM_ARGS ? { args: process.env.CHROMIUM_ARGS.trim().split(/\s+/) } : {}),
    ...(proxy && !/^https?:\/\/(127\.0\.0\.1|localhost)/.test(origin) ? { proxy: { server: proxy, bypass: "localhost,127.0.0.1" } } : {}),
  });
  const results = [];
  let last = 0, stopped = null;
  mkdirSync(join(outDir, "learn"), { recursive: true });
  try {
    for (const [i, p] of plan.press.entries()) {
      const r = { ...p.target, key: keyOf(p.target), part: p.held.part, asked: p.target.part };
      if (stopped) { results.push({ ...r, result: "not pressed", why: `the run stopped at a wallet prompt (${stopped})` }); continue; }
      const context = await browser.newContext({ viewport: { width: viewport[0], height: viewport[1] }, deviceScaleFactor: 1 });
      await context.addInitScript(WALLET_TRAP);
      /* A world's frames can be held and its sprites read as drawn (world-recorder.js), to find the character by. */
      if (p.world) { await context.addInitScript(WORLD_RECORDER); await context.addInitScript(LEARN_HELP); }
      const page = await context.newPage();
      /* No window is opened, and nothing leaves in one. */
      page.on("popup", (w) => { w.close().catch(() => {}); });
      const started = Date.now();
      const net = recordNetwork(page, { started });
      try {
        await page.goto(new URL(p.path, origin).href, { waitUntil: "load" });
        await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
        await page.evaluate(HIDE_GATE).catch(() => {});
        await page.waitForTimeout(400);
        let target;
        if (p.world) {
          const opened = await openCharacter(page, p.world.characters);
          const asked = await page.evaluate(() => window.__sinkWalletAsked || null).catch(() => null);
          if (asked) { stopped = asked; results.push({ ...r, result: "not pressed", why: `a wallet was asked for while finding its character (${asked})` }); continue; }
          if (!opened) { results.push({ ...r, result: "not found", why: "no character on the page opened its dialog" }); continue; }
          const found = await page.evaluate(controlAt, { el: p.world.el, control: p.held.control ?? null });
          if (!found) { results.push({ ...r, result: "not found", why: "its dialog opened, but the control is not at its place" }); continue; }
          target = page.locator('[data-sink-learn="1"]').first();
        } else {
          target = page.locator(p.held.selector);
          if ((await target.count()) !== 1 && p.held.label) target = page.getByRole("button", { name: p.held.label, exact: true });
          if ((await target.count()) < 1) { results.push({ ...r, result: "not found", why: "the control is not on the page now" }); continue; }
          target = target.first();
        }
        const before = await page.evaluate(screenNow, WALLET_WORDS.source);
        if (before.wallet) { stopped = before.wallet; results.push({ ...r, result: "not pressed", why: `a wallet was asked for before the press (${before.wallet})` }); continue; }
        let missing = [];
        if (p.target.values) { const sel = await target.evaluate((el) => { el.setAttribute("data-sink-learn", "1"); return '[data-sink-learn="1"]'; }); missing = await page.evaluate(fillForm, { selector: sel, values: p.target.values }); }
        const wait = last + APART_MS - Date.now();
        if (wait > 0) await page.waitForTimeout(wait);
        const phase = `learn:${r.key}`;
        net.phase(phase);
        const at = page.url();
        last = Date.now();
        await target.click({ timeout: 4000 }).catch((e) => { r.clickSays = e.message.split("\n")[0]; });
        log(`learn: pressed ${r.key}`);
        await page.waitForLoadState("networkidle", { timeout: 6000 }).catch(() => {});
        await page.waitForTimeout(1200);
        net.phase("after");
        const after = await page.evaluate(screenNow, WALLET_WORDS.source).catch(() => ({ wallet: null, said: [], title: "" }));
        const shot = `learn/${String(i + 1).padStart(2, "0")}-${(r.control ?? r.part).replace(/[^a-z0-9-]+/gi, "-").slice(0, 40)}.jpg`;
        await page.screenshot({ path: join(outDir, shot), type: "jpeg", quality: 70 }).catch(() => {});
        const asked = mapOf(net.seen.filter((q) => q.phase === phase), { base: at, writes: true });
        const moved = page.url() !== at ? (() => { try { const u = new URL(page.url()); return u.origin === new URL(at).origin ? u.pathname : `${u.origin}${u.pathname}`; } catch { return null; } })() : null;
        results.push({
          ...r, result: after.wallet ? "stopped: wallet" : "pressed", at: new Date(last).toISOString(),
          requests: asked, screen: { picture: shot, ...(moved ? { went: moved } : {}), title: after.title, said: after.said },
          ...(missing.length ? { missingFields: missing } : {}),
          ...(p.target.values ? { filled: Object.keys(p.target.values).filter((k) => !missing.includes(k)) } : {}),
        });
        if (after.wallet) { stopped = after.wallet; log(`learn: a wallet was asked for (${after.wallet}); the run stops here`); }
      } catch (e) {
        results.push({ ...r, result: "failed", why: e.message.split("\n")[0] });
      } finally {
        await context.close().catch(() => {});
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }
  return results;
}

/**
 * The document and the API map with what the run learned: `learned` gains
 * each control pressed (replacing an earlier learning of it), its held
 * entry says `learned: true`, and the map gains the endpoints the presses
 * asked for (`learned: true`, samples beside the rest). Pure.
 */
export function withLearned(doc, results, map = null) {
  const pressed = results.filter((r) => r.result === "pressed" || r.result === "stopped: wallet");
  const learnedNow = pressed.filter((r) => r.result === "pressed");
  const k = (x) => `${x.page}|${x.part}|${x.control ?? x.selector}`;
  const entries = learnedNow.map((r) => ({
    page: r.page, part: r.part, ...(r.control ? { control: r.control } : {}), selector: r.selector, held: "server-call", learned: true, at: r.at,
    ...(r.asked !== r.part ? { asked: r.asked } : {}),
    requests: (r.requests ?? []).map((q) => q.key), screen: r.screen?.picture ?? null,
  }));
  const kept = (Array.isArray(doc.learned) ? doc.learned : []).filter((x) => !entries.some((e) => k(e) === k(x)));
  const held = Array.isArray(doc.held) ? doc.held.map((h) => (entries.some((e) => e.page === h.page && e.part === h.part && (e.control ?? e.selector) === (h.control ?? h.selector)) ? { ...h, learned: true } : h)) : doc.held;
  const out = { ...doc, ...(held ? { held } : {}), learned: [...kept, ...entries] };
  if (!map) return { doc: out, map: null, samples: [] };
  const endpoints = [...(map.endpoints ?? [])];
  const samples = [];
  let n = endpoints.length;
  for (const r of pressed) for (const q of r.requests ?? []) {
    const had = endpoints.find((e) => e.key === q.key);
    const { sample, ...rest } = q;
    let file = had?.sample ?? null;
    if (sample != null && !file) { file = `samples/learn-${String(++n).padStart(3, "0")}.json`; samples.push({ file, sample }); }
    const entry = { ...(had ?? rest), learned: true, learnedBy: [...new Set([...(had?.learnedBy ?? []), r.key])], ...(file ? { sample: file } : {}) };
    if (had) endpoints[endpoints.indexOf(had)] = entry; else endpoints.push(entry);
  }
  return { doc: out, map: { ...map, endpoints }, samples };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const opt = (n, d = null) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
  const siteDir = opt("--site"), url = opt("--url"), raw = opt("--learn") ?? process.env.LEARN ?? "";
  if (!siteDir || !url) { console.error("usage: node capture/site/capture/learn.mjs --site sites/<name> --url <address> --learn '<json>'"); process.exit(2); }
  if (!raw.trim()) { console.error("learn: nothing asked"); process.exit(0); }
  const parsed = parseLearn(raw);
  if (!parsed.ok) { console.error(`learn: refused: ${parsed.says}`); process.exit(1); }
  const docFile = join(siteDir, "site", "document.json");
  const doc = JSON.parse(readFileSync(docFile, "utf8"));
  const routes = JSON.parse(readFileSync(join(siteDir, "capture", "routes.json"), "utf8"));
  const plan = planLearn(parsed, doc, routes);
  for (const x of plan.refused) console.error(`learn: not pressed ${x.target?.part ?? "?"}|${x.target?.control ?? x.target?.selector ?? "?"}: ${x.why}`);
  const req = createRequire(import.meta.url);
  const { chromium } = (() => {
    for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) { try { return req(c); } catch { /* next */ } }
    throw new Error("No Playwright found.");
  })();
  const results = plan.press.length ? await runLearn({ chromium, origin: routes.site ?? url, plan, outDir: siteDir, viewport: routes.viewport ?? [1440, 900], log: (s) => console.error(s) }) : [];
  const mapFile = join(siteDir, "api", "map.json");
  const map = existsSync(mapFile) ? JSON.parse(readFileSync(mapFile, "utf8")) : { version: NETWORK_VERSION, site: routes.site, endpoints: [] };
  const next = withLearned(doc, results, map);
  mkdirSync(join(siteDir, "api", "samples"), { recursive: true });
  mkdirSync(join(siteDir, "learn"), { recursive: true });
  for (const x of next.samples) writeFileSync(join(siteDir, "api", x.file), JSON.stringify(x.sample, null, 1) + "\n");
  writeFileSync(mapFile, JSON.stringify(next.map, null, 1) + "\n");
  writeFileSync(docFile, JSON.stringify(next.doc, null, 2) + "\n");
  const strip = (r) => ({ ...r, values: r.values ? Object.keys(r.values) : null, requests: (r.requests ?? []).map(({ sample, ...q }) => q) });
  writeFileSync(join(siteDir, "learn", "run.json"), JSON.stringify({ at: new Date().toISOString(), cap: parsed.cap, results: results.map(strip), refused: plan.refused.map((x) => ({ ...x, target: x.target ? { ...x.target, values: x.target.values ? Object.keys(x.target.values) : null } : x.target })) }, null, 2) + "\n");
  const done = results.filter((r) => r.result === "pressed").length;
  console.error(`learn: ${done} pressed, ${results.length - done} not, ${plan.refused.length} refused`);
  process.exit(0);
}
