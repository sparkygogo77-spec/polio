"use client";
/**
 * WHAT A STROKE TOUCHES (✍️ MARKUP, J 2026-11-11: "something that you automatically register my drawn lines
 * instead of having to look and decide where they are").
 *
 * A line or an arrow registers every element it crosses: along the stroke, every few pixels, the topmost thing
 * under it (a board part by its name, else the nearest thing that can be named). A circle registers everything
 * whose middle is inside it. An arrow also names what its head points at. A stroke over empty board names the
 * nearest parts too, since what is missing is often where nothing is yet.
 *
 * The layer J draws on is left out of every look-up; nothing on the page is changed.
 */
import { useStudio } from "@/features/studio/board/store";
import { along, areaOf, boxOf, inside, type Box, type Pt } from "./geometry";

export { along, areaOf, boxOf, inside, isClosed, lengthOf, thin } from "./geometry";
export type { Box, Pt } from "./geometry";

export type Shape = "line" | "circle" | "arrow";
export type Owner = { attr: string; id: string };
export type Registered = {
  how: "crossed" | "circled" | "points-at" | "near" | "in-view";
  nodeId?: string; name?: string; feature?: string; role?: string; tag: string; text?: string; attr?: string;
  owner?: Owner; box: Box; pageBox?: Box; hits?: number;
};

/** The layer J draws on and its bar: never registered. */
export const LAYER = "[data-markup-layer]";
/** What a part is called on the board is in the store, not on the element. */
const partOf = (id: string) => useStudio.getState().nodes.find((n) => n.id === id);

/* ---------------------------------------------------------------- the page */

const NAMED_ATTR = /^data-(?!markup)[a-z0-9-]+$/;
const TAGS = new Set(["BUTTON", "A", "IMG", "INPUT", "TEXTAREA", "SELECT", "H1", "H2", "H3", "H4", "H5", "H6", "LABEL", "SVG", "CANVAS", "VIDEO", "LI", "P"]);

/** The board's page: where the parts are, and how it is scaled on screen. */
export function boardFrame(): { rect: DOMRect; scale: number } | null {
  const frame = document.querySelector<HTMLElement>("[data-frame]");
  if (!frame) return null;
  const rect = frame.getBoundingClientRect();
  if (!rect.width) return null;
  return { rect, scale: rect.width / (frame.offsetWidth || rect.width) };
}

/** A box on screen in the board page's own units, if it reaches the board. */
export function toPage(b: Box, f = boardFrame()): Box | undefined {
  if (!f) return undefined;
  const { rect, scale } = f;
  if (b.x > rect.right || b.y > rect.bottom || b.x + b.w < rect.left || b.y + b.h < rect.top) return undefined;
  const r = (v: number) => Math.round(v * 10) / 10;
  return { x: r((b.x - rect.left) / scale), y: r((b.y - rect.top) / scale), w: r(b.w / scale), h: r(b.h / scale) };
}

const inLayer = (el: Element) => !!el.closest(LAYER);

/** Whether an element can be named on its own: a part, a thing with a name or a role, a control, or words. */
function nameable(el: Element): boolean {
  if (el.hasAttribute("data-node-id") || el.hasAttribute("aria-label") || el.hasAttribute("role") || el.id) return true;
  if (TAGS.has(el.tagName.toUpperCase())) return true;
  if ([...el.attributes].some((a) => NAMED_ATTR.test(a.name) && a.name !== "data-state")) return true;
  return [...el.childNodes].some((c) => c.nodeType === Node.TEXT_NODE && (c.textContent ?? "").trim().length > 1);
}

/** The thing a press at this element names: the board part it is in, else the nearest nameable element up from it. */
export function subjectOf(el: Element | null): Element | null {
  if (!el || inLayer(el)) return null;
  const part = el.closest("[data-node-id]");
  if (part) return part;
  for (let e: Element | null = el; e && e !== document.body && e !== document.documentElement; e = e.parentElement) if (nameable(e)) return e;
  return null;
}

/** The chat, orb, pane or column the element belongs to, by the nearest attribute that carries one. */
function ownerOf(el: Element): Owner | undefined {
  for (let e: Element | null = el; e && e !== document.body; e = e.parentElement) {
    for (const a of [...e.attributes]) {
      if (!a.name.startsWith("data-") || !a.value) continue;
      if (/^local_[0-9a-z-]{6,}$/i.test(a.value) || /^data-(lanes-orb|lanes-moon|manager-column|manager-question|manager-pane-question|manager-carried|manager-foot-chat)$/.test(a.name)) return { attr: a.name, id: a.value.slice(0, 120) };
    }
  }
  return undefined;
}

const textOf = (el: Element) => ((el as HTMLElement).innerText ?? el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 140) || undefined;

/** The first data attribute that says what the element is, as `name=value`. */
function attrOf(el: Element): string | undefined {
  const a = [...el.attributes].find((x) => NAMED_ATTR.test(x.name) && x.name !== "data-node-id" && x.name !== "data-state");
  return a ? (a.value ? `${a.name}=${a.value}`.slice(0, 160) : a.name) : undefined;
}

export function describe(el: Element, how: Registered["how"], f = boardFrame()): Registered {
  const r = el.getBoundingClientRect();
  const b: Box = { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
  const out: Registered = { how, tag: el.tagName.toLowerCase(), box: b };
  const id = el.getAttribute("data-node-id");
  if (id) {
    out.nodeId = id;
    const n = partOf(id);
    if (n) { out.name = n.label || undefined; out.feature = n.featureId || undefined; }
    const p = toPage(b, f);
    if (p) out.pageBox = p;
  } else {
    const label = el.getAttribute("aria-label") ?? el.getAttribute("title") ?? el.getAttribute("alt");
    if (label) out.name = label.slice(0, 160);
  }
  const role = el.getAttribute("role");
  if (role) out.role = role;
  const t = textOf(el);
  if (t && t !== out.name) out.text = t;
  const a = attrOf(el);
  if (a) out.attr = a;
  const o = ownerOf(el);
  if (o) out.owner = o;
  return out;
}

/** Every element a line or an arrow crosses, in the order it reaches them, with how many sample points fell on each. */
export function crossed(points: readonly Pt[]): Map<Element, number> {
  const seen = new Map<Element, number>();
  for (const [x, y] of along(points)) {
    const top = document.elementsFromPoint(x, y).find((e) => !inLayer(e));
    const s = subjectOf(top ?? null);
    if (s) seen.set(s, (seen.get(s) ?? 0) + 1);
  }
  return seen;
}

/** Whether J can see it: shown, not hidden, and neither it nor anything round it see-through to nothing. */
function seen(el: Element): boolean {
  const c = (el as Element & { checkVisibility?: (o: object) => boolean }).checkVisibility;
  if (c) return c.call(el, { opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true });
  const st = getComputedStyle(el);
  return st.visibility !== "hidden" && st.display !== "none" && Number(st.opacity) !== 0;
}

/** Every nameable element whose middle is inside the loop (and is on screen), outermost first. */
export function circled(points: readonly Pt[]): Element[] {
  const b = boxOf(points), area = areaOf(points);
  const out: Element[] = [];
  for (const el of document.body.querySelectorAll("*")) {
    if (inLayer(el) || !nameable(el)) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || r.right < b.x || r.left > b.x + b.w || r.bottom < b.y || r.top > b.y + b.h) continue;
    if (!inside([r.left + r.width / 2, r.top + r.height / 2], points)) continue;
    /* Mostly inside the loop's box, too: a page-wide holder whose middle happens to fall in the loop is not what was circled. */
    const ow = Math.min(r.right, b.x + b.w) - Math.max(r.left, b.x), oh = Math.min(r.bottom, b.y + b.h) - Math.max(r.top, b.y);
    if (ow <= 0 || oh <= 0 || (ow * oh) / (r.width * r.height) < 0.6 || r.width * r.height > area) continue;
    /* Hidden things J could not see (a part's name chip until hovered, say) are not what J circled. */
    if (!seen(el)) continue;
    out.push(el);
  }
  /* A part counts as one thing: what is inside it goes with it. Parts first. */
  const kept = out.filter((el) => !out.some((o) => o !== el && o.hasAttribute("data-node-id") && o.contains(el)));
  return [...kept.filter((el) => el.hasAttribute("data-node-id")), ...kept.filter((el) => !el.hasAttribute("data-node-id"))];
}

/** The board parts nearest a box, for a mark on empty board. */
export function nearestParts(b: Box, count = 3): Element[] {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  return [...document.querySelectorAll("[data-node-id]")]
    .map((el) => { const r = el.getBoundingClientRect(); const dx = Math.max(r.left - cx, 0, cx - r.right), dy = Math.max(r.top - cy, 0, cy - r.bottom); return { el, d: Math.hypot(dx, dy), r }; })
    .filter((x) => x.r.width > 0 && x.r.height > 0)
    .sort((a, b2) => a.d - b2.d)
    .slice(0, count)
    .map((x) => x.el);
}

export type Registration = { elements: Registered[]; near: Registered[] };

/** What one stroke touches, on the page as it is now. */
export function register(points: readonly Pt[], shape: Shape): Registration {
  const f = boardFrame();
  const elements: Registered[] = [];
  const add = (el: Element, how: Registered["how"], hits?: number) => {
    const d = describe(el, how, f);
    if (hits !== undefined) d.hits = hits;
    elements.push(d);
  };
  if (shape === "circle") for (const el of circled(points)) add(el, "circled");
  else {
    const tip = shape === "arrow" ? subjectOf(document.elementsFromPoint(...points[points.length - 1]!).find((e) => !inLayer(e)) ?? null) : null;
    if (tip) add(tip, "points-at");
    for (const [el, hits] of crossed(points)) if (el !== tip) add(el, "crossed", hits);
  }
  /* On empty board (only the board's own page or nothing under it): name the nearest parts. */
  const parts = elements.filter((e) => e.nodeId);
  const near = !parts.length && f && toPage(boxOf(points), f) ? nearestParts(boxOf(points)).map((el) => describe(el, "near", f)) : [];
  return { elements: elements.slice(0, 60), near };
}

/** Every nameable element on screen now, for a snapshot's map: parts first. */
export function elementMap(max = 1500): Registered[] {
  const f = boardFrame();
  const vw = window.innerWidth, vh = window.innerHeight;
  const out: Registered[] = [];
  const all = [...document.querySelectorAll("[data-node-id]"), ...document.body.querySelectorAll("*")];
  const done = new Set<Element>();
  for (const el of all) {
    if (done.has(el) || out.length >= max) continue;
    done.add(el);
    if (inLayer(el) || !nameable(el)) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || !seen(el) || r.right < 0 || r.bottom < 0 || r.left > vw || r.top > vh) continue;
    out.push(describe(el, "in-view", f));
  }
  return out;
}
