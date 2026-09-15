/**
 * A part with a written body survives everything that happens to a site.
 *
 * The body is code, and code that only exists in one browser tab is a demo.
 * It lives on the node, so it goes into `site/document.json` with the rest
 * of the document; the live page renders it exactly as the board does; and
 * the blueprint says it is there, where it is, and what to do with it — so
 * Build carries it through instead of inventing a replacement.
 *
 *   node tests/body-publish.mjs [url]      # default http://localhost:3000
 */
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const MARK = "helix-of-sentences";
const star = "M 0.5 0 C 0.57 0.31, 0.62 0.35, 0.98 0.35 C 0.68 0.55, 0.66 0.62, 0.79 1 C 0.5 0.77, 0.44 0.77, 0.21 1 C 0.34 0.62, 0.32 0.55, 0.02 0.35 C 0.38 0.35, 0.43 0.31, 0.5 0 Z";
const body = `<svg viewBox="0 0 100 100" preserveAspectRatio="none"><g id="${MARK}"><path d="M10 10 Q 50 30 90 10 T 90 90" stroke="currentColor" stroke-width="4" fill="none"/><text x="12" y="60" font-size="9">a helix of sentences</text></g></svg>`;

const node = {
  id: "n_body", pageId: "page_home", featureId: "custom-idea", label: "The helix", prompt: "a helix of sentences",
  content: "", data: "", x: 80, y: 60, w: 360, h: 360, groupId: null, options: {}, priority: "must", custom: true,
  colour: null, font: null, anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth",
  shape: null, outline: { d: star, cut: star, closed: true, width: 0.16, points: 10 },
  code: { html: body, overlap: 0.91, attempts: 2, scores: [0.34, 0.91], at: Date.now(), note: "a helix of sentences" },
  aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null, link: null,
};
const doc = { state: {
  pages: [{ id: "page_home", name: "Home", path: "/", prompt: "", scroll: "" }], nodes: [node], groups: [], shapes: [], format: {},
  brief: { name: "Helix", gimmick: "", master: "A page about one drawn thing." }, look: {}, motion: [],
  activePageId: "page_home", hiddenFeatures: [], frameWidth: 1440, companion: null,
  trail: [], threads: [], liveThreadId: null, pinnedThreads: [], bookPinned: false, threadSpots: {}, draftPieces: [], sentPieces: {},
}, version: 0 };

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
// Init scripts run in every frame, the sandboxed body frame included, where
// `localStorage` throws: the try keeps the suite's own seed out of the page errors.
await context.addInitScript((d) => { try { localStorage.setItem("builder.studio", d); } catch { /* a sandboxed frame */ } }, JSON.stringify(doc));
const page = await context.newPage();
page.on("pageerror", (e) => console.log("     page error:", String(e).slice(0, 160)));

/* 1. The live page: the body renders, sandboxed, and is cut to the outline. */
await page.goto(`${URL_BASE}/builder/preview`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
const frame = page.locator("[data-coded-body]");
check("the body renders on the live page", (await frame.count()) === 1);
check("in a frame with no permissions at all", (await frame.getAttribute("sandbox")) === "");
// The frame is cross-origin by design — `sandbox=""` withholds
// same-origin — so what it holds is read from the document it was given,
// not through it. That it cannot be reached into is the point.
const srcdoc = (await frame.getAttribute("srcdoc")) ?? "";
check("the code Claude wrote is what is in the frame", srcdoc.includes(MARK));
check("and the frame carries the content policy too", /content-security-policy/.test(srcdoc) && /default-src 'none'/.test(srcdoc));
check("nothing in the frame can be reached into from the page", await page.evaluate(() => {
  // No frame at all used to throw here and count as unreachable; a frame must be there and sealed.
  const f = document.querySelector("iframe[data-coded-body]");
  try { return !!f && f.contentDocument === null; } catch { return !!f; }
}));
const cut = await page.evaluate(() => {
  const el = document.querySelector('[data-shape="outline"]');
  return el ? { clip: getComputedStyle(el).clipPath, path: el.querySelector("clipPath path")?.getAttribute("d")?.slice(0, 12) } : null;
});
check("the part is cut to the drawn line", !!cut && cut.clip.startsWith("url("), cut?.clip);
check("with the line itself in the document", cut?.path === "M 0.5 0 C 0.", cut?.path);

/* 2. The blueprint: Build is told the body exists and what to do with it. */
await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(900);
await page.evaluate(() => window.__studioOpenBrief?.());
await page.waitForTimeout(900);
const brief = await page.locator("pre").first().innerText();
check("the brief says the part has a body", /- body: a body written for it/.test(brief), brief.match(/- body:.{0,80}/)?.[0]);
check("and where it is, so it is not re-invented", /code\.html/.test(brief) && /do not re-invent it/.test(brief));
check("and how it matched the drawing", /matched 91% of the drawing over 2 attempts/.test(brief));
check("the brief says the part is cut to a line", /- outline: cut to the line drawn round it, 10 points/.test(brief), brief.match(/- outline:.{0,60}/)?.[0]);
check("and where that line is", /outline\.cut/.test(brief) && /objectBoundingBox/.test(brief));

/* 3. What publish would push: the document, with the code in it. */
// The document as Publish sends it, through the page's own seam: reading
// storage instead measured what hydration keeps, not what publish writes.
const files = await page.evaluate(() => (window.__studioPublishDoc ? JSON.stringify(window.__studioPublishDoc()) : ""));
check("the page can say what publish sends", files.length > 0, files.length ? `${files.length} bytes` : "no __studioPublishDoc seam");
check("the code goes into the document that is published", files.includes(MARK), `${files.length} bytes`);
check("and so does the line it is cut to", files.includes('"cut"'));

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
