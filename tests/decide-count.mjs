#!/usr/bin/env node
/**
 * ONE COUNT OF THE !, A QUIETER BAR, AND A LOOK TAB THAT SAYS ONE LINE.
 *
 * J's report (2026-10-05): the orange ! sat on nearly every part of an
 * imported page (nav links, buttons, the Buy and Sell circles) and covered
 * it; the top bar had about twenty small icons; the Look tab was a wall of
 * explanation. Held here:
 *   1. the board shows no ! until a part is picked, then only that part's;
 *   2. the top bar carries one count of them, and pressing it shows them all,
 *      pressing it again hides them, and that is kept across a reload;
 *   3. Wires, Updates, the part menu's edge and Capture a site are in More,
 *      not in the bar's row, and each still works from there;
 *   4. every explanation on the Look tab is one sentence with a "?" that
 *      shows the rest (`core/ui/more-hint.tsx`).
 *
 *   npm run build && npx next start -p 3013
 *   node tests/decide-count.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/states/decideShown.ts, src/features/studio/Canvas.tsx, src/features/studio/StudioPage.tsx, src/core/ui/more-hint.tsx, src/core/ui/split-hint.ts, src/features/studio/look/LookPanel.tsx, src/features/studio/SiteColours.tsx
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright-core");
const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const { createJiti } = await import("jiti");
const { splitHint } = await createJiti(import.meta.url).import(new URL("../src/core/ui/split-hint.ts", import.meta.url).pathname);
check("a hint splits at its first sentence", JSON.stringify(splitHint("One line. The rest, said later.")) === JSON.stringify(["One line.", "The rest, said later."]));
check("…and one sentence stays whole", JSON.stringify(splitHint("Left out: the page’s own colour.")) === JSON.stringify(["Left out: the page’s own colour.", ""]));

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route("**/api/studio/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1000);

const part = (id, x, y, label) => ({ id, pageId: "page_home", featureId: "cta-primary", label, prompt: "", content: label, data: "", x, y, w: 200, h: 48, groupId: null, options: {}, priority: "must", custom: false, link: null });
const nodes = [part("n1", 100, 100, "Play"), part("n2", 400, 100, "Buy"), part("n3", 700, 100, "Sell"), part("n4", 100, 300, "Leaderboard")];
await page.evaluate((d) => window.__studioLoadDoc(d), { pages: [{ id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }], nodes, brief: { name: "Count", gimmick: "", master: "" } });
await page.waitForTimeout(1200);

const badges = () => page.locator("[data-decide-for]").evaluateAll((els) => els.map((e) => e.getAttribute("data-decide-for")).sort());
const count = page.locator("[data-decide-count]");
check("no ! on the board with nothing picked", (await badges()).length === 0, JSON.stringify(await badges()));
check("the top bar counts the four", (await count.getAttribute("data-decide-count")) === "4" && /4/.test(await count.innerText()), await count.innerText().catch(() => "none"));

await page.locator('[data-node-id="n2"]').first().click({ force: true });
await page.waitForTimeout(500);
check("a picked part wears its own !, and only it", JSON.stringify(await badges()) === JSON.stringify(["n2"]), JSON.stringify(await badges()));
await page.keyboard.press("Escape");
await page.waitForTimeout(300);

await count.click();
await page.waitForTimeout(400);
check("pressing the count shows every !", JSON.stringify(await badges()) === JSON.stringify(["n1", "n2", "n3", "n4"]) && (await count.getAttribute("aria-pressed")) === "true", JSON.stringify(await badges()));
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1500);
check("…and that is kept across a reload", (await badges()).length === 4, JSON.stringify(await badges()));
await page.locator("[data-decide-count]").click();
await page.waitForTimeout(400);
check("pressing it again hides them", (await badges()).length <= 1, JSON.stringify(await badges()));

/* The bar. */
const inRow = await page.evaluate(() => {
  const bar = document.querySelector("[data-studio-bar]");
  const vis = (el) => { if (!el) return false; const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
  return { wires: vis(bar.querySelector("[aria-label='Toggle wires']")), updates: vis(bar.querySelector("[data-updates-toggle]")), edge: vis(bar.querySelector("[data-menu-shape]")), capture: vis(bar.querySelector("[data-capture-site]")), more: vis(bar.querySelector("[data-toolbar-more]")) };
});
check("Wires, Updates, the menu's edge and Capture are not in the bar's row", !inRow.wires && !inRow.updates && !inRow.edge && !inRow.capture, JSON.stringify(inRow));
check("…and More is, on a wide window", inRow.more);
await page.locator("[data-toolbar-more]").click();
await page.waitForTimeout(300);
const menu = page.locator("[data-toolbar-more-menu]");
check("More holds all four", (await menu.locator("[aria-label='Toggle wires'], [data-updates-toggle], [data-menu-shape], [data-capture-site]").count()) === 4);
const shape = await menu.locator("[data-menu-shape]").getAttribute("data-menu-shape");
await menu.locator("[data-menu-shape]").click();
await page.waitForTimeout(300);
check("the menu's edge still switches from More", (await page.locator("[data-menu-shape]").getAttribute("data-menu-shape")) !== shape);
await menu.locator("[data-capture-site]").click();
await page.waitForTimeout(500);
check("Capture a site still opens its dialog from More", (await page.locator("[data-capture-url]").count()) === 1);
await page.keyboard.press("Escape");
await page.waitForTimeout(300);

/* The Look tab. */
await page.evaluate(() => window.__studioSetLeftPanel?.("look"));
await page.waitForTimeout(700);
const panel = page.locator("[data-look-panel]");
const hints = await panel.locator("[data-more-hint]").evaluateAll((els) => els.map((e) => ({ state: e.getAttribute("data-more-hint"), text: e.textContent ?? "" })));
const long = await panel.locator("p").evaluateAll((els) => els.filter((p) => !p.querySelector("[data-more-hint]") && !p.closest("[data-more-hint]")).map((p) => (p.textContent ?? "").trim()).filter((t) => t.split(/[.!?]\s+/).filter(Boolean).length > 1 && t.length > 90));
check("the Look tab's explanations are cut to one line", hints.length >= 2 && /* three before the Texture rows went (1d680d3f); two are left */ hints.filter((h) => h.state === "shut").length >= 1, `${hints.length} hints, ${hints.filter((h) => h.state === "shut").length} with more behind a ?`);
check("…and no paragraph of two long sentences is left whole", long.length === 0, JSON.stringify(long.slice(0, 2)));
const first = panel.locator('[data-more-hint="shut"]').first();
const before = (await first.textContent()) ?? "";
await first.locator("[data-more-hint-toggle]").click();
await page.waitForTimeout(200);
const after = (await panel.locator('[data-more-hint="open"]').first().textContent()) ?? "";
check("the ? shows the rest", after.length > before.length + 10, `${before.length} → ${after.length} characters`);

check("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
