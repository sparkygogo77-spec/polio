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

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
