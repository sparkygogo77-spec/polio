#!/usr/bin/env node
/**
 * AN EMBED ON A PART GETS A BOX FOR ITS LINK.
 *
 * J (2026-10-10): "are there limitations to what can be considered an
 * embed? a default one would be a dexscreener chart but can i embed
 * anything and when i drop an embed on a part and click on a part a box
 * with a link for the embed should pop up as well as when i pick the part
 * to put an embed in". On the saved PST board:
 *
 *   1. the link reader: a link, an <iframe> snippet, YouTube/DexScreener page
 *      links turned into their embed links, X and pump.fun known to refuse,
 *      a page's own headers read, PST's rule (DexScreener only) said;
 *   2. Publish asks the code for the embed with its address (codeAsks);
 *   3. Embed put on a part opens the box beside it, on the DexScreener chart;
 *   4. a YouTube link pasted is set as its player link, and PST's rule is said;
 *   5. an X link says it will stay blank;
 *   6. closed, then the part pressed again: the box is back;
 *   7. Preview shows the frame at the link.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/embed-box.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/embedLink.ts, src/features/studio/EmbedBox.tsx, src/features/studio/codeAsks.ts, src/app/api/studio/embed-check/route.ts
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
import { chromium } from "playwright-core";
import { openBoard } from "./lib/board.mjs";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const E = await jiti.import(join(here, "..", "src", "features", "studio", "embedLink.ts"));
const A = await jiti.import(join(here, "..", "src", "features", "studio", "codeAsks.ts"));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

/* 1. */
const yt = E.readEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3");
check("1. a YouTube page link becomes its player link", yt.ok && yt.src === "https://www.youtube.com/embed/dQw4w9WgXcQ" && !!yt.note, JSON.stringify(yt));
const snip = E.readEmbed('<iframe width="560" src="https://player.vimeo.com/video/76979871?h=1&amp;x=2" frameborder="0"></iframe>');
check("…an <iframe> snippet gives its src", snip.ok && snip.src === "https://player.vimeo.com/video/76979871?h=1&x=2", JSON.stringify(snip));
const dex = E.readEmbed("dexscreener.com/solana/abc");
check("…a DexScreener page gets embed=1", dex.ok && /embed=1/.test(dex.src) && dex.host === "dexscreener.com", JSON.stringify(dex));
check("…an http page or nonsense is refused in words", !E.readEmbed("http://example.com").ok && !E.readEmbed("not a link").ok && !E.readEmbed("").ok);
check("…X and pump.fun are known to refuse; a DexScreener chart and Maps embed are not",
  !!E.knownRefusal("https://x.com/someone") && !!E.knownRefusal("https://pump.fun/board") && !E.knownRefusal(E.DEFAULT_EMBED) && !E.knownRefusal("https://www.google.com/maps/embed?pb=1"));
check("…a page's own headers: DENY, SAMEORIGIN and frame-ancestors 'self' refuse; none or * do not",
  E.frameRefusal({ xfo: "DENY" }) && E.frameRefusal({ xfo: "SAMEORIGIN" }) && E.frameRefusal({ csp: "default-src *; frame-ancestors 'self'" }) && !E.frameRefusal({}) && !E.frameRefusal({ csp: "frame-ancestors *" }));
const pstRules = [{ name: "DexScreener chart", hosts: ["dexscreener.com"], hooks: ["reference-frame"] }];
check("…PST's rules: DexScreener allowed, YouTube said not to be published", !E.siteRefusal(E.DEFAULT_EMBED, pstRules, "PonsStars") && /only DexScreener chart/.test(E.siteRefusal(yt.src, pstRules, "PonsStars") ?? "") && !E.siteRefusal(yt.src, null));

/* 2. */
const base = { nodes: [], pages: [{ id: "p", name: "Play" }], format: {}, switches: [], coded: new Set(["p"]), effect: (id) => (id === "embed" ? { name: "Embed" } : null) };
const brought = A.codeAsks({ ...base, nodes: [{ id: "a", pageId: "p", source: { hook: { value: "reference-frame" } }, work: { id: "embed", inputs: { url: E.DEFAULT_EMBED } } }] });
check("2. Publish: Embed on a part from the code asks for it with its address", brought.length === 1 && brought[0].says.includes(E.DEFAULT_EMBED) && brought[0].hook === "reference-frame", brought[0]?.says);
const made = A.codeAsks({ ...base, fresh: { b: "play-box" }, nodes: [{ id: "b", pageId: "p", featureId: "box", w: 300, h: 200, work: { id: "embed", inputs: { url: "https://www.youtube.com/embed/x" } } }] });
check("…a part made in the Builder carries its embed address too", made.length === 1 && made[0].says.includes("Embed (url https://www.youtube.com/embed/x)"), made[0]?.says);
const moved = A.codeAsks({ ...base, nodes: [{ id: "c", pageId: "p", source: { hook: { value: "frame" } }, embed: { src: "https://dexscreener.com/b?embed=1", was: "https://dexscreener.com/a?embed=1" } }] });
check("…a captured frame pointed elsewhere asks for the new address", moved.length === 1 && /from https:\/\/dexscreener.com\/a\?embed=1 to https:\/\/dexscreener.com\/b\?embed=1/.test(moved[0].says), moved[0]?.says);

/* The board, in a browser. Other sites are not opened: the frames are stopped, and the page check answers from here. */
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const ui = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
ui.on("pageerror", (e) => errors.push(e.message));
await ui.route("https://api.github.com/**", (r) => r.abort());
await ui.route(/^https:\/\/([a-z.]+\.)?(dexscreener\.com|youtube\.com|x\.com)\//, (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<p>elsewhere</p>" }));
let asked = 0;
await ui.route("**/api/studio/embed-check**", (r) => { asked++; return r.fulfill({ json: { refuses: /x\.com/.test(decodeURIComponent(r.request().url())) } }); });
await openBoard(ui, URL_BASE, "pst");
const id = await ui.evaluate(() => window.__studioNodes().find((n) => n.pageId === "page_home" && n.hooks?.["data-hook"] === "chart-tv-screen")?.id);
const work = () => ui.evaluate((id) => window.__studioNodes().find((n) => n.id === id).work, id);
const boxSays = () => ui.evaluate(() => { const b = document.querySelector("[data-embed-box]"); return b ? { for: b.getAttribute("data-embed-box"), notes: [...b.querySelectorAll("[data-embed-note]")].map((p) => p.getAttribute("data-embed-note")), frame: b.querySelector("[data-embed-frame]")?.getAttribute("src") ?? null, input: b.querySelector("[data-embed-input]").value } : null; });

/* 3. */
await ui.evaluate((id) => window.__studioGiveWork(id, "embed"), id);
await ui.waitForTimeout(600);
const b3 = await boxSays();
const w3 = await work();
check("3. Embed put on the chart screen opens the box beside it", b3?.for === id, JSON.stringify(b3));
check("…on the DexScreener chart, set on the part, with no note (PST allows it)", w3?.inputs?.url === E.DEFAULT_EMBED && b3?.frame === E.DEFAULT_EMBED && b3.notes.length === 0, JSON.stringify({ w3, b3 }));
const near = await ui.evaluate((id) => { const p = document.querySelector(`[data-node-id="${id}"]`).getBoundingClientRect(); const b = document.querySelector("[data-embed-box]").getBoundingClientRect(); return { gap: Math.min(Math.abs(b.top - p.bottom), Math.abs(p.top - b.bottom)), room: p.bottom + b.height + 18 < innerHeight || p.top - b.height - 18 > 0, across: b.left < p.right && b.right > p.left, onScreen: b.top >= 0 && b.bottom <= innerHeight }; }, id);
check("…beside the part (just under or over it when there is room), on screen", near.onScreen && near.across && (!near.room || near.gap <= 14), JSON.stringify(near));

/* 4. */
await ui.fill("[data-embed-input]", "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
await ui.waitForTimeout(100);
const b4a = await boxSays();
await ui.click("[data-embed-apply]");
await ui.waitForTimeout(300);
const b4 = await boxSays();
check("4. a YouTube link is said to become its player link, and set so", b4a.notes.includes("player") && (await work()).inputs.url === "https://www.youtube.com/embed/dQw4w9WgXcQ" && b4.frame === "https://www.youtube.com/embed/dQw4w9WgXcQ", JSON.stringify({ b4a, b4 }));
check("…and PST's rule is said: only DexScreener goes on its published page", b4.notes.includes("site-rule"), JSON.stringify(b4.notes));

/* 5. */
await ui.fill("[data-embed-input]", "https://x.com/someone");
await ui.click("[data-embed-apply]");
await ui.waitForTimeout(400);
const b5 = await boxSays();
check("5. an X link says it will stay blank", b5.notes.includes("refuses"), JSON.stringify(b5.notes));
await ui.click("[data-embed-default]");
await ui.waitForTimeout(400);
check("…and the DexScreener button puts the chart back", (await work()).inputs.url === E.DEFAULT_EMBED && (await boxSays()).notes.length === 0 && asked >= 1, `${asked} page checks`);

/* 6. */
await ui.click("[data-embed-close]");
await ui.waitForTimeout(200);
const closed = await boxSays();
await ui.evaluate(() => { const s = window.__studioNodes().find((n) => n.pageId === "page_home" && n.hooks?.["data-hook"] === "page-title-icon"); document.querySelector(`[data-node-id="${s.id}"]`).scrollIntoView({ block: "center" }); });
const other = await ui.evaluate(() => { const s = window.__studioNodes().find((n) => n.pageId === "page_home" && n.hooks?.["data-hook"] === "page-title-icon"); const r = document.querySelector(`[data-node-id="${s.id}"]`).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
await ui.mouse.click(other.x, other.y);
await ui.waitForTimeout(200);
const elsewhere = await boxSays();
await ui.evaluate((id) => document.querySelector(`[data-node-id="${id}"]`).scrollIntoView({ block: "center" }), id);
await ui.waitForTimeout(300);
const at = await ui.evaluate((id) => { const r = document.querySelector(`[data-node-id="${id}"]`).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, id);
/* A press picks the outer part first and the next one goes in, as on any part. */
for (let i = 0; i < 3 && !(await ui.evaluate((id) => window.__studioSelection()[0] === id, id)); i++) { await ui.mouse.click(at.x, at.y); await ui.waitForTimeout(400); }
const again = await boxSays();
const sel = await ui.evaluate(() => window.__studioSelection());
check("6. closed, it goes; another part pressed, none shows; the chart pressed again, it is back", closed === null && elsewhere === null && again?.for === id, JSON.stringify({ closed, elsewhere, again, sel }));

/* 7. */
await ui.keyboard.press("Escape");
await ui.locator('[aria-label="Preview"]').first().click();
await ui.waitForTimeout(2500);
const live = await ui.evaluate((src) => [...document.querySelectorAll("[data-live-shell] iframe")].some((f) => f.src === src), E.DEFAULT_EMBED);
check("7. Preview shows the frame at the link", live && !(await boxSays()));
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
