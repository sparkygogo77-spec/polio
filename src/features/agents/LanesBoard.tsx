"use client";
/**
 * THE LANES BOARD (J, 2026-11-01/03): every chat working for J, in the Agents
 * dock's first tab. One ring per coordinator, one orb per chat that is still
 * working, waiting or parked; the finished chats are one archive body in the
 * middle (Orbs 2, J 2026-11-10: "the archive orbs in the center become too
 * plentiful to manage"). A press on the archive fans out the latest dozen,
 * with search for the rest. `lanes.ts` says what the feed means and where
 * things sit; this keeps the moving state and draws one frame at a time.
 *
 * The tab is a column down the right of the Builder (decisions panel,
 * 2026-11-03): the coordinator's questions above the rings (`Decisions.tsx`),
 * the picked chat and every chat's note below. A question lights the orbs of
 * the chats it is about, an answer pulses them once, and a press on an orb
 * that asked opens its question.
 *
 * Orbs 2: a Tune drawer (`core/ui/tune`) sets the camera, the order on a
 * ring, sizes, the texture set, the light, speeds and the motion. An orb is
 * weighted: drag it and fling it, and a spring brings it home through drag,
 * bouncing off the board's edge, settling exactly. The board stays SVG, not
 * three.js: forty orbs and their rings must stay pressable, keyboard-reachable
 * and readable by the tests as elements, and a lit sphere is a clipped,
 * sliding texture under two gradients, which SVG draws cheaply. Frames are
 * drawn at the screen's rate, and only while something moves.
 *
 * Everything on the board is one flat, keyed list sorted by depth: every short
 * piece of every ring and every orb. So rings pass in front of and behind each
 * other and the orbs. Soft light is gradients and stacked strokes, never a
 * blur filter: a filter on something that moves repaints every frame on the CPU.
 */
import * as React from "react";
import { Sliders } from "lucide-react";
import { setDockTab } from "./store";
import { Decisions } from "./Decisions";
import { boardShown, useLive, usePrivate } from "./feed";
import { badgeOf } from "./privacy";
import { BOARD_TUNE, type BoardLook } from "./boardTune";
import { stripUrl, STRIP_H, STRIP_W } from "./orbArt";
import { TuneDrawer, useTune } from "@/core/ui/tune/TuneDrawer";
import {
  ANSWER_S, ARCHIVE_FAN, STATE_COLOUR, STATE_RGB, STATE_WORD, TUMBLE_S, VIEW, archiveOf, archiveSlot, axisOf, camera, chatLink, doneOf, doneShare, driftShare, fanAngle, hashOf, isArchived, lapAngle, lapPos, markOf, mixRgb, orbTarget,
  orderChats, project, radiusOf, restWobble, agoOf, chatsAbout, isOpen, rgbText, ringLine, ringPoint, ringSegments, ringState, ringTarget, searchArchive, startTilt, veilFeed, stepBody, thinkingShare, tumbleAt, tumbleSpeed,
  type Body, type Decision, type LaneChat, type LanesFeed, type Rgb, type Seen,
} from "./lanes";

/** J may drop the chat box's field and Send; the rest of the box stays. */
const CHAT_BOX_SEND = true;
const ORB_R = 24;
const ARCHIVE_R = 34;
const HOW_CONTROLS = "Steer, Pause and Stop go through the chat: the desktop app takes them there. Only the helper's own agents have them here, in the Helper tab.";
const PULSE_S = 1.2;
/** A press that moves less than this (board units) is a press, not a drag. */
const PRESS_SLOP = 5;

/* The moving state, kept by chat and by ring across polls. */
type Lap = { share: number; dock: number; state: LaneChat["state"]; sentAt: number | null; sent: number | null; answered: number | null; from: number };
type Ring = { tilt: number; r: number };
type Grab = { id: string; px: number; py: number; startX: number; startY: number; at: number; moved: number; trail: { t: number; x: number; y: number }[] };
type Sim = {
  t: number; tw: number; last: number; drawn: number; draws: number; moving: boolean; fan: number;
  rings: Map<string, Ring>; laps: Map<string, Lap>; cols: Map<string, Rgb>; bodies: Map<string, Body>; still: boolean;
};

/** One lap per message: out at 5% when it is sent, round to the back while the chat thinks, home when it answers, all one ease. */
function stepLap(sim: Sim, x: LaneChat, dt: number): Lap {
  let L = sim.laps.get(x.id);
  if (!L) {
    /* First seen: a chat already thinking is somewhere on its way round; the rest are home. */
    const tau = 4 + (hashOf(x.id) % 40) / 10;
    L = { share: x.state === "work" ? thinkingShare(tau) : 1, dock: x.state === "done" ? 1 : 0, state: x.state, sentAt: x.sentAt, sent: x.state === "work" ? sim.tw - tau : null, answered: null, from: 0 };
    sim.laps.set(x.id, L);
  }
  const startsThinking = x.state === "work" && L.state !== "work";
  const newMessage = x.sentAt !== null && x.sentAt !== L.sentAt;
  /* Laps run on the board's orbit clock: Tune's orbit speed at 0 holds them where they are. */
  if (startsThinking || newMessage) { L.sent = sim.tw; L.answered = null; L.share = 0; L.dock = 0; }
  else if (x.state !== "work" && L.state === "work" && L.sent !== null) { L.answered = sim.tw; L.from = L.share; }
  L.state = x.state; L.sentAt = x.sentAt;
  if (L.sent !== null) {
    const was = L.share;
    if (L.answered === null) L.share = Math.max(L.share, thinkingShare(sim.tw - L.sent));
    else {
      sim.moving = true;
      const u = Math.min(1, (sim.tw - L.answered) / ANSWER_S);
      L.share = L.from + (1 - L.from) * u * u * (3 - 2 * u);
      if (u >= 1) { L.share = 1; L.sent = null; L.answered = null; }
    }
    if (Math.abs(L.share - was) > 1e-5) sim.moving = true;
  }
  const home = x.state === "done" && L.share >= 1 ? 1 : 0;
  L.dock += (home - L.dock) * (1 - Math.exp(-dt * 2.5));
  if (Math.abs(home - L.dock) < 0.001) L.dock = home; else sim.moving = true;
  if (sim.still) { L.share = x.state === "work" ? 0.5 : 1; L.dock = x.state === "done" ? 1 : 0; }
  return L;
}

/** A colour that drifts towards where it is heading, never snapping. */
function drift(sim: Sim, key: string, target: Rgb, dt: number): Rgb {
  const was = sim.cols.get(key);
  const now = !was || sim.still ? target : mixRgb(was, target, driftShare(dt));
  if (was && Math.abs(now[0] - target[0]) + Math.abs(now[1] - target[1]) + Math.abs(now[2] - target[2]) > 1.5) sim.moving = true;
  sim.cols.set(key, now);
  return now;
}

type Item = { key: string; z: number; el: React.ReactNode };
const HALO = Object.keys(STATE_RGB) as (keyof typeof STATE_RGB)[];
const fmt = (n: number) => n.toFixed(1);

/** The draw count, for the tests' frame-rate check and a look in the console. */
const meter = { draws: 0, moving: false };
if (typeof window !== "undefined") (window as unknown as { __lanesBoard?: typeof meter }).__lanesBoard = meter;

export function LanesBoard() {
  const { feed: read, reached, base, readAt } = useLive((s) => s.lanes);
  /* Private (on by default): each chat is drawn by its badge, never its name. */
  const priv = usePrivate((s) => s.on);
  const feed = React.useMemo(() => (read ? veilFeed(read, priv, badgeOf) : null), [read, priv]);
  React.useEffect(() => boardShown(), []);
  const look = useTune(BOARD_TUNE) as unknown as BoardLook;
  camera.pitch = look.tilt; camera.yaw = look.axis;
  const motion = { gravity: look.gravity, drag: look.drag, bounce: look.bounce, settle: look.settle };
  const R0 = ORB_R * look.orb;
  const strip = React.useMemo(() => (typeof document === "undefined" ? null : stripUrl(look.texture)), [look.texture]);

  const simRef = React.useRef<Sim>({ t: 0, tw: 0, last: 0, drawn: 0, draws: 0, moving: true, fan: 0, rings: new Map(), laps: new Map(), cols: new Map(), bodies: new Map(), still: false });
  const spinStart = React.useRef(new Map<string, number>());
  const [, draw] = React.useReducer((n: number) => n + 1, 0);
  const [hover, setHover] = React.useState<string | null>(null);
  /* The chats a question or note under the pointer is about: lit, without moving the menu. */
  const [focus, setFocus] = React.useState<string[]>([]);
  const pulses = React.useRef(new Map<string, number>());
  const [picked, setPicked] = React.useState<string | null>(null);
  const [said, setSaid] = React.useState("");
  const [tuning, setTuning] = React.useState(false);
  const [fanned, setFanned] = React.useState(false);
  const [find, setFind] = React.useState("");
  const [lit, setLit] = React.useState<{ id: string; at: number } | null>(null);
  const boxAt = React.useRef<{ id: string; x: number; y: number } | null>(null);
  const box = React.useRef<HTMLDivElement>(null);
  const svg = React.useRef<SVGSVGElement>(null);
  const grab = React.useRef<Grab | null>(null);
  /* Where each orb sits before its body's pull, so a drag knows where home is. */
  const homes = React.useRef(new Map<string, Seen>());

  React.useEffect(() => {
    const sim = simRef.current;
    sim.still = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (sim.still) { draw(); return; }
    let raf = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = sim.last ? Math.min(0.1, (now - sim.last) / 1000) : 0;
      sim.last = now; sim.t += dt;
      /* Only while something moves (a ring turning, an orb on its way or thrown, a colour drifting): a still board costs nothing. */
      if (sim.moving || grab.current) draw();
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const sim = simRef.current;
  const dt = Math.min(0.1, Math.max(0, sim.t - sim.drawn));
  sim.drawn = sim.t;
  sim.tw += dt * look.orbit;
  sim.moving = false;
  meter.draws++;
  const t = sim.t, tw = sim.tw;

  const coords = feed?.coordinators ?? [];
  const pointer = hover ?? picked;
  const scene: Item[] = [], glows: React.ReactNode[] = [], rest: React.ReactNode[] = [];
  /* Where a press lands: one circle per orb above every ring piece, since an orb sits on its ring and a piece in front would take the press. */
  const hits: React.ReactNode[] = [];
  const docking: { chat: LaneChat; from: Seen; dock: number }[] = [];
  const speeds = new Map<string, number>();
  let hoverChat: { chat: LaneChat; x: number; y: number } | null = null;

  /* How many open questions each chat has, for the mark on its orb. */
  const asks = new Map<string, number>();
  if (feed) for (const d of feed.questions) if (isOpen(d)) for (const x of chatsAbout(feed, d.about)) asks.set(x.id, (asks.get(x.id) ?? 0) + 1);
  const archive = archiveOf(feed);
  const archivedAsks = archive.reduce((n, x) => n + (asks.get(x.id) ?? 0), 0);

  /* The archive fans out and folds back, eased. */
  const fanWant = fanned ? 1 : 0;
  sim.fan = sim.still ? fanWant : sim.fan + (fanWant - sim.fan) * (1 - Math.exp(-dt * 6));
  if (Math.abs(sim.fan - fanWant) < 0.002) sim.fan = fanWant; else sim.moving = true;

  /** An orb's surface: its colour, the texture turning with it, the key light, the rim and the shade. */
  const surface = (x: LaneChat, r: number, colour: string) => {
    const off = strip ? (((hashOf(x.id) * 7 + t * 22 * look.spin * (x.state === "park" ? 0.3 : 1)) % (2 * r)) + 2 * r) % (2 * r) : 0;
    if (strip && look.spin > 0 && !sim.still) sim.moving = true;
    return (
      <>
        <circle r={r} fill={colour} />
        {strip ? (
          <g clipPath={`url(#lanes-clip-${Math.round(r)})`} style={{ pointerEvents: "none" }}>
            <image data-lanes-texture={look.texture} href={strip} x={fmt(-r - off)} y={-r} width={4 * r} height={2 * r} preserveAspectRatio="none" />
          </g>
        ) : (
          <circle r={r * 0.62} cx={r * 0.18} cy={r * 0.26} fill="url(#lanes-refract)" style={{ pointerEvents: "none" }} />
        )}
        <circle r={r} fill="url(#lanes-shade)" style={{ pointerEvents: "none" }} />
        <circle r={r} fill="url(#lanes-sphere)" opacity={Math.min(1, look.key)} style={{ pointerEvents: "none" }} />
        {look.key > 1 ? <circle r={r * 0.22} cx={-r * 0.36} cy={-r * 0.42} fill="#ffffff" opacity={Math.min(1, look.key - 1) * 0.9} style={{ pointerEvents: "none" }} /> : null}
        <circle r={r - 1} fill="url(#lanes-rim)" opacity={Math.min(1, look.rim)} style={{ pointerEvents: "none" }} />
      </>
    );
  };

  /** A body pulled off its place by a drag or a throw, settling home. */
  const bodyOf = (id: string, home: Seen): Seen => {
    homes.current.set(id, home);
    const b = sim.bodies.get(id);
    if (!b) return home;
    const g = grab.current;
    if (g?.id === id) { b.dx = g.px - home.x; b.dy = g.py - home.y; }
    else if (sim.still) { b.dx = b.dy = b.vx = b.vy = 0; }
    else if (stepBody(b, dt, motion, home)) sim.moving = true;
    if (!b.held && b.dx === 0 && b.dy === 0) sim.bodies.delete(id);
    return { x: home.x + b.dx, y: home.y + b.dy, z: home.z };
  };

  const orb = (x: LaneChat, home: Seen, share: number, size = 1) => {
    const p = bodyOf(x.id, home);
    const eon = pointer === x.id || focus.includes(x.id);
    const asked = asks.get(x.id) ?? 0;
    const pulsedAt = pulses.current.get(x.id);
    const pu = pulsedAt === undefined ? -1 : (t - pulsedAt) / PULSE_S;
    if (pu >= 1) pulses.current.delete(x.id); else if (pu >= 0) sim.moving = true;
    /* -1 far, +1 near: the far side is smaller and dimmer, easing through so nothing pops. */
    const depth = Math.max(-1, Math.min(1, p.z / 40));
    const scale = (eon ? 1.3 : 0.91 + 0.09 * depth) * size;
    const colour = rgbText(drift(sim, x.id, orbTarget(x.state, tw, x.name.length), dt));
    if (hover === x.id) hoverChat = { chat: x, x: p.x, y: p.y };
    const held = sim.bodies.get(x.id);
    hits.push(
      <circle key={x.id} data-lanes-hit={x.id} cx={fmt(p.x)} cy={fmt(p.y)} r={(R0 * scale + 3).toFixed(1)} fill="transparent"
        style={{ cursor: grab.current?.id === x.id ? "grabbing" : "grab", touchAction: "none" }}
        onMouseEnter={() => setHover(x.id)} onPointerDown={(e) => startGrab(e, x.id)} />,
    );
    scene.push({
      key: x.id,
      z: p.z,
      el: (
        <g
          key={x.id}
          data-lanes-orb={x.id}
          data-state={x.state}
          data-target={STATE_COLOUR[x.state]}
          data-colour={colour}
          data-z={p.z.toFixed(2)}
          data-scale={scale.toFixed(3)}
          data-share={share.toFixed(3)}
          data-x={p.x.toFixed(1)}
          data-y={p.y.toFixed(1)}
          data-home-x={home.x.toFixed(1)}
          data-home-y={home.y.toFixed(1)}
          data-held={held ? (held.held ? "held" : "flung") : undefined}
          data-lanes-asks={asked || undefined}
          data-lanes-pulse={pu >= 0 && pu < 1 ? pu.toFixed(2) : undefined}
          role="button"
          tabIndex={0}
          aria-label={`${x.name}, ${STATE_WORD[x.state]}${asked ? `, ${asked} ${asked === 1 ? "question waits" : "questions wait"} on you: press to open it` : ""}`}
          transform={`translate(${fmt(p.x)} ${fmt(p.y)}) scale(${scale.toFixed(3)})`}
          opacity={(0.8 + 0.2 * depth).toFixed(2)}
          style={{ outline: "none", pointerEvents: "none" }}
          onFocus={() => setHover(x.id)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); press(x.id); } }}
        >
          <circle r={(eon ? 50 : 38) * look.orb} fill={`url(#lanes-halo-${x.state})`} opacity={Math.min(1, look.glow)} />
          {surface(x, R0, colour)}
          <circle r={R0} fill="none" stroke="#ffffff" strokeOpacity={eon ? 0.9 : 0.3} strokeWidth={eon ? 2 : 1} />
          <text y={6} textAnchor="middle" fill="#061018" style={{ font: "800 15px ui-monospace, Menlo, Consolas, monospace", pointerEvents: "none" }}>{markOf(x.name)}</text>
          {/* Answered just now: one ring going out from it. */}
          {pu >= 0 && pu < 1 ? <circle r={R0 + 46 * pu} fill="none" stroke="#ffffff" strokeOpacity={(1 - pu) * 0.9} strokeWidth={4 * (1 - pu) + 1} style={{ pointerEvents: "none" }} /> : null}
          {/* A question waits on J about it: the same count as on the Agents button. */}
          {asked ? (
            <g transform={`translate(${fmt(R0 * 0.8)} ${fmt(-R0 * 0.8)})`} style={{ pointerEvents: "none" }}>
              <circle r={11} fill="#ffffff" stroke={STATE_COLOUR.need} strokeWidth={3} />
              <text y={5} textAnchor="middle" fill="#7a0010" style={{ font: "800 14px ui-monospace, Menlo, Consolas, monospace" }}>{asked > 1 ? asked : "?"}</text>
            </g>
          ) : null}
        </g>
      ),
    });
  };

  coords.forEach((c, i) => {
    const state = ringState(c), key = c.id, done = doneShare(c);
    let ring = sim.rings.get(key);
    if (!ring) { ring = { tilt: sim.still ? 0 : startTilt(i), r: radiusOf(done, i) }; sim.rings.set(key, ring); }
    /* A ring grows outward as its chats finish, eased, never snapping. */
    const wantR = radiusOf(done, i);
    ring.r += (wantR - ring.r) * (sim.still ? 1 : 1 - Math.exp(-dt / 0.6));
    if (Math.abs(wantR - ring.r) > 0.05) sim.moving = true; else ring.r = wantR;
    /* It tumbles slowly end over end while its coordinator works; once all is done it settles flat on the nearest whole turn. */
    const speed = sim.still ? 0 : tumbleSpeed(done, i) * look.orbit;
    speeds.set(key, speed);
    if (speed > 0.01) { ring.tilt += speed * dt; sim.moving = true; }
    else {
      const flat = Math.round(ring.tilt / 360) * 360;
      ring.tilt += (flat - ring.tilt) * (sim.still ? 1 : driftShare(dt) * 0.75);
      if (Math.abs(flat - ring.tilt) > 0.01) sim.moving = true; else ring.tilt = flat;
    }
    const atRest = speed <= 0.01, wob = atRest && !sim.still && look.orbit > 0 ? restWobble(tw, i) : { tilt: 0, axis: 0, float: 0 };
    if (wob.tilt !== 0) sim.moving = true;

    /* A click's tumble: three whole turns, so at its end it is simply over. */
    const from = spinStart.current.get(key);
    let spin = 0;
    if (from !== undefined) {
      const u = (t - from) / TUMBLE_S;
      if (u >= 1) spinStart.current.delete(key); else { spin = tumbleAt(u); sim.moving = true; }
    }
    const tilt = ring.tilt + spin + wob.tilt, axis = axisOf(i) + wob.axis, R = ring.r;
    const colour = rgbText(drift(sim, key, ringTarget(state, look.orbit > 0 ? tw : 0, i), dt));
    const on = pointer === key;
    const segs = ringSegments(R, tilt, axis, wob.float);
    const line = ringLine(R, tilt, axis, wob.float);
    const w = look.ring;
    glows.push(
      <g key={key} style={{ pointerEvents: "none" }} opacity={Math.min(1, look.glow)}>
        <path d={line} fill="none" stroke={colour} strokeOpacity={0.1} strokeWidth={(on ? 36 : 28) * w} />
        <path d={line} fill="none" stroke={colour} strokeOpacity={0.16} strokeWidth={(on ? 22 : 17) * w} />
      </g>,
    );
    /* What the tests and the keyboard read: the ring as a whole. Its pieces are in the scene. */
    rest.push(
      <g
        key={key}
        data-lanes-ring={key}
        data-state={state}
        data-target={STATE_COLOUR[state]}
        data-colour={colour}
        data-r={R.toFixed(1)}
        data-tilt={(((ring.tilt % 360) + 540) % 360 - 180).toFixed(1)}
        data-speed={speed.toFixed(2)}
        data-spin={spin.toFixed(0)}
      />,
    );
    segs.forEach((s, k) => scene.push({
      key: `${key}:${k}`,
      z: s.z,
      el: (
        <g key={`${key}:${k}`} data-ring-seg={key} data-z={s.z.toFixed(2)} onMouseEnter={() => setHover(key)} onClick={() => tumble(key)} style={{ cursor: "pointer" }}>
          <path d={s.d} fill="none" stroke={colour} strokeOpacity={on ? 1 : 0.9} strokeWidth={(on ? 14 : 9) * w} strokeLinecap="round" />
          <path d={s.d} fill="none" stroke="transparent" strokeWidth={24} style={{ pointerEvents: "stroke" }} />
        </g>
      ),
    }));

    /* The chats still on the ring gather at the front, fanned out in the order Tune asks for; the done ones go to the archive. */
    const front = orderChats(c.chats.filter((x) => !isArchived(x) && (sim.laps.get(x.id)?.share ?? 1) >= 1), look.order);
    for (const x of c.chats) {
      const L = stepLap(sim, x, dt);
      const slot = front.indexOf(x);
      const a = L.share >= 1 ? lapAngle(1) + (slot < 0 ? 0 : fanAngle(slot, front.length, R)) : lapAngle(lapPos(L.share));
      const p = ringPoint(R, a, tilt, axis, wob.float);
      if (isArchived(x)) { if (L.dock < 1) docking.push({ chat: x, from: p, dock: L.dock }); }
      else orb(x, p, L.share);
    }
  });

  /* Finished just now: on its way in from its ring, shrinking into the archive. */
  docking.forEach(({ chat, from, dock }) => {
    const e = dock * dock * (3 - 2 * dock);
    orb(chat, { x: from.x * (1 - e), y: from.y * (1 - e), z: from.z * (1 - e) }, 1, 1 - 0.6 * e);
  });

  /* The archive: one body with a count; pressed, the latest dozen fan out round it. */
  const inArchive = archive.filter((x) => (sim.laps.get(x.id)?.dock ?? 1) >= 1);
  if (inArchive.length) {
    const fanOut = inArchive.slice(0, ARCHIVE_FAN);
    if (sim.fan > 0) fanOut.forEach((x, k) => {
      const to = archiveSlot(k, fanOut.length), e = sim.fan * sim.fan * (3 - 2 * sim.fan);
      orb(x, { x: to.x * e, y: to.y * e, z: to.z * e }, 1, 0.5 + 0.4 * e);
    });
    const centre = project(0, 0, 0, 0, 0), on = pointer === "archive";
    const ar = ARCHIVE_R * look.orb;
    scene.push({
      key: "archive",
      z: centre.z + 0.01,
      el: (
        <g key="archive" data-lanes-archive={inArchive.length} data-open={fanned ? "1" : "0"} role="button" tabIndex={0}
          aria-label={`${inArchive.length} finished ${inArchive.length === 1 ? "chat" : "chats"}: press to ${fanned ? "fold them back" : "fan out the latest"}`}
          aria-expanded={fanned}
          transform={`translate(${fmt(centre.x)} ${fmt(centre.y)}) scale(${on ? 1.12 : 1})`} style={{ outline: "none", pointerEvents: "none" }}
          onFocus={() => setHover("archive")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setFanned((f) => !f); } }}>
          <circle r={ar * 1.7} fill="url(#lanes-halo-done)" opacity={0.55 * Math.min(1, look.glow)} />
          {surface({ id: "archive", name: "archive", lane: "", state: "done", sentAt: null, lastSeen: "", history: [], helper: false }, ar, rgbText(mixRgb(STATE_RGB.done, [20, 40, 50], 0.55)))}
          <circle r={ar} fill="none" stroke={STATE_COLOUR.done} strokeOpacity={on ? 1 : 0.7} strokeWidth={2.5} />
          <text y={7} textAnchor="middle" fill="#ffffff" style={{ font: "800 20px ui-monospace, Menlo, Consolas, monospace", pointerEvents: "none" }}>{inArchive.length}</text>
          {archivedAsks ? (
            <g transform={`translate(${fmt(ar * 0.78)} ${fmt(-ar * 0.78)})`} style={{ pointerEvents: "none" }}>
              <circle r={11} fill="#ffffff" stroke={STATE_COLOUR.need} strokeWidth={3} />
              <text y={5} textAnchor="middle" fill="#7a0010" style={{ font: "800 14px ui-monospace, Menlo, Consolas, monospace" }}>{archivedAsks > 1 ? archivedAsks : "?"}</text>
            </g>
          ) : null}
        </g>
      ),
    });
  }

  if (inArchive.length) {
    /* The archive's press, under the orbs' own (a fanned orb at its edge wins) and over every ring piece. */
    const c0 = project(0, 0, 0, 0, 0);
    hits.unshift(<circle key="archive" data-lanes-hit="archive" cx={fmt(c0.x)} cy={fmt(c0.y)} r={fmt(ARCHIVE_R * look.orb)} fill="transparent" style={{ cursor: "pointer" }}
      onMouseEnter={() => setHover("archive")} onClick={() => setFanned((f) => !f)} />);
  }
  scene.sort((a, b) => a.z - b.z);
  meter.moving = sim.moving;

  /* An answer sent: the orbs of the chats it is about pulse once. */
  function answered(d: Decision) {
    if (!feed) return;
    for (const x of chatsAbout(feed, d.about)) pulses.current.set(x.id, sim.t);
  }

  function tumble(key: string) {
    setPicked(key);
    if (sim.still) return;
    if (!spinStart.current.has(key)) spinStart.current.set(key, sim.t);
  }

  /** A press on an orb: it is picked, and if a question waits on J about it, that question opens with its options. */
  function press(id: string) {
    setPicked(id);
    if (!feed) return;
    const q = feed.questions.find((d) => isOpen(d) && chatsAbout(feed, d.about).some((x) => x.id === id));
    if (q) setLit({ id: q.id, at: Date.now() });
  }

  /** Board units under a pointer. */
  const toBoard = (cx: number, cy: number) => {
    const m = svg.current?.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const p = new DOMPoint(cx, cy).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };
  function startGrab(e: React.PointerEvent, id: string) {
    if (e.button !== 0) return;
    const at = toBoard(e.clientX, e.clientY), home = homes.current.get(id) ?? { x: at.x, y: at.y, z: 0 };
    const was = sim.bodies.get(id);
    /* Caught mid-flight, it is held where the hand meets it; picked up still, it lifts from where it sits. */
    const ox = was ? home.x + was.dx - at.x : home.x - at.x, oy = was ? home.y + was.dy - at.y : home.y - at.y;
    sim.bodies.set(id, { dx: at.x + ox - home.x, dy: at.y + oy - home.y, vx: 0, vy: 0, held: true });
    grab.current = { id, px: at.x + ox, py: at.y + oy, startX: at.x, startY: at.y, at: performance.now(), moved: 0, trail: [{ t: performance.now(), x: at.x, y: at.y }] };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    const off = { x: ox, y: oy };
    const move = (ev: PointerEvent) => {
      const g = grab.current;
      if (!g) return;
      const q = toBoard(ev.clientX, ev.clientY);
      g.px = q.x + off.x; g.py = q.y + off.y;
      g.moved = Math.max(g.moved, Math.hypot(q.x - g.startX, q.y - g.startY));
      g.trail.push({ t: performance.now(), x: q.x, y: q.y });
      if (g.trail.length > 6) g.trail.shift();
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      const g = grab.current;
      grab.current = null;
      if (!g) return;
      const b = sim.bodies.get(g.id);
      if (g.moved < PRESS_SLOP) {
        if (b) { b.held = false; b.vx = b.vy = 0; }
        if (ev.type === "pointerup") press(g.id);
      } else if (b) {
        /* The throw: the hand's speed over its last few samples. */
        const first = g.trail[0]!, last = g.trail[g.trail.length - 1]!, span = Math.max(0.016, (last.t - first.t) / 1000);
        b.held = false; b.vx = Math.max(-4000, Math.min(4000, (last.x - first.x) / span)); b.vy = Math.max(-4000, Math.min(4000, (last.y - first.y) / span));
      }
      draw();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }

  const decisions = feed?.decisions ?? 0;
  /* The menu: what the pointer is on, else what was picked, else the first coordinator. */
  const chatOf = (id: string | null) => { for (const c of coords) for (const x of c.chats) if (x.id === id) return x; return null; };
  const pick = chatOf(pointer), coord = coords.find((c) => c.id === pointer) ?? (pick ? null : coords[0] ?? null);
  const menu = pick
    ? { name: pick.name, colour: rgbText(sim.cols.get(pick.id) ?? STATE_RGB[pick.state]), state: STATE_WORD[pick.state] + (pick.state === "done" ? " · in the archive" : ""), target: pick.id, helper: pick.helper }
    : coord
      ? { name: coord.name, colour: rgbText(sim.cols.get(coord.id) ?? STATE_RGB[ringState(coord)]), state: `coordinator · ${doneOf(coord)} of ${coord.chats.length} chats done · ${(speeds.get(coord.id) ?? 0) > 0.01 ? `tumbling, ${(speeds.get(coord.id) ?? 0).toFixed(1)}°/s` : "flat"}`, target: coord.id, helper: false }
      : { name: "Chats", colour: STATE_COLOUR.park, state: "", target: null as string | null, helper: false };

  /* The box stays where it opened: an orb on its way mustn't drag the field being typed in. */
  const hc = hoverChat as { chat: LaneChat; x: number; y: number } | null;
  if (!hc || grab.current) boxAt.current = null;
  else if (boxAt.current?.id !== hc.chat.id) boxAt.current = { id: hc.chat.id, x: hc.x, y: hc.y };
  const bx = boxAt.current ? ((boxAt.current.x - VIEW.x) / VIEW.w) * 100 : 0;
  /* Below an orb in the top half, above one in the bottom half: the board sits at the foot of the column, so a box below would be cut off. */
  const oy = boxAt.current ? ((boxAt.current.y - VIEW.y) / VIEW.h) * 100 : 0;
  const up = oy > 50;
  const by = oy + ((up ? -28 : 28) / VIEW.h) * 100;
  const clips = [...new Set([Math.round(R0), Math.round(ARCHIVE_R * look.orb)])];
  const found = fanned ? searchArchive(inArchive, find) : [];

  return (
    <div data-lanes-board="" className="absolute inset-0 z-10 flex flex-col overflow-y-auto overflow-x-hidden" style={{ background: "#020104", color: "#fff" }}>
      {feed ? <Decisions questions={feed.questions} chatsOf={(about) => chatsAbout(feed, about)} base={base} readAt={readAt} now={Date.now()} onFocus={setFocus} onAnswered={answered} lit={lit} /> : null}
      <div
        data-lanes-atom=""
        /* It stays in view at the foot of the column while the questions scroll above it, so a press's pulse is seen. */
        className="sticky bottom-0 z-10 shrink-0"
        style={{ background: "#020104" }}
        onMouseLeave={() => { if (!box.current?.contains(document.activeElement)) setHover(null); }}
      >
        {/* The rings by keyboard: one button each, named, the same hover and click. */}
        <div className="sr-only">
          {coords.map((c) => <button key={c.id} type="button" onFocus={() => setHover(c.id)} onClick={() => tumble(c.id)}>{c.name}</button>)}
        </div>
        <button type="button" data-lanes-tune-open="" aria-expanded={tuning} onClick={() => setTuning((x) => !x)} title="Tune the board: orientation, order, size, texture, light, speeds, motion"
          className="absolute right-2 top-2 z-20 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ color: "#021018", background: tuning ? "#fff" : "oklch(0.85 0.17 205)" }}>
          <Sliders className="size-3.5" /> Tune
        </button>
        <svg ref={svg} viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`} role="group" aria-label="Chats as orbs on their coordinator's ring; finished chats are one archive in the middle" style={{ display: "block", width: "100%", height: "auto", touchAction: "none" }}>
          <defs>
            {/* The key light, from the upper left. */}
            <radialGradient id="lanes-sphere" cx="0.33" cy="0.28" r="0.8">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" /><stop offset="0.16" stopColor="#ffffff" stopOpacity="0.6" /><stop offset="0.42" stopColor="#ffffff" stopOpacity="0.08" /><stop offset="1" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
            {/* The side away from the light, and the terminator. */}
            <radialGradient id="lanes-shade" cx="0.38" cy="0.32" r="0.78">
              <stop offset="0.45" stopColor="#000000" stopOpacity="0" /><stop offset="0.82" stopColor="#000000" stopOpacity="0.32" /><stop offset="1" stopColor="#000000" stopOpacity="0.7" />
            </radialGradient>
            {/* The rim: light from behind, catching the lower right edge. */}
            <radialGradient id="lanes-rim" cx="0.5" cy="0.5" r="0.5" fx="0.3" fy="0.25">
              <stop offset="0.8" stopColor="#bfefff" stopOpacity="0" /><stop offset="0.94" stopColor="#bfefff" stopOpacity="0.55" /><stop offset="1" stopColor="#ffffff" stopOpacity="0.9" />
            </radialGradient>
            {/* Glass: the light bent through it, pooled low on the far side. */}
            <radialGradient id="lanes-refract">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.4" /><stop offset="1" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
            {clips.map((r) => <clipPath key={r} id={`lanes-clip-${r}`}><circle r={r} /></clipPath>)}
            {HALO.map((s) => (
              <radialGradient key={s} id={`lanes-halo-${s}`}>
                <stop offset="0.55" stopColor={STATE_COLOUR[s]} stopOpacity="0.6" /><stop offset="1" stopColor={STATE_COLOUR[s]} stopOpacity="0" />
              </radialGradient>
            ))}
          </defs>
          {glows}
          {scene.map((it) => <React.Fragment key={it.key}>{it.el}</React.Fragment>)}
          {hits}
          {rest}
        </svg>
        {!feed ? (
          <p data-lanes-empty="" className="absolute inset-x-0 top-[62%] mx-auto max-w-sm text-center text-small" style={{ color: "#d8d0ee" }}>
            {reached ? "No chats yet: the helper has no lanes.json on this PC." : "The chats are listed on your PC, and the helper isn't answering. Start it from the Helper tab."}
          </p>
        ) : null}
        {hc && boxAt.current ? <ChatBox ref={box} key={hc.chat.id} chat={hc.chat} left={bx} top={by} up={up} said={said} onSaid={setSaid} /> : null}
      </div>
      <div className="flex flex-col gap-3 px-3 pb-4">
        {tuning ? <TuneDrawer schema={BOARD_TUNE} onClose={() => setTuning(false)} /> : null}
        {fanned && inArchive.length ? (
          <ArchiveList all={inArchive} found={found} find={find} onFind={setFind} onPick={(id) => { setPicked(id); setFocus([id]); }} now={Date.now()} />
        ) : null}
        <LanesMenu {...menu} decisions={decisions} />
        <ChatNotes coords={coords} now={Date.now()} onFocus={setFocus} onPick={setPicked} />
      </div>
    </div>
  );
}

/** The archive fanned out: the latest dozen are round the body; search reaches the rest. */
function ArchiveList({ all, found, find, onFind, onPick, now }: { all: LaneChat[]; found: LaneChat[]; find: string; onFind: (s: string) => void; onPick: (id: string) => void; now: number }) {
  const shown = found.slice(0, 50);
  return (
    <section data-lanes-archive-list={all.length} aria-label="Finished chats" className="flex flex-col gap-1.5 rounded-2xl p-3 text-[12px]" style={{ fontFamily: "ui-monospace, 'JetBrains Mono', Menlo, Consolas, monospace", background: "rgba(61,255,174,.06)", border: `1px solid ${STATE_COLOUR.done}55` }}>
      <h3 className="m-0 text-[13px] font-bold" style={{ color: STATE_COLOUR.done }}>{all.length} finished · the latest {Math.min(ARCHIVE_FAN, all.length)} are round the archive</h3>
      <input data-lanes-archive-search="" aria-label="Search the finished chats" placeholder={`Search ${all.length} finished chats`} value={find} onChange={(e) => onFind(e.target.value)}
        className="rounded-lg px-2.5 py-1.5" style={{ border: "1px solid rgba(255,255,255,.25)", background: "rgba(0,0,0,.35)", color: "#fff", font: "inherit" }} />
      <ul className="m-0 flex max-h-48 list-none flex-col gap-0.5 overflow-y-auto p-0">
        {shown.map((x) => (
          <li key={x.id}>
            <button type="button" data-lanes-archive-item={x.id} onClick={() => onPick(x.id)} className="flex w-full items-baseline gap-1.5 rounded-md px-2 py-1 text-left hover:bg-white/5">
              <b className="text-white">{x.name}</b>
              <span className="ml-auto shrink-0" style={{ color: "#9fb8c8" }}>{agoOf(x.lastSeen || x.sentAt, now)}</span>
            </button>
          </li>
        ))}
        {!shown.length ? <li data-lanes-archive-none="" style={{ color: "#9fb8c8" }}>No finished chat matches “{find}”.</li> : null}
      </ul>
    </section>
  );
}

/**
 * Under the board: each coordinator, and under it each chat's name, state and
 * when it was last heard from; the notes stay in the coordinator's messages. Hovering one lights its orb
 * (the menu stays put, so nothing moves under the pointer); a press picks it.
 */
function ChatNotes({ coords, now, onFocus, onPick }: { coords: LanesFeed["coordinators"]; now: number; onFocus: (ids: string[]) => void; onPick: (id: string) => void }) {
  if (!coords.length) return null;
  return (
    <section data-lanes-notes="" aria-label="What each chat is doing" className="flex flex-col gap-3" style={{ fontFamily: "ui-monospace, 'JetBrains Mono', Menlo, Consolas, monospace" }}>
      {coords.map((c) => (
        <div key={c.id}>
          <h3 className="m-0 text-[13px] font-bold" style={{ color: STATE_COLOUR[ringState(c)] }}>{c.name}</h3>
          <ul className="m-0 mt-1.5 flex list-none flex-col gap-1 p-0">
            {c.chats.map((x) => {
              const when = agoOf(x.lastSeen || x.sentAt, now);
              return (
                <li key={x.id} data-lanes-note={x.id} className="cursor-pointer rounded-lg px-2 py-1.5 text-[12px] leading-snug hover:bg-white/5"
                  onMouseEnter={() => onFocus([x.id])} onMouseLeave={() => onFocus([])} onClick={() => onPick(x.id)}>
                  <div className="flex items-baseline gap-1.5">
                    <span aria-hidden className="inline-block size-2 shrink-0 rounded-full" style={{ background: STATE_COLOUR[x.state] }} />
                    <b className="text-white">{x.name}</b>
                    <span style={{ color: STATE_COLOUR[x.state] }}>{STATE_WORD[x.state]}</span>
                    {when ? <span data-lanes-seen="" className="ml-auto shrink-0" style={{ color: "#9fb8c8" }}>{when}</span> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}

/** Rounded card, a lit border in the picked thing's colour, scanlines, pills (H3). */
function LanesMenu({ name, colour, state, target, helper, decisions }: { name: string; colour: string; state: string; target: string | null; helper: boolean; decisions: number }) {
  const link = target ? chatLink(target) : null;
  const pill = "inline-flex min-h-[38px] items-center rounded-full border-0 px-3.5 font-bold no-underline";
  const go = (word: string, cls: string, style: React.CSSProperties) => {
    const tell = { "data-lanes-control": word.toLowerCase() };
    /* The helper's own agent is controlled in the helper's own page; a desktop chat, in its chat. */
    if (helper) return <button key={word} {...tell} className={pill + cls} style={style} onClick={() => setDockTab("helper")}>{word}</button>;
    if (link) return <a key={word} {...tell} href={link} className={pill + cls} style={style}>{word}</a>;
    return <button key={word} {...tell} disabled className={pill + cls} style={{ ...style, opacity: 0.45 }}>{word}</button>;
  };
  return (
    <section
      data-lanes-menu={name}
      className="w-full"
      style={{
        boxSizing: "border-box", borderRadius: 24, padding: 18, border: `3px solid ${colour}`, fontFamily: "ui-monospace, 'JetBrains Mono', Menlo, Consolas, monospace",
        backgroundColor: "oklch(0.13 0.05 300)", backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 3px), radial-gradient(circle at 85% 0%, oklch(0.42 0.2 320 / 0.6), transparent 60%)",
      }}
    >
      <h2 data-lanes-menu-name="" style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#fff" }}>{name}</h2>
      <p style={{ margin: "4px 0 0", color: colour, fontSize: 13, fontWeight: 700 }}>{state}</p>
      <div className="mt-4 flex flex-wrap gap-1.5 text-[13px]">
        {go("Steer", "", { color: "#021018", background: "oklch(0.85 0.17 205)" })}
        {go("Pause", "", { color: "#1a1204", background: "oklch(0.87 0.17 85)" })}
        {go("Stop", "", { color: "#fff", background: "oklch(0.55 0.23 27)" })}
        {go("Open chat", " font-normal", { color: "#fff", background: "transparent", border: "1px solid rgba(255,255,255,0.6)" })}
      </div>
      <p data-lanes-decisions={decisions} style={{ margin: "14px 0 0", fontSize: 13, fontWeight: 700, color: decisions ? STATE_COLOUR.need : STATE_COLOUR.done }}>{decisions ? `${decisions} ${decisions === 1 ? "decision waits" : "decisions wait"} on you` : "Nothing waits on you"}</p>
      <p data-lanes-how="" style={{ margin: "16px 0 0", fontSize: 12, lineHeight: 1.55, color: "#9fb8c8" }}>{HOW_CONTROLS}</p>
    </section>
  );
}

/**
 * Hovering a chat. Nothing on this page can reach a desktop chat, so Send is
 * honest about what it does: it copies the words and opens the chat to paste
 * them. The orb's lap starts when the chat really gets them (its heartbeat).
 */
const ChatBox = React.forwardRef<HTMLDivElement, { chat: LaneChat; left: number; top: number; up: boolean; said: string; onSaid: (s: string) => void }>(function ChatBox({ chat, left, top, up, said, onSaid }, ref) {
  const [text, setText] = React.useState("");
  const colour = STATE_COLOUR[chat.state];
  const link = chatLink(chat.id);
  const seen = agoOf(chat.lastSeen || chat.sentAt, Date.now());
  const send = async () => {
    const words = text.trim();
    if (!words) return;
    if (chat.helper) { setDockTab("helper"); return; }
    let copied = true;
    try { await navigator.clipboard.writeText(words); } catch { copied = false; }
    onSaid(copied ? "Copied. Paste it in the chat that just opened." : "Couldn't copy it: the chat opened, type it there.");
    if (link) window.location.href = link;
    setText("");
  };
  return (
    <div
      ref={ref}
      data-lanes-box={chat.id}
      className="absolute w-[250px]"
      style={{ left: `clamp(125px, ${left}%, calc(100% - 125px))`, top: `${top}%`, transform: up ? "translate(-50%, calc(-100% - 12px))" : "translate(-50%, 12px)", boxSizing: "border-box", borderRadius: 18, padding: "12px 14px", border: `2px solid ${colour}`, background: "oklch(0.16 0.05 300 / 0.96)", color: "#f2ecff", font: "13px/1.45 ui-monospace, 'JetBrains Mono', Menlo, Consolas, monospace", boxShadow: "0 10px 30px rgba(0,0,0,.6)" }}
    >
      <div style={{ fontWeight: 700, color: colour }}>{chat.name} · {STATE_WORD[chat.state]}</div>
      {seen ? <div data-lanes-box-seen="" style={{ marginTop: 4, fontSize: 12, color: "#9fb8c8" }}>last heard from {seen}</div> : null}
      {CHAT_BOX_SEND ? (
        <form onSubmit={(e) => { e.preventDefault(); void send(); }}>
          <input data-lanes-say="" aria-label={`Say something to ${chat.name}`} placeholder={`Say something to ${chat.name}`} value={text} onChange={(e) => setText(e.target.value)} style={{ width: "100%", boxSizing: "border-box", marginTop: 8, padding: "8px 10px", borderRadius: 10, border: "1px solid rgba(255,255,255,.25)", background: "rgba(0,0,0,.35)", color: "#fff", font: "inherit" }} />
          <button data-lanes-send="" type="submit" style={{ marginTop: 8, font: "inherit", fontWeight: 700, minHeight: 32, padding: "0 12px", color: "#021018", background: "oklch(0.85 0.17 205)", border: 0, borderRadius: 999 }}>Send</button>
          {said ? <div data-lanes-said="" style={{ marginTop: 6, fontSize: 12, color: "#9fb8c8" }}>{said}</div> : null}
        </form>
      ) : null}
    </div>
  );
});
