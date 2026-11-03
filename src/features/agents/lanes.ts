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
  /** The helper's own agent: its controls are in the helper's tab, not in a chat. */
  helper: boolean;
}
/** Names and states only: the helper keeps notes off the Builder's page (`helper/server/lanes.ts`). */
export interface LaneCoordinator { id: string; name: string; chats: LaneChat[] }
/** One of the coordinator's questions for J, with its options (decisions panel, 2026-11-03). */
export interface DecisionOption { key: string; label: string; desc: string; picture: string; pick: boolean }
export interface Decision { id: string; order: number; about: string; question: string; why: string; options: DecisionOption[]; answer: string; answeredAt: string }
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
      chats.push({ id: x.id, name: words(x.name) || x.id, lane: words(x.lane), state: x.state as ChatState, sentAt: typeof x.sentAt === "number" ? x.sentAt : null, lastSeen: words(x.lastSeen), helper: x.helper === true });
    }
    coordinators.push({ id: c.id, name: words(c.name) || c.id, chats });
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
    out.push({ id: d.id, order: typeof d.order === "number" ? d.order : 1e9, about: words(d.about), question: d.question, why: words(d.why), options, answer: words(d.answer), answeredAt: words(d.answeredAt) });
  }
  return out.map((d, i) => ({ d, i })).sort((a, b) => a.d.order - b.d.order || a.i - b.i).map((x) => x.d);
}

export const isOpen = (d: Decision) => !d.answer.trim();

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
  return feed.coordinators.flatMap((c) => c.chats).filter((x) => x.id === about || plain(x.lane) === a || plain(x.name) === a);
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
  const w = name.trim().split(/\s+/).filter(Boolean);
  return (w.length > 1 ? `${w[0]?.[0]}${w[1]?.[0]}` : name.slice(0, 2)).toUpperCase();
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
export interface Seen { x: number; y: number; z: number }
/** A point (x right, y up, z towards the viewer) turned by `tilt` about the horizontal axis and `axis` about the upright one, as the screen shows it; z above zero is nearer. */
export function project(x: number, y: number, z: number, tilt: number, axis: number): Seen {
  const th = rad(tilt), ps = rad(axis), phi = rad(PITCH);
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

export const SEGMENTS = 48;
/** A point of a ring, at angle `a` round it. */
export const ringPoint = (r: number, a: number, tilt: number, axis: number, float = 0) => project(r * Math.cos(a), float, r * Math.sin(a), tilt, axis);
/** The ring cut into short pieces, each with its own depth, to sort with everything else: rings pass in front of and behind each other and the orbs. */
export function ringSegments(r: number, tilt: number, axis: number, float = 0): { d: string; z: number }[] {
  const pts: Seen[] = [];
  for (let k = 0; k <= SEGMENTS; k++) pts.push(ringPoint(r, (k / SEGMENTS) * 2 * Math.PI, tilt, axis, float));
  const at = (p: Seen) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  return pts.slice(0, SEGMENTS).map((p, k) => { const q = pts[k + 1] as Seen; return { d: `M${at(p)}L${at(q)}`, z: (p.z + q.z) / 2 }; });
}
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
