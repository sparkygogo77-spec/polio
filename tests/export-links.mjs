#!/usr/bin/env node
/**
 * Every link the document holds is a link a person can follow in the export.
 *
 * HIS WORDS: the exported site had no links at all. Not one `<a>`: pump.fun
 * came out as a span painted like a link, the sidebar could not be pressed,
 * and the home page could not be left. tests/export-page.mjs asked whether a
 * run "is a link" by `closest("a, [role=link]")`, and a dead span with a role
 * answered yes. So this asks the output, not the markup's opinion of itself.
 *
 * A PROPERTY OF THE OUTPUT, never a count written in. Every expectation is
 * read off the board's document as it lands through the real door:
 *   · every part and every run of words that carries a link is, in the
 *     exported page, inside a real `<a href>`, and nothing else is;
 *   · each href resolves, from the page it is on, to the file the target is
 *     exported as (a page link to that page's index.html, a url link to the
 *     url as given), and that file is in the tree;
 *   · a person can follow it: a real mouse press on a point of it that
 *     nothing else covers lands on the target;
 *   · every page is reached from every page that links to it;
 *   · a part wholly on a linked part, with no press of its own, lets the
 *     press through to the link, and nothing else does (his ruling: the
 *     capture keeps what the site had inside a link as a part beside it);
 *     how much of each link is still under another part is reported, so
 *     the next one is noticed;
 *   · and how many links the document holds and how many the export emits,
 *     page by page, which must be the same two numbers.
 * No `<a>` inside an `<a>`, and no control inside one, because a browser
 * rebuilds that markup rather than following it.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/export-links.mjs http://127.0.0.1:3013 <path to a sink checkout>
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";

const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const SINK = process.argv[3];
if (!SINK || !existsSync(join(SINK, "site/document.json"))) {
  console.error("usage: node tests/export-links.mjs <builder url> <path to a sink checkout>");
  process.exit(2);
}
const DOC = readFileSync(join(SINK, "site/document.json"));
const doc = JSON.parse(DOC.toString("utf8"));
const pics = existsSync(join(SINK, "assets/pictures")) ? readdirSync(join(SINK, "assets/pictures")) : [];
const REPO = "/repos/sparkygogo77-spec/sink";
const tree = [
  { path: "package.json", type: "blob", sha: "pkg", size: 10 },
  { path: "site/document.json", type: "blob", sha: "doc", size: DOC.length },
  ...pics.map((p) => ({ path: `assets/pictures/${p}`, type: "blob", sha: `pic:${p}`, size: 100 })),
];

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1763, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route("https://api.github.com/**", (r) => {
  const u = new URL(r.request().url());
  const j = (b, code = 200) => r.fulfill({ status: code, contentType: "application/json", body: JSON.stringify(b) });
  if (!u.pathname.startsWith(REPO)) return j({ message: "no" }, 404);
  const rest = u.pathname.slice(REPO.length);
  if (!rest) return j({ default_branch: "main", homepage: "" });
  if (rest.startsWith("/git/trees/")) return j({ tree });
  if (rest === "/git/blobs/doc") return j({ encoding: "base64", content: DOC.toString("base64") });
  const pic = decodeURIComponent(rest).match(/^\/git\/blobs\/pic:(.+)$/);
  if (pic) return j({ encoding: "base64", content: readFileSync(join(SINK, "assets/pictures", pic[1])).toString("base64") });
  return j({ message: "no" }, 404);
});

const state = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {});

/* An empty site, opened first. */
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => {
  const env = (s) => JSON.stringify({ state: s, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "s3", name: "Site 3", updatedAt: Date.now() }], activeId: "s3" }));
  localStorage.setItem("builder.studio", env({ nodes: [] }));
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);

/* A placeholder token, through the Keys panel, the way his goes in. */
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

/* The door. */
await page.locator("[data-github-button]").first().click();
await page.waitForTimeout(700);
await page.locator("[data-repo-bring]").fill("sparkygogo77-spec/sink");
await page.locator("[data-repo-pull]").click();
for (let i = 0; i < 90 && ((await state()).nodes?.length ?? 0) < 100; i++) await page.waitForTimeout(1000);
await page.waitForTimeout(3000);


const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const s = await state();
const home = s.pages[0].id;
const names = Object.fromEntries(s.pages.map((p) => [p.id, p.name || p.id]));

/* Where each page is exported to, the way staticSite's pageFile names it. */
const fileOf = (p) => (p.id === home ? "index.html" : `${((p.path || p.name || p.id).trim().replace(/^\/+|\/+$/g, "")).toLowerCase().replace(/[^a-z0-9/_-]+/g, "-").replace(/^-+|-+$/g, "") || p.id}/index.html`);
/* A page link's target, by id, then path, then name, as the board resolves one. */
const pageBy = (t) => {
  const k = String(t).trim().replace(/^\/+|\/+$/g, "").toLowerCase();
  return s.pages.find((p) => p.id === t) ?? s.pages.find((p) => (p.path || "").replace(/^\/+|\/+$/g, "").toLowerCase() === k) ?? s.pages.find((p) => (p.name || "").trim().toLowerCase() === k) ?? null;
};
const ORIGIN = "http://export.local/";
/** Where a link should land in the export, as an absolute url. */
const landing = (link) => {
  if (link.kind === "url") return new URL(link.target).href;
  if (link.kind === "node") return null; /* per page: that page's file, #id */
  const p = pageBy(link.target);
  return p ? ORIGIN + fileOf(p) : `(no page called ${link.target})`;
};

/* ------------------------------------------------------------------ */
/* What the document holds                                             */
/* ------------------------------------------------------------------ */

const held = [];
for (const n of s.nodes) {
  if (n.link?.target) held.push({ page: n.pageId, node: n.id, carrier: n.featureId, words: null, link: n.link });
  if (Array.isArray(n.content)) for (const r of n.content) if (r?.link?.target) held.push({ page: n.pageId, node: n.id, carrier: `run in ${n.featureId}`, words: r.text, link: r.link });
}
const tally = (xs, k) => xs.reduce((m, x) => ((m[k(x)] = (m[k(x)] ?? 0) + 1), m), {});
console.log(`  the document holds ${held.length} links: ${Object.entries(tally(held, (h) => `${h.carrier} (${h.link.kind})`)).map(([k, v]) => `${k} ${v}`).join(", ")}`);
console.log(`  by target: ${Object.entries(tally(held, (h) => (h.link.kind === "page" ? names[pageBy(h.link.target)?.id] ?? h.link.target : h.link.target))).map(([k, v]) => `${k} ${v}`).join(", ")}`);

/* ------------------------------------------------------------------ */
/* What the export emits                                               */
/* ------------------------------------------------------------------ */

const files = (await page.evaluate(async () => (window.__studioExport ? await window.__studioExport() : null))) ?? [];
check("the exporter gave files", files.length > 0, `${files.length} files`);
const paths = new Set(files.map((f) => f.path));

const out = await browser.newPage({ viewport: { width: s.frameWidth + 200, height: 1000 } });
const outErrors = [];
out.on("pageerror", (e) => outErrors.push(e.message));
const asked = [];
await out.context().route("**/*", (r) => {
  const u = new URL(r.request().url());
  if (u.origin + "/" !== ORIGIN) { asked.push(u.href); return r.fulfill({ status: 200, contentType: "text/html", body: "<title>outside</title>" }); }
  const p = decodeURIComponent(u.pathname).replace(/^\/+/, "") || "index.html";
  const f = files.find((x) => x.path === p);
  if (!f) return r.fulfill({ status: 404, body: "" });
  const type = p.endsWith(".html") ? "text/html" : p.endsWith(".css") ? "text/css" : p.endsWith(".png") ? "image/png" : p.endsWith(".jpg") || p.endsWith(".jpeg") ? "image/jpeg" : p.endsWith(".svg") ? "image/svg+xml" : "application/octet-stream";
  return r.fulfill({ status: 200, contentType: type, body: f.encoding === "base64" ? Buffer.from(f.content, "base64") : f.content });
});

/** Every anchor on the open page: its part, its words, where it goes, and a point on it nothing else covers. */
const ANCHORS = () => [...document.querySelectorAll("a")].map((a, i) => {
  a.setAttribute("data-probe", String(i));
  const part = a.closest("[data-page] [id]");
  const r = a.getBoundingClientRect();
  let free = 0, total = 0, point = null;
  const rects = [...a.getClientRects(), ...[...a.querySelectorAll("*")].flatMap((c) => [...c.getClientRects()])].filter((q) => q.width > 0 && q.height > 0);
  /* Every 4px, and never fewer than 8 points a side, so a 16px icon on a link is seen. */
  for (const q of rects) {
    const nx = Math.max(8, Math.ceil(q.width / 4)), ny = Math.max(8, Math.ceil(q.height / 4));
    for (let gx = 0.5; gx < nx; gx++) for (let gy = 0.5; gy < ny; gy++) {
    const x = q.left + (q.width * gx) / nx, y = q.top + (q.height * gy) / ny;
    total++;
    const hit = document.elementFromPoint(x, y);
    if (hit && a.contains(hit)) { free++; point ??= { x, y }; }
    }
  }
  return {
    i, part: part?.id ?? null, words: a.textContent.replace(/\s+/g, " ").trim(), raw: a.getAttribute("href"),
    href: a.hasAttribute("href") ? a.href : null, target: a.getAttribute("target"),
    nested: !!a.parentElement?.closest("a") || !!a.querySelector("a, button, input, select, textarea"),
    free, total, point, box: { w: Math.round(r.width), h: Math.round(r.height) },
  };
});

const emitted = {};
const followed = [];
const passedThrough = {};
const reach = new Set();
for (const p of s.pages) {
  const file = fileOf(p);
  const want = held.filter((h) => h.page === p.id);
  if (!paths.has(file)) { check(`${names[p.id]}: exported`, false, `${file} not in the tree`); continue; }
  await out.goto(ORIGIN + file, { waitUntil: "networkidle" });
  await out.evaluate(() => document.fonts?.ready);
  /* Taller than the page, so every link is inside the window a press is measured in. */
  await out.setViewportSize({ width: s.frameWidth + 200, height: Math.max(1000, await out.evaluate(() => document.documentElement.scrollHeight) + 50) });
  const got = await out.evaluate(ANCHORS);
  emitted[p.id] = got.length;

  /* Every link the document holds on this page has its anchor, in its own part, going where the document says. */
  const left = [...got];
  const missing = [];
  for (const h of want) {
    const to = h.link.kind === "node" ? `${ORIGIN}${file}#${h.link.target}` : landing(h.link);
    const k = left.findIndex((a) => a.part === h.node && a.href === to && (h.words == null || a.words === h.words.replace(/\s+/g, " ").trim()));
    if (k < 0) missing.push(`${h.node}${h.words ? ` "${h.words}"` : ""} → ${to}`);
    else left.splice(k, 1);
  }
  check(`${names[p.id]}: every link the document holds is an <a href> in its part, going where the document says`,
    missing.length === 0, `${want.length} held, ${got.length} emitted${missing.length ? `; missing ${missing.length}: ${missing.slice(0, 3).join("; ")}` : ""}`);
  check(`${names[p.id]}: and nothing is a link that the document does not say is one`,
    left.length === 0, left.length ? left.slice(0, 3).map((a) => `${a.part} "${a.words.slice(0, 30)}" ${a.raw}`).join("; ") : "");
  check(`${names[p.id]}: no link inside a link, and no control inside a link`,
    got.every((a) => !a.nested), got.filter((a) => a.nested).map((a) => a.part).join(", "));
  const blocked = got.filter((a) => !a.point);
  const covered = got.filter((a) => a.point && a.free < a.total);
  check(`${names[p.id]}: every link has a point a person can press`, blocked.length === 0,
    `${blocked.map((a) => a.part).join(", ")}${covered.length ? `${blocked.length ? "; " : ""}partly under another part: ${covered.map((a) => `${a.part} ${Math.round((100 * a.free) / a.total)}% free`).join(", ")}` : ""}`);

  /*
   * WHAT SITS ON A LINK. The capture keeps a thing the site had inside a link
   * as a part BESIDE it, drawn on top, so it takes the press. His ruling, in
   * the export only: a part whose box is wholly inside a linked part's box,
   * and which has no link and nothing pressable of its own, lets the press
   * through (`pointer-events: none`). Only partly inside, or with a press of
   * its own, it keeps its press. Read here off what the exported page draws
   * and what the document says, never off the exporter's own choice.
   */
  /* A linked part is one whose whole box is a link; a link on a run of its words is a press of its own, not a box to sit on. */
  const partsHere = s.nodes.filter((n) => n.pageId === p.id).map((n) => ({ id: n.id, linked: !!n.link?.target, runLink: Array.isArray(n.content) && n.content.some((r) => r?.link?.target) }));
  const lay = await out.evaluate((parts) => {
    const PRESS = "a[href], button, input, select, textarea, [tabindex], [role=link], [role=button]";
    const all = parts.map((q) => {
      const el = document.getElementById(q.id);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      /* Where a press on this part follows its link: the link's own boxes, and everything drawn inside it. */
      const a = q.linked ? el.querySelector("a[href]") : null;
      const lr = a ? [a, ...a.querySelectorAll("*")].flatMap((c) => [...c.getClientRects()]).filter((k) => k.width > 0 && k.height > 0) : [];
      const link = lr.length ? { x0: Math.min(...lr.map((k) => k.left)), y0: Math.min(...lr.map((k) => k.top)), x1: Math.max(...lr.map((k) => k.right)), y1: Math.max(...lr.map((k) => k.bottom)) } : null;
      return { ...q, x0: r.left, y0: r.top, x1: r.right, y1: r.bottom, link, own: el.matches(PRESS) || !!el.querySelector(PRESS), pe: getComputedStyle(el).pointerEvents };
    }).filter(Boolean);
    const E = 0.01;
    const inside = (q, l) => q.x0 >= l.x0 - E && q.y0 >= l.y0 - E && q.x1 <= l.x1 + E && q.y1 <= l.y1 + E;
    const over = (q, l) => q.x0 < l.x1 && q.x1 > l.x0 && q.y0 < l.y1 && q.y1 > l.y0;
    const links = all.filter((q) => q.linked);
    return all.filter((q) => q.x1 > q.x0 && q.y1 > q.y0).map((q) => {
      const holders = links.filter((l) => l.id !== q.id && inside(q, l)).sort((a, b) => (a.x1 - a.x0) * (a.y1 - a.y0) - (b.x1 - b.x0) * (b.y1 - b.y0));
      const clips = links.filter((l) => l.id !== q.id && over(q, l) && !inside(q, l)).map((l) => l.id);
      const h = holders[0];
      return { id: q.id, pe: q.pe, own: q.own || q.linked || q.runLink, holder: h?.id ?? null, inLink: !!h?.link && inside(q, h.link), clips, at: { x: (q.x0 + q.x1) / 2, y: (q.y0 + q.y1) / 2 } };
    });
  }, partsHere);
  const through = lay.filter((q) => q.holder && !q.own);
  const keeps = lay.filter((q) => q.holder && q.own);
  const clipping = lay.filter((q) => !q.holder && q.clips.length);
  const none = lay.filter((q) => q.pe === "none");
  passedThrough[p.id] = none.length;
  console.log(`  ${names[p.id]}: ${through.length} parts wholly on a link with no press of their own, ${keeps.length} wholly on one with a press of their own, ${clipping.length} only partly on one`);
  check(`${names[p.id]}: exactly the parts wholly on a link with no press of their own let the press through`,
    none.length === through.length && through.every((q) => q.pe === "none"),
    `${none.length} let it through, ${through.length} should${through.filter((q) => q.pe !== "none").length ? `; not: ${through.filter((q) => q.pe !== "none").slice(0, 4).map((q) => `${q.id} on ${q.holder}`).join(", ")}` : ""}${none.filter((q) => !through.includes(q)).length ? `; and should not: ${none.filter((q) => !through.includes(q)).map((q) => q.id).join(", ")}` : ""}`);
  /*
   * Pressed on its middle, each of those that sits inside its link's own box
   * reaches the link. One that sits on the linked part but outside the box
   * its link draws (a sidebar icon in a button's padding: the link is the
   * button's words, 159 by 20 in a 223 by 44 part, as in the preview) has
   * nothing under it to reach, and is counted rather than passed.
   */
  const beside = through.filter((q) => !q.inLink);
  if (beside.length) console.log(`  ${names[p.id]}: ${beside.length} of them sit on the linked part but outside the box its link draws, and a press there reaches no link: ${beside.map((q) => q.id).join(", ")}`);
  const reached = [];
  for (const q of through.filter((t) => t.inLink)) {
    const to = got.find((a) => a.part === q.holder)?.href;
    if (out.url() !== ORIGIN + file) await out.goto(ORIGIN + file, { waitUntil: "networkidle" });
    const pop = out.context().waitForEvent("page", { timeout: 1500 }).catch(() => null);
    const nav = out.waitForURL((u) => u.href !== ORIGIN + file, { timeout: 1500 }).catch(() => null);
    await out.mouse.click(q.at.x, q.at.y);
    const [popup] = await Promise.all([pop, nav]);
    const landed = popup ? popup.url() : out.url();
    if (popup) await popup.close();
    reached.push({ q, ok: !!to && landed === to, landed });
  }
  const missed = reached.filter((r) => !r.ok);
  check(`${names[p.id]}: pressed in its middle, every part wholly inside a link's box follows that link`, missed.length === 0,
    `${reached.length - missed.length}/${reached.length}${missed.length ? `; ${missed.slice(0, 3).map((r) => `${r.q.id} on ${r.q.holder} landed ${r.landed.replace(ORIGIN, "/")}`).join("; ")}` : ""}`);

  /* And pressed: a real mouse, on that point, lands on the target and the target opens. */
  for (const a of got) {
    if (!a.point || !a.href) { followed.push({ page: p.id, a, ok: false, why: a.href ? "nowhere to press" : "no href" }); continue; }
    if (out.url() !== ORIGIN + file) { await out.goto(ORIGIN + file, { waitUntil: "networkidle" }); }
    const before = asked.length;
    const pop = out.context().waitForEvent("page", { timeout: 1500 }).catch(() => null);
    const nav = out.waitForURL((u) => u.href !== ORIGIN + file, { timeout: 1500 }).catch(() => null);
    await out.mouse.click(a.point.x, a.point.y);
    const [popup] = await Promise.all([pop, nav]);
    let landed = popup ? popup.url() : out.url();
    if (popup) { await popup.waitForLoadState().catch(() => {}); landed = popup.url(); await popup.close(); }
    const opened = landed.startsWith(ORIGIN) ? paths.has(new URL(landed).pathname.replace(/^\/+/, "")) : asked.length > before || !!popup;
    const ok = landed === a.href && opened;
    followed.push({ page: p.id, a, ok, why: ok ? "" : `landed ${landed.replace(ORIGIN, "/")}` });
    if (ok && landed.startsWith(ORIGIN)) { const t = s.pages.find((q) => ORIGIN + fileOf(q) === landed.split("#")[0]); if (t) reach.add(`${p.id}>${t.id}`); }
  }
}
const bad = followed.filter((f) => !f.ok);
check("every link, pressed, lands on its target and the target opens", followed.length > 0 && bad.length === 0,
  `${followed.length - bad.length}/${followed.length}${bad.length ? `; ${bad.slice(0, 3).map((f) => `${names[f.page]} ${f.a.part}: ${f.why}`).join("; ")}` : ""}`);

/* Every page is reached from every page the document says links to it. */
const pairs = new Set(held.filter((h) => h.link.kind === "page" && pageBy(h.link.target)).map((h) => `${h.page}>${pageBy(h.link.target).id}`));
const unreached = [...pairs].filter((k) => !reach.has(k));
check("every page is reached from every page that links to it", pairs.size > 0 && unreached.length === 0,
  `${pairs.size - unreached.length}/${pairs.size} page-to-page pairs${unreached.length ? `; not: ${unreached.slice(0, 4).map((k) => k.split(">").map((x) => names[x]).join(" → ")).join(", ")}` : ""}`);

/* The two numbers. */
const total = Object.values(emitted).reduce((a, b) => a + b, 0);
console.log("\n  page            held  emitted  press let through");
for (const p of s.pages) console.log(`  ${names[p.id].padEnd(14)} ${String(held.filter((h) => h.page === p.id).length).padStart(5)}  ${String(emitted[p.id] ?? 0).padStart(7)}  ${String(passedThrough[p.id] ?? 0).padStart(17)}`);
console.log(`  ${"all".padEnd(14)} ${String(held.length).padStart(5)}  ${String(total).padStart(7)}`);
check("the document's links and the export's links are the same number, page by page", s.pages.every((p) => held.filter((h) => h.page === p.id).length === (emitted[p.id] ?? 0)),
  `document ${held.length}, export ${total}`);
check("the export threw nothing", outErrors.length === 0, outErrors.slice(0, 2).join("; "));

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
