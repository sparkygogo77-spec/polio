/**
 * The renderer, and the promises made about its token.
 *
 * A second way to fill a part arrived: Replicate draws the body instead of
 * Claude writing it. That is a model that costs money per press, holds a
 * token the browser must never see, and hands back markup written by
 * something that is not this app. So what is held shut here is mostly not
 * "does it draw":
 *
 *   · the token rides on the request, out of the same vault the Claude key
 *     lives in, and beats the server's, because the person who typed it is
 *     the one being billed; no answer this route gives ever contains it;
 *   · with no token anywhere the answer is HTTP 200, ok:false, reason
 *     "unavailable", with a message that says where a token goes — the same
 *     shape a locked Claude key answers with, so the same dialog shows it;
 *   · an SVG that came back from a drawing model goes through exactly the
 *     locks a written body does;
 *   · a raster is a data: URI and nothing else, so nothing is fetched when
 *     the part renders;
 *   · the price is 0.04 raster, 0.08 vector, in one place, and it reaches
 *     the usage line;
 *   · the vault holds it beside the Claude key, offers the same field, the
 *     same Try it, and the same Forget;
 *   · and the drawing path asks the tracer and nothing else: the picture
 *     goes up, no description of it does, no model that writes is called,
 *     and the written body is reached only when nothing was traced and
 *     there are words to work from.
 *
 *   node tests/renderer.mjs [url]      # default http://localhost:3000
 */
import { createRequire } from "node:module";
import {
  costLine, fluxRatio, isRenderKind, money, rasterFragment, recraftSize,
  renderPrompt, RENDER_COST, RENDER_MODELS, RENDER_UNAVAILABLE,
} from "../src/features/studio/renderer.ts";
import { cleanSnippet, RENDER_LIMIT, SNIPPET_LIMIT } from "../src/features/studio/snippet.ts";

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

/* ------------------------------------------------------------------ */
/* 1. The two models, and what they cost                               */
/* ------------------------------------------------------------------ */

check("vector is recraft's SVG model", RENDER_MODELS.vector === "recraft-ai/recraft-v3-svg", RENDER_MODELS.vector);
check("raster is flux 2 pro", RENDER_MODELS.raster === "black-forest-labs/flux-2-pro", RENDER_MODELS.raster);
check("a raster call is four cents", RENDER_COST.raster === 0.04, String(RENDER_COST.raster));
check("a vector call is eight", RENDER_COST.vector === 0.08, String(RENDER_COST.vector));
check("and a price is written as one", money(RENDER_COST.vector) === "$0.08" && money(0.4) === "$0.40", `${money(RENDER_COST.vector)} ${money(0.4)}`);
check("the usage line says what it was spent on", costLine("raster", 3) === "$0.12 at the renderer", costLine("raster", 3));
check("only the two kinds are kinds", isRenderKind("vector") && isRenderKind("raster") && !isRenderKind("svg") && !isRenderKind(""));

/* ------------------------------------------------------------------ */
/* 2. The frame the drawing is asked for                               */
/* ------------------------------------------------------------------ */

check("a square part asks for a square frame", recraftSize(320, 320) === "1024x1024", recraftSize(320, 320));
check("a wide one asks for a wide frame", /^(1536x1024|1365x1024|1434x1024)$/.test(recraftSize(900, 620)), recraftSize(900, 620));
check("a tall one asks for a tall frame", recraftSize(300, 900).split("x")[0] < recraftSize(300, 900).split("x")[1], recraftSize(300, 900));
check("flux is asked in ratios", fluxRatio(320, 320) === "1:1" && fluxRatio(1600, 900) === "16:9" && fluxRatio(600, 900) === "2:3",
  [fluxRatio(320, 320), fluxRatio(1600, 900), fluxRatio(600, 900)].join(" "));
{
  const closed = renderPrompt({ kind: "vector", prompt: "a helix of sentences", closed: true });
  const open = renderPrompt({ kind: "vector", prompt: "a helix of sentences", closed: false });
  check("the words say to fill the frame", /edge to edge/.test(closed) && /nothing floating small/.test(closed), closed.slice(0, 80));
  check("an open line is asked for as a band", /band following a single open line/.test(open));
  check("and nothing is asked to sit on a plate", /no background plate/.test(closed) && /no watermark/.test(closed));
  const painted = renderPrompt({ kind: "vector", prompt: "a crest", palette: { accent: "#b8ff24", text: "#eee", bg: "#000" } });
  check("the site's colours go with it", /#b8ff24/.test(painted) && /#000/.test(painted));
}

/* ------------------------------------------------------------------ */
/* 3. What comes back is not trusted                                   */
/* ------------------------------------------------------------------ */

{
  const nasty = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <script>fetch("https://example.com/steal")</script>
    <image href="https://example.com/pic.png" onload="go()"/>
    <style>@import url(https://fonts.example.com/x.css);</style>
    <path d="M0 0h100v100H0z" fill="#b8ff24"/></svg>`;
  const { html, stripped } = cleanSnippet(nasty, RENDER_LIMIT);
  check("a drawn SVG loses its script", !/<script/i.test(html) && stripped.includes("a script"));
  check("and its external image", !/example\.com\/pic/.test(html));
  check("and its event handler", !/onload/i.test(html) && stripped.includes("an event handler"));
  check("and its imported stylesheet", !/@import/i.test(html) && stripped.includes("an import"));
  check("what it actually drew survives", /<path d="M0 0h100v100H0z"/.test(html));
}
{
  // A drawing model emits every curve it drew: bigger than a hand-written
  // body, and cutting it in half is not a smaller picture.
  const big = `<svg viewBox="0 0 1 1">${"<path d='M0 0h1v1H0z'/>".repeat(2000)}</svg>`;
  check("a hand-written body is still held to its own limit", cleanSnippet(big).html.length <= SNIPPET_LIMIT);
  check("a drawn one is allowed to be a drawing", big.length > SNIPPET_LIMIT && cleanSnippet(big, RENDER_LIMIT).html.length === big.length,
    `${big.length} bytes`);
}
{
  const uri = "data:image/webp;base64,UklGRhIAAABXRUJQVlA4TAYAAAAvAAAAAA==";
  check("a raster body is a data: image and nothing else", rasterFragment(uri).startsWith(`<img src="${uri}"`), rasterFragment(uri).slice(0, 40));
  check("it fills the part's box", /width:100%;height:100%/.test(rasterFragment(uri)));
  check("a URL is not a raster body", rasterFragment("https://example.com/x.png") === "" && rasterFragment("data:text/html;base64,AAA") === "");
}

/* ------------------------------------------------------------------ */
/* 4. The route, with no token on this server                          */
/* ------------------------------------------------------------------ */

const post = async (body, headers = {}) => {
  const res = await fetch(`${URL_BASE}/api/studio/image`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return { status: res.status, text: await res.text() };
};

const SECRET = "r8_pretendthisisatokenandnotarealone";

{
  const { status, text } = await post({ kind: "vector", prompt: "a helix of sentences", w: 320, h: 320 });
  const data = JSON.parse(text);
  check("no token is not an error: 200 with a reason", status === 200 && data.ok === false && data.reason === "unavailable", `${status} ${data.reason}`);
  check("and the reason says where a token goes", /key button/.test(data.message) && /Claude key/.test(data.message), data.message?.slice(0, 70));
  check("it is the message the app already had", data.message === RENDER_UNAVAILABLE);
}
{
  // The token is looked for before the body is even read, so a request that
  // could not possibly be drawn still answers the one thing worth saying.
  const { status, text } = await post("not json");
  check("the token is looked for before anything else is", status === 200 && JSON.parse(text).reason === "unavailable", String(status));
}
{
  // A token the browser offers is used, and never comes back out. Replicate
  // will refuse this one, which is the point: the answer must say that
  // without quoting what was sent.
  const { status, text } = await post({ kind: "vector", prompt: "a crest", w: 320, h: 320 }, { "x-replicate-key": SECRET });
  const data = JSON.parse(text);
  check("a token the browser offers is the one used", data.reason !== "unavailable", `${status} ${data.reason}`);
  check("a rejected token is said plainly", data.ok === false && /auth|render|rate-limit|fetch/.test(data.reason ?? ""), `${data.reason}: ${(data.message ?? "").slice(0, 60)}`);
  check("and the token itself never comes back", !text.includes(SECRET) && !/r8_[A-Za-z0-9]{8}/.test(text), text.slice(0, 90));
}
{
  const res = await fetch(`${URL_BASE}/api/keys/status`, { cache: "no-store" });
  const data = await res.json();
  check("the status route reports the server's, present or absent", "REPLICATE_API_TOKEN" in data.set, Object.keys(data.set).length + " names");
  check("and reports it as a yes or no, never a value", typeof data.set.REPLICATE_API_TOKEN === "boolean");
}
{
  // Try it asks Replicate who the token belongs to, the same question the
  // other two are asked, and answers in a sentence.
  const res = await fetch(`${URL_BASE}/api/keys/test`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-replicate-key": SECRET },
    body: JSON.stringify({ service: "replicate" }),
  });
  const data = await res.json();
  check("Try it asks Replicate about the browser's token", data.source === "browser", JSON.stringify({ ok: data.ok, source: data.source }));
  check("and says what came back without quoting the token", typeof data.message === "string" && !data.message.includes(SECRET), (data.message ?? "").slice(0, 70));
}

/* ------------------------------------------------------------------ */
/* 5. The panel: a field beside Claude's                              */
/* ------------------------------------------------------------------ */

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.getByRole("button", { name: "Keys" }).click();
await page.waitForTimeout(700);

{
  const row = page.locator('[data-service="replicate"]');
  check("there is a Replicate card under Keys", (await row.count()) === 1);
  const text = (await row.first().innerText()).replace(/\s+/g, " ");
  check("it says whether the server has one of its own", /not on the server|on the server/.test(text), text.slice(0, 60));
  check("it names both models", /recraft-v3-svg/.test(text) && /flux-2-pro/.test(text));
  check("it prices both kinds", /\$0\.08/.test(text) && /\$0\.04/.test(text));
  check("and there is a field to paste one into", (await row.locator('input[type="password"]').count()) === 1);
  const anthropic = await page.locator('[data-service="anthropic"]').boundingBox();
  const mine = await row.first().boundingBox();
  check("it sits beside the Claude one, not at the bottom", !!anthropic && !!mine && mine.y > anthropic.y && mine.y - (anthropic.y + anthropic.height) < 40,
    `${Math.round((mine?.y ?? 0) - ((anthropic?.y ?? 0) + (anthropic?.height ?? 0)))}px below it`);

  // Held here, sent from here: paste it, save it, and it is what the image
  // route is handed on the next call.
  await row.locator('input[type="password"]').fill(SECRET);
  await page.getByRole("button", { name: /Save to this browser/i }).click();
  await page.waitForTimeout(900);
  const held = await page.evaluate(() => {
    const raw = localStorage.getItem("builder.keys.plain") ?? sessionStorage.getItem("builder.keys.session") ?? "";
    return raw.includes("REPLICATE_API_TOKEN");
  });
  check("a pasted token is held in this browser, beside the Claude one", held);
  const after = (await row.first().innerText()).replace(/\s+/g, " ");
  check("and the card says it is held here", /held here|held for this tab/.test(after), after.slice(0, 90));
}
await page.keyboard.press("Escape");

/* ------------------------------------------------------------------ */
/* 6. The drawing path: traced, never written                         */
/* ------------------------------------------------------------------ */

/** A circle: closed, and it encloses a real area, so it is cut to and scored as one. */
const circle = Array.from({ length: 49 }, (_, i) => {
  const a = (i / 48) * Math.PI * 2;
  return [0.5 + Math.cos(a) * 0.32, 0.5 + Math.sin(a) * 0.32];
});
const star = Array.from({ length: 11 }, (_, i) => {
  const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
  const r = i % 2 ? 0.13 : 0.32;
  return [0.5 + Math.cos(a) * r, 0.5 + Math.sin(a) * r];
});

await page.route("**/api/studio/reshape", (route) =>
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, patch: { featureId: "custom-idea", label: "Drawn", w: 320, h: 320, note: "an idea, drawn" }, usage: { model: "stub" } }) }));

const wrote = [];
await page.route("**/api/studio/body", (route) => {
  wrote.push({ at: Date.now(), body: JSON.parse(route.request().postData() ?? "{}") });
  return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, html: `<svg viewBox="0 0 100 100" preserveAspectRatio="none"><circle cx="50" cy="50" r="7" fill="#b8ff24"/></svg>`, note: "written", stripped: [] }) });
});

let token = true;
/*
 * The drawing path lands twice now, and the two stages are two different
 * answers through one route. `drawn` is the first pass — the tracer, which
 * is what everything below is about — and `refined` is the second, kept
 * apart so a count of tracer calls is still a count of tracer calls.
 */
const drawn = [];
const refined = [];
/** A 2x2 PNG, so the second pass comes back with real bytes. */
const REFINED_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFUlEQVR4nGP8z8Dwn4EIwESMokGmEADbCwEjxtqm4wAAAABJRU5ErkJggg==";
await page.route("**/api/studio/image", (route) => {
  const body = JSON.parse(route.request().postData() ?? "{}");
  if (Number(body.stage) === 2) {
    refined.push({ at: Date.now(), body, headers: route.request().headers() });
    if (!token) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: false, stage: 2, reason: "unavailable", message: "The better pass did not run: no Replicate token, so only the first pass happened." }) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      ok: true, stage: 2, model: "openai/gpt-image-2", name: "GPT Image 2", making: "icon",
      transparent: true, example: false, ratio: "1:1", ms: 4130, cost: null, bytes: 200,
      html: `<img src="data:image/png;base64,${REFINED_PNG}" alt="" style="display:block;width:100%;height:100%;object-fit:cover;">`,
      image: `data:image/png;base64,${REFINED_PNG}`,
    }) });
  }
  drawn.push({ at: Date.now(), body, headers: route.request().headers() });
  if (!token) {
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: false, reason: "unavailable", message: RENDER_UNAVAILABLE }) });
  }
  return route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ok: true, kind: "vectorize", cost: RENDER_COST.vectorize, model: RENDER_MODELS.vectorize, stripped: [],
      html: `<svg viewBox="0 0 100 100" preserveAspectRatio="none"><rect width="100" height="100" fill="#b8ff24"/></svg>` }),
  });
});

await page.evaluate(() => localStorage.setItem("builder.settings", JSON.stringify({ state: { values: { "studio.drawMode": "raw" }, advanced: false }, version: 0 })));
await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(900);

const read = () => page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {};
  const n = (s.nodes ?? []).filter((x) => x.code);
  const last = n[n.length - 1];
  const th = (s.threads ?? [])[(s.threads ?? []).length - 1];
  return {
    made: n.length,
    code: last?.code ? { source: last.code.source, kind: last.code.kind, cost: last.code.cost, overlap: last.code.overlap, attempts: last.code.attempts, scores: last.code.scores } : null,
    cost: th?.usage?.cost ?? 0,
    passes: th?.usage?.passes ?? [],
    refined: last?.code?.refined ?? null,
    said: (th?.changes ?? []).join(" | "),
  };
});

const drawOne = async (points, words) => {
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(350);
  await page.keyboard.type("drop a new idea");
  await page.waitForTimeout(400);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(800);
  const part = page.locator("[data-node-id]").last();
  await part.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(200);
  const pb = await part.boundingBox();
  if (!pb) return false;
  await page.mouse.click(pb.x + pb.width / 2, pb.y + pb.height / 2, { button: "right" });
  await page.waitForTimeout(650);
  const shard = page.locator('[data-radial] [data-shard="draw"]').first();
  if (!(await shard.count())) return false;
  await shard.click({ force: true });
  await page.waitForTimeout(1200);
  const bb = await page.locator("[data-draw-board]").boundingBox();
  if (!bb) return false;
  await page.mouse.move(bb.x + points[0][0] * bb.width, bb.y + points[0][1] * bb.height);
  await page.mouse.down();
  for (const [x, y] of points) { await page.mouse.move(bb.x + x * bb.width, bb.y + y * bb.height); await page.waitForTimeout(4); }
  await page.mouse.up();
  await page.waitForTimeout(400);
  await page.locator("[data-draw-words]").fill(words);
  await page.keyboard.press("Enter");
  return true;
};

const settle = async (want) => {
  for (let i = 0; i < 70; i++) {
    await page.waitForTimeout(1000);
    const s = await read();
    if (s.made >= want) break;
  }
  await page.waitForTimeout(1400);
  return read();
};

check("the board takes a circle", await drawOne(circle, "a card of one claim"));
let state = await settle(1);
console.log(`     traced: ${JSON.stringify(state.code)}`);
console.log(`     said:   ${state.said}`);
check("the tracer is the only thing asked", drawn.length >= 1 && wrote.length === 0, `${drawn.length} traced, ${wrote.length} written`);
check("it is asked to vectorize, and given the picture", drawn[0]?.body?.kind === "vectorize" && typeof drawn[0]?.body?.picture === "string" && drawn[0].body.picture.length > 100,
  `${drawn[0]?.body?.kind}, ${drawn[0]?.body?.picture?.length ?? 0} bytes of PNG`);
check("nothing describing the drawing goes with it", !drawn[0]?.body?.prompt && !drawn[0]?.body?.words, JSON.stringify(Object.keys(drawn[0]?.body ?? {})));
check("the held token rides on the call", drawn[0]?.headers?.["x-replicate-key"] === SECRET, drawn[0]?.headers?.["x-replicate-key"] ? "sent" : "missing");
check("and no Claude key rides with it", !drawn[0]?.headers?.["x-anthropic-key"]);
check("the body kept is the traced one", state.code?.source === "renderer" && state.code?.kind === "vectorize", JSON.stringify(state.code));
check("scored on the same bar, against the drawn outline", (state.code?.overlap ?? 0) >= 0.72, String(state.code?.overlap));
check("what it cost is kept with the part", state.code?.cost === state.code?.attempts * RENDER_COST.vectorize, `${state.code?.cost} over ${state.code?.attempts}`);
check("and reaches the iteration's usage line", state.cost === state.code?.cost, String(state.cost));
check("the second pass fires on its own, with nobody pressing anything", refined.length === 1, `${refined.length} second passes`);
check("it is given the first pass's own picture to work from",
  typeof refined[0]?.body?.first === "string" && refined[0].body.first.length > 100, `${refined[0]?.body?.first?.length ?? 0} bytes of PNG`);
check("the held token rides on it too", refined[0]?.headers?.["x-replicate-key"] === SECRET);
check("and no Claude key rides with it either", !refined[0]?.headers?.["x-anthropic-key"]);
check("what it replaced the body with is recorded on the part",
  state.refined?.model === "openai/gpt-image-2" && state.refined?.cost === null, JSON.stringify(state.refined));
check("both passes are on the bill, separately", state.passes.length === 2
  && /^first pass ·/.test(state.passes[0]) && /^second pass ·/.test(state.passes[1]), state.passes.join(" | "));
check("a pass with no published price says so rather than showing one",
  /cost not reported/.test(state.passes[1] ?? ""), state.passes[1]);
check("the card says it was traced, and the price", /was traced/i.test(state.said) && /\$0\.\d\d/.test(state.said), state.said.slice(0, 110));

/* The one door Claude comes through: nothing traced, and words to work
   from. */
token = false;
const traced = drawn.length;
check("the board takes a second drawing", await drawOne(star, "a star of five claims"));
state = await settle(2);
console.log(`     written: ${JSON.stringify(state.code)}`);
check("with nothing traced, the tracer is asked once and no more", drawn.length === traced + 1, `${drawn.length - traced} calls on the second drawing`);
/*
 * A written body is still a first pass that landed, so the second pass is
 * fired on it too — and with no token it answers that it did not run. That
 * is the contract: never silent. A person looking at a body that was meant
 * to be replaced is told why it was not.
 */
check("a written body gets a second pass offered to it as well", refined.length === 2, `${refined.length} second passes in total`);
check("…and with no token it says on the bill that the better pass did not run", (() => {
  const last = state.passes[state.passes.length - 1] ?? "";
  return /^second pass ·/.test(last) && /did not run/.test(last) && /token/.test(last);
})(), state.passes[state.passes.length - 1]);
check("and the words get a written body instead", wrote.length > 0 && state.code?.source === "written", `${wrote.length} written, ${state.code?.source}`);
check("the writer is given the drawing as its reference", typeof wrote[0]?.body?.picture === "string" && wrote[0].body.picture.length > 100, `${wrote[0]?.body?.picture?.length ?? 0} bytes of PNG`);
check("nothing is charged for a tracer that was not there", !state.code?.cost, String(state.code?.cost));
check("and the card says why it fell back", /Replicate token/i.test(state.said), state.said.slice(-110));

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
