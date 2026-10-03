#!/usr/bin/env node
/**
 * AN INLINE SVG ICON COMES IN AS THE PAGE DRAWS IT.
 *
 * PonsStars' titles (PR #24 and #27) carry their icons as inline svgs
 * filled with currentColor: "▮ PonsStars test page" with an orange TV,
 * "Find a match" with crossed swords. Brought in, each was a picture with no
 * file: drawn as the library's stand-in, 71px tall with its alt words over
 * the heading, and its path as a solid block on top. Scored against PST's
 * Play (tests/tv-import.mjs check 7, against PST at 3921a92), 1440 matched
 * 105 of 126 parts and 390 95 of 119; with the icons drawn, 120 of 126 and
 * 111 of 119.
 *
 * Read the way the zip door reads a page (`PARTS`, then `pagesToDoc`):
 *   · the icon is a part of its own size, painted by a copy of the svg with
 *     the colours it takes from the page written on (currentColor, the
 *     stylesheet's fill), never a picture with nothing in it;
 *   · its path keeps its hook and paints nothing over it;
 *   · a hooked circle (PST's duel) is still a part of its own, drawn there,
 *     and left out of the copy so it is not drawn twice;
 *   · the copy, drawn, is the page's orange where the page is orange.
 *
 *   node tests/svg-icons.mjs
 *
 * Covers: src/features/studio/siteRead.ts, src/features/studio/pageParts.ts
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { PARTS } from "../src/features/studio/siteRead.ts";
import { pagesToDoc } from "../src/features/studio/pageParts.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const HTML = `<!doctype html><html><head><style>
body { margin: 0; font: 16px/1.4 sans-serif; background: #fdf0dc; color: #1a0f0b; }
h1 { display: flex; gap: 8px; align-items: center; margin: 20px; font-size: 28px; }
[data-hook="page-title-icon"] { width: 28px; height: 28px; color: rgb(242, 140, 56); }
[data-hook="duel"] { width: 120px; height: 120px; margin: 20px; }
[data-hook="duel-ring"] { fill: rgb(40, 200, 120); }
</style></head><body>
<h1 data-hook="page-title"><svg data-hook="page-title-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path data-hook="page-title-icon-shape" fill-rule="evenodd" d="M2 5h20v14H2zM5 8v8h14V8z"/></svg> <span data-hook="page-title-text">PonsStars test page</span></h1>
<svg data-hook="duel" viewBox="0 0 120 120"><circle data-hook="duel-circle-me" cx="40" cy="60" r="30" fill="rgb(255, 0, 0)"/><path data-hook="duel-ring" d="M0 0h20v20H0z"/></svg>
</body></html>`;

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.setContent(HTML);
const read = await page.evaluate(PARTS, 1500);
const { doc } = pagesToDoc([{ file: "web/index.html", read }], { at: 1 });
const hook = (h) => doc.nodes.find((n) => n.hooks?.["data-hook"] === h);

const icon = hook("page-title-icon");
const bg = icon?.art?.background ?? "";
check("the icon is a part of its own size", icon?.w === 28 && icon?.h === 28, JSON.stringify(icon && [icon.w, icon.h]));
check("painted by a copy of its svg, not a picture with nothing in it", /^url\("data:image\/svg\+xml/.test(bg) && icon?.featureId !== "image" && !icon?.picture, `${icon?.featureId} ${bg.slice(0, 40)}`);
check("the copy carries the page's colour for currentColor", decodeURIComponent(bg).includes("fill:rgb(242, 140, 56)"));
const shape = hook("page-title-icon-shape");
check("its path keeps its hook and paints nothing over it", !!shape && !shape.colour?.bg && !shape.edge, JSON.stringify(shape?.colour));
const me = hook("duel-circle-me"), ring = hook("duel-ring");
const duel = decodeURIComponent(hook("duel")?.art?.background ?? "");
check("a hooked circle is still a part of its own, drawn there", me?.colour?.bg === "rgb(255, 0, 0)" && me?.shape === "circle", JSON.stringify(me?.colour));
check("and left out of the copy, so it is not drawn twice", /visibility="hidden"/.test(duel) && duel.includes("fill:rgb(40, 200, 120)") && !ring?.colour?.bg);

/* The copy, drawn: orange where the page's icon is orange, and see-through in its hole. */
const px = await page.evaluate(async (src) => {
  const i = new Image();
  i.src = src.replace(/^url\("|"\)$/g, "");
  await i.decode();
  const c = document.createElement("canvas");
  c.width = 28; c.height = 28;
  const g = c.getContext("2d");
  g.drawImage(i, 0, 0, 28, 28);
  return { edge: [...g.getImageData(3, 6, 1, 1).data], hole: [...g.getImageData(14, 14, 1, 1).data] };
}, bg);
check("drawn, it is the page's orange, with its hole left open", px.edge[0] === 242 && px.edge[1] === 140 && px.edge[3] === 255 && px.hole[3] === 0, JSON.stringify(px));

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
