/**
 * A STILL OF WHAT A PART'S CODE DRAWS, for designing around it.
 *
 * WHY. A repository comes in without its scripts run (`zipImport.ts`
 * `sansScripts`): what is measured is what the HTML and CSS say. A part its
 * code draws into, PST's chart inside the Chart TV, is then an empty box,
 * and the owner designs the TV round a black screen. A builder-ready
 * repository (PST's kit) can already show every state of itself frozen,
 * with sample data, at `preview.html?still=1&screen=<name>`, from its own
 * files. So its builder.json may name stills:
 *
 *   "preview": { "page": "web/preview.html", "query": "?still=1&screen=<name>",
 *                "stills": [{ "hook": "chart", "screen": "tv-idle" }] }
 *
 * and each is taken as the repository comes in: the preview page opened at
 * that screen in the server's browser, its scripts running this once, every
 * request it makes answered out of the repository's own files and nothing
 * reaching the network (no socket, no event stream either), and a picture
 * taken of that one element with everything round it and over it hidden.
 * The picture goes on the part with that hook as its picture, where the
 * board and the Preview draw it under the parts over it (the TV's
 * scanlines, glare and words). It is the part's picture like any other: the
 * owner can take it off, and the style layer never writes it to the code.
 *
 * Pure apart from `ISOLATE` and `BUSY_NOW`, which run in the page.
 * `tests/tv-import.mjs` holds it against PST's Chart TV.
 */

/** One still a builder.json asks for: the part by its hook, and the preview screen it is taken on (none: the page as it opens). */
export interface StillAsk { hook: string; screen: string | null }

/** What the server is asked: the page, and each still's query and hook. */
export interface StillsAsk { page: string; shots: { hook: string; query: string }[] }

/** One still taken, and the hooks beside it its screen does not show. */
export interface StillTaken { hook: string; query: string; src: string; w: number; h: number; unshown?: string[] }

/** The most stills one repository brings. */
export const MOST_STILLS = 6;
/** How many of the preview page's files are packed for it, and how much of them. */
export const MOST_STILL_FILES = 160;
export const MOST_STILL_BYTES = 8 * 1024 * 1024;

/** A builder.json's `preview.stills`, read loosely: a hook and an optional screen, at most `MOST_STILLS`. */
export function readStills(raw: unknown): StillAsk[] {
  if (!Array.isArray(raw)) return [];
  const out: StillAsk[] = [];
  for (const s of raw) {
    if (!s || typeof s !== "object") continue;
    const o = s as Record<string, unknown>;
    const hook = typeof o.hook === "string" ? o.hook.trim() : "";
    if (!/^[\w-]+$/.test(hook)) continue;
    const screen = typeof o.screen === "string" && /^[\w-]+$/.test(o.screen.trim()) ? o.screen.trim() : null;
    out.push({ hook, screen });
  }
  return out.slice(0, MOST_STILLS);
}

/** The query a still is taken at: the manifest's own with the screen's name in it, else `?still=1&screen=<name>`. */
export function stillQuery(query: string | null, screen: string | null): string {
  if (!screen) return /still=1/.test(query ?? "") ? "?still=1" : "";
  const q = query && query.includes("<name>") ? query : "?still=1&screen=<name>";
  return q.replace("<name>", encodeURIComponent(screen));
}

/** What the server is asked, from the manifest; null when it names no preview page or no stills. */
export function stillsAsk(m: { previewPage: string | null; previewQuery: string | null; stills: StillAsk[] }): StillsAsk | null {
  if (!m.previewPage || !m.stills.length) return null;
  return { page: m.previewPage, shots: m.stills.map((s) => ({ hook: s.hook, query: stillQuery(m.previewQuery, s.screen) })) };
}

/** The ask, as the route reads it off the form: null when it is not one. */
export function readStillsAsk(raw: unknown): StillsAsk | null {
  if (typeof raw !== "string") return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const page = typeof o.page === "string" && /^[\w./-]+\.html?$/i.test(o.page) && !o.page.includes("..") ? o.page : null;
    const shots = Array.isArray(o.shots) ? (o.shots as unknown[]).flatMap((s) => {
      const x = s as Record<string, unknown> | null;
      const hook = typeof x?.hook === "string" && /^[\w-]+$/.test(x.hook) ? x.hook : null;
      const query = typeof x?.query === "string" && /^(\?[\w=&%.,-]*)?$/.test(x.query) ? x.query : null;
      return hook && query !== null ? [{ hook, query }] : [];
    }).slice(0, MOST_STILLS) : [];
    return page && shots.length ? { page, shots } : null;
  } catch {
    return null;
  }
}

/** Which of a repository's files the preview page may ask for: everything in its folder and under it but the notes and the maps. */
export function stillFiles<T extends { path: string; size?: number }>(blobs: readonly T[], page: string): T[] {
  const dir = page.includes("/") ? page.slice(0, page.lastIndexOf("/") + 1) : "";
  const out: T[] = [];
  let bytes = 0;
  for (const e of blobs) {
    if (!e.path.startsWith(dir) || /(^|\/)(node_modules|test|tests)\//i.test(e.path) || /\.(md|map|ts|mts|txt|LICENSE)$/i.test(e.path) || /(^|\/)LICENSE$/i.test(e.path)) continue;
    if ((e.size ?? 0) > 3_000_000) continue;
    if (out.length >= MOST_STILL_FILES || bytes + (e.size ?? 0) > MOST_STILL_BYTES) break;
    out.push(e);
    bytes += e.size ?? 0;
  }
  return out;
}

/** In the page: the markers on `<html>` or `<body>` still saying it is building (capture/site/capture/ready.mjs). */
export const BUSY_NOW = (): number => {
  const busy = ["loading", "building", "pending", "busy", "starting", "working"];
  let n = 0;
  for (const el of [document.documentElement, document.body]) {
    if (!el) continue;
    for (const a of Array.from(el.attributes)) {
      const v = a.value.trim().toLowerCase();
      if ((a.name.startsWith("data-") && busy.includes(v)) || (a.name === "aria-busy" && v === "true")) n++;
    }
  }
  return n;
};

/**
 * In the page: the first element with that hook that has a box, marked, and
 * everything that is not it or inside it hidden (what sits over it, the
 * page round it, the preview's own focus ring), so the picture is of what
 * it draws alone. Where it is in the window and its size, or null when there is none.
 */
export const ISOLATE = (hook: string): { x: number; y: number; w: number; h: number; unshown: string[] } | null => {
  const el = Array.from(document.querySelectorAll(`[data-hook="${hook}"]`)).find((e) => { const r = e.getBoundingClientRect(); return r.width >= 8 && r.height >= 8; });
  if (!el) return null;
  /* What sits beside it that this screen does not show (the TV's static, on tv-idle): a part that covers it on the board, and is not shown here, is kept hidden (`unshownOver`). */
  const unshown = Array.from(el.parentElement?.querySelectorAll("[data-hook]") ?? []).filter((e) => e !== el && !el.contains(e) && !e.getClientRects().length).map((e) => e.getAttribute("data-hook")!).slice(0, 40);
  el.setAttribute("data-polio-still", "");
  const s = document.createElement("style");
  s.textContent = "*:not([data-polio-still]):not([data-polio-still] *) { visibility: hidden !important; outline: none !important; } [data-polio-still], [data-polio-still] * { visibility: visible !important; } [data-polio-still] { outline: none !important; }";
  document.head.appendChild(s);
  el.scrollIntoView({ block: "center" });
  const r = el.getBoundingClientRect();
  /* In the window, as a picture of the window is cut. */
  return { x: Math.max(0, Math.round(r.left)), y: Math.max(0, Math.round(r.top)), w: Math.round(r.width), h: Math.round(r.height), unshown };
};

/** A still as the board keeps it: what it shows, said for anyone who cannot see it. */
export function stillAlt(hook: string, page: string, query: string): string {
  return `A still of what the code draws into ${hook}, from ${page}${query}`;
}

/** A board part, as far as a still reads one. */
interface StillNode { id: string; pageId: string; x: number; y: number; w: number; h: number; label?: string; hooks?: Record<string, string> | null; state?: { group: string; option: number } | null }

/**
 * The parts that would hide a still: over its part (later in the page),
 * covering the whole of it, and not shown on the screen the still was taken
 * on. PST's static covers the screen as the page opens (the TV tuning in),
 * so the chart's still would be under it; on tv-idle it is not shown. Each
 * is kept, as a part hidden as the page opens (`state`), so the owner sees
 * the chart and can show the static again from its panel. Anything smaller
 * over it (the "Tuning in" box, the channel's words) and anything the
 * screen shows (scanlines, glare) stays as it was.
 */
export function unshownOver<T extends StillNode>(nodes: readonly T[], on: T, unshown: readonly string[]): T[] {
  const after = nodes.slice(nodes.indexOf(on) + 1);
  const slack = 2;
  return after.filter((n) => n.pageId === on.pageId && !n.state && !!n.hooks?.["data-hook"] && unshown.includes(n.hooks["data-hook"]) && n.x <= on.x + slack && n.y <= on.y + slack && n.x + n.w >= on.x + on.w - slack && n.y + n.h >= on.y + on.h - slack);
}
