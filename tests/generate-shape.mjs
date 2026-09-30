/**
 * What Generate sends Replicate is in the shape of the model it is sent to.
 *
 * Measured on 4254477 against a stand-in Replicate: every picture, whatever
 * model he picked, went out with the Flux defaults the route was written for
 * — `output_format: "webp"` and `safety_tolerance: 2` — beside whatever he
 * chose. Nano Banana 2 takes jpg or png and has no safety_tolerance; a value
 * outside a model's list is a 422 on Replicate, and the route answers a 422
 * by sending the prompt alone. So the pictures he gave it to work from and
 * the ratio he chose were dropped without a word, and he paid for a picture
 * of something else. The Output picker did the same with "JPEG", which is
 * "jpg" to Nano Banana 2.
 *
 * The stand-in refuses a value outside a model's own list with a 422, as
 * Replicate does, off the same table the Builder routes by
 * (`imageRoute.ts`). Through the panel, with a placeholder key typed into
 * the Keys panel, for Nano Banana 2 and for GPT Image 2:
 *   · one call is enough: nothing is refused and nothing retried;
 *   · every field sent is one the model declares, every choice one it lists;
 *   · the picture to work from goes under the model's own field, and the
 *     ratio and the file type he chose arrive, under the model's spelling;
 *   · the key rides as the bearer, and the picture comes back into the panel;
 *   · the pickers are named, so a screen reader can find them.
 *
 * Nothing leaves the machine: Replicate is a stand-in on REPLICATE_API.
 *
 *   npm run build
 *   REPLICATE_API=http://127.0.0.1:4335/v1 npx next start -p 3013
 *   node tests/generate-shape.mjs http://127.0.0.1:3013
 */
import http from "node:http";
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { MODELS } from "../src/features/studio/imageRoute.ts";
import { openGenerate } from "./fixtures/openGenerate.mjs";

const BASE = (process.argv[2] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const PORT = Number(process.env.REPLICATE_PORT ?? 4335);
const KEY = "STANDIN_REPLICATE_KEY_0000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const card = (slug) => MODELS.find((m) => m.slug === slug);
/** What Replicate would refuse: a choice outside the model's own list. */
const refused = (slug, input) => {
  const c = card(slug);
  if (!c) return "no such model";
  for (const [k, v] of Object.entries(input)) {
    const f = c.fields.find((x) => x.name === k);
    if (f?.kind === "enum" && f.values && !f.values.includes(v)) return `${k}: ${JSON.stringify(v)} is not one of ${f.values.join(", ")}`;
  }
  return null;
};
const calls = [];
const standin = http.createServer((req, res) => {
  const chunks = [];
  req.on("data", (d) => chunks.push(d));
  req.on("end", () => {
    const send = (s, o) => { res.writeHead(s, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
    if (req.url === "/out.png") { res.writeHead(200, { "content-type": "image/png" }); return res.end(PNG); }
    const m = req.url.match(/^\/v1\/models\/([^/]+\/[^/]+)\/predictions$/);
    if (req.method === "POST" && m) {
      const input = JSON.parse(Buffer.concat(chunks).toString() || "{}").input ?? {};
      const why = refused(m[1], input);
      calls.push({ slug: m[1], auth: req.headers.authorization ?? "", input, why });
      if (why) return send(422, { detail: `- input: ${why}`, status: 422, title: "Input validation failed" });
      return send(201, { id: `standin${calls.length}`, status: "succeeded", output: `http://127.0.0.1:${PORT}/out.png`, metrics: { predict_time: 1 }, urls: { get: `http://127.0.0.1:${PORT}/v1/predictions/standin${calls.length}` } });
    }
    if (req.method === "GET" && /^\/v1\/predictions\//.test(req.url)) return send(200, { id: req.url.split("/").pop(), status: "succeeded", output: `http://127.0.0.1:${PORT}/out.png`, metrics: { predict_time: 1 } });
    send(404, { detail: "not found" });
  });
});
await new Promise((ok) => standin.listen(PORT, "127.0.0.1", ok));

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route(/^https:\/\/(?!fonts\.)/, (r) => r.fulfill({ status: 404, body: "" }));
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);

/* The key, through the Keys panel, the way his goes in. */
const keys = page.locator("[data-keys-panel]");
await page.getByRole("button", { name: "Keys", exact: true }).click();
await page.waitForTimeout(500);
const skip = keys.getByRole("button", { name: /Skip the PIN|Hold the key for this tab/ });
if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(300); }
await keys.locator('[data-service="replicate"] input[type="password"]').first().fill(KEY);
await keys.getByRole("button", { name: /Save to this browser|Hold in this tab/ }).first().click();
await page.waitForTimeout(400);
await keys.getByRole("button", { name: "Close keys" }).click();
await page.waitForTimeout(400);

/* Inside a part's "Make a picture" now (tests/side-panel-h.mjs): everything below is read inside the tool itself. */
const side = await openGenerate(page);
const picker = (name) => side.getByRole("combobox", { name, exact: true });
check("the Model picker is named", (await picker("Model").count()) === 1);
check("…and so are Output and Aspect ratio", (await picker("Output").count()) === 1 && (await picker("Aspect ratio").count()) === 1);
const choose = async (name, option) => {
  const p = (await picker(name).count()) ? picker(name) : side.getByRole("combobox").nth(name === "Model" ? 0 : name === "Output" ? 1 : 2);
  await p.click();
  await page.getByRole("option", { name: option, exact: true }).first().click();
  await page.waitForTimeout(250);
};

for (const [slug, name, images, format] of [["google/nano-banana-2", "Nano Banana 2", "image_input", "jpg"], ["openai/gpt-image-2", "GPT Image 2", "input_images", "jpeg"]]) {
  const c = card(slug);
  await choose("Model", name);
  const input = side.locator("input[type=file]").first();
  await input.setInputFiles({ name: "work-from.png", mimeType: "image/png", buffer: PNG });
  await page.waitForTimeout(500);
  await choose("Output", "JPEG");
  await choose("Aspect ratio", "16:9");
  const before = calls.length;
  await side.locator("textarea").first().fill("a small red fox, flat illustration");
  await side.getByRole("button", { name: /^Generate/ }).last().click();
  for (let i = 0; i < 40 && calls.length === before; i++) await page.waitForTimeout(250);
  await page.waitForTimeout(1500);
  const mine = calls.slice(before);
  const last = mine.at(-1);
  const declared = new Set(c.fields.map((f) => f.name));
  check(`${name}: one call, nothing refused and retried`, mine.length === 1 && !mine[0].why, mine.map((x) => x.why ?? "accepted").join(" → ") || "no call");
  check(`${name}: the key rides as the bearer`, !!last && last.auth === `Bearer ${KEY}`);
  const extra = last ? Object.keys(last.input).filter((k) => !declared.has(k)) : ["no call"];
  check(`${name}: every field sent is one it declares`, extra.length === 0, extra.join(", ") || Object.keys(last.input).join(", "));
  check(`${name}: the picture to work from arrives under ${images}`, !!last && [].concat(last.input[images] ?? []).length >= 1 && [].concat(last.input[images]).every((x) => /^data:image\//.test(x)), last ? Object.keys(last.input).join(", ") : "");
  check(`${name}: the ratio he chose arrives`, last?.input.aspect_ratio === "16:9", String(last?.input.aspect_ratio));
  check(`${name}: JPEG arrives as ${format}, its own spelling`, last?.input.output_format === format, String(last?.input.output_format));
}
check("the pictures came back into the panel", (await side.locator("img").count()) >= 2, `${await side.locator("img").count()} pictures`);
check("no page error", errors.length === 0, errors.join(" | "));

await browser.close();
standin.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
