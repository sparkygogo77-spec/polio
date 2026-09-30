#!/usr/bin/env node
/**
 * A SITE BROUGHT IN KEEPS ALL ITS PICTURES AT ONCE, BEFORE A RELOAD CAN TAKE THEM.
 *
 * Found getting share.xyz ready for its first Go live (sink's
 * sites/share-xyz: about 4,000 parts once swept, 128 pictures): the board
 * landed, and its pictures went into this browser's storage one at a time
 * behind it, 13 in the first minute and all 128 only two minutes later,
 * with nothing on screen saying so. A reload, a closed tab or a Go live in
 * that time published the site without the rest ("no longer in this
 * browser"), and they never came back.
 *
 * Held here: a document made here with 4,000 parts and 128 pictures,
 * brought in through the repo menu from a stand-in GitHub, has every
 * picture kept within a few seconds of its parts landing, and they are
 * all still there after a reload.
 *
 *   npm run build && GITHUB_API=http://127.0.0.1:4333 npx next start -p 3013
 *   node tests/bring-pictures-kept.mjs http://127.0.0.1:3013
 */
import http from "node:http";
import zlib from "node:zlib";
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const PORT = Number(process.env.STUB_PORT ?? 4333);
const PICTURES = 128;
const PARTS = 4000;
/** A GENEROUS BAR, not a measured one: in one transaction all 128 were in by 9s here, the board busy drawing its parts; one at a time, 3 were. */
const WITHIN_MS = 20000;
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

/* A small PNG, a different colour per picture, so no two are the same bytes. */
const crc = (buf) => { let c = ~0; for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
const chunk = (type, data) => { const t = Buffer.from(type); const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, sum]); };
const png = (i) => {
  const w = 16, h = 16, row = Buffer.alloc(1 + w * 3);
  for (let x = 0; x < w; x++) { row[1 + x * 3] = i & 255; row[2 + x * 3] = (i * 7) & 255; row[3 + x * 3] = (i * 13) & 255; }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(Buffer.concat(Array(h).fill(row)))), chunk("IEND", Buffer.alloc(0))]);
};
const pics = Array.from({ length: PICTURES }, (_, i) => ({ id: `pic_t${String(i).padStart(4, "0")}`, bytes: png(i) }));
const doc = {
  brief: { name: "Many Pictures", gimmick: "", master: "" },
  pages: [{ id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  activePageId: "page_home", groups: [], shapes: [], frameWidth: 1440,
  nodes: [
    ...pics.map((p, i) => ({ id: `n_pic_${i}`, pageId: "page_home", featureId: "picture", label: "picture", prompt: "", content: "", data: "", x: 20 + (i % 16) * 80, y: 20 + Math.floor(i / 16) * 80, w: 64, h: 64, groupId: null, options: {}, priority: "must", custom: false, picture: { id: p.id, path: `assets/pictures/${p.id}.png`, type: "image/png", w: 16, h: 16, bytes: p.bytes.length, alt: "", from: "upload" } })),
    ...Array.from({ length: PARTS - PICTURES }, (_, i) => ({ id: `n_words_${i}`, pageId: "page_home", featureId: "prose", label: "words", prompt: "", content: `words ${i}`, data: "", x: 20 + (i % 20) * 70, y: 800 + Math.floor(i / 20) * 30, w: 60, h: 24, groupId: null, options: {}, priority: "must", custom: false })),
  ],
};
const DOC = Buffer.from(JSON.stringify(doc));
const tree = [{ path: "site/document.json", type: "blob", sha: "doc", size: DOC.length }, ...pics.map((p) => ({ path: `assets/pictures/${p.id}.png`, type: "blob", sha: `pic-${p.id}`, size: p.bytes.length }))];

/* ------------------------------------------------ a stand-in GitHub, for the server and the browser alike */
const answer = (method, url) => {
  const u = new URL(url, "http://x");
  if (u.pathname === "/user") return [200, { login: "him" }];
  if (u.pathname === "/user/repos") return [200, [{ full_name: "him/pictures", private: true, default_branch: "main", pushed_at: "2026-09-27T00:00:00Z" }]];
  const m = /^\/repos\/him\/pictures(\/.*)?$/.exec(u.pathname);
  if (!m) return [404, { message: "Not Found" }];
  const rest = m[1] ?? "";
  if (!rest) return [200, { default_branch: "main", full_name: "him/pictures", homepage: "" }];
  if (rest === "/branches") return [200, [{ name: "main" }]];
  if (rest === "/contents/sites") return [404, { message: "Not Found" }];
  if (rest.startsWith("/git/trees/")) return [200, { tree }];
  if (rest === "/git/blobs/doc") return [200, { encoding: "base64", content: DOC.toString("base64") }];
  const p = pics.find((x) => rest === `/git/blobs/pic-${x.id}`);
  if (p) return [200, { encoding: "base64", content: p.bytes.toString("base64") }];
  return [404, { message: "Not Found" }];
};
const stub = http.createServer((req, res) => { const [s, o] = answer(req.method, req.url); res.writeHead(s, { "content-type": "application/json" }); res.end(JSON.stringify(o)); });
await new Promise((r) => stub.listen(PORT, "127.0.0.1", r));

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route("https://api.github.com/**", (r) => { const [s, o] = answer(r.request().method(), r.request().url()); return r.fulfill({ status: s, contentType: "application/json", body: JSON.stringify(o) }); });
const kept = () => page.evaluate(() => new Promise((ok) => { const r = indexedDB.open("builder.pictures"); r.onsuccess = () => { try { const q = r.result.transaction("files", "readonly").objectStore("files").count(); q.onsuccess = () => ok(q.result); q.onerror = () => ok(-1); } catch { ok(0); } }; r.onerror = () => ok(-1); }));
const parts = () => page.evaluate(async () => { const env = JSON.parse(localStorage.getItem("builder.studio") || "{}"); if (env.state) return env.state.nodes?.length ?? 0; return env.idb && window.__studioPublishDoc ? ((await window.__studioPublishDoc()).nodes?.length ?? 0) : 0; });

await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => {
  const env = (s) => JSON.stringify({ state: s, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "s1", name: "Site 1", updatedAt: Date.now() }], activeId: "s1" }));
  localStorage.setItem("builder.studio", env({ pages: [{ id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }], activePageId: "page_home", groups: [], selection: [], threads: [], spaces: [], shapes: [], nodes: [] }));
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);
{
  const keys = page.locator("[data-keys-panel]");
  await page.getByRole("button", { name: "Keys", exact: true }).click();
  await page.waitForTimeout(500);
  const skip = keys.getByRole("button", { name: /Skip the PIN|Hold the key for this tab/ });
  if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(300); }
  await keys.locator('[data-service="github"] input[type="password"]').first().fill("STANDIN_github_token_xxxx");
  await keys.getByRole("button", { name: /Save to this browser|Hold in this tab/ }).first().click();
  await page.waitForTimeout(400);
  await keys.getByRole("button", { name: "Close keys" }).click();
  await page.waitForTimeout(400);
}
await page.locator("[data-bring-repo]").first().click();
await page.waitForTimeout(900);
await page.locator('[data-repo-pick="him/pictures"]').click();
await page.waitForTimeout(900);
await page.locator('[data-repo-choices="him/pictures"] [data-repo-bring-chosen]').click();
let landedAt = 0;
for (let i = 0; i < 1200; i++) { if ((await parts()) >= PARTS * 0.5) { landedAt = Date.now(); break; } await page.waitForTimeout(100); }
check("the parts landed", landedAt > 0, `${await parts()} parts`);
let n = 0;
while (Date.now() - landedAt < WITHIN_MS) { n = await kept(); if (n >= PICTURES) break; await page.waitForTimeout(200); }
const took = Date.now() - landedAt;
check(`every picture kept within ${WITHIN_MS / 1000}s of the parts landing`, n === PICTURES, `${n} of ${PICTURES} after ${(took / 1000).toFixed(1)}s`);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(2000);
const after = await kept();
check("…and all still there after a reload", after === PICTURES, `${after} of ${PICTURES}`);
check("no page error on the way", errors.length === 0, errors.slice(0, 3).join(" / "));

await browser.close();
stub.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
