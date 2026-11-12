/**
 * THE AGENTS MANAGER, THE PURE PART (J's drawing, 2026-11-10; rules in
 * Pleo/handovers/open/columns-rules.md): which coordinator each chat stands
 * under, what a column, its head, its panes and its foot hold, each
 * coordinator's colour pair, what a chat costs the PC and each kind's share
 * of it, the model choices, and which things open as slides.
 *
 * No React and no imports but the board's own pure part, so
 * tests/agents-manager.mjs imports it straight.
 */
import { byLatest, chatsAbout, isOpen, type ChatState, type Check, type Decision, type LaneChat, type LaneCoordinator, type LanesFeed, type PictureRound } from "./lanes.ts";
export type { Check, PictureRound, RoundOption } from "./lanes.ts";

/* ------------------------------------------------------------ colour (rules §2) */

/**
 * A coordinator's colour pair (outer line, inner line) by its number modulo
 * 6, so a column keeps its colour from day to day: 7 is blue and green, 6
 * red, 5 yellow, as J painted them. `block` is the design block (a molten
 * temperature) its bands wear, and `turn` the hue turned on that block for
 * the three colours no temperature has (purple, cyan, pink).
 */
export interface Colours { outer: string; inner: string; block: "ember" | "azure" | "lantern" | "verdant"; turn: number; fill: string }
export const RING_PAIRS: Colours[] = [
  { outer: "#ff4a3d", inner: "#ffb08a", block: "ember", turn: 0, fill: "rgba(120, 18, 12, 0.5)" },
  { outer: "#2f7bff", inner: "#52e36a", block: "azure", turn: 0, fill: "rgba(12, 56, 120, 0.5)" },
  { outer: "#a06bff", inner: "#d9c2ff", block: "azure", turn: 48, fill: "rgba(62, 28, 124, 0.5)" },
  { outer: "#22d3f0", inner: "#aaf3ff", block: "azure", turn: -32, fill: "rgba(8, 86, 104, 0.5)" },
  { outer: "#ff7ab8", inner: "#ffd0e6", block: "ember", turn: -42, fill: "rgba(120, 22, 74, 0.5)" },
  { outer: "#f2c230", inner: "#fff09a", block: "lantern", turn: 42, fill: "rgba(112, 82, 8, 0.5)" },
];
export const coloursOf = (n: number): Colours => RING_PAIRS[((Math.round(n) % 6) + 6) % 6]!;
/**
 * BAM mark 30 (J, 2026-11-11: "green for first purple for 2nd and amber for 3rd"): the live coordinators' colours by
 * their place, oldest first (mark 31, GUESS): the first green, the second purple, the third amber, then round again.
 */
export const RANK_COLOURS: Colours[] = [
  { outer: "#2fd27a", inner: "#b8ffd8", block: "verdant", turn: 0, fill: "rgba(10, 92, 52, 0.5)" },
  { outer: "#a06bff", inner: "#d9c2ff", block: "azure", turn: 48, fill: "rgba(62, 28, 124, 0.5)" },
  { outer: "#f2a51f", inner: "#ffe2a3", block: "lantern", turn: 0, fill: "rgba(112, 70, 8, 0.5)" },
];
export const rankColours = (k: number): Colours => RANK_COLOURS[((k % 3) + 3) % 3]!;

/**
 * The sizes of the ring: the outer line, the inner line, the two radii, and how far in the content starts.
 * Thicker than the rules' 4 and 2 (J, of the console's two hairlines: "why doesn't it look like my drawing";
 * the brief: "a thick ring"): a band of 7 with a line of 3 inside it, clearly heavier than a pane's 2.
 */
export const RING = { outer: 7, inner: 3, radius: 14, innerRadius: 7, pad: 6, pane: 2, paneRadius: 8 } as const;

/** The design block a chat's pane wears, by its state: red needs you, blue working, green done; a parked one is cold (no block). */
export const PANE_BLOCK: Record<ChatState, "ember" | "azure" | "verdant" | null> = { need: "ember", work: "azure", done: "verdant", park: null };

/* ------------------------------------------------------------ the columns (rules §1, §3, §4, §6) */

export interface Column {
  /** The coordinator's chat id, or the feed coordinator's id where the feed has no coordinator chats. */
  id: string;
  n: number;
  /** "C7". */
  label: string;
  name: string;
  /** The coordinator's own chat, when the feed has one. */
  coord: LaneChat | null;
  current: boolean;
  colours: Colours;
  /** Chats stacked in the column: everything not finished-with-nothing-left, red first. */
  panes: LaneChat[];
  /** Finished chats with nothing left for J, newest first. */
  foot: LaneChat[];
  /** Archived chats: off the board, never deleted, findable in the foot. */
  archived: LaneChat[];
  /** Retired coordinators J has not hidden, one line each (current column only). */
  retired: LaneChat[];
  /** Every open question in the column, in the feed's order. */
  questions: Decision[];
  /** The open questions no pane carries: the coordinator's own, and those of hidden or unknown chats. They sit on the head. */
  own: Decision[];
  /** BAM mark 33: open questions of a chat that is gone (ended, archived, hidden), rolled over to the current coordinator, each with the chat it came from. */
  carried: { d: Decision; from: LaneChat }[];
}

const plain = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
/** "Coordinator 7" is 7; a name with no number has none. */
export function numberOf(name: string): number | null {
  const m = /(\d+)/.exec(name);
  return m ? Number(m[1]) : null;
}
/** A coordinator's own chat: the feed says so (`kind`), or says nothing and its name does; always with a number. */
export const isCoordinatorChat = (x: LaneChat) => (x.kind === "coordinator" || (!x.kind && /coordinator/i.test(x.realName ?? x.name))) && /coordinator/i.test(x.realName ?? x.name) && numberOf(x.realName ?? x.name) !== null;

const STATE_RANK: Record<ChatState, number> = { need: 0, work: 1, done: 2, park: 3 };

/**
 * The columns, the current coordinator first. Where the feed carries the
 * coordinators as chats (J's does: one list, each row with a `kind`), a
 * column is a live coordinator chat and a chat stands under the one that
 * runs it (`runBy`: its id, code, name or "C7"), else under the current one.
 * Where it doesn't, each of the feed's own live coordinators is a column.
 * `gone` is what this browser archived (true) or put back (false) since the
 * feed was read.
 */
export function columnsOf(feed: LanesFeed | null, gone: Record<string, boolean> = {}): Column[] {
  if (!feed) return [];
  const every = feed.coordinators.flatMap((c) => c.chats);
  const coords = every.filter(isCoordinatorChat);
  const open = feed.questions.filter(isOpen);
  const isGone = (x: LaneChat) => gone[x.id] ?? x.archived === true;
  const todo = (x: LaneChat) => cubeOf(feed, x).count > 0 || open.some((d) => chatsAbout(feed, d.about).some((y) => y.id === x.id));

  const fill = (col: Column, chats: LaneChat[]) => {
    const shown = chats.filter((x) => !isGone(x) && !x.hidden);
    col.archived = byLatest(chats.filter(isGone));
    col.foot = byLatest(shown.filter((x) => x.state === "done" && !todo(x)));
    const footIds = new Set(col.foot.map((x) => x.id));
    col.panes = byLatest(shown.filter((x) => !footIds.has(x.id))).map((x, i) => ({ x, i })).sort((a, b) => STATE_RANK[a.x.state] - STATE_RANK[b.x.state] || a.i - b.i).map((o) => o.x);
  };
  const blank = (id: string, n: number, name: string, coord: LaneChat | null): Column => ({ id, n, label: `C${n}`, name, coord, current: false, colours: coloursOf(n), panes: [], foot: [], archived: [], retired: [], questions: [], own: [], carried: [] });

  let cols: Column[];
  if (coords.length) {
    const num = (x: LaneChat) => numberOf(x.realName ?? x.name)!;
    let live = coords.filter((x) => x.state !== "done" && !x.hidden && !isGone(x)).sort((a, b) => num(b) - num(a));
    if (!live.length) live = [[...coords].sort((a, b) => num(b) - num(a))[0]!];
    cols = live.map((x) => blank(x.id, num(x), x.name, x));
    cols[0]!.current = true;
    const runs = (col: Column, by: string) => { const p = plain(by); return !!p && (by === col.id || p === plain(col.label) || p === plain(col.coord?.code ?? "") || p === plain(col.coord?.realName ?? col.name) || p === String(col.n)); };
    const ids = new Set(coords.map((x) => x.id));
    const rest = every.filter((x) => !ids.has(x.id));
    for (const col of cols) fill(col, rest.filter((x) => (cols.find((c) => runs(c, x.runBy ?? "")) ?? cols[0]!) === col));
    cols[0]!.retired = byLatest(coords.filter((x) => !cols.some((c) => c.id === x.id) && !x.hidden && !isGone(x)));
  } else {
    const live = feed.coordinators.filter((c) => !c.retired);
    const list: LaneCoordinator[] = live.length ? live : feed.coordinators.slice(0, 1);
    cols = list.map((c, i) => { const col = blank(c.id, numberOf(c.name) ?? i + 1, c.name, null); fill(col, c.chats); return col; });
    if (cols[0]) cols[0].current = true;
  }

  /* Each open question stands in the column of a chat it is about; one about no chat in view is the current coordinator's own. */
  for (const d of open) {
    const about = chatsAbout(feed, d.about);
    const col = cols.find((c) => about.some((x) => c.panes.some((p) => p.id === x.id) || c.foot.some((p) => p.id === x.id)))
      ?? cols.find((c) => c.coord && about.some((x) => x.id === c.coord!.id))
      ?? cols[0];
    if (!col) continue;
    col.questions.push(d);
    if (!about.some((x) => col.panes.some((p) => p.id === x.id))) col.own.push(d);
    /* Mark 33: a question whose chats are all gone stands under the current coordinator, carried, never lost. */
    const cur = cols.find((c) => c.current) ?? col;
    if (about.length && about.every((x) => isGone(x) || x.hidden) && !about.some((x) => isCoordinatorChat(x))) {
      if (cur !== col) { col.questions.splice(col.questions.indexOf(d), 1); col.own = col.own.filter((q) => q !== d); cur.questions.push(d); cur.own.push(d); }
      cur.carried.push({ d, from: about[0]! });
    }
  }
  /* Marks 30 and 31: shown oldest first, coloured by that place (green, purple, amber); the newest stays the current one. */
  const shown = [...cols].sort((a, b) => a.n - b.n);
  shown.forEach((c, k) => { c.colours = rankColours(k); });
  return shown;
}
/** The current coordinator's column: the newest live one, where chats with no `runBy` stand and the terminal talks to. */
export const currentOf = (cols: Column[]): Column | null => cols.find((c) => c.current) ?? cols[cols.length - 1] ?? null;
/** Mark 24: a coordinator reads as in the console, "C8 · 🧽 PIONEER" (number, emoji, code word); its name when it has no code. */
export function coordLabel(col: { label: string; name: string; coord: { code?: string; emoji?: string } | null }): string {
  const code = (col.coord?.code ?? "").trim(), emoji = (col.coord?.emoji ?? "").trim();
  return code ? `${col.label} · ${[emoji, code].filter(Boolean).join(" ")}` : `${col.label} · ${col.name}`;
}

/** Mark 25: what a chat works on, from its row's `area`, with a colour for its tag and its faint band on the ring. */
export const AREAS = ["Builder", "Console", "Blender", "Tests", "Coordinator"] as const;
export const AREA_COLOUR: Record<string, string> = { builder: "#35c8ff", console: "#c084fc", blender: "#ff9f43", tests: "#3dffae", coordinator: "#ffd166" };
export const areaOf = (x: { area?: string }) => (x.area ?? "").trim();
export const areaColour = (x: { area?: string }) => AREA_COLOUR[plain(areaOf(x))] ?? (areaOf(x) ? "#b9b3c9" : "");
/** The areas in a list of chats, each with its count, in the order J reads them (the known ones first). */
export function areasIn(chats: { area?: string }[]): { area: string; count: number }[] {
  const m = new Map<string, number>();
  for (const x of chats) { const a = areaOf(x); if (a) m.set(a, (m.get(a) ?? 0) + 1); }
  const rank = (a: string) => { const i = AREAS.findIndex((k) => plain(k) === plain(a)); return i < 0 ? 99 : i; };
  return [...m].map(([area, count]) => ({ area, count })).sort((a, b) => rank(a.area) - rank(b.area) || a.area.localeCompare(b.area));
}

/** Mark 26: a label in parts, so the emoji can sit on its own light chip: "🎛️" + "STAGE · Console stage". */
export function labelParts(x: { name: string; code?: string; emoji?: string; realName?: string }): { emoji: string; words: string } {
  const emoji = (x.emoji ?? "").trim(), whole = labelOf(x);
  return emoji && whole.startsWith(emoji) ? { emoji, words: whole.slice(emoji.length).trim() } : { emoji: "", words: whole };
}

/** The open questions about one chat, in the feed's order. */
export function asksOf(feed: LanesFeed, col: Column, chat: LaneChat): Decision[] {
  return col.questions.filter((d) => chatsAbout(feed, d.about).some((x) => x.id === chat.id));
}

/** Does a row of the feed (a check's or a round's `lane`) mean this chat? Its lane, code, name or id, however written. */
export function isAbout(chat: LaneChat, lane: string): boolean {
  const a = plain(lane);
  return !!a && (lane === chat.id || a === plain(chat.lane) || a === plain(chat.code ?? "") || a === plain(chat.realName ?? chat.name));
}

/**
 * The cube: everything a chat wants J to look at that is not a question
 * (rules §4): its checks not yet ticked and its picture rounds not yet chosen.
 */
export function cubeOf(feed: LanesFeed, chat: LaneChat): { checks: Check[]; rounds: PictureRound[]; count: number } {
  const checks = (feed.checks ?? []).filter((c) => !c.checked && isAbout(chat, c.lane));
  const rounds = (feed.rounds ?? []).filter((r) => !r.chosen && isAbout(chat, r.lane));
  return { checks, rounds, count: checks.length + rounds.length };
}

/* ------------------------------------------------------------ slides (rules §5) */

/** A question with a picture on any option: the only kind that may leave its column. */
export const hasPictures = (d: Decision) => d.options.some((o) => !!o.picture);

/** One slide: a picture question, or a picture round. Stepped up and down, one a slide. */
export type Slide = { kind: "question"; id: string; title: string; who: string; d: Decision } | { kind: "round"; id: string; title: string; who: string; r: PictureRound };
export function slidesOf(feed: LanesFeed | null, cols: Column[]): Slide[] {
  if (!feed) return [];
  const out: Slide[] = [];
  const chats = cols.flatMap((c) => [...(c.coord ? [c.coord] : []), ...c.panes, ...c.foot]);
  for (const c of cols) for (const d of c.questions) if (hasPictures(d)) out.push({ kind: "question", id: d.id, title: d.question, who: chatsAbout(feed, d.about)[0]?.name ?? d.about, d });
  for (const r of feed.rounds ?? []) if (!r.chosen) out.push({ kind: "round", id: r.id, title: r.title, who: chats.find((x) => isAbout(x, r.lane))?.name ?? r.lane, r });
  return out;
}
/** The slide a step up (-1) or down (+1) lands on; the ends hold. */
export const stepSlide = (at: number, by: number, n: number) => Math.max(0, Math.min(n - 1, at + by));
/** How many options sit side by side on a slide (rules §5): three from about 1150 px, two from about 700, else one. */
export const slideAcross = (width: number, options: number) => Math.max(1, Math.min(options, width >= 1150 ? 3 : width >= 700 ? 2 : 1));

/* ------------------------------------------------------------ turns */

/** A chat is mature at about five turns (lane-rules): "2/5"; `tone` is amber at five, red past it. */
export const TURNS = 5;
export function turnsOf(x: LaneChat | null): { words: string; tone: "ok" | "full" | "over" } | null {
  if (!x || typeof x.turns !== "number") return null;
  return { words: `${x.turns}/${TURNS}`, tone: x.turns > TURNS ? "over" : x.turns === TURNS ? "full" : "ok" };
}

/* ------------------------------------------------------------ what a chat costs the PC (rules §4, the Orbs brief's X and Y) */

export type CostKind = "shell" | "host" | "node" | "browser" | "other";
/** The five kinds of process, as Running now names them. */
export const KIND_WORD: Record<CostKind, string> = { shell: "PowerShell or cmd", host: "console host", node: "node or npx", browser: "browser", other: "other" };
export const KIND_ORDER: CostKind[] = ["shell", "host", "node", "browser", "other"];
export interface KindCost { kind: CostKind; count: number; memBytes: number; cpu: number | null }
/**
 * One owner of processes on J's PC, as the helper sums it: a chat's session,
 * or a label's `session` word (TRAY, HELPER, a lane's code word). Sums and
 * kinds only: never a pid, a path or a command line.
 */
export interface OwnerCost { key: string; title: string; memBytes: number; cpu: number | null; startedAt: number; kinds: KindCost[] }
export interface PcCost { at: number; memTotal: number; owners: OwnerCost[] }

/** The helper's answer as written, or null when it isn't one. */
export function readCost(raw: unknown): PcCost | null {
  const r = raw as { at?: unknown; memTotal?: unknown; owners?: unknown } | null;
  if (!r || !Array.isArray(r.owners)) return null;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);
  const owners: OwnerCost[] = [];
  for (const o of r.owners as Record<string, unknown>[]) {
    if (!o || typeof o.key !== "string" || !Array.isArray(o.kinds)) continue;
    const kinds = (o.kinds as Record<string, unknown>[]).flatMap((k) => (k && KIND_ORDER.includes(k.kind as CostKind) ? [{ kind: k.kind as CostKind, count: Math.max(1, Math.round(num(k.count))), memBytes: num(k.memBytes), cpu: typeof k.cpu === "number" ? num(k.cpu) : null }] : []));
    owners.push({ key: o.key, title: typeof o.title === "string" ? o.title : "", memBytes: num(o.memBytes), cpu: typeof o.cpu === "number" ? num(o.cpu) : null, startedAt: num(o.startedAt), kinds });
  }
  return { at: num(r.at), memTotal: num(r.memTotal), owners };
}

/** Is this owner the chat's? Its session id, or a label whose `session` is the chat's name, code, id or lane. */
export function owns(o: OwnerCost, chat: LaneChat): boolean {
  if (o.key === chat.id) return true;
  const k = plain(o.key), t = plain(o.title);
  const names = [chat.code ?? "", chat.lane, chat.realName ?? chat.name].map(plain).filter(Boolean);
  return (!!k && names.includes(k)) || (!!t && t === plain(chat.realName ?? chat.name));
}

/** Several owners as one: memory and CPU summed, the oldest start, the kinds merged, biggest first. */
export function sumCost(list: OwnerCost[]): OwnerCost | null {
  if (!list.length) return null;
  const kinds = new Map<CostKind, KindCost>();
  for (const o of list) for (const k of o.kinds) {
    const was = kinds.get(k.kind);
    kinds.set(k.kind, was ? { kind: k.kind, count: was.count + k.count, memBytes: was.memBytes + k.memBytes, cpu: was.cpu === null && k.cpu === null ? null : (was.cpu ?? 0) + (k.cpu ?? 0) } : { ...k });
  }
  const cpus = list.map((o) => o.cpu).filter((c): c is number => c !== null);
  const starts = list.map((o) => o.startedAt).filter((t) => t > 0);
  return {
    key: list[0]!.key, title: list[0]!.title,
    memBytes: list.reduce((a, o) => a + o.memBytes, 0),
    cpu: cpus.length ? cpus.reduce((a, b) => a + b, 0) : null,
    startedAt: starts.length ? Math.min(...starts) : 0,
    kinds: [...kinds.values()].sort((a, b) => b.memBytes - a.memBytes),
  };
}
/** What one chat costs: everything it owns, as one. Null when it runs nothing. */
export const costOf = (pc: PcCost | null, chat: LaneChat): OwnerCost | null => (pc ? sumCost(pc.owners.filter((o) => owns(o, chat))) : null);
/** A column's total: its coordinator's own jobs and every chat in it together (rules §4). */
export function columnCost(pc: PcCost | null, col: Column): OwnerCost | null {
  if (!pc) return null;
  const chats = [...(col.coord ? [col.coord] : []), ...col.panes, ...col.foot];
  return sumCost(pc.owners.filter((o) => chats.some((x) => owns(o, x))));
}
/** What belongs to no chat in any column (the tray, the helper): shown by its label's own word, never as "no session". */
export function unowned(pc: PcCost | null, cols: Column[]): OwnerCost[] {
  if (!pc) return [];
  const chats = cols.flatMap((c) => [...(c.coord ? [c.coord] : []), ...c.panes, ...c.foot]);
  return pc.owners.filter((o) => !chats.some((x) => owns(o, x)));
}

/** "700 MB", "1.4 GB". */
export function memWords(bytes: number): string {
  const mb = bytes / 1048576;
  return mb >= 1000 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}
/** "CPU 5%": a share of the whole PC; under a half reads "under 1%". Nothing on the first read. */
export function cpuWords(cpu: number | null): string {
  if (cpu === null) return "";
  return cpu > 0 && cpu < 0.5 ? "CPU under 1%" : `CPU ${Math.round(cpu)}%`;
}
/** "up 10 min", from its oldest running job. */
export function upWords(startedAt: number, now: number): string {
  if (!startedAt) return "";
  const s = Math.max(0, Math.floor((now - startedAt) / 1000));
  return `up ${s < 60 ? `${s} s` : s < 3600 ? `${Math.floor(s / 60)} min` : s < 86400 ? `${Math.floor(s / 3600)} h` : `${Math.floor(s / 86400)} d`}`;
}
/**
 * Each kind's share of the total, biggest first (J: "on hover it displays how
 * much of the total value it is contributing"): "PowerShell or cmd · 214 MB ·
 * 62% of this chat · 80% of its CPU". `of` is "this chat" or "this column".
 * While private the memory figure is left out and the shares stay.
 */
export function shareLines(c: OwnerCost, of: string, priv = false): { kind: CostKind; words: string }[] {
  const cpuAll = c.kinds.reduce((a, k) => a + (k.cpu ?? 0), 0);
  return c.kinds.map((k) => {
    const parts = [`${KIND_WORD[k.kind]}${k.count > 1 ? ` ×${k.count}` : ""}`];
    if (!priv) parts.push(memWords(k.memBytes));
    parts.push(`${c.memBytes ? Math.round((100 * k.memBytes) / c.memBytes) : 0}% of ${of}`);
    if (cpuAll > 0) parts.push(`${Math.round((100 * (k.cpu ?? 0)) / cpuAll)}% of its CPU`);
    return { kind: k.kind, words: parts.join(" · ") };
  });
}
/** The memory pill's bar, on one scale for every chat: the heaviest fills it. */
export const pillShare = (bytes: number, heaviest: number) => (heaviest > 0 ? Math.max(0.04, Math.min(1, bytes / heaviest)) : 0);

/* ------------------------------------------------------------ the model chip (rules §7) */

export const MODELS = ["Fable 5.2", "Opus 5.5", "Sonnet 5.5", "Haiku 5.5"] as const;
export const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
/** What a chat runs on, from its row: `model` and `effort`, or an effort written as the last word of `model`. */
export function modelOf(x: { model?: string; effort?: string }): { model: string; effort: string } | null {
  const m = (x.model ?? "").trim();
  if (!m) return null;
  let effort = (x.effort ?? "").trim();
  let model = m;
  const last = m.split(/\s+/).pop()!.toLowerCase();
  if ((EFFORTS as readonly string[]).includes(last)) { model = m.slice(0, m.length - last.length).trim(); effort = effort || last; }
  return { model, effort };
}
/** The chip's words: "Opus 5.5 · medium", and "→ Fable 5.2 · high asked" until the coordinator has applied a press. */
export function chipWords(now: { model: string; effort: string } | null, asked: { model: string; effort: string } | null, priv: boolean): string {
  if (priv) return asked ? "model → asked" : "model";
  const say = (m: { model: string; effort: string }) => (m.effort ? `${m.model} · ${m.effort}` : m.model);
  const was = now ? say(now) : "model not said";
  return asked && !(now && now.model === asked.model && now.effort === asked.effort) ? `${was} → ${say(asked)} asked` : was;
}

/* ------------------------------------------------------------ words */

/** A line cut at a word with nothing dangling (rules §4: "▸ more", never "…"). */
export function cutAt(text: string, max = 140): { words: string; more: boolean } {
  const t = text.trim();
  if (t.length <= max) return { words: t, more: false };
  const cut = t.slice(0, max);
  const at = cut.lastIndexOf(" ");
  return { words: (at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,;:.]+$/, ""), more: true };
}

/** How wide each column is: the columns share what the orbs leave, none wider than 640 px, none narrower than 300. */
export function columnWidth(space: number, count: number, gap = 8): number {
  const n = Math.max(1, count);
  return Math.max(300, Math.min(640, Math.floor((space - gap * (n - 1)) / n)));
}

/* ------------------------------------------------------------ BAM: the manager as J drew it (2026-11-11, `21.webp`) */

/** "🎛️ STAGE · Console stage" (mark 22): the console's badge beside the plain name, so a pane is matched across the two; the name alone when the code says the same. */
export function labelOf(x: { name: string; code?: string; emoji?: string; realName?: string }): string {
  const name = x.realName ?? x.name, code = (x.code ?? "").trim();
  const badge = [x.emoji ?? "", code].filter(Boolean).join(" ").trim();
  if (!code || plain(code) === plain(name) || plain(x.name) === plain(badge)) return x.name;
  return `${badge} · ${name}`;
}

/** Mark 17 (GUESS, built first): a finished chat is archived once it finished more than a day ago and nothing about it waits on J. */
export const ARCHIVE_AFTER_MS = 24 * 3600_000;
const seen = (x: LaneChat) => { const t = Date.parse(x.lastSeen); return Number.isFinite(t) ? t : x.sentAt ?? 0; };
export function isOldDone(feed: LanesFeed, x: LaneChat, now: number): boolean {
  if (x.state !== "done") return false;
  if (feed.questions.some((d) => isOpen(d) && chatsAbout(feed, d.about).some((y) => y.id === x.id))) return false;
  if (cubeOf(feed, x).count > 0) return false;
  const t = seen(x);
  return !t || now - t > ARCHIVE_AFTER_MS;
}
/** Mark 16: what leaves the ring for the nucleus: archived by J, or finished a day ago with nothing waiting. Newest first. */
export function nucleusChats(feed: LanesFeed | null, now: number): LaneChat[] {
  if (!feed) return [];
  return byLatest(feed.coordinators.flatMap((c) => c.chats).filter((x) => !isCoordinatorChat(x) && (x.archived === true || isOldDone(feed, x, now))));
}

/**
 * Mark 18: each chat still on a ring has its own place, by when it began: the
 * oldest at the front and the rest evenly round, so two are never in one place
 * (`20.webp`: two working chats read as one big orb). A fraction of a turn.
 */
export function ringSlots(chats: LaneChat[]): Map<string, number> {
  const list = chats.map((x, i) => ({ x, i })).sort((a, b) => (a.x.begun ?? 0) - (b.x.begun ?? 0) || a.i - b.i);
  return new Map(list.map((o, k) => [o.x.id, k / Math.max(1, list.length)]));
}

/** Mark 19: an orb's press area, in board units: its own size, and never under `minPx` across the radius on screen. */
export const hitRadius = (drawn: number, pxPerUnit: number, minPx = 16) => Math.max(drawn, pxPerUnit > 0 ? minPx / pxPerUnit : drawn);

/**
 * Marks 12 and 13: the layout J drew. The column stands off the left wall
 * (`gap`), the ring sits in a rail at the top right with the terminal under
 * it (`rail`), and the nebula shows between them. Under 760 px everything
 * stacks.
 */
export interface Layout { stacked: boolean; gap: number; rail: number; col: number; orbsH: number }
export function layoutOf(width: number, height: number, cols: number): Layout {
  const stack = (): Layout => ({ stacked: true, gap: 8, rail: width - 16, col: width - 16, orbsH: Math.round(Math.min(width - 16, 420)) });
  if (width > 0 && width < 760) return stack();
  const n = Math.max(1, cols), cramped = 8 + 8 * n + 8;
  let gap = Math.max(40, Math.round(width * 0.04));
  let rail = Math.max(340, Math.min(620, Math.round(width * 0.34)));
  /* Where the columns at their narrowest and the rail don't fit, the rail gives way first (to 300), then the gap (to 16): nothing ever overlaps. */
  const over = () => gap + n * 300 + rail + cramped - width;
  if (width > 0 && over() > 0) rail = Math.max(300, rail - over());
  if (width > 0 && over() > 0) gap = Math.max(16, gap - over());
  if (width > 0 && over() > 0) return stack();
  const col = columnWidth(width - gap - rail - cramped, n, 0);
  /* The terminal and New coordinator under the ring keep about 400 px; the ring gives way first, never under 220. */
  const orbsH = Math.round(Math.max(220, Math.min(height * 0.56, rail * 0.9, height > 0 ? height - 400 : Infinity)));
  return { stacked: false, gap, rail, col, orbsH };
}

/**
 * Mark 11, and the console's mark 19: one question button per head, and its
 * page grouped: new since J last looked, then by chat, then older ones carried
 * over (asked more than a day ago, or carried from another chat). Newest first
 * inside each group. `seen` holds the ids J has opened in this browser.
 */
export interface QuestionGroups { fresh: Decision[]; byChat: { who: string; list: Decision[] }[]; older: Decision[] }
const askedAt = (d: Decision) => { const t = Date.parse(d.asked || d.askedAt); return Number.isFinite(t) ? t : 0; };
export const newestFirst = (list: Decision[]) => list.map((d, i) => ({ d, i })).sort((a, b) => askedAt(b.d) - askedAt(a.d) || b.d.order - a.d.order || b.i - a.i).map((o) => o.d);
export const isCarried = (d: Decision, now: number) => !!d.carried.trim() || (!!d.askedBy && plain(d.askedBy) !== plain(d.about)) || (askedAt(d) > 0 && now - askedAt(d) > ARCHIVE_AFTER_MS);
export function questionGroups(feed: LanesFeed, list: Decision[], seenIds: Set<string>, now: number): QuestionGroups {
  const out: QuestionGroups = { fresh: [], byChat: [], older: [] };
  for (const d of newestFirst(list)) {
    if (isCarried(d, now)) { out.older.push(d); continue; }
    if (!seenIds.has(d.id)) { out.fresh.push(d); continue; }
    const x = chatsAbout(feed, d.about)[0];
    const who = x ? labelOf(x) : d.about || "the coordinator";
    let g = out.byChat.find((b) => b.who === who);
    if (!g) { g = { who, list: [] }; out.byChat.push(g); }
    g.list.push(d);
  }
  return out;
}
/** "3 new · 10 older" for the head's button. */
export function countWords(g: QuestionGroups): string {
  const mid = g.byChat.reduce((n, b) => n + b.list.length, 0);
  return [g.fresh.length ? `${g.fresh.length} new` : "", mid ? `${mid} seen` : "", g.older.length ? `${g.older.length} older` : ""].filter(Boolean).join(" · ");
}

/** Mark 13: a point kept inside the board with room to spare, so nothing loose (a leftover sun) nears the screen's edge. */
export const keepInside = (p: { x: number; y: number; z: number }, view: { x: number; y: number; w: number; h: number }, margin: number) =>
  ({ x: Math.max(view.x + margin, Math.min(view.x + view.w - margin, p.x)), y: Math.max(view.y + margin, Math.min(view.y + view.h - margin, p.y)), z: p.z });

/** What J types in the terminal becomes one of these presses, saved for the coordinator (marks 1 and 9). */
export type SayKind = "say" | "note" | "new-chat";
export const SAY_WHEN = "Saved on your PC. The coordinator reads it on its next turn: nothing can reach a chat sooner.";

/* ------------------------------------------------------------ BAM turn 4: delete, end, carried questions (marks 33, 41, 42, 43) */

/** Mark 42: a deleted question or picture round leaves the view at once; the coordinator closes it in lanes.json. */
export function withoutDeleted(feed: LanesFeed | null, deleted: Record<string, boolean>): LanesFeed | null {
  if (!feed) return feed;
  const gone = (id: string) => deleted[id] === true;
  if (!feed.questions.some((d) => gone(d.id)) && !(feed.rounds ?? []).some((r) => gone(r.id))) return feed;
  const questions = feed.questions.filter((d) => !gone(d.id));
  return { ...feed, questions, rounds: (feed.rounds ?? []).filter((r) => !gone(r.id)), decisions: questions.filter(isOpen).length };
}
/** Mark 41 (GUESS): the head counts the questions on the column's chat panes (its carried ones too), not the coordinator's own list. */
export function paneCount(feed: LanesFeed, col: Column): number {
  const onPanes = col.questions.filter((d) => chatsAbout(feed, d.about).some((x) => col.panes.some((p) => p.id === x.id)));
  return onPanes.length + col.carried.length;
}
/** Mark 44 (GUESS): ask once before ending a chat that is still working. */
export const endWords = (x: { name: string; code?: string; emoji?: string; state: ChatState; realName?: string }) =>
  x.state === "work" ? `End ${labelParts(x).emoji ? `${labelParts(x).emoji} ` : ""}${labelParts(x).words}? It is working now.` : "";
/** Mark 38: the legend under the ring, as the console says it. */
export const LEGEND: { state: ChatState; words: string }[] = [{ state: "work", words: "working" }, { state: "need", words: "waiting for you" }, { state: "done", words: "done" }];
