#!/usr/bin/env node
/**
 * WHAT A GO LIVE PUBLISHES, OPENED THE WAY A VISITOR OPENS IT.
 *
 * The first Go live made solcinerator.vercel.app from a board brought in from
 * sink, and the owner found five things wrong with what came out:
 *   1. navigation was dead: 0 `<a>` on any page; the sidebar and Docs'
 *      "Launch SOLCINERATOR" came out as `<button>` with nothing behind them;
 *   2. at 1922 wide, 74.5px bands of the app's body colour either side, and
 *      the header bar and sidebar stopping short of the window's edges;
 *   3. narrower than 1763 it scrolled sideways, and on a phone it stayed 1763;
 *   4. on Docs, two paragraphs held on one line, running under the right
 *      column (1254px of words in an 832px box, and 1205 in 832);
 *   5. the head: a favicon that 404s, no description, no Open Graph.
 *
 * This presses the real Push to GitHub (the same `collectFiles` Go live
 * sends) on sink brought in through the real door, against a GitHub stand-in
 * on this machine that keeps what it is handed. What was committed is served
 * the way a static host serves it, and opened. Every expectation is read off
 * the board's document, not written in: which parts link where, which part
 * is the header bar and which the sidebar, the capture's width.
 *
 *   npm run build
 *   env -u GITHUB_TOKEN GITHUB_API=http://127.0.0.1:4341 npx next start -p 3013
 *   node tests/published-site.mjs http://127.0.0.1:3013 <path to a sink checkout> [screenshot dir]
 */
import http from "node:http";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { bringSink } from "./fixtures/bring-sink.mjs";

const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const SINK = process.argv[3];
const SHOTS = process.argv[4] ?? null;
const GH_PORT = Number(process.env.GH_PORT ?? 4341);
const SERVE = Number(process.env.SERVE_PORT ?? 4342);
if (!SINK || !existsSync(join(SINK, "site/document.json"))) {
  console.error("usage: node tests/published-site.mjs <builder url> <path to a sink checkout> [screenshot dir]");
  process.exit(2);
}
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* ------------------------------------------------------------------ */
/* A GitHub that keeps what it is handed                                */
/* ------------------------------------------------------------------ */
const blobs = new Map();
const committed = new Map(); // path -> { content, encoding }
let n = 0;
const gh = http.createServer(async (rq, res) => {
  const body = await new Promise((ok) => { const c = []; rq.on("data", (d) => c.push(d)); rq.on("end", () => ok(Buffer.concat(c).toString("utf8"))); });
  const path = new URL(rq.url, "http://x").pathname;
  const send = (status, obj) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); };
  if (!/^Bearer .+/.test(rq.headers.authorization ?? "")) return send(401, { message: "Bad credentials" });
  if (path === "/user/repos" && rq.method === "POST") return send(201, { full_name: `someone/${JSON.parse(body || "{}").name}` });
  if (/^\/repos\/[^/]+\/[^/]+$/.test(path) && rq.method === "GET") return send(200, { default_branch: "main" });
  if (path.includes("/contents/")) return send(404, { message: "Not Found" });
  if (path.includes("/git/ref/") && rq.method === "GET") return send(409, { message: "Git Repository is empty." });
  if (path.endsWith("/git/blobs") && rq.method === "POST") {
    const b = JSON.parse(body);
    const sha = `blob${++n}`;
    blobs.set(sha, { content: b.content, encoding: b.encoding ?? "utf-8" });
    return send(201, { sha });
  }
  if (path.endsWith("/git/trees") && rq.method === "POST") {
    for (const t of JSON.parse(body).tree ?? []) committed.set(t.path, blobs.get(t.sha) ?? (t.content != null ? { content: t.content, encoding: "utf-8" } : { content: "", encoding: "utf-8" }));
    return send(201, { sha: "tree1" });
  }
  if (path.endsWith("/git/commits") && rq.method === "POST") return send(201, { sha: "commit1", html_url: "https://example.invalid/c/1" });
  if (path.includes("/git/refs") && rq.method === "POST") return send(201, { object: { sha: "commit1" } });
  return send(404, { message: `no ${rq.method} ${path}` });
});
await new Promise((ok) => gh.listen(GH_PORT, "127.0.0.1", ok));

/* ------------------------------------------------------------------ */
/* Sink, through the door, then the real publish button                 */
/* ------------------------------------------------------------------ */
const { browser: raw, page, state } = await bringSink(BASE, SINK);
/* Every page opened on the published site knows how to find a part (PART, below). */
const browser = { newPage: async (o) => { const v = await raw.newPage(o); await v.addInitScript(PART); return v; }, close: () => raw.close() };
await page.waitForTimeout(3000);
const s = await state();
const W = s.frameWidth;
const LIVE = "https://solcinerator.vercel.app";
/* Where the first Go live left this site: its address, as Go live records it. */
await page.evaluate((url) => {
  const raw = JSON.parse(localStorage.getItem("builder.builds") || "{}");
  const st = raw.state ?? {};
  st.projects = (st.projects ?? []).map((p) => (p.id === st.activeId ? { ...p, live: { url, at: Date.now() } } : p));
  localStorage.setItem("builder.builds", JSON.stringify({ ...raw, state: st }));
}, LIVE);
/*
 * A picture put on the board by hand: the captured SolWorks logo's twin,
 * with no record of where it came from. A captured picture draws no border
 * the capture did not record; a hand-built one keeps the part's default.
 */
const LOGO = s.nodes.find((x) => x.picture?.id === "pic_cc8659c3" && x.pageId === s.pages[0].id && x.from?.selector);
const HAND = "n_hand_picture";
await page.evaluate(({ logo, id }) => {
  const raw = JSON.parse(localStorage.getItem("builder.studio"));
  raw.state.nodes.push({ ...logo, id, from: null, label: "picture", x: 40, y: 1440 });
  localStorage.setItem("builder.studio", JSON.stringify(raw));
}, { logo: LOGO, id: HAND });
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(2500);

console.log("0. On the board");
{
  const edge = (id) => page.evaluate((id) => {
    const img = document.querySelector(`[data-node-id="${id}"] img`);
    return img ? getComputedStyle(img).borderTopWidth : null;
  }, id);
  check("the captured SolWorks logo draws no border on the board", (await edge(LOGO.id)) === "0px", `${LOGO.id}: ${await edge(LOGO.id)}`);
  check("a picture placed by hand keeps its default border", (await edge(HAND)) === "1px", `${HAND}: ${await edge(HAND)}`);
  const mark = await page.evaluate(() => document.querySelector("[data-site-mark] [data-picture-id]")?.getAttribute("data-picture-id") ?? null);
  check("the Builder's top-bar mark is the SolWorks logo", mark === "pic_cc8659c3", String(mark));
}

/* What the site says about itself, typed where the site's name is typed. */
const DESCRIPTION = "A SolWorks project";
const said = page.getByLabel("Description", { exact: true });
/* The Pages panel, opened the way the Builder opens a panel for you. */
await page.evaluate(() => window.dispatchEvent(new CustomEvent("studio:panel", { detail: "pages" })));
await page.waitForTimeout(800);
const hasField = (await said.count()) > 0;
check("the site's description can be typed beside its name", hasField);
if (hasField) { await said.first().fill(DESCRIPTION); await page.waitForTimeout(300); }

await page.evaluate(() => window.__studioOpenBrief?.());
await page.waitForTimeout(1500);
const push = page.getByRole("button", { name: /Push to GitHub/ }).first();
if (await push.count()) { await push.click(); }
for (let i = 0; i < 90 && !committed.has("index.html"); i++) await page.waitForTimeout(1000);
await page.waitForTimeout(1500);
check("the press committed the pages", committed.has("index.html"), `${committed.size} files`);

/* ------------------------------------------------------------------ */
/* Served the way a static host serves it                               */
/* ------------------------------------------------------------------ */
const TYPES = { html: "text/html", css: "text/css", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", svg: "image/svg+xml", webp: "image/webp", ico: "image/x-icon", json: "application/json" };
const site = http.createServer((rq, res) => {
  let p = decodeURIComponent(new URL(rq.url, "http://x").pathname).replace(/^\/+/, "");
  if (!p || p.endsWith("/")) p += "index.html";
  const f = committed.get(p);
  if (!f) { res.writeHead(404); res.end("NOT_FOUND"); return; }
  res.writeHead(200, { "content-type": TYPES[p.split(".").pop()] ?? "application/octet-stream" });
  res.end(f.encoding === "base64" ? Buffer.from(f.content, "base64") : f.content);
});
await new Promise((ok) => site.listen(SERVE, "127.0.0.1", ok));
const ORIGIN = `http://127.0.0.1:${SERVE}`;
/* A part on an exported page, by the id it is published under, or by the Builder's mark if it kept that instead. */
const PART = () => { window.part = (id) => (id ? document.getElementById(id) ?? document.querySelector(`[data-live-node="${id}"]`) : null); };

const home = s.pages[0].id;
const slug = (p) => (p.id === home ? "" : `${(p.path || p.name || p.id).trim().replace(/^\/+|\/+$/g, "").toLowerCase().replace(/[^a-z0-9/_-]+/g, "-").replace(/^-+|-+$/g, "")}/`);
const pageBy = (t) => s.pages.find((p) => p.id === t) ?? s.pages.find((p) => (p.path || "").replace(/^\/+|\/+$/g, "") === String(t).replace(/^\/+|\/+$/g, "")) ?? null;
const docs = s.pages.find((p) => /doc/i.test(p.name || p.path || ""));
/** The folder a page is served at: `/` and `/cleanup/`, whichever file in it the link names. */
const folder = (href) => new URL(href).pathname.replace(/index\.html$/, "");

const failed = [];

/* ---- 1. Links ----------------------------------------------------- */
console.log("1. Navigation");
{
  const v = await browser.newPage({ viewport: { width: W, height: 1000 } });
  v.on("response", (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
  let pagesWithout = [], wrong = [], dead = [], total = 0, current = [], currentWant = 0;
  for (const p of s.pages) {
    await v.goto(`${ORIGIN}/${slug(p)}`, { waitUntil: "networkidle" });
    const want = s.nodes.filter((x) => x.pageId === p.id && x.link?.kind === "page" && x.link.target);
    const got = await v.evaluate((ids) => ({
      anchors: document.querySelectorAll("a[href]").length,
      parts: ids.map((id) => {
        const el = part(id);
        const a = el ? (el.closest("a[href]") ?? el.querySelector("a[href]")) : null;
        return { id, found: !!el, href: a ? a.href : null, current: a?.getAttribute("aria-current") ?? null, buttons: el ? el.querySelectorAll("button").length : 0 };
      }),
    }), want.map((x) => x.id));
    if (!got.anchors) pagesWithout.push(p.name);
    for (const w of want) {
      total++;
      const g = got.parts.find((x) => x.id === w.id);
      const to = pageBy(w.link.target);
      if (!g?.href) { dead.push(`${p.name}: ${w.label}`); continue; }
      if (folder(g.href) !== `/${slug(to)}`) wrong.push(`${p.name}: ${w.label} → ${g.href}`);
      if (g.buttons) dead.push(`${p.name}: ${w.label} still holds a button`);
      if (to.id === p.id) { currentWant++; if (g.current === "page") current.push(w.id); }
    }
  }
  check("every page has links", pagesWithout.length === 0, pagesWithout.length ? `none on ${pagesWithout.join(", ")}` : `${s.pages.length} pages`);
  check("every part the capture links to a page is an <a href>", total > 0 && dead.length === 0, dead.length ? `${dead.length} of ${total} dead: ${dead.slice(0, 4).join("; ")}` : `${total} links`);
  check("…to that page's folder", total > 0 && wrong.length === 0, wrong.slice(0, 4).join("; ") || "all");
  check("the current page's own entry says so (aria-current=page)", currentWant > 0 && current.length === currentWant, `${current.length} of ${currentWant}`);

  /* A person presses Cleanup in the sidebar of the home page, and Launch on Docs. */
  const press = async (from, words, to) => {
    await v.goto(`${ORIGIN}/${slug(from)}`, { waitUntil: "networkidle" });
    const t = v.getByText(words, { exact: true }).first();
    if (!(await t.count())) return `no "${words}"`;
    await t.click({ timeout: 3000 }).catch(() => {});
    await v.waitForTimeout(600);
    return folder(v.url()) === `/${slug(to)}` ? true : `stayed at ${v.url()}`;
  };
  const cleanup = s.pages.find((p) => /cleanup/i.test(p.name));
  const r1 = await press(s.pages[0], cleanup.name, cleanup);
  check(`pressing "${cleanup.name}" on ${s.pages[0].name} opens it`, r1 === true, String(r1));
  const launch = s.nodes.find((x) => x.pageId === docs?.id && x.link?.kind === "page" && /launch/i.test(x.label));
  if (launch) {
    const words = (Array.isArray(launch.content) ? launch.content.map((r) => r.text).join("") : String(launch.content || "")).trim() || launch.label.replace(/^.*“|”.*$/g, "");
    const r2 = await press(docs, words, pageBy(launch.link.target));
    check(`pressing "${words}" on ${docs.name} opens ${pageBy(launch.link.target).name}`, r2 === true, String(r2));
  }
  await v.close();
}

/* The header bar: the part at the top the whole capture wide. The sidebar: the tallest part on the left edge, below it. */
const edgeParts = (pid) => {
  const on = s.nodes.filter((x) => x.pageId === pid && x.colour?.bg);
  const bar = on.filter((x) => x.x <= 1 && x.y <= 1 && x.x + x.w >= W - 1).sort((a, b) => b.h - a.h)[0];
  const side = on.filter((x) => x.x <= 1 && x.y > 1 && x.w < W / 3).sort((a, b) => b.h - a.h)[0];
  return { bar, side };
};

/* ---- 2 and 3. Widths ---------------------------------------------- */
console.log("2. Wide windows reach the edges; 3. narrow ones do not scroll sideways");
const shot = async (v, name) => { if (SHOTS) { mkdirSync(SHOTS, { recursive: true }); await v.screenshot({ path: join(SHOTS, `${name}.png`) }); } };
for (const p of [s.pages[0], docs]) {
  const { bar, side } = edgeParts(p.id);
  for (const width of [1922, 1763, 1536, 1366, 1280]) {
    const v = await browser.newPage({ viewport: { width, height: 1080 } });
    await v.goto(`${ORIGIN}/${slug(p)}`, { waitUntil: "networkidle" });
    await v.waitForTimeout(300);
    const m = await v.evaluate(({ bar, side }) => {
      const inside = (x, y, id) => { const e = document.elementFromPoint(x, y); return !!(e && id && part(id)?.contains(e)); };
      const b = part(bar)?.getBoundingClientRect();
      const sd = part(side)?.getBoundingClientRect();
      const W = innerWidth;
      const midBar = b ? (b.top + b.bottom) / 2 : 5;
      const midSide = sd ? Math.min((sd.top + sd.bottom) / 2, innerHeight - 5) : 200;
      return {
        scroll: document.documentElement.scrollWidth - W,
        barLeft: inside(2, midBar, bar) && b.left <= 0.5, barRight: inside(W - 3, midBar, bar) && b.right >= W - 0.5,
        /* Other parts sit on the sidebar (its entries), so it is its box that is asked about. */
        sideLeft: !!sd && sd.left <= 0.5 && sd.width > 0,
        bare: [[2, midSide], [W - 3, midSide]].filter(([x, y]) => { const e = document.elementFromPoint(x, y); return !e || e === document.body || e === document.documentElement; }).length,
      };
    }, { bar: bar?.id, side: side?.id });
    const tag = `${p.name} at ${width}`;
    check(`${tag}: no sideways scroll`, m.scroll <= 0, `${m.scroll}px wider than the window`);
    check(`${tag}: the header bar reaches both edges`, m.barLeft && m.barRight, `left ${m.barLeft}, right ${m.barRight}`);
    check(`${tag}: the sidebar reaches the left edge, and no bare band either side`, m.sideLeft && m.bare === 0, `sidebar ${m.sideLeft}, ${m.bare} bare`);
    if (width === 1922 || width === 1366) await shot(v, `${p.id}-${width}`);
    await v.close();
  }
  /* A phone: 375 wide, as a phone opens a page. And a window dragged that narrow. */
  const phone = await browser.newPage({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await phone.goto(`${ORIGIN}/${slug(p)}`, { waitUntil: "networkidle" });
  await phone.waitForTimeout(300);
  const ph = await phone.evaluate(() => ({ seen: Math.round(document.documentElement.scrollWidth * (visualViewport?.scale ?? 1)), wide: document.documentElement.scrollWidth, scale: visualViewport?.scale ?? 1 }));
  check(`${p.name} on a 375 phone: the whole width is on the screen`, ph.seen <= 376, `${ph.wide}px of page at ${ph.scale.toFixed(3)} shows ${ph.seen}px`);
  await shot(phone, `${p.id}-375`);
  await phone.close();
  /* A 375 window, not a phone, scrolls sideways: the owner's ruling is no sideways scroll down to 1280, 1:1 (tests/fluid-site.mjs). */
}

/* A press at 1366, scaled, still lands where it is aimed. */
{
  const v = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  await v.goto(`${ORIGIN}/`, { waitUntil: "networkidle" });
  const cleanup = s.pages.find((p) => /cleanup/i.test(p.name));
  await v.getByText(cleanup.name, { exact: true }).first().click({ timeout: 3000 }).catch(() => {});
  await v.waitForTimeout(600);
  check(`at 1366, pressing "${cleanup.name}" still opens it`, folder(v.url()) === `/${slug(cleanup)}`, v.url());
  await v.close();
}

/* ---- 4. Docs paragraphs wrap -------------------------------------- */
console.log("4. Docs' paragraphs wrap as the board draws them");
{
  const v = await browser.newPage({ viewport: { width: W, height: 1000 } });
  await v.goto(`${ORIGIN}/${slug(docs)}`, { waitUntil: "networkidle" });
  const paras = s.nodes.filter((x) => x.pageId === docs.id && x.featureId === "prose").map((x) => ({ id: x.id, words: (Array.isArray(x.content) ? x.content.map((r) => r.text).join("") : String(x.content ?? "")) }));
  const over = await v.evaluate((ids) => ids.map(({ id, words }) => {
    const el = part(id);
    if (!el) return { id, words, missing: true };
    const box = el.getBoundingClientRect();
    /* The words' own line boxes, not the block they sit in. */
    let right = -Infinity, lines = new Set();
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let t = walk.nextNode(); t; t = walk.nextNode()) {
      if (!t.textContent.trim()) continue;
      const r = document.createRange();
      r.selectNodeContents(t);
      for (const q of r.getClientRects()) { right = Math.max(right, q.right); lines.add(Math.round(q.top)); }
    }
    return { id, words: words.slice(0, 40), over: Math.round(right - box.right), lines: lines.size };
  }), paras);
  for (const w of ["Reclaim lost SOL", "With built-in Jupiter"]) {
    const o = over.find((x) => x.words.startsWith(w));
    check(`"${w}…" wraps inside its box`, !!o && !o.missing && o.over <= 1 && o.lines > 1, o ? `${o.over}px past its right edge, ${o.lines} lines` : "not found");
  }
  /* A line held to one line may overhang by a few pixels, by design (tests/one-line-words.mjs); a character is not a few. */
  const all = over.filter((o) => !o.missing && o.over > 8);
  check("no paragraph on Docs runs past its box by a character or more", all.length === 0, all.map((o) => `"${o.words}" ${o.over}px`).join("; ") || `${over.length} paragraphs`);
  await v.close();
}

/* ---- 5. The head -------------------------------------------------- */
console.log("5. The head");
{
  const v = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  for (const p of [s.pages[0], docs]) {
    const bad = [];
    v.removeAllListeners("response");
    v.on("response", (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${new URL(r.url()).pathname}`); });
    await v.goto(`${ORIGIN}/${slug(p)}`, { waitUntil: "networkidle" });
    await v.waitForTimeout(300);
    const head = await v.evaluate(() => {
      const m = (sel, at = "content") => document.querySelector(sel)?.getAttribute(at) ?? null;
      const icon = document.querySelector("link[rel~=icon]");
      return {
        title: document.title, description: m('meta[name="description"]'),
        icon: icon ? icon.href : null,
        ogTitle: m('meta[property="og:title"]'), ogDescription: m('meta[property="og:description"]'),
        ogImage: m('meta[property="og:image"]'), ogUrl: m('meta[property="og:url"]'), ogType: m('meta[property="og:type"]'),
      };
    });
    const iconOk = head.icon ? (await v.request.get(head.icon)).status() === 200 : false;
    const tag = p.name;
    check(`${tag}: a title`, !!head.title && head.title.includes(s.brief.name), head.title);
    check(`${tag}: the icon is the site's picture (the SolWorks logo), and it loads`, !!head.icon && /pic_cc8659c3/.test(head.icon) && iconOk, head.icon ?? "none");
    check(`${tag}: nothing it asks for 404s`, bad.length === 0, bad.join(", ") || "none");
    check(`${tag}: the description`, head.description === DESCRIPTION, String(head.description));
    check(`${tag}: Open Graph title, description and type`, !!head.ogTitle && head.ogDescription === DESCRIPTION && head.ogType === "website", JSON.stringify([head.ogTitle, head.ogDescription, head.ogType]));
    check(`${tag}: og:image is the site's picture at the site's address`, head.ogImage === `${LIVE}/assets/pictures/pic_cc8659c3.png`, String(head.ogImage));
    check(`${tag}: og:url is this page at the site's address`, head.ogUrl === `${LIVE}/${slug(p)}`, String(head.ogUrl));
  }
  await v.close();
}
console.log("6. Pictures and icons");
{
  const v = await browser.newPage({ viewport: { width: W, height: 1000 } });
  await v.goto(`${ORIGIN}/`, { waitUntil: "networkidle" });
  const edge = (id) => v.evaluate((id) => { const img = part(id)?.querySelector("img"); return img ? getComputedStyle(img).borderTopWidth : null; }, id);
  check("the captured SolWorks logo is published with no border", (await edge(LOGO.id)) === "0px", String(await edge(LOGO.id)));
  check("the hand-built picture is published with its default border", (await edge(HAND)) === "1px", String(await edge(HAND)));
  /* The icons: each file's own size, and each the SolWorks logo drawn at that size. */
  const icons = await v.evaluate(async () => {
    const load = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
    const pix = (img, n) => { const c = document.createElement("canvas"); c.width = c.height = n; const g = c.getContext("2d"); g.drawImage(img, 0, 0, n, n); return g.getImageData(0, 0, n, n).data; };
    const logo = await load("assets/pictures/pic_cc8659c3.png");
    const one = async (sel) => {
      const l = document.querySelector(sel);
      if (!l) return null;
      const img = await load(l.href);
      if (!img || !logo) return { href: l.getAttribute("href"), sizes: l.getAttribute("sizes"), loaded: !!img };
      const n = img.naturalWidth, a = pix(img, n), b = pix(logo, n);
      let d = 0;
      for (let k = 0; k < a.length; k++) d += Math.abs(a[k] - b[k]);
      return { href: l.getAttribute("href"), sizes: l.getAttribute("sizes"), w: img.naturalWidth, h: img.naturalHeight, off: Math.round((d / a.length) * 10) / 10 };
    };
    const og = document.querySelector('meta[property="og:image"]')?.getAttribute("content") ?? "";
    const ogLocal = await load(new URL(og).pathname.replace(/^\//, ""));
    return { small: await one('link[rel="icon"][sizes="32x32"]'), touch: await one('link[rel="apple-touch-icon"]'), og: ogLocal ? [ogLocal.naturalWidth, ogLocal.naturalHeight] : null, ogw: document.querySelector('meta[property="og:image:width"]')?.getAttribute("content") ?? null };
  });
  /* Off by a few levels in 255 at most: the same picture, scaled by another hand. */
  check("a 32px icon, the SolWorks logo at that size", !!icons.small && icons.small.w === 32 && icons.small.h === 32 && icons.small.off <= 8, JSON.stringify(icons.small));
  check("a 180px icon for a phone's home screen, the same logo", !!icons.touch && icons.touch.w === 180 && icons.touch.h === 180 && icons.touch.sizes === "180x180" && icons.touch.off <= 8, JSON.stringify(icons.touch));
  check("og:image is the 1024 original", !!icons.og && icons.og[0] === 1024 && icons.og[1] === 1024 && icons.ogw === "1024", JSON.stringify(icons.og) + ` width ${icons.ogw}`);
  await v.close();
}
check("nothing any page asked for was missing", failed.length === 0, failed.slice(0, 4).join(", ") || "none");

await browser.close();
gh.close();
site.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
