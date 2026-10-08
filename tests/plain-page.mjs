/**
 * A PLAIN PAGE COMES IN ELEMENT BY ELEMENT, AND ITS SIBLINGS AS PAGES.
 *
 * PST's test page (sparkygogo77-spec/PST, web/index.html: plain HTML, no
 * styles of its own, its screens filled in by scripts) came in through
 * Your repos > Bring it in as seven "bands of words": each section folded
 * into one part, headings flattened into paragraphs, buttons and fields
 * gone, and a hidden panel read as a tall blank box (Balance, 1422x563).
 * The fixture here is shaped like it (tests/fixtures/plain-page): a link
 * bar, headings, live values written into the middle of sentences, a list,
 * buttons, a text box, a list to choose from, a text area, a checkbox with
 * its label, blocks hidden as the page opens (the hidden attribute, inside
 * a visible section and a whole hidden section), a template, a script that
 * draws, and two other pages beside it.
 *
 * Two halves. The reading itself (`PARTS`, siteRead.ts) and what it becomes
 * (`pageParts.ts`), run in a bare browser on the fixture with its scripts
 * taken out, as the zip route opens it. Then the real door: the fixture
 * brought in as a repository through the GitHub control (GitHub stood in,
 * in the browser, with a placeholder token), and the board and the Preview
 * read.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/plain-page.mjs http://127.0.0.1:3013
 *
 * Covers: src/app/api/studio/zip/route.ts, src/features/studio/bring-in/FromASite.tsx, src/features/studio/shelf/parts/PageControls.tsx, src/features/studio/live/LiveSite.tsx, src/features/studio/shelf/parts/Runs.tsx
 */
import { existsSync, readFileSync } from "node:fs";
import { chromium } from "playwright-core";
import { PARTS } from "../src/features/studio/bring-in/siteRead.ts";
import { pagesToDoc, reportSays, pageLink } from "../src/features/studio/bring-in/pageParts.ts";
import { sansScripts } from "../src/features/studio/bring-in/zipImport.ts";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const DIR = "tests/fixtures/plain-page";
const FILES = ["index.html", "ledger.html", "moorings.html"];
const html = Object.fromEntries(FILES.map((f) => [f, readFileSync(`${DIR}/${f}`, "utf8")]));

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });

/* ------------------------------------------------------------------ */
/* 1. The reading, in a bare browser                                    */
/* ------------------------------------------------------------------ */

const bare = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const reads = [];
for (const f of FILES) {
  await bare.setContent(sansScripts(html[f]), { waitUntil: "load" });
  reads.push({ file: `site/${f}`, read: await bare.evaluate(PARTS, 1500) });
}
const home = reads[0].read;
const P = home.parts;
const shown = P.filter((p) => !p.hidden);
const byHook = (h) => P.find((p) => p.hooks["data-hook"] === h);
const kinds = (list) => list.reduce((m, p) => ({ ...m, [p.kind]: (m[p.kind] ?? 0) + 1 }), {});
console.log("home, as it opens:", JSON.stringify(kinds(shown)), "hidden:", JSON.stringify(kinds(P.filter((p) => p.hidden))));

/* (1) Controls arrive as parts of their own kind, with their hooks, though no script ran. */
check("the link bar is three links, each a part, with its hook", ["nav-home", "nav-ledger", "nav-moorings"].every((h) => byHook(h)?.kind === "link"), ["nav-home", "nav-ledger", "nav-moorings"].map((h) => byHook(h)?.kind).join());
check("a button is a button part, keeping its data-hook and its id", byHook("tide-refresh")?.kind === "button" && byHook("tide-refresh")?.hooks.id === "refresh" && byHook("tide-refresh")?.words === "Refresh tides");
check("a text box is a field, with its value and its label", byHook("book-length")?.kind === "field" && byHook("book-length")?.control?.value === "12" && byHook("book-length")?.label === "Length (metres)", JSON.stringify(byHook("book-length")?.control));
check("a list to choose from is a field with its options, the chosen one marked", byHook("book-berth")?.kind === "field" && byHook("book-berth")?.control?.options?.length === 2 && byHook("book-berth")?.control?.options?.[1]?.selected === true);
check("a text area is a field", byHook("book-notes")?.kind === "field" && byHook("book-notes")?.control?.type === "textarea");
check("a checkbox and its label are one checkbox part, ticked as the page had it", byHook("book-ack")?.kind === "check" && byHook("book-ack")?.words === "I have read the harbour rules" && byHook("book-ack")?.control?.checked === true);
check("a label beside a field is a part of its own", shown.some((p) => p.kind === "text" && p.words === "Length (metres)"));
check("a value written into a sentence keeps its hook on its run", (shown.find((p) => /^High water at/.test(p.words))?.runs ?? []).some((r) => r.hooks?.["data-hook"] === "tide-high"));
check("an empty place the code fills is kept, with its hook", byHook("tide-list")?.kind === "slot" && byHook("book-message")?.kind === "slot");
check("what a script would have drawn is not invented", !P.some((p) => /Drawn by a script|06:12/.test(p.words)));

/* (2) No styles of its own: the browser's defaults are what was read. */
const h1 = P.find((p) => p.tag === "h1"), h2 = P.find((p) => p.tag === "h2"), para = P.find((p) => p.tag === "p" && !p.hidden);
check("no styles of its own: none of its parts is reached by a style of the page's", home.styledParts === 0, `${home.styledParts}`);
check("the h1 keeps the browser's 2em bold, the h2 its 1.5em, a paragraph 16px", h1?.style.px === 32 && h1?.style.weight === 700 && h2?.style.px === 24 && h2?.style.weight === 700 && para?.style.px === 16, `${h1?.style.px}/${h1?.style.weight} ${h2?.style.px} ${para?.style.px}`);
check("a button keeps the browser's own face and edge", !!byHook("tide-refresh")?.style.bg && !!byHook("tide-refresh")?.style.border, JSON.stringify([byHook("tide-refresh")?.style.bg, byHook("tide-refresh")?.style.border]));
/* A line height of "normal" is measured, not taken as 1.2: read as 1.2, PST's two-line Balance note looked like less than two lines and was set on one line past the page's edge. */
const offLines = shown.filter((p) => (p.kind === "text" || p.kind === "heading") && p.tag !== "line" && p.words && p.box.h > 0).filter((p) => { const k = p.box.h / p.style.leading; return Math.abs(k - Math.round(k)) > 0.05; });
check("every line of words is a whole number of its own lines tall, so none is set on one line past the page", offLines.length === 0, offLines.map((p) => `${p.words.slice(0, 20)} ${p.box.h}/${p.style.leading}`).join(", "));
check("a list keeps its bullets", shown.some((p) => p.tag === "li" && p.words === "• Moorings checked twice a day"));

/* (3) Hidden at load: kept, as hidden parts, and taking no room. */
check("a hidden paragraph is a hidden part, with what hid it", byHook("berth-practice")?.hidden === "berth-practice" && byHook("offline")?.hidden === "offline");
check("a hidden button inside a shown section is a hidden part", byHook("tide-alarm")?.kind === "button" && byHook("tide-alarm")?.hidden === "tide-alarm");
check("a hidden section is read whole, every part of it hidden", P.filter((p) => p.hidden === "secret-panel").length >= 5 && P.filter((p) => p.hidden === "secret-panel").some((p) => p.kind === "button"));
check("a hidden block inside a hidden block keeps its own name", byHook("book-yes")?.hidden === "book-confirm");
check("a template's contents are hidden parts", P.some((p) => p.hidden === "template:row-template" && /Tide/.test(p.words)));
const berth = byHook("berth-panel");
const inBerth = shown.filter((p) => p !== berth && p.parent === P.indexOf(berth));
const foot = Math.max(...inBerth.map((p) => p.box.y + p.box.h));
check("a section is as tall as what shows in it: no blank band where hidden parts are", berth.box.y + berth.box.h - foot <= 24, `section ends ${berth.box.y + berth.box.h}, last shown part ends ${foot}`);
const secretTop = P.find((p) => p.hidden === "secret-panel" && p.kind === "section");
check("the page as it opens is no taller for a hidden section", home.height < (secretTop?.box.y ?? 0) + (secretTop?.box.h ?? 0) + 200 && shown.every((p) => p.box.y + p.box.h <= home.height + 1), `page ${home.height}`);

/* (4) A section is its parts, each its own, grouped under it. */
const tide = byHook("tide-panel");
const tideKids = shown.filter((p) => p.parent === P.indexOf(tide));
const list = tideKids.find((p) => p.tag === "ul");
const items = shown.filter((p) => list && p.parent === P.indexOf(list));
check("a section is a box holding its heading, its line, its list and its button, not one band of words", tide.kind === "section" && !tide.words && tideKids.some((p) => p.kind === "heading") && tideKids.some((p) => p.kind === "text") && tideKids.some((p) => p.kind === "button") && list?.kind === "section", JSON.stringify(kinds(tideKids)));
check("and the list is a box holding each item, one part each", items.length === 2 && items.every((p) => p.tag === "li"), items.map((p) => p.words).join(" / "));
check("every part's path continues its section's", P.filter((p) => p.parent >= 0).every((p) => p.selector.startsWith(P[p.parent].selector)));

/* (5) The other pages, as pages, and links to them go there. */
const { doc, report } = pagesToDoc(reads, { at: 1 });
check("each HTML page is a page: Home, Ledger, Moorings", doc.pages.map((p) => p.name).join() === "Home,Ledger,Moorings", doc.pages.map((p) => `${p.name} ${p.path}`).join(", "));
const ledgerId = doc.pages[1].id;
const navLedger = doc.nodes.find((n) => n.pageId === "page_home" && n.hooks?.["data-hook"] === "nav-ledger");
check("a link to another page of it goes to that page", navLedger?.content?.[0]?.link?.kind === "page" && navLedger.content[0].link.target === ledgerId, JSON.stringify(navLedger?.content));
check("a link off the site stays an address", pageLink("https://example.org/charts", new Map(), "site/")?.kind === "url");
check("parts land as the catalogue's own kinds", ["box", "prose", "cta-primary", "field", "checkbox"].every((f) => doc.nodes.some((n) => n.featureId === f)));
check("a hidden part is a state: not drawn where the page opens", doc.nodes.filter((n) => n.state).length === report.hidden && report.hidden > 0);
check("the ledger's table and its hidden line came too", doc.nodes.some((n) => n.pageId === ledgerId && n.hooks?.["data-hook"] === "ledger-table") && doc.nodes.some((n) => n.pageId === ledgerId && n.hooks?.["data-hook"] === "ledger-empty" && n.state));

/* (6) The report is honest: every number in it is a count of what landed. */
const said = reportSays(report, { scripts: true, from: "him/tidewater" });
const total = doc.nodes.length;
check("the report counts every part that landed, by page", said.startsWith(`${total} parts from him/tidewater landed on 3 pages (Home ${doc.nodes.filter((n) => n.pageId === "page_home").length}, Ledger ${doc.nodes.filter((n) => n.pageId === ledgerId).length}, Moorings`), said.slice(0, 140));
check("and how many are hidden, how many keep a hook, that scripts did not run, that the defaults were kept", said.includes(`${report.hidden} of them are hidden`) && said.includes(`${report.hooks} keep the id or data-hook`) && /scripts, which were not run/.test(said) && /browser's own defaults/.test(said), said);
await bare.close();

/* ------------------------------------------------------------------ */
/* 2. Through the real door                                             */
/* ------------------------------------------------------------------ */

const tree = [...FILES.map((f, i) => ({ path: `site/${f}`, type: "blob", sha: `f${i}`, size: html[f].length })), { path: "site/app.js", type: "blob", sha: "js", size: 10 }, { path: "README.md", type: "blob", sha: "rd", size: 10 }];
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route("https://api.github.com/**", (r) => {
  const u = new URL(r.request().url());
  const j = (b, code = 200) => r.fulfill({ status: code, contentType: "application/json", body: JSON.stringify(b) });
  const m = u.pathname.match(/^\/repos\/him\/tidewater(\/.*)?$/);
  if (!m) return j({ message: "no" }, 404);
  const rest = m[1] ?? "";
  if (!rest) return j({ default_branch: "main", homepage: "" });
  if (rest.startsWith("/git/trees/")) return j({ tree });
  const b = /\/git\/blobs\/f(\d)$/.exec(rest);
  if (b) return j({ encoding: "base64", content: Buffer.from(html[FILES[Number(b[1])]]).toString("base64") });
  if (rest.startsWith("/git/blobs/")) return j({ encoding: "base64", content: Buffer.from("x").toString("base64") });
  return j({ message: "no" }, 404);
});
await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => {
  const env = (state) => JSON.stringify({ state, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "s1", name: "Scratch", updatedAt: Date.now() }], activeId: "s1" }));
  localStorage.setItem("builder.studio", env({ nodes: [] }));
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(900);
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
await page.locator("[data-github-button]").first().click();
await page.waitForTimeout(700);
await page.locator("[data-repo-bring]").fill("him/tidewater");
await page.locator("[data-repo-pull]").click();
const board = () => page.evaluate(() => { const s = JSON.parse(localStorage.getItem("builder.studio")).state; return { nodes: s.nodes, pages: s.pages }; });
let got = await board();
for (let i = 0; i < 90 && got.nodes.length === 0; i++) { await page.waitForTimeout(1000); got = await board(); }
await page.waitForTimeout(1500);
got = await board();
const byFeature = got.nodes.reduce((m, n) => ({ ...m, [n.featureId]: (m[n.featureId] ?? 0) + 1 }), {});
console.log("landed:", got.nodes.length, JSON.stringify(byFeature));
check("brought in, the page lands element by element: as many parts as the reading found, on three pages", got.nodes.length === total && got.pages.length === 3, `${got.nodes.length} of ${total}, ${got.pages.length} pages`);
check("buttons, fields, the checkbox, links and headings all landed as their own parts", byFeature["cta-primary"] >= 4 && byFeature.field >= 3 && byFeature.checkbox >= 1 && byFeature.prose >= 10 && byFeature.box >= 4);
check("hidden parts are kept as hidden parts", got.nodes.filter((n) => n.state).length === report.hidden);
const homeNodes = got.nodes.filter((n) => n.pageId === "page_home" && !n.state);
const lowest = Math.max(...homeNodes.map((n) => n.y + n.h));
check("the page as it opens on the board is no taller than the page was", lowest <= home.height + 2, `${lowest} vs ${home.height}`);
const strip = await page.evaluate(() => document.querySelector("[data-import-strip]")?.textContent ?? "");
check("the line across the board says what came, honestly", strip.includes(`${total} parts from him/tidewater landed on 3 pages`) && /hidden as the page opens/.test(strip) && /scripts, which were not run/.test(strip), strip.slice(0, 200));

/* On the live page (the Preview), the page's code would find its hooks on the real elements. */
await page.keyboard.press("Escape");
await page.keyboard.press("p");
await page.waitForTimeout(2500);
const live = await page.evaluate(() => {
  const q = (s) => document.querySelector(s);
  return {
    field: q('input[data-hook="book-length"]')?.value ?? null,
    select: q('select[data-hook="book-berth"]')?.value ?? null,
    area: !!q('textarea[data-hook="book-notes"]'),
    check: q('input[type="checkbox"][data-hook="book-ack"]')?.checked ?? null,
    button: q('[data-hook="tide-refresh"]')?.textContent?.trim() ?? null,
    run: q('[data-hook="tide-high"]')?.textContent ?? null,
    hidden: (() => { const e = q('[data-hook="secret-panel"]'); return e ? getComputedStyle(e).display : "absent"; })(),
  };
});
check("live, a field is a real input with its hook and value", live.field === "12", JSON.stringify(live));
check("live, the list to choose from is a real select with the chosen option", live.select === "b4");
check("live, the text area and the checkbox are real, the box ticked", live.area && live.check === true);
check("live, a button and a value inside a sentence carry their hooks", live.button === "Refresh tides" && live.run === "-");
check("live, a hidden section is not shown where the page opens", live.hidden === "none");
check("no errors on the page", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
