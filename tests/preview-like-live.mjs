/**
 * THE PREVIEW SETS A BROUGHT-IN PAGE'S WORDS AS THE PAGE DID.
 *
 * J (2026-10-09), PST's Preview beside the live site: the Balance note ran
 * off the panel's right edge on one line, and the nav links were underlined
 * and no longer centred in their dark pills.
 *
 *   - The note is a `display: inline` paragraph before its "?" that the page
 *     wraps over two rows. An inline element's boxes are its glyphs' height,
 *     so its two rows read 42px under two 22.4px lines, and the part was held
 *     to one line. Two rows or more are read as words that wrap, at the width
 *     of what holds them, as tall as the lines the page gave them.
 *   - A link the page draws without an underline (its own
 *     `text-decoration: none`) is drawn without one.
 *   - A link drawn as a pill (a fill, even padding each side) centres its
 *     words, so set in wider glyphs than the page measured they overrun both
 *     sides evenly rather than running out on the right.
 *
 * Read with the reader the import uses, landed with `pagesToDoc`, drawn in
 * the Preview; then the same with every glyph set wider (another machine's
 * font, in short).
 *
 *   npm run build && npx next start -p 3013
 *   node tests/preview-like-live.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/bring-in/siteread/parts.ts, src/features/studio/bring-in/pageParts.ts, src/features/studio/shelf/parts/Text.tsx, src/features/studio/shelf/parts/Runs.tsx
 */
import { PARTS } from "../src/features/studio/bring-in/siteRead.ts";
import { pagesToDoc } from "../src/features/studio/bring-in/pageParts.ts";
import { launch } from "./fixtures/look-sites.mjs";

const BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const SITE = `<!doctype html><html><head><style>
body { margin: 8px; font: 16px/1.4 system-ui, sans-serif; color: #1a0f0b; background: #fdf3e6; }
[data-hook="nav-links"] { display: flex; gap: 8px; }
[data-hook="nav-links"] a { padding: 6px 14px; border-radius: 10px; background: #1a0f0b; color: #b8ff6a; font: 700 16px/1.4 ui-monospace, monospace; text-decoration: none; }
section { position: absolute; left: 400px; top: 80px; width: 236px; padding: 16px; border: 3px solid #1a0f0b; border-radius: 16px; background: #fff8ee; }
section p { margin: 0 0 8px; }
[data-hook="balance-note"], [data-hook="balance-note-more"] { display: inline; }
summary { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; margin-left: 4px; list-style: none; border-radius: 50%; background: #f3d440; border: 1px solid #1a0f0b; font-size: 11px; vertical-align: middle; }
</style></head><body>
<nav data-hook="nav"><span data-hook="nav-links">
  <a href="/" data-hook="nav-play">Play</a>
  <a href="/profile.html" data-hook="nav-profile">My profile</a>
</span></nav>
<p data-hook="intro">Read <a href="/rules.html" data-hook="intro-rules">the rules</a> before you play.</p>
<section data-hook="balance-panel">
  <p data-hook="balance-note">One escrow balance for all your matches.</p>
  <details data-hook="balance-note-more"><summary data-hook="balance-note-more-toggle">?</summary><p data-hook="balance-note-more-text">Deposit once, play as many matches as it covers.</p></details>
  <p data-hook="balance-wallet-line">In your wallet: - SOL</p>
</section>
</body></html>`;

const browser = await launch();
const site = await browser.newPage({ viewport: { width: 1000, height: 600 } });
await site.setContent(SITE);
const live = await site.evaluate(() => {
  const r = document.createRange(); r.selectNodeContents(document.querySelector('[data-hook="balance-note"]'));
  const rows = Array.from(r.getClientRects()).map((q) => Math.round(q.top));
  return { noteRows: new Set(rows).size, lh: parseFloat(getComputedStyle(document.querySelector('[data-hook="balance-note"]')).lineHeight) };
});
check("the page itself: the note wraps over two rows", live.noteRows === 2, JSON.stringify(live));

/* 1. Read */
const read = await site.evaluate(PARTS, 1500);
const parts = read.parts ?? read;
const note = parts.find((p) => p.words?.startsWith("One escrow"));
check("1. the note is read as words that wrap", note?.wraps === true, JSON.stringify(note ? { box: note.box, wraps: note.wraps } : null));
check("…as wide as the panel holds them and as tall as its two lines", !!note && note.box.w >= 234 && note.box.w <= 238 && Math.abs(note.box.h - 2 * live.lh) <= 1.5, JSON.stringify(note?.box));
const pill = parts.find((p) => p.hooks?.["data-hook"] === "nav-profile");
check("the nav pill is read as a link the page did not underline", pill?.kind === "link" && pill.bare === true, JSON.stringify(pill ? { kind: pill.kind, bare: pill.bare } : null));
const intro = parts.find((p) => p.words?.startsWith("Read"));
const rulesRun = intro?.runs?.find((r) => r.href);
check("a link in a sentence that the page underlines is not marked bare", !!rulesRun && !rulesRun.bare, JSON.stringify(intro?.runs));

/* 2. Landed */
const { doc } = pagesToDoc([{ file: "site/index.html", read }], { at: 1 });
const byHook = (h) => doc.nodes.find((n) => n.hooks?.["data-hook"] === h);
const noteNode = doc.nodes.find((n) => Array.isArray(n.content) && n.content.some((s) => s.text?.startsWith("One escrow")));
check("2. the note lands set to wrap", noteNode?.text?.wrap === "wrap", JSON.stringify(noteNode?.text));
const pillNode = byHook("nav-profile");
check("the pill lands centred, its run marked bare", pillNode?.text?.align === "center" && pillNode.content?.[0]?.bare === true && !!pillNode.content?.[0]?.link, JSON.stringify({ text: pillNode?.text, content: pillNode?.content }));
await site.close();

/* 3. Drawn in the Preview */
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route("**/api/studio/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ github: { configured: false, missing: [] }, vercel: { hook: false } }) }));
await page.route(/^https:\/\/(?!fonts\.)/, (r) => r.fulfill({ status: 404, body: "" }));
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => {
  const env = (s) => JSON.stringify({ state: s, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "like-live", name: "like-live", updatedAt: Date.now() }], activeId: "like-live" }));
  localStorage.setItem("builder.studio", env({ nodes: [] }));
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);
const home = doc.pages.find((p) => p.path === "/") ?? doc.pages[0];
await page.evaluate((d) => window.__studioLoadDoc(d), { ...doc, activePageId: home.id });
await page.waitForTimeout(2500);
await page.goto(`${BASE}/builder/preview`, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);

const look = (ids) => page.evaluate(({ noteId, pillId }) => {
  const rowsOf = (el) => { const r = document.createRange(); r.selectNodeContents(el); return Array.from(r.getClientRects()).filter((q) => q.width > 0); };
  const n = document.querySelector(`[data-live-node="${noteId}"]`);
  const span = n?.querySelector('[data-hook="balance-note"]') ?? n?.querySelector("p");
  const nr = span ? rowsOf(span) : [];
  const box = n?.getBoundingClientRect();
  const p = document.querySelector(`[data-live-node="${pillId}"]`);
  const fill = p?.querySelector("[data-part-box]")?.getBoundingClientRect();
  const run = p?.querySelector("[data-run-link]");
  const pr = run ? rowsOf(run) : [];
  const left = pr.length ? Math.min(...pr.map((q) => q.left)) : NaN, right = pr.length ? Math.max(...pr.map((q) => q.right)) : NaN;
  return {
    note: { rows: new Set(nr.map((q) => Math.round(q.top))).size, right: nr.length ? Math.max(...nr.map((q) => q.right)) : NaN, boxRight: box?.right ?? NaN },
    pill: { underline: run ? getComputedStyle(run).textDecorationLine : null, gapL: left - (fill?.left ?? NaN), gapR: (fill?.right ?? NaN) - right },
  };
}, ids);
const ids = { noteId: noteNode?.id, pillId: pillNode?.id };
const asIs = await look(ids);
check("3. the note wraps over two rows in the Preview, inside its box", asIs.note.rows === 2 && asIs.note.right <= asIs.note.boxRight + 1, JSON.stringify(asIs.note));
check("the nav link has no underline", asIs.pill.underline === "none", JSON.stringify(asIs.pill));
check("its words sit in the middle of its pill", Math.abs(asIs.pill.gapL - asIs.pill.gapR) <= 1.5, JSON.stringify(asIs.pill));
await page.addStyleTag({ content: "[data-live-node] p, [data-live-node] span { letter-spacing: 0.25em !important; }" });
await page.waitForTimeout(500);
const wide = await look(ids);
check("set wider: the pill's words overrun both sides evenly", wide.pill.gapL < 0 && Math.abs(wide.pill.gapL - wide.pill.gapR) <= 1.5, JSON.stringify(wide.pill));
check("…and the note still wraps, inside its box but for the hair of room it may use", wide.note.rows >= 2 && wide.note.right <= wide.note.boxRight + 5, JSON.stringify(wide.note));
check("with no page error on the way", errors.length === 0, errors.join(" / "));
await browser.close();
const bad = results.filter((x) => !x).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
