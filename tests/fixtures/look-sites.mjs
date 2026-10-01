/**
 * A captured site on the board, for the look tests (copy-look, make-all-like,
 * try-look, remix): sink's document for one site loaded whole, the board's
 * state read back, parts picked by clicking them, and the export served.
 *
 *   const s = await openSite(BASE, SINK_ROOT, "trumpmorty-fun");
 *   s.doc()            the board's document now
 *   s.pick(id, more)   click a part (more: hold Shift to add it)
 *   s.served()         the export, served; returns its address
 *   s.paint(p, sel)    what a part's box and words are painted with
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createServer } from "node:http";
import { chromium } from "playwright-core";

export const SITES = ["trumpmorty-fun", "parasiteonsol-fun", "gotchi-gg"];

/** The sink checkout's root from what a test is given: the root itself, or a site folder in it (test-all passes sites/trumpmorty-fun). */
export function sinkRoot(given) {
  const at = given ?? process.env.SINK ?? "../sink";
  if (existsSync(join(at, "sites"))) return at;
  if (existsSync(join(at, "..", "..", "sites"))) return join(at, "..", "..");
  return at;
}

export function siteDoc(root, site) {
  return JSON.parse(readFileSync(join(root, "sites", site, "site", "document.json"), "utf8"));
}

export async function launch() {
  const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
  return chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
}

/**
 * `others`: more sites in Builds beside the open one, each stored as a big
 * board is (docStore.ts): the document in IndexedDB (`builder.docs`/`docs`,
 * keyed `builder.doc:<id>`) and a pointer to it in localStorage.
 */
export async function openSite(browser, BASE, root, site, { width = 1500, height = 1000, others = [] } = {}) {
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/studio/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ github: { configured: false, missing: [] }, vercel: { hook: false } }) }));
  await page.route(/^https:\/\/(?!fonts\.)/, (r) => r.fulfill({ status: 404, body: "" }));
  await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
  await page.evaluate((site) => {
    const env = (s) => JSON.stringify({ state: s, version: 0 });
    localStorage.setItem("builder.builds", env({ projects: [{ id: site, name: site, updatedAt: Date.now() }], activeId: site }));
    localStorage.setItem("builder.studio", env({ nodes: [] }));
  }, site);
  for (const o of others) {
    const text = JSON.stringify({ state: siteDoc(root, o), version: 0 });
    await page.evaluate(async ([id, text]) => {
      await new Promise((done, no) => {
        const req = indexedDB.open("builder.docs", 1);
        req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains("docs")) req.result.createObjectStore("docs"); };
        req.onerror = () => no(req.error);
        req.onsuccess = () => { const tx = req.result.transaction("docs", "readwrite"); tx.objectStore("docs").put(text, `builder.doc:${id}`); tx.oncomplete = () => done(); tx.onerror = () => no(tx.error); };
      });
      const doc = JSON.parse(text).state;
      localStorage.setItem(`builder.doc:${id}`, JSON.stringify({ idb: true, bytes: text.length, pages: doc.pages.length, parts: doc.nodes.length, siteRepo: null }));
      const b = JSON.parse(localStorage.getItem("builder.builds"));
      b.state.projects.push({ id, name: id, updatedAt: Date.now() - 1000 });
      localStorage.setItem("builder.builds", JSON.stringify(b));
    }, [o, text]);
  }
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const doc0 = siteDoc(root, site);
  await page.evaluate((d) => window.__studioLoadDoc(d), { ...doc0, activePageId: doc0.pages[0].id });
  await page.waitForTimeout(2500);
  const doc = () => page.evaluate(() => window.__studioPublishDoc());
  const node = async (id) => (await doc()).nodes.find((n) => n.id === id) ?? null;
  const pick = async (id, more = false) => {
    const el = page.locator(`[data-node-id="${id}"]`).first();
    await el.scrollIntoViewIfNeeded().catch(() => {});
    /* A point on the part where the part itself is on top, not a picture or words inside it. */
    const at = await page.evaluate((id) => {
      const e = document.querySelector(`[data-node-id="${id}"]`);
      const r = e?.getBoundingClientRect();
      if (!r || r.width < 1) return null;
      for (const fy of [0.12, 0.5, 0.88, 0.3, 0.7]) for (const fx of [0.04, 0.96, 0.5, 0.2, 0.8]) {
        const x = r.x + r.width * fx, y = r.y + r.height * fy;
        if (document.elementFromPoint(x, y)?.closest("[data-node-id]")?.getAttribute("data-node-id") === id) return { x, y };
      }
      return { x: r.x + Math.min(8, r.width / 2), y: r.y + Math.min(8, r.height / 2) };
    }, id);
    if (!at) throw new Error(`${id} is not on the board`);
    if (more) await page.keyboard.down("Shift");
    await page.mouse.click(at.x, at.y);
    if (more) await page.keyboard.up("Shift");
    await page.waitForTimeout(350);
  };
  const undoDepth = () => page.evaluate(() => window.__studioUndoDepth());
  let server = null;
  const served = async () => {
    const out = await page.evaluate(async () => (await window.__studioExport()).map((f) => ({ path: f.path, content: typeof f.content === "string" ? f.content : null, b64: f.encoding === "base64" ? f.content : null })));
    const files = new Map(out.map((f) => [f.path, f]));
    server?.close();
    server = createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\//, "") || "index.html";
      if (p.endsWith("/")) p += "index.html";
      const f = files.get(p);
      if (!f) { res.writeHead(404); res.end(); return; }
      const type = p.endsWith(".css") ? "text/css" : p.endsWith(".js") ? "text/javascript" : p.endsWith(".html") ? "text/html" : "application/octet-stream";
      res.writeHead(200, { "content-type": type });
      res.end(f.b64 ? Buffer.from(f.b64, "base64") : f.content ?? "");
    });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    return `http://127.0.0.1:${server.address().port}/`;
  };
  const close = async () => { server?.close(); await page.close(); };
  return { page, errors, doc, node, pick, undoDepth, served, close };
}

/**
 * What a part is painted with: the first element under it that paints a
 * box (a fill, an edge or a shadow) and the first that sets words, read off
 * the browser, from the part's drawn box down: on the board
 * `[data-node-id="…"] [data-part-box]`, in the export `#… > *` (the export
 * keeps no data-*), whatever the words are.
 */
export const PAINT = (sel) => {
  const root = document.querySelector(sel);
  if (!root) return null;
  /* What is shown: the Builder's hints inside a part (a tip waiting for the pointer, at no opacity) are not its paint. */
  const shown = (e) => { for (let x = e; x && x !== root.parentElement; x = x.parentElement) { const c = getComputedStyle(x); if (c.opacity === "0" || c.visibility === "hidden" || c.display === "none") return false; } return true; };
  const all = [root, ...root.querySelectorAll("*")].filter(shown);
  const clear = (v) => v === "transparent" || /rgba\([^)]*,\s*0\)/.test(v);
  const seen = (shadow) => shadow !== "none" && shadow.split(/,(?![^()]*\))/).some((s) => !/^\s*rgba\([^)]*,\s*0\)/.test(s));
  const paints = (c) => !clear(c.backgroundColor) || (parseFloat(c.borderTopWidth) > 0 && !clear(c.borderTopColor)) || seen(c.boxShadow) || c.backgroundImage !== "none";
  const box = all.find((e) => paints(getComputedStyle(e)));
  const words = all.find((e) => [...e.childNodes].some((t) => t.nodeType === 3 && t.nodeValue.trim()));
  const b = box ? getComputedStyle(box) : null, w = words ? getComputedStyle(words) : null;
  return {
    box: b ? { bg: b.backgroundColor, bgi: b.backgroundImage === "none" ? "none" : "image", border: `${b.borderTopWidth} ${b.borderTopStyle} ${b.borderTopColor}`, radius: b.borderTopLeftRadius, shadow: b.boxShadow } : null,
    words: w ? { family: w.fontFamily, size: w.fontSize, weight: w.fontWeight, colour: w.color, spacing: w.letterSpacing, transform: w.textTransform } : null,
  };
};
