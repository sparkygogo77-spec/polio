/**
 * A CANVAS WORLD'S CHARACTERS, AND WHAT EACH ONE OPENS.
 *
 * parasiteonsol.fun's hero is a canvas its script draws every frame: a field
 * of pets walking, each one a coin. Pressing a pet opens a dialog for that
 * coin (its picture, host or parasite, ticker and name, an amount of SOL to
 * buy with, a sell toggle, its numbers, links). The capture kept the canvas
 * as a flipbook: a loop of pictures with nothing to press. This reads the
 * characters too, for any page, knowing nothing about the page's script:
 *
 * 1. Only a canvas seen repainting (capture-route.mjs `sampleFrames`) is
 *    asked. It is brought into the window and let run.
 * 2. For each frame, the page's animation frames are held (world-recorder.js)
 *    so the picture, and the script's own idea of where everything stands,
 *    stay still; the picture is read, and so is the list of sprites the
 *    script drew it from (every `drawImage`, in canvas pixels).
 * 3. Each small sprite is pressed at its middle with the real mouse, where the
 *    canvas is what the pointer would hit. A press that opens a dialog (a
 *    `<dialog>` opened, or an element marked `aria-modal` or `role=dialog`
 *    appearing) names a character; one that goes to another address names
 *    a character that is a link (the navigation is stopped, the address
 *    kept). Each dialog is read once per character, closed, and the page put
 *    back where it was scrolled.
 * 4. A sprite that stood still since the frame before, at the same place, is
 *    not pressed again: what it answered then is what it answers now.
 *
 * The first frame with no character in it ends the canvas: it is a picture
 * that moves, not a world. What comes back per canvas:
 *
 *   frames   the pictures, one per frame, each shown `every` ms: the flipbook
 *            played back is the frames the characters were read in.
 *   chars    per character: `key` (what the dialog says it is: an id-like
 *            data attribute, else its heading), `name` (its heading),
 *            `boxes` (per frame, [x, y, w, h] as fractions of the canvas
 *            box: the sprites that answered with it, two canvas pixels
 *            round, or null where it was not found), and `dialog` (its
 *            index in `dialogs`) or `href`.
 *   dialogs  each dialog read as the browser drew it: its markup with every
 *            element's computed look given as a class (`atoms`), so it
 *            dresses as live wherever it is put; scripts, handlers and a
 *            form's address taken out; pictures carried as data addresses;
 *            a link within the site by its path, one off it no link at all. Every button, field and link is kept as it was,
 *            with its own attributes, and is marked `data-world-control`
 *            with a name read off its label; a close control is marked
 *            `data-world-close`; what each does is probeControls' below.
 *   atoms    class (`sw1a`) -> the CSS it stands for; `sw1a-b` wears it on
 *            ::before, `-a` ::after, `-m` ::marker, `-p` ::placeholder.
 *            `backdrop` is the ::backdrop.
 */
import { readFileSync } from "node:fs";
import { assemble, readScene } from "./stage.mjs";

export const WORLD_RECORDER = readFileSync(new URL("./world-recorder.js", import.meta.url), "utf8");

/* ------------------------------------------------------------------ */
/* In the page: a dialog read as it is drawn                            */
/* ------------------------------------------------------------------ */

/* Set on every element whatever it is, so nothing of the page the dialog lands on (a reset, a button's own look) shows through. */
const ALWAYS = ["box-sizing", "margin-top", "margin-right", "margin-bottom", "margin-left", "padding-top", "padding-right", "padding-bottom", "padding-left",
  "border-top-width", "border-right-width", "border-bottom-width", "border-left-width", "border-top-style", "border-right-style", "border-bottom-style", "border-left-style",
  "border-top-color", "border-right-color", "border-bottom-color", "border-left-color",
  "border-top-left-radius", "border-top-right-radius", "border-bottom-right-radius", "border-bottom-left-radius",
  "background-color", "background-image", "color", "font-family", "font-size", "font-weight", "font-style", "line-height", "letter-spacing",
  "text-transform", "text-align", "text-decoration-line", "text-decoration-color", "text-decoration-style", "text-decoration-thickness", "text-underline-offset",
  "white-space", "list-style-type", "list-style-position", "vertical-align", "appearance", "outline-style", "outline-width", "outline-color", "outline-offset",
  "box-shadow", "cursor", "opacity", "overflow-x", "overflow-y"];
/* Set only where the page's differs from what the browser gives the same element on its own. */
const WHEN = ["position", "top", "right", "bottom", "left", "z-index", "float", "clear",
  "flex-direction", "flex-wrap", "justify-content", "align-items", "align-content", "align-self", "justify-self", "justify-items", "row-gap", "column-gap",
  "flex-grow", "flex-shrink", "flex-basis", "order", "grid-template-columns", "grid-template-rows", "grid-column-start", "grid-column-end", "grid-row-start", "grid-row-end",
  "grid-auto-flow", "grid-auto-columns", "grid-auto-rows", "min-width", "max-width", "min-height", "max-height", "object-fit", "object-position", "image-rendering",
  "text-overflow", "word-break", "overflow-wrap", "text-shadow", "filter", "transform", "transform-origin", "font-variant-numeric", "font-feature-settings",
  "text-indent", "visibility", "fill", "stroke", "stroke-width", "background-size", "background-position", "background-repeat", "clip-path", "mix-blend-mode",
  "table-layout", "border-collapse", "border-spacing", "hyphens", "font-stretch", "-webkit-text-stroke-width", "-webkit-text-stroke-color", "backdrop-filter"];

/** Runs in the page: `root` (an open dialog) read into markup and atoms. `atoms` is shared by every dialog of the page. */
function readDialog({ ALWAYS, WHEN }) {
  const W = window.__sinkWorlds;
  const root = W.open;
  const atoms = (W.atoms ??= { map: new Map(), css: {} });
  /* What the browser gives an element of a tag on its own, read in a page of nothing. */
  const blank = (W.blank ??= (() => {
    const f = document.createElement("iframe");
    f.setAttribute("aria-hidden", "true");
    f.style.cssText = "position:fixed;left:-9999px;top:0;width:10px;height:10px;border:0;visibility:hidden";
    document.documentElement.appendChild(f);
    f.contentDocument.open(); f.contentDocument.write("<!doctype html><html><body></body></html>"); f.contentDocument.close();
    return { f, by: new Map() };
  })());
  const uaOf = (tag, pseudo) => {
    const k = `${tag}${pseudo ?? ""}`;
    if (blank.by.has(k)) return blank.by.get(k);
    const doc = blank.f.contentDocument;
    let el;
    try { el = doc.createElement(tag); } catch { el = doc.createElement("div"); }
    doc.body.appendChild(el);
    const cs = blank.f.contentWindow.getComputedStyle(el, pseudo ?? null);
    const got = {};
    for (const p of WHEN) got[p] = cs.getPropertyValue(p);
    el.remove();
    blank.by.set(k, got);
    return got;
  };
  const atom = (css) => {
    if (!atoms.map.has(css)) { const c = `sw${atoms.map.size.toString(36)}`; atoms.map.set(css, c); atoms.css[c] = css; }
    return atoms.map.get(css);
  };
  const skipRoot = new Set(["display", "position", "top", "right", "bottom", "left", "margin-top", "margin-right", "margin-bottom", "margin-left", "transform", "z-index"]);
  const styleOf = (el, isRoot, pseudo) => {
    const cs = getComputedStyle(el, pseudo ?? null);
    const tag = el.localName;
    const ua = uaOf(tag, pseudo);
    const out = [];
    const put = (p, v) => { if (isRoot && skipRoot.has(p)) return; if (v !== "" && v !== undefined) out.push(`${p}:${v}`); };
    if (!isRoot) put("display", cs.display);
    for (const p of ALWAYS) put(p, cs.getPropertyValue(p));
    for (const p of WHEN) { const v = cs.getPropertyValue(p); if (v !== ua[p]) put(p, v); }
    /* A size the page gave it: a picture, a field, a box narrower than the room it stands in (a flex or grid child sizes itself). */
    const r = el.getBoundingClientRect();
    const up = el.parentElement ? getComputedStyle(el.parentElement) : null;
    const replaced = /^(img|svg|canvas|input|select|textarea|video|iframe)$/.test(tag);
    if (isRoot) { if (r.width) put("width", `${Math.round(r.width * 100) / 100}px`); }
    else if (!pseudo && r.width && (replaced || (/^(block|flow-root|flex|grid|table|list-item)$/.test(cs.display) && up && !/flex|grid/.test(up.display) && cs.position !== "absolute" && cs.position !== "fixed" && r.width < el.parentElement.clientWidth - parseFloat(up.paddingLeft) - parseFloat(up.paddingRight) - 1))) {
      put("width", cs.width);
    }
    if (!pseudo && replaced && r.height) put("height", cs.height);
    if (pseudo) put("content", cs.content);
    return out.join(";");
  };
  const abs = (u) => { try { return new URL(u, location.href).href; } catch { return u; } };
  /* An address on this site as its path, or null when it is somewhere else. */
  W.within = (u) => { try { const a = new URL(u, location.href); return a.origin === location.origin ? `${a.pathname}${a.search}${a.hash}` : null; } catch { return null; } };
  const slug = (s) => String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
  const labelOf = (el) => el.getAttribute("aria-label") || el.getAttribute("title") || (el.localName === "input" || el.localName === "select" || el.localName === "textarea" ? (el.labels?.[0]?.textContent || el.getAttribute("placeholder") || el.getAttribute("name")) : el.textContent) || "";
  const CLOSE = /^\s*(close|dismiss|cancel|done|×|✕|✖|x)\s*$/i;
  /* An element's look as classes: its own, its ::before and ::after, its marker, a field's placeholder. Kept for the presses (probeControls). */
  const classesOf = (el, isRoot) => {
    const tag = el.localName;
    const classes = [atom(styleOf(el, isRoot, null))];
    for (const ps of ["::before", "::after"]) {
      const cs = getComputedStyle(el, ps);
      if (cs.content && cs.content !== "none" && cs.content !== "normal") classes.push(`${atom(styleOf(el, false, ps))}${ps === "::before" ? "-b" : "-a"}`);
    }
    if (tag === "summary" || getComputedStyle(el).display === "list-item") {
      const m = getComputedStyle(el, "::marker");
      classes.push(`${atom(`color:${m.color};font-size:${m.fontSize};font-family:${m.fontFamily}`)}-m`);
    }
    if (/^(input|textarea)$/.test(tag)) classes.push(`${atom(`color:${getComputedStyle(el, "::placeholder").color}`)}-p`);
    return classes.join(" ");
  };
  W.classesOf = classesOf;
  W.labelOf = labelOf;
  W.CLOSE = CLOSE;

  const clone = root.cloneNode(true);
  const from = [root, ...root.querySelectorAll("*")];
  const to = [clone, ...clone.querySelectorAll("*")];
  const drop = [];
  from.forEach((el, i) => {
    const c = to[i];
    const tag = el.localName;
    if (/^(script|noscript|template|iframe|object|embed)$/.test(tag)) { drop.push(c); return; }
    for (const a of Array.from(c.attributes)) {
      if (/^on/i.test(a.name) || a.name === "style" || a.name === "class" || a.name === "srcset" || a.name === "loading") c.removeAttribute(a.name);
      else if ((a.name === "href" || a.name === "src" || a.name === "action" || a.name === "formaction") && /^\s*javascript:/i.test(a.value)) c.removeAttribute(a.name);
    }
    c.setAttribute("class", classesOf(el, i === 0));
    /* Its place in the dialog, for what a press changes (`data-world-change`) to find it by; kept only where something does. */
    c.setAttribute("data-world-el", String(i));
    /*
     * A link within the site stays a link, by its path. One that leaves the site is not a link in the copy (the
     * owner's rule): it keeps its words, look and stable name, does nothing, and says where it went for a backend.
     */
    if (tag === "a" && el.getAttribute("href")) {
      const to = abs(el.getAttribute("href"));
      const own = W.within(to);
      if (own !== null) c.setAttribute("href", own);
      else {
        c.removeAttribute("href"); c.removeAttribute("target"); c.removeAttribute("rel");
        c.setAttribute("data-world-does", "hook"); c.setAttribute("data-world-offsite", to); c.setAttribute("data-world-hook", "goes off the site"); c.setAttribute("data-world-held", "off-site");
        if (!c.hasAttribute("role")) c.setAttribute("role", "link");
      }
    }
    if (tag === "img") { const s = el.currentSrc || el.getAttribute("src"); if (s) c.setAttribute("src", abs(s)); }
    if (tag === "input") { if (el.value !== undefined) c.setAttribute("value", el.value); if (el.checked) c.setAttribute("checked", ""); else c.removeAttribute("checked"); }
    if (tag === "form") { c.removeAttribute("action"); c.removeAttribute("method"); c.removeAttribute("target"); c.setAttribute("data-world-form", ""); }
    if (tag === "button") { c.setAttribute("type", "button"); c.removeAttribute("formaction"); c.removeAttribute("form"); }
    /* Every control keeps its words and its own attributes, and is named for a backend to find: from its label, else its role and place. */
    if (/^(button|input|select|textarea|summary|a)$/.test(tag) || /^(button|radio|checkbox|switch|tab|link|menuitem)$/.test(el.getAttribute("role") || "")) {
      const said = labelOf(el).trim().replace(/\s+/g, " ");
      c.setAttribute("data-world-control", slug(said) || `${tag}-${i}`);
      if (tag !== "a" && (el.hasAttribute("data-close") || CLOSE.test(said) || el.closest("form[method=dialog]"))) c.setAttribute("data-world-close", "");
    }
  });
  for (const c of drop) c.remove();
  clone.removeAttribute("open");
  const b = getComputedStyle(root, "::backdrop");
  const backdrop = [`background-color:${b.backgroundColor}`, b.backdropFilter && b.backdropFilter !== "none" ? `backdrop-filter:${b.backdropFilter}` : ""].filter(Boolean).join(";");
  const name = (root.querySelector("h1,h2,h3,h4,[role=heading]")?.textContent ?? root.getAttribute("aria-label") ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  /* Each picture with the size it is drawn at, so it is carried no bigger than it needs to be. */
  const drawnAt = new Map(Array.from(root.querySelectorAll("img")).map((im) => { const r = im.getBoundingClientRect(); return [abs(im.currentSrc || im.getAttribute("src") || ""), Math.max(r.width, r.height, Number(im.getAttribute("width")) || 0, Number(im.getAttribute("height")) || 0)]; }));
  return { html: clone.outerHTML, name, backdrop, imgs: Array.from(clone.querySelectorAll("img[src]")).map((i) => ({ src: i.getAttribute("src"), at: drawnAt.get(i.getAttribute("src")) || 0 })) };
}

/* ------------------------------------------------------------------ */
/* Driven from the capture                                              */
/* ------------------------------------------------------------------ */

/**
 * Every canvas world on the page, read. `page` is the Playwright page with
 * world-recorder.js installed; returns how many worlds were found. The
 * result is left in the page as `window.__sinkWorlds[i]` (by the canvas's
 * `data-sink-canvas`) and its frames as `window.__sinkFrames[i]`, for the
 * dump to read.
 */
export async function probeWorlds(page, { frames = 15, every = 200, clicks = 240, log = () => {} } = {}) {
  const has = await page.evaluate(() => !!window.__sinkWorld).catch(() => false);
  if (!has) return 0;
  const targets = await page.evaluate(() => {
    window.__sinkWorlds = { by: {} };
    return Array.from(document.querySelectorAll("canvas[data-sink-canvas]"))
      .filter((c) => window.__sinkFrames?.[c.dataset.sinkCanvas])
      .map((c) => ({ i: c.dataset.sinkCanvas, y: c.getBoundingClientRect().top + scrollY, w: Math.round(c.getBoundingClientRect().width) }));
  });
  if (!targets.length) return 0;
  const vh = page.viewportSize()?.height ?? 900;
  /*
   * A press that would leave the page: its address kept as what the character
   * opens, and answered "204 No Content", on which a browser stays where it is
   * (an aborted navigation would put the browser's error page in its place).
   */
  let leaving = null, guard = false;
  const leave = { at: null };
  /* While a dialog's control is pressed: every request written down, and one that would write stopped (probeControls). */
  let netList = null;
  const quiet = (q) => /^(image|font|stylesheet|media|script|manifest|texttrack)$/.test(q.resourceType()) || q.isNavigationRequest();
  const route = (r) => {
    const q = r.request();
    if (guard && q.isNavigationRequest() && q.frame() === page.mainFrame()) { leaving = q.url(); leave.at = q.url(); return r.fulfill({ status: 204, body: "" }); }
    if (netList && !quiet(q) && !/^(GET|HEAD|OPTIONS)$/.test(q.method())) { netList.push({ method: q.method(), url: q.url(), stopped: true }); return r.abort(); }
    return r.fallback();
  };
  const onRequest = (q) => { if (netList && !quiet(q) && /^(GET|HEAD|OPTIONS)$/.test(q.method())) netList.push({ method: q.method(), url: q.url(), stopped: false }); };
  page.on("request", onRequest);
  /* What the page asks for on its own, with nothing pressed (a chain polled every 250ms): no press's doing. */
  const background = new Set();
  const net = {
    on: (list) => { netList = list; },
    off: () => { const l = netList ?? []; netList = null; for (let i = l.length - 1; i >= 0; i--) if (background.has(redact(l[i].method, l[i].url))) l.splice(i, 1); },
  };
  const listen = async (ms) => { const l = []; netList = l; await page.waitForTimeout(ms); netList = null; for (const q of l) background.add(redact(q.method, q.url)); };
  const popup = async (p) => { if (guard) { leaving = p.url(); await p.close().catch(() => {}); } };
  await page.route("**/*", route);
  page.on("popup", popup);
  /* Up the whole time the world is pressed: a script may leave a moment after the press that asked it to. */
  guard = true;
  let found = 0;
  /* A dialog read for one world is the same dialog in another (the colony drawn twice on a page): read once. */
  const readOnce = new Map();
  /*
   * NO PRESS TWICE. A sprite drawn from a picture only one character has been
   * seen wearing is that character: it is not pressed again to be told so,
   * except every fourth frame, when it is (and a picture found worn by two is
   * pressed every time after). A dialog laid out exactly like one whose
   * controls were already pressed (the same elements and classes: another
   * coin's) has its controls told from that one's, in its own words, and says
   * so (`data-world-inferred`).
   */
  const wornBy = new Map(), shared = new Set(), probed = new Map();
  const stats = { pressed: 0, assumed: 0, probedDialogs: 0, toldDialogs: 0 };
  try {
    for (const t of targets) {
      const top = Math.max(0, Math.round(t.y - 40));
      await page.evaluate((y) => scrollTo(0, y), top);
      await page.waitForTimeout(600);
      const chars = new Map(); /* key -> { key, name, boxes: [], dialog?, href? } */
      const dialogs = [];
      const pictures = [];
      let prev = []; /* the frame before: { s, cx, cy, key|null } */
      let dead = false;
      let art = null;
      /* One scene's frames, held one by one: its characters pressed, its pictures and its draws kept. The first scene's pictures are the flipbook. */
      const runScene = async (sceneNo, count) => {
      const held = [];
      prev = []; dead = false;
      for (let f = 0; f < count && !dead; f++) {
        if (f > 0) { await page.evaluate(() => window.__sinkWorld.release()); await page.waitForTimeout(every); }
        await page.evaluate(() => window.__sinkWorld.hold());
        await page.waitForTimeout(60);
        const shot = await page.evaluate(({ i, top }) => {
          scrollTo(0, top);
          const c = document.querySelector(`canvas[data-sink-canvas="${i}"]`);
          if (!c) return null;
          const r = c.getBoundingClientRect();
          const k = r.width / c.width, kh = r.height / c.height;
          let url = null;
          try { url = c.toDataURL("image/png"); } catch { return null; }
          const area = c.width * c.height;
          const all = window.__sinkWorld.last(c);
          const sprites = all
            .filter((s) => (s.t || "img") === "img" && s.w > 0 && s.h > 0 && s.w * s.h < area / 12 && s.x + s.w / 2 > 0 && s.x + s.w / 2 < c.width && s.y + s.h / 2 > 0 && s.y + s.h / 2 < c.height)
            .map((s) => ({ s: `${s.k}|${s.s.map(Math.round).join(",")}`, x: s.x * k, y: s.y * kh, w: s.w * k, h: s.h * kh, ax: s.x, ay: s.y, aw: s.w, ah: s.h }));
          /* Everything the picture was drawn from, in the canvas's own pixels, for what the world is made of (stage.mjs). */
          const draws = all.map((d) => ({ ...d, ...(d.s ? { s: d.s.map(Math.round) } : {}) }));
          return { url, W: r.width, H: r.height, px: k, sprites, draws, sky: window.__sinkWorld.sky(c), art: { w: c.width, h: c.height } };
        }, { i: t.i, top });
        if (!shot) { dead = true; break; }
        art = shot.art;
        if (sceneNo === 0) pictures.push(shot.url);
        /* One press per place: sprites drawn over each other at one middle are one press. */
        const seen = [];
        const hits = []; /* { key, x, y, w, h } */
        const now = [];
        let pressed = 0;
        for (const s of shot.sprites) {
          const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
          if (seen.some((p) => Math.abs(p.cx - cx) < 2 && Math.abs(p.cy - cy) < 2)) continue;
          seen.push({ cx, cy });
          const still = prev.find((p) => p.s === s.s && Math.abs(p.cx - cx) < 0.5 && Math.abs(p.cy - cy) < 0.5);
          /*
           * A pet walking: the one sprite of its size near where one pet of that
           * size stood the frame before, with no other of its size near it, is
           * that pet one step on (its picture may have changed with the step).
           * Every fourth frame it is pressed anyway, and a pet the guess got
           * wrong is pressed every time after.
           */
          const guess = (() => {
            const reach = Math.max(s.w, s.h) * 1.5;
            const near = (p, q) => Math.abs(p.w - q.w) < 1.5 && Math.abs(p.h - q.h) < 1.5 && Math.hypot(p.cx - q.cx, p.cy - q.cy) < reach;
            const me = { w: s.w, h: s.h, cx, cy };
            const was = prev.filter((p) => p.key && p.w !== undefined && near(p, me));
            if (was.length !== 1 || shared.has(`walk:${was[0].key}`)) return null;
            if (shot.sprites.some((x) => x !== s && near({ w: x.w, h: x.h, cx: x.x + x.w / 2, cy: x.y + x.h / 2 }, was[0]))) return null;
            return was[0].key;
          })();
          let key = null;
          if (still) key = still.key;
          else if (f % 4 !== 0 && wornBy.has(s.s) && !shared.has(s.s) && shot.sprites.filter((x) => x.s === s.s).length === 1) { key = wornBy.get(s.s); stats.assumed++; }
          /*
           * A pet walking: the one sprite of its size near where one pet of that
           * size stood the frame before, and no other of its size near it, is that
           * pet one step on (its picture may have changed with the step). Checked
           * by a press every fourth frame like the rest.
           */
          else if (f % 4 !== 0 && guess) { key = guess; stats.assumed++; }
          else if (pressed < clicks) {
            pressed++; stats.pressed++;
            const at = await page.evaluate(({ i, top, cx, cy }) => {
              if (Math.abs(scrollY - top) > 1) scrollTo(0, top);
              const c = document.querySelector(`canvas[data-sink-canvas="${i}"]`);
              const r = c.getBoundingClientRect();
              const x = r.left + cx, y = r.top + cy;
              if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight || document.elementFromPoint(x, y) !== c) return null;
              const open = (el) => { const cs = getComputedStyle(el); const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0 && cs.display !== "none" && cs.visibility !== "hidden"; };
              window.__sinkWorlds.before = new Set(Array.from(document.querySelectorAll('dialog[open], [aria-modal="true"], [role="dialog"], [role="alertdialog"]')).filter(open));
              return { x, y };
            }, { i: t.i, top, cx, cy });
            if (at) {
              leaving = null;
              await page.mouse.click(at.x, at.y);
              await page.waitForTimeout(40);
              const got = await page.evaluate(() => {
                const open = (el) => { const cs = getComputedStyle(el); const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0 && cs.display !== "none" && cs.visibility !== "hidden"; };
                const d = Array.from(document.querySelectorAll('dialog[open], [aria-modal="true"], [role="dialog"], [role="alertdialog"]')).filter(open).find((el) => !window.__sinkWorlds.before.has(el));
                if (!d) return null;
                window.__sinkWorlds.open = d;
                const idLike = Array.from(d.attributes).filter((a) => /^data-/.test(a.name) && a.value.length >= 6 && !/\s/.test(a.value)).map((a) => a.value);
                const head = (d.querySelector("h1,h2,h3,h4,[role=heading]")?.textContent ?? "").trim().replace(/\s+/g, " ");
                return { key: [...idLike, head].filter(Boolean).join("|") || d.textContent.trim().replace(/\s+/g, " ").slice(0, 80) };
              });
              if (got) {
                key = `d:${got.key}`;
                if (!chars.has(key) && readOnce.has(key)) {
                  dialogs.push(readOnce.get(key).dialog);
                  chars.set(key, { key: got.key, name: readOnce.get(key).name, boxes: [], dialog: dialogs.length - 1 });
                } else if (!chars.has(key)) {
                  /* Its pictures loaded, then read as drawn. */
                  await page.evaluate(() => Promise.race([
                    Promise.all(Array.from(window.__sinkWorlds.open.querySelectorAll("img")).map((im) => { im.loading = "eager"; return im.complete && im.naturalWidth ? null : new Promise((r) => { im.addEventListener("load", r, { once: true }); im.addEventListener("error", r, { once: true }); }); })),
                    new Promise((r) => setTimeout(r, 2500)),
                  ]));
                  const read = await page.evaluate(readDialog, { ALWAYS, WHEN });
                  read.html = await page.evaluate(inlinePictures, read);
                  /* What each of its controls does, pressed on live (probeControls). */
                  if (!background.size) await listen(1200);
                  const point = at, want = got.key;
                  const reopen = async () => {
                    await page.evaluate(() => { const d = window.__sinkWorlds.open; if (d?.localName === "dialog" && d.open) d.close(); for (const m of document.querySelectorAll("dialog[open]")) m.close(); });
                    await page.evaluate((top) => scrollTo(0, top), top);
                    await page.evaluate(() => { window.__sinkWorlds.before = new Set(); });
                    await page.mouse.click(point.x, point.y);
                    await page.waitForTimeout(80);
                    const again = await page.evaluate(() => {
                      const seen = (el) => { const cs = getComputedStyle(el); const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0 && cs.display !== "none" && cs.visibility !== "hidden"; };
                      const d = Array.from(document.querySelectorAll('dialog[open], [aria-modal="true"], [role="dialog"], [role="alertdialog"]')).filter(seen)[0];
                      if (!d) return null;
                      window.__sinkWorlds.open = d;
                      const idLike = Array.from(d.attributes).filter((a) => /^data-/.test(a.name) && a.value.length >= 6 && !/\s/.test(a.value)).map((a) => a.value);
                      const head = (d.querySelector("h1,h2,h3,h4,[role=heading]")?.textContent ?? "").trim().replace(/\s+/g, " ");
                      return [...idLike, head].filter(Boolean).join("|") || d.textContent.trim().replace(/\s+/g, " ").slice(0, 80);
                    });
                    return again === want;
                  };
                  const sig = await page.evaluate(dialogSig).catch(() => null);
                  const snap = await page.evaluate(dialogSnap).catch(() => null);
                  const twin = sig ? probed.get(sig) : null;
                  let fx;
                  if (twin && snap) { fx = tellFx(twin, snap); stats.toldDialogs++; }
                  else {
                    fx = await probeControls(page, { reopen, net, leaving: leave, ids: want.split("|") }).catch((e) => { log(`world ${t.i}: its controls could not all be pressed (${String(e.message ?? e).split("\n")[0]})`); return new Map(); });
                    stats.probedDialogs++;
                    if (sig && snap) probed.set(sig, { fx, snap, dialog: dialogs.length });
                  }
                  read.html = withEffects(read.html, fx);
                  leaving = null;
                  dialogs.push({ html: read.html, backdrop: read.backdrop });
                  readOnce.set(key, { dialog: dialogs[dialogs.length - 1], name: read.name });
                  chars.set(key, { key: got.key, name: read.name, boxes: [], dialog: dialogs.length - 1 });
                }
                await page.evaluate(() => {
                  const d = window.__sinkWorlds.open;
                  if (d.localName === "dialog" && d.open) d.close();
                  else { const x = d.querySelector('[data-close], [aria-label="Close" i], [aria-label="close" i]'); if (x) x.click(); else d.remove(); }
                  window.__sinkWorlds.open = null;
                });
              } else {
                /* Nothing opened: it may be leaving instead, a moment later. */
                for (let k = 0; k < 4 && !leaving; k++) await page.waitForTimeout(40);
                if (leaving) {
                  key = `a:${leaving}`;
                  if (!chars.has(key)) chars.set(key, { key: leaving, name: "", boxes: [], href: leaving });
                }
              }
              leaving = null;
            }
          }
          if (key && !still) { if (wornBy.has(s.s) && wornBy.get(s.s) !== key) shared.add(s.s); else wornBy.set(s.s, key); }
          if (key && guess && guess !== key) { shared.add(`walk:${guess}`); shared.add(`walk:${key}`); }
          now.push({ s: s.s, cx, cy, key, w: s.w, h: s.h });
          if (key) hits.push({ key, s: s.s, x: s.x, y: s.y, w: s.w, h: s.h, ax: s.ax, ay: s.ay, aw: s.aw, ah: s.ah });
        }
        prev = now;
        held.push({ draws: shot.draws, sky: shot.sky, hits: hits.map((h) => ({ key: h.key, s: h.s, x: h.ax, y: h.ay, w: h.aw, h: h.ah })) });
        if (!hits.length && f === 0) { dead = true; break; }
        if (sceneNo > 0) { log(`world ${t.i}: scene ${sceneNo + 1}, frame ${f + 1}/${count}, ${pressed} pressed`); continue; }
        /*
         * WHERE EACH ONE STANDS IN THIS FRAME: the sprites that answered with
         * it, less any that also stand over another character's middle (a
         * host a parasite sits on answers with the parasite, the smaller).
         */
        const byKey = new Map();
        for (const h of hits) (byKey.get(h.key) ?? byKey.set(h.key, []).get(h.key)).push(h);
        for (const [key, list] of byKey) {
          const others = hits.filter((h) => h.key !== key);
          const own = list.filter((h) => !others.some((o) => o.x + o.w / 2 > h.x && o.x + o.w / 2 < h.x + h.w && o.y + o.h / 2 > h.y && o.y + o.h / 2 < h.y + h.h && o.w * o.h < h.w * h.h));
          const use = own.length ? own : list;
          /* Two canvas pixels round it, as a hit test is kind to a pointer at the edge of a sprite. */
          const pad = 2 * shot.px;
          const x0 = Math.min(...use.map((h) => h.x)) - pad, y0 = Math.min(...use.map((h) => h.y)) - pad;
          const x1 = Math.max(...use.map((h) => h.x + h.w)) + pad, y1 = Math.max(...use.map((h) => h.y + h.h)) + pad;
          const r4 = (v) => Math.round(v * 10000) / 10000;
          const c = chars.get(key);
          c.boxes[pictures.length - 1] = [r4(x0 / shot.W), r4(y0 / shot.H), r4((x1 - x0) / shot.W), r4((y1 - y0) / shot.H)];
        }
        log(`world ${t.i}: frame ${f + 1}/${count}, ${pressed} pressed, ${byKey.size} characters`);
      }
      await page.evaluate(() => window.__sinkWorld.release());
      return held;
      };
      const scene0 = await runScene(0, frames);
      if (dead && !chars.size) continue;
      /*
       * ITS SCENES (parasiteonsol.fun's SWAMP / BEACH): the page's own tabs
       * beside the canvas, each pressed (a press that only changes what is
       * shown, never held), and the world read again where it changed the
       * picture's fill or backgrounds. The first tab is pressed again after.
       */
      const scenes = [{ frames: scene0 }];
      const tabs = await page.evaluate(findTabs, t.i).catch(() => []);
      /* A tab pressed where it stands in the window, wherever the page could scroll to. */
      const pressAt = async (tab) => {
        await page.evaluate((y) => scrollTo(0, Math.max(0, y - 80)), tab.y);
        const at = await page.evaluate(({ x, y }) => ({ x: x - scrollX, y: y - scrollY }), { x: tab.x + tab.w / 2, y: tab.y + tab.h / 2 });
        await page.mouse.click(at.x, at.y);
        await page.waitForTimeout(1400);
      };
      const look = (fr) => JSON.stringify([fr?.sky ?? null, (fr?.draws ?? []).filter((d) => d.t === "img" && d.w * d.h >= (art.w * art.h) / 12).map((d) => `${d.k}|${d.s}`).sort()]);
      if (tabs.length > 1) {
        const on = tabs.find((x) => x.on) ?? tabs[0];
        scenes[0].tab = on;
        /* How much of the picture a press changed: a scene of its own changes most of it, however it is painted. */
        const snap = () => page.evaluate((i) => { const c = document.querySelector(`canvas[data-sink-canvas="${i}"]`); try { window.__sinkWorlds.snap = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; } catch { window.__sinkWorlds.snap = null; } }, t.i);
        const changed = () => page.evaluate((i) => {
          const c = document.querySelector(`canvas[data-sink-canvas="${i}"]`), a = window.__sinkWorlds.snap;
          let b; try { b = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; } catch { return 0; }
          if (!a || a.length !== b.length) return 1;
          let n = 0; for (let k = 0; k < a.length; k += 4) if (Math.abs(a[k] - b[k]) + Math.abs(a[k + 1] - b[k + 1]) + Math.abs(a[k + 2] - b[k + 2]) > 24) n++;
          return n / (a.length / 4);
        }, t.i);
        for (const tab of tabs.filter((x) => x !== on)) {
          await snap();
          await pressAt(tab);
          const share = await changed();
          const held = await runScene(scenes.length, Math.max(4, Math.min(frames, 8)));
          if (held.length && (share > 0.35 || look(held[0]) !== look(scene0[0]))) scenes.push({ frames: held, tab });
          else log(`world ${t.i}: "${tab.text}" changed nothing it draws: not a scene`);
        }
        await pressAt(on);
      }
      /*
       * The page's own scale at each window width, and each scene's ground as
       * the page paints it there with its characters, their riders and their
       * labels left out: whatever it draws behind them (a picture, a sky in
       * bands, stars), kept as it is at the widest box of each scale.
       */
      const hide = [...new Set(scenes.flatMap((sc) => sc.frames.flatMap((f) => f.hits.map((h) => h.s))))];
      const sampled = await sampleStage(page, t.i, vh, scenes.map((sc) => sc.tab ?? null), pressAt, hide).catch((e) => { log(`world ${t.i}: its scale and grounds could not be read (${String(e.message ?? e).split("\n")[0]})`); return { scaleAt: [], grounds: [] }; });
      const scaleAt = sampled.scaleAt;
      let stage = null;
      try {
        const built = assemble({ scenes: scenes.map((sc) => ({ name: sc.tab?.text ?? null, tab: sc.tab ? { text: sc.tab.text, x: sc.tab.x, y: sc.tab.y, w: sc.tab.w, h: sc.tab.h } : null, read: readScene(sc.frames, art, every) })), art, px: 1, scaleAt, every });
        stage = built.stage;
        /* The scale it was captured at: its box against its pixels, the page's round number where it is one. */
        const k0 = (t.w ?? 0) / (art?.w || 1), q0 = Math.round(k0 * 4) / 4;
        stage.px = q0 > 0 && Math.abs(k0 - q0) / q0 < 0.03 ? q0 : +k0.toFixed(3);
        await cutImages(page, stage);
        /* Each scene's grounds, one per scale, as pictures of their own; with them its pieces and props are the page's own painting, already in them. */
        stage.scenes.forEach((sc, n) => {
          const mine = sampled.grounds.filter((g) => g.scene === n);
          if (!mine.length) return;
          sc.backgrounds = mine.map((g) => { stage.images.push(g.url); return { img: stage.images.length - 1, w: g.w, h: g.h, px: g.px }; }).sort((a, b) => a.w - b.w);
          sc.layers = []; sc.props = [];
        });
        for (const [key, c] of built.chars) { const ch = chars.get(key); if (ch) Object.assign(ch, c); }
        const order = [...chars.keys()];
        for (const ch of chars.values()) if (ch.ridesKey) { const r = order.indexOf(ch.ridesKey); if (r >= 0) ch.rides = r; delete ch.ridesKey; }
        log(`world ${t.i}: a stage of ${stage.scenes.length} scene${stage.scenes.length === 1 ? "" : "s"}, ${Object.keys(stage.sprites).length} sprites, ${[...chars.values()].filter((c) => c.sprite).length} characters with a sprite, ${[...chars.values()].filter((c) => typeof c.rides === "number").length} riding, scale ${JSON.stringify(scaleAt)}`);
      } catch (e) { log(`world ${t.i}: what it is made of could not be read (${String(e.message ?? e).split("\n")[0]})`); stage = null; }
      const n = pictures.length;
      const list = [...chars.values()].map((c) => ({ ...c, boxes: Array.from({ length: n }, (_, k) => c.boxes[k] ?? null) }));
      if (!list.length || n < 1) continue;
      found++;
      await page.evaluate(({ i, pictures, every, list, dialogs, stage }) => {
        const W = window.__sinkWorlds;
        /* The frames are kept either way; with what it is made of, the document's picture is the still it shows (capture-to-document.mjs) and the world is drawn again live. */
        if (pictures.length > 1) window.__sinkFrames[i] = { frames: pictures, steps: pictures.map((_, k) => [k, every]), every, ms: pictures.length * every, world: true };
        W.by[i] = { every, frames: pictures.length, chars: list, dialogs, ...(stage ? { stage } : {}) };
      }, { i: t.i, pictures, every, list, dialogs, stage });
      log(`world ${t.i}: ${list.length} characters (${list.filter((c) => c.href).length} links), ${dialogs.length} dialogs, ${n} frames`);
    }
  } finally {
    guard = false;
    netList = null;
    await page.unroute("**/*", route).catch(() => {});
    page.off("popup", popup);
    page.off("request", onRequest);
    /* The pointer away from the world, so a callout it hovered is gone before the page is read. */
    await page.mouse.move(1, vh - 1).catch(() => {});
    await page.evaluate(() => {
      const W = window.__sinkWorlds;
      if (W?.atoms) { W.css = W.atoms.css; delete W.atoms; }
      W?.blank?.f?.remove(); if (W) delete W.blank;
      scrollTo(0, 0);
    }).catch(() => {});
    await page.waitForTimeout(300);
  }
  log(`worlds: ${stats.pressed} sprites pressed, ${stats.assumed} known by their picture; ${stats.probedDialogs} dialogs' controls pressed, ${stats.toldDialogs} told from a twin`);
  await page.evaluate((st) => { if (window.__sinkWorlds) window.__sinkWorlds.stats = st; }, stats).catch(() => {});
  return found;
}

/** Runs in the page: the open dialog's layout, its words and values left out. */
function dialogSig() {
  const d = window.__sinkWorlds.open;
  return [d, ...d.querySelectorAll("*")].map((e) => `${e.localName}.${[...e.classList].sort().join(".")}`).join("|");
}
/** Runs in the page: each element of the open dialog, its own words and the attributes that carry content. */
function dialogSnap() {
  const d = window.__sinkWorlds.open;
  return [d, ...d.querySelectorAll("*")].map((e) => [
    Array.from(e.childNodes).filter((n) => n.nodeType === 3).map((n) => n.nodeValue).join("").trim(),
    ...["href", "src", "alt", "title", "aria-label", "value", ...Array.from(e.attributes).map((a) => a.name).filter((n) => n.startsWith("data-") && !n.startsWith("data-sink") && !n.startsWith("data-world"))].map((a) => e.getAttribute(a) ?? ""),
  ]);
}
/** A twin dialog's controls, told from the one that was pressed: its content put in place of the other's, element by element, and marked. */
function tellFx(twin, snap) {
  const subs = [];
  twin.snap.forEach((row, i) => row.forEach((v, k) => { const w = snap[i]?.[k]; if (v && w && v !== w && v.length >= 2 && !subs.some((p) => p[0] === v)) subs.push([v, w]); }));
  subs.sort((a, b) => b[0].length - a[0].length);
  const swap = (v) => { if (typeof v !== "string") return v; let out = v; for (const [a, b] of subs) if (out.includes(a)) out = out.split(a).join(b); return out; };
  const deep = (v) => (Array.isArray(v) ? v.map(deep) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deep(x)])) : swap(v));
  const fx = new Map();
  for (const [i, e] of twin.fx) fx.set(i, { ...deep(e), inferred: twin.dialog });
  return fx;
}

/** Runs in the page: each picture a dialog shows, as a data address when the page may read it (its own, or one served to anyone). */
async function inlinePictures({ html, imgs }) {
  let out = html;
  const at = new Map(imgs.map((i) => [i.src, i.at]));
  for (const src of [...at.keys()]) {
    if (/^data:/.test(src)) continue;
    try {
      const r = await fetch(src, { credentials: "same-origin" });
      if (!r.ok) continue;
      let blob = await r.blob();
      if (!/^image\//.test(blob.type)) continue;
      /* A picture drawn smaller than it is: carried at twice the size it is drawn (a screen that doubles its pixels), as webp. */
      const bm = await createImageBitmap(blob).catch(() => null);
      const s = bm ? Math.min(1, (2 * Math.max(16, at.get(src) || 128)) / Math.max(bm.width, bm.height)) : 1;
      if (bm && (s < 1 || blob.size > 60_000)) {
        const c = new OffscreenCanvas(Math.max(1, Math.round(bm.width * s)), Math.max(1, Math.round(bm.height * s)));
        c.getContext("2d").drawImage(bm, 0, 0, c.width, c.height);
        blob = await c.convertToBlob({ type: "image/webp", quality: 0.9 });
      }
      const data = await new Promise((res) => { const f = new FileReader(); f.onload = () => res(f.result); f.readAsDataURL(blob); });
      out = out.split(`src="${src.replace(/&/g, "&amp;")}"`).join(`src="${data}"`);
    } catch { /* kept by its address */ }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* What each control of a dialog does, pressed on live                  */
/* ------------------------------------------------------------------ */

/*
 * WHAT A PRESS DOES (the owner's rule: as much of each control as can be
 * seen is done again; only what needs a wallet or a server stays a hook).
 * Each control of a dialog just read is pressed once, on the page itself,
 * with the dialog as it opened (it is opened again after any press that
 * changed it), and what followed is written onto the control:
 *
 *   data-world-does="link"   it went to a place on this site (`data-world-href`,
 *                            its path; `data-world-target` when it opened a
 *                            window). Anywhere else (an exchange, an explorer,
 *                            a share intent) is never a link here: it is a
 *                            hook, "goes off the site", with the address in
 *                            `data-world-offsite`; so is an <a> to one. Which
 *                            of those a site lets through is polio's call
 *                            (the owner's allow-list, polio parts/offsite.ts)
 *   data-world-does="copy"   it put words on the clipboard (`data-world-copy`;
 *                            the site's own address also as its path,
 *                            `data-world-copy-path`)
 *   data-world-does="ui"     it changed the dialog: a toggle, a tab, a preset
 *                            filling the amount (`data-world-change`: each
 *                            element changed, by `data-world-el`, with its
 *                            attributes, look, words and value after)
 *   data-world-does="close"  it closed the dialog
 *   data-world-does="native" the browser's own (a field, a <summary>)
 *   data-world-does="hook"   it needs a wallet or a server: what was seen is
 *                            `data-world-hook` ("asks to connect a wallet",
 *                            "POST host/path", "sends a form to host/path",
 *                            "asks the machine to share" (`data-world-share`,
 *                            its address a path when it is the site's own),
 *                            "opens “Title”", "reads host/path"), values
 *                            left out. It does nothing until wired.
 *   data-world-does="none"   nothing could be seen to happen.
 *
 * HELD. An automatic capture never presses a control whose press would call
 * a server or prompt a wallet: a form's own button (`held: server-call`), and
 * one whose words read as spending, signing or connecting (`held: wallet`);
 * nor follows one that leaves the site (`held: off-site`). Each carries
 * `data-world-held` with its reason and `data-world-hook` with what is known,
 * and the converter gathers every one into `doc.held` with its page, part,
 * character, stable name and a selector, for the owner to choose later which
 * to press. A press read as harmless that still asked for a wallet or a write
 * is stopped where it was seen and marked held the same way.
 *
 * SAFE BY CONSTRUCTION. While a control is pressed nothing it asks for leaves
 * the machine but a read: every request that is not a GET, HEAD or OPTIONS
 * is stopped and only its host and path written down; a form is never sent
 * (world-recorder.js holds the submit); a window is never opened. A wallet
 * prompt is the first thing a purchase meets in a browser with no wallet, and
 * it is closed where it is seen.
 */
export const SPENDS = /\b(buy|sell|swap|trade|launch|mint|send|pay|sign|claim|stake|unstake|withdraw|deposit|feed|burn|checkout|purchase|order|donate|approve|bridge|connect|bid)\b/i;
export const WALLET_WORDS = /\b(wallet|phantom|solflare|backpack|metamask|walletconnect|coinbase wallet|connect)\b/i;

/** Runs in the page: the open dialog's elements numbered, and its controls listed. */
function ctlList() {
  const W = window.__sinkWorlds, d = W.open;
  const all = [d, ...d.querySelectorAll("*")];
  all.forEach((el, i) => el.setAttribute("data-sink-el", String(i)));
  const out = [];
  all.forEach((el, i) => {
    const tag = el.localName, role = el.getAttribute("role") || "";
    if (!(/^(button|input|select|textarea|summary|a)$/.test(tag) || /^(button|radio|checkbox|switch|tab|link|menuitem)$/.test(role))) return;
    const type = (el.getAttribute("type") || "").toLowerCase();
    const label = (W.labelOf(el) || "").trim().replace(/\s+/g, " ");
    out.push({
      i, tag, type, label,
      native: tag === "summary" || /^(textarea|select)$/.test(tag) || (tag === "input" && !/^(button|submit|reset|image)$/.test(type)),
      close: tag !== "a" && (el.hasAttribute("data-close") || W.CLOSE.test(label) || !!el.closest("form[method=dialog]")),
      link: tag === "a" && !!el.getAttribute("href"),
      offsite: tag === "a" && !!el.getAttribute("href") && W.within(el.getAttribute("href")) === null,
      /* A form's own button (type submit, or no type inside a form that is not a dialog's): pressing it sends the form. */
      submits: (tag === "button" && (type === "submit" || (!type && !!el.form && (el.form.getAttribute("method") || "").toLowerCase() !== "dialog"))) || (tag === "input" && /^(submit|image)$/.test(type)),
    });
  });
  return out;
}

/** Runs in the page: what the open dialog shows, element by element (its attributes, own words, value, open, checked). */
function ctlSnap() {
  const d = window.__sinkWorlds.open;
  return [d, ...d.querySelectorAll("*")].map((el) => [
    Array.from(el.attributes).filter((a) => a.name !== "data-sink-el").map((a) => `${a.name}=${a.value}`).join("\u0001"),
    Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.nodeValue).join(""),
    el.value === undefined ? null : String(el.value), el.open === undefined ? null : !!el.open, el.checked === undefined ? null : !!el.checked,
  ]);
}

/** Runs in the page: made ready to press control `i` (a closed <details> round it opened), and what is open before it. */
function ctlBefore(i) {
  const W = window.__sinkWorlds, d = W.open;
  const el = d.querySelector(`[data-sink-el="${i}"]`);
  if (!el) return false;
  for (let p = el.parentElement; p && p !== d; p = p.parentElement) if (p.localName === "details" && !p.open) p.open = true;
  const seen = (e) => { const cs = getComputedStyle(e); const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && cs.display !== "none" && cs.visibility !== "hidden"; };
  W.modals = new Set(Array.from(document.querySelectorAll('dialog[open], [aria-modal="true"], [role="dialog"], [role="alertdialog"]')).filter(seen));
  window.__sinkWorld.press(true);
  el.scrollIntoView({ block: "nearest" });
  return seen(el);
}

/** Runs in the page: what the press did to the dialog (`pre` its elements before), what it said, and any new window over it (closed here). */
function ctlAfter({ pre, noisy }) {
  const W = window.__sinkWorlds, d = W.open;
  const said = window.__sinkWorld.press(false).slice();
  const seen = (e) => { const cs = getComputedStyle(e); const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && cs.display !== "none" && cs.visibility !== "hidden"; };
  const fresh = Array.from(document.querySelectorAll('dialog[open], [aria-modal="true"], [role="dialog"], [role="alertdialog"]')).filter(seen).filter((e) => !W.modals.has(e) && e !== d && !d.contains(e));
  const modal = fresh.length ? { text: fresh[0].textContent.replace(/\s+/g, " ").trim().slice(0, 400), heading: (fresh[0].querySelector("h1,h2,h3,h4,[role=heading]")?.textContent ?? fresh[0].getAttribute("aria-label") ?? "").trim().replace(/\s+/g, " ").slice(0, 60) } : null;
  for (const m of fresh) { if (m.localName === "dialog" && m.open) m.close(); else { const x = m.querySelector('[data-close], [aria-label="Close" i], [aria-label="close" i]'); if (x) x.click(); else m.style.display = "none"; } }
  const gone = !(d.isConnected && (d.localName !== "dialog" || d.open) && seen(d));
  const all = [d, ...d.querySelectorAll("*")];
  const change = [];
  let rebuilt = all.length !== pre.length;
  if (!gone && !rebuilt) {
    all.forEach((el, i) => {
      if (noisy.includes(i)) return;
      const [a0, t0, v0, o0, k0] = pre[i];
      const a1 = Array.from(el.attributes).filter((a) => a.name !== "data-sink-el").map((a) => `${a.name}=${a.value}`).join("\u0001");
      const t1 = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.nodeValue).join("");
      const v1 = el.value === undefined ? null : String(el.value), o1 = el.open === undefined ? null : !!el.open, k1 = el.checked === undefined ? null : !!el.checked;
      if (a0 === a1 && t0 === t1 && v0 === v1 && o0 === o1 && k0 === k1) return;
      const c = { e: i };
      if (a0 !== a1) {
        const was = new Map(a0 ? a0.split("\u0001").map((x) => { const k = x.indexOf("="); return [x.slice(0, k), x.slice(k + 1)]; }) : []);
        const now = new Map(Array.from(el.attributes).filter((a) => a.name !== "data-sink-el").map((a) => [a.name, a.value]));
        const at = {};
        for (const [k, v] of now) if (!/^(class|style|on)/i.test(k) && was.get(k) !== v) at[k] = v;
        for (const k of was.keys()) if (!/^(class|style|on)/i.test(k) && !now.has(k)) at[k] = null;
        if (Object.keys(at).length) c.a = at;
      }
      /* Its look after, as the classes the dialog is dressed in. */
      c.c = W.classesOf(el, i === 0);
      if (t0 !== t1 && !el.children.length) c.t = el.textContent;
      if (v0 !== v1) c.v = v1;
      if (o0 !== o1) c.o = o1;
      if (k0 !== k1) c.k = k1;
      change.push(c);
    });
  }
  return { said, modal, gone, rebuilt, change };
}

/** A request as a backend needs it: its method, host and path, an id-like part of the path and every value left out. */
function redact(method, u, ids = []) {
  try {
    const a = new URL(u);
    const path = a.pathname.split("/").map((x) => (/^[A-Za-z0-9_-]{16,}$/.test(x) || /^\d{3,}$/.test(x) || (x && ids.includes(decodeURIComponent(x))) ? ":id" : x)).join("/");
    const q = [...a.searchParams.keys()];
    return `${method} ${a.host}${path}${q.length ? `?${q.map((k) => `${k}=…`).join("&")}` : ""}`;
  } catch { return `${method} ${String(u).split("?")[0]}`; }
}

/**
 * Every control of the open dialog pressed, one at a time, each on the dialog
 * as it opened (`reopen` puts it back after a press that changed it). `net`
 * is the capture's request watch: `net.on(list)` starts writing requests into
 * `list` and stopping any that would write, `net.off()` stops. Returns, by
 * element index, what each did.
 */
async function probeControls(page, { reopen, net, leaving, ids = [] }) {
  const wallet = await page.evaluate(() => !!(window.solana || window.phantom || window.ethereum || window.backpack || window.solflare)).catch(() => false);
  let ctls = await page.evaluate(ctlList).catch(() => []);
  const fx = new Map();
  /* What changes with nothing pressed (a quote refreshing): no press's doing. */
  const a = await page.evaluate(ctlSnap);
  await page.waitForTimeout(250);
  const b = await page.evaluate(ctlSnap);
  const noisy = a.length === b.length ? a.map((x, i) => (JSON.stringify(x) === JSON.stringify(b[i]) ? -1 : i)).filter((i) => i >= 0) : [];
  let dirty = false;
  for (const c of ctls) {
    /* HELD: never pressed by an automatic capture. Its reason is written on it and gathered into the document (`doc.held`), for the owner to choose later. */
    /* A link off the site is held already, as it was read (readDialog); one within it is the browser's own. */
    if (c.link) continue;
    if (c.close) { fx.set(c.i, { does: "close" }); continue; }
    if (c.native) { fx.set(c.i, { does: "native" }); continue; }
    if (c.submits) { fx.set(c.i, { does: "hook", hook: "not pressed: it sends a form", held: "server-call" }); continue; }
    if (SPENDS.test(c.label)) { fx.set(c.i, { does: "hook", hook: `not pressed: its words read as spending, signing or connecting${wallet ? " (and a wallet is in the capture's browser)" : ""}`, held: "wallet" }); continue; }
    if (dirty) {
      if (!(await reopen())) break;
      await page.evaluate(ctlList).catch(() => []);
      dirty = false;
    }
    const pre = await page.evaluate(ctlSnap);
    const ready = await page.evaluate(ctlBefore, c.i).catch(() => false);
    if (!ready) { await page.evaluate(() => window.__sinkWorld.press(false)); fx.set(c.i, { does: "none", why: "not shown to press" }); dirty = true; continue; }
    const reqs = [];
    net.on(reqs);
    leaving.at = null;
    await page.locator(`[data-sink-el="${c.i}"]`).first().click({ timeout: 1500 }).catch(() => {});
    await page.waitForTimeout(220);
    for (let k = 0; k < 3 && !leaving.at; k++) await page.waitForTimeout(40);
    net.off();
    const r = await page.evaluate(ctlAfter, { pre, noisy }).catch(() => ({ said: [], modal: null, gone: true, rebuilt: false, change: [] }));
    const said = r.said ?? [];
    const writes = reqs.filter((q) => q.stopped).map((q) => redact(q.method, q.url, ids));
    const reads = reqs.filter((q) => !q.stopped).map((q) => redact(q.method, q.url, ids));
    const opened = said.find((x) => x.open), shared = said.find((x) => x.share), copied = said.find((x) => "copy" in x), sent = said.find((x) => x.submit);
    let e;
    /* A place on this site is a link to it; anywhere else (an exchange, an explorer, a share intent) stays a hook that says where. */
    const here = (u) => { try { const a = new URL(u, page.url()); return a.origin === new URL(page.url()).origin ? `${a.pathname}${a.search}${a.hash}` : null; } catch { return null; } };
    const away = (u) => { try { return new URL(u, page.url()).href; } catch { return String(u); } };
    if (leaving.at) e = here(leaving.at) !== null ? { does: "link", href: here(leaving.at) } : { does: "hook", hook: "goes off the site", offsite: away(leaving.at), held: "off-site" };
    else if (opened) e = here(opened.open) !== null ? { does: "link", href: here(opened.open), target: "_blank" } : { does: "hook", hook: "opens a window off the site", offsite: away(opened.open), held: "off-site" };
    else if (shared) e = { does: "hook", hook: "asks the machine to share", share: { ...shared.share, url: shared.share.url ? here(shared.share.url) ?? away(shared.share.url) : "" } };
    /* A press read as harmless that still asked for a wallet or a write: stopped where it was seen, and held from here on. */
    else if (r.modal && WALLET_WORDS.test(`${r.modal.heading} ${r.modal.text}`)) e = { does: "hook", hook: "asks to connect a wallet", held: "wallet" };
    else if (writes.length) e = { does: "hook", hook: [...new Set(writes)].join("; "), held: "server-call" };
    else if (sent) e = { does: "hook", hook: `sends a form to ${redact(sent.method, sent.submit, ids)}`, held: "server-call" };
    else if (r.modal) e = { does: "hook", hook: `opens “${r.modal.heading || r.modal.text.slice(0, 40)}”` };
    /* The site's own address copied is kept as its path too, so a copy of the site copies its own address. */
    else if (copied) e = { does: "copy", copy: copied.copy, ...(/^https?:\/\//.test(copied.copy) && here(copied.copy) !== null ? { copyPath: here(copied.copy) } : {}) };
    else if (r.change.length) e = { does: "ui", change: r.change };
    else if (r.rebuilt) e = { does: "hook", hook: "rebuilds the dialog (not replayed)" };
    else if (reads.length) e = { does: "hook", hook: `reads ${[...new Set(reads)].join("; ")}` };
    else if (r.gone) e = { does: "close" };
    else e = { does: "none" };
    if (reads.length && e.does !== "hook") e.reads = [...new Set(reads)].join("; ");
    fx.set(c.i, e);
    dirty = !!(leaving.at || opened || r.modal || r.gone || r.rebuilt || r.change.length || sent);
    leaving.at = null;
  }
  return fx;
}

/** The dialog's markup with what each control does written on it; an element's place kept only where a change names it. */
function withEffects(html, fx) {
  const esc = (v) => String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const named = new Set();
  for (const e of fx.values()) for (const c of e.change ?? []) named.add(String(c.e));
  /* A held control keeps its place too: Learn finds it by it in the dialog opened on live (learn.mjs). */
  for (const [i, e] of fx) if (e.held && e.held !== "off-site") named.add(String(i));
  let out = html;
  for (const [i, e] of fx) {
    const at = [`data-world-does="${e.does}"`];
    if (e.href) at.push(`data-world-href="${esc(e.href)}"`);
    if (e.target) at.push(`data-world-target="${esc(e.target)}"`);
    if (e.offsite) at.push(`data-world-offsite="${esc(e.offsite)}"`);
    if ("copy" in e) at.push(`data-world-copy="${esc(e.copy)}"`);
    if (e.copyPath) at.push(`data-world-copy-path="${esc(e.copyPath)}"`);
    if (e.share) at.push(`data-world-share="${esc(JSON.stringify(e.share))}"`);
    if (e.change) at.push(`data-world-change="${esc(JSON.stringify(e.change))}"`);
    if (e.hook) at.push(`data-world-hook="${esc(e.hook)}"`);
    if (e.held) at.push(`data-world-held="${esc(e.held)}"`);
    if (e.reads) at.push(`data-world-reads="${esc(e.reads)}"`);
    if (e.inferred != null) at.push(`data-world-inferred="${esc(e.inferred)}"`);
    out = out.replace(`data-world-el="${i}"`, `data-world-el="${i}" ${at.join(" ")}`);
  }
  return out.replace(/ data-world-el="(\d+)"/g, (m, i) => (named.has(i) ? m : ""));
}

/* ------------------------------------------------------------------ */
/* What a world is made of: its tabs, its scale, its pictures            */
/* ------------------------------------------------------------------ */

/**
 * Runs in the page: the tabs that switch canvas `i`'s scene, if it has any:
 * the nearest box round the canvas (up to four levels) holding two to six
 * presses of one kind (tabs, radios, toggles, or buttons side by side), none
 * of them a link or in a form. Each with its words, its box in the page and
 * whether it is the one chosen.
 */
function findTabs(i) {
  const c = document.querySelector(`canvas[data-sink-canvas="${i}"]`);
  if (!c) return [];
  const seen = (el) => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 4 && r.height > 4 && cs.visibility !== "hidden" && cs.display !== "none"; };
  const on = (el) => ["aria-selected", "aria-pressed", "aria-checked"].some((a) => el.getAttribute(a) === "true");
  for (let up = c.parentElement, n = 0; up && n < 4; up = up.parentElement, n++) {
    const all = Array.from(up.querySelectorAll('[role="tab"], [role="radio"], [aria-selected], [aria-pressed], button')).filter((el) => seen(el) && !el.closest("a[href], form, dialog") && !el.contains(c));
    const groups = new Map();
    for (const el of all) { const k = el.parentElement; (groups.get(k) ?? groups.set(k, []).get(k)).push(el); }
    const group = [...groups.values()].find((g) => g.length >= 2 && g.length <= 6 && g.some((el) => el.hasAttribute("aria-selected") || el.hasAttribute("aria-pressed") || el.getAttribute("role") === "tab"));
    if (group) return group.map((el) => { const r = el.getBoundingClientRect(); return { text: el.textContent.trim().replace(/\s+/g, " "), x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height, on: on(el) }; });
  }
  return [];
}

/**
 * The page's own scale for canvas `i` at a range of window widths ([the
 * canvas's width in CSS px, CSS px per canvas px], kept where it changes),
 * and for each scene (its tab pressed first) the ground the page paints at
 * each width with `hide`'s sprites, every word and the boxes behind the words
 * left out: of each scale, the widest. The window and the first scene are put
 * back after.
 */
async function sampleStage(page, i, vh, tabs, pressAt, hide) {
  const was = page.viewportSize();
  const widths = [420, 640, 800, 1000, 1280, 1440, 1600, 1800, 1900, 2000, 2400, 2560, 3000];
  const scale = [], grounds = [];
  const read = () => page.evaluate(({ i, hide, clean }) => new Promise((done) => {
    const c = document.querySelector(`canvas[data-sink-canvas="${i}"]`);
    if (!c || !c.width) return done(null);
    const r = c.getBoundingClientRect();
    const got = { css: Math.round(r.width), px: Math.round((r.width / c.width) * 1000) / 1000, w: c.width, h: c.height };
    if (!clean) return done(got);
    window.__sinkWorld.clean(hide);
    setTimeout(() => { let url = null; try { url = c.toDataURL("image/png"); } catch { url = null; } window.__sinkWorld.clean(null); done({ ...got, url }); }, 350);
  }), { i, hide, clean: true });
  for (let n = 0; n < Math.max(1, tabs.length); n++) {
    if (tabs[n]) { if (was) await page.setViewportSize(was); await page.waitForTimeout(400); await pressAt(tabs[n]); }
    for (const w of widths) {
      await page.setViewportSize({ width: w, height: vh });
      await page.waitForTimeout(450);
      const got = await read();
      if (!got) continue;
      if (n === 0 && !scale.some((p) => p[0] === got.css)) scale.push([got.css, got.px]);
      if (got.url) grounds.push({ scene: n, ...got });
    }
  }
  if (was) await page.setViewportSize(was);
  await page.waitForTimeout(700);
  if (tabs[0] && tabs.length > 1) await pressAt(tabs[0]);
  /* A scale read off a canvas rounded up to whole pixels (1600 / 321) is the page's round one (5): taken to the nearest quarter when that is within 3%. */
  const round = (v) => { const q = Math.round(v * 4) / 4; return q > 0 && Math.abs(v - q) / q < 0.03 ? q : v; };
  for (const p of scale) p[1] = round(p[1]);
  scale.sort((a, b) => a[0] - b[0]);
  const scaleAt = scale.filter((p, k) => k === 0 || p[1] !== scale[k - 1][1]);
  /* Of each scene's grounds, the widest at each scale: narrower boxes are cut from it. */
  const kept = [];
  for (const g of grounds) {
    g.px = round(g.px);
    const same = kept.find((k) => k.scene === g.scene && k.px === g.px);
    if (!same) kept.push(g); else if (g.w > same.w) kept[kept.indexOf(same)] = g;
  }
  return { scaleAt, grounds: kept.map(({ scene, w, h, px, url }) => ({ scene, w, h, px, url })) };
}

/**
 * The stage's pictures as data addresses, each cut down to the pieces its
 * sprites, backgrounds and props use, packed in rows (parasiteonsol.fun's
 * sheet is 850 KB; a world uses a part of it). A picture the page may not
 * read is kept by its address: drawing it needs no reading.
 */
async function cutImages(page, stage) {
  const uses = stage.images.map(() => []);
  for (const [id, s] of Object.entries(stage.sprites)) uses[s[0]].push({ kind: "sprite", id, r: s.slice(1) });
  stage.scenes.forEach((sc, n) => sc.layers.forEach((l, k) => uses[l.img].push({ kind: "layer", n, k, r: [l.sx, l.sy, l.sw, l.sh] })));
  const cut = await page.evaluate(async ({ images, uses }) => {
    const out = [];
    for (let i = 0; i < images.length; i++) {
      try {
        let im = window.__sinkWorld.source(images[i]);
        if (!im) { im = new Image(); im.crossOrigin = "anonymous"; im.src = images[i]; await im.decode(); }
        const rects = []; const at = {};
        for (const u of uses[i]) { const key = u.r.join(","); if (!(key in at)) { at[key] = rects.length; rects.push(u.r); } }
        const gap = 1, maxW = Math.max(256, Math.min(2048, ...rects.map((r) => r[2] + gap)));
        const order = rects.map((r, k) => k).sort((a, b) => rects[b][3] - rects[a][3]);
        let x = 0, y = 0, rowH = 0, W = 0; const place = [];
        for (const k of order) { const [, , w, h] = rects[k]; if (x + w > maxW) { x = 0; y += rowH + gap; rowH = 0; } place[k] = [x, y]; x += w + gap; rowH = Math.max(rowH, h); W = Math.max(W, x); }
        const c = document.createElement("canvas"); c.width = Math.max(1, W); c.height = Math.max(1, y + rowH);
        const g = c.getContext("2d");
        rects.forEach((r, k) => g.drawImage(im, r[0], r[1], r[2], r[3], place[k][0], place[k][1], r[2], r[3]));
        out.push({ url: c.toDataURL("image/png"), place: Object.fromEntries(Object.entries(at).map(([key, k]) => [key, place[k]])) });
      } catch { out.push(null); }
    }
    return out;
  }, { images: stage.images, uses });
  cut.forEach((c, i) => {
    if (!c) return;
    stage.images[i] = c.url;
    for (const u of uses[i]) {
      const [x, y] = c.place[u.r.join(",")];
      if (u.kind === "sprite") { stage.sprites[u.id][1] = x; stage.sprites[u.id][2] = y; }
      else { const l = stage.scenes[u.n].layers[u.k]; l.sx = x; l.sy = y; }
    }
  });
}
