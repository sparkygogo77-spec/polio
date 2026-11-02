/**
 * THE LANES BOARD, THE PURE PART (J, 2026-11-01/02): what the feed means and
 * where everything sits. One nucleus, one ring per coordinator, one orb per
 * chat. No React and no imports, so tests/lanes-board.mjs imports it straight.
 *
 * The geometry is the prototype's (Gyro3; `ATOMS` holds its iterations): a ring is a circle in
 * its own plane, (u, v), v > 0 being the half nearest the viewer. It tilts about
 * the horizontal axis, turns on a yaw so rings fan apart, and is seen from a
 * little above. Whatever comes out with depth above zero is in front of the
 * nucleus. One change from the prototype: the camera sinks as a ring stands up,
 * so a standing ring's front is still the near side where chats gather.
 */

export type ChatState = "need" | "work" | "done" | "park";

export interface LaneChat {
  id: string;
  name: string;
  state: ChatState;
  note: string;
  last: string;
  /** When its last message was sent; a new value starts a new lap. */
  sentAt: number | null;
  /** The helper's own agent: its controls are in the helper's tab, not in a chat. */
  helper: boolean;
}
export interface LaneCoordinator { id: string; name: string; note: string; chats: LaneChat[] }
export interface LanesFeed { coordinators: LaneCoordinator[]; decisions: number }
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
      chats.push({ id: x.id, name: words(x.name) || x.id, state: x.state as ChatState, note: words(x.note), last: words(x.last), sentAt: typeof x.sentAt === "number" ? x.sentAt : null, helper: x.helper === true });
    }
    coordinators.push({ id: c.id, name: words(c.name) || c.id, note: words(c.note), chats });
  }
  const need = coordinators.reduce((n, c) => n + c.chats.filter((x) => x.state === "need").length, 0);
  return { coordinators, decisions: typeof r.decisions === "number" ? r.decisions : need };
}

const plain = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * A chat that called a tool in the last two minutes is working, whatever the
 * feed last said, except one that needs J: it still does, and red is the
 * colour that must not hide. A beat knows its chat by the session or the lane
 * name; a chat with no beat keeps the feed's word (a cloud chat never has one).
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
      chats: c.chats.map((x) => (x.state !== "need" && (sessions.has(x.id) || names.has(plain(x.name))) ? { ...x, state: "work" as const } : x)),
    })),
  };
}

/** A ring wears its most urgent chat's colour. */
export function ringState(c: LaneCoordinator): ChatState {
  for (const s of ["need", "work", "done"] as const) if (c.chats.some((x) => x.state === s)) return s;
  return "park";
}
export const doneOf = (c: LaneCoordinator) => c.chats.filter((x) => x.state === "done").length;
/** Degrees from flat: 85 when its coordinator starts, 0 when every chat on it is done. */
export const wantTilt = (c: LaneCoordinator) => (c.chats.length ? 85 * (1 - doneOf(c) / c.chats.length) : 85);

/** The desktop app's link to a chat. Only an id goes in it, so a feed can't make it point anywhere else. */
export function chatLink(id: string): string | null {
  return /^[A-Za-z0-9_-]{8,80}$/.test(id) ? `claude://claude.ai/epitaxy/${id}` : null;
}
export const markOf = (name: string) => {
  const w = name.trim().split(/\s+/).filter(Boolean);
  return (w.length > 1 ? `${w[0]?.[0]}${w[1]?.[0]}` : name.slice(0, 2)).toUpperCase();
};

/* ------------------------------------------------------------ geometry */

export const VIEW = { x: -430, y: -330, w: 860, h: 660 };
const rad = (d: number) => (d * Math.PI) / 180;

/** The prototype's three iterations. J hasn't picked; A1 is the default. */
export interface Atom { radius: "grow" | "fixed" | "nest"; yaw: number; tumbles: number; disc: boolean }
export const ATOMS = {
  /** A new ring is small around the nucleus; as its chats finish it grows outward and lies flat, so a done ring is the outside one. */
  A1: { radius: "grow", yaw: 35, tumbles: 3, disc: true },
  /** All rings the same size, fanned wide; a plain sphere in the middle. */
  A2: { radius: "fixed", yaw: 55, tumbles: 2, disc: false },
  /** Nested by age, newest inside, almost in line. */
  A3: { radius: "nest", yaw: 18, tumbles: 3, disc: true },
} as const satisfies Record<string, Atom>;

export function radiusAt(tilt: number, atom: Atom = ATOMS.A1, ring = 0): number {
  if (atom.radius === "fixed") return 290;
  if (atom.radius === "nest") return 300 - ring * 70;
  return 150 + 150 * (1 - Math.min(85, tilt) / 85);
}
/** Rings fan apart left to right, each on its own yaw. */
export const yawOf = (i: number, n: number, atom: Atom = ATOMS.A1) => (n < 2 ? 0 : -atom.yaw + i * Math.min(atom.yaw, (2 * atom.yaw) / (n - 1)));
/** How far above the camera sits: 22° over a flat ring, nearly level with a standing one. */
export const pitchAt = (tilt: number) => 2 + 20 * (1 - Math.min(85, tilt) / 85);

export interface Seen { x: number; y: number; z: number }
/** A point of a ring's plane, as the screen shows it; z is depth, above zero towards the viewer. `spin` is the tumble, on top of the tilt. */
export function project(u: number, v: number, tilt: number, yaw: number, spin = 0): Seen {
  const th = rad(tilt + spin), ps = rad(yaw), phi = rad(pitchAt(tilt));
  const y1 = -v * Math.sin(th), z1 = v * Math.cos(th);
  const x2 = u * Math.cos(ps) + z1 * Math.sin(ps), z2 = -u * Math.sin(ps) + z1 * Math.cos(ps);
  return { x: x2, y: -(y1 * Math.cos(phi) - z2 * Math.sin(phi)), z: y1 * Math.sin(phi) + z2 * Math.cos(phi) };
}
/** A lap's place on the ring: 0 and 1 are the front, 0.5 the back. */
export const lapAngle = (pos: number) => Math.PI / 2 + pos * 2 * Math.PI;

const STEPS = 96;
/** The ring cut where it crosses the nucleus's plane: what passes in front of the nucleus, and what passes behind. */
export function ringArcs(r: number, tilt: number, yaw: number, spin = 0): { front: string; back: string } {
  const pts: Seen[] = [];
  for (let k = 0; k <= STEPS; k++) { const a = (k / STEPS) * 2 * Math.PI; pts.push(project(r * Math.cos(a), r * Math.sin(a), tilt, yaw, spin % 360)); }
  let front = "", back = "";
  let run: Seen[] = [], near = (pts[0] as Seen).z >= 0;
  const flush = () => { const d = `M${run.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join("L")}`; if (near) front += d; else back += d; };
  for (const p of pts) {
    if (p.z >= 0 !== near && run.length) { run.push(p); flush(); run = []; near = !near; }
    run.push(p);
  }
  if (run.length > 1) flush();
  return { front: front || "M0 0", back: back || "M0 0" };
}

const HEX_STEP = 96;
/**
 * The done chats' places, on their ring's plane around the nucleus: a loose
 * hexagonal grid, nearest cells first, the centre left to the nucleus. Rows run
 * left to right on the screen whatever the ring's yaw, which is what keeps orbs
 * apart when a flat ring squeezes depth; each is nudged a little, always the same
 * way, so it doesn't read as printed.
 */
export function hexCells(n: number, yaw = 0): { u: number; v: number }[] {
  const cells: { u: number; v: number; d: number }[] = [];
  for (let reach = 5; cells.length < n; reach += 3) {
    cells.length = 0;
    for (let q = -reach; q <= reach; q++) for (let r = -reach; r <= reach; r++) {
      if (q === 0 && r === 0) continue;
      const u = HEX_STEP * (q + r / 2), v = HEX_STEP * ((r * Math.sqrt(3)) / 2);
      cells.push({ u, v, d: Math.hypot(u, v) });
    }
  }
  cells.sort((a, b) => a.d - b.d || Math.atan2(a.v, a.u) - Math.atan2(b.v, b.u));
  const c = Math.cos(rad(yaw)), s = Math.sin(rad(yaw));
  return cells.slice(0, n).map((p, i) => {
    const u = p.u + 4 * Math.sin(i * 2.399), v = p.v - 4 * Math.cos(i * 2.399);
    return { u: u * c - v * s, v: u * s + v * c };
  });
}

/** Chats that wait fan out round the front, a little over an orb apart, each ring's fan on its own stretch so rings don't pile up. */
export function fanAngle(slot: number, count: number, r: number, ring: number, rings: number): number {
  return ((slot - (count - 1) / 2) * 56) / r + (ring - (rings - 1) / 2) * 0.9;
}

/* ------------------------------------------------------------ motion */

/** Where a lap is heading: out to 5% at once, slowing round the back while the chat thinks. It holds on the back until the answer. */
export const thinkingPos = (tau: number) => 0.05 + 0.67 * (1 - Math.exp(-tau / 4));
/** How long the last stretch to the front takes once the answer is in. */
export const ANSWER_S = 0.8;

export const TUMBLE_S = 2.6;
/** Whole turns over the nucleus, fast, then easing out; at 1 it is whole turns, so the ring lands where it left. */
export const tumbleAt = (u: number, atom: Atom = ATOMS.A1) => 360 * atom.tumbles * (1 - Math.pow(1 - Math.min(1, Math.max(0, u)), 4));

/** A small steady number from a name, so a staggered start is the same every load. */
export const hashOf = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 9973; return h; };
