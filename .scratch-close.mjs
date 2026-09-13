import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await b.newPage({ viewport: { width: 1400, height: 900 } });
await page.addInitScript(() => {
  const threads = [
    { id: "g0", at: 0, mode: "plan", state: "done", ask: "Lay out the home page", answer: "Done.", changes: ["changed the hero"], parentId: null },
    { id: "g1", at: 1, mode: "critique", state: "done", ask: "Tighten the spacing", answer: "Done.", changes: ["changed 2 things"], parentId: "g0" },
  ];
  const spots = { "box:g0": { x: 80, y: 120 }, "box:g1": { x: 420, y: 300 } };
  localStorage.setItem("builder.studio", JSON.stringify({ state: { threads, threadSpots: spots, openThreadId: null }, version: 0 }));
});
await page.goto("http://localhost:3000/builder", { waitUntil: "networkidle" });
await page.waitForTimeout(1300);
console.log("finish buttons:", await page.locator("[data-finish]").count(), "mode before:", await page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio")).state.mode));
await page.locator("[data-finish]").first().click();
await page.waitForTimeout(1500);
console.log("boxes:", await page.locator("[data-box]").count(), "timeline:", await page.locator("[data-timeline]").count());
await page.screenshot({ path: "/tmp/claude-0/-home-user-polio/fb344cad-9b89-5e7f-a8ae-35292fe91655/scratchpad/close-debug.png" });
const openId = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio")).state.openThreadId);
if (await page.locator('[data-box="g1"]').count()) {
  await page.locator('[data-box="g1"]').click({ force: true });
  await page.waitForTimeout(500);
  console.log("after box click, open:", await openId());
  const ground = await page.evaluate(() => {
    const r = document.querySelector("[data-timeline]").getBoundingClientRect();
    for (let y = r.top + 60; y < r.bottom - 40; y += 30) for (let x = r.left + 40; x < r.right - 40; x += 30) {
      const el = document.elementFromPoint(x, y);
      if (el && !el.closest("[data-box]") && !el.closest("[data-card]") && !el.closest("button") && el.closest("[data-timeline]")) return { x, y, tag: el.tagName + "." + String(el.className).slice(0, 30) };
    }
    return null;
  });
  console.log("ground", ground);
  await page.mouse.click(ground.x, ground.y); await page.waitForTimeout(400);
  console.log("after ground click, open:", await openId());
  await page.locator('[data-box="g1"]').click({ force: true }); await page.waitForTimeout(300);
  console.log("reopened:", await openId());
  const panel = await page.locator("[data-side-panel-timeline], [data-timeline-panel]").first().boundingBox().catch(() => null);
  if (panel) { await page.mouse.click(panel.x + 20, panel.y + panel.height - 20); await page.waitForTimeout(300); console.log("after panel click, open:", await openId()); }
  const bar = await page.locator("header").first().boundingBox().catch(() => null);
  if (bar) { await page.mouse.click(bar.x + bar.width * 0.45, bar.y + bar.height / 2); await page.waitForTimeout(300); console.log("after bar click, open:", await openId()); }
  const card = await page.locator('[data-card-of="g1"]').first().boundingBox().catch(() => null);
  console.log("card box", card && [Math.round(card.x), Math.round(card.y), Math.round(card.width), Math.round(card.height)]);
  if (card) { await page.mouse.click(card.x + card.width / 2, card.y + card.height / 2); await page.waitForTimeout(300); console.log("after card click, open:", await openId()); }
}
await b.close();
