/**
 * The cube, as a part you drop: no drawing, no model, nothing to interpret.
 *
 * Before a drawing can pick a cube out of a catalogue there has to be a
 * cube, and it has to be an ordinary part of the library: findable in the
 * shelf, dropped on the board, turned with the hand, written on, and
 * carried by the document into publish and Build like everything else.
 * That is what this holds shut, and it is deliberately the whole feature
 * with the interpretation layer left out.
 *
 *   · it is in the shelf and searching "cube" finds it;
 *   · dropping it makes a cube-3d node and nothing else;
 *   · it shows six faces with something on them before anyone types;
 *   · on the board, once it is the selected part, it turns with the mouse
 *     and steps with the arrow keys, and settles on a face;
 *   · the angle it is left at is written on the node;
 *   · every face is editable afterwards, all six listed;
 *   · and all of it survives a reload and goes into the document.
 *
 *   node tests/cube-part.mjs [url]      # default http://localhost:3000
 */
import { createRequire } from "node:module";
import { REST, facesFrom } from "../src/features/studio/parts/cubeFaces.ts";

/** A pose the cube rests at: the three-quarter yaw a quarter turn at a time, and one of the three rest pitches. */
const atRest = (x, y) => [REST.x - 54, REST.x, REST.x + 90].includes(x) && ((((y - REST.y) % 90) + 90) % 90) === 0;

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

check("a cube with nothing typed still has faces", facesFrom("Overview, How it works, Proof", "").filter((f) => f.heading).length === 3);

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
/*
 * Nothing here may reach a model. Any call fails the run.
 *
 * The net still catches everything under /api/studio so no call escapes to
 * the network, but two of those routes reach no model and must not be
 * counted as one. `publish` is the read the top bar does on load to say
 * which repository this site has; it talks to GitHub, never to a model, and
 * answering it with `{}` is worse than letting it through — the top bar
 * reads `status.github.repo`, which on an empty object throws and takes the
 * whole Builder down with it, so this suite was failing on a blank page
 * rather than on anything about cubes. It gets the shape it reads, with
 * nothing configured, which is the honest answer for a test server.
 */
const NO_MODEL = new Set(["publish", "deploy"]);
const STATUS = { github: { configured: false, token: null, repo: null, branch: "main", missing: ["GITHUB_TOKEN"], allow: null }, vercel: { hook: false } };
const asked = [];
for (const r of ["**/api/studio/**"]) await page.route(r, (route) => {
  const what = route.request().url().split("/").pop().split("?")[0];
  if (!NO_MODEL.has(what)) asked.push(what);
  return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(what === "publish" ? STATUS : {}) });
});

await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);

/* ------------------------------------------------------------------ */
/* 1. In the shelf, and dropped                                        */
/* ------------------------------------------------------------------ */

await page.locator('input[placeholder*="Search parts"]').first().fill("cube");
await page.waitForTimeout(900);
const tile = page.getByText("Cube", { exact: true }).first();
check("searching the shelf for a cube finds one", (await tile.count()) === 1);
check("and the shelf tile is a cube, not an icon of one", (await page.locator("[data-part-preview] [data-cube], [data-cube]").count()) >= 1);

await tile.click({ force: true });
await page.waitForTimeout(1400);
const read = () => page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {};
  const n = (s.nodes ?? []).find((x) => x.featureId === "cube-3d");
  return n ? { id: n.id, w: n.w, h: n.h, outline: n.outline, code: n.code, content: n.content, cube: n.cube } : null;
});
let node = await read();
check("dropping it puts a cube on the board", !!node, node ? `${node.w}×${node.h}` : "nothing");
check("it is a part, not a cutout and not a written body", !node?.outline && !node?.code);
check("no model was called to make one", asked.length === 0, asked.join(" ") || "none");

const cube = page.locator("[data-node-id] [data-cube]").first();
check("the cube is drawn on the board", (await cube.count()) === 1);
check("with something on its faces before anyone types", Number(await cube.getAttribute("data-cube-faces")) >= 3, await cube.getAttribute("data-cube-faces"));
check("and six sides in the DOM", (await cube.locator("[data-face]").count()) === 6, String(await cube.locator("[data-face]").count()));

/* ------------------------------------------------------------------ */
/* 2. Turned, on the board, with the hand                              */
/* ------------------------------------------------------------------ */

// A part dropped from the shelf arrives selected, which is already the
// hands-on state. Let go of it to see the resting one.
await page.mouse.click(1200, 620);
await page.waitForTimeout(600);
check("a cube nobody is holding is inert, so the board can still move it",
  await cube.evaluate((el) => getComputedStyle(el.closest("[data-mode]")).pointerEvents) === "none",
  await cube.evaluate((el) => getComputedStyle(el.closest("[data-mode]")).pointerEvents));

await page.locator(`[data-node-id="${node.id}"]`).click({ force: true });
await page.waitForTimeout(700);
check("picking it up hands it the pointer",
  await cube.evaluate((el) => getComputedStyle(el.closest("[data-mode]")).pointerEvents) === "auto");

/*
 * The ground goes away for the turning.
 *
 * The cube settles over animation *frames*, not over wall-clock time, so how
 * long it takes to reach a face depends on the frame rate. The nebula behind
 * it is four window-sized layers the compositor carries every frame, and on
 * a container with no GPU that takes the page to a 50ms beat — a third of
 * the frames in the same 2.6s, and the cube is still mid-turn when this
 * looks. Put the ground away and this measures the cube.
 *
 * Worth knowing rather than working around: on a slow machine the settle is
 * slow for a person too. A settle driven by elapsed time rather than by
 * frames would not care.
 */
const noGround = await page.addStyleTag({ content: "[data-ground-clouds],[data-ground-sparks]{display:none !important}" });
await page.waitForTimeout(300);

const box = await cube.boundingBox();
const turnOf = () => cube.getAttribute("data-cube-turn");
const before = await turnOf();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
for (let i = 1; i <= 14; i++) { await page.mouse.move(box.x + box.width / 2 + i * 8, box.y + box.height / 2 - i * 2); await page.waitForTimeout(16); }
const mid = await turnOf();
await page.mouse.up();
check("dragging turns it", mid !== before, `${before} → ${mid}`);
check("and the element did not move instead", (await read()).w === node.w);
await page.waitForTimeout(2600);
{
  const [x, y] = (await turnOf()).split(",").map(Number);
  check("letting go brings it to rest at a three-quarter view", atRest(x, y), `${x},${y}`);
  check("where it was left is written on the node", !!(await read()).cube?.turn, JSON.stringify((await read()).cube?.turn));
}
{
  const seen = new Set();
  await cube.focus();
  for (let i = 0; i < 4; i++) {
    seen.add(await cube.getAttribute("data-cube-face"));
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(700);
  }
  check("the arrow keys step round all four sides", seen.size === 4, [...seen].join(" "));
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(800);
  check("and up to the top", (await cube.getAttribute("data-cube-face")) === "top", await cube.getAttribute("data-cube-face"));
}

/* ------------------------------------------------------------------ */
/* 3. Written on, afterwards                                           */
/* ------------------------------------------------------------------ */

/* Picking a part no longer brings Element to the front: the five side tabs
   are permanent and only a press moves them, so a panel being worked in
   cannot be taken away mid-adjustment. Element is one press away. */
const openElement = async () => {
  const tab = page.locator("[data-side-panel] [role=radio]").filter({ hasText: "Element" }).first();
  if (await tab.count()) await tab.click().catch(() => {});
  await page.waitForTimeout(250);
};
await openElement();
const panel = page.locator("[data-face-list]").first();
check("the panel lists all six faces", (await panel.locator("[data-cube-face]").count()) === 6, String(await panel.locator("[data-cube-face]").count()));
await panel.locator('[data-cube-face="front"] input').first().fill("Speed");
await page.waitForTimeout(500);
await panel.locator('[data-cube-face="front"] textarea').first().fill("under a second, every time");
await page.waitForTimeout(500);
await panel.locator('[data-cube-face="right"] input').first().fill("Proof");
await page.waitForTimeout(500);
await panel.locator('[data-cube-face="right"] button[aria-label$="accent"]').click();
await page.waitForTimeout(500);
{
  const now = await read();
  check("a face takes a heading and a line", now?.cube?.faces?.[0]?.heading === "Speed" && now.cube.faces[0].body === "under a second, every time");
  check("another takes a colour from the palette", now?.cube?.faces?.[1]?.colour === "accent", now?.cube?.faces?.[1]?.colour ?? "-");
  check("and the cube on the board shows what was written", (await cube.innerText()).includes("Speed"), (await cube.innerText()).replace(/\s+/g, " ").slice(0, 60));
}
await panel.locator('[data-cube-face="front"] button[aria-label^="Clear"]').click();
await page.waitForTimeout(500);
check("a face can be cleared", !(await read())?.cube?.faces?.[0]?.heading);
await panel.locator('[data-cube-face="front"] input').first().fill("Speed");
await page.waitForTimeout(500);

/* ------------------------------------------------------------------ */
/* 4. Kept                                                             */
/* ------------------------------------------------------------------ */

await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1500);
{
  const after = await read();
  check("the words survive a reload", after?.cube?.faces?.[0]?.heading === "Speed" && after?.cube?.faces?.[1]?.heading === "Proof",
    (after?.cube?.faces ?? []).map((f) => f.heading || "-").join(" · "));
  check("so does the angle it was left at", !!after?.cube?.turn, JSON.stringify(after?.cube?.turn));
  check("and it is still a cube on the board", (await page.locator("[data-cube]").count()) >= 1);
  const doc = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem("builder.studio")).state.nodes));
  check("the faces are in the document publish sends", doc.includes('"Speed"') && doc.includes('"cube-3d"'));
}

/* And it turns on the live page the same way. */
await page.locator("[data-preview-toggle]").click();
await page.waitForTimeout(1700);
{
  const livecube = page.locator("[data-cube]").first();
  check("it is on the live page too", (await livecube.count()) === 1);
  const b = await livecube.boundingBox();
  const was = await livecube.getAttribute("data-cube-turn");
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) { await page.mouse.move(b.x + b.width / 2 + i * 9, b.y + b.height / 2); await page.waitForTimeout(16); }
  await page.mouse.up();
  await page.waitForTimeout(300);
  check("and it turns there too", (await livecube.getAttribute("data-cube-turn")) !== was, `${was} → ${await livecube.getAttribute("data-cube-turn")}`);
}

check("still nothing asked of any model", asked.length === 0, asked.join(" ") || "none");

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
