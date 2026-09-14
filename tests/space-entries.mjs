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
/* Off the frame *and* off the side panel. A right-press on the frame is the
   background's wheel; the app's own canvas menu is the ground around it. The
   frame grew when the workspace became a scroller, so the point is derived
   from where the frame actually is rather than assumed. */
const bare = await page.evaluate(() => {
  const f = document.querySelector("[data-frame]").getBoundingClientRect();
  const mid = document.querySelector("[data-studio-scroll]").getBoundingClientRect();
  return { x: Math.round((mid.x + f.x) / 2), y: Math.round(f.y + f.height / 2) };
});
await page.mouse.click(bare.x, bare.y, { button: "right" });
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
/* 5. Draw and Create, side by side on the wheel's outer ring           */
/* ------------------------------------------------------------------ */

/*
 * Create space asked for these two together, and together is the point: Draw
 * makes one element and Create sets an area aside for several, so a person
 * choosing between them has to see both at once. Neither is ever a mode the
 * other replaces.
 */
{
  const fr = await page.locator("[data-frame]").first().boundingBox();
  await page.mouse.click(fr.x + fr.width * 0.4, fr.y + fr.height * 0.6, { button: "right" });
  await page.waitForTimeout(650);
  const wheel = page.locator("[data-radial]");
  const draw = wheel.locator('[data-shard="draw"]');
  const make = wheel.locator('[data-shard="create"]');
  check("the page's wheel carries Draw and Create at once",
    (await draw.count()) === 1 && (await make.count()) === 1,
    `${await draw.count()} Draw, ${await make.count()} Create`);
  if ((await draw.count()) && (await make.count())) {
    /*
     * Both on the outer ring — measured as distance from the wheel's middle,
     * not as a shared y. They are two halves of a quadrant *arc*: one comes
     * out wide and short and the other tall and narrow, because they sit at
     * different angles round the same band. Checking that their boxes lined
     * up horizontally was checking for a row, which is not what a ring is.
     */
    const band = await wheel.evaluate((w) => {
      /* The band each slab spans, off its own path, from the wheel's own
         middle. A bounding box will not do: an arc segment's box centre is
         not on the arc — it is pulled towards the corner the arc bends
         round, which is why Draw measured 65 from the middle and Create 112
         when both sit on the same ring. */
      const svg = w.querySelector("svg");
      const box = svg.getBoundingClientRect();
      const cx = box.width / 2, cy = box.height / 2;
      const read = (id) => {
        const el = w.querySelector(`[data-shard="${id}"]`);
        if (!el || !el.getTotalLength) return null;
        const n = 24, len = el.getTotalLength();
        let lo = Infinity, hi = -Infinity;
        for (let i = 0; i <= n; i++) {
          const pt = el.getPointAtLength((i / n) * len);
          const d = Math.hypot(pt.x - cx, pt.y - cy);
          lo = Math.min(lo, d); hi = Math.max(hi, d);
        }
        return { lo: Math.round(lo), hi: Math.round(hi) };
      };
      return { draw: read("draw"), create: read("create") };
    });
    check("both span the same ring, in from the same edge and out to it",
      !!band.draw && !!band.create && Math.abs(band.draw.lo - band.create.lo) < 12 && Math.abs(band.draw.hi - band.create.hi) < 12,
      band.draw ? `Draw ${band.draw.lo}–${band.draw.hi}, Create ${band.create.lo}–${band.create.hi}` : "no path to read");
    const a = await draw.boundingBox();
    const b = await make.boundingBox();
    check("and they are two slabs, not one", Math.hypot(a.x - b.x, a.y - b.y) > 20);
    check("Draw says Draw and Create says Create",
      (await draw.getAttribute("aria-label")) === "Draw" && (await make.getAttribute("aria-label")) === "Create",
      `${await draw.getAttribute("aria-label")} · ${await make.getAttribute("aria-label")}`);
    const was = await spaces();
    await make.click({ force: true });
    await page.waitForTimeout(800);
    check("pressing Create lands a space", (await spaces()) === was + 1, `${was} → ${await spaces()} on the page`);
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
}

/*
 * There is no "Create under Edit" any more, and that is on purpose.
 *
 * It lived there while the outer ring had no room for it. The ring has room
 * now — Draw and Create are halves of the top quadrant — and Edit itself has
 * gone, because the width it held is the third copy of a control the bar and
 * the canvas menu both carry. One way in is the point; two was the stopgap.
 */
{
  const fr2 = await page.locator("[data-frame]").first().boundingBox();
  await page.mouse.click(fr2.x + fr2.width * 0.55, fr2.y + fr2.height * 0.45, { button: "right" });
  await page.waitForTimeout(700);
  const made = await page.locator('[data-radial] [data-shard="create"]').count();
  const ed = await page.locator('[data-radial] [data-shard="edit"]').count();
  check("Create is on the ring and not hidden under a group as well", made === 1 && ed === 0,
    `${made} Create, ${ed} Edit`);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
}

await browser.close();
console.log("");
const failed = results.filter((r) => !r).length;
console.log(`${results.length - failed} of ${results.length} hold${failed ? `, ${failed} FAILED` : ""}`);
process.exit(failed ? 1 : 0);
