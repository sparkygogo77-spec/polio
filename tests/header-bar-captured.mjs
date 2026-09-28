/**
 * THE HEADER BAR IS THE PAGE'S OWN: ITS CAPTURED RULE, ONCE.
 *
 * trumpmorty.fun's header takes `.site-header.scrolled` 45px down the page:
 * background #f3d440, box-shadow 0 4px 0 #1a0f0b, and its padding closes from
 * 14px to 8px top and bottom. Sink records the rule (`behaviours.scrollClass
 * [].rules`) and the states either side. The hand-over (`captured.ts`) took
 * the fill and the edge off the computed state and dropped the padding, so
 * the bar stood 12px taller than the page's. It now reads the rule first, and
 * gives one Header bar feature per header however the record repeats it; the
 * feature closes the padding on the part's own box with the fill.
 *
 *   node tests/header-bar-captured.mjs
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const L = join(here, "..", "src", "features", "studio", "library");
const { attachCaptured } = await jiti.import(join(L, "captured.ts"));
const beh = await jiti.import(join(L, "behaviours.ts"));
const { usesOf } = await jiti.import(join(L, "works.ts"));

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const header = { id: "n_box_229", pageId: "page_home", featureId: "box", x: 0, y: 0, w: 1440, h: 84, from: { selector: "body > header", position: "fixed" }, pad: { top: 14, bottom: 14, left: 36, right: 36 } };
const rec = { part: "n_box_229", selector: "body > header", class: "scrolled", at: 45, toggles: true,
  before: { background: "rgba(0, 0, 0, 0)", boxShadow: "none", paddingTop: "14px", paddingBottom: "14px" },
  after: { background: "rgb(243, 212, 64)", boxShadow: "rgb(26, 15, 11) 0px 4px 0px 0px", paddingTop: "8px", paddingBottom: "8px" },
  transition: "background 0.3s, box-shadow 0.3s, padding 0.3s",
  rules: [{ selector: ".site-header.scrolled", style: { background: "#f3d440", "box-shadow": "0 4px 0 #1a0f0b", "padding-top": "8px", "padding-bottom": "8px" } }] };
const out = attachCaptured([structuredClone(header)], { version: 1, scrollClass: [rec, structuredClone(rec)] });
const uses = usesOf(out[0].work).filter((w) => w.id === "scroll-header");
check("one Header bar on the header, though the record names it twice", uses.length === 1, JSON.stringify(out[0].work));
const inp = uses[0]?.inputs ?? {};
check("…its fill and edge are the page's rule, as written", inp.background === "#f3d440" && inp.edge === "0 4px 0 #1a0f0b", JSON.stringify(inp));
check("…and it closes the padding to the rule's 8px top and bottom", inp.padding === "8px 8px", JSON.stringify(inp));
check("…from 45px down (the last step without it is 40)", inp.at === "40", JSON.stringify(inp));

/* The feature itself sets the padding on the part's own box, and puts it back at the top. */
const work = beh.BEHAVIOURS.find((w) => w.manifest.id === "scroll-header");
const script = work?.script ?? "";
check("the feature reads a padding input and closes the part's own box to it", /inputs\.padding/.test(script) && /paddingTop/.test(script) && /firstElementChild/.test(script), script.slice(0, 120));
check("…and the manifest offers it", !!work?.manifest?.inputs?.some((i) => i.id === "padding"));

/* The parts the header holds (its logo, nav pill, buttons) are fixed parts of their own: the hand-over names them, so the bar can carry them up with its padding. */
const logo = { id: "n_box_230", pageId: "page_home", featureId: "box", x: 36, y: 20, w: 159, h: 44, from: { selector: "body > header > a", position: "fixed" } };
const out2 = attachCaptured([structuredClone(header), logo], { version: 1, scrollClass: [rec] });
const inp2 = usesOf(out2[0].work).find((w) => w.id === "scroll-header")?.inputs ?? {};
check("the hand-over names the parts the header holds", String(inp2.parts ?? "").split(",").includes("n_box_230"), JSON.stringify(inp2));

/* And the script, run: both states, in a browser. */
const { existsSync } = await import("node:fs");
const { createRequire } = await import("node:module");
const { chromium } = createRequire(import.meta.url)("playwright-core");
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.setContent(`<body style="margin:0;height:4000px"><div id="n_box_229" style="position:fixed;left:0;top:0;width:100%;height:81px;min-height:81px;display:flex;flex-direction:column"><div style="padding:14px 36px;flex:1 0 auto"></div></div><div id="n_box_230" style="position:fixed;left:36px;top:20px;width:159px;height:44px"></div></body>`);
const got = await page.evaluate(({ script, inputs }) => {
  let fn = null;
  window.siteFeatures = { define: (_n, f) => { fn = f; } };
  new Function(script)();
  const el = document.getElementById("n_box_229");
  fn(el, inputs);
  const read = () => { const i = el.firstElementChild, c = getComputedStyle(el), ci = getComputedStyle(i); return { bg: c.backgroundColor, shadow: c.boxShadow, pad: `${ci.paddingTop} ${ci.paddingBottom}`, h: Math.round(el.getBoundingClientRect().height) + "px", logo: document.getElementById("n_box_230").style.translate || "none" }; };
  return new Promise((done) => { const top = read(); scrollTo(0, 100); setTimeout(() => { const on = read(); scrollTo(0, 0); setTimeout(() => done({ top, on, back: read() }), 60); }, 60); });
}, { script, inputs: { ...inp2, duration: "0" } });
await browser.close();
check("at the top: no bar, no line, the captured 14px padding", got.top.bg === "rgba(0, 0, 0, 0)" && got.top.shadow === "none" && got.top.pad === "14px 14px", JSON.stringify(got.top));
check("scrolled: the rule's fill, line and 8px padding, 12px shorter, the logo carried up 6px", got.on.bg === "rgb(243, 212, 64)" && /0px 4px 0px/.test(got.on.shadow) && got.on.pad === "8px 8px" && got.on.h === "69px" && /-6px/.test(got.on.logo), JSON.stringify(got.on));
check("back at the top it all goes back", got.back.pad === "14px 14px" && got.back.h === "81px" && got.back.logo === "none", JSON.stringify(got.back));

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
