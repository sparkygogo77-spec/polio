/**
 * Copy under a generated picture copies the PICTURE, not a link.
 *
 * HIS WORDS (2026-10-12): "pressing copy on the images from the generator
 * dont copy as they should it copies a link".
 *
 * The renderer here answers with a webp on a host that sends no CORS header,
 * the hard case: the page cannot read the bytes itself, and webp is a type
 * browsers refuse to write. After Copy the clipboard must hold one PNG and no
 * text at all, since apps paste the text when both are there.
 *
 *   node tests/copy-picture.mjs [url]      # default http://localhost:3000
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

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 }, permissions: ["clipboard-read", "clipboard-write"] });
const page = await ctx.newPage();

/* A real 6x4 webp, made by the browser itself. */
await page.goto(`${URL_}/api/version`).catch(() => {});
const webp = Buffer.from(await page.evaluate(() => {
  const c = document.createElement("canvas");
  c.width = 6; c.height = 4;
  const g = c.getContext("2d"); g.fillStyle = "#e33"; g.fillRect(0, 0, 6, 4);
  return c.toDataURL("image/webp").split(",")[1];
}), "base64");

const FAR = "https://pictures.example/dog.webp";
/* Its host shows it in an <img> but will not hand it to a fetch: no CORS header. */
await page.route("https://pictures.example/**", (route) => (route.request().resourceType() === "image"
  ? route.fulfill({ status: 200, contentType: "image/webp", body: webp })
  : route.abort("blockedbyclient")));
const STATUS = { github: { configured: false, token: null, repo: null, branch: "main", missing: [], allow: null }, vercel: { hook: false } };
let proxied = 0;
await page.route("**/api/studio/**", (route) => {
  const what = route.request().url().split("/").pop().split("?")[0];
  if (what === "image") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, image: FAR, cost: 0.04 }) });
  if (what === "picture") {
    proxied += 1;
    return route.fulfill({ status: 200, contentType: "image/webp", body: webp });
  }
  return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(what === "publish" ? STATUS : {}) });
});
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1300);

const panel = await openGenerate(page);
await panel.locator("[data-render-tweak]").fill("a dog in a field");
await panel.locator("[data-render-go]").click({ force: true });
await page.waitForTimeout(1500);
check("a picture came back", (await panel.locator("[data-render-copy]").count()) === 1);

/* Something else on the clipboard first, so a copy that does nothing shows. */
await page.evaluate(() => navigator.clipboard.writeText("before"));
await panel.locator("[data-render-copy]").first().click();
await page.waitForTimeout(800);
const said = await panel.locator("[data-render-copy]").first().innerText();

const got = await page.evaluate(async () => {
  const items = await navigator.clipboard.read();
  const types = items.flatMap((i) => [...i.types]);
  const png = items.find((i) => i.types.includes("image/png"));
  let size = null;
  if (png) {
    const bmp = await createImageBitmap(await png.getType("image/png"));
    size = `${bmp.width}x${bmp.height}`;
  }
  return { types, size, text: types.includes("text/plain") ? (await (await items[0].getType("text/plain")).text()).slice(0, 60) : null };
});
check("the clipboard holds the picture as PNG", got.types.includes("image/png"), got.types.join(", ") || "nothing");
check("and no link beside it", !got.types.includes("text/plain"), got.text ?? "");
check("it is the same picture, at its own size", got.size === "6x4", got.size ?? "no picture");
check("its host refused the page, so the builder's server fetched it", proxied >= 1, `${proxied} through the server`);
check("the button says it copied", /Copied/.test(said), said);

await page.evaluate(() => localStorage.removeItem("builder.studio"));
await browser.close();
console.log("");
const failed = results.filter((r) => !r).length;
console.log(`${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
