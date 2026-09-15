/**
 * Reading a live element, and what it becomes.
 *
 * Three halves, because the thing has three: what may be opened at all,
 * what the browser measures off a real page, and what those measurements
 * turn into on the board.
 *
 * The fixture is served over plain http on this machine, and the bounds
 * rightly refuse to open it — https only, no private addresses. That is
 * not worked around: the measuring functions live in `siteRead.ts` rather
 * than inside the route precisely so they can be run against any page by
 * anything holding a browser, and the route's own path is exercised
 * separately against a real public page.
 *
 *   node tests/site-read.mjs [builder url] [fixture url]
 */
import { createRequire } from "node:module";
import { allowed, REFUSAL_SAYS } from "../src/features/studio/siteFetch.ts";
import { CANDIDATES, MEASURE } from "../src/features/studio/siteRead.ts";
import { recreateFrom } from "../src/features/studio/recreate.ts";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const BUILDER = process.argv[2] ?? "http://localhost:3000";

/*
 * The page this reads is served from here.
 *
 * It used to default to http://localhost:8899/ and expect somebody to have
 * put a server there, so in a sweep it died on ERR_CONNECTION_REFUSED
 * before measuring anything — a suite that could only pass on the machine
 * it was written on. The page is not invented: every number below says what
 * it must contain, so it is written to those numbers and served next to
 * them. Plain http on this machine on purpose, because one of the checks
 * above is that the bounds refuse exactly this kind of address.
 *
 * Pass a URL as the third argument to read something else instead.
 */
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>Harbour</title><style>
  *{box-sizing:border-box} body{margin:0;font-family:Inter,system-ui,sans-serif;background:#fff;color:#111}
  header{display:flex;align-items:center;gap:24px;height:72px;padding:0 32px;background:rgb(17,19,31);color:#fff}
  .name{font-size:22px;font-weight:600;letter-spacing:-0.01em}
  header nav{display:flex;gap:20px;margin-left:auto}
  header nav a{color:#fff;text-decoration:none;font-size:14px}
  header button{font-size:14px;padding:8px 14px;border:0;border-radius:4px;background:#fff;color:#111}
  @font-face{font-family:"Harbour Serif";src:url(fonts/harbour-serif.woff2) format("woff2")}
  .hero{font-family:"Harbour Serif",Georgia,serif;display:flex;align-items:center;gap:40px;padding:64px 32px}
  .hero h1{font-size:48px;line-height:1.1;margin:0 0 16px}
  .hero p{font-size:18px;margin:0;color:#444}
  .hero img{width:640px;height:360px;display:block}
  .cards{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;padding:0 32px 64px}
  .cards article{padding:24px;border:1px solid #e3e3e6;border-radius:8px}
  .cards h2{font-size:20px;margin:0 0 8px}
  footer{padding:32px;background:#f4f4f6;font-size:13px;color:#555}
</style></head><body>
  <header><span class="name">Harbour</span><nav><a href="/product">Product</a><a href="/pricing">Pricing</a><a href="/docs">Docs</a></nav><button>Start free</button></header>
  <section class="hero">
    <div><h1>Everything arrives somewhere</h1><p>Freight, tracked from the quay to the door, in one place.</p></div>
    <img width="640" height="360" alt="A harbour at first light" src="data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#9fb6c8"/><rect y="240" width="640" height="120" fill="#31506b"/><circle cx="520" cy="90" r="44" fill="#f3e2c0"/></svg>')}">
  </section>
  <section class="cards">
    <article><h2>Quiet</h2><p>Nothing moves without a reason.</p></article>
    <article><h2>Fast</h2><p>Every hop measured, nothing guessed.</p></article>
    <article><h2>Yours</h2><p>Your keys, your data, your account.</p></article>
  </section>
  <footer>Harbour Freight Ltd. Built on the quay.</footer>
</body></html>`;

const http = req("node:http");
let served = null;
const FIXTURE = process.argv[3] ?? await new Promise((go) => {
  served = http.createServer((_, res) => { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(PAGE); });
  served.listen(0, "127.0.0.1", () => go(`http://localhost:${served.address().port}/`));
});
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const note = (l) => console.log(`  note  ${l}`);

/* ------------------------------------------------------------------ */
/* 1. What may be opened                                               */
/* ------------------------------------------------------------------ */

check("a plain https address is allowed", allowed("https://example.com/a").ok);
check("a bare host is completed rather than refused", (() => {
  const a = allowed("example.com");
  return a.ok && a.url.startsWith("https://") && a.host === "example.com";
})(), allowed("example.com").ok ? allowed("example.com").url : "refused");
for (const [what, address] of [
  ["plain http", "http://example.com"],
  ["a file on the server", "file:///etc/passwd"],
  ["a data url", "data:text/html,<b>hi"],
]) check(`${what} is refused`, !allowed(address).ok, allowed(address).ok ? "allowed" : allowed(address).says);
for (const [what, address] of [
  ["localhost", "https://localhost:3000/"],
  ["a loopback address", "https://127.0.0.1/"],
  ["a private range", "https://192.168.1.10/"],
  ["another private range", "https://10.0.0.5/"],
  ["the cloud metadata address", "https://169.254.169.254/latest/meta-data/"],
  ["a machine on this network", "https://intranet/"],
  ["a .local name", "https://printer.local/"],
]) check(`${what} is refused as private`, allowed(address).ok === false && allowed(address).why === "private", allowed(address).ok ? "ALLOWED" : "");
check("every refusal has words a person can act on", Object.values(REFUSAL_SAYS).every((s) => s.length > 20 && /[a-z]/.test(s)));
check("the fixture this test serves is itself refused, and is read another way", !allowed(FIXTURE).ok, allowed(FIXTURE).says ?? "");

/* ------------------------------------------------------------------ */
/* 2. What the browser measures off a real page                        */
/* ------------------------------------------------------------------ */

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(FIXTURE, { waitUntil: "networkidle" });
await page.waitForTimeout(300);

const candidates = await page.evaluate(CANDIDATES, 400);
check("the page offers things to point at", candidates.length >= 4, `${candidates.length} candidates`);
check("and it names the bar across the top in words a person would use",
  candidates.some((c) => /bar across the top/.test(c.what)), candidates.slice(0, 3).map((c) => c.what).join(" · "));
check("the biggest thing comes first, because that is what a person sees",
  candidates[0].box.w * candidates[0].box.h >= candidates[candidates.length - 1].box.w * candidates[candidates.length - 1].box.h);
check("every candidate can be found again by the selector it gave",
  (await page.evaluate((sels) => sels.every((s) => !!document.querySelector(s)), candidates.slice(0, 12).map((c) => c.selector))));

const read = async (sel) => page.evaluate(MEASURE, sel);

const bar = await read("header");
check("the bar is measured at the size it really is", bar.box.h === 72 && bar.box.w === 1280, `${bar.box.w}×${bar.box.h}`);
check("its background is the colour the page painted, not a guess", bar.paint.bg === "rgb(17, 19, 31)", bar.paint.bg);
check("its links are the real ones, with where they really go",
  bar.links.map((l) => l.words).join(",") === "Product,Pricing,Docs", bar.links.map((l) => l.words).join(","));
check("its button says what it really says", bar.buttons[0] === "Start free", JSON.stringify(bar.buttons));
check("it is at the top of the page, by measurement", bar.down === 0, String(bar.down));

const hero = await read(".hero");
check("the headline is found by its size, not by its tag",
  hero.text.find((t) => t.px === Math.max(...hero.text.map((x) => x.px))).words === "Everything arrives somewhere");
check("the type is the family the page was really set in", /georgia/i.test(hero.type.family), hero.type.family);
/* A web font whose file the page cannot fetch: the name is read, and that
   it did not draw is measured, not assumed. */
check("the face the page named is read by name, though its file never came", hero.type.face === "Harbour Serif", JSON.stringify(hero.type.face));
check("and it is known to have not drawn, measured on the page itself", hero.type.drew === false, String(hero.type.drew));
check("a face is read for every block, and whether it drew is always answered", typeof bar.type.face === "string" && typeof bar.type.drew === "boolean", JSON.stringify([bar.type.face, bar.type.drew]));
check("the picture inside it is seen", hero.images.length >= 1 && hero.images[0].w === 640, JSON.stringify(hero.images.map((i) => [i.w, i.h])));

const cards = await read(".cards");
check("a grid of three is measured as three children", cards.children.length === 3, `${cards.children.length}`);
check("and as a grid rather than a row", cards.layout.flow === "grid" || cards.layout.columns === 3, `${cards.layout.flow}, ${cards.layout.columns} columns`);

/* ------------------------------------------------------------------ */
/* 3. What those measurements become                                   */
/* ------------------------------------------------------------------ */

const from = { url: FIXTURE, host: "harbour.example", selector: "header", at: Date.now() };
const madeBar = recreateFrom({ ...bar, from });
check("the real bar becomes the library's top bar", madeBar.patch.featureId === "sticky-header", madeBar.id);
check("carrying the site's own name, read off the page", madeBar.patch.content.split("\n")[0] === "logo: Harbour", madeBar.patch.content.split("\n")[0]);
check("its real links, in the order they were in", madeBar.patch.content.includes("Product\nPricing\nDocs"));
check("its real button", madeBar.patch.content.includes("button: Start free"));
check("painted the colour that was measured", madeBar.patch.colour?.bg === "rgb(17, 19, 31)", JSON.stringify(madeBar.patch.colour));

const madeHero = recreateFrom({ ...hero, from: { ...from, selector: ".hero" } });
check("the first screen becomes the first screen", madeHero.patch.featureId === "hero-split", madeHero.id);
check("with the real headline in it", madeHero.patch.content.startsWith("Everything arrives somewhere"), madeHero.patch.content.slice(0, 40));
check("set in the face the page used, named as one of this app's own", madeHero.patch.font?.family === "serif", JSON.stringify(madeHero.patch.font));
check("and in the face the page named, carried by name for when it is on the machine", madeHero.patch.font?.face === "Harbour Serif" && madeHero.face?.drew === false, JSON.stringify([madeHero.patch.font?.face, madeHero.face]));
check("and it knows a picture is wanted, which the reading cannot make", madeHero.wantsPicture === true);

const madeCards = recreateFrom({ ...cards, from: { ...from, selector: ".cards" } });
check("three cards become a card grid in three columns",
  madeCards.patch.featureId === "card-grid" && madeCards.patch.options?.columns === "3", `${madeCards.patch.featureId}, ${JSON.stringify(madeCards.patch.options)}`);
check("with the real card titles", madeCards.patch.content.includes("Quiet") && madeCards.patch.content.includes("Yours"), madeCards.patch.content.replace(/\n/g, " · "));

check("nothing recreated is a picture with fields on it",
  [madeBar, madeHero, madeCards].every((m) => !m.patch.code && !m.patch.vector && typeof m.patch.content === "string"));
check("and every one says whose it was", [madeBar, madeHero, madeCards].every((m) => m.patch.from?.host === "harbour.example"));

/* ------------------------------------------------------------------ */
/* 4. The route's own path, against a real public page                 */
/* ------------------------------------------------------------------ */

/* From a page on the Builder's own origin: the fixture is a different
   origin, and a browser will not let it call the Builder's routes. The
   first run of this failed on that and read as the route being broken. */
const own = await browser.newPage();
await own.goto(`${BUILDER}/builder`, { waitUntil: "domcontentloaded" });
const post = async (body) => {
  const res = await own.evaluate(async ([url, b]) => {
    try {
      const r = await fetch(`${url}/api/studio/element`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
      return await r.json();
    } catch (e) { return { ok: false, message: String(e) }; }
  }, [BUILDER, body]);
  return res;
};

const refused = await post({ url: "https://127.0.0.1/" });
check("the route refuses a private address before it opens anything", refused.ok === false && refused.reason === "private", refused.message ?? "");
const badScheme = await post({ url: "http://example.com" });
check("and refuses plain http", badScheme.ok === false && badScheme.reason === "not-https", badScheme.message ?? "");

const live = await post({ url: "https://example.com" });
if (live.ok) {
  check("a real public page opens and offers things to point at", (live.candidates?.length ?? 0) >= 1, `${live.candidates?.length} candidates in ${live.took}s`);
  check("with a picture of it to point at them on", typeof live.page?.shot === "string" && live.page.shot.length > 1000);
  const one = live.candidates[0];
  const got = await post({ url: "https://example.com", selector: one.selector });
  check("and the one that is picked comes back measured", got.ok === true && !!got.reading?.paint?.bg, got.message ?? got.reading?.paint?.bg);
  check("with a picture of the element alone", typeof got.shot === "string" && got.shot.length > 100);
  check("and it says where it came from", got.reading?.from?.host === "example.com", JSON.stringify(got.reading?.from));
} else {
  note(`the live page could not be reached from this container: ${live.reason} — ${live.message}`);
  check("and the route said so rather than hanging", typeof live.message === "string" && live.message.length > 10, live.message);
}

await browser.close();
served?.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed} of ${results.length} hold${failed ? `, ${failed} FAILED` : ""}`);
process.exit(failed ? 1 : 0);
