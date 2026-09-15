/**
 * Build exports the page at every device, the way Preview reflows it (inventory B22, last piece).
 *
 * The live page lays its parts out three ways: at the board's width the
 * positions are the board's, and at tablet and phone the rows reflow, each
 * part stacked at the device width with the height its words need. The
 * export wrote the desktop layout only and scaled the whole page down on a
 * narrower screen, and said so in the page's own comment. Now each page
 * carries the three placements the live page computes, and the frame picks
 * one by the screen's width, the phone layout on a phone rather than a
 * desktop page a quarter the size.
 *
 *   node tests/export-reflow.mjs
 */
import { readFileSync } from "node:fs";
import { scaffold } from "../src/features/studio/scaffold.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const part = (id, x, y, w, h) => ({ id, pageId: "p", featureId: "prose", label: id, x, y, w, h, html: `<div>${id}</div>` });
const files = scaffold({
  name: "Reflow", frameWidth: 1440,
  pages: [{
    id: "p", name: "Home", path: "/",
    layouts: {
      tablet: { width: 834, height: 700, placed: [{ id: "n_head", x: 0, y: 0, w: 834, h: 76 }, { id: "n_text", x: 12, y: 88, w: 810, h: 118 }] },
      phone: { width: 390, height: 620, placed: [{ id: "n_head", x: 0, y: 0, w: 390, h: 76 }, { id: "n_text", x: 12, y: 88, w: 366, h: 262 }] },
    },
  }],
  palette: { bg: "#000", text: "#fff", accent: "#0f0", muted: "#888", surface: "#111", highlight: "#f0f" },
  tokens: {},
  parts: [part("n_head", 0, 0, 1400, 76), part("n_text", 120, 140, 1200, 80)],
});
const at = (path) => files.find((f) => f.path === path)?.content ?? "";
const page = at("app/page.tsx");
const frame = at("components/Frame.tsx");

check("the page carries the desktop placement as before", /left: 120, top: 140, width: 1200, height: 80/.test(page));
check("and the tablet and phone placements the live page computes", /tablet/.test(page) && /width: 810, height: 118/.test(page) && /phone/.test(page) && /width: 366, height: 262/.test(page), page.match(/width: \d+, height: \d+/g)?.join(" ") ?? "no placements");
check("each placement says its own width and height", /834/.test(page) && /390/.test(page) && /700/.test(page) && /620/.test(page));
check("the frame picks a layout by the screen's width, the phone's on a phone", /matchMedia|innerWidth/.test(frame) && /834/.test(frame) && /390/.test(frame) && /phone/.test(frame));
check("and still scales the desktop layout down between the breakpoints, as before", /scale\(/.test(frame));
check("the page's comment no longer says the page is only scaled", !/rather than reflowing it/.test(page), page.match(/\* The parts sit[^\n]*\n[^\n]*\n[^\n]*/)?.[0]?.slice(0, 200) ?? "");
const run = readFileSync("src/features/studio/scaffoldRun.ts", "utf8");
check("the build places each page at tablet and phone through the live page's own placeNodes (source read)", /placeNodes\(own, device/.test(run) && /layout\("tablet"\)/.test(run) && /layout\("phone"\)/.test(run));

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
