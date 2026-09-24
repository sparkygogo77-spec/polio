/**
 * A captured button that carries no words draws none.
 *
 * His wallet button is `button > div > span, span`: the address in green and
 * "7s ago" in grey sit a level below the button's direct child, so the
 * capture keeps them as parts of their own (sink,
 * site/capture/check-button-words.mjs) and the button itself carries no
 * words. The part used to fill an empty label with the library's stand-in,
 * "Get started", in the accent's contrast colour: white words his page never
 * had, drawn under the green and the grey. The stand-in is for a button
 * somebody drags out of the library and has said nothing about; a node that
 * speaks (its colours, its edge, its padding) is not that button.
 *
 * Held here:
 *   · the wallet shape draws no words of its own, on the board and live, and
 *     its parts still draw theirs;
 *   · his sidebar entry, words folded into the button, draws them and still
 *     goes where it points;
 *   · a hand-placed button that says nothing is untouched: same stand-in.
 *
 *   npx next start -p 3013
 *   node tests/button-no-words.mjs http://127.0.0.1:3013
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
const at = (selector) => ({ from: { url: "https://ccc-woad.vercel.app/", host: "ccc-woad.vercel.app", selector, at: 1 } });

/* The wallet button as the capture writes it once it stops gathering words it does not fold. */
const W = "body > div > header > div > div:nth-of-type(3) > div:nth-of-type(2) > button";
const ADDRESS = "4HXH...TXxd";
const AGO = "7s ago";
/* His sidebar entry: words folded from a direct child span, grey, set left, leading to its page. */
const S = "body > div > aside > nav > button:nth-of-type(3)";
const ENTRY = "Tokens";
const GREY = "rgb(160, 174, 192)";

const doc = JSON.stringify({ state: {
  pages: [
    { id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" },
    { id: "p1", name: "Tokens", path: "/tokens", prompt: "", scroll: "inherit" },
  ],
  nodes: [
    node("wallet", "cta-primary", "", 1224, 16, 153, 49, {
      ...at(W), options: { shape: "square", variant: "solid", size: "medium" },
      colour: { bg: "rgb(10, 14, 26)", accent: "rgb(10, 14, 26)" },
      layout: { display: "flex", direction: "row", align: "center", gap: 8 },
      pad: { top: 8, right: 12, bottom: 8, left: 12 },
      edge: { width: 1, style: "solid", colour: "rgb(0, 255, 0)" },
    }),
    node("wallet-box", "box", "", 1261, 25, 79, 31, at(`${W} > div`)),
    node("address", "prose", ADDRESS, 1261, 25, 79, 16, { ...at(`${W} > div > span:nth-of-type(1)`), colour: { text: "rgb(0, 255, 0)" }, font: { family: "monospace", size: 0.75, weight: 400, leading: 1.33 } }),
    node("ago", "prose", AGO, 1261, 41, 36, 15, { ...at(`${W} > div > span:nth-of-type(2)`), colour: { text: GREY }, font: { family: "monospace", size: 0.63, weight: 400, leading: 1.5 } }),
    node("entry", "cta-primary", ENTRY, 16, 200, 223, 44, {
      ...at(S), colour: { text: GREY }, font: { weight: 400 }, text: { align: "left" }, edge: { style: "none" },
      link: { kind: "page", target: "p1" },
    }),
    /* Says nothing, carries nothing: the library's button, as it always was. */
    node("plain", "cta-primary", "", 400, 200, 223, 44),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "SINK", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [],
}, version: 0 });

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"], ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) });
const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
await context.addInitScript((d) => localStorage.setItem("builder.studio", d), doc);
const page = await context.newPage();

/* The board labels each part with its name and size, so a part's words are counted in it, not compared whole. */
const once = (text, w) => (text ?? "").split(w).length - 1 === 1;
const words = (attr) => page.evaluate((attr) => {
  const out = {};
  for (const el of document.querySelectorAll(`[${attr}]`)) out[el.getAttribute(attr)] = {
    button: el.querySelector("button")?.innerText.replace(/\s+/g, " ").trim() ?? null,
    all: el.innerText.replace(/\s+/g, " ").trim(),
  };
  return out;
}, attr);

for (const [where, path, attr] of [["the board", "/builder", "data-node-id"], ["the live page", "/builder/preview/", "data-live-node"]]) {
  await page.goto(`${URL_}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1800);
  const on = await words(attr);
  check(`${where}: every part drew`, ["wallet", "address", "ago", "entry", "plain"].every((id) => id in on), Object.keys(on).join(", "));
  check(`${where}: the wallet button draws no words of its own`, on.wallet?.button === "", JSON.stringify(on.wallet?.button));
  check(`${where}: …while its address and its age are still drawn, once each, by their own parts`, once(on.address?.all, ADDRESS) && once(on.ago?.all, AGO), `${on.address?.all} / ${on.ago?.all}`);
  check(`${where}: his sidebar entry still draws the words folded into it`, on.entry?.button === ENTRY, JSON.stringify(on.entry?.button));
  check(`${where}: a hand-placed button that says nothing keeps the library's stand-in`, !!on.plain?.button, JSON.stringify(on.plain?.button));
}

/* Pressed live, it has no link, so the part answers "Done ✓": not in words drawn over his. */
const wallet = await page.locator('[data-live-node="wallet"] button').first().boundingBox();
if (wallet) await page.mouse.click(wallet.x + 4, wallet.y + 4);
await page.waitForTimeout(200);
const pressed = (await words("data-live-node")).wallet?.button;
check("pressed live, the wallet button still draws no words over its own parts", pressed === "", JSON.stringify(pressed));
await page.waitForTimeout(1300);

/* Still a button: the sidebar entry goes where it points. */
const target = await page.locator('[data-live-node="entry"] button').first().boundingBox();
if (target) {
  await page.mouse.click(target.x + target.width / 2, target.y + target.height / 2);
  await page.waitForTimeout(1200);
}
const went = await page.evaluate(() => document.querySelector("[data-live-page]")?.getAttribute("data-live-page") ?? "");
check("pressing his sidebar entry still goes to its page", went === "p1", went || "nowhere");

await browser.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
