/**
 * THE LOOK PANEL HAS NO BACKGROUND HEADER, AND THE PAGE IS STILL PAINTED.
 *
 * His words: remove from the Look side panel the "Background / The page
 * behind every part" block — its scissors, its "page colour" chip, and the
 * line "Painted flat. The fill and the layers are one stack, at the foot of
 * this panel." The block only pointed at the stack; the stack stays, and so
 * do the two ways to cut and put back the background that are not the
 * block: the page's own wheel and ⌘X / ⌘V.
 *
 *   node tests/look-no-background-head.mjs http://127.0.0.1:3013
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright-core");
const URL_ = (process.argv[2] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const bare = (f) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/^\s*\/\/.*$/gm, "");

/* Nothing else leans on the block: no other file renders it or reads its mark. */
const look = bare("src/features/studio/look/LookPanel.tsx");
check("the Look panel no longer renders the Background block", !/BackgroundInspector/.test(look));
check("and nothing else exports or renders it", !/BackgroundInspector/.test(["Inspector.tsx", ...readdirSync("src/features/studio/panels/inspector").filter((f) => f.endsWith(".tsx")).map((f) => `inspector/${f}`)].map((f) => bare(`src/features/studio/panels/${f}`)).join("\n")));

const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
await page.route("**/api/studio/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.evaluate(() => window.__studioSetLeftPanel?.("look"));
await page.waitForTimeout(700);
const panel = page.locator("[data-look-panel]");
check("the Look panel is open", (await panel.count()) === 1);

const txt = (await panel.innerText()).replace(/\s+/g, " ");
check("no \"Background\" heading and no \"The page behind every part\"", !/The page behind every part/.test(txt) && !(await panel.locator("[data-look-heading]", { hasText: /^Background$/ }).count()), txt.slice(0, 80));
check("no scissors in the panel", (await panel.getByRole("button", { name: "Cut the background" }).count()) === 0);
check("no \"page colour\" chip", !/page colour/i.test(txt));
check("no \"Painted flat … one stack, at the foot of this panel\"", !/Painted (flat|with)/.test(txt) && !/one stack, at the foot of this panel/.test(txt));
check("no [data-background-inspector] anywhere", (await page.locator("[data-background-inspector]").count()) === 0);

/* The fill and the layers still work, at the foot of the panel. */
check("the fill swatches are still in the stack", (await page.locator("[data-look-fill] button").count()) === 4);
/* Pressed from the page itself: the stack is at the foot of a scrolling panel, below the fold at this size. */
await page.locator('[data-look-fill] button[aria-label="Mesh"]').first().evaluate((b) => b.click());
await page.waitForTimeout(700);
const img = await page.evaluate(() => getComputedStyle(document.querySelector("[data-frame]")).backgroundImage);
check("choosing a fill still paints the page", /radial-gradient/.test(img), img.slice(0, 60));
const layers = page.locator("[data-look-texture] button");
const n = await layers.count();
for (let i = 4; i < n; i++) {
  await layers.nth(i).evaluate((b) => b.click());
  await page.waitForTimeout(600);
  if (await page.locator('[data-look-texture] [aria-label="Remove layer"]').count()) break;
}
check("a texture layer can still be added to the page", (await page.locator('[data-look-texture] [aria-label="Remove layer"]').count()) > 0);

/* Cut and put back are still reachable: the page's wheel, and the keys. */
const frame = await page.locator("[data-frame]").first().boundingBox();
await page.mouse.click(frame.x + 300, frame.y + 300, { button: "right" });
await page.waitForTimeout(700);
const wheel = await page.evaluate(() => [...document.querySelectorAll("button, [role=button], [aria-label]")].map((e) => e.getAttribute("aria-label") || e.textContent.trim()).filter(Boolean));
check("the page's wheel still offers Strip and Put the background back", wheel.some((w) => /Strip/.test(w)) && wheel.some((w) => /Put the background back/.test(w)),
  wheel.filter((w) => /Strip|background/i.test(w)).join(" | ") || "neither");
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
const fillOf = () => page.evaluate(() => window.__studioPublishDoc?.().format?.["palette.background"] ?? null);
const had = await fillOf();
await page.mouse.click(frame.x + 300, frame.y + 300);
await page.waitForTimeout(300);
await page.keyboard.press("Control+x");
await page.waitForTimeout(500);
const cut = await fillOf();
check("⌘X on the picked page still strips it", /mesh/.test(had) && !/mesh/.test(String(cut)), `${had} → ${cut}`);
await page.keyboard.press("Control+v");
await page.waitForTimeout(500);
const back = await fillOf();
check("and ⌘V puts it back", /mesh/.test(String(back)), String(back));

await browser.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
