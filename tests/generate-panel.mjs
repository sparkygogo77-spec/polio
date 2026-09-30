/**
 * Generate: many pictures in, one picture out, and it goes where he puts it.
 *
 * HIS WORDS: "just make the input images allow multiple, as well as be drag
 * and droppable or pastable, also make the output image generated pastable
 * instead of just a savable file. the output should also be draggable off the
 * output image onto the web design 1 to 1 or draggable outside of the
 * website... background remover option also did not work, i think that just
 * telling the bot to empty the background is sufficient in the prompt. remove
 * background remover option, change it from 'Draw' to Generate... there
 * should be an input images section with just a + box to add and drop
 * pictures instead of choose file which should pop up if that box is
 * clicked."
 *
 * Measured in the DOM and through real events — a file dropped, a file
 * pasted, a drag started — rather than by reading the component.
 *
 *   node tests/generate-panel.mjs [url]
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

const URL_ = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const results = [];
const check = (name, ok, detail = "") => {
  results.push(!!ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/** A real 1x1 PNG, so what is dropped and pasted is a picture and not a string. */
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 }, permissions: ["clipboard-read", "clipboard-write"] });
const page = await ctx.newPage();
const STATUS = { github: { configured: false, token: null, repo: null, branch: "main", missing: [], allow: null }, vercel: { hook: false } };
/** Nothing is spent: the renderer is answered here. */
let calls = 0;
await page.route("**/api/studio/**", (route) => {
  const what = route.request().url().split("/").pop().split("?")[0];
  if (what === "image") {
    calls += 1;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, image: `data:image/png;base64,${PNG}`, cost: 0.04 }) });
  }
  return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(what === "publish" ? STATUS : {}) });
});
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1300);

/* ------------------------------------------------------------------ */
/* 1. The tab is called Generate                                       */
/* ------------------------------------------------------------------ */

/* Generate is no longer a tab: it is inside each part's "Make a picture" (tests/side-panel-h.mjs). */
const tabs = await page.locator('[aria-label="Side panel"] button').allInnerTexts();
check("nothing in the tabs is still called Draw", !tabs.some((t) => /^\s*Draw\s*$/i.test(t)), tabs.map((t) => t.trim()).filter(Boolean).join(" · "));

const panel = await openGenerate(page);
check("it opens the panel", (await panel.count()) === 1);

/* ------------------------------------------------------------------ */
/* 2. Input images: a + box, and no file field on the face of it       */
/* ------------------------------------------------------------------ */

const face = await page.evaluate(() => {
  const p = document.querySelector("[data-render-panel]");
  if (!p) return null;
  const inputs = [...p.querySelectorAll('input[type="file"]')];
  return {
    plus: p.querySelectorAll("[data-render-add]").length,
    section: p.querySelectorAll("[data-render-inputs]").length,
    fileFields: inputs.length,
    shownFileFields: inputs.filter((i) => {
      const s = getComputedStyle(i);
      const r = i.getBoundingClientRect();
      return s.display !== "none" && s.visibility !== "hidden" && Number(s.opacity) > 0.01 && r.width > 1 && r.height > 1;
    }).length,
  };
});
check("there is an input images section", face?.section === 1, `${face?.section} of them`);
check("with a + box to add and drop pictures", face?.plus === 1, `${face?.plus} of them`);
check("and no Choose File on the face of it", face?.shownFileFields === 0,
  `${face?.shownFileFields} shown of ${face?.fileFields} file fields`);

/* ------------------------------------------------------------------ */
/* 3. Many pictures, by drop and by paste                              */
/* ------------------------------------------------------------------ */

const shown = () => page.locator("[data-render-input]").count();
check("nothing is in it to begin with", (await shown()) === 0, `${await shown()}`);

/** Put a real file on the element the way a hand would: a drop. */
const dropOne = async (b64) => page.evaluate(async ([data]) => {
  const bin = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  const file = new File([bin], "dropped.png", { type: "image/png" });
  const dt = new DataTransfer();
  dt.items.add(file);
  const target = document.querySelector("[data-render-inputs]") ?? document.querySelector("[data-render-panel]");
  target.dispatchEvent(new DragEvent("dragover", { dataTransfer: dt, bubbles: true, cancelable: true }));
  target.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
}, [b64]);

await dropOne(PNG);
await page.waitForTimeout(600);
check("a picture dropped on it is taken", (await shown()) === 1, `${await shown()} in it`);

/** …and a paste, which is the other way he asked for. */
await page.evaluate(async ([data]) => {
  const bin = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  const file = new File([bin], "pasted.png", { type: "image/png" });
  const dt = new DataTransfer();
  dt.items.add(file);
  const target = document.querySelector("[data-render-inputs]") ?? document.querySelector("[data-render-panel]");
  target.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
}, [PNG]);
await page.waitForTimeout(600);
check("and one pasted in is taken too, beside it rather than instead of it", (await shown()) === 2, `${await shown()} in it`);

await dropOne(PNG);
await page.waitForTimeout(500);
check("many is many: a third goes in", (await shown()) === 3, `${await shown()} in it`);

/* ------------------------------------------------------------------ */
/* 4. The background remover is not on offer                           */
/* ------------------------------------------------------------------ */

/*
 * READ WITH THE LIST OPEN.
 *
 * A closed picker shows the chosen model and nothing else, so reading it shut
 * answered "one model, Nano Banana 2" — which passed this check for entirely
 * the wrong reason. The list has to be opened before it can be counted.
 */
const modelRow = panel.locator("[data-render-row='model']");
if (!(await modelRow.locator("select").count())) {
  await modelRow.locator("button").first().click({ force: true });
  await page.waitForTimeout(400);
}
const models = await page.evaluate(() => {
  const sel = document.querySelector("[data-render-row='model'] select");
  if (sel) return [...sel.options].map((o) => o.textContent.trim());
  return [...document.querySelectorAll("[role=option]")].map((o) => o.textContent.trim());
});
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
check("the models that draw are all on offer, not just the chosen one", models.length >= 3, `${models.length} read`);
check("the background remover is not one of the models on offer",
  !models.some((m) => /background remover/i.test(m)),
  `${models.length} models: ${models.join(", ") || "none read"}`);

/* ------------------------------------------------------------------ */
/* 5. What comes back can be copied, and dragged two ways              */
/* ------------------------------------------------------------------ */

await panel.locator("[data-render-tweak]").fill("a dog in a field");
await page.waitForTimeout(200);
await panel.locator("[data-render-go]").click({ force: true });
await page.waitForTimeout(1500);
check("pressing it calls the renderer once", calls === 1, `${calls} calls`);
check("and the picture is kept", (await panel.locator("[data-render-iteration]").count()) === 1,
  `${await panel.locator("[data-render-iteration]").count()} kept`);

check("there is a way to copy it, not only to save it", (await panel.locator("[data-render-copy]").count()) === 1,
  `${await panel.locator("[data-render-copy]").count()} copy controls, ${await panel.locator("[data-render-download]").count()} save`);

/* The drag carries three things: what the board reads, what the desktop
   reads, and the picture's own size so the board lands it 1 to 1. */
const drag = await page.evaluate(() => {
  const img = document.querySelector("[data-render-drag]");
  if (!img) return null;
  const dt = new DataTransfer();
  img.dispatchEvent(new DragEvent("dragstart", { dataTransfer: dt, bubbles: true, cancelable: true }));
  return { types: [...dt.types], download: dt.getData("DownloadURL").slice(0, 40), size: dt.getData("application/x-studio-picture") };
});
check("dragging it out of the site hands the desktop a file", !!drag?.download, drag?.download || "no DownloadURL on the drag");
check("and dragging it onto the design carries its own size, so it lands 1 to 1",
  !!drag?.size && /"w":\s*\d+/.test(drag.size), drag?.size || "no size on the drag");

await page.evaluate(() => localStorage.removeItem("builder.studio"));
await browser.close();
console.log("");
const failed = results.filter((r) => !r).length;
console.log(`${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
