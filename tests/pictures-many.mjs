/**
 * Every input picture goes to the model, a press can ask for several
 * pictures, and the 3D model is reached at all.
 *
 * J (2026-10-12): "the builder i think also only takes the first image only
 * as input if you can confirm but it definitely also only puts out one at a
 * time when i should be able to request multiple". And on the same screen,
 * "Generate in 3D" answered "Request to https://api.replicate.com/v1/models/
 * tencent/hunyuan3d-2mv/predictions failed with status 404": a model that is
 * not one of Replicate's "official" ones can only be run by its version.
 *
 * Against a stand-in Replicate that, like the real one, answers a community
 * model's own address with a 404:
 *   · GPT Image 2, two input pictures, How many 3: one call, both pictures
 *     under input_images, number_of_images 3, and three pictures back;
 *   · Nano Banana 2 has no count field, so How many 2 is two calls, each
 *     with every input picture, and two pictures back;
 *   · "A real 3D model" falls back to the model's latest version and runs.
 *
 * Nothing leaves the machine: Replicate is a stand-in on REPLICATE_API.
 *
 *   npm run build
 *   REPLICATE_API=http://127.0.0.1:4336/v1 npx next start -p 3013
 *   REPLICATE_PORT=4336 node tests/pictures-many.mjs http://127.0.0.1:3013
 *
 * Covers: src/app/api/studio/image/route.ts, src/features/studio/RenderPanel.tsx, src/features/studio/pictures/estimate.ts
 */
import http from "node:http";
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { openGenerate } from "./fixtures/openGenerate.mjs";

const BASE = (process.argv[2] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const PORT = Number(process.env.REPLICATE_PORT ?? 4336);
const KEY = "STANDIN_REPLICATE_KEY_0000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const PNG2 = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const COMMUNITY = new Set(["tencent/hunyuan3d-2mv"]);
const VERSION = "0123456789abcdef".repeat(4);
const calls = [];
/* Until when 3D starts are refused with Replicate's own 429, as its rate limit does. */
let throttle = 0;
const out = (n) => Array.from({ length: n }, (_, i) => `http://127.0.0.1:${PORT}/out${i}.png`);
const standin = http.createServer((req, res) => {
  const chunks = [];
  req.on("data", (d) => chunks.push(d));
  req.on("end", () => {
    const send = (s, o) => { res.writeHead(s, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
    if (/^\/out\d+\.png$/.test(req.url)) { res.writeHead(200, { "content-type": "image/png" }); return res.end(PNG); }
    if (req.url === "/mesh.glb") { res.writeHead(200, { "content-type": "model/gltf-binary" }); return res.end(Buffer.from("glTF\x02\x00\x00\x00\x0c\x00\x00\x00", "binary")); }
    const body = () => JSON.parse(Buffer.concat(chunks).toString() || "{}");
    const done = (slug, input) => {
      const n = Number(input.number_of_images) || 1;
      return { id: `standin${calls.length}`, status: "succeeded", output: COMMUNITY.has(slug) ? `http://127.0.0.1:${PORT}/mesh.glb` : n > 1 ? out(n) : out(1)[0], metrics: { predict_time: 1 } };
    };
    const m = req.url.match(/^\/v1\/models\/([^/]+\/[^/]+)\/predictions$/);
    if (req.method === "POST" && m) {
      const input = body().input ?? {};
      calls.push({ slug: m[1], by: "model", input });
      if (COMMUNITY.has(m[1])) return send(404, { detail: "The requested resource could not be found.", status: 404 });
      return send(201, done(m[1], input));
    }
    const g = req.url.match(/^\/v1\/models\/([^/]+\/[^/]+)$/);
    if (req.method === "GET" && g) return send(200, { owner: g[1].split("/")[0], name: g[1].split("/")[1], latest_version: { id: VERSION } });
    if (req.method === "POST" && req.url === "/v1/predictions") {
      const b = body();
      calls.push({ slug: b.version === VERSION ? "tencent/hunyuan3d-2mv" : "?", by: "version", version: b.version, input: b.input ?? {}, at: Date.now() });
      if (Date.now() < throttle) {
        calls.at(-1).refused = true;
        return send(429, { detail: "Request was throttled. Your rate limit for creating predictions is reduced to 6 requests per minute with a burst of 1 requests while you have less than $5.0 in credit. Your rate limit resets in ~1s.", status: 429, retry_after: 1 });
      }
      return send(201, done("tencent/hunyuan3d-2mv", b.input ?? {}));
    }
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

const side = await openGenerate(page);
const pick = async (where, option) => {
  await side.locator(where).first().click({ force: true });
  await page.waitForTimeout(200);
  await page.getByRole("option", { name: option, exact: true }).first().click({ force: true });
  await page.waitForTimeout(250);
};
const drawn = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") ?? "{}").state?.draws?.length ?? 0);
const press = async (wait = (n) => calls.length > n) => {
  const before = calls.length;
  const had = await drawn();
  await side.locator("[data-render-go]").click({ force: true });
  for (let i = 0; i < 60 && !wait(before); i++) await page.waitForTimeout(250);
  await page.waitForTimeout(1500);
  return { mine: calls.slice(before), added: (await drawn()) - had };
};

check("there is a How many control", (await side.locator("[data-render-count]").count()) === 1);

for (const [name, field, many] of [["GPT Image 2", "input_images", true], ["Nano Banana 2", "image_input", false]]) {
  await pick("[data-render-row='model'] button, [data-render-row='model'] [role=combobox]", name);
  while (await side.locator("[data-render-input-drop]").count()) { await side.locator("[data-render-input-drop]").first().click({ force: true }); await page.waitForTimeout(100); }
  const file = side.locator("input[type=file]").first();
  await file.setInputFiles([{ name: "a.png", mimeType: "image/png", buffer: PNG }, { name: "b.png", mimeType: "image/png", buffer: PNG2 }]);
  await page.waitForTimeout(500);
  const asks = many ? 3 : 2;
  await pick("[data-render-count] button, [data-render-count] [role=combobox]", String(asks));
  const price = (await side.locator("[data-render-price]").innerText()).trim();
  check(`${name}: the price before the press counts ${asks} pictures`, new RegExp(`${asks} pictures`).test(price), price);
  await side.locator("[data-render-tweak]").fill("a ring as a minecraft model");
  const { mine, added } = await press((n) => calls.length >= n + (many ? 1 : asks));
  const pics = mine.map((c) => [].concat(c.input[field] ?? []));
  check(`${name}: every input picture is sent, not only the first`, pics.length > 0 && pics.every((p) => p.length === 2 && new Set(p).size === 2), pics.map((p) => p.length).join(", ") || "no call");
  if (many) check(`${name}: one call asks for ${asks} under number_of_images`, mine.length === 1 && mine[0].input.number_of_images === asks, `${mine.length} calls, ${mine[0]?.input.number_of_images}`);
  else check(`${name}: no count field, so ${asks} calls side by side`, mine.length === asks, `${mine.length} calls`);
  check(`${name}: ${asks} pictures come back`, added === asks, `${added} added`);
}

/* The 3D model: a community model's own address is a 404, so it runs by version. */
await pick("[data-render-count] button, [data-render-count] [role=combobox]", "1");
await pick("[data-render-3d] button, [data-render-3d] [role=combobox]", "A real 3D model");
const { mine } = await press((n) => calls.slice(n).some((c) => c.by === "version"));
await page.waitForTimeout(1500);
const said = (await side.locator("[data-render-price]").innerText()).trim();
/* At most once: a server that already ran it remembers the version. */
check("3D: the model's own address answered 404 once", mine.filter((c) => c.slug === "tencent/hunyuan3d-2mv" && c.by === "model").length <= 1, mine.map((c) => `${c.slug}/${c.by}`).join(", "));
check("3D: …and it ran by its latest version", mine.some((c) => c.by === "version" && c.version === VERSION && /^data:image\//.test(String(c.input.front_image))));
check("3D: no 404 reaches the panel", !/404|could not be found/.test(said), said);

/* J (2026-10-12): a 429 "retry_after" made the 3D model fail and the flat picture stood in for it. */
throttle = Date.now() + 1500;
const waited = await press((n) => calls.slice(n).some((c) => c.by === "version" && !c.refused));
await page.waitForTimeout(2000);
const tries = waited.mine.filter((c) => c.by === "version");
const said2 = (await side.locator("[data-render-price]").innerText()).trim();
check("3D 429: it waits out retry_after and tries again", tries.length >= 2 && tries[0].refused && !tries.at(-1).refused && tries.at(-1).at - tries[0].at >= 1000, tries.map((c) => `${c.refused ? "429" : "ok"}`).join(" → "));
check("3D 429: …and the 3D model is made", /Made a real 3D model/.test(said2), said2);

throttle = Date.now() + 120_000;
await press((n) => calls.slice(n).filter((c) => c.by === "version").length >= 8);
await page.waitForTimeout(3000);
const said3 = (await side.locator("[data-render-price]").innerText()).trim();
check("3D still limited: it says plainly no 3D model was made", /3D model was not made/.test(said3) && !/first pass is what is on the board/.test(said3), said3);
check("…and says what to do", /Try again in a minute|add credit/.test(said3), said3);
throttle = 0;
check("no page error", errors.length === 0, errors.join(" | "));

await browser.close();
standin.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
