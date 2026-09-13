/**
 * The four ways a person reaches a space.
 *
 * `createSpace.ts` and the space tool's drawing were built and pushed with
 * no way in: the tool was in the store's `Tool` type and nothing in the bar
 * or the menus could select it, and `createSpaceAt` had no caller. Every
 * check that could be written about spaces had to seed the store instead of
 * driving the Builder, which proves the drawing and nothing about whether
 * anybody can get to it.
 *
 * So this drives all four, by hand, and asks the store afterwards what
 * arrived — the entry points are the subject, so the store is the answer
 * here rather than the setup:
 *
 *   · the tool picker in the bar
 *   · the Tool submenu on the canvas
 *   · the key
 *   · Create, on the canvas menu and on the background's wheel
 *
 *   node tests/space-entries.mjs [url]     # default http://localhost:3000
 */
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_ = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);

/** How many spaces are on the page, counted on screen rather than in the store. */
const spaces = () => page.locator("[data-space]").count();

/** Which tool the bar says is picked. The trigger wears it: "Tool: Erase". */
const toolSaid = async () => ((await page.locator("[data-tool-picker]").getAttribute("aria-label")) ?? "").replace(/^Tool:\s*/, "");

/** Open the bar's tool dropdown and press one of its entries by name. */
const pickTool = async (name) => {
  await page.locator("[data-tool-picker]").click({ force: true });
  await page.waitForTimeout(300);
  const entry = page.getByRole("menuitemcheckbox", { name }).first();
  const there = await entry.count();
  if (there) { await entry.click({ force: true }); await page.waitForTimeout(350); }
  else { await page.keyboard.press("Escape"); await page.waitForTimeout(200); }
  return there > 0;
};

/* ------------------------------------------------------------------ */
/* 1. The bar                                                           */
/* ------------------------------------------------------------------ */

await page.locator("[data-tool-picker]").click({ force: true });
await page.waitForTimeout(350);
/* The entries carry their shortcut in the same text node, so "Draw a space"
   comes back as "Draw a spaceS". Trimmed for the report, matched loosely. */
const listed = (await page.getByRole("menuitemcheckbox").allTextContents()).map((t) => t.replace(/[A-Z]$/, ""));
await page.keyboard.press("Escape");
await page.waitForTimeout(250);
check("the bar's tool picker offers a fifth tool", listed.length >= 5, `${listed.length}: ${listed.join(", ")}`);
check("and one of them is the space", listed.some((t) => /space/i.test(t)), listed.find((t) => /space/i.test(t)) ?? "no space in the list");

check("picking it from the bar selects it", await pickTool(/space/i) && /space/i.test(await toolSaid()), `the bar now says "${await toolSaid()}"`);

/* ------------------------------------------------------------------ */
/* 2. The key                                                           */
/* ------------------------------------------------------------------ */

await pickTool(/select/i);
await page.waitForTimeout(250);
check("something else is picked first, so the key has work to do", !/space/i.test(await toolSaid()), await toolSaid());
await page.mouse.move(750, 500);
await page.keyboard.press("s");
await page.waitForTimeout(400);
check("the key reaches it too", /space/i.test(await toolSaid()), `the bar now says "${await toolSaid()}"`);

/* ------------------------------------------------------------------ */
/* 3. Drawing one by hand                                               */
/* ------------------------------------------------------------------ */

const before = await spaces();
const frame = await page.locator("[data-frame]").first().boundingBox();
/* A closed loop inside the frame: round to where it started, because an open
   line is not a space and the tool says so. */
const cx = frame.x + frame.width * 0.5, cy = frame.y + frame.height * 0.45, r = 90;
const at = (t) => [cx + Math.cos(t) * r, cy + Math.sin(t) * r];
await page.mouse.move(...at(0));
await page.mouse.down();
for (let i = 1; i <= 40; i++) { await page.mouse.move(...at((i / 40) * Math.PI * 2)); await page.waitForTimeout(6); }
await page.mouse.move(...at(0));
await page.mouse.up();
await page.waitForTimeout(700);
const drawn = await spaces();
check("a closed line drawn with it lands a space", drawn === before + 1, `${before} → ${drawn} on the page`);

/* ------------------------------------------------------------------ */
/* 4. Create, on the canvas menu                                        */
/* ------------------------------------------------------------------ */

await pickTool(/select/i);
/* Off the frame. A right-press *on* the frame is the background's wheel; the
   app's own canvas menu is the ground around it, which is where "Drop a new
   idea here" and "Pin a note here" already live. */
await page.mouse.click(Math.max(12, frame.x - 120), frame.y + 200, { button: "right" });
await page.waitForTimeout(600);
const entry = page.getByText(/Create a space here/i).first();
const onMenu = await entry.count();
check("the canvas menu offers Create beside the other two things a press puts down", onMenu > 0,
  onMenu ? "beside Drop a new idea here and Pin a note here" : "not there");
if (onMenu) {
  const was = await spaces();
  await entry.click({ force: true });
  await page.waitForTimeout(700);
  check("and it lands one", (await spaces()) === was + 1, `${was} → ${await spaces()} on the page`);
}
await page.keyboard.press("Escape");
await page.waitForTimeout(300);

/* ------------------------------------------------------------------ */
/* 5. Create, on the background's wheel                                 */
/* ------------------------------------------------------------------ */

await page.mouse.click(frame.x + frame.width * 0.7, frame.y + frame.height * 0.8, { button: "right" });
await page.waitForTimeout(650);
const wheel = page.locator("[data-radial]");
check("right-pressing the bare page opens the background's wheel", (await wheel.count()) > 0);
if (await wheel.count()) {
  /* The inner slabs wear an icon, not a word — the word is the label — so
     they are reached by the slab rather than by its text. */
  const edit = wheel.locator('[data-shard="edit"]').first();
  check("the wheel has Edit on it", (await edit.count()) > 0, await edit.getAttribute("aria-label"));
  if (await edit.count()) {
    await edit.click({ force: true });
    await page.waitForTimeout(700);
    const create = wheel.locator('[data-shard="create"]').first();
    check("and Create under it", (await create.count()) > 0, await create.getAttribute("aria-label"));
    if (await create.count()) {
      const was = await spaces();
      await create.click({ force: true });
      await page.waitForTimeout(800);
      check("pressing it lands a space", (await spaces()) === was + 1, `${was} → ${await spaces()} on the page`);
      check("and closes the wheel, so the space is not hidden behind it", (await page.locator("[data-radial]").count()) === 0);
    }
  }
}

await browser.close();
console.log("");
const failed = results.filter((r) => !r).length;
console.log(`${results.length - failed} of ${results.length} hold${failed ? `, ${failed} FAILED` : ""}`);
process.exit(failed ? 1 : 0);
