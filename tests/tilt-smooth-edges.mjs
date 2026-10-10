#!/usr/bin/env node
/**
 * A TILTED PANEL KEEPS SMOOTH EDGES.
 *
 * J (2026-10-10): "the tilt on hover is now producing jagged edges". A panel
 * leaning in 3D is drawn on a layer of its own whose outer edge the browser
 * does not smooth, so a border or hard shadow reaching that edge showed as
 * steps. While it tilts, the raise gives it a clear outline wider than its
 * shadow; once it settles its own outline is back. Runs the kit's
 * vendor/builder-motion.js (the Tilt effect and the whole-site hover tilt):
 *
 *   node tests/tilt-smooth-edges.mjs
 *
 * Covers: src/features/studio/shelf/library/raiseJs.ts, scripts/kit-motion.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const here = dirname(fileURLToPath(import.meta.url));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const file = readFileSync(join(here, "..", "kit", "starter", "vendor", "builder-motion.js"), "utf8");
const PANEL = "width: 600px; height: 100px; background: #930000; border: 3px solid #1c0f0a; border-radius: 24px; box-shadow: 6px 6px 0 #1c0f0a;";
const page = (motion, site) => `<!doctype html><html><head><style>
  body { margin: 0; padding: 40px; background: #fdf0dc; }
  [data-hook="a"] { ${PANEL} }
  ${motion ? `[data-hook="a"] { --builder-motion: "${motion}"; }` : ""}
  ${site ? `:root { --builder-site-motion: "${site}"; }` : ""}
</style></head><body><div data-hook="a" data-panel></div><script>${file}</script></body></html>`;

/* Blended pixels along the panel's top and shadow's bottom edges: a smoothed edge has them, a stepped one hardly any. */
const blended = async (p) => {
  const png = await p.screenshot({ clip: { x: 0, y: 0, width: 700, height: 200 } });
  return p.evaluate(async (b64) => {
    const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode();
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
    const g = c.getContext("2d"); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    const near = (i, r, gg, b) => Math.abs(d[i] - r) + Math.abs(d[i + 1] - gg) + Math.abs(d[i + 2] - b) < 24;
    let n = 0;
    for (let x = 120; x < 560; x++) for (let y = 0; y < c.height; y++) {
      const i = (y * c.width + x) * 4;
      if (near(i, 253, 240, 220) || near(i, 28, 15, 10) || near(i, 147, 0, 0)) continue;
      const up = ((y - 1) * c.width + x) * 4, down = ((y + 1) * c.width + x) * 4;
      if (y > 0 && y < c.height - 1 && (near(up, 253, 240, 220) || near(down, 253, 240, 220))) n++;
    }
    return n;
  }, png.toString("base64"));
};

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
try {
  const p = await browser.newPage({ viewport: { width: 800, height: 300 } });
  /* The same lean with no rim, as the stepped edge to beat. */
  await p.setContent(`<!doctype html><body style="margin:0;padding:40px;background:#fdf0dc"><div style="${PANEL} transform: perspective(900px) rotateX(-1.5deg) rotateY(2.5deg)"></div></body>`);
  await p.waitForTimeout(100);
  const stepped = await blended(p);
  for (const [label, motion, site] of [["The Tilt effect", "tilt?strength=3", ""], ["The whole-site hover tilt", "", "hover-tilt"]]) {
    await p.setContent(page(motion, site));
    await p.mouse.move(780, 290);
    await p.mouse.move(600, 75, { steps: 4 });
    await p.waitForTimeout(300);
    const st = await p.evaluate(() => { const a = document.querySelector('[data-hook="a"]'); return { t: a.style.transform, o: getComputedStyle(a).outlineWidth, c: getComputedStyle(a).outlineColor }; });
    check(`${label}: the panel leans`, /rotate/.test(st.t), st.t);
    check(`${label}: while it leans it has a clear rim wider than its shadow`, parseFloat(st.o) > 6 && /rgba\(0, 0, 0, 0\)|transparent/.test(st.c), `${st.o} ${st.c}`);
    const smooth = await blended(p);
    check(`${label}: its edges are smoothed, not stepped`, smooth > stepped * 2 && smooth > 40, `${smooth} blended pixels, ${stepped} with no rim`);
    await p.mouse.move(780, 290, { steps: 2 });
    await p.waitForTimeout(600);
    const back = await p.evaluate(() => { const a = document.querySelector('[data-hook="a"]'); return `${a.style.outline}|${a.style.outlineOffset}`; });
    check(`${label}: once settled its own outline is back`, back === "|", back);
  }

  /* A part with its own outline (a focus ring) keeps it while it leans. */
  await p.setContent(page("tilt", "").replace("border-radius: 24px;", "border-radius: 24px; outline: 2px solid #00f;"));
  await p.mouse.move(780, 290);
  await p.mouse.move(600, 75, { steps: 4 });
  await p.waitForTimeout(100);
  const own = await p.evaluate(() => getComputedStyle(document.querySelector('[data-hook="a"]')).outlineColor);
  check("A part with its own outline keeps it", own === "rgb(0, 0, 255)", own);
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed} of ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
