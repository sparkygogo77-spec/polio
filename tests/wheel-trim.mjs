/**
 * Three of J's wheel items, and each one is a slot earning its place.
 *
 * SCISSORS. "Cut the background" on the canvas menu and "Strip" on the
 * page's wheel called the same function — `cutBackground()`, literally the
 * one function, which takes the background bare and holds it for a paste.
 * Two names for one thing is two places to learn and one to be surprised
 * by. Cut goes; Strip keeps the job; ⌘X still reaches it through the
 * board's own keys, and "Put the background back" still works because the
 * clipboard Strip fills is the one it reads.
 *
 * THE THREE-DOT. It was never a menu of its own: `choicesOf` returned
 * `tray.map(...)` — the tray's items, verbatim, with the same handlers —
 * and the tray is drawn under the wheel already. The page lost it a while
 * back; the part kept it for no reason anybody could name.
 *
 * THE ANIMATION BUTTON. It opened one dead item, "Motion asset (soon)",
 * which played a tap and did nothing, so a quadrant of the page's wheel
 * said "not yet". The texture stack already knew how to move — `drift`
 * carries a tile a whole number of tiles along its own angle per cycle —
 * and nothing drove it. It drives it now.
 *
 *   node tests/wheel-trim.mjs [url]
 */
import { readFileSync } from "node:fs";

/* Same reason as `code` below: the comment left where Cut was names it. */
const code2 = (f) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
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

/* The duplication is a fact about the source, so it is read there: if a
   second caller of `cutBackground` ever comes back, this says so. */
const menu = code2("src/features/studio/index.ts");
check("the canvas menu no longer offers Cut the background",
  !/Cut the background/.test(menu));
check("but ⌘X still reaches it, so nothing was taken away",
  /cutBackground\(\)/.test(menu), "the board's own key handling still calls it");
check("and Put the background back is still there",
  /Put the background back/.test(menu));

/* Comments stripped first. The prose explaining the removal says
   `tray.map(...)` in so many words, and a raw scan read its own commit
   message as the thing it was looking for. */
const code = (f) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const wheel = ["RadialMenu.tsx", ...["open.ts", "choices.ts", "RadialMenu.tsx", "ring.tsx"].map((f) => `radial/${f}`)].map((f) => `src/features/studio/${f}`).map(code).join("\n");
check("no slot is called More any more", !/more: \{ id: "more"/.test(wheel));
check("and nothing maps the tray into the wheel a second time",
  !/g === "more"/.test(wheel) && !/tray\.map\(/.test(wheel));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1700);

/* ------------------------------------------------------------------ */
/* The part's wheel                                                     */
/* ------------------------------------------------------------------ */

/* A part to open a wheel on: the shelf's tiles are behind shut categories,
   so a category is opened first. An empty board has nothing to press. */
await page.locator("[data-drawer] button").first().click({ force: true });
await page.waitForTimeout(700);
await page.locator("[data-drawer] [draggable=true]").first().click({ force: true });
await page.waitForTimeout(900);
const part = page.locator("[data-node-id]").first();
check("there is a part to open a wheel on", await part.count() === 1);
const pb = await part.boundingBox();
await page.mouse.click(pb.x + pb.width / 2, pb.y + pb.height / 2, { button: "right" });
await page.waitForTimeout(700);
const onPart = await page.locator("[data-radial] [data-shard]").evaluateAll((els) =>
  els.map((e) => ({ id: e.getAttribute("data-shard"), label: e.getAttribute("aria-label") })));
check("the part's wheel opens", onPart.length > 0, onPart.map((s) => s.label).join(" · "));
check("and the three-dot has gone from it too",
  !onPart.some((s) => s.id === "more"), onPart.map((s) => s.label).join(" · "));
/* Nothing is left as a sliver when a third of a band becomes a half. */
const slivers = await page.locator("[data-radial] [data-shard]").evaluateAll((els) =>
  els.map((e) => Math.round(e.getTotalLength ? e.getTotalLength() : 0)));
check("and no slab was left a sliver by the re-cut", slivers.every((n) => n > 80), slivers.join(", "));
await page.keyboard.press("Escape");
await page.waitForTimeout(400);

/* ------------------------------------------------------------------ */
/* The page's wheel: Motion drives the texture                          */
/* ------------------------------------------------------------------ */

/* On its own page: the part added above sits near the top of the frame, and
   a right press that lands on a part opens the part's wheel, not the
   page's. The first run of this did exactly that and reported the page's
   Motion slab missing when it was the click that was wrong. */
await page.close();
const clean = await browser.newPage({ viewport: { width: 1500, height: 950 } });
await clean.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await clean.evaluate(() => localStorage.removeItem("builder.studio"));
await clean.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await clean.waitForTimeout(1700);
const frame = await clean.locator("[data-frame]").boundingBox();
await clean.mouse.click(frame.x + frame.width / 2, frame.y + 60, { button: "right" });
await clean.waitForTimeout(700);
const onPage = await clean.locator("[data-radial] [data-shard]").evaluateAll((els) =>
  els.map((e) => ({ id: e.getAttribute("data-shard"), label: e.getAttribute("aria-label") })));
check("the page's wheel has a Motion slab", onPage.some((s) => s.id === "anim"),
  onPage.map((s) => s.label).join(" · "));
await clean.locator('[data-radial] [data-shard="anim"]').click({ force: true });
await clean.waitForTimeout(700);
const under = await clean.locator("[data-radial] [data-shard]").evaluateAll((els) =>
  els.map((e) => e.getAttribute("aria-label")).filter(Boolean));
check("it opens Glide, not a placeholder", under.includes("Glide"), under.join(" · "));
check("and nothing on it still says soon",
  !under.some((t) => /soon/i.test(t)), under.filter((t) => /soon/i.test(t)).join(" · ") || "none");

/*
 * And it drives the texture, which is the whole of the claim. A label that
 * says Glide over a control that moves nothing is the placeholder again
 * with a better name on it.
 */
/*
 * The empty state, on a page that is genuinely bare. The Builder ships with
 * a texture on the page, so the default document is not it — the first run
 * of this check called the message missing when the page simply had
 * something to move.
 */
await clean.evaluate(() => {
  const raw = localStorage.getItem("builder.studio");
  const d = raw ? JSON.parse(raw) : { state: {}, version: 0 };
  d.state.look = { ...(d.state.look ?? {}), texture: [] };
  localStorage.setItem("builder.studio", JSON.stringify(d));
});
await clean.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await clean.waitForTimeout(1600);
{
  const f0 = await clean.locator("[data-frame]").boundingBox();
  await clean.mouse.click(f0.x + f0.width / 2, f0.y + 60, { button: "right" });
  await clean.waitForTimeout(600);
  await clean.locator('[data-radial] [data-shard="anim"]').click({ force: true });
  await clean.waitForTimeout(600);
  await clean.locator('[data-radial] [data-shard="bg-glide"]').click({ force: true });
  await clean.waitForTimeout(700);
  /* Case-insensitively: the caption is uppercased in CSS, and `innerText`
     gives you the rendered casing, so an exact match read a message that was
     plainly on screen as missing. */
  const empty = await clean.evaluate(() => /nothing is painted on the page yet/i.test(document.body.innerText));
  check("with a bare page it says there is nothing to move, rather than a dead slider", empty);
}

/* Now give the page a texture and do it again. */
await clean.evaluate(() => {
  const raw = localStorage.getItem("builder.studio");
  const d = raw ? JSON.parse(raw) : { state: {}, version: 0 };
  d.state.look = d.state.look ?? {};
  d.state.look.texture = [{
    id: "tx_test", kind: "dots", role: "accent", scale: 24, angle: 45, opacity: 0.2, contrast: 0.5,
    blend: "normal", hue: 0, target: "page", on: true, drift: 0,
  }];
  localStorage.setItem("builder.studio", JSON.stringify(d));
});
await clean.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await clean.waitForTimeout(1600);
const f2 = await clean.locator("[data-frame]").boundingBox();
await clean.mouse.click(f2.x + f2.width / 2, f2.y + 60, { button: "right" });
await clean.waitForTimeout(600);
await clean.locator('[data-radial] [data-shard="anim"]').click({ force: true });
await clean.waitForTimeout(600);
await clean.locator('[data-radial] [data-shard="bg-glide"]').click({ force: true });
await clean.waitForTimeout(700);

const driftNow = () => clean.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("builder.studio"));
  return (d.state.look.texture ?? []).map((l) => l.drift ?? 0);
});
const before = await driftNow();
const slider = clean.locator('[data-radial] [role="slider"], [data-radial] [data-arc-slider]').first();
const has = await slider.count();
if (!has) check("the glide has a slider on it", false, "no slider found on the glide slab");
else {
  const sb = await slider.boundingBox();
  /* Along the arc, to something clearly not nought. */
  await clean.mouse.move(sb.x + sb.width * 0.2, sb.y + sb.height * 0.5);
  await clean.mouse.down();
  await clean.mouse.move(sb.x + sb.width * 0.7, sb.y + sb.height * 0.5, { steps: 8 });
  await clean.mouse.up();
  await clean.waitForTimeout(700);
  const after = await driftNow();
  check("moving it writes a drift onto the page's texture",
    after.some((v, i) => v !== (before[i] ?? 0)) && after.some((v) => v > 0),
    `${JSON.stringify(before)} → ${JSON.stringify(after)}`);
}

/* ------------------------------------------------------------------ */
/* And the whole wheel, after the three of them                         */
/* ------------------------------------------------------------------ */

/*
 * The three items above are each a slot; this is the rule they were three
 * instances of. J's standard for the page's wheel is that a slab is a slab:
 * it does something, and nothing on it says "not yet". Two of the three
 * went for failing exactly that — the three-dot opened the tray a second
 * time, and the animation button opened "Motion asset (soon)".
 *
 * So the outcome is held rather than remembered. Every slab on the page's
 * wheel is opened in turn and what it gives back is read. Audited at
 * 1600×1000 the level reads: Motion · Write · Draw · Create · Import ·
 * Looks · Strip, and under them Glide; Words, Name, Address; Color,
 * Texture, Light — with Draw and Create opening a surface of their own
 * rather than a second level, and Import opening the file the picture
 * comes from.
 */
{
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1800);
  const bare = await page.evaluate(() => {
    const f = document.querySelector("[data-frame]").getBoundingClientRect();
    return { x: Math.round(f.x + f.width / 2), y: Math.round(f.y + f.height / 2) };
  });
  const open = async () => {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    await page.mouse.click(bare.x, bare.y, { button: "right" });
    await page.waitForTimeout(550);
  };
  const slabs = () => page.locator("[data-radial] [data-shard]").evaluateAll((els) =>
    els.map((e) => ({ id: e.getAttribute("data-shard"), label: e.getAttribute("aria-label") })));

  await open();
  const top = await slabs();
  check("the page's wheel has its slabs", top.length >= 6,
    top.map((s) => s.label).join(" · "));
  check("and not one of them says soon",
    !top.some((s) => /soon/i.test(s.label ?? "")),
    top.filter((s) => /soon/i.test(s.label ?? "")).map((s) => s.label).join(", ") || "none of them");

  const dead = [];
  const said = [];
  for (const s of top) {
    if (!s.id || s.id === "delete" || s.id === "duplicate") continue;   /* Strip is destructive; Import opens a file picker. */
    await open();
    const el = page.locator(`[data-radial] [data-shard="${s.id}"]`).first();
    if (!(await el.count())) { dead.push(`${s.label} is not there`); continue; }
    await el.click();
    await page.waitForTimeout(550);
    const inner = await slabs();
    const soon = inner.filter((x) => /soon/i.test(x.label ?? ""));
    if (soon.length) dead.push(`${s.label} → ${soon.map((x) => x.label).join(", ")}`);
    said.push(`${s.label}: ${inner.map((x) => x.label).filter(Boolean).join(", ") || "a surface of its own"}`);
  }
  check("and nothing under them does either", dead.length === 0, dead.join("; ") || said.join(" · "));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await page.close();
}

await browser.close();
console.log("");
const failed = results.filter((r) => !r).length;
console.log(`${results.length - failed} of ${results.length} hold${failed ? `, ${failed} FAILED` : ""}`);
process.exit(failed ? 1 : 0);
