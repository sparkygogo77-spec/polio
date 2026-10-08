/**
 * A "?" HELP READS AS ITS "?", NOT AS THE TEXT FOLDED UNDER IT.
 *
 * J (2026-10-06): PST's Balance panel has a one-line note and a "?" (a
 * closed <details>) that folds the rest of the help away. The import read
 * the "?" line's box from its first node to its last, a stretch that holds
 * the folded paragraph too, so the "?" came in 236x234 and was drawn over
 * the wallet lines under it. A line's box is its own nodes' boxes now.
 *
 *   node tests/folded-help.mjs
 *
 * Covers: src/features/studio/bring-in/siteread/parts.ts
 */
import { PARTS } from "../src/features/studio/bring-in/siteRead.ts";
import { launch } from "./fixtures/look-sites.mjs";

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
await page.setContent(`<!doctype html><body style="margin:0"><section data-hook="balance-panel" style="width:236px;padding:8px;border:3px solid #222;border-radius:16px;background:#fff8ee">
  <p data-hook="balance-note" style="display:inline">One escrow balance for all your matches.</p>
  <details data-hook="balance-note-more" style="display:inline">
    <summary data-hook="balance-note-more-toggle" style="display:inline-flex;width:24px;height:24px;list-style:none;border-radius:50%;background:#f5c542;border:2px solid #222">?</summary>
    <p data-hook="balance-note-more-text">Deposit once, play as many matches as it covers, and withdraw whenever you are not in a match. Stakes leave it when a match starts.</p>
  </details>
  <p data-hook="balance-wallet-line">In your wallet: - SOL</p>
</section></body>`);
const real = await page.evaluate(() => { const r = document.querySelector("summary").getBoundingClientRect(); const w = document.querySelector('[data-hook="balance-wallet-line"]').getBoundingClientRect(); return { q: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], wallet: Math.round(w.top) }; });
const read = await page.evaluate(PARTS, 1500);
const parts = read.parts ?? read;
const q = parts.find((p) => p.words === "?");
check("the \"?\" is read", !!q, JSON.stringify(parts.map((p) => p.words).slice(0, 12)));
check("its box is the \"?\" itself", !!q && Math.abs(q.box.w - real.q[2]) <= 2 && Math.abs(q.box.h - real.q[3]) <= 2 && Math.abs(q.box.x - real.q[0]) <= 2, JSON.stringify({ read: q?.box, real: real.q }));
check("it ends above the wallet line", !!q && q.box.y + q.box.h <= real.wallet, JSON.stringify({ read: q?.box, wallet: real.wallet }));
const note = parts.find((p) => p.words?.startsWith("One escrow"));
check("the note line has no outline, fill or padding of its own", !!note && !note.style.border && !note.style.bg && !note.style.radius && note.style.pad.every((v) => v === 0), JSON.stringify(note?.style ? { border: note.style.border, bg: note.style.bg, radius: note.style.radius, pad: note.style.pad } : null));
check("the \"?\" keeps its round yellow face", !!q && !!q.style.bg && q.style.radius >= 10 && !!q.style.border, JSON.stringify(q?.style ? { bg: q.style.bg, radius: q.style.radius, border: q.style.border } : null));
check("the \"?\" sits after the note's words", !!q && !!note && !(note.words ?? "").includes("?"), note?.words);
await browser.close();
const bad = results.filter((x) => !x).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
