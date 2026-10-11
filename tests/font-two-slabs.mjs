/**
 * THE FONT EDITOR ON A CUBE KEEPS ITS FAMILY OFF THE SPACING AND LINE HEIGHT.
 *
 * A right press on a part, then Edit and Font, opens the type editor: size
 * and weight on one screen, letter spacing and line height on the next, the
 * family as a readout with arrows on a third. BEFORE this, a cube (or a
 * solid) had a fifth choice under Edit ("Make it a solid" / "Back to the
 * cube"), so the green level took a second quadrant and the editor got two
 * screens, not three. FontQuads put the family on the second one anyway: the
 * Family stepper sat across the Letter spacing slider and the top of Line
 * height, and its "Family" caption was printed on top of "0em · 1.55"
 * (dissect #22).
 *
 * NOW, on two screens, line height is as thin as spacing and sits just past
 * the middle, the stepper sits by the far edge clear of both, and only one
 * caption is drawn per screen. On an ordinary part (three screens) nothing
 * moved: the family has its own screen and its own caption.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/font-two-slabs.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/RingEditors.tsx, src/features/studio/radial/RadialMenu.tsx, src/features/studio/radial/choices.ts, src/features/studio/radial/ring.tsx
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright-core");
const URL_ = (process.argv[2] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const node = (id, x, y, extra = {}) => ({
  id, pageId: "page_home", featureId: "prose", label: id, prompt: "", content: `Words of ${id}`, data: "", x, y, w: 260, h: 90, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null, anim: null, animSpeed: 1, animDelay: 0,
  animEase: "smooth", shape: null, outline: null, kind: null, vector: null, role: null, cube: null, mesh: null, code: null, aura: null, auraSize: 1,
  auraStyle: "glow", texture: null, sketch: null, ...extra,
});
const doc = {
  pages: [{ id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [node("a", 300, 300), node("k", 800, 400, { featureId: "cube-3d", w: 200, h: 200 })],
  groups: [], shapes: [], format: {}, brief: { name: "FONT", gimmick: "", master: "" }, activePageId: "page_home", frameWidth: 1440,
};

const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.route("**/api/studio/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle", timeout: 120_000 });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle", timeout: 120_000 });
await page.waitForTimeout(1500);
await page.evaluate((d) => window.__studioLoadDoc(d), doc);
await page.waitForTimeout(1200);
const nodesNow = async () => Object.fromEntries((await page.evaluate(() => window.__studioPublishDoc().nodes)).map((n) => [n.id, n]));
const radialEl = page.locator("[data-radial]");
/* A piece is found by its word, or by its name when it wears an icon only (Edit, on the inner band). */
const into = async (...words) => {
  for (const w of words) {
    let el = radialEl.getByText(new RegExp(`^${w}$`)).first();
    if (!(await el.count())) el = radialEl.locator(`[aria-label="${w}"]`).first();
    if (await el.count()) { await el.click({ force: true }); await page.waitForTimeout(600); }
  }
};
const openOn = async (id, ...words) => {
  const b = await page.locator(`[data-node-id="${id}"]`).first().boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2, { button: "right" });
  await page.waitForTimeout(700);
  await into(...words);
};
const close = async () => {
  for (let i = 0; i < 4 && (await page.locator("[data-radial]").count()); i++) { await page.keyboard.press("Escape"); await page.waitForTimeout(300); }
};
/** Where the Font editor's controls and captions landed on screen. */
const layout = () => page.evaluate(() => {
  const box = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
  const ed = document.querySelector("[data-radial-editor]");
  return {
    solid: Array.from(document.querySelectorAll("[data-radial] *")).some((e) => /^(Make it a solid|Back to the cube)$/.test(e.textContent ?? "")),
    stepper: box('[data-arc-stepper="Family"]'),
    spacing: box('[data-arc-slider="Letter spacing"]'),
    line: box('[data-arc-slider="Line height"]'),
    size: box('[data-arc-slider="Size"]'),
    weight: box('[data-arc-slider="Weight"]'),
    captions: Array.from(ed?.querySelectorAll("[data-arc-caption] text") ?? []).map((t) => { const r = t.getBoundingClientRect(); return { text: t.textContent, x: r.x, y: r.y, w: r.width, h: r.height }; }),
  };
});
const meets = (p, q) => !!p && !!q && p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h;
const at = (b) => (b ? `${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.w)}x${Math.round(b.h)}` : "none");
const captionsApart = (cs) => cs.every((c, i) => cs.every((d, j) => j <= i || !meets(c, d)));

/* A cube: Edit has five choices, so Font gets two screens */
await openOn("k", "Edit", "Font");
let l = await layout();
check("on a cube, Edit has its fifth choice, so the editor gets two screens", l.solid === true);
check("all four type controls are there", !!(l.stepper && l.spacing && l.line && l.size && l.weight),
  `stepper ${at(l.stepper)}, spacing ${at(l.spacing)}, line ${at(l.line)}, size ${at(l.size)}, weight ${at(l.weight)}`);
check("the Family stepper is clear of the Letter spacing slider", !meets(l.stepper, l.spacing), `stepper ${at(l.stepper)} / spacing ${at(l.spacing)}`);
check("…and of the Line height slider", !meets(l.stepper, l.line), `stepper ${at(l.stepper)} / line ${at(l.line)}`);
check("no caption is printed over another", l.captions.length >= 2 && captionsApart(l.captions), l.captions.map((c) => `${c.text}@${at(c)}`).join(" | "));
let before = (await nodesNow()).k.font;
await page.locator('[aria-label="Next Family"]').first().click({ force: true });
await page.waitForTimeout(400);
let after = (await nodesNow()).k.font;
check("pressing Next Family changes the cube's type", !!after && (after.family ?? after.face ?? "") !== (before?.family ?? before?.face ?? ""), `${JSON.stringify(before)} → ${JSON.stringify(after)}`);
await close();

/* An ordinary part: three screens, as before */
await openOn("a", "Edit", "Font");
l = await layout();
check("on a prose part there is no fifth choice", l.solid === false);
check("the Family stepper is on a screen of its own, clear of both sliders", !!l.stepper && !meets(l.stepper, l.spacing) && !meets(l.stepper, l.line),
  `stepper ${at(l.stepper)} / spacing ${at(l.spacing)} / line ${at(l.line)}`);
check("three captions, the family's among them, none over another", l.captions.length === 3 && l.captions.some((c) => /family/i.test(c.text ?? "")) && captionsApart(l.captions),
  l.captions.map((c) => `${c.text}@${at(c)}`).join(" | "));
before = (await nodesNow()).a.font;
await page.locator('[aria-label="Next Family"]').first().click({ force: true });
await page.waitForTimeout(400);
after = (await nodesNow()).a.font;
check("…and Next Family still changes the part's type", !!after && (after.family ?? after.face ?? "") !== (before?.family ?? before?.face ?? ""), `${JSON.stringify(before)} → ${JSON.stringify(after)}`);
await close();

await browser.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
