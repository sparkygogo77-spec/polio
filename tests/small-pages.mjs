/**
 * PAGES ON A TABLET AND A PHONE: THE BOARD, THE COMPANION AND THE PUBLISHED SITE.
 *
 * The owner, on Trump & Morty: Phone and Tablet cut the desktop layout off
 * (the title, the BUY button, the copy-address bar and the TV ran off the
 * edge, the nav was gone); the published page carried a 1280 viewport, so a
 * phone got a shrunken desktop with tiny words; and the companion window was
 * blank. On three pages (`fixtures/small-sites.mjs`: a coin site's first
 * screen, the captured Sol Works dashboard, a new site from the shelf), at
 * 834 and 390, held here:
 *
 *   · nothing on the board is wider than the page, and no words run off it;
 *   · everything to press is at least 44px each way;
 *   · the Menu opens and lists the nav;
 *   · the parts come in the desktop's reading order;
 *   · the companion window draws the page, at a sane height;
 *   · a part hidden "On phone" goes from the phone only;
 *   · the published site at that window width is the same page: device-width
 *     viewport, each part one element (no copies: the layouts are rules on
 *     the same parts), nothing sideways, the same parts in the same order as
 *     the board, a Menu that opens;
 *   · a press in a block kept whole and scaled (a ticker chip drawn 25px
 *     tall) still takes a press 44px each way round its middle.
 *
 * Screenshots of each page at the three widths go to .screenshots/lane-d/.
 *
 *   npx next start -p 3013
 *   node tests/small-pages.mjs http://127.0.0.1:3013
 */
import { existsSync, mkdirSync } from "node:fs";
import { chromium } from "playwright-core";
import { SITES } from "./fixtures/small-sites.mjs";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const SHOTS = ".screenshots/lane-d";
mkdirSync(SHOTS, { recursive: true });
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });

/*
 * What a page in a small layout is held to, read in the page: `root` is the
 * small page's own box, `scale` how far the board's frame is zoomed.
 * The page is one element per part at every width; what is in a block kept
 * whole and scaled stands in a box drawn absolutely (`.sm-gi`).
 */
const AUDIT = ([sel, scale]) => {
  const root = document.querySelector(sel);
  if (!root) return null;
  const R = root.getBoundingClientRect();
  const PRESS = "a[href], button, summary, [role=button], [data-small-menu-button]";
  const vis = (el) => { for (let e = el; e && e !== root; e = e.parentElement) { const c = getComputedStyle(e); if (c.display === "none" || c.visibility === "hidden") return false; } const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const inKeep = (el) => { for (let e = el.parentElement; e && e !== root; e = e.parentElement) if (e.classList.contains("sm-gi") && getComputedStyle(e).position === "absolute") return true; return false; };
  /* What a box hides of its own content is clipped by it; read each element against what is around it. */
  const clipped = (el) => { const r = el.getBoundingClientRect(); let L = R.left, Rr = R.right; for (let e = el.parentElement; e && e !== root; e = e.parentElement) { const c = getComputedStyle(e); if (c.overflowX !== "visible") { const q = e.getBoundingClientRect(); L = Math.max(L, q.left); Rr = Math.min(Rr, q.right); } } return { r, L, Rr }; };
  /* A press is a tap each way: a point 21.5px (of the page) from its middle, up, down, left and right, still presses it. */
  const hitArea = (el) => {
    el.scrollIntoView({ block: "center", inline: "nearest" });
    const q = el.getBoundingClientRect();
    const cx = q.left + q.width / 2, cy = q.top + q.height / 2, d = 21.5 * scale;
    const own = (t) => !!t && (t === el || el.contains(t) || t.closest(PRESS) === el);
    const miss = [[cx, cy - d], [cx, cy + d], [cx - d, cy], [cx + d, cy]].filter(([x, y]) => !own(document.elementFromPoint(x, y)));
    return { ok: miss.length === 0, w: Math.round(q.width / scale), h: Math.round(q.height / scale) };
  };
  const wide = [], cut = [], small = [], keptSmall = [];
  const presses = [];
  for (const el of root.querySelectorAll("*")) {
    if (!vis(el) || el.closest("[aria-hidden='true']")) continue;
    const ownText = [...el.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim());
    const { r, L, Rr } = clipped(el);
    const kept = inKeep(el);
    if (el.closest(".sm-p") && !kept && (r.right > R.right + 1 || r.left < R.left - 1)) wide.push(`${el.tagName.toLowerCase()} ${Math.round(r.left - R.left)}..${Math.round(r.right - R.left)}`);
    /* Words: none past the page's edge or the box that clips them. */
    if (ownText && (r.right > Math.min(R.right, Rr) + 2 || r.left < Math.max(R.left, L) - 2)) cut.push(`"${el.textContent.trim().slice(0, 24)}"`);
    const c = getComputedStyle(el);
    if (ownText && c.overflowX !== "visible" && el.scrollWidth > el.clientWidth + 2 && c.textOverflow !== "clip") cut.push(`"${el.textContent.trim().slice(0, 24)}" overflows its box`);
    if (el.matches(PRESS) && !el.parentElement.closest(PRESS)) presses.push([el, kept]);
  }
  for (const [el, kept] of presses) {
    const h = hitArea(el);
    const name = `${(el.textContent || el.getAttribute("aria-label") || el.tagName).trim().slice(0, 16)} ${h.w}x${h.h}`;
    if (!h.ok) (kept ? keptSmall : small).push(name);
  }
  /* The parts in the order they are seen: top to bottom, then left to right. */
  const seen = [...root.querySelectorAll(".sm-p")].filter(vis).map((e) => ({ id: e.getAttribute("data-live-node") ?? e.id, r: e.getBoundingClientRect() }));
  const order = seen.sort((a, b) => Math.round(a.r.top) - Math.round(b.r.top) || a.r.left - b.r.left).map((x) => x.id).filter(Boolean);
  return { width: Math.round(R.width / scale), height: Math.round(R.height / scale), over: root.scrollWidth - root.clientWidth, wide, cut, small, keptSmall, order };
};

function inversions(order, nodes) {
  const by = new Map(nodes.map((n) => [n.id, n]));
  const seen = new Set();
  const seq = order.filter((id) => !seen.has(id) && seen.add(id)).map((id) => by.get(id)).filter(Boolean);
  let bad = 0, pairs = 0;
  for (let i = 0; i < seq.length; i++) for (let j = i + 1; j < seq.length; j++) {
    const a = seq[i], b = seq[j];
    if (Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) <= 0) continue;
    pairs++;
    if (b.y + b.h <= a.y) bad++;
  }
  return { bad, pairs };
}

for (const [name, make] of Object.entries(SITES)) {
  const doc = make();
  const nodes = doc.nodes.filter((n) => n.pageId === doc.activePageId);
  const context = await browser.newContext({ viewport: { width: 1500, height: 2400 } });
  await context.addInitScript((d) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("builder.studio", JSON.stringify({ state: { ...d, view: "desktop" }, version: 0 })); sessionStorage.setItem("seeded", "1"); } }, doc);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-device-switch]", { timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/${name}-desktop.png` });

  const board = {};
  for (const device of ["tablet", "phone"]) {
    const W = device === "phone" ? 390 : 834;
    await page.locator(`[data-device="${device}"]`).click();
    await page.waitForSelector(`[data-small-frame="${device}"]`, { timeout: 10000 });
    await page.waitForTimeout(1200);
    const scale = await page.evaluate((d) => { const f = document.querySelector(`[data-small-frame="${d}"]`); return f ? f.getBoundingClientRect().width / (d === "phone" ? 390 : 834) : 1; }, device);
    const a = await page.evaluate(AUDIT, [`[data-small-frame="${device}"] [data-small-page]`, scale]);
    board[device] = a;
    await page.locator(`[data-small-frame="${device}"]`).screenshot({ path: `${SHOTS}/${name}-${device}.png` });
    check(`${name} on the board at ${W}: the page is ${W} wide and nothing is wider`, !!a && Math.abs(a.width - W) <= 1 && a.over <= 1 && a.wide.length === 0, a ? `${a.width} wide, ${a.over} over${a.wide.length ? `; ${a.wide.slice(0, 3).join(", ")}` : ""}` : "no page");
    check(`${name} at ${W}: no words run off the page`, !!a && a.cut.length === 0, a?.cut.slice(0, 4).join(", ") || "none");
    check(`${name} at ${W}: everything to press is at least 44px each way`, !!a && a.small.length === 0, a?.small.slice(0, 4).join(", ") || "all");
    check(`${name} at ${W}: …and so is everything in a block kept whole and scaled, its look untouched`, !!a && a.keptSmall.length === 0, a?.keptSmall.slice(0, 4).join(", ") || "all");
    const inv = a ? inversions(a.order, nodes) : { bad: 1, pairs: 0 };
    check(`${name} at ${W}: the parts come in the desktop's reading order`, inv.bad <= Math.max(1, inv.pairs * 0.02), `${inv.bad} of ${inv.pairs} pairs out of order`);
    const menu = page.locator(`[data-small-frame="${device}"] [data-small-menu-button]`);
    if (await menu.count()) {
      await menu.first().click();
      await page.waitForTimeout(300);
      const links = await page.locator(`[data-small-frame="${device}"] :is(.sm-p, .sm-g)`).evaluateAll((els) => els.filter((e) => getComputedStyle(e).position === "fixed" && e.getBoundingClientRect().height > 0).length);
      check(`${name} at ${W}: the Menu opens and lists the nav`, links >= 3, `${links} in it`);
      await page.locator(`[data-small-frame="${device}"]`).screenshot({ path: `${SHOTS}/${name}-${device}-menu.png` });
      await menu.first().click();
    }
  }

  /* A part hidden on a phone goes from the phone only. */
  {
    const target = nodes.find((n) => !board.phone.order.length || board.phone.order.includes(n.id) && !["box"].includes(n.featureId) && board.tablet.order.includes(n.id));
    await page.locator(`[data-small-frame="phone"] [data-live-node="${target.id}"]`).first().click({ force: true });
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: "Hide on phone" }).click();
    await page.waitForTimeout(500);
    const shown = (d) => page.locator(`[data-small-frame="${d}"] [data-live-node="${target.id}"]`).evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height > 0).length);
    const onPhone = await shown("phone");
    await page.locator('[data-device="tablet"]').click();
    await page.waitForTimeout(800);
    const onTablet = await shown("tablet");
    await page.locator('[data-device="desktop"]').click();
    await page.waitForTimeout(800);
    const onDesk = await page.locator(`[data-frame] ~ * [data-node-id="${target.id}"], [data-node-id="${target.id}"]`).count();
    check(`${name}: hidden "On phone", ${target.id} goes from the phone only`, onPhone === 0 && onTablet > 0 && onDesk > 0, `phone ${onPhone}, tablet ${onTablet}, desktop ${onDesk}`);
    await page.locator('[data-device="phone"]').click();
    await page.waitForTimeout(800);
    await page.getByRole("button", { name: /hidden here/ }).click();
    await page.getByRole("button", { name: "Show on phone" }).first().click().catch(() => {});
    await page.keyboard.press("Control+z");
    await page.keyboard.press("Control+z");
    await page.locator('[data-device="desktop"]').click();
    await page.waitForTimeout(600);
  }

  /* The companion window beside the board draws the phone page. */
  {
    const toggle = page.getByRole("button", { name: "Toggle companion" });
    if (await toggle.count()) {
      const isOpen = await page.locator("[data-companion-page]").count();
      if (!isOpen) await toggle.click();
      await page.waitForTimeout(1200);
      const c = await page.evaluate(() => { const box = document.querySelector("[data-companion-page]"); if (!box) return null; const r = box.getBoundingClientRect(); return { h: Math.round(r.height), parts: box.querySelectorAll("[data-live-node]").length, inside: [...box.querySelectorAll("[data-live-node]")].every((e) => { const q = e.getBoundingClientRect(); return q.width === 0 || (q.left >= r.left - 1 && q.right <= r.right + 1); }) }; });
      check(`${name}: the companion window draws the page, at a sane height`, !!c && c.parts > 0 && c.h > 100 && c.h < 20000 && c.inside, c ? `${c.parts} parts, ${c.h}px tall, ${c.inside ? "all inside" : "some outside"}` : "none");
    }
  }

  /* The published site at a phone's and a tablet's width. */
  {
    const files = (await page.evaluate(async () => (window.__studioExport ? await window.__studioExport() : null))) ?? [];
    const byPath = new Map(files.map((f) => [f.path.replace(/^\/+/, ""), f]));
    const index = byPath.get("index.html");
    check(`${name}: the published page has a device-width viewport`, !!index && /name="viewport" content="width=device-width/.test(index.content), index ? (/<meta name="viewport"[^>]*>/.exec(index.content)?.[0] ?? "none") : "no index.html");
    for (const device of ["tablet", "phone"]) {
      const W = device === "phone" ? 390 : 834;
      const out = await browser.newPage({ viewport: { width: W, height: 900 } });
      await out.route("http://site.test/**", (r) => {
        const path = decodeURIComponent(new URL(r.request().url()).pathname.replace(/^\/+/, "")) || "index.html";
        const f = byPath.get(path) ?? byPath.get(`${path}/index.html`.replace(/^\//, ""));
        if (!f) return r.fulfill({ status: 404, body: "" });
        const type = path.endsWith(".css") ? "text/css" : path.endsWith(".js") ? "text/javascript" : path.endsWith(".png") ? "image/png" : path.endsWith(".svg") ? "image/svg+xml" : "text/html";
        return r.fulfill({ status: 200, contentType: type, body: f.encoding === "base64" ? Buffer.from(f.content, "base64") : f.content });
      });
      await out.goto("http://site.test/index.html", { waitUntil: "load" });
      await out.waitForTimeout(800);
      /* One page: each part one element, whatever the width. */
      const once = await out.evaluate((ids) => {
        const twice = ids.filter((id) => document.querySelectorAll(`#${CSS.escape(id)}`).length > 1);
        const none = ids.filter((id) => !document.getElementById(id));
        return { twice, none: none.length, copies: document.querySelectorAll(".at-wide, .at-tablet, .at-phone").length, sideways: document.documentElement.scrollWidth - innerWidth };
      }, nodes.map((n) => n.id));
      check(`${name} published at ${W}: one element per part, no copies, and nothing scrolls sideways`, once.twice.length === 0 && once.copies === 0 && once.sideways <= 0, JSON.stringify({ twice: once.twice.slice(0, 3), copies: once.copies, sideways: once.sideways, missing: once.none }));
      const a = await out.evaluate(AUDIT, [".sm-page", 1]);
      check(`${name} published at ${W}: no words run off, everything to press 44px each way`, !!a && a.cut.length === 0 && a.small.length === 0 && a.keptSmall.length === 0, a ? [...a.cut.slice(0, 2), ...a.small.slice(0, 2), ...a.keptSmall.slice(0, 2)].join(", ") || "clean" : "none");
      const same = a && JSON.stringify(a.order) === JSON.stringify(board[device].order);
      check(`${name} published at ${W}: the same parts in the same order as the board`, !!same, a ? (same ? `${a.order.length} parts` : `published ${a.order.slice(0, 8).join(" ")} … board ${board[device].order.slice(0, 8).join(" ")}`) : "none");
      const pm = out.locator(".sm-menu-button");
      if (await pm.count() && await pm.first().isVisible()) {
        await pm.first().click();
        await out.waitForTimeout(200);
        const open = await out.evaluate(() => [...document.querySelectorAll(".sm-p, .sm-g")].filter((e) => getComputedStyle(e).position === "fixed" && e.getBoundingClientRect().height > 0).length);
        check(`${name} published at ${W}: the Menu opens and lists the nav`, open >= 3, `${open} in it`);
        await out.screenshot({ path: `${SHOTS}/${name}-published-${device}-menu.png` });
        await pm.first().click();
      }
      await out.screenshot({ path: `${SHOTS}/${name}-published-${device}.png`, fullPage: true });
      await out.close();
    }
  }
  check(`${name}: no page errors`, errors.length === 0, errors.join(" | ").slice(0, 200));
  await context.close();
}

console.log(`\n${results.filter(Boolean).length}/${results.length} pass`);
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
