import { SWEEP } from "../src/features/studio/reassemble.ts";
/**
 * What the prompt named and the part is not showing: said when he picks the
 * part, outside it, and only about words a page would actually show.
 *
 * HIS REPORT. The "1 NOT SHOWN" badge sat inside the part, bottom right, on
 * every unpicked part that tripped it. On a 32×32 header button it wrapped
 * to 42×22 and covered the icon it was describing and spilled onto the part
 * beside it; picking the part hid the badge (a picked part is drawn live,
 * and the badge was board-only), so the one moment he could see the icon
 * was the one moment he could not see why it was flagged. He ruled: nothing
 * until he picks the part, and then say what is missing.
 *
 * And on those header buttons it was wrong as well as in the way. A capture
 * writes the browser's accessible name into the prompt — `named “Creator
 * Hub”` — and that is what a screen reader says, not words the page draws:
 * the real button is an icon in a box and shows no words at all. So a name
 * or a placeholder the capture recorded is never counted as copy asked for.
 *
 * Held:
 *   · no badge anywhere on the board while nothing is picked;
 *   · picked, a part short of real copy says so, naming the words, and the
 *     words sit wholly outside the part's own box;
 *   · picked, a part whose only quoted words are its accessible name says
 *     nothing; nor does a part that shows what its prompt quoted.
 *
 * The parts are found by `[data-node-id]`, which every part on the board
 * has, never by `[data-part-box]`, which most do not.
 *
 *   npx next start -p 3013
 *   node tests/badge-selected.mjs http://127.0.0.1:3013
 */
import { createRequire } from "node:module";
const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_ = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const node = (id, f, content, x, y, w, h, extra = {}) => ({
  id, pageId: "p0", featureId: f, label: id, prompt: "", content, data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
  ...extra,
});

const CAPTURED = (name) => `Captured from example.test/ as body > header > button. The box, the words, the colours and the type are the ones measured on the page. The browser computes it as a button, named “${name}”.`;

const doc = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [
    /* His header button: an icon in a box, its only quoted words its accessible name. */
    node("hub", "box", "", 900, 120, 32, 32, { prompt: CAPTURED("Creator Hub"), edge: { width: 1, style: "solid", colour: "rgb(45, 55, 72)" } }),
    /* A field whose placeholder the capture recorded: also never drawn words. */
    node("field", "box", "", 960, 120, 200, 32, { prompt: "The browser computes it as a textbox, named “Ask or search”, placeholder “Ask or search…”." }),
    /* Real copy asked for and not carried. */
    node("short", "value-prop", "Hello there", 200, 300, 420, 120, { prompt: 'An eyebrow reading "BUILT FOR THE NEXT BLOCK" over the heading.' }),
    /* His SOL WORKS logo: a picture the node holds and this browser does not
       have. Its quoted words are its accessible name, but the picture itself
       really is missing, and that is worth saying. */
    node("logo", "picture", "", 700, 300, 112, 112, {
      prompt: "The browser computes it as a image, named \u201cSOL WORKS\u201d.",
      picture: { id: "pic_not_here", path: "assets/pictures/pic_not_here.png", type: "image/png", w: 1024, h: 1024, bytes: 1, alt: "", from: "upload" },
    }),
    /* Control: a picture part with no picture of its own is a stand-in by design, not a failed load. */
    node("standin", "picture", "", 900, 300, 112, 112, { prompt: "The browser computes it as a image, named \u201cSolana\u201d." }),
    /* Real copy asked for and carried: the control. */
    node("kept", "value-prop", "Stay in the loop", 200, 520, 420, 120, { prompt: 'The heading reads "Stay in the loop".' }),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "BADGES", gimmick: "", master: "" },
  /* Marked as already swept: the sweep on open (`tests/sweep-on-open.mjs`)
     puts a captured board right without being asked, and would take the empty
     search field out of this one before the badges were looked at. The mark
     makes it stand aside so the badges are what is under test. */
  frameWidth: 1440, activePageId: "p0", trail: [], swept: SWEEP,
}, version: 0 });

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"], ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await context.addInitScript((d) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("builder.studio", d); sessionStorage.setItem("seeded", "1"); } }, doc);
const page = await context.newPage();
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);

const drawn = await page.evaluate(() => [...document.querySelectorAll("[data-node-id]")].map((n) => n.getAttribute("data-node-id")));
check("all six parts are on the board", ["hub", "field", "short", "kept", "logo", "standin"].every((id) => drawn.includes(id)), drawn.join(", "));

/* Visible badges: any [data-asked-for] that is rendered and not transparent. */
const badges = () => page.evaluate(() => [...document.querySelectorAll("[data-asked-for]")].filter((b) => {
  const r = b.getBoundingClientRect();
  if (!r.width || !r.height) return false;
  for (let e = b; e; e = e.parentElement) { const c = getComputedStyle(e); if (c.display === "none" || c.visibility === "hidden" || +c.opacity < 0.05) return false; }
  return true;
}).map((b) => {
  const r = b.getBoundingClientRect();
  return { owner: b.closest("[data-node-id]")?.getAttribute("data-node-id") ?? null, text: b.textContent ?? "", rect: [r.left, r.top, r.right, r.bottom] };
}));

await page.mouse.move(5, 5);
await page.waitForTimeout(700);
const idle = await badges();
check("nothing picked: no badge anywhere on the board", idle.length === 0, idle.map((b) => `${b.owner}: ${b.text}`).join("; ") || "none");

const pick = async (id) => {
  const bx = await page.locator(`[data-node-id="${id}"]`).boundingBox();
  await page.mouse.click(bx.x + 3, bx.y + bx.height - 3);
  await page.waitForTimeout(1000);
  const own = await page.evaluate((id) => {
    const n = document.querySelector(`[data-node-id="${id}"]`);
    const r = n.getBoundingClientRect();
    return { picked: !!n.querySelector("[data-resize]"), rect: [r.left, r.top, r.right, r.bottom] };
  }, id);
  return { ...own, badges: (await badges()).filter((b) => b.owner === id) };
};
const overlaps = (a, b) => Math.min(a[2], b[2]) - Math.max(a[0], b[0]) > 0.5 && Math.min(a[3], b[3]) - Math.max(a[1], b[1]) > 0.5;

const short = await pick("short");
check("the part short of copy is picked", short.picked);
check("…and says what is missing", short.badges.length === 1 && /BUILT FOR THE NEXT BLOCK/i.test(short.badges[0].text), short.badges.map((b) => b.text).join("; ") || "no badge");
check("…outside its own box", short.badges.length === 1 && !overlaps(short.badges[0].rect, short.rect), JSON.stringify({ badge: short.badges[0]?.rect, part: short.rect }));

const hub = await pick("hub");
check("the header button is picked", hub.picked);
check("…and its accessible name is not called missing copy", hub.badges.length === 0, hub.badges.map((b) => b.text).join("; ") || "none");

const field = await pick("field");
check("a field's recorded name and placeholder are not called missing copy", field.picked && field.badges.length === 0, field.badges.map((b) => b.text).join("; ") || "none");

const logo = await pick("logo");
check("the picture that did not arrive is picked, and really is lost", logo.picked && (await page.locator('[data-node-id="logo"] [data-picture-lost]').count()) === 1);
check("…and says its picture is not shown, by name", logo.badges.length === 1 && /picture/i.test(logo.badges[0].text) && /SOL WORKS/.test(logo.badges[0].text), logo.badges.map((b) => b.text).join("; ") || "no badge");
check("…outside its own box", logo.badges.length === 1 && !overlaps(logo.badges[0].rect, logo.rect), JSON.stringify({ badge: logo.badges[0]?.rect, part: logo.rect }));

const standin = await pick("standin");
check("a stand-in picture, which never had a file, is not called missing", standin.picked && standin.badges.length === 0, standin.badges.map((b) => b.text).join("; ") || "none");

const kept = await pick("kept");
check("a part showing what its prompt quoted says nothing", kept.picked && kept.badges.length === 0, kept.badges.map((b) => b.text).join("; ") || "none");

await page.mouse.click(5, 900);
await page.waitForTimeout(700);
const after = await badges();
check("picked away: no badge anywhere again", after.length === 0, after.map((b) => `${b.owner}: ${b.text}`).join("; ") || "none");

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
