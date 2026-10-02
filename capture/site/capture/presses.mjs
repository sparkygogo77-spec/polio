/**
 * WHAT A PRESS DID, besides what it changed on the page.
 *
 * The states pass (capture-route.mjs `--states`) reads what a press shows by
 * reading the page again. Some presses show nothing there and still do
 * something the owner's Builder then has to be told by hand ("goes
 * nowhere"): a script that navigates (`location.href = …`, a router's
 * `pushState`), one that opens a window, one that copies, and a panel that
 * only arrives a second later. `PRESS_WATCH`, put into the page before its
 * scripts, watches for those while a press is being made, and only then:
 *
 *   __sinkPress.begin()   start watching (and count the page's mutations)
 *   __sinkPress.quiet()   { count, since }: mutations so far, ms since the last
 *   __sinkPress.end()     stop; { count, pushed, pushedBy, opened, copied }
 *                         (pushedBy: "push" when the address was pushed or its
 *                         hash moved, "replace" when it was only replaced)
 *
 * While watching, a `window.open` opens nothing (its address is kept) and a
 * copy is kept as its words (the clipboard is still written, as the page
 * asked). A navigation by the address bar is the capture's own route to
 * answer (network.mjs `guardWrites`, `nav`). Nothing is sent.
 *
 * WHAT A PRESS FLASHES. A "Copy CA" that turns its label into "COPIED!" and
 * slides a toast up from the bottom puts both back on a timer (trumpmorty:
 * 1600 ms and 1900 ms). Read after the press, half of that was already gone,
 * and when was never known. So a timer the page sets while a press is being
 * watched, of `HOLD_MS` or more, is held: it does not run until the capture
 * lets it, so what the press showed stays put while it is read, and each
 * timer is let go on its own to see what it puts back (`holdAfterPress`):
 *
 *   __sinkPress.held()     [{ i, delay, at }]: the timers held, set `at` ms after the press first changed the page (words, elements, a class; never a style a frame loop rewrites), to run `delay` ms later
 *   __sinkPress.release(i) run held timer i now
 *   __sinkPress.releaseAll() run what is left, and hold no more
 *
 * `check-presses.mjs`.
 */
export const PRESS_WATCH = `(() => {
  if (window.__sinkPress) return;
  let on = false, count = 0, last = 0, first = 0, clicked = 0, pushed = null, pushedBy = null, opened = null, copied = null;
  const now = () => performance.now();
  /*
   * The timers a press sets, held (above): only one set once the press has
   * already changed the page since its click, in words, elements or a class
   * (what puts a flash back follows the flash; the
   * page's changes not yet delivered are taken first, so a label changed a
   * line earlier counts), and only one of a second or more, the length of a
   * flash rather than of a panel's short wait before it arrives, which is
   * let run and read as it always was. Its own ids, far from the browser's,
   * so a clearTimeout of one forgets it.
   */
  const HOLD_MS = 1000;
  const held = new Map();
  let nextId = 0x3fff0000;
  const realSet = window.setTimeout, realClear = window.clearTimeout;
  window.setTimeout = function (fn, delay) {
    const d = Number(delay) || 0;
    if (on && mo) seen(mo.takeRecords());
    if (on && first && d >= HOLD_MS && typeof fn === "function") {
      const id = ++nextId, args = Array.prototype.slice.call(arguments, 2);
      /* Timed from the press's first change: what a visitor sees the flash begin with. */
      held.set(id, { fn, args, delay: d, at: Math.round(now() - first) });
      return id;
    }
    return realSet.apply(window, arguments);
  };
  window.clearTimeout = function (id) { if (held.has(id)) { held.delete(id); return; } return realClear.apply(window, arguments); };
  /* The press's own moment: its click, as the page's handler hears it. */
  addEventListener("click", () => { if (on && !clicked) clicked = now(); }, true);
  const fire = (id) => { const h = held.get(id); if (!h) return; held.delete(id); try { h.fn.apply(window, h.args); } catch (e) { /* the page's own error */ } };
  let mo = null;
  /* What the press put in and took out, by where: the nodes added, the elements a node was taken from, and the elements whose attributes it changed (a panel shown by a class or a hidden taken off). */
  let added = new Set(), takenFrom = new Set(), restyled = new Set(), pageStyled = false;
  const seen = (list) => {
    if (!on) return;
    for (const m of list) {
      if (m.type === "childList") { for (const n of m.addedNodes) if (n.nodeType === 1) added.add(n); if (m.removedNodes.length && m.target.nodeType === 1) takenFrom.add(m.target); }
      /* …not <html> or <body>: a theme or a scroll lock set there shows or hides no one part. */
      else if (m.type === "attributes" && !/^data-sink-/.test(m.attributeName || "") && m.target.nodeType === 1) { if (m.target === document.documentElement || m.target === document.body) pageStyled = true; else restyled.add(m.target); }
      if (m.type === "attributes" && /^data-sink-/.test(m.attributeName || "")) continue;
      count++; last = now();
      /* What the press changed, from its click: words, elements, a class. A style attribute a frame loop rewrites every frame (a marquee, a tilt) is not the press's. */
      if (clicked && !first && !(m.type === "attributes" && m.attributeName === "style")) first = now();
    }
  };
  const start = () => {
    try {
      mo = new MutationObserver(seen);
      mo.observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
    } catch (e) { /* no document yet */ }
  };
  if (document.documentElement) start(); else document.addEventListener("DOMContentLoaded", start, { once: true });
  for (const k of ["pushState", "replaceState"]) {
    const real = history[k];
    history[k] = function (state, title, url) {
      if (on && url != null) { try { pushed = new URL(String(url), location.href).href; pushedBy = k === "pushState" ? "push" : pushedBy ?? "replace"; } catch (e) { /* */ } }
      return real.apply(this, arguments);
    };
  }
  addEventListener("hashchange", () => { if (on) { pushed = location.href; pushedBy = "push"; } });
  const realOpen = window.open;
  window.open = function (url) {
    if (on) { try { opened = new URL(String(url || ""), location.href).href; } catch (e) { opened = String(url || ""); } return null; }
    return realOpen.apply(this, arguments);
  };
  const clip = navigator.clipboard;
  if (clip && clip.writeText) {
    const realWrite = clip.writeText.bind(clip);
    try { clip.writeText = function (t) { if (on) copied = String(t); return realWrite(t).catch(() => undefined); }; } catch (e) { /* */ }
  }
  const realExec = document.execCommand;
  document.execCommand = function (c) {
    if (on && String(c).toLowerCase() === "copy") {
      const s = String((window.getSelection && window.getSelection()) || "");
      const f = document.activeElement;
      copied = s || (f && f.value) || "";
    }
    return realExec.apply(this, arguments);
  };
  window.__sinkPress = {
    begin() { on = true; count = 0; first = clicked = 0; last = now(); pushed = pushedBy = opened = copied = null; added = new Set(); takenFrom = new Set(); restyled = new Set(); pageStyled = false; },
    /*
     * Of the places a read found added (\`plus\`) or gone (\`minus\`), the ones
     * the press did not add, show, take or hide: no node was put in, and no
     * attribute changed, at or above one (or above where one was).
     */
    notByPress(plus, minus) {
      const at = (p) => { let el = document.body; for (const step of String(p).split("::")[0].split(">").slice(1)) { const m = /^([a-z0-9-]+):(\d+)$/i.exec(step); if (!m || !el) return null; let k = 0; el = Array.from(el.children).find((c) => c.localName.toLowerCase() === m[1].toLowerCase() && ++k === Number(m[2])) || null; } return el; };
      /* <html> or <body> set by the press (a menu opened by a class on the page): a layer straight under <body>, fixed or absolute, is what it showed. */
      const layer = (el) => { if (!pageStyled) return false; let n = el; while (n && n.parentElement && n.parentElement !== document.body) n = n.parentElement; if (!n || n.parentElement !== document.body) return false; const pos = getComputedStyle(n).position; return pos === "fixed" || pos === "absolute"; };
      const put = (el) => { if (layer(el)) return true; for (let n = el; n; n = n.parentElement) if (added.has(n) || restyled.has(n)) return true; return false; };
      const took = (p) => { const steps = String(p).split("::")[0].split(">"); for (let i = steps.length - 1; i >= 1; i--) { const el = at(steps.slice(0, i).join(">")); if (el) { for (let n = el; n; n = n.parentElement) if (takenFrom.has(n) || added.has(n) || restyled.has(n)) return true; return false; } } return true; };
      return { plus: plus.filter((p) => { const el = at(p); return el && !put(el); }), minus: minus.filter((p) => !took(p)) };
    },
    quiet() { return { count, since: Math.round(now() - last) }; },
    /* What the page changed and the browser has not told yet is taken in first: a panel added as the press ends is the press's. */
    end() { if (mo) seen(mo.takeRecords()); on = false; return { count, pushed, pushedBy, opened, copied, held: held.size }; },
    held() { return [...held.entries()].map(([i, h]) => ({ i, delay: h.delay, at: h.at })).sort((a, b) => a.at + a.delay - (b.at + b.delay)); },
    release(i) { fire(i); },
    releaseAll() { on = false; for (const i of [...held.keys()]) fire(i); },
  };
})();`;

/**
 * Wait for what a press brings to settle: once something changed, until the
 * page has been still for `still` ms; if nothing did, `idle` ms for a panel
 * that arrives late; never past `most` ms.
 */
export async function afterPress(page, { still = 350, idle = 1200, most = 2000 } = {}) {
  const t0 = Date.now();
  for (;;) {
    const q = await page.evaluate(() => window.__sinkPress?.quiet() ?? { count: 0, since: 0 }).catch(() => ({ count: 0, since: 0 }));
    const spent = Date.now() - t0;
    if (spent >= most) return q;
    if (q.count > 0 && q.since >= still) return q;
    if (q.count === 0 && spent >= idle) return q;
    await page.waitForTimeout(100);
  }
}

/**
 * When each thing a press flashed goes back. `paths` are the places the
 * press changed (the dump's `p`); `sign(p)` in the page is what one looks
 * like now (its words, classes and style attribute, and those of what is in
 * it). The held timers are let go one at a time, in the order they would
 * have run: a place whose look changes as timer i runs was put back by it,
 * at `at + delay` ms after the press. What no timer puts back stays.
 * Returns { [path]: ms }.
 */
export async function holdAfterPress(page, paths) {
  const timers = await page.evaluate(() => window.__sinkPress?.held() ?? []).catch(() => []);
  const back = {};
  if (!timers.length || !paths.length) { await page.evaluate(() => window.__sinkPress?.releaseAll()).catch(() => {}); return back; }
  const signs = () => page.evaluate((ps) => {
    const at = (p) => {
      let el = document.body;
      for (const step of p.split(">").slice(1)) {
        const m = /^([a-z0-9-]+):(\d+)$/i.exec(step);
        if (!m || !el) return null;
        let k = 0;
        el = Array.from(el.children).find((c) => c.localName.toLowerCase() === m[1].toLowerCase() && ++k === Number(m[2])) ?? null;
      }
      return el;
    };
    const one = (el) => (el ? `${el.textContent}|${el.className?.baseVal ?? el.className}|${el.getAttribute("style") ?? ""}|${Array.from(el.querySelectorAll("*")).slice(0, 50).map((k) => `${k.className?.baseVal ?? k.className}/${k.getAttribute("style") ?? ""}`).join(",")}` : "∅");
    return Object.fromEntries(ps.map((p) => [p, one(at(p.split("::")[0]))]));
  }, paths).catch(() => ({}));
  let was = await signs();
  for (const t of timers) {
    await page.evaluate((i) => window.__sinkPress?.release(i), t.i).catch(() => {});
    await page.waitForTimeout(60);
    const now = await signs();
    for (const p of paths) if (back[p] === undefined && now[p] !== was[p]) back[p] = t.at + t.delay;
    was = now;
  }
  await page.evaluate(() => window.__sinkPress?.releaseAll()).catch(() => {});
  return back;
}
