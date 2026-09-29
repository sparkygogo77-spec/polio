#!/usr/bin/env node
/**
 * A STICKY PANEL NEVER LEAVES ITS SECTION.
 *
 * gotchi.gg's chosen-starter panel is `position: sticky` inside the starter
 * grid: scrolled down, it follows until the grid's foot and stops there. The
 * published export let it stick against the whole page, so it followed the
 * reader down over "bond hearts" and everything after (the owner's report).
 * Every sticky part the capture found inside something less than the page
 * (its parent part, by `from.selector`) is scrolled past, top to bottom, at
 * 1440 and 2000 wide, as the page opens and after each press that shows a
 * sticky part of its own (boo's panel): it must stay inside its parent's box
 * (2px) at every step. Expectations are read off the document and the
 * exported page, never written in.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/sticky-in-section.mjs http://127.0.0.1:3013 <sink site folder> [served export url]
 *
 * <sink site folder> is laid out as sink is (site/document.json,
 * assets/pictures): `sites/gotchi-gg` in sink. With [served export url] the
 * export is not made again: that page is scrolled (the red run, on an
 * export made before the fix).
 */
import { readFileSync, existsSync, mkdtempSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { chromium } from "playwright-core";

const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const SITE = process.argv[3];
let served = process.argv[4] ?? null;
if (!SITE || !existsSync(join(SITE, "site/document.json"))) {
  console.error("usage: node tests/sticky-in-section.mjs <builder url> <sink site folder> [served export url]");
  process.exit(2);
}
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const doc = JSON.parse(readFileSync(join(SITE, "site/document.json"), "utf8"));
const home = doc.pages[0].id;
const nodes = doc.nodes.filter((n) => n.pageId === home);
const bottom = Math.max(...nodes.map((n) => n.y + n.h));
const up = (sel) => sel.slice(0, Math.max(0, sel.lastIndexOf(" > ")));
/* The sticky parts inside less than the page, each with its parent part. */
const bands = nodes
  .filter((n) => n.from?.position === "sticky" && n.from?.selector)
  .map((n) => ({ n, parent: nodes.find((q) => !q.state && q.from?.selector === up(n.from.selector)) }))
  .filter((b) => b.parent && (b.parent.y > 2 || b.parent.y + b.parent.h < bottom - 2));
check("the document has sticky parts inside a section", bands.length > 0, `${bands.length}`);
/* The sticky parts that stick to the whole page (the header). */
const pageBands = nodes.filter((n) => n.from?.position === "sticky" && !n.state && !bands.some((b) => b.n.id === n.id)).map((n) => n.id);
const states = doc.behaviours?.states ?? [];

let server = null;
if (!served) {
  const out = mkdtempSync(join(tmpdir(), "sticky-in-section-"));
  const here = dirname(fileURLToPath(import.meta.url));
  const r = spawnSync(process.execPath, [join(here, "../scripts/export-site.mjs"), BASE, SITE, out], { encoding: "utf8" });
  check("the site exports", r.status === 0, (r.stderr || "").trim().split("\n").pop());
  const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".json": "application/json" };
  server = createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    const f = join(out, p);
    if (!existsSync(f)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": types[extname(f)] ?? "application/octet-stream" });
    res.end(readFileSync(f));
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  served = `http://127.0.0.1:${server.address().port}/`;
}

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
for (const W of [1440, 2000]) {
  const page = await browser.newPage({ viewport: { width: W, height: 900 } });
  /* The press before the scroll (none: the page as it opens), then each press that shows a sticky part of its own. */
  const presses = [null, ...states.filter((s) => s.page === home && s.shows.some((id) => bands.some((b) => b.n.id === id)))];
  for (const st of presses) {
    await page.goto(served, { waitUntil: "load" });
    await page.waitForTimeout(1500);
    if (st) {
      const at = await page.evaluate((id) => { const e = document.getElementById(id); if (!e) return null; e.scrollIntoView({ block: "center" }); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, st.part);
      if (!at) { check(`${W}: pressing "${st.name}" finds its part`, false, st.part); continue; }
      await page.mouse.click(at.x, at.y);
      await page.waitForTimeout(300);
    }
    const H = await page.evaluate(() => document.documentElement.scrollHeight);
    for (const b of bands) {
      let worst = { out: -Infinity, y: null, seen: 0, over: null };
      for (let y = 0; y < H; y += 50) {
        await page.evaluate((y) => scrollTo(0, y), y);
        const g = await page.evaluate(([id, pid, bandIds]) => {
          const e = document.getElementById(id), p = document.getElementById(pid);
          if (!e || !p || getComputedStyle(e).display === "none") return null;
          const r = e.getBoundingClientRect(), q = p.getBoundingClientRect();
          /* Where it meets a band that sticks to the whole page (the header), the header is on top, as on the page. */
          let over = null;
          for (const hid of bandIds) {
            const h = document.getElementById(hid);
            if (!h || h === e) continue;
            const c = h.getBoundingClientRect();
            const x = Math.max(r.left, c.left) + 5, y = Math.max(r.top, c.top) + 2;
            if (x > Math.min(r.right, c.right) - 5 || y > Math.min(r.bottom, c.bottom) - 2) continue;
            const top = document.elementFromPoint(x, y);
            if (top && !h.contains(top)) over = `over ${hid} at scroll ${scrollY}`;
          }
          return { below: r.bottom - q.bottom, above: q.top - r.top, over };
        }, [b.n.id, b.parent.id, pageBands]);
        if (!g) continue;
        worst.seen++;
        if (g.over && !worst.over) worst.over = g.over;
        const out = Math.max(g.below, g.above);
        if (out > worst.out) worst = { out, y, seen: worst.seen };
      }
      if (!worst.seen) continue;
      check(`${W}${st ? `, after pressing "${st.name.slice(0, 12)}"` : ", as it opens"}: stuck, ${b.n.id} goes under the page's own sticky bands (the header)`, !worst.over, worst.over ?? "");
      check(`${W}${st ? `, after pressing "${st.name.slice(0, 12)}"` : ", as it opens"}: sticky ${b.n.id} stays inside its section ${b.parent.id} all the way down`, worst.out <= 2, `${Math.round(worst.out)}px outside at scroll ${worst.y}`);
    }
  }
  await page.close();
}
await browser.close();
server?.close();
const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} FAILED — ${results.length - failed}/${results.length}` : `\nall good — ${results.length}/${results.length}`);
process.exit(failed ? 1 : 0);
