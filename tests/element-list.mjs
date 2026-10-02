/**
 * The Element tab's list: every element on the page, flat, in the order a
 * visitor sees them, one row each.
 *
 * The owner on the tree it replaces: nested rows (Page body > Section > Box
 * in …), names that repeat the site's title, four identical "status: CA
 * copied!" rows. Asked: a flat list top to bottom, one row each, a plain
 * name from its words or role and where it sits; a state that only a press
 * shows once, under the control that shows it, marked; never a row twice;
 * press to pick and scroll, hover to outline, a search, and "Show nesting"
 * for the tree.
 *
 * Read on sink's own captures of trumpmorty.fun, parasiteonsol.fun and
 * gotchi.gg, each brought in the way an import brings it (`attachCaptured`).
 * Read-only: nothing is written to sink.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/element-list.mjs http://127.0.0.1:3013 <the capture folder>
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const BASE = (process.argv[2] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const SINK = process.argv[3] ?? process.env.SINK ?? join(here, "..", "capture", "versions", "sink-0ee06fa");
const SITES = ["trumpmorty-fun", "parasiteonsol-fun", "gotchi-gg"];
mkdirSync(".screenshots/lane-e", { recursive: true });
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const src = (f) => jiti.import(join(here, "..", "src", "features", "studio", f));
const { partList, filterRows } = await src("partList.ts");
const { attachCaptured } = await src("library/captured.ts");

/** A site as an import brings it: its home page's parts with the capture's behaviours attached. */
const load = (site) => {
  const doc = JSON.parse(readFileSync(join(SINK, "sites", site, "site", "document.json"), "utf8"));
  const home = doc.activePageId ?? doc.pages[0].id;
  const nodes = attachCaptured(doc.nodes, doc.behaviours, doc.keyframes);
  return { doc: { ...doc, nodes, activePageId: home }, home, page: nodes.filter((n) => n.pageId === home) };
};

/* ------------------------------------------------------------ the list, on each site */
const loaded = {};
for (const site of SITES) {
  const { doc, home, page } = load(site);
  loaded[site] = { doc, home };
  const byId = new Map(page.map((n) => [n.id, n]));
  const rows = partList(page, { siteName: doc.brief?.name });
  const top = rows.filter((r) => r.depth === 0);
  /* Page order: each top row's part sits no higher than the one before it, tolerating a row of side-by-side parts. */
  const backwards = top.filter((r, i) => i > 0 && !top[i - 1].after && byId.get(r.id).y + 2 < byId.get(top[i - 1].id).y && !rows.some((x) => x.control === top[i - 1].id));
  check(`${site}: the list is in page order, top to bottom`, top.length > 20 && backwards.length === 0, `${rows.length} rows from ${page.length} parts${backwards.length ? `; out of order: ${backwards.slice(0, 3).map((r) => r.name).join(", ")}` : ""}`);
  const ids = rows.flatMap((r) => r.ids);
  check(`${site}: no part is in two rows`, ids.length === new Set(ids).size, `${ids.length} ids`);
  const twins = rows.filter((r, i) => i > 0 && r.name === rows[i - 1].name && r.where === rows[i - 1].where && r.depth === rows[i - 1].depth && r.control === rows[i - 1].control);
  check(`${site}: no row is the row before it again`, twins.length === 0, twins.slice(0, 3).map((r) => r.name).join(", "));
  const hiddenRows = rows.filter((r) => r.after);
  const states = page.filter((n) => n.state);
  if (states.length) {
    /* Every after-press row sits under the control that shows it, right after it or after its siblings. */
    const placed = hiddenRows.filter((r) => r.control).every((r) => {
      const i = rows.indexOf(r);
      let j = i - 1;
      while (j >= 0 && rows[j].after && rows[j].control === r.control) j--;
      return j >= 0 && rows[j].ids.includes(r.control);
    });
    check(`${site}: what a press shows is listed under the control that shows it`, hiddenRows.length > 0 && placed, `${hiddenRows.length} after-press rows from ${states.length} parts`);
    const sameUnder = new Map();
    for (const r of hiddenRows) { const k = `${r.control}|${r.name}`; sameUnder.set(k, (sameUnder.get(k) ?? 0) + 1); }
    const repeated = [...sameUnder].filter(([, n]) => n > 1);
    check(`${site}: each after-press state appears once under its control`, repeated.length === 0, repeated.slice(0, 3).map(([k]) => k).join(", "));
  }
  const title = (doc.brief?.name ?? "").toLowerCase();
  const echo = rows.filter((r) => r.where && title && r.where.toLowerCase() === `in ${title}`);
  check(`${site}: no row's place repeats the site's title`, echo.length === 0, echo.slice(0, 2).map((r) => r.name).join(", "));
  const machine = rows.filter((r) => /·\s*\d+\s+inside|^Box$|n_[a-z]+_\d+/.test(r.name));
  check(`${site}: names are plain, never the capture's machinery`, machine.length === 0, machine.slice(0, 3).map((r) => r.name).join(", "));
  if (site === "gotchi-gg") {
    const r = filterRows(rows, "wallet");
    check("search keeps the rows whose words or place match", r.length > 0 && r.length < rows.length && r.every((x) => /wallet/i.test(x.name + (x.where ?? ""))), `${r.length} of ${rows.length}`);
  }
}

const tm = partList(load("trumpmorty-fun").page, { siteName: loaded["trumpmorty-fun"].doc.brief?.name });
const say = (want) => tm.some((r) => r.name === want);
check("plain names from words and role: “Link: BUY ON PUMP.FUN”, “Heading: THE LORE”", say("Link: BUY ON PUMP.FUN") && say("Heading: THE LORE"), tm.slice(0, 8).map((r) => r.name).join(" · "));
check("and where each sits: the header's links “in header”", tm.filter((r) => r.where === "in header").length >= 2);
check("one button is one row: its words are not a row of their own", !tm.some((r) => r.name === "Words: BUY ON PUMP.FUN"));

/* ------------------------------------------------------------ in the Builder */
const { chromium } = createRequire(import.meta.url)("playwright-core");
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.route("**/api/tweets/status", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ configured: false }) }));
for (const site of ["trumpmorty-fun", "gotchi-gg"]) {
  const { doc, home } = loaded[site];
  await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
  await page.evaluate(([state, name]) => {
    const env = (s) => JSON.stringify({ state: s, version: 0 });
    localStorage.setItem("builder.builds", env({ projects: [{ id: "b1", name, updatedAt: Date.now() }], activeId: "b1" }));
    localStorage.setItem("builder.studio", env(state));
    localStorage.removeItem("builder.elementsNesting");
  }, [{ ...doc, activePageId: home }, site]);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const side = page.locator("[data-side-panel]");
  await side.getByRole("radio", { name: "Element" }).first().click({ force: true });
  await page.waitForTimeout(700);
  const list = side.locator('[data-element-list="flat"]');
  check(`${site}: the Element tab leads with the flat list`, (await list.count()) === 1 && (await list.locator("[data-list-row]").count()) > 10);
  await page.screenshot({ path: `.screenshots/lane-e/element-list-${site}.png` });
  if (site === "gotchi-gg") {
    const after = list.locator("[data-list-after]").first();
    await after.scrollIntoViewIfNeeded().catch(() => {});
    check("an after-press state is marked “shows after press”, indented under its control", (await after.count()) === 1 && /shows after press/.test(await after.innerText()));
    await page.screenshot({ path: ".screenshots/lane-e/element-list-after-press.png" });
  }
  /* Hover outlines, press picks and scrolls. */
  /* The list draws only the rows near view; take the lowest one fully in view, a part well down the page, and hold it by its id. */
  const id = await list.evaluate((el) => {
    const box = el.querySelector("[data-parts-list]").getBoundingClientRect();
    const seen = [...el.querySelectorAll("[data-list-row]:not([data-list-after])")].filter((r) => { const b = r.getBoundingClientRect(); return b.top >= box.top && b.bottom <= box.bottom; });
    return seen.at(-1)?.getAttribute("data-list-row");
  });
  const row = list.locator(`[data-list-row="${id}"]`);
  await row.hover();
  await page.waitForTimeout(300);
  check(`${site}: hovering a row outlines its part on the board`, (await page.locator(`[data-point-mark="${id}"]`).count()) >= 1);
  await row.locator("[data-element-row]").click();
  await page.waitForTimeout(1200);
  const inView = await page.evaluate((nid) => {
    const el = document.querySelector(`[data-node-id="${nid}"]`); const pane = el?.closest("[data-studio-pane]");
    if (!el || !pane) return false;
    const r = el.getBoundingClientRect(), p = pane.getBoundingClientRect();
    return r.bottom > p.top && r.top < p.bottom;
  }, id);
  const picked = await page.locator(`[data-node-id="${id}"][data-picked]`).count();
  check(`${site}: pressing a row picks the part and scrolls the board to it`, inView && picked === 1, `${id}: picked ${picked}, in view ${inView}`);
  /* Back to the list: search, and nesting. */
  /* Escape climbs one holder at a time, then lets go. */
  for (let i = 0; i < 12 && (await page.locator("[data-picked]").count()); i++) { await page.keyboard.press("Escape"); await page.waitForTimeout(400); }
  await side.getByRole("radio", { name: "Element" }).first().click({ force: true });
  await page.waitForTimeout(500);
  const search = side.locator("[data-element-search]");
  if (await search.count()) {
    const before = await side.locator("[data-list-row]").count();
    await search.fill(site === "gotchi-gg" ? "feed" : "BUY");
    await page.waitForTimeout(400);
    const names = await side.locator("[data-list-row] [data-element-row]").evaluateAll((es) => es.map((e) => e.querySelector("[data-list-name]").textContent + " " + (e.querySelector("[data-list-where]")?.textContent ?? "")));
    check(`${site}: the search box filters the list`, names.length > 0 && names.length <= before && names.every((n) => /feed|buy/i.test(n)), names.slice(0, 4).join(" · "));
    await search.fill("");
    await side.locator("[data-show-nesting]").click();
    await page.waitForTimeout(500);
    check(`${site}: Show nesting brings the tree back`, (await side.locator('[data-element-list="tree"] [data-tree-row]').count()) > 0);
    await side.locator("[data-show-nesting]").click();
  } else check(`${site}: the search box is there`, false);
}
await browser.close();

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
