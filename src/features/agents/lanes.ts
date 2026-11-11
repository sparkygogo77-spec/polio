/**
 * THE LANES BOARD, THE PURE PART (J, 2026-11-01/02): what the feed means and
 * where everything sits. One ring per coordinator, one orb per chat, and no
 * nucleus: the finished chats themselves are the middle. No React and no
 * imports, so tests/lanes-board.mjs imports it straight.
 *
 * The geometry is the prototype's (Gyro4, round B; `ROUNDS` holds B1–B3): a
 * ring is a circle that tumbles slowly end over end about the horizontal axis
 * while its coordinator works, on its own upright axis, seen from a little
 * above. It is cut into short pieces that are depth-sorted with the orbs, so
 * rings pass in front of and behind each other.
 */

export type ChatState = "need" | "work" | "done" | "park";

export interface LaneChat {
  id: string;
  name: string;
  /** Its folder without `work-`, what a heartbeat calls it; `name` is free to be the words J reads. */
  lane: string;
  state: ChatState;
  /** When its last message was sent; a new value starts a new lap. */
  sentAt: number | null;
  /** When the coordinator last heard from it (an ISO time), for the notes under the board. */
  lastSeen: string;
  /** What changed, oldest first: only the lines the coordinator marked public reach here; the details strip shows the newest first. */
  history: HistoryStep[];
  /** The helper's own agent: its controls are in the helper's tab, not in a chat. */
  helper: boolean;
  /** The coordinator's note and the chat's latest line (J, 2026-11-10, piece G: shown in the Builder, never published). */
  note?: string;
  last?: string;
  /** Its badge (lane-rules, J 2026-11-10): one code word and an emoji; what a private screen shows in place of its name. */
  code?: string;
  emoji?: string;
  /** Its name as written, kept for matching a question's `about` while the drawn name is its badge. */
  realName?: string;
}
export interface HistoryStep { at: string; text: string }
/** Names and states only: the helper keeps notes off the Builder's page (`helper/server/lanes.ts`). */
/** `retired`: the coordinator handed over (the feed says so, or every chat of it is done); it joins the archive nucleus (piece M). */
export interface LaneCoordinator { id: string; name: string; chats: LaneChat[]; retired: boolean; note?: string }
/** One of the coordinator's questions for J, with its options (decisions panel, 2026-11-03). */
export interface DecisionOption { key: string; label: string; desc: string; picture: string; pick: boolean }
/** `area` is a picture of the part being worked on; `ask` is J asking for new options, until the coordinator reposts the question (round 2). */
export interface Decision {
  id: string; order: number; about: string; question: string; why: string; options: DecisionOption[]; answer: string; answeredAt: string; area: string; ask: string; askedAt: string;
  /** Piece F: the question whole (What, How, a longer background), and when it was first asked. */
  what: string; how: string; context: string; asked: string;
  /** Piece O: the retired lane that first asked it, and when it was carried to `about`, the live lane that owns it now. */
  askedBy: string; carried: string;
}
/** `decisions` is how many questions wait on J; `questions` are those questions, answered ones included. */
export interface LanesFeed { coordinators: LaneCoordinator[]; decisions: number; questions: Decision[] }
export interface LaneBeat { session: string; name: string; at: number }

export const STATE_COLOUR: Record<ChatState, string> = { need: "#ff4d4d", work: "#35c8ff", done: "#3dffae", park: "#6f7f99" };
export const STATE_WORD: Record<ChatState, string> = { need: "needs you", work: "working", done: "done", park: "parked" };
/** A chat is working while it has called a tool this recently. */
export const BEAT_MS = 2 * 60_000;
export const POLL_MS = 5000;

const STATES = new Set<string>(["need", "work", "done", "park"]);
const words = (v: unknown) => (typeof v === "string" ? v : "");

/** The feed as the coordinator wrote it, or null when it isn't one. A chat it can't read is left out, never guessed at. */
export function readFeed(raw: unknown): LanesFeed | null {
  const r = raw as { coordinators?: unknown; decisions?: unknown } | null;
  if (!r || !Array.isArray(r.coordinators)) return null;
  const coordinators: LaneCoordinator[] = [];
  for (const c of r.coordinators as Record<string, unknown>[]) {
    if (!c || typeof c.id !== "string" || !Array.isArray(c.chats)) continue;
    const chats: LaneChat[] = [];
    for (const x of c.chats as Record<string, unknown>[]) {
      if (!x || typeof x.id !== "string" || !STATES.has(x.state as string)) continue;
      chats.push({ id: x.id, name: words(x.name) || x.id, lane: words(x.lane), state: x.state as ChatState, sentAt: typeof x.sentAt === "number" ? x.sentAt : null, lastSeen: words(x.lastSeen), history: readHistory(x.history), helper: x.helper === true, code: words(x.code), emoji: words(x.emoji), note: words(x.note), last: words(x.last) });
    }
    coordinators.push({ id: c.id, name: words(c.name) || c.id, chats, retired: c.retired === true || (chats.length > 0 && chats.every((x) => x.state === "done")), note: words(c.note) });
  }
  const need = coordinators.reduce((n, c) => n + c.chats.filter((x) => x.state === "need").length, 0);
  /* The questions themselves, or (as the feed began) only their count, or else the red chats. */
  const questions = readDecisions(r.decisions);
  const decisions = Array.isArray(r.decisions) ? questions.filter(isOpen).length : typeof r.decisions === "number" ? r.decisions : need;
  return { coordinators, decisions, questions };
}

/** The questions as the coordinator wrote them, by `order`. One without an id, a question or options to press is left out. */
export function readDecisions(raw: unknown): Decision[] {
  if (!Array.isArray(raw)) return [];
  const out: Decision[] = [];
  for (const d of raw as Record<string, unknown>[]) {
    if (!d || typeof d.id !== "string" || !d.id || typeof d.question !== "string") continue;
    const options: DecisionOption[] = [];
    for (const o of Array.isArray(d.options) ? (d.options as Record<string, unknown>[]) : []) {
      if (!o || typeof o.key !== "string" || !o.key) continue;
      options.push({ key: o.key, label: words(o.label) || o.key, desc: words(o.desc), picture: pictureKind(words(o.picture)) ? words(o.picture) : "", pick: o.pick === true });
    }
    out.push({ id: d.id, order: typeof d.order === "number" ? d.order : 1e9, about: words(d.about), question: d.question, why: words(d.why), options, answer: words(d.answer), answeredAt: words(d.answeredAt), area: pictureKind(words(d.area)) ? words(d.area) : "", ask: words(d.ask), askedAt: words(d.askedAt), what: words(d.what), how: words(d.how), context: words(d.context), asked: words(d.asked) || words(d.askedAt), askedBy: words(d.askedBy), carried: words(d.carried) });
  }
  return out.map((d, i) => ({ d, i })).sort((a, b) => a.d.order - b.d.order || a.i - b.i).map((x) => x.d);
}

export const isOpen = (d: Decision) => !d.answer.trim();

/** A chat's history as written, oldest first; a step without words is left out. */
export function readHistory(raw: unknown): HistoryStep[] {
  if (!Array.isArray(raw)) return [];
  const out: HistoryStep[] = [];
  for (const h of raw as Record<string, unknown>[]) {
    const text = h && typeof h === "object" ? words(h.text).trim() : "";
    if (!text) continue;
    out.push({ at: typeof h.at === "number" ? new Date(h.at).toISOString() : words(h.at), text });
  }
  return out;
}

/** A step's time, short, in J's own time zone: "3 Nov, 14:05". */
export function whenOf(at: string): string {
  const t = Date.parse(at);
  if (!Number.isFinite(t)) return "";
  return new Date(t).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/**
 * A picture is a path under `handovers/`, served read-only: an image, or an
 * html page the panel shows live in a sandboxed frame. Anything else (a
 * folder climb, a full address, another kind of file) isn't one.
 */
export function pictureKind(p: string): "image" | "page" | null {
  if (!p || p.startsWith("/") || p.includes("\\") || p.includes(":") || p.split("/").some((s) => !s || s === "." || s === ".." || s.startsWith("."))) return null;
  if (/\.(png|jpe?g|gif|webp|svg)$/i.test(p)) return "image";
  if (/\.html?$/i.test(p)) return "page";
  return null;
}

/** Where a picture is read: the same door the feed came through. */
export const pictureUrl = (base: string, p: string) => `${base}/${p.split("/").map(encodeURIComponent).join("/")}`;

/** The chats a question is about: its `about` is a lane, written however (or a chat's name or id). */
export function chatsAbout(feed: LanesFeed, about: string): LaneChat[] {
  const a = plain(about);
  if (!a) return [];
  return feed.coordinators.flatMap((c) => c.chats).filter((x) => x.id === about || plain(x.lane) === a || plain(x.realName ?? x.name) === a);
}

/** "4 min ago", from an ISO time or a time in ms; nothing when there is none. */
export function agoOf(at: string | number | null, now: number): string {
  const t = typeof at === "number" ? at : at ? Date.parse(at) : NaN;
  if (!Number.isFinite(t)) return "";
  const s = Math.max(0, (now - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

const plain = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * A chat that called a tool in the last two minutes is working, whatever the
 * feed last said, except one that needs J: it still does, and red is the
 * colour that must not hide. A beat knows its chat by the session or the lane
 * (the name, for a chat the feed gives no lane); a chat with no beat keeps the feed's word (a cloud chat never has one).
 */
export function withBeats(feed: LanesFeed, beats: LaneBeat[], now: number): LanesFeed {
  const fresh = beats.filter((b) => now - b.at < BEAT_MS);
  if (!fresh.length) return feed;
  const sessions = new Set(fresh.map((b) => b.session));
  const names = new Set(fresh.map((b) => plain(b.name)).filter(Boolean));
  return {
    ...feed,
    coordinators: feed.coordinators.map((c) => ({
      ...c,
      chats: c.chats.map((x) => (x.state !== "need" && (sessions.has(x.id) || names.has(plain(x.lane || x.name))) ? { ...x, state: "work" as const } : x)),
    })),
  };
}

/**
 * A ring's colour: red if even one of its chats waits on J, green only when
 * every chat on it is done, blue when something works and nothing stops it,
 * grey otherwise.
 */
export function ringState(c: LaneCoordinator): ChatState {
  if (c.chats.some((x) => x.state === "need")) return "need";
  if (c.chats.length && c.chats.every((x) => x.state === "done")) return "done";
  return c.chats.some((x) => x.state === "work") ? "work" : "park";
}
export const doneOf = (c: LaneCoordinator) => c.chats.filter((x) => x.state === "done").length;
export const doneShare = (c: LaneCoordinator) => (c.chats.length ? doneOf(c) / c.chats.length : 0);

/** The desktop app's link to a chat. Only an id goes in it, so a feed can't make it point anywhere else. */
export function chatLink(id: string): string | null {
  return /^[A-Za-z0-9_-]{8,80}$/.test(id) ? `claude://claude.ai/epitaxy/${id}` : null;
}
export const markOf = (name: string) => {
  /* Words with a letter or digit only, so a badge's emoji never splits in half. */
  const w = name.trim().split(/\s+/).filter((x) => /[\p{L}\p{N}]/u.test(x));
  return (w.length > 1 ? `${w[0]?.[0]}${w[1]?.[0]}` : w.join("").slice(0, 2)).toUpperCase();
};

/* ------------------------------------------------------------ colour */

export type Rgb = [number, number, number];
export const STATE_RGB: Record<ChatState, Rgb> = { need: [255, 77, 77], work: [53, 200, 255], done: [61, 255, 174], park: [111, 127, 153] };
/** What a ring breathes towards: a lighter shade of its own colour. */
const BREATH_RGB: Record<ChatState, Rgb> = { need: [255, 140, 120], work: [150, 220, 255], done: [180, 255, 220], park: [150, 220, 255] };
export const mixRgb = (a: Rgb, b: Rgb, u: number): Rgb => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
export const rgbText = (c: Rgb) => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;
/** Colours drift and never snap: 4% of the way every 25 ms, as the prototype's frames did, whatever the frame rate. */
export const driftShare = (dt: number) => 1 - Math.pow(0.96, dt / 0.025);
/** Where a ring's colour is heading now: its state's colour, breathing slowly towards a lighter shade. */
export const ringTarget = (s: ChatState, t: number, ring: number) => mixRgb(STATE_RGB[s], BREATH_RGB[s], (0.08 * (Math.sin(t * 0.9 + ring) + 1)) / 2);
/** An orb's: its state's colour; a working one glints towards green. */
export const orbTarget = (s: ChatState, t: number, seed: number) => mixRgb(STATE_RGB[s], s === "work" ? STATE_RGB.done : STATE_RGB[s], (0.1 * (Math.sin(t * 1.3 + seed) + 1)) / 2);

/* ------------------------------------------------------------ geometry */

export const VIEW = { x: -430, y: -330, w: 860, h: 660 };
const rad = (d: number) => (d * Math.PI) / 180;

/** Round B (J picked B1): no nucleus; the finished chats themselves are the middle. B2 and B3 are the other middles. */
export interface Round { centre: "centrifuge" | "dragon" | "rack" }
export const ROUNDS = {
  /** Spinning slowly, like a centrifuge. */
  B1: { centre: "centrifuge" },
  /** Floating like dragon balls, each on its own small slow orbit. */
  B2: { centre: "dragon" },
  /** Racked in a pool triangle, turning slowly. */
  B3: { centre: "rack" },
} as const satisfies Record<string, Round>;

/** The camera looks at the middle from this far above. */
export const PITCH = 22;
/** Where the camera stands (the Tune drawer's orientation): how far above, and turned how far round the upright. */
export const camera = { pitch: PITCH, yaw: 0 };
export interface Seen { x: number; y: number; z: number }
/** A point (x right, y up, z towards the viewer) turned by `tilt` about the horizontal axis and `axis` about the upright one, as the screen shows it; z above zero is nearer. */
export function project(x: number, y: number, z: number, tilt: number, axis: number): Seen {
  const th = rad(tilt), ps = rad(axis + camera.yaw), phi = rad(camera.pitch);
  const y1 = y * Math.cos(th) - z * Math.sin(th), z1 = y * Math.sin(th) + z * Math.cos(th);
  const x2 = x * Math.cos(ps) + z1 * Math.sin(ps), z2 = -x * Math.sin(ps) + z1 * Math.cos(ps);
  return { x: x2, y: -(y1 * Math.cos(phi) - z2 * Math.sin(phi)), z: y1 * Math.sin(phi) + z2 * Math.cos(phi) };
}

/** A new ring is small and grows outward as its chats finish; each ring a step further out than the last, so none sits on another. */
export const radiusOf = (done: number, ring: number) => 150 + 150 * done + 24 * ring;
/** Each ring on its own axis, 55° apart. */
export const axisOf = (ring: number) => -55 + 55 * ring;
/** Degrees a second a working ring tumbles end over end: slower the more is done, and each ring its own speed. */
export const tumbleSpeed = (done: number, ring: number) => (1 - done) * 10 * (0.8 + 0.27 * ring);
/** Where a ring's tumble starts, so no two set off in line. */
export const startTilt = (ring: number) => 80 + 40 * ring + 47 * ring;
/** A ring at rest floats and tilts a few degrees. */
export const restWobble = (t: number, ring: number) => ({ tilt: 7 * Math.sin(t * 0.5 + ring * 1.3), axis: 8 * Math.sin(t * 0.33 + ring * 0.7), float: 8 * Math.sin(t * 0.6 + ring) });

/** Orbs 2 (J: "I can see the ring vectors"): 96 pieces, each a curve through the circle's own midpoint, so no facet shows. */
export const SEGMENTS = 96;
/** A point of a ring, at angle `a` round it. */
export const ringPoint = (r: number, a: number, tilt: number, axis: number, float = 0) => project(r * Math.cos(a), float, r * Math.sin(a), tilt, axis);
/** The ring cut into short pieces, each with its own depth, to sort with everything else: rings pass in front of and behind each other and the orbs. */
export function ringSegments(r: number, tilt: number, axis: number, float = 0): { d: string; z: number }[] {
  const at = (p: Seen) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
  const pt = (u: number) => ringPoint(r, (u / SEGMENTS) * 2 * Math.PI, tilt, axis, float);
  return Array.from({ length: SEGMENTS }, (_, k) => {
    /* Each piece runs a little into the next (SEG_OVERLAP), so their opaque strokes meet with no hairline seam. */
    const p = pt(k), q = pt(k + 1 + SEG_OVERLAP), m = pt(k + (1 + SEG_OVERLAP) / 2), mid = pt(k + 0.5);
    /* The control point that makes the curve pass through the arc's own midpoint. */
    const c = { x: 2 * m.x - (p.x + q.x) / 2, y: 2 * m.y - (p.y + q.y) / 2, z: m.z };
    return { d: `M${at(p)}Q${at(c)} ${at(q)}`, z: mid.z };
  });
}
/** How far (in pieces) each runs into the next. */
export const SEG_OVERLAP = 0.3;
/** The whole ring as one line, for its glow underneath everything. */
export function ringLine(r: number, tilt: number, axis: number, float = 0): string {
  const pts: string[] = [];
  for (let k = 0; k <= SEGMENTS; k++) { const p = ringPoint(r, (k / SEGMENTS) * 2 * Math.PI, tilt, axis, float); pts.push(`${p.x.toFixed(1)} ${p.y.toFixed(1)}`); }
  return `M${pts.join("L")}`;
}
/** A lap's place on the ring: 0 and 1 are the front, 0.5 the back. */
export const lapAngle = (pos: number) => Math.PI / 2 + pos * 2 * Math.PI;
/** Chats that wait fan out round the front, a little over an orb apart. */
export const fanAngle = (slot: number, count: number, r: number) => ((slot - (count - 1) / 2) * 56) / r;

/** The middle: where the k-th of m finished chats is at time t. */
export function centreAt(round: Round, k: number, m: number, t: number): Seen {
  if (round.centre === "dragon") {
    const a = t * (0.11 + 0.035 * (k % 3)) + k * 2.1, r = 40 + 28 * (k % 3), lean = 0.5 + 0.3 * (k % 2);
    return project(Math.cos(a) * r, Math.sin(a) * r * Math.sin(lean) + 8 * Math.sin(t * 1.5 + k), Math.sin(a) * r * Math.cos(lean), 0, 0);
  }
  if (round.centre === "rack") {
    const row = Math.floor((Math.sqrt(8 * k + 1) - 1) / 2), idx = k - (row * (row + 1)) / 2, step = 58;
    return project((idx - row / 2) * step, 0, (row - 1.2) * step * 0.866, 0, (t * 0.07 * 180) / Math.PI);
  }
  const a = t * 0.32 + (k * 2 * Math.PI) / Math.max(1, m), r = m > 1 ? 78 : 0;
  return project(Math.cos(a) * r, 6 * Math.sin(t * 2 + k), Math.sin(a) * r, 0, 0);
}

/* ------------------------------------------------------------ motion */

/** One smooth ease over a message. */
export const easeInOut = (s: number) => (s < 0.5 ? 2 * s * s : 1 - Math.pow(-2 * s + 2, 2) / 2);
/** A lap's place for how far through its message it is: out at 5%, round the back, home. */
export const lapPos = (s: number) => 0.05 + 0.95 * easeInOut(Math.min(1, Math.max(0, s)));
/** How far through, while the chat still thinks: round to the back and waiting there for the answer. */
export const thinkingShare = (tau: number) => 0.5 * (1 - Math.exp(-tau / 5));
/** How long the rest of the lap takes once the answer is in. */
export const ANSWER_S = 2.5;

export const TUMBLE_S = 2.6;
/** Three whole turns, fast, then easing out; at 1 it is whole turns, so the ring lands where it left. */
export const tumbleAt = (u: number) => 1080 * (1 - Math.pow(1 - Math.min(1, Math.max(0, u)), 4));

/** A small steady number from a name, so a staggered start is the same every load. */
export const hashOf = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 9973; return h; };

/* ------------------------------------------------------------ the helper's state (Orbs 2, piece A) */

/**
 * What the Builder can tell about the helper (J, 2026-11-10: "if it is active
 * at all the Builder lets it be known, as well as when it's disconnected or
 * my PC turned it off"):
 *   · paired: it answered `/health` and says a dock is paired;
 *   · answering: it answered, but no dock is paired, or (off the live Builder,
 *     where it refuses to say more) it only answered at all;
 *   · off: nothing answered: the helper is stopped, or the PC is asleep or off;
 *   · checking: not asked yet.
 */
export type HelperState = "checking" | "paired" | "answering" | "off";
export interface HelperRead { health: { paired?: unknown } | null; answered: boolean }
export function helperStateOf(r: HelperRead): HelperState {
  if (r.health) return r.health.paired === true ? "paired" : "answering";
  return r.answered ? "answering" : "off";
}
export const HELPER_COLOUR: Record<HelperState, string> = { checking: "#6f7f99", paired: "#3dffae", answering: "#ffc94d", off: "#ff4d4d" };
export function helperWords(s: HelperState, paired: boolean | null): string {
  if (s === "paired") return "Helper on, paired and answering";
  if (s === "answering") return paired === false ? "Helper on and answering, not paired" : "Helper on and answering";
  if (s === "off") return "Helper not answering: it is off, or the PC is asleep";
  return "Looking for the helper";
}
/** How often the Builder asks; a stop shows within one of these. */
export const HELPER_POLL_MS = 3000;

/* ------------------------------------------------------------ the archive body (piece C) */

/** Only working, waiting and parked chats are orbs of their own; the finished ones are one archive body. */
export const isArchived = (x: LaneChat) => x.state === "done";
/** How many finished chats a press on the archive fans out. */
export const ARCHIVE_FAN = 12;
const seenAt = (x: LaneChat) => { const t = Date.parse(x.lastSeen); return Number.isFinite(t) ? t : x.sentAt ?? 0; };
/** The finished chats, latest first (last heard from, else last sent). */
export function archiveOf(feed: LanesFeed | null): LaneChat[] {
  if (!feed) return [];
  return feed.coordinators.flatMap((c) => c.chats).filter(isArchived).map((x, i) => ({ x, i })).sort((a, b) => seenAt(b.x) - seenAt(a.x) || a.i - b.i).map((o) => o.x);
}
/** The archive searched by name or lane, however written; an empty search is the whole archive. */
export function searchArchive(list: LaneChat[], q: string): LaneChat[] {
  const w = q.trim().toLowerCase();
  if (!w) return list;
  const p = plain(w);
  return list.filter((x) => x.name.toLowerCase().includes(w) || (!!p && (plain(x.name).includes(p) || plain(x.lane).includes(p))));
}
/** Where the k-th of n fanned-out finished chats sits round the archive body: a flat ring, a full turn for a dozen. */
export function archiveSlot(k: number, n: number, r = 118): Seen {
  const a = -Math.PI / 2 + (k / Math.max(1, n)) * 2 * Math.PI;
  return project(r * Math.cos(a), 0, r * Math.sin(a), 0, 0);
}

/* ------------------------------------------------------------ order on a ring (piece D) */

export type BoardOrder = "state" | "age" | "coordinator";
const STATE_RANK: Record<ChatState, number> = { need: 0, work: 1, park: 2, done: 3 };
/** The chats waiting at a ring's front, left to right: by state (red first), by age (oldest heard from first) or as the coordinator listed them. */
export function orderChats(chats: LaneChat[], order: BoardOrder): LaneChat[] {
  const at = chats.map((x, i) => ({ x, i }));
  if (order === "state") at.sort((a, b) => STATE_RANK[a.x.state] - STATE_RANK[b.x.state] || a.i - b.i);
  else if (order === "age") at.sort((a, b) => seenAt(a.x) - seenAt(b.x) || a.i - b.i);
  return at.map((o) => o.x);
}

/* ------------------------------------------------------------ weighted orbs (piece E) */

/**
 * An orb's body: how far it is pulled off its place, and how fast it moves.
 * A drag holds it; let go, it is flung with the hand's speed and a spring
 * (gravity) pulls it home through drag (resistance); the board's edge
 * bounces it back with `bounce` of its speed. Below a hair's breadth and a
 * crawl it is home, exactly, so a still board has nothing left to draw.
 */
export interface Body { dx: number; dy: number; vx: number; vy: number; held: boolean }
export interface Motion { gravity: number; drag: number; bounce: number; settle: number }
export const MOTION: Motion = { gravity: 1, drag: 1, bounce: 0.5, settle: 0.9 };
/** One step of the body, in short fixed steps so a slow frame can't make it jitter or fly off. Says whether it still moves. */
export function stepBody(b: Body, dt: number, m: Motion, home: { x: number; y: number }): boolean {
  if (b.held) return true;
  /* Settle time sets the spring (shorter is stiffer), gravity scales its pull, drag the damping. */
  const w = ((2 * Math.PI) / Math.max(0.15, m.settle * 1.6)) * Math.sqrt(Math.max(0.05, m.gravity));
  const zeta = Math.max(0.05, 0.55 * m.drag);
  const k = w * w, c = 2 * zeta * w;
  let left = Math.min(0.1, Math.max(0, dt));
  while (left > 1e-6) {
    const h = Math.min(1 / 240, left);
    left -= h;
    b.vx += (-k * b.dx - c * b.vx) * h; b.vy += (-k * b.dy - c * b.vy) * h;
    b.dx += b.vx * h; b.dy += b.vy * h;
    /* The board's edge: thrown past it, it comes back off it. */
    const x = home.x + b.dx, y = home.y + b.dy, m0 = 24;
    if (x < VIEW.x + m0) { b.dx = VIEW.x + m0 - home.x; b.vx = Math.abs(b.vx) * m.bounce; }
    else if (x > VIEW.x + VIEW.w - m0) { b.dx = VIEW.x + VIEW.w - m0 - home.x; b.vx = -Math.abs(b.vx) * m.bounce; }
    if (y < VIEW.y + m0) { b.dy = VIEW.y + m0 - home.y; b.vy = Math.abs(b.vy) * m.bounce; }
    else if (y > VIEW.y + VIEW.h - m0) { b.dy = VIEW.y + VIEW.h - m0 - home.y; b.vy = -Math.abs(b.vy) * m.bounce; }
  }
  if (Math.hypot(b.dx, b.dy) < 0.05 && Math.hypot(b.vx, b.vy) < 0.5) { b.dx = b.dy = b.vx = b.vy = 0; return false; }
  return true;
}

/**
 * The feed as a private screen draws it (privacy-rules.md, row 10): each
 * chat's name shortened to its badge, or "a chat". Questions keep their words
 * (never sensitive). Matching still uses the name as written.
 */
export function veilFeed(feed: LanesFeed, on: boolean, badge: (x: LaneChat) => string): LanesFeed {
  if (!on) return feed;
  return { ...feed, coordinators: feed.coordinators.map((c) => ({ ...c, chats: c.chats.map((x) => ({ ...x, realName: x.realName ?? x.name, name: badge(x) || "a chat" })) })) };
}

/* ------------------------------------------------------------ Orbs 2, round 2 (J, 2026-11-10 evening: pieces F to P) */

/** A live age, short (piece H, as the console has it): "42 s", "7 min", "3 h", "2 d". */
export function ageOf(at: string | number | null, now: number): string {
  const t = typeof at === "number" ? at : at ? Date.parse(at) : NaN;
  if (!Number.isFinite(t)) return "";
  const s = Math.max(0, Math.floor((now - t) / 1000));
  return s < 60 ? `${s} s` : s < 3600 ? `${Math.floor(s / 60)} min` : s < 86400 ? `${Math.floor(s / 3600)} h` : `${Math.floor(s / 86400)} d`;
}
/** Chats by latest word, newest first (piece H); a chat never heard from goes last, in feed order. */
export function byLatest(chats: LaneChat[]): LaneChat[] {
  return chats.map((x, i) => ({ x, i, t: seenAt(x) })).sort((a, b) => b.t - a.t || a.i - b.i).map((o) => o.x);
}

/**
 * The pie (piece H, the console's piece K): one equal slice per question of this round, red while open, green
 * once answered. This round is every open question and those answered in the last 12 hours. Past eight, the
 * oldest answered ones drop out first, then the slices are capped at eight and the last says how many more.
 */
export interface Slice { id: string; open: boolean; from: number; to: number; more: number }
export const PIE_MAX = 8;
export function pieOf(questions: Decision[], now: number): Slice[] {
  const recent = (d: Decision) => { const t = Date.parse(d.answeredAt); return Number.isFinite(t) && now - t < 12 * 3600_000; };
  let round = questions.filter((d) => isOpen(d) || recent(d));
  if (round.length > PIE_MAX) round = [...round.filter(isOpen), ...round.filter((d) => !isOpen(d))].slice(0, Math.max(PIE_MAX, round.filter(isOpen).length));
  const shown = round.slice(0, PIE_MAX), more = round.length - shown.length;
  return shown.map((d, i) => ({ id: d.id, open: isOpen(d), from: i / shown.length, to: (i + 1) / shown.length, more: i === shown.length - 1 ? more : 0 }));
}
/** A slice as an SVG path on a circle of radius r round 0,0, starting at the top, clockwise. A whole circle when it is the only one. */
export function slicePath(sl: Slice, r: number): string {
  if (sl.to - sl.from >= 0.9999) return `M0 ${-r}A${r} ${r} 0 1 1 0 ${r}A${r} ${r} 0 1 1 0 ${-r}Z`;
  const p = (u: number) => `${(r * Math.sin(u * 2 * Math.PI)).toFixed(2)} ${(-r * Math.cos(u * 2 * Math.PI)).toFixed(2)}`;
  return `M0 0L${p(sl.from)}A${r} ${r} 0 ${sl.to - sl.from > 0.5 ? 1 : 0} 1 ${p(sl.to)}Z`;
}

/**
 * The archive nucleus (piece M): one purple orb per retired coordinator, numbered in the order they retired
 * (their latest word), brightest the newest, darkest the oldest; their chats are inside, not drawn.
 */
export interface Retired { c: LaneCoordinator; n: number; at: number; light: number }
export function retiredOf(feed: LanesFeed | null): Retired[] {
  if (!feed) return [];
  const at = (c: LaneCoordinator) => Math.max(0, ...c.chats.map(seenAt));
  const list = feed.coordinators.filter((c) => c.retired).map((c, i) => ({ c, i, at: at(c) })).sort((a, b) => a.at - b.at || a.i - b.i);
  return list.map((o, k) => ({ c: o.c, n: k + 1, at: o.at, light: list.length > 1 ? 0.35 + 0.65 * (k / (list.length - 1)) : 1 }));
}
/** Where the k-th of n retired coordinators sits in the nucleus: a small tight cluster round the sun. */
export function nucleusAt(k: number, n: number, t: number): Seen {
  if (n === 1) return project(0, 0, 62, 0, (t * 6) % 360);
  const a = (k / n) * 2 * Math.PI + t * 0.12, r = 58 + 10 * (k % 2);
  return project(r * Math.cos(a), 10 * Math.sin(a * 2 + k), r * Math.sin(a), 0, 0);
}
/** A purple shade for a retired coordinator, lighter the newer. */
export const PURPLE_DARK: Rgb = [58, 24, 96], PURPLE_LIGHT: Rgb = [200, 140, 255];
export const purpleOf = (light: number): Rgb => mixRgb(PURPLE_DARK, PURPLE_LIGHT, Math.min(1, Math.max(0, light)));

/** The open questions about a chat (piece O): what its moons are. */
export function questionsOf(feed: LanesFeed, chatId: string): Decision[] {
  return feed.questions.filter((d) => isOpen(d) && chatsAbout(feed, d.about).some((x) => x.id === chatId));
}
/** A moon's place round its orb, in board units off the orb's centre: each on its own tilt and speed, never two together. */
export function moonAt(k: number, n: number, t: number, r: number): { x: number; y: number; front: boolean } {
  const a = t * (1.1 - 0.15 * (k % 3)) + (k / Math.max(1, n)) * 2 * Math.PI, lean = 0.35 + 0.2 * (k % 2);
  return { x: Math.cos(a) * r * 1.55, y: Math.sin(a) * r * 1.55 * lean, front: Math.sin(a) > 0 };
}
/** "asked by X, now with Y" (piece O): who first asked, and who has the question now. Empty when it never moved. */
export function carriedWords(d: Decision, now: string): string {
  return d.askedBy && plain(d.askedBy) !== plain(d.about) ? `asked by ${d.askedBy}, now with ${now || d.about}` : "";
}

/**
 * A chat that retired with a question still open (piece P) is a small sun, not a done orb. The two looks J
 * offered: "drift" goes out and away from the system as it ages (further each hour, up to the board's edge);
 * "nova" stays by its ring and, when its question is answered or carried, bursts in under a second.
 */
export type Leftover = "drift" | "nova";
export const NOVA_S = 0.8;
export function driftOut(hours: number): number { return Math.min(1, 1 - Math.exp(-hours / 18)); }
/** A burst, u from 0 to 1 over NOVA_S: a bright ring out to 3.5 orbs and fading. */
export const novaAt = (u: number) => ({ r: 1 + 2.5 * Math.sqrt(Math.min(1, Math.max(0, u))), alpha: Math.max(0, 1 - u) });
/** The done chats that still have a question open about them, unless it was carried to a live lane. */
export function leftovers(feed: LanesFeed | null): Set<string> {
  const out = new Set<string>();
  if (!feed) return out;
  for (const d of feed.questions) if (isOpen(d)) for (const x of chatsAbout(feed, d.about)) if (x.state === "done") out.add(x.id);
  return out;
}
