/**
 * A real site, over the open web, becomes parts a person can move and prompt.
 *
 * The site-read arc (`siteFetch.ts`, `siteRead.ts`, `recreate.ts`,
 * `FromASite.tsx`, `surfaceRun.ts`) was built by a session whose browser
 * could not reach a live page, so its route was only ever exercised on a
 * fixture and a zip. This is the same bar the zip import holds, held
 * against a page nobody here wrote, over the network, by measurement:
 *
 *   0. **The page is the real page.** Fetched from this machine with no
 *      browser in it: the status, the bytes, and a line that is on it.
 *   1. **The reader finds the page's real blocks.** What the route lists
 *      is compared with the page's own landmarks, read in a second browser
 *      by a query that is not the reader's: the count, and every box.
 *   2. **One element lands as a real library part** in a drawn space,
 *      carrying the space's plan, and is moved, resized and prompted by
 *      hand exactly like anything drawn.
 *   3. **The drawn ratio holds against the live page's own geometry**, to
 *      three decimals: the surface's proportion, and every block's place
 *      and size as a share of the page, against the landmarks read in 1.
 *
 * Every number that is asserted is printed beside the assertion, so the
 * report can be read off the run. Where a number falls short of the bar
 * the check fails rather than being widened, because the naming is the
 * point.
 *
 * The page is https://playwright.dev/ unless another is given: a public
 * page with a bar, a first screen, a card row, feature bands and a footer.
 * The comparisons below are written against its landmarks (`nav`,
 * `header`, `main > section`, `footer`); another page needs its own.
 *
 *   node tests/site-live.mjs [builder url] [page url]
 *   SHOTS=1 node tests/site-live.mjs
 */
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { pageBlocks } from "../src/features/studio/bring-in/zipImport.ts";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const BUILDER = process.argv[2] ?? "http://localhost:3000";
const SITE = process.argv[3] ?? "https://playwright.dev/";
const HOST = new URL(SITE).hostname.replace(/^www\./, "");
const WIDTH = 1280;
const SHOTS = !!process.env.SHOTS;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const note = (l) => console.log(`  note  ${l}`);
const r3 = (v) => Math.round(v * 1000) / 1000;

/* ------------------------------------------------------------------ */
/* 0. The page itself, from here, with no browser in it                 */
/* ------------------------------------------------------------------ */

/** The body and status of a public page, by Node's own fetch, else by curl where fetch has no proxy. */
async function fetchPlain(url) {
  try {
    const res = await fetch(url, { redirect: "follow" });
    return { status: res.status, body: await res.text() };
  } catch {
    const out = execFileSync("curl", ["-sS", "-L", "--max-time", "30", "-w", "\n%{http_code}", url], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    const cut = out.lastIndexOf("\n");
    return { status: Number(out.slice(cut + 1)), body: out.slice(0, cut) };
  }
}

const plain = await fetchPlain(SITE);
const bytes = Buffer.byteLength(plain.body);
const titleOnIt = (/<title[^>]*>([^<]+)<\/title>/i.exec(plain.body) ?? [])[1]?.trim() ?? "";
check("the page answers from here, with a body that is a page", plain.status === 200 && bytes > 5000 && /^\s*<!doctype html/i.test(plain.body), `${SITE} status ${plain.status}, ${bytes} bytes, first line ${JSON.stringify(plain.body.split("\n")[0].slice(0, 60))}`);
check("and it is the page it says it is, by its own title", titleOnIt.length > 5, JSON.stringify(titleOnIt));
const second = await fetchPlain("https://example.com/");
check("a second host answers too, so the egress is the open web and not one allowance", second.status === 200 && /Example Domain/.test(second.body), `example.com status ${second.status}, ${Buffer.byteLength(second.body)} bytes`);

/* ------------------------------------------------------------------ */
/* 1. The reader's blocks against the page's own landmarks              */
/* ------------------------------------------------------------------ */

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });

/* The page in a browser of this test's own, read by a query that is not
   the reader's: the landmarks in document order, each with its box. The
   same width and the same settle as the route, so the two see one page. */
const mine = await browser.newPage({ viewport: { width: WIDTH, height: 900 } });
await mine.goto(SITE, { waitUntil: "domcontentloaded", timeout: 30_000 });
/* Settled the way the route settles: until the page's requests go quiet,
   up to four seconds, then 300ms. Read 900ms after load while the route
   read after the quiet, three boxes on the page differed between the two,
   which is the page still laying out, not the reader. */
await mine.waitForLoadState("networkidle", { timeout: 4000 }).catch(() => undefined);
await mine.waitForTimeout(300);
const landmarks = await mine.evaluate(() => {
  const pick = Array.from(document.querySelectorAll("nav, header, main > section, footer"));
  return pick
    .map((e) => { const r = e.getBoundingClientRect(); return { tag: e.tagName.toLowerCase(), x: Math.round(r.x + scrollX), y: Math.round(r.y + scrollY), w: Math.round(r.width), h: Math.round(r.height), words: (e.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 50), links: e.querySelectorAll("a[href]").length, worded: Array.from(e.querySelectorAll("a[href]")).filter((a) => (a.textContent ?? "").trim()).length } })
    .filter((b) => b.w > 0 && b.h > 0)
    .sort((a, b) => a.y - b.y);
});
/* The foot of the page, by my own look: its links in order and its paint. */
const footSeen = await mine.evaluate(() => {
  const f = document.querySelector("footer");
  if (!f) return null;
  return {
    links: Array.from(f.querySelectorAll("a[href]")).map((a) => (a.textContent ?? "").replace(/\s+/g, " ").trim()).filter(Boolean),
    bg: getComputedStyle(f).backgroundColor,
    text: getComputedStyle(f).color,
  };
});
/* And three more things by my own look, each for one of the shortfalls
   named the first night: what the bar's icon links are called, what the
   first screen is painted with, and what the card row's titles are. */
const seen = await mine.evaluate(() => {
  const text = (e) => (e.textContent ?? "").replace(/\s+/g, " ").trim();
  const nav = document.querySelector("nav");
  const navNames = nav ? Array.from(nav.querySelectorAll("a[href]")).map((a) => text(a) || a.getAttribute("aria-label") || a.getAttribute("title") || "") : [];
  const hero = document.querySelector("header");
  const image = hero ? getComputedStyle(hero).backgroundImage : "none";
  const stops = Array.from(image.matchAll(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/g)).map((m) => [Number(m[1]), Number(m[2]), Number(m[3])]);
  const mean = stops.length ? `rgb(${[0, 1, 2].map((i) => Math.round(stops.reduce((n, c) => n + c[i], 0) / stops.length)).join(", ")})` : null;
  const cards = document.querySelector("main > section");
  const cardTitles = cards ? Array.from(cards.querySelectorAll("h2, h3")).map(text) : [];
  return { navNames, heroImage: image.slice(0, 120), heroStops: stops.length, heroMean: mean, heroText: hero ? getComputedStyle(hero).color : null, cardTitles };
});
const pageBottom = Math.max(...landmarks.map((b) => b.y + b.h));
const pageHeight = await mine.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight));
const headlineOnIt = await mine.evaluate(() => (document.querySelector("h1")?.textContent ?? "").replace(/\s+/g, " ").trim());
if (SHOTS) { mkdirSync("docs/shots", { recursive: true }); await mine.screenshot({ path: "docs/shots/site-live-page.png", fullPage: true }); }
note(`${HOST} by my own look: ${landmarks.length} landmarks, ${pageHeight} tall at ${WIDTH} wide, the last ending at ${pageBottom}; the big line on it: ${JSON.stringify(headlineOnIt.slice(0, 90))}`);
for (const b of landmarks) note(`  ${b.tag.padEnd(8)} @${b.x},${b.y} ${b.w}×${b.h} ${b.links} links "${b.words}"`);
const titleSeen = await mine.evaluate(() => document.title);
check("the page in the browser carries the same title as the body that came back, so the two are one page", titleSeen === titleOnIt && titleOnIt.length > 5, JSON.stringify(titleSeen));
note(`the big line ${plain.body.includes(headlineOnIt.split(" ").slice(0, 3).join(" ")) ? "is" : "is not"} in the ${bytes} bytes that came back: the page draws its words by script, which the route runs and the zip path does not`);

/* The route, asked from the Builder's own origin, as the panel asks it. */
const own = await browser.newPage();
await own.goto(`${BUILDER}/builder`, { waitUntil: "domcontentloaded" });
const post = (body) => own.evaluate(async ([url, b]) => {
  try {
    const r = await fetch(`${url}/api/studio/element`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
    return await r.json();
  } catch (e) { return { ok: false, message: String(e) }; }
}, [BUILDER, body]);

const listed = await post({ url: SITE, width: WIDTH });
check("the route opens the live page and lists what is worth pointing at", listed.ok === true && Array.isArray(listed.candidates) && listed.candidates.length >= 9, listed.ok ? `${listed.candidates.length} candidates in ${listed.took}s, page ${listed.page.width}×${listed.page.height}` : `${listed.reason}: ${listed.message}`);
if (!listed.ok) { await browser.close(); process.exit(1); }
check("the page it measured is as tall as the page I looked at", listed.page.height === pageHeight, `${listed.page.height} vs ${pageHeight}`);
const png = Buffer.from(listed.page.shot, "base64");
const shotW = png.readUInt32BE(16), shotH = png.readUInt32BE(20);
/* The whole page, not the first 900px of it: candidates come from the
   whole page, and nothing below the fold could be pointed at by eye. */
check("with a picture of it that is a real picture of the whole page, not a placeholder", png.subarray(1, 4).toString() === "PNG" && shotW === WIDTH && shotH === Math.min(pageHeight, 4000) && png.length > 50_000, `${shotW}×${shotH} for a page ${pageHeight} tall, ${png.length} bytes`);
/* A page that answers with an error is not a page to point at: a 404's
   own error page was listed as "N things to point at". */
const missing = await post({ url: new URL("/no-such-page-" + Date.now(), SITE).toString(), width: WIDTH });
check("a page that answers 404 is refused, and the status is said", missing.ok === false && missing.reason === "status" && /404/.test(missing.message), missing.ok ? `listed ${missing.candidates.length} things` : `${missing.reason}: ${missing.message}`);
/* Every candidate, found again on the page by the selector it gave: the
   same box, or another element's, or nothing at all. */
/* The box as the reader lists it: grown to hold children, and their
   children, that run out of it and touch it (a row with negative margins
   inside a padded wrapper, a floated section's paragraphs), never placed
   ones. Read raw, three rows on this page were 32px narrower than the
   reader listed them, which was the growing and not a wrong selector. */
const foundAgain = await mine.evaluate((cands) => cands.map((c) => {
  const e = document.querySelector(c.selector);
  if (!e) return "nothing";
  const own = e.getBoundingClientRect();
  let x0 = own.left, y0 = own.top, x1 = own.right, y1 = own.bottom;
  const kids = [];
  for (const ch of Array.from(e.children)) for (const k of [ch, ...Array.from(ch.children)]) {
    const kr = k.getBoundingClientRect(); const cs = getComputedStyle(k);
    if (kr.width >= 8 && kr.height >= 8 && cs.display !== "none" && cs.position !== "fixed" && cs.position !== "absolute") kids.push(kr);
  }
  for (let more = true; more;) {
    more = false;
    for (const kr of kids) {
      if (kr.bottom <= y1 + 2 && kr.top >= y0 - 2 && kr.left >= x0 - 2 && kr.right <= x1 + 2) continue;
      if (!(kr.top <= y1 + 24 && kr.bottom >= y0 - 24 && kr.left <= x1 + 24 && kr.right >= x0 - 24)) continue;
      x0 = Math.min(x0, kr.left); y0 = Math.min(y0, kr.top); x1 = Math.max(x1, kr.right); y1 = Math.max(y1, kr.bottom); more = true;
    }
  }
  const r = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
  const same = Math.abs(Math.round(r.x + scrollX) - c.box.x) <= 2 && Math.abs(Math.round(r.y + scrollY) - c.box.y) <= 2 && Math.abs(Math.round(r.width) - c.box.w) <= 2 && Math.abs(Math.round(r.height) - c.box.h) <= 2;
  return same ? "same" : `another: ${Math.round(r.width)}×${Math.round(r.height)} at ${Math.round(r.x + scrollX)},${Math.round(r.y + scrollY)} here, ${c.box.w}×${c.box.h} at ${c.box.x},${c.box.y} read`;
}), listed.candidates);
const notSame = foundAgain.map((v, i) => (v === "same" ? null : `${i + 1}: ${v} for ${listed.candidates[i].selector}`)).filter(Boolean);
check("every candidate can be found again by the selector it gave, and it is the same box", notSame.length === 0, notSame.length ? `${notSame.length} of ${listed.candidates.length} not: ${notSame.slice(0, 3).join("; ")}${notSame.length > 3 ? "; …" : ""}` : `${listed.candidates.length} of ${listed.candidates.length}`);
if (notSame.length) {
  const steps = new Set(listed.candidates.filter((_, i) => foundAgain[i] !== "same").map((c) => c.selector.split(" > ").length));
  const shown = foundAgain.slice(0, 24).filter((v) => v !== "same").length;
  note(`the ones not found again are ${[...steps].join(", ")} steps deep, the reader's path being cut at six under body; ${shown} of the 24 the panel shows would come back as gone if pressed`);
}
/* A wordless candidate must be a box of pictures. Its selector may not
   find it (see above), so the box itself is looked for: any element on
   the page with that box that holds a picture. */
const wordless = listed.candidates.filter((c) => !c.words.length);
const wordlessArePictures = await mine.evaluate((boxes) => boxes.every((b) => Array.from(document.querySelectorAll("body *")).some((e) => {
  const r = e.getBoundingClientRect();
  return Math.abs(Math.round(r.x + scrollX) - b.x) <= 2 && Math.abs(Math.round(r.y + scrollY) - b.y) <= 2 && Math.abs(Math.round(r.width) - b.w) <= 2 && Math.abs(Math.round(r.height) - b.h) <= 2 && e.querySelectorAll("img, picture, video, canvas").length > 0;
})), wordless.map((c) => c.box));
check("every candidate has words on it read off the page, or is a box of pictures", listed.candidates.every((c) => c.box.w > 0 && c.box.h > 0) && wordlessArePictures, `${wordless.length} wordless of ${listed.candidates.length}${wordless.length ? `, ${wordlessArePictures ? "each a box of pictures" : "not all boxes of pictures"}: ${wordless.map((c) => `${c.what} ${c.box.w}×${c.box.h} at ${c.box.y}`).join("; ")}` : ""}`);
await mine.close();
const blocks = pageBlocks(listed.candidates);
note(`the reader's blocks: ${blocks.length}`);
for (const b of blocks) note(`  ${b.what.padEnd(22)} @${b.box.x},${b.box.y} ${b.box.w}×${b.box.h}  ${b.selector.slice(0, 60)}`);
check("the page is as many blocks as it has landmarks", blocks.length === landmarks.length, `${blocks.length} blocks, ${landmarks.length} landmarks`);
const sameBox = (a, b) => Math.abs(a.x - b.x) <= 2 && Math.abs(a.y - b.y) <= 2 && Math.abs(a.w - b.w) <= 2 && Math.abs(a.h - b.h) <= 2;
const off = blocks.map((b, i) => (landmarks[i] && sameBox(b.box, landmarks[i]) ? null : `${i}: ${b.box.w}×${b.box.h}@${b.box.y} vs ${landmarks[i] ? `${landmarks[i].w}×${landmarks[i].h}@${landmarks[i].y}` : "nothing"}`)).filter(Boolean);
check("and every block is a landmark's own box, top to bottom, within two pixels", off.length === 0, off.join("; ") || `${blocks.length} of ${blocks.length} match`);
const nav = landmarks.find((b) => b.tag === "nav");
const barBlock = blocks[0];
check("the bar's caption on the list keeps its links apart", /^Playwright Docs MCP CLI API/.test(barBlock?.words ?? ""), JSON.stringify(barBlock?.words.slice(0, 50)));
check("the first block is the bar across the top: as wide as the page, short, at nought", !!barBlock && barBlock.box.y === 0 && barBlock.box.w === WIDTH && barBlock.box.h < 160, barBlock ? `${barBlock.box.w}×${barBlock.box.h} at ${barBlock.box.y}` : "no block");
check("the last block is the foot of the page, ending where the page ends", blocks.at(-1)?.what === "the foot of the page" && blocks.at(-1).box.y + blocks.at(-1).box.h === pageBottom, blocks.at(-1) ? `${blocks.at(-1).what}, ends at ${blocks.at(-1).box.y + blocks.at(-1).box.h}` : "no block");

/* Where the bar sits on the panel's list, which shows the biggest 24. */
const barAt = listed.candidates.findIndex((c) => nav && sameBox(c.box, nav));
note(`the bar across the top is the ${barAt + 1}th biggest thing listed, past the 24 the panel shows; the panel lists the page's blocks first, so it is pressed there below`);

/* One reading, the bar's, off the live page. */
const barRead = await post({ url: SITE, selector: barBlock.selector, width: WIDTH });
check("the bar is measured in full off the live page", barRead.ok === true && barRead.reading.box.h === barBlock.box.h && barRead.reading.links.length >= 2, barRead.ok ? `${barRead.reading.box.w}×${barRead.reading.box.h}, ${barRead.reading.text.length} runs, ${barRead.reading.links.length} links, ${barRead.reading.buttons.length} buttons, painted ${barRead.reading.paint.bg} in ${barRead.reading.type.family.split(",")[0]}` : barRead.message);
check("with every link I can see on it, the icon ones named by their labels", barRead.ok && nav && barRead.reading.links.length === Math.min(30, nav.links) && barRead.reading.links.every((l, i) => l.words === seen.navNames[i]), barRead.ok ? `${barRead.reading.links.length} read of ${nav?.links} there, ${nav ? nav.links - nav.worded : 0} of them icons: ${barRead.reading.links.map((l) => l.words).join(" · ")}` : "");
await own.close();

/* ------------------------------------------------------------------ */
/* 2. By hand: one element from the live page, in a drawn space        */
/* ------------------------------------------------------------------ */

const state = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {});
const drawSpace = async (page, B) => {
  const PANE = await page.locator("[data-ctx='studio-canvas']").first().boundingBox();
  const at = { x: PANE.x + B.x, y: PANE.y + B.y, w: B.w, h: B.h };
  const pts = [[at.x, at.y], [at.x + at.w, at.y], [at.x + at.w, at.y + at.h], [at.x, at.y + at.h], [at.x, at.y]];
  await page.mouse.move(PANE.x + PANE.width / 2, PANE.y + PANE.height / 2);
  await page.keyboard.press("s");
  await page.waitForTimeout(300);
  await page.mouse.move(pts[0][0], pts[0][1]);
  await page.mouse.down();
  for (const [x, y] of pts) { await page.mouse.move(x, y); await page.waitForTimeout(12); }
  await page.mouse.up();
  await page.waitForTimeout(450);
  await page.keyboard.press("v");
  await page.waitForTimeout(1900);
  await page.locator("[data-space-fill]").first().click({ force: true });
  await page.waitForTimeout(400);
  return page.locator("[data-space-panel]");
};
const readSite = async (panel) => {
  await panel.locator("[data-site-url]").fill(SITE);
  await panel.locator("[data-site-read]").click();
  await panel.locator("[data-site-take-all]").waitFor({ state: "visible", timeout: 60_000 }).catch(() => undefined);
};
const shot = async (page, n) => { if (SHOTS) await page.screenshot({ path: `docs/shots/site-live-${n}.png` }); };

const one = await browser.newPage({ viewport: { width: 1500, height: 950 } });
await one.goto(`${BUILDER}/builder`, { waitUntil: "networkidle" });
await one.waitForTimeout(1200);
const S1 = { x: 300, y: 90, w: 520, h: 200 };
const panel1 = await drawSpace(one, S1);
check("the space's panel has an address field and a Read button", (await panel1.locator("[data-site-url]").count()) === 1 && (await panel1.locator("[data-site-read]").count()) === 1);
await readSite(panel1);
const offered = await panel1.locator("[data-site-take-all]").count();
check("the live page is opened from the panel and shown, with the whole page on offer", offered === 1 && (await panel1.locator("[data-site-shot]").count()) === 1, (await panel1.locator("[data-site-said]").innerText().catch(() => "")).slice(0, 120));
const count = await panel1.locator("[data-site-take]").count();
check("it says how many things there are to point at, and shows the first 24", new RegExp(`${listed.candidates.length} things to point at on ${HOST.replace(/\./g, "\\.")}`).test(await panel1.innerText()) && count === Math.min(24, listed.candidates.length), `${count} shown of ${listed.candidates.length}`);
check("and how many blocks the page is", new RegExp(`Take the whole page, ${blocks.length} blocks`).test(await panel1.locator("[data-site-take-all]").innerText()), await panel1.locator("[data-site-take-all]").innerText());
const firstOffered = await panel1.locator("[data-site-take]").first().getAttribute("data-site-take");
check("the first thing on the list is the bar across the top, the page's blocks coming before what is inside them", firstOffered === barBlock.selector, `first offered: ${firstOffered}`);
check("and every one of the page's blocks is on the list", (await Promise.all(blocks.map((b) => panel1.locator(`[data-site-take="${b.selector}"]`).count()))).every((n) => n === 1), `${blocks.length} blocks`);
await shot(one, "offered");

/* The foot of the page: a real footer part, taken alone. */
const before1 = await state(one);
const footTake = panel1.locator("[data-site-take]").filter({ hasText: "the foot of the page" }).first();
check("the foot of the page is on the list to press", (await footTake.count()) === 1);
await footTake.click();
await panel1.locator("[data-site-said]").waitFor({ state: "visible", timeout: 60_000 }).catch(() => undefined);
const said1 = await panel1.locator("[data-site-said]").innerText().catch(() => "");
check("it lands, and the panel says what it became", /a footer with \d+ links\. It is a part of the library now/.test(said1), said1.slice(0, 140));
const st1 = await state(one);
const part = st1.nodes.find((n) => !before1.nodes?.some((b) => b.id === n.id));
const sp1 = st1.spaces[0];
const bx1 = Math.min(...sp1.boundary.map((p) => p[0])), by1 = Math.min(...sp1.boundary.map((p) => p[1]));
const bw1 = Math.max(...sp1.boundary.map((p) => p[0])) - bx1, bh1 = Math.max(...sp1.boundary.map((p) => p[1])) - by1;
const foot = landmarks.find((b) => b.tag === "footer");
check("it is a real part of the library, the footer, not a picture with fields on it", !!part && part.featureId === "footer" && !part.custom && !part.code && typeof part.content === "string", part ? `${part.featureId}, ${part.content.split("\n").length} lines` : "nothing landed");
check("named for what it is and whose it was", part?.label === `Footer from ${HOST}`, part?.label);
const footLines = part ? part.content.split("\n").slice(1) : [];
check("with the page's own links in it, in the order they are on the page, ten at most", !!footSeen && footLines.length === Math.min(10, footSeen.links.length) && footLines.every((l, i) => l === footSeen.links[i]), `${footLines.length} of ${footSeen?.links.length ?? 0} on the page: ${footLines.slice(0, 4).join(" · ")}`);
check("painted the colour the page painted it, its words in theirs", !!part?.colour && !!footSeen && part.colour.bg === footSeen.bg && part.colour.text === footSeen.text, `${JSON.stringify(part?.colour)} vs ${footSeen?.bg} / ${footSeen?.text} on the page`);
check("and a prompt of its own that says where it is from", !!part && new RegExp(`^Recreated from ${HOST.replace(/\./g, "\\.")}: the foot of the page`).test(part.prompt), part?.prompt.slice(0, 60));
check("it says where it came from, by address and selector", part?.from?.host === HOST && part?.from?.url === SITE && part?.from?.selector === blocks.at(-1).selector, JSON.stringify(part?.from));
check("it lands inside the space, fitted to it", !!part && part.x + part.w / 2 > bx1 && part.x + part.w / 2 < bx1 + bw1 && part.y + part.h / 2 > by1 && part.y + part.h / 2 < by1 + bh1 && part.w <= bw1 * 0.9 + 1 && part.h <= bh1 * 0.9 + 1, part ? `${part.w}×${part.h} in a space ${Math.round(bw1)}×${Math.round(bh1)}` : "");
check("keeping the page's proportion for it, to two decimals", !!part && foot && Math.abs(r3(part.w / part.h) - r3(foot.w / foot.h)) < 0.05, part && foot ? `${r3(part.w / part.h)} drawn vs ${r3(foot.w / foot.h)} on the page` : "");

/* Now the bar itself: what he did not make, handled like what he drew. */
const el = one.locator(`[data-node-id="${part?.id}"]`);
const eb = await el.boundingBox();
check("it is on the board where the space put it", !!eb && eb.width > 40, eb ? `${Math.round(eb.width)}×${Math.round(eb.height)} on screen` : "not on screen");
await one.mouse.click(eb.x + eb.width / 2, eb.y + eb.height / 2);
await one.waitForTimeout(400);
const own1 = one.locator(`[data-space-panel="${part?.id}"]`);
check("picked, it has the same panel a drawn part in a space has", (await own1.count()) === 1);
check("which says what it is and where it came from", (await own1.locator("[data-space-what]").inputValue().catch(() => "")) === `Footer from ${HOST}` && new RegExp(HOST.replace(/\./g, "\\.")).test(await own1.locator("[data-space-asked]").inputValue().catch(() => "")));
const steps = await own1.locator("[data-space-step]").count();
check("with a model and steps, because it carries the space's plan like anything drawn", !/^No model/.test((await own1.locator("[data-space-model]").innerText().catch(() => "No model")).trim()) && steps >= 3, `${steps} steps, model: ${(await own1.locator("[data-space-model]").innerText().catch(() => "")).trim().slice(0, 40)}`);
await own1.locator("[data-space-asked]").fill("Make it the foot of a bakery's site, warm and low");
await one.waitForTimeout(300);
check("and he can prompt it, in its own words", (await state(one)).nodes.find((n) => n.id === part.id)?.prompt === "Make it the foot of a bakery's site, warm and low");
await shot(one, "part");

await one.mouse.move(eb.x + eb.width / 2, eb.y + eb.height / 2);
await one.mouse.down();
await one.mouse.move(eb.x + eb.width / 2 + 40, eb.y + eb.height / 2 + 20, { steps: 8 });
await one.mouse.move(eb.x + eb.width / 2 + 80, eb.y + eb.height / 2 + 40, { steps: 8 });
await one.mouse.up();
await one.waitForTimeout(400);
const moved = (await state(one)).nodes.find((n) => n.id === part.id);
check("and move it, like anything drawn", !!moved && (moved.x !== part.x || moved.y !== part.y), moved ? `from ${part.x},${part.y} to ${moved.x},${moved.y}` : "gone");

const eb2 = await el.boundingBox();
await one.mouse.click(eb2.x + eb2.width / 2, eb2.y + eb2.height / 2);
await one.waitForTimeout(300);
const grip = el.locator('[data-resize="se"]');
check("picked, it carries the same resize handles a drawn part carries", (await grip.count()) === 1, `${await el.locator("[data-resize]").count()} handles`);
const gb = await grip.boundingBox().catch(() => null);
if (gb) {
  await one.mouse.move(gb.x + gb.width / 2, gb.y + gb.height / 2);
  await one.mouse.down();
  await one.mouse.move(gb.x + gb.width / 2 + 30, gb.y + gb.height / 2 + 15, { steps: 8 });
  await one.mouse.move(gb.x + gb.width / 2 + 60, gb.y + gb.height / 2 + 30, { steps: 8 });
  await one.mouse.up();
  await one.waitForTimeout(400);
}
const sized = (await state(one)).nodes.find((n) => n.id === part.id);
check("and resize it, like anything drawn", !!sized && !!moved && sized.w > moved.w && sized.h > moved.h, sized && moved ? `from ${moved.w}×${moved.h} to ${sized.w}×${sized.h}` : "gone");
await shot(one, "resized");

await one.close();

/* The bar itself, taken alone into a fresh space, because a person wants the nav. */
const two = await browser.newPage({ viewport: { width: 1500, height: 950 } });
await two.goto(`${BUILDER}/builder`, { waitUntil: "networkidle" });
await two.waitForTimeout(1200);
const panel2b = await drawSpace(two, { x: 300, y: 90, w: 520, h: 200 });
await readSite(panel2b);
const barTakeNow = panel2b.locator(`[data-site-take="${barBlock.selector}"]`);
check("the bar across the top is on the list to press", (await barTakeNow.count()) === 1, `${await panel2b.locator("[data-site-take]").count()} on the list`);
const beforeBar = await state(two);
await barTakeNow.click();
await panel2b.locator("[data-site-said]").waitFor({ state: "visible", timeout: 60_000 }).catch(() => undefined);
const saidBar = await panel2b.locator("[data-site-said]").innerText().catch(() => "");
const stBar = await state(two);
const barPart = stBar.nodes.find((n) => !beforeBar.nodes?.some((b) => b.id === n.id));
const sb2 = stBar.spaces[0].boundary;
const bx2 = Math.min(...sb2.map((p) => p[0])), by2 = Math.min(...sb2.map((p) => p[1]));
const bw2 = Math.max(...sb2.map((p) => p[0])) - bx2, bh2 = Math.max(...sb2.map((p) => p[1])) - by2;
check("the bar taken alone lands as the library's top bar, with the page's name and links on it", !!barPart && barPart.featureId === "sticky-header" && barPart.content.startsWith("logo: Playwright\nDocs\nMCP"), barPart ? `${barPart.featureId}: ${JSON.stringify(barPart.content.split("\n").join(" · "))}` : saidBar.slice(0, 100));
check("inside the space, fitted, at the bar's own proportion to two decimals", !!barPart && barPart.x + barPart.w / 2 > bx2 && barPart.x + barPart.w / 2 < bx2 + bw2 && barPart.y + barPart.h / 2 > by2 && barPart.y + barPart.h / 2 < by2 + bh2 && Math.abs(barPart.w / barPart.h - barBlock.box.w / barBlock.box.h) < 0.05, barPart ? `${barPart.w}×${barPart.h}, ${(barPart.w / barPart.h).toFixed(3)} vs ${(barBlock.box.w / barBlock.box.h).toFixed(3)} on the page` : "");
/* And what the part draws of it, measured on the board: the page's white
   bar with its links written on it, or the part's own idea of a bar. */
/* Measured on the part inside the node, not the node: the node carries a
   caption and a frame of its own, and reading those said the bar was
   dark and captioned "Sticky top bar". */
/* White as the browser reports it: the part writes its paint in oklch, so a white box computes as oklch(1 0 0). */
/* Lightness of what was drawn, whichever form the browser reports it in. */
const lightOf = (c) => {
  const ok = /oklch\(([\d.]+)/.exec(c ?? "");
  if (ok) return Number(ok[1]);
  const rgb = /rgb\((\d+), (\d+), (\d+)\)/.exec(c ?? "");
  return rgb ? (0.2126 * rgb[1] + 0.7152 * rgb[2] + 0.0722 * rgb[3]) / 255 : 1;
};
const isWhite = (c) => /^oklch\(1 0 0\)|^rgb\(255, 255, 255\)/.test(c ?? "");
const drawnPart = (page, id) => page.evaluate((id) => {
  const parts = Array.from(document.querySelectorAll(`[data-node-id="${id}"] [data-part]`));
  const el = parts[0];
  if (!el) return null;
  /* The paint on the part's own box. A point probe through
     `elementsFromPoint` was tried and read the board's own hit layer over
     every part as oklch(0.145 0.014 265), the same for a white bar and a
     dark first screen, so it measured the board and not the part. The
     part paints its box and its children paint theirs on top; the box's
     colour is what a person sees between the words. */
  return { parts: parts.map((p) => `${p.getAttribute("data-part")}@${Math.round(p.getBoundingClientRect().width)}px bg ${getComputedStyle(p).backgroundColor}`), words: (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 80), bg: getComputedStyle(el).backgroundColor, links: el.querySelectorAll("a, button").length };
}, id);
const barDrawn = barPart ? await drawnPart(two, barPart.id) : null;
note(`the bar alone on the board: ${JSON.stringify(barDrawn?.parts)}`);
check("the bar carries the page's white as its paint", barPart?.colour?.bg === "rgb(255, 255, 255)", JSON.stringify(barPart?.colour));
check("and the part draws it white, at the width it landed", !!barDrawn && isWhite(barDrawn.bg), barDrawn ? `drawn ${barDrawn.bg}, ${barPart.w}px wide` : "not on the board");
/* What the part does with the links at that width is the part's own rule:
   the library's header folds its links under a menu below 640px, so a
   bar fitted into a space narrower than that shows its name and a menu. */
note(`at ${barPart?.w}px the part shows ${JSON.stringify(barDrawn?.words)} with ${barDrawn?.links} links or buttons: ${/Docs/.test(barDrawn?.words ?? "") ? "its links written on it" : "its links folded under a menu, which the header part does below 640px"}`);
await shot(two, "bar");
await two.close();

/* ------------------------------------------------------------------ */
/* 3. The whole page, and the drawn ratio against the page's own geometry */
/* ------------------------------------------------------------------ */

const all = await browser.newPage({ viewport: { width: 1500, height: 950 } });
await all.goto(`${BUILDER}/builder`, { waitUntil: "networkidle" });
await all.waitForTimeout(1200);
const S2 = { x: 300, y: 90, w: 520, h: 200 };
const panel2 = await drawSpace(all, S2);
await readSite(panel2);
const before2 = await state(all);
const drawnW = before2.spaces[0] ? Math.max(...before2.spaces[0].boundary.map((p) => p[0])) - Math.min(...before2.spaces[0].boundary.map((p) => p[0])) : 0;
await panel2.locator("[data-site-take-all]").click();
await panel2.locator("[data-site-said]").waitFor({ state: "visible", timeout: 90_000 }).catch(() => undefined);
const line = await panel2.locator("[data-site-said]").innerText().catch(() => "");
note(`the panel's line: ${line}`);
const real = Number((/(\d+) of (\d+) blocks/.exec(line) ?? [])[1]);
check("the page lands, and the panel says which blocks are real parts and which are less", new RegExp(`of ${blocks.length} blocks from ${HOST.replace(/\./g, "\\.")} are real parts of the library`).test(line), `${real} of ${blocks.length}`);
const st2 = await state(all);
const space = st2.spaces[0];
const parts = st2.nodes.filter((n) => !before2.nodes?.some((b) => b.id === n.id));
check("every block is a part on the board", parts.length === blocks.length, `${parts.length} parts for ${blocks.length} blocks`);
check("each a real part of the library with the page's words in it", parts.every((n) => !n.custom && !n.code && typeof n.content === "string" && n.content.length > 0), parts.map((n) => n.featureId).join(", "));
note(`what each became: ${parts.map((n) => `${n.label.replace(` from ${HOST}`, "")} = ${n.featureId}`).join(" · ")}`);
for (const n of [...parts].sort((a, b) => a.y - b.y)) note(`  ${n.featureId.padEnd(14)} ${n.w}×${n.h} bg ${n.colour?.bg ?? "none"} text ${n.colour?.text ?? "none"} ${n.font?.family ?? "no family"} ${n.font?.size ?? ""}: ${JSON.stringify(n.content.split("\n")[0].slice(0, 50))}`);
const bb = space.boundary;
const bx = Math.min(...bb.map((p) => p[0])), by = Math.min(...bb.map((p) => p[1]));
const bw = Math.max(...bb.map((p) => p[0])) - bx, bh = Math.max(...bb.map((p) => p[1])) - by;
check("the surface kept the width it was drawn", Math.abs(bw - drawnW) < 3, `${Math.round(bw)} vs ${Math.round(drawnW)} drawn`);
/* To three decimals means within half a thousandth of each other, measured
   on the numbers themselves and not on their roundings: two values a
   hair either side of a rounding boundary agree to three decimals and
   still round apart. */
const ratioApart = Math.abs(bh / bw - pageBottom / WIDTH);
check("and took the page's proportion, to three decimals", ratioApart < 0.0005, `${bw.toFixed(2)}×${bh.toFixed(2)} is ${(bh / bw).toFixed(5)}; the page's ${WIDTH}×${pageBottom} is ${(pageBottom / WIDTH).toFixed(5)}; ${ratioApart.toFixed(5)} apart, which is ${(ratioApart * bw).toFixed(2)}px of height`);
check("and the layout is locked, as the page had it", Array.isArray(space.locked) && space.locked.length === parts.length && space.form?.p === 1, `${space.locked?.length ?? 0} locked, form ${space.form?.p}`);
check("every part is inside the surface, so the space's plan reaches it", parts.every((n) => n.x + n.w / 2 > bx && n.x + n.w / 2 < bx + bw && n.y + n.h / 2 > by && n.y + n.h / 2 < by + bh));

/* Every block's place and size, as the lock holds it, against the page's
   own geometry read in 1: four shares each, to three decimals. */
const byY = [...space.locked].sort((a, b) => a.y - b.y);
const drift = [];
byY.forEach((l, i) => {
  const lm = landmarks[i];
  if (!lm) { drift.push(`${i}: no landmark`); return; }
  const page = { x: lm.x / WIDTH, y: lm.y / pageBottom, w: lm.w / WIDTH, h: lm.h / pageBottom };
  for (const k of ["x", "y", "w", "h"]) {
    const d = Math.abs(l[k] - page[k]);
    if (d >= 0.0005) drift.push(`${lm.tag} ${k}: ${l[k].toFixed(4)} drawn vs ${page[k].toFixed(4)} on the page`);
  }
});
const worst = Math.max(...byY.flatMap((l, i) => { const lm = landmarks[i]; if (!lm) return [1]; const page = { x: lm.x / WIDTH, y: lm.y / pageBottom, w: lm.w / WIDTH, h: lm.h / pageBottom }; return ["x", "y", "w", "h"].map((k) => Math.abs(l[k] - page[k])); }));
check("every block's place and size hold as a share of the page, to three decimals", drift.length === 0, drift.length ? `${drift.length} of ${byY.length * 4} shares off: ${drift.slice(0, 4).join("; ")}${drift.length > 4 ? "; …" : ""}` : `the largest drift is ${worst.toFixed(5)} over ${byY.length * 4} shares`);
note(`the largest drift over ${byY.length * 4} shares is ${worst.toFixed(5)} of the page (${(worst * pageBottom).toFixed(2)}px of ${pageBottom} tall); the lock holds shares to four decimals`);

/* The three shortfalls of the first night that live in the reading: the
   card row, the first screen's paint, and its headline whole. */
const byTop = [...parts].sort((a, b) => a.y - b.y);
const cardsPart = byTop[2];
check("the three-card row is cards, three in three columns, with the page's own titles", !!cardsPart && cardsPart.featureId === "card-grid" && cardsPart.options?.columns === "3" && cardsPart.content.split("\n").map((l) => l.split(": ")[0]).join("\n") === seen.cardTitles.slice(0, 3).join("\n"), cardsPart ? `${cardsPart.featureId} ${JSON.stringify(cardsPart.options)}: ${cardsPart.content.split("\n").join(" · ")} (on the page: ${seen.cardTitles.join(" · ")})` : "no third part");
/* The card band paints nothing and sits on a body that paints nothing,
   which is the browser's white canvas; read as painted on nothing, it
   took the site's dark surface and drew its dark titles on it. */
check("a band on the page's unpainted white ground carries white, so its dark titles can be read", cardsPart?.colour?.bg === "rgb(255, 255, 255)" && lightOf(cardsPart?.colour?.text) < 0.3, `${JSON.stringify(cardsPart?.colour)}`);
const heroPart = byTop[1];
const heroLight = (() => { const m = /rgb\((\d+), (\d+), (\d+)\)/.exec(heroPart?.colour?.bg ?? ""); return m ? (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255 : 1; })();
check("the first screen is painted the mean of its gradient's stops, which is dark, so its white words have a ground", !!heroPart && heroPart.featureId === "hero-split" && !!seen.heroMean && heroPart.colour?.bg === seen.heroMean && heroLight < 0.35 && heroPart.colour?.text === seen.heroText, heroPart ? `${heroPart.colour?.bg ?? "no bg"} on the part, ${seen.heroMean} as the mean of ${seen.heroStops} stops in ${JSON.stringify(seen.heroImage.slice(0, 60))}; lightness ${heroLight.toFixed(2)}` : "no second part");
check("the first screen's painted link reads as its button, so the part carries the real label", !!heroPart && /\nbutton: Get started$/.test(heroPart.content), heroPart ? JSON.stringify(heroPart.content.split("\n").slice(-1)[0]) : "");
/* Each card's own sentence, as "title: sentence", so the part draws the
   page's words under the title and not its filler. */
const cardLines = cardsPart ? cardsPart.content.split("\n") : [];
check("each card carries its own sentence under its title, in the page's words", cardLines.length === 3 && cardLines.every((l, i) => l.startsWith(`${seen.cardTitles[i]}: `) && l.length > seen.cardTitles[i].length + 20), cardLines.map((l) => l.slice(0, 50)).join(" | "));
const cardsDrawn = cardsPart ? await all.locator(`[data-node-id="${cardsPart.id}"] [data-part]`).innerText().catch(() => "") : "";
check("and the part draws that sentence, not a filler", /Full-featured test runner/.test(cardsDrawn.replace(/\s+/g, " ")), JSON.stringify(cardsDrawn.replace(/\s+/g, " ").slice(0, 90)));
check("and its headline is one line, commas and all", !!heroPart && heroPart.content.split("\n")[0] === headlineOnIt, heroPart ? JSON.stringify(heroPart.content.split("\n")[0]) : "");
/* The ground as drawn, not as carried: the node held the page's colours
   on the first night and the part drew the site's own, because the
   colour parser knew hex and oklch and not the browser's rgb(). */
const heroDrawnPaint = heroPart ? await drawnPart(all, heroPart.id) : null;
const heroDrawnLight = lightOf(heroDrawnPaint?.bg);
check("and the part draws that dark ground, so the words really land on it", !!heroDrawnPaint && heroDrawnLight < 0.35, heroDrawnPaint ? `visible ground ${heroDrawnPaint.bg}, lightness ${heroDrawnLight.toFixed(2)}` : "no hero on the board");
const heroDrawn = heroPart ? await all.locator(`[data-node-id="${heroPart.id}"]`).innerText().catch(() => "") : "";
check("and the part draws it whole on the board", heroDrawn.replace(/\s+/g, " ").includes(headlineOnIt), JSON.stringify(heroDrawn.replace(/\s+/g, " ").slice(0, 100)));
/* The first screen's words at the size the part draws them, against the
   box the page's proportion gave it: the page's 60px headline in a 600px
   band, scaled by half to the surface, or 60px in a 300px band. */
/* Measured as where the words actually are: the node clips its part, so
   its scroll height equals its client height whatever is cut off, and a
   check on those two passed while the screenshot showed the headline
   cut at the top. The topmost and bottommost edge of anything drawn
   inside, against the node's own edges. */
const heroFit = heroPart ? await all.evaluate((id) => {
  const node = document.querySelector(`[data-node-id="${id}"]`);
  const el = node?.querySelector("[data-part]");
  if (!node || !el) return null;
  const box = node.getBoundingClientRect();
  const h1 = el.querySelector("h1");
  const inner = Array.from(el.querySelectorAll("h1, p, button, a")).map((e) => e.getBoundingClientRect()).filter((r) => r.height > 0);
  const top = Math.min(...inner.map((r) => r.top)), bottom = Math.max(...inner.map((r) => r.bottom));
  return { px: h1 ? parseFloat(getComputedStyle(h1).fontSize) : 0, over: Math.max(0, box.top - top) + Math.max(0, bottom - box.bottom), boxH: box.height, contentH: bottom - top };
}, heroPart.id) : null;
check("the first screen's words are drawn at the page's size scaled as its box was, so they fit the box", !!heroFit && heroFit.over < 1, heroFit ? `headline drawn at ${heroFit.px}px; ${heroFit.contentH.toFixed(0)}px of words and buttons in a box ${heroFit.boxH.toFixed(0)}px tall, ${heroFit.over.toFixed(0)}px cut off; the page's headline was 60px in ${landmarks[1]?.h}px, and the surface is ${(bw / WIDTH).toFixed(3)} of the page` : "no hero on the board");
/* Naming icon links must not turn a band of company marks into a footer:
   the only footer on the board is the last block, the page's own. */
const footers = byTop.map((n, i) => (n.featureId === "footer" ? i : -1)).filter((i) => i >= 0);
check("the only footer is the foot of the page; a band of company marks is not one", footers.length === 1 && footers[0] === byTop.length - 1, `footer at ${footers.map((i) => i + 1).join(", ")} of ${byTop.length}`);
const topBar = parts.find((n) => n.label === `Top bar from ${HOST}`);
check("the top bar is at the top of the surface, the full width, as it was on the page", !!topBar && topBar.y - by < 6 && Math.abs(topBar.w - bw) < 6, topBar ? `at ${Math.round(topBar.y - by)} down, ${topBar.w} of ${Math.round(bw)} wide: ${JSON.stringify(topBar.content.split("\n").join(" · ").slice(0, 80))}` : "no top bar");
const topBarDrawn = topBar ? await drawnPart(all, topBar.id) : null;
note(`the top bar on the whole page's surface: ${JSON.stringify(topBarDrawn?.parts)} with ${JSON.stringify(topBarDrawn?.words)}; its colour ${JSON.stringify(topBar?.colour)}, its font ${JSON.stringify(topBar?.font)}`);
check("laid at the page's proportion, the top bar draws white with its links written on it", !!topBarDrawn && isWhite(topBarDrawn.bg) && /Docs/.test(topBarDrawn.words), topBarDrawn ? `drawn ${topBarDrawn.bg}, ${topBarDrawn.links} links or buttons, ${topBar.w}px wide` : "no top bar");
await shot(all, "landed");
await all.close();

await browser.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed} of ${results.length} hold${failed ? `, ${failed} FAILED` : ""}`);
process.exit(failed ? 1 : 0);
