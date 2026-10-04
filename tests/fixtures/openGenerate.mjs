/**
 * Open the drawing tool where it lives now: the Pictures tab, with a part
 * picked so it draws for that part (tests/side-panel-h.mjs). A board with no
 * part on it is given one plain box first, so a test that wants "Put it on
 * this part" has a part to put it on. Returns the tool's panel.
 */
const box = (id) => ({
  id, pageId: "page_home", featureId: "box", label: "", prompt: "", content: "", data: "", x: 120, y: 120, w: 320, h: 200, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
});

export async function openGenerate(page) {
  if (!(await page.locator("[data-node-id]").count())) {
    await page.evaluate((b) => {
      const raw = localStorage.getItem("builder.studio");
      const d = raw ? JSON.parse(raw) : { state: {}, version: 0 };
      const s = d.state;
      s.pages = s.pages?.length ? s.pages : [{ id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }];
      b.pageId = s.activePageId ?? s.pages[0].id;
      s.nodes = [...(s.nodes ?? []), b];
      s.activePageId = b.pageId;
      localStorage.setItem("builder.studio", JSON.stringify(d));
    }, box("gen_box"));
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
  }
  const part = page.locator("[data-node-id]").first();
  await part.scrollIntoViewIfNeeded().catch(() => {});
  await part.click({ force: true });
  await page.waitForTimeout(500);
  await page.locator("[data-side-panel] [role=radio]").filter({ hasText: "Pictures" }).first().click({ force: true });
  await page.waitForTimeout(400);
  return page.locator("[data-pictures-panel] [data-render-panel]").first();
}
