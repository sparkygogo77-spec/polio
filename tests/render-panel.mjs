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
import { openGenerate } from "./fixtures/openGenerate.mjs";

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
/* 1. It is reachable, in a part's "Make a picture" (it was a tab; tests/side-panel-h.mjs) */
/* ------------------------------------------------------------------ */

const panel = await openGenerate(page);
check("a part's Make a picture opens it", (await panel.count()) === 1);
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

/*
 * EFFORT IS REAL, AND IT IS CALLED SOMETHING ELSE.
 *
 * His ruling: never a control that does nothing \u2014 map it to the field that
 * means it, and hide it where there is no equivalent. Ideogram calls it
 * `thinking`, very low to very high, and says in its own note that higher is
 * better and slower. Nothing else that draws a picture has one.
 */
const pruna = await offersFor("Ideogram (Pruna)");
check(
  "the model that has an effort under another name is offered one",
  pruna.effort === true,
  `Ideogram offers ratio ${pruna.ratio}, quality ${pruna.quality}, effort ${pruna.effort}`,
);
check(
  "and the models with no equivalent are not offered a dead one",
  gpt.effort === false && nano.effort === false,
  `GPT Image 2 ${gpt.effort}, Nano Banana 2 ${nano.effort}`,
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
/*
 * Everything in this panel is something he named, by name.
 *
 * The first five were the image, the tweak, the ratio, the quality, the
 * effort and the model. Then: "I need the option for input images and what
 * type of output" \u2014 so a picture to work from and a file type join the
 * list, and the picture brings a way to take it off again. Nothing else may
 * be here, and this counts from the panel rather than from a list of things
 * to forbid, so a control nobody thought to forbid is still caught.
 */
/* …and then: "just make the input images allow multiple ... there should be
   an input images section with just a + box to add and drop pictures instead
   of choose file", and "make the output image generated pastable instead of
   just a savable file". So the pictures section, its + box, the way to take a
   picture back out, and Copy are his too. Named one at a time, deliberately:
   the guard's whole job is that a control has to be asked for by name. */
const MINE = ["render-image", "render-tweak", "render-ratio", "render-quality", "render-effort", "render-model", "render-go", "render-price", "render-reference", "render-reference-clear", "render-format", "render-inputs", "render-add", "render-input", "render-input-drop", "render-copy", "render-cursor", "render-3d", "render-count", "render-input-3d"];
/* …and "i should be able to request multiple" (2026-10-12, tests/pictures-many.mjs): How many. */
/* …and "a dedicated generate cursor option" (2026-10-09), and generated images that "become 3d" (2026-10-10, tests/generate-3d.mjs). */
const strays = await panel.evaluate((el, mine) => {
  const out = [];
  for (const node of el.querySelectorAll("input, select, textarea, button, [role='slider'], [role='switch'], [role='combobox']")) {
    const own = [...node.attributes].map((a) => a.name.replace(/^data-/, "")).find((n) => mine.includes(n))
      ?? [...(node.closest("[data-render-image],[data-render-tweak],[data-render-ratio],[data-render-quality],[data-render-effort],[data-render-model],[data-render-go],[data-render-format],[data-render-inputs],[data-render-row='reference'],[data-render-3d],[data-render-count]")?.attributes ?? [])].map((a) => a.name.replace(/^data-/, "")).find((n) => mine.includes(n))
      ?? ([...node.attributes].some((a) => a.name.startsWith("data-render-row")) ? "row" : undefined);
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
/*
 * HIS WORDS, EXACTLY, AND NOTHING ELSE.
 *
 * He typed `apple` and Replicate was handed "apple, filling the whole frame,
 * edge to edge, nothing floating small in the middle, no background plate, no
 * border, no frame, no caption, no watermark, no signature" \u2014 nine clauses
 * he never wrote. The framing words are a toggle now, off unless a caller
 * asks, and the panel does not ask.
 */
check(
  "nothing is added to what he typed",
  body.prompt === "a dog in a field" && body.frame !== true,
  `${JSON.stringify(body.prompt)}, frame ${JSON.stringify(body.frame)}`,
);
const price = (await panel.locator("[data-render-price]").innerText()).trim();
check("what it really cost replaces the guess", /cost \$/.test(price), price);
/*
 * The result lands in the stack, not in the slot.
 *
 * This looked in the slot, which is where the one picture used to go \u2014 and
 * the slot is now what the NEXT one will be, kept empty on purpose so there
 * is always somewhere to start from. A result that replaced it would be the
 * behaviour he complained about.
 */
check(
  "the picture that came back is shown, at the top of what he has made",
  (await panel.locator("[data-render-iteration] img").count()) === 1,
  `${await panel.locator("[data-render-iteration] img").count()} in the stack, slot left empty for the next`,
);

/* ------------------------------------------------------------------ */
/* 6. What he made is still there after leaving the tab                */
/* ------------------------------------------------------------------ */

/*
 * "stepping out of the tab resets the tab completely while below i would want
 * my previous works to continue as well as the option for a new image."
 */
check("the picture that was drawn is kept below, not in place of the slot", (await panel.locator("[data-render-iteration]").count()) === 1, `${await panel.locator("[data-render-iteration]").count()} kept`);
check("with a way to save it, tweak it and run it again", (await panel.locator("[data-render-download]").count()) === 1 && (await panel.locator("[data-render-tweak-from]").count()) === 1 && (await panel.locator("[data-render-again]").count()) === 1);
check("and it can be dragged onto the page", (await panel.locator("[data-render-drag]").count()) === 1);

/* Leave the tab for another, come back, and it is all still there. */
await page.locator('[aria-label="Side panel"] [role=radio]').filter({ hasText: "Look" }).first().click({ force: true });
await page.waitForTimeout(500);
check("leaving the tab closes the panel", (await page.locator("[data-render-panel]").count()) === 0);
const back = await openGenerate(page);
check(
  "and coming back shows the work again, with a fresh slot on top",
  (await back.locator("[data-render-iteration]").count()) === 1 && (await back.locator("[data-render-image]").count()) === 1,
  `${await back.locator("[data-render-iteration]").count()} kept, ${await back.locator("[data-render-image]").count()} fresh slot`,
);

/* And the two new controls he asked for. */
check("there is a way to give it a picture to work from", (await back.locator("[data-render-reference]").count()) === 1);
check("and a way to say what comes back", (await back.locator("[data-render-row='format']").count()) === 1);

await page.evaluate(() => localStorage.removeItem("builder.studio"));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
