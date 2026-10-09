/**
 * A "?" SET RIGHT AFTER A NOTE'S LAST WORD FOLLOWS IT.
 *
 * J (2026-10-09), PST's Balance panel in the Preview: the "?" floated above
 * the note instead of sitting inline after "matches." as on the live site.
 * The board places parts where the page measured them, so wherever the
 * note's words end otherwise (another machine's font, a wider panel) the
 * "?" stayed behind. Read as following the note (`siteread/parts.ts`
 * `tieAfter`, landed as `node.follows`), it is placed after the words
 * wherever they end (`live/follow.ts`).
 *
 *   npm run build && npx next start -p 3013
 *   node tests/help-follows-words.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/bring-in/siteread/parts.ts, src/features/studio/bring-in/pageParts.ts, src/features/studio/live/follow.ts, src/features/studio/live/LiveSite.tsx
 */
import { PARTS } from "../src/features/studio/bring-in/siteRead.ts";
import { pagesToDoc } from "../src/features/studio/bring-in/pageParts.ts";
import { launch } from "./fixtures/look-sites.mjs";

const BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const SITE = `<!doctype html><html><head><style>
body { margin: 8px; font: 16px/1.4 system-ui, sans-serif; color: #1a0f0b; background: #fdf3e6; }
section { position: absolute; left: 400px; top: 80px; width: 236px; padding: 16px; border: 3px solid #1a0f0b; border-radius: 16px; background: #fff8ee; }
section p { margin: 0 0 8px; }
[data-hook="balance-note"], [data-hook="balance-note-more"] { display: inline; }
summary { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; margin-left: 4px; list-style: none; border-radius: 50%; background: #f3d440; border: 1px solid #1a0f0b; font-size: 11px; vertical-align: middle; }
</style></head><body>
<section data-hook="balance-panel">
  <p data-hook="balance-note">One escrow balance for all your matches.</p>
  <details data-hook="balance-note-more"><summary data-hook="balance-note-more-toggle">?</summary><p data-hook="balance-note-more-text">Deposit once, play as many matches as it covers.</p></details>
  <p data-hook="balance-wallet-line">In your wallet: - SOL</p>
</section>
</body></html>`;

const browser = await launch();
const site = await browser.newPage({ viewport: { width: 1000, height: 600 } });
await site.setContent(SITE);
const read = await site.evaluate(PARTS, 1500);
const parts = read.parts ?? read;
const noteAt = parts.findIndex((p) => p.words?.startsWith("One escrow"));
const q = parts.find((p) => p.hooks?.["data-hook"] === "balance-note-more-toggle");
check("1. the \"?\" is read as following the note's words", !!q?.after && q.after.part === noteAt && q.after.gap >= 0 && q.after.gap < 12, JSON.stringify(q?.after));
const wallet = parts.find((p) => p.words?.startsWith("In your wallet"));
check("…and nothing else follows a line here", !wallet?.after, JSON.stringify(wallet?.after));
await site.close();

const { doc } = pagesToDoc([{ file: "site/index.html", read }], { at: 1 });
const noteNode = doc.nodes.find((n) => Array.isArray(n.content) && n.content.some((s) => s.text?.startsWith("One escrow")));
const qNode = doc.nodes.find((n) => n.hooks?.["data-hook"] === "balance-note-more-toggle");
check("2. it lands following the note's part", qNode?.follows?.id === noteNode?.id, JSON.stringify(qNode?.follows));

const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route("**/api/studio/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ github: { configured: false, missing: [] }, vercel: { hook: false } }) }));
await page.route(/^https:\/\/(?!fonts\.)/, (r) => r.fulfill({ status: 404, body: "" }));
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => {
  const env = (s) => JSON.stringify({ state: s, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "follows", name: "follows", updatedAt: Date.now() }], activeId: "follows" }));
  localStorage.setItem("builder.studio", env({ nodes: [] }));
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);
const home = doc.pages.find((p) => p.path === "/") ?? doc.pages[0];
await page.evaluate((d) => window.__studioLoadDoc(d), { ...doc, activePageId: home.id });
await page.waitForTimeout(2500);
await page.goto(`${BASE}/builder/preview`, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);

const where = () => page.evaluate(({ noteId, qId }) => {
  const n = document.querySelector(`[data-live-node="${noteId}"]`);
  const walk = document.createTreeWalker(n, NodeFilter.SHOW_TEXT);
  const rects = [];
  for (let t = walk.nextNode(); t; t = walk.nextNode()) { const r = document.createRange(); r.selectNodeContents(t); for (const x of r.getClientRects()) if (x.width) rects.push(x); }
  const last = rects[rects.length - 1];
  const qr = document.querySelector(`[data-live-node="${qId}"]`).getBoundingClientRect();
  const overlaps = rects.some((x) => x.right > qr.left + 1 && x.left < qr.right - 1 && x.bottom > qr.top + 1 && x.top < qr.bottom - 1);
  return { gap: Math.round((qr.left - last.right) * 10) / 10, mid: Math.round(((qr.top + qr.bottom) / 2 - (last.top + last.bottom) / 2) * 10) / 10, rows: new Set(rects.map((x) => Math.round(x.top))).size, overlaps };
}, { noteId: noteNode?.id, qId: qNode?.id });
const want = qNode?.follows ?? { gap: 0, dy: 0 };
const asIs = await where();
check("3. in the Preview the \"?\" sits right after \"matches.\", in its row", Math.abs(asIs.gap - want.gap) <= 1.5 && Math.abs(asIs.mid - want.dy) <= 1.5 && !asIs.overlaps, JSON.stringify({ asIs, want }));
/* Another machine's glyphs, in short: the note's words set wider or narrower from the first draw. */
await page.addInitScript(() => { const put = () => { const s = document.createElement("style"); s.id = "spacing"; s.textContent = localStorage.getItem("test.spacing") ?? ""; document.head.appendChild(s); }; if (document.head) put(); else document.addEventListener("DOMContentLoaded", put); });
for (const spacing of ["0.06em", "-0.04em"]) {
  await page.evaluate((css) => localStorage.setItem("test.spacing", css), `[data-live-node="${noteNode?.id}"] p, [data-live-node="${noteNode?.id}"] span { letter-spacing: ${spacing} !important; }`);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const moved = await where();
  check(`…and still right after them with the words set ${spacing.startsWith("-") ? "narrower" : "wider"}`, Math.abs(moved.gap - want.gap) <= 1.5 && Math.abs(moved.mid - want.dy) <= 1.5 && !moved.overlaps, JSON.stringify(moved));
}
check("with no page error on the way", errors.length === 0, errors.join(" / "));
await browser.close();
const bad = results.filter((x) => !x).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
