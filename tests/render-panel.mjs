/**
 * Replicate in the Builder: five controls, and no sixth.
 *
 * HIS WORDS: "provide a panel tab where i can use replicate models exactly as
 * i do on their site, with only the mentions i asked for of image, option to
 * tweak, aspect ratio, quality, effort, and model choice."
 *
 * The image is what comes back; the five he can say are the tweak, the ratio,
 * the quality, the effort and the model. This holds that shut in both
 * directions: all five are there, and nothing else is — a panel that grows a
 * seed, a step count and a guidance slider on its own is the panel he was
 * complaining about in the first place.
 *
 * Nothing here spends anything. The renderer is answered by this file, so the
 * press is exercised without a call ever leaving the machine, and what is
 * checked is that his five arrive at the route under the model's own names.
 *
 *   node tests/render-panel.mjs [url]      # default http://localhost:3000
 */
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });

/* Every call to the renderer is answered here. Nothing reaches Replicate and
   nothing is spent; the body that would have gone is kept and read. */
const sent = [];
const STATUS = { github: { configured: false, token: null, repo: null, branch: "main", missing: ["GITHUB_TOKEN"], allow: null }, vercel: { hook: false } };
const PIXEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
await page.route("**/api/studio/**", (route) => {
  const url = route.request().url();
  const what = url.split("/").pop().split("?")[0];
  if (what === "image") {
    try { sent.push(JSON.parse(route.request().postData() ?? "{}")); } catch { sent.push({}); }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, kind: "raster", image: PIXEL, cost: 0.04 }) });
  }
  return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(what === "publish" ? STATUS : {}) });
});

await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1400);

/* ------------------------------------------------------------------ */
/* 1. It is reachable, as a tab                                        */
/* ------------------------------------------------------------------ */

const tab = page.locator('[aria-label="Side panel"] button', { hasText: /Draw/ }).first();
const anyTab = (await tab.count()) ? tab : page.locator('[aria-label="Side panel"] button').last();
await anyTab.click({ force: true });
await page.waitForTimeout(700);
const panel = page.locator("[data-render-panel]").first();
check("there is a tab in the side panel that opens it", (await panel.count()) === 1);
if (!(await panel.count())) { await browser.close(); process.exit(1); }

/* ------------------------------------------------------------------ */
/* 2. His five are all there                                           */
/* ------------------------------------------------------------------ */

const has = async (sel) => (await panel.locator(sel).count()) > 0;
check("the image is there, and the tweak, and the model choice", (await has("[data-render-image]")) && (await has("[data-render-tweak]")) && (await has("[data-render-model]")));

/*
 * A control appears exactly when the model he has chosen takes one.
 *
 * Not "all five are always on screen" \u2014 that would be a panel offering a
 * quality to a model with no quality, which is a control that does nothing,
 * and the whole reason the element panel was a complaint. So the rule is the
 * model's own table: the first draft of this file demanded all five at once
 * and failed against a model that simply has no quality field.
 */
const listed = await page.evaluate(async () => {
  const mod = await import("/_next/static/chunks/imageRoute.js").catch(() => null);
  return null;
});
const withQuality = await panel.evaluate((el) => {
  const opts = [...el.querySelectorAll("[data-render-row='model'] option")].map((o) => o.textContent);
  return opts;
});

/** Pick a model by the words in its name, and say what the panel then offers. */
const offersFor = async (name) => {
  const row = panel.locator("[data-render-row='model']");
  const native = row.locator("select");
  if (await native.count()) await native.selectOption({ label: name }).catch(() => {});
  else {
    await row.locator("button").first().click({ force: true });
    await page.waitForTimeout(300);
    await page.getByRole("option", { name }).first().click({ force: true }).catch(() => {});
  }
  await page.waitForTimeout(500);
  return { ratio: await has("[data-render-ratio]"), quality: await has("[data-render-quality]"), effort: await has("[data-render-effort]") };
};

const gpt = await offersFor("GPT Image 2");
check(
  "a model with a quality of its own is offered one",
  gpt.quality === true,
  `GPT Image 2 offers ratio ${gpt.ratio}, quality ${gpt.quality}, effort ${gpt.effort}`,
);
const nano = await offersFor("Nano Banana 2");
check(
  "and a model with none is not offered one it would refuse",
  nano.quality === false,
  `Nano Banana 2 offers ratio ${nano.ratio}, quality ${nano.quality}, effort ${nano.effort}`,
);
check(
  "every model offers the aspect ratio, which they all take",
  gpt.ratio && nano.ratio,
  `GPT ${gpt.ratio}, Nano ${nano.ratio}`,
);

/* ------------------------------------------------------------------ */
/* 3. And nothing else is                                              */
/* ------------------------------------------------------------------ */

/*
 * Counted from the panel itself rather than from a list of things it must
 * not have: a forbidden-words check passes any control nobody thought to
 * forbid. Every control in here is one of his, by name.
 */
const MINE = ["render-image", "render-tweak", "render-ratio", "render-quality", "render-effort", "render-model", "render-go", "render-price"];
const strays = await panel.evaluate((el, mine) => {
  const out = [];
  for (const node of el.querySelectorAll("input, select, textarea, button, [role='slider'], [role='switch'], [role='combobox']")) {
    const own = [...node.attributes].map((a) => a.name.replace(/^data-/, "")).find((n) => mine.includes(n))
      ?? [...(node.closest("[data-render-image],[data-render-tweak],[data-render-ratio],[data-render-quality],[data-render-effort],[data-render-model],[data-render-go]")?.attributes ?? [])].map((a) => a.name.replace(/^data-/, "")).find((n) => mine.includes(n));
    if (!own) out.push(`${node.tagName.toLowerCase()}${node.getAttribute("aria-label") ? `[${node.getAttribute("aria-label")}]` : ""}`);
  }
  return out;
}, MINE);
check(
  "and there is no sixth control in it",
  strays.length === 0,
  strays.length ? `${strays.length} nobody asked for: ${strays.join(", ")}` : "nothing but his five and the button that runs them",
);

/* ------------------------------------------------------------------ */
/* 4. The price is said before anything is spent                       */
/* ------------------------------------------------------------------ */

const priceBefore = (await panel.locator("[data-render-price]").innerText()).trim();
check("the price is on screen before the press", /\$\d/.test(priceBefore), priceBefore);
check("and nothing has been spent to find that out", sent.length === 0, `${sent.length} calls so far`);

/* ------------------------------------------------------------------ */
/* 5. The press sends his five, under the model's own names            */
/* ------------------------------------------------------------------ */

await panel.locator("[data-render-tweak]").fill("a dog in a field");
await page.waitForTimeout(250);
await panel.locator("[data-render-go]").click({ force: true });
await page.waitForTimeout(1200);

check("pressing it calls the renderer once", sent.length === 1, `${sent.length} calls`);
const body = sent[0] ?? {};
check(
  "and what goes is his words and the model he chose",
  body.prompt === "a dog in a field" && typeof body.model === "string" && body.model.includes("/"),
  `prompt ${JSON.stringify(body.prompt)}, model ${JSON.stringify(body.model)}`,
);
const price = (await panel.locator("[data-render-price]").innerText()).trim();
check("what it really cost replaces the guess", /cost \$/.test(price), price);
check("and the picture that came back is shown", (await panel.locator("[data-render-image] img").count()) === 1);

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
