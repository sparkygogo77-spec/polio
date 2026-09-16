/**
 * Letting go lets go.
 *
 * He dragged the timeline and sometimes it stayed on the mouse after he
 * released. A drag ended only on a pointer-up that reached the window: a
 * release outside the window, or a drag the browser cancelled midway,
 * left the box or the ground stuck to the pointer until the next click.
 * Now the pressed thing captures the pointer and a cancel ends the drag
 * as a release does. Proven here by cancelling a drag in the middle and
 * moving the mouse on: nothing follows it.
 *
 *   node tests/drag-lets-go.mjs [url]
 */
import { createRequire } from "node:module";
const req = createRequire(import.meta.url);
const { chromium } = req(process.env.PLAYWRIGHT_MODULE ?? "/opt/node22/lib/node_modules/playwright");
const URL_ = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const results = [];
const check = (name, ok, detail = "") => { results.push(!!ok); console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => {
  const doc = JSON.parse(localStorage.getItem("builder.studio") ?? '{"state":{},"version":0}');
  const st = doc.state;
  st.threads = [
    { id: "g0", at: 1, mode: "plan", state: "done", ask: "Lay out the home page", answer: "Done.", changes: ["laid out the home page"], parentId: null },
    { id: "g1", at: 2, mode: "build", state: "done", ask: "Build the pricing band", answer: "Built.", changes: ["built the pricing band"], parentId: "g0" },
  ];
  st.threadSpots = {}; st.openThreadId = null;
  localStorage.setItem("builder.studio", JSON.stringify(doc));
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.locator("[data-finish]").first().click();
await page.waitForTimeout(1500);

const boxAt = () => page.locator('[data-box="g1"]').evaluate((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y }; });
const cancel = () => page.evaluate(() => { window.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true, pointerId: 1 })); });

/* A box: pressed, carried, the drag cancelled midway, the mouse moved on. */
const b0 = await boxAt();
await page.mouse.move(b0.x + 40, b0.y + 12);
await page.mouse.down();
await page.mouse.move(b0.x + 140, b0.y + 62, { steps: 8 });
await page.waitForTimeout(100);
const b1 = await boxAt();
check("a box follows the mouse while it is held", Math.abs(b1.x - b0.x - 100) < 8 && Math.abs(b1.y - b0.y - 50) < 8, `moved ${Math.round(b1.x - b0.x)}, ${Math.round(b1.y - b0.y)}`);
await cancel();
/* The drop settles the view, as any drop does; the box is read once that is over, and then the mouse moves on. */
await page.waitForTimeout(900);
const b1b = await boxAt();
await page.mouse.move(b0.x + 340, b0.y + 262, { steps: 8 });
await page.waitForTimeout(300);
const b2 = await boxAt();
check("when the drag is cancelled midway the box lets go: the mouse moves on and the box does not follow", Math.abs(b2.x - b1b.x) < 2 && Math.abs(b2.y - b1b.y) < 2, `after the cancel the mouse moved 200 more and the box moved ${Math.round(b2.x - b1b.x)}, ${Math.round(b2.y - b1b.y)}`);
await page.mouse.up();
await page.waitForTimeout(300);

/* The ground: the same. */
const pane = await page.locator("[data-timeline]").first().evaluate((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
const g0 = await boxAt();
await page.mouse.move(pane.x + pane.w - 60, pane.y + 40);
await page.mouse.down();
await page.mouse.move(pane.x + pane.w - 160, pane.y + 100, { steps: 8 });
await page.waitForTimeout(100);
const g1 = await boxAt();
check("the ground pans while it is held", Math.abs(g1.x - g0.x + 100) < 3 && Math.abs(g1.y - g0.y - 60) < 3, `panned ${Math.round(g1.x - g0.x)}, ${Math.round(g1.y - g0.y)}`);
await cancel();
await page.waitForTimeout(100);
await page.mouse.move(pane.x + pane.w - 360, pane.y + 300, { steps: 8 });
await page.waitForTimeout(300);
const g2 = await boxAt();
check("when the pan is cancelled midway the ground lets go", Math.abs(g2.x - g1.x) < 3 && Math.abs(g2.y - g1.y) < 3, `after the cancel the mouse moved 200 more and the view moved ${Math.round(g2.x - g1.x)}, ${Math.round(g2.y - g1.y)}`);
await page.mouse.up();

/* And an ordinary release still puts the box down where it was let go, and it stays put as the mouse moves on. */
const c0 = await boxAt();
await page.mouse.move(c0.x + 40, c0.y + 12);
await page.mouse.down();
await page.mouse.move(c0.x + 120, c0.y + 12, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(900);
const c1 = await boxAt();
await page.mouse.move(c0.x + 400, c0.y + 200, { steps: 4 });
await page.waitForTimeout(300);
const c2 = await boxAt();
check("an ordinary release puts the box down, and it stays put as the mouse moves on", Math.abs(c2.x - c1.x) < 2 && Math.abs(c2.y - c1.y) < 2, `after the drop the mouse moved 300 more and the box moved ${Math.round(c2.x - c1.x)}, ${Math.round(c2.y - c1.y)}`);

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed === results.length ? "all good" : "FAILED"} — ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
