/**
 * A BOX AND WHAT IT HOLDS MOVE TOGETHER; AN OFFSET CHANGES ONLY BY GROWTH.
 *
 * MEASURED on sink's home page brought in through the real door: the healing
 * (`fitRows`) gave every part a new top of its own, inherited nothing, and
 * skipped the pair where one box holds another, so a container neither
 * pushed nor carried its contents. The sidebar went down 72 and its eight
 * buttons 12; the first button's icon 0. The footer and its parts moved by
 * four different amounts.
 *
 * THE RULES (the coordinator's ruling):
 *   1. Growth is absorbed by the container. Text grows; its container grows
 *      by that much, and the container's own contents below the grown part
 *      move down by it.
 *   2. Displacement is inherited. When a part moves, everything it holds
 *      moves by exactly that much and keeps its offsets.
 * Rule 2 is the invariant. Rule 1 is the only thing allowed to change an
 * offset inside a container, and only by the growth above it there.
 *
 * WHAT IS CHECKED, from measurement only — no expected number is written here:
 *   · the reference is the page as the sweep leaves it (the sweep's own
 *     corrections — the joins, a wrapper grown round what it owns — are the
 *     document's, not the healing's), read before the page is ever drawn:
 *     the fixture opens on a blank page, so the home page is not on screen
 *     when it lands;
 *   · then the home page is opened and left to heal, and read again;
 *   · g(P), a part's growth, is its height after healing less its height in
 *     the reference; rel(P), its shift inside its container, is how far it
 *     moved less how far its container moved (the page, for a top-level part);
 *   · for every part: rel(P) = the most that any sibling standing over it
 *     (above it, sharing some of its width) moved and grew — max(rel + g),
 *     or 0 when none did;
 *   · and a wordless box grows by exactly the most that anything it holds
 *     moved and grew inside it;
 *   · and only words grow: a part with none, holding nothing, keeps its
 *     captured height (a picture drawn taller is the board's fault, not growth).
 * Ownership is the recorded selector path (`owns.ts`): a part's container is
 * the nearest part on the page whose path its own continues.
 *
 * The fixture is sink's home, Tokens and Cleanup pages (sparkygogo77-spec/sink
 * 571f067, site/document.json), with a blank page put first. Home and Tokens
 * are the two his board showed broken; Cleanup is a guard. On his board it
 * read rail bottom 1354 against footer top 1354, as the capture has it — which
 * is also what EVERY page reads before it has been opened, since the healing
 * only runs on the page on screen. So the guard opens it: once healed, its
 * rail must still meet its footer.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/carry-offsets.mjs http://127.0.0.1:3013
 */
import { existsSync, readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const DOC = readFileSync(new URL("./fixtures/sink-pages.json", import.meta.url));
const PAGES = ["page_home", "page_tokens", "page_cleanup"];
const doc = JSON.parse(DOC.toString("utf8"));
const tree = [
  { path: "package.json", type: "blob", sha: "pkg", size: 10 },
  { path: "site/document.json", type: "blob", sha: "doc", size: DOC.length },
];

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1763, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route("https://api.github.com/**", (r) => {
  const u = new URL(r.request().url());
  const j = (b, code = 200) => r.fulfill({ status: code, contentType: "application/json", body: JSON.stringify(b) });
  const rest = u.pathname.startsWith("/repos/him/sink") ? u.pathname.slice("/repos/him/sink".length) : null;
  if (rest === null) return j({ message: "no" }, 404);
  if (!rest) return j({ default_branch: "main", homepage: "" });
  if (rest.startsWith("/git/trees/")) return j({ tree });
  if (rest === "/git/blobs/doc") return j({ encoding: "base64", content: DOC.toString("base64") });
  return j({ message: "no" }, 404);
});

const state = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {});
const snap = async (pg) => Object.fromEntries(((await state()).nodes ?? []).filter((n) => n.pageId === pg).map((n) => [n.id, { x: n.x, y: n.y, w: n.w, h: n.h, sel: n.from?.selector ?? "", box: n.featureId === "box", row: !!n.layout && (n.layout.display === "grid" || (n.layout.display === "flex" && (!n.layout.direction || n.layout.direction === "row"))) && (!n.layout.align || n.layout.align === "stretch" || n.layout.align === "normal"), padL: n.pad?.left ?? 0, padR: n.pad?.right ?? 0, words: !!(typeof n.content === "string" ? n.content.trim() : Array.isArray(n.content) ? n.content.map((r) => r.text ?? "").join("").trim() : "") }]));
/** Read until two reads a second apart agree: the healing is debounced and waits for faces. */
const settled = async (pg) => {
  let last = "", now = "";
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(1000);
    now = JSON.stringify(await snap(pg));
    if (now === last) break;
    last = now;
  }
  return JSON.parse(now);
};

await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => {
  const env = (s) => JSON.stringify({ state: s, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "s3", name: "Site 3", updatedAt: Date.now() }], activeId: "s3" }));
  localStorage.setItem("builder.studio", env({ nodes: [] }));
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);
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
await page.locator("[data-repo-bring]").fill("him/sink");
await page.locator("[data-repo-pull]").click();
for (let i = 0; i < 60 && Object.keys(await snap("page_home")).length < 50; i++) await page.waitForTimeout(1000);

const landed = await state();
check("it lands on the blank page, so none of the measured pages has been drawn yet", landed.activePageId === "page_blank", landed.activePageId);
check("the sweep ran on it", (landed.swept ?? 0) > 0, `swept ${landed.swept}`);
await settled("page_home");
const refs = {};
for (const pg of PAGES) refs[pg] = await snap(pg);
const afters = {};
for (const pg of PAGES) {
  await page.evaluate((id) => { const raw = JSON.parse(localStorage.getItem("builder.studio")); raw.state.activePageId = id; localStorage.setItem("builder.studio", JSON.stringify(raw)); }, pg);
  await page.reload({ waitUntil: "networkidle" });
  afters[pg] = await settled(pg);
}
await browser.close();

for (const pg of PAGES) {
console.log(`\n${pg}:`);
const ref = refs[pg], after = afters[pg];
/* ------------------------------------------------------------------ */
const ids = Object.keys(ref).filter((id) => id in after);
check("every part of the page is still there", ids.length === Object.keys(ref).length && ids.length > 50, `${ids.length} of ${Object.keys(ref).length}`);
const owner = new Map();
for (const id of ids) {
  const s = ref[id].sel;
  let best = null;
  for (const o of ids) if (o !== id && ref[o].sel && s.startsWith(`${ref[o].sel} > `) && (!best || ref[o].sel.length > ref[best].sel.length)) best = o;
  owner.set(id, best);
}
const moved = (id) => after[id].y - ref[id].y;
const g = (id) => after[id].h - ref[id].h;
const rel = (id) => moved(id) - (owner.get(id) ? moved(owner.get(id)) : 0);
const across = (a, b) => a.x < b.x + b.w - 1 && b.x < a.x + a.w - 1;
const grew = ids.filter((id) => g(id) !== 0);
console.log(`  (${ids.length} parts; ${grew.length} grew in the healing, by ${[...new Set(grew.map(g))].sort((a, b) => a - b).join(", ") || "nothing"}px)`);

/*
 * THE ROWS THE CAPTURE STATES (the ruling): wordless boxes sharing a top and a
 * height that tile their container's whole width edge to edge (its inside, or
 * the page frame for a top-level part), or siblings sharing a top and a height
 * under a box whose layout declares a stretching row. A row lines up on one
 * top and grows to one bottom.
 */
const rowOf = new Map();
for (const o of [null, ...ids]) {
  const sibs = ids.filter((k) => owner.get(k) === o);
  const left = o ? ref[o].x + ref[o].padL : 0, right = o ? ref[o].x + ref[o].w - ref[o].padR : doc.frameWidth;
  const seen = new Set();
  for (const a of sibs) {
    if (seen.has(a)) continue;
    const line = sibs.filter((b) => Math.abs(ref[b].y - ref[a].y) <= 1 && Math.abs(ref[b].h - ref[a].h) <= 1);
    line.forEach((b) => seen.add(b));
    if (line.length < 2) continue;
    const xs = [...line].sort((p, q) => ref[p].x - ref[q].x);
    const tiles = line.every((b) => !ref[b].words) && Math.abs(ref[xs[0]].x - left) <= 1 && Math.abs(ref[xs.at(-1)].x + ref[xs.at(-1)].w - right) <= 1
      && xs.every((b, i) => i === 0 || Math.abs(ref[b].x - (ref[xs[i - 1]].x + ref[xs[i - 1]].w)) <= 1);
    if (tiles || (o && ref[o].row)) for (const b of line) rowOf.set(b, line);
  }
}
const rows = [...new Set(rowOf.values())];
console.log(`  (rows the capture states: ${rows.map((r) => r.join("+")).join("; ") || "none"})`);

const offBy = [];
const wantOf = (id) => {
  const sibs = ids.filter((o) => o !== id && owner.get(o) === owner.get(id) && ref[o].y < ref[id].y && across(ref[o], ref[id]));
  return Math.max(0, ...sibs.map((o) => rel(o) + g(o)));
};
for (const id of ids) {
  /* A row member sits where the row does: the lowest of its members' own answers. */
  const want = rowOf.has(id) ? Math.max(...rowOf.get(id).map(wantOf)) : wantOf(id);
  if (rel(id) !== want) offBy.push(`${id} ${rel(id) - want > 0 ? "+" : ""}${rel(id) - want}`);
}
check("every part sits at its offset in its container plus the growth above it there, and nothing else", offBy.length === 0,
  offBy.length ? `${offBy.length} of ${ids.length} are not: ${offBy.slice(0, 12).join(", ")}${offBy.length > 12 ? ", …" : ""}` : `${ids.length} parts`);

const holdsSome = ids.filter((id) => ref[id].box && ids.some((k) => owner.get(k) === id));
const wrongH = [];
const growthIn = (c) => Math.max(0, ...ids.filter((k) => owner.get(k) === c).map((k) => rel(k) + g(k)));
for (const c of holdsSome) {
  const want = growthIn(c);
  /* In a row, a box grows to the row's bottom: at least its own growth, and exactly the row's. */
  if (rowOf.has(c) ? g(c) < want : g(c) !== want) wrongH.push(`${c} grew ${g(c)}, holds ${want}`);
}
check("a row the capture states ends on one top and one bottom", rows.every((r) => new Set(r.map((b) => after[b].y)).size === 1 && new Set(r.map((b) => after[b].y + after[b].h)).size === 1),
  rows.map((r) => r.map((b) => `${b} ${after[b].y}–${after[b].y + after[b].h}`).join(" / ")).join("; ") || "no rows on this page");
check("every box that holds something grows by exactly the growth inside it (a row's by at least that, to the row's bottom)", wrongH.length === 0,
  wrongH.length ? `${wrongH.length} of ${holdsSome.length}: ${wrongH.slice(0, 8).join("; ")}` : `${holdsSome.length} boxes`);

/* Only words grow: a picture or an icon drawn taller than the capture recorded is the board drawing it wrong. */
const wordless = ids.filter((id) => !ref[id].words && !ids.some((k) => owner.get(k) === id));
const stretched = wordless.filter((id) => g(id) !== 0);
check("a part with no words, holding nothing, keeps its captured height", stretched.length === 0,
  stretched.length ? stretched.map((id) => `${id} ${ref[id].h}→${after[id].h}`).join(", ") : `${wordless.length} parts`);

/*
 * WHAT THE BOARD'S OWN BADGE SAYS. He selected the footer's div on Tokens:
 * the badge read "div · 2 inside" while both of those two were drawn above
 * it. A part the reference draws inside its box stays drawn inside it.
 */
const inside = (a, b) => a.y >= b.y && a.y + a.h <= b.y + b.h;
const fell = ids.filter((id) => owner.get(id) && inside(ref[id], ref[owner.get(id)]) && !inside(after[id], after[owner.get(id)]));
check("a box whose badge reads \"N inside\" still draws those N inside it", fell.length === 0,
  fell.length ? fell.slice(0, 10).map((id) => `${id} out of ${owner.get(id)}`).join(", ") : `${ids.filter((id) => owner.get(id) && inside(ref[id], ref[owner.get(id)])).length} parts`);

/* The sidebar, named, because it is what he saw. */
const bySel = (s) => ids.find((id) => ref[id].sel === s);
const aside = bySel("body > div > aside"), nav = bySel("body > div > aside > nav"), footer = bySel("body > div > footer");
const buttons = ids.filter((id) => owner.get(id) === nav);
check("the sidebar's buttons move with the sidebar", !!aside && !!nav && buttons.length === 8 && buttons.every((b) => moved(b) === moved(nav)) && moved(nav) === moved(aside),
  `aside ${moved(aside)}, nav ${moved(nav)}, buttons ${[...new Set(buttons.map(moved))].join("/")}`);

/*
 * THE PRICE COUNTER, BY NAME. On his Tokens page the header's price group
 * showed both faults side by side: "$ 116.59" (n_prose_242) and "-1.94 %"
 * (n_prose_245) each wrapped to two lines, exactly double their captured
 * height, and the growth pushed the words out below their boxes (n_box_241,
 * the chip n_box_243) instead of growing the boxes; the arrow beside them
 * (n_drawnicon_244) did not grow and did not move.
 */
if (pg === "page_tokens") {
  for (const [kid, box] of [["n_prose_242", "n_box_241"], ["n_prose_245", "n_box_243"]]) {
    check(`the price counter: ${kid} ends inside ${box}, its box grown by its growth`, !!after[kid] && !!after[box] && inside(after[kid], after[box]),
      after[kid] && after[box] ? `${kid} ${after[kid].y}–${after[kid].y + after[kid].h} (grew ${g(kid)}), ${box} ${after[box].y}–${after[box].y + after[box].h} (grew ${g(box)})` : "missing");
  }
  check("the price counter: the arrow keeps its place in its chip", !!after.n_drawnicon_244 && after.n_drawnicon_244.y - after.n_box_243.y === ref.n_drawnicon_244.y - ref.n_box_243.y,
    `arrow ${ref.n_drawnicon_244.y - ref.n_box_243.y} below the chip's top, now ${after.n_drawnicon_244.y - after.n_box_243.y}`);
}

/* THE GUARD. The capture's rail ends where its footer starts; healed, it still must. Both read from the page itself. */
if (pg === "page_cleanup") {
  const gapWas = doc.nodes.find((n) => n.id === footer).y - (doc.nodes.find((n) => n.id === aside).y + doc.nodes.find((n) => n.id === aside).h);
  const gapNow = after[footer].y - (after[aside].y + after[aside].h);
  check("Cleanup, opened and healed: its rail still meets its footer, as the capture has it", gapNow === gapWas,
    `rail bottom ${after[aside].y + after[aside].h}, footer top ${after[footer].y}; captured gap ${gapWas}`);
}
}
check("with no page error on the way", errors.length === 0, errors.join(" / "));

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
