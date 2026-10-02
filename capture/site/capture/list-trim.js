/*
 * A LONG LIST IS THE BACKEND'S DATA, NOT THE DESIGN (the owner, 2026-09-29).
 *
 * Runs in the page before its own scripts (capture-route.mjs adds it to
 * every load). A box whose children are mostly one shape repeated
 * (ROWS_MIN or more: the same tag, classes and child tags) and that runs
 * past a little more than one window (TRIM_SCREENS window heights from its
 * first item) keeps only the items that start inside that height; the rest
 * are taken out of the page, so the browser lays the section out at the
 * height of what is kept and what follows moves up with it. A list that
 * grows as it is scrolled (an endless feed) or that the page rebuilds (a
 * live table) is trimmed again each time, so the capture's scrolling never
 * makes it longer. What it had is kept on the list for the dump:
 * `window.__sinkTrims` (the list -> { of, kept, endless, rebuilt }).
 *
 * A row of items on one line (a marquee's track, a nav) is never cut: only
 * items that start below the kept height go. A list that is not laid out
 * (a hidden tab) is left as it is until it is.
 */
(() => {
  if (window.__sinkTrims) return;
  const ROWS_MIN = 12, TRIM_SCREENS = 1.2;
  const trims = (window.__sinkTrims = new Map());
  const shapeOf = (k) => `${k.tagName}.${[...k.classList].sort().join(".")}>${Array.from(k.children).map((c) => c.tagName).join(",")}`;
  const SKIP = new Set(["SCRIPT", "STYLE", "TEMPLATE", "NOSCRIPT", "HEAD", "HTML", "svg", "SVG"]);
  const trim = (el) => {
    if (!el || !el.isConnected || SKIP.has(el.tagName) || el instanceof SVGElement) return;
    const all = Array.from(el.children);
    const had = trims.get(el);
    if (all.length < ROWS_MIN && !had) return;
    const by = new Map();
    for (const k of all) { const sh = shapeOf(k); by.set(sh, (by.get(sh) ?? 0) + 1); }
    const most = Math.max(...by.values());
    if (!had && most < ROWS_MIN) return;
    /* Rebuilt: none of the rows kept last time is still in it (a live table redrawn). Grown: they are, and more came after them (an endless feed). */
    const rebuilt = !!had && ![...had.items].some((k) => k.parentElement === el);
    if (had && all.length <= had.kept) { if (rebuilt) { had.rebuilt = true; had.items = new Set(all); } return; }
    const first = all.find((k) => k.getBoundingClientRect().height > 0);
    if (!first) return;
    const top = first.getBoundingClientRect().top, limit = top + TRIM_SCREENS * innerHeight;
    const keep = all.filter((k) => k.getBoundingClientRect().top < limit);
    if (keep.length === all.length) return;
    const t = had ?? { of: 0, kept: 0, endless: false, rebuilt: false, items: new Set() };
    if (rebuilt) { t.rebuilt = true; t.of = Math.max(t.of, all.length); }
    else if (had) { t.endless = true; t.of += all.length - had.kept; }
    else t.of = all.length;
    for (const k of all) if (!keep.includes(k)) k.remove();
    t.kept = keep.length; t.items = new Set(keep);
    trims.set(el, t);
  };
  let queued = new Set(), pending = false;
  const flush = () => { pending = false; const q = queued; queued = new Set(); for (const el of q) trim(el); };
  const ask = (el) => { queued.add(el); if (!pending) { pending = true; requestAnimationFrame(flush); } };
  new MutationObserver((ms) => { for (const m of ms) if (m.type === "childList" && m.addedNodes.length) ask(m.target); }).observe(document, { childList: true, subtree: true });
  /* Once laid out, and again when the window changes: a list the parser built before any frame. */
  const sweep = () => { for (const el of document.querySelectorAll("body *")) if (el.children.length >= ROWS_MIN) ask(el); };
  addEventListener("DOMContentLoaded", sweep);
  addEventListener("load", sweep);
  addEventListener("resize", sweep);
})();
