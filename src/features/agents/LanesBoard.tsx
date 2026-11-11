"use client";
/**
 * THE LANES BOARD (J, 2026-11-01/03; Orbs 2, 2026-11-10): every chat working for J, in the Agents dock's first
 * tab. A bright sun in the middle (piece L); one smooth, lit ring per live coordinator round it (K), with an orb
 * per chat still working, waiting or parked, and a small bead per chat it has finished. Retired coordinators are
 * one numbered purple orb each in a nucleus by the sun, brightest the newest (M); the nucleus is a toggle, and a
 * press on one brings it back as a purple ring with its chats, until J puts it away. Each open question is a
 * bright moon round the orb that asked (O); a chat that retired with a question still open is a small sun that
 * drifts away, or bursts in a supernova once answered (P, J picks in Tune).
 *
 * Above the board, the chat panel (N): hovering an orb snaps it to that chat, the hover ending puts it back, a
 * press pins it; it folds to one line or is dragged taller (J). Dragging the empty board turns it (J); Tune keeps
 * the turn. The questions live in the panel above (`Decisions.tsx`); the chat panel and the list under the board
 * only count them and jump there (I: nothing shown twice).
 *
 * An orb is weighted: drag it and fling it, a spring brings it home through drag, bouncing off the board's edge,
 * settling exactly. Each orb, moon, nucleus orb and the sun is pressed through a hit layer above every ring piece
 * (an orb sits on its ring, and a piece in front would take the press). The board stays SVG, not three.js: forty
 * orbs and their rings must stay pressable, keyboard-reachable and readable by the tests as elements, and a lit
 * sphere is a clipped, sliding texture under two gradients, which SVG draws cheaply. Frames are drawn at the
 * screen's rate, and only while something moves. Soft light is gradients and stacked strokes, never a blur
 * filter: a filter on something that moves repaints every frame on the CPU.
 */
import * as React from "react";
import { Archive, ChevronDown, ChevronUp, Sliders } from "lucide-react";
import { openQuestion, setDockTab, useAgents } from "./store";
import { Decisions } from "./Decisions";
import { boardShown, readLanes, useLive, usePrivate } from "./feed";
import { badgeOf, scrub } from "./privacy";
import { BOARD_TUNE, type BoardLook } from "./boardTune";
import { stripUrl } from "./orbArt";
import { TuneDrawer, setTune, useTune } from "@/core/ui/tune/TuneDrawer";
import {
  ANSWER_S, NOVA_S, STATE_COLOUR, STATE_RGB, STATE_WORD, TUMBLE_S, VIEW, ageOf, archiveOf, axisOf, byLatest, camera, chatLink, chatsAbout, doneOf, doneShare, driftOut, driftShare, fanAngle,
  hashOf, isArchived, lapAngle, lapPos, leftovers, markOf, mixRgb, moonAt, novaAt, nucleusAt, orbTarget, orderChats, project, purpleOf, questionsOf, radiusOf, restWobble, retiredOf, rgbText,
  ringLine, ringPoint, ringSegments, ringState, ringTarget, searchArchive, startTilt, stepBody, thinkingShare, tumbleAt, tumbleSpeed, veilFeed, whenOf,
  type Body, type Decision, type LaneChat, type LaneCoordinator, type LanesFeed, type Rgb, type Seen,
} from "./lanes";

/** J may drop the chat panel's field and Send; the rest of the panel stays. */
const CHAT_BOX_SEND = true;
const ORB_R = 24;
const BEAD_R = 6;
const SUN_R = 30;
const NUCLEUS_R = 15;
const HOW_CONTROLS = "Steer, Pause and Stop go through the chat: the desktop app takes them there. Only the helper's own agents have them here, in the Helper tab.";
const PULSE_S = 1.2;
/** A press that moves less than this (board units) is a press, not a drag. */
const PRESS_SLOP = 5;
const ARCHIVE_KEY = "polio.lanes.archive";
const REVIVED_KEY = "polio.lanes.revived";
const PANEL_KEY = "polio.lanes.panel";
const PURPLE = "#b07cff";
const mono = "ui-monospace, 'JetBrains Mono', Menlo, Consolas, monospace";

const kept = <T,>(key: string, read: (s: string | null) => T): T => { try { return read(localStorage.getItem(key)); } catch { return read(null); } };
const keep = (key: string, v: string) => { try { localStorage.setItem(key, v); } catch { /* not kept, still live */ } };

/* The moving state, kept by chat and by ring across polls. */
type Lap = { share: number; dock: number; state: LaneChat["state"]; sentAt: number | null; sent: number | null; answered: number | null; from: number };
type Ring = { tilt: number; r: number };
type Grab = { id: string; px: number; py: number; startX: number; startY: number; at: number; moved: number; trail: { t: number; x: number; y: number }[] };
type Turn = { x: number; y: number; yaw: number; pitch: number };
type Sim = {
  t: number; tw: number; last: number; drawn: number; moving: boolean;
  rings: Map<string, Ring>; laps: Map<string, Lap>; cols: Map<string, Rgb>; bodies: Map<string, Body>; still: boolean;
  /** Where each leftover sun was last drawn, and the bursts of those just answered (piece P). */
  left: Map<string, Seen>; novas: Map<string, { p: Seen; at: number; mode: "drift" | "nova" }>;
};

/** One lap per message: out at 5% when it is sent, round to the back while the chat thinks, home when it answers, all one ease. Laps run on the board's orbit clock. */
function stepLap(sim: Sim, x: LaneChat, dt: number): Lap {
  let L = sim.laps.get(x.id);
  if (!L) {
    const tau = 4 + (hashOf(x.id) % 40) / 10;
    L = { share: x.state === "work" ? thinkingShare(tau) : 1, dock: x.state === "done" ? 1 : 0, state: x.state, sentAt: x.sentAt, sent: x.state === "work" ? sim.tw - tau : null, answered: null, from: 0 };
    sim.laps.set(x.id, L);
  }
  const startsThinking = x.state === "work" && L.state !== "work";
  const newMessage = x.sentAt !== null && x.sentAt !== L.sentAt;
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
const shade = (c: Rgb, z: number, R: number): string => rgbText(mixRgb(mixRgb(c, [0, 0, 0], 0.35), mixRgb(c, [255, 255, 255], 0.25), (Math.max(-1, Math.min(1, z / Math.max(60, R))) + 1) / 2));

/** The draw count, for the tests' frame-rate check and a look in the console. */
const meter = { draws: 0, moving: false };
if (typeof window !== "undefined") (window as unknown as { __lanesBoard?: typeof meter }).__lanesBoard = meter;

/** "now", ticking once a second while it shows, for the live ages (piece H). */
function useNow(ms = 1000): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

export function LanesBoard() {
  const { feed: read, reached, base, readAt } = useLive((s) => s.lanes);
  React.useEffect(() => boardShown(), []);
  /* Private (on by default): each chat is drawn by its badge, never its name. */
  const priv = usePrivate((s) => s.on);
  const feed = React.useMemo(() => (read ? veilFeed(read, priv, badgeOf) : null), [read, priv]);
  const look = useTune(BOARD_TUNE) as unknown as BoardLook;
  const turn = React.useRef<Turn | null>(null);
  camera.pitch = turn.current?.pitch ?? look.tilt; camera.yaw = turn.current?.yaw ?? look.axis;
  const motion = { gravity: look.gravity, drag: look.drag, bounce: look.bounce, settle: look.settle };
  const R0 = ORB_R * look.orb;
  const strip = React.useMemo(() => (typeof document === "undefined" ? null : stripUrl(look.texture)), [look.texture]);
  const lit = useAgents((s) => s.lit);
  const now = useNow();

  const simRef = React.useRef<Sim>({ t: 0, tw: 0, last: 0, drawn: 0, moving: true, rings: new Map(), laps: new Map(), cols: new Map(), bodies: new Map(), still: false, left: new Map(), novas: new Map() });
  const spinStart = React.useRef(new Map<string, number>());
  const [, draw] = React.useReducer((n: number) => n + 1, 0);
  const [hover, setHover] = React.useState<string | null>(null);
  /* The chats a question or note under the pointer is about: lit, without moving the panel. */
  const [focus, setFocus] = React.useState<string[]>([]);
  const pulses = React.useRef(new Map<string, number>());
  const [picked, setPicked] = React.useState<string | null>(null);
  const [said, setSaid] = React.useState("");
  const [tuning, setTuning] = React.useState(false);
  const [archiveOn, setArchiveOn] = React.useState(() => kept(ARCHIVE_KEY, (s) => s !== "off"));
  const [revived, setRevived] = React.useState<Set<string>>(() => kept(REVIVED_KEY, (s) => { try { const v = JSON.parse(s ?? "[]"); return new Set(Array.isArray(v) ? v : []); } catch { return new Set(); } }));
  const svg = React.useRef<SVGSVGElement>(null);
  const grab = React.useRef<Grab | null>(null);
  /* Where each orb sits before its body's pull, so a drag knows where home is. */
  const homes = React.useRef(new Map<string, Seen>());

  React.useEffect(() => {
    const sim = simRef.current;
    sim.still = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      const dt = sim.last ? Math.min(0.1, (t - sim.last) / 1000) : 0;
      sim.last = t; sim.t += dt;
      /* Only while something moves (a ring turning, an orb on its way or thrown, a colour drifting, a burst): a still board costs nothing. */
      if (sim.moving || grab.current || turn.current) draw();
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const sim = simRef.current;
  const dt = Math.min(0.1, Math.max(0, sim.t - sim.drawn));
  sim.drawn = sim.t;
  if (!sim.still) sim.tw += dt * look.orbit;
  sim.moving = false;
  meter.draws++;
  const t = sim.t, tw = sim.tw;

  const coords = feed?.coordinators ?? [];
  const retired = retiredOf(feed);
  const liveRings = coords.filter((c) => !c.retired);
  const shownRings: { c: LaneCoordinator; purple: boolean }[] = [...liveRings.map((c) => ({ c, purple: false })), ...retired.filter((r) => revived.has(r.c.id)).map((r) => ({ c: r.c, purple: true }))];
  const pointer = hover ?? picked;
  const scene: Item[] = [], glows: React.ReactNode[] = [], rest: React.ReactNode[] = [];
  /* Where a press lands, above every ring piece: nucleus and sun first, orbs over them, moons on top. */
  const hits: React.ReactNode[] = [], moonHits: React.ReactNode[] = [];
  const speeds = new Map<string, number>();
  const left = leftovers(feed);

  /* How many open questions each chat has, for the mark and the moons. */
  const asks = new Map<string, Decision[]>();
  if (feed) for (const c of coords) for (const x of c.chats) { const q = questionsOf(feed, x.id); if (q.length) asks.set(x.id, q); }

  /** An orb's surface: its colour, the texture turning with it, the key light, the rim and the shade. */
  const surface = (id: string, r: number, colour: string, slow = false) => {
    const off = strip ? (((hashOf(id) * 7 + t * 22 * look.spin * (slow ? 0.3 : 1)) % (2 * r)) + 2 * r) % (2 * r) : 0;
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

  /** A chat's orb, its moons, and its press. `kind` "sun" is a chat that retired with a question left (piece P). */
  const orb = (x: LaneChat, home: Seen, share: number, kind: "orb" | "sun" = "orb") => {
    const p = bodyOf(x.id, home);
    const eon = pointer === x.id || focus.includes(x.id);
    const qs = asks.get(x.id) ?? [];
    const asked = qs.length;
    const pulsedAt = pulses.current.get(x.id);
    const pu = pulsedAt === undefined ? -1 : (t - pulsedAt) / PULSE_S;
    if (pu >= 1) pulses.current.delete(x.id); else if (pu >= 0) sim.moving = true;
    /* -1 far, +1 near: the far side is smaller and dimmer, easing through so nothing pops. */
    const depth = Math.max(-1, Math.min(1, p.z / 40));
    const size = kind === "sun" ? 0.55 : 1;
    const scale = (eon ? 1.3 : 0.91 + 0.09 * depth) * size;
    const colour = kind === "sun" ? "rgb(255,214,120)" : rgbText(drift(sim, x.id, orbTarget(x.state, tw, x.name.length), dt));
    const held = sim.bodies.get(x.id);
    hits.push(
      <circle key={x.id} data-lanes-hit={x.id} cx={fmt(p.x)} cy={fmt(p.y)} r={(R0 * scale + 3).toFixed(1)} fill="transparent"
        style={{ cursor: grab.current?.id === x.id ? "grabbing" : "grab", touchAction: "none" }}
        onMouseEnter={() => setHover(x.id)} onMouseLeave={() => setHover((h) => (h === x.id ? null : h))} onPointerDown={(e) => startGrab(e, x.id)} />,
    );
    /* The open questions, each a bright moon round the orb that asked (piece O). */
    qs.forEach((d, k) => {
      const m = moonAt(k, qs.length, sim.still ? k : tw * 1.6, R0 * scale);
      if (!sim.still && look.orbit > 0) sim.moving = true;
      const mx = p.x + m.x, my = p.y + m.y, mz = p.z + (m.front ? 6 : -6);
      scene.push({
        key: `moon:${x.id}:${d.id}`, z: mz,
        el: (
          <g key={`moon:${x.id}:${d.id}`} data-lanes-moon={d.id} data-of={x.id} transform={`translate(${fmt(mx)} ${fmt(my)})`} style={{ pointerEvents: "none" }}>
            <circle r={11} fill="url(#lanes-moon-glow)" />
            <circle r={4.5} fill="#fff8d8" stroke="#ffffff" strokeWidth={1} />
          </g>
        ),
      });
      moonHits.push(<circle key={`moon:${x.id}:${d.id}`} data-lanes-moon-hit={d.id} cx={fmt(mx)} cy={fmt(my)} r={9} fill="transparent" style={{ cursor: "pointer" }} aria-label={`Question: ${d.question}`}
        onMouseEnter={() => setHover(x.id)} onMouseLeave={() => setHover((h) => (h === x.id ? null : h))} onClick={() => openQuestion(d.id)} />);
    });
    scene.push({
      key: x.id,
      z: p.z,
      el: (
        <g
          key={x.id}
          data-lanes-orb={x.id}
          data-state={x.state}
          data-kind={kind}
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
          aria-label={`${x.name}, ${kind === "sun" ? "retired, a question still open" : STATE_WORD[x.state]}${asked ? `, ${asked} ${asked === 1 ? "question waits" : "questions wait"} on you: press to open it` : ""}`}
          transform={`translate(${fmt(p.x)} ${fmt(p.y)}) scale(${scale.toFixed(3)})`}
          opacity={(0.8 + 0.2 * depth).toFixed(2)}
          style={{ outline: "none", pointerEvents: "none" }}
          onFocus={() => setHover(x.id)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); press(x.id); } }}
        >
          {kind === "sun" ? <circle r={R0 * 2.2} fill="url(#lanes-sun-corona)" opacity={0.8} /> : <circle r={(eon ? 50 : 38) * look.orb} fill={`url(#lanes-halo-${x.state})`} opacity={Math.min(1, look.glow)} />}
          {kind === "sun" ? <circle r={R0} fill="url(#lanes-sun-core)" /> : surface(x.id, R0, colour, x.state === "park")}
          <circle r={R0} fill="none" stroke="#ffffff" strokeOpacity={eon ? 0.9 : 0.3} strokeWidth={eon ? 2 : 1} />
          {kind === "sun" ? null : <text y={6} textAnchor="middle" fill="#061018" style={{ font: "800 15px ui-monospace, Menlo, Consolas, monospace", pointerEvents: "none" }}>{markOf(x.name)}</text>}
          {/* Answered just now: one ring going out from it. */}
          {pu >= 0 && pu < 1 ? <circle r={R0 + 46 * pu} fill="none" stroke="#ffffff" strokeOpacity={(1 - pu) * 0.9} strokeWidth={4 * (1 - pu) + 1} style={{ pointerEvents: "none" }} /> : null}
          {/* The count stays for many moons. */}
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

  /** A finished chat of a live ring: a small bead, not an orb (J: "far too many chats"). */
  const bead = (x: LaneChat, p: Seen) => {
    const on = pointer === x.id || focus.includes(x.id);
    hits.push(<circle key={x.id} data-lanes-hit={x.id} cx={fmt(p.x)} cy={fmt(p.y)} r={BEAD_R + 4} fill="transparent" style={{ cursor: "pointer" }}
      onMouseEnter={() => setHover(x.id)} onMouseLeave={() => setHover((h) => (h === x.id ? null : h))} onClick={() => press(x.id)} />);
    scene.push({ key: x.id, z: p.z, el: (
      <g key={x.id} data-lanes-bead={x.id} data-state="done" data-z={p.z.toFixed(2)} transform={`translate(${fmt(p.x)} ${fmt(p.y)})`} style={{ pointerEvents: "none" }} opacity={(0.6 + 0.3 * Math.max(-1, Math.min(1, p.z / 60))).toFixed(2)}>
        <circle r={on ? BEAD_R * 1.6 : BEAD_R} fill={STATE_COLOUR.done} fillOpacity={0.75} />
        <circle r={on ? BEAD_R * 1.6 : BEAD_R} fill="url(#lanes-sphere)" opacity={0.7} />
      </g>
    ) });
  };

  shownRings.forEach(({ c, purple }, i) => {
    const state = ringState(c), key = c.id, done = doneShare(c);
    let ring = sim.rings.get(key);
    if (!ring) { ring = { tilt: sim.still ? 0 : startTilt(i), r: radiusOf(done, i) }; sim.rings.set(key, ring); }
    const wantR = radiusOf(purple ? 0.4 : done, i);
    ring.r += (wantR - ring.r) * (sim.still ? 1 : 1 - Math.exp(-dt / 0.6));
    if (Math.abs(wantR - ring.r) > 0.05) sim.moving = true; else ring.r = wantR;
    /* It tumbles slowly end over end while its coordinator works; once all is done it settles flat on the nearest whole turn. */
    const speed = sim.still || purple ? 0 : tumbleSpeed(done, i) * look.orbit;
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
    const base0: Rgb = purple ? [176, 124, 255] : (drift(sim, key, ringTarget(state, look.orbit > 0 ? tw : 0, i), dt));
    const colour = rgbText(base0);
    const on = pointer === key;
    const segs = ringSegments(R, tilt, axis, wob.float);
    const line = ringLine(R, tilt, axis, wob.float);
    const w = look.ring;
    glows.push(
      <g key={key} style={{ pointerEvents: "none" }} opacity={Math.min(1, look.glow)}>
        <path d={line} fill="none" stroke={colour} strokeOpacity={0.08} strokeWidth={(on ? 36 : 28) * w} />
        <path d={line} fill="none" stroke={colour} strokeOpacity={0.14} strokeWidth={(on ? 22 : 17) * w} />
        {look.texture === "planet" ? <path d={line} fill="none" stroke={colour} strokeOpacity={0.3} strokeWidth={(on ? 26 : 19) * w} strokeDasharray="1 3" /> : null}
      </g>,
    );
    rest.push(
      <g key={key} data-lanes-ring={key} data-purple={purple ? "1" : undefined} data-state={state} data-target={purple ? PURPLE : STATE_COLOUR[state]} data-colour={colour} data-r={R.toFixed(1)}
        data-tilt={(((ring.tilt % 360) + 540) % 360 - 180).toFixed(1)} data-speed={speed.toFixed(2)} data-spin={spin.toFixed(0)} data-style={look.texture} />,
    );
    /* Smooth, lit pieces (piece K): butt ends that meet exactly, each shaded by its depth, so no facet or join shows; the texture set gives the ring its look. */
    const sw = (on ? 12 : 8) * w;
    segs.forEach((s, k) => scene.push({
      key: `${key}:${k}`,
      z: s.z,
      el: (
        <g key={`${key}:${k}`} data-ring-seg={key} data-z={s.z.toFixed(2)} onMouseEnter={() => setHover(key)} onClick={() => tumble(key)} style={{ cursor: "pointer" }}>
          {/* Every stroke opaque (the light mixed into the colour, not laid over it), so overlapping pieces never double up into dots. */}
          <path d={s.d} fill="none" stroke={shade(base0, s.z, R)} strokeWidth={sw} strokeLinecap="butt" />
          {look.texture === "planet"
            ? <path d={s.d} fill="none" stroke={rgbText(mixRgb(base0, [10, 10, 30], 0.45))} strokeWidth={sw * 0.3} strokeLinecap="butt" />
            : look.texture === "marble"
              ? <path d={s.d} fill="none" stroke={rgbText(mixRgb(base0, [255, 255, 255], 0.55))} strokeWidth={sw * 0.22} strokeDasharray={`${2 + (k % 3)} ${6 + (k % 4)}`} strokeLinecap="butt" />
              : <path d={s.d} fill="none" stroke={rgbText(mixRgb(base0, [255, 255, 255], 0.15 + 0.5 * Math.max(0, s.z / Math.max(1, R))))} strokeWidth={sw * 0.25} strokeLinecap="butt" />}
          <path d={s.d} fill="none" stroke="transparent" strokeWidth={22} style={{ pointerEvents: "stroke" }} />
        </g>
      ),
    }));

    /* The chats still on the ring gather at the front in Tune's order; a revived ring holds all its chats evenly round. */
    const front = purple ? c.chats : orderChats(c.chats.filter((x) => !isArchived(x) && (sim.laps.get(x.id)?.share ?? 1) >= 1), look.order);
    const beads = c.chats.filter((x) => isArchived(x) && !left.has(x.id));
    for (const x of c.chats) {
      const L = stepLap(sim, x, dt);
      if (purple) { const k = front.indexOf(x); orb(x, ringPoint(R, lapAngle(1) + (k / Math.max(1, front.length)) * 2 * Math.PI, tilt, axis, wob.float), 1); continue; }
      if (isArchived(x) && left.has(x.id)) {
        /* Retired with a question still open (piece P): a small sun, out from its ring and drifting further as it ages, or (nova) by its ring. */
        const a = lapAngle(0.5) + ((hashOf(x.id) % 100) / 100 - 0.5) * 1.6;
        const out = look.leftover === "drift" ? 1.2 + 0.9 * driftOut((now - (Date.parse(x.lastSeen) || now)) / 3600_000) : 1.06;
        const p = ringPoint(R * out, a, tilt, axis, wob.float);
        const cl = { x: Math.max(VIEW.x + 30, Math.min(VIEW.x + VIEW.w - 30, p.x)), y: Math.max(VIEW.y + 30, Math.min(VIEW.y + VIEW.h - 30, p.y)), z: p.z };
        sim.left.set(x.id, cl);
        orb(x, cl, 1, "sun");
        continue;
      }
      if (isArchived(x)) {
        const k = beads.indexOf(x);
        bead(x, ringPoint(R, lapAngle(0.5) + (k - (beads.length - 1) / 2) * (BEAD_R * 3.2) / R, tilt, axis, wob.float));
        continue;
      }
      const slot = front.indexOf(x);
      const a = L.share >= 1 ? lapAngle(1) + (slot < 0 ? 0 : fanAngle(slot, front.length, R)) : lapAngle(lapPos(L.share));
      orb(x, ringPoint(R, a, tilt, axis, wob.float), L.share);
    }
  });

  /* A leftover sun whose question was just answered or carried: a burst (nova) or a fade (drift), under a second. */
  for (const [id, p] of sim.left) if (!left.has(id)) { sim.novas.set(id, { p, at: t, mode: look.leftover }); sim.left.delete(id); }
  for (const [id, n] of sim.novas) {
    const u = (t - n.at) / NOVA_S;
    if (u >= 1) { sim.novas.delete(id); continue; }
    sim.moving = true;
    const b = novaAt(sim.still ? 0.5 : u);
    scene.push({ key: `nova:${id}`, z: n.p.z + 1, el: (
      <g key={`nova:${id}`} data-lanes-nova={id} data-mode={n.mode} transform={`translate(${fmt(n.p.x)} ${fmt(n.p.y)})`} style={{ pointerEvents: "none" }}>
        {n.mode === "nova"
          ? <><circle r={R0 * 0.55 * b.r} fill="url(#lanes-sun-corona)" opacity={b.alpha} /><circle r={R0 * 0.55 * b.r} fill="none" stroke="#fff6d0" strokeWidth={3 * b.alpha + 0.5} opacity={b.alpha} /></>
          : <circle r={R0 * 0.55} fill="url(#lanes-sun-core)" opacity={b.alpha} />}
      </g>
    ) });
  }

  /* The sun (piece L): a bright star the rings revolve round. */
  const sunAt = project(0, 0, 0, 0, 0);
  const breath = sim.still ? 0 : Math.sin(tw * 1.4);
  if (!sim.still && look.orbit > 0) sim.moving = true;
  scene.push({ key: "sun", z: sunAt.z, el: (
    <g key="sun" data-lanes-sun="" transform={`translate(${fmt(sunAt.x)} ${fmt(sunAt.y)})`} style={{ pointerEvents: "none" }}>
      <circle r={SUN_R * (3.4 + 0.15 * breath)} fill="url(#lanes-sun-corona)" opacity={Math.min(1, 0.55 * look.glow + 0.25)} />
      <circle r={SUN_R * (1.6 + 0.05 * breath)} fill="url(#lanes-sun-corona)" opacity={0.9} />
      <circle r={SUN_R} fill="url(#lanes-sun-core)" />
    </g>
  ) });

  /* The archive nucleus (piece M): a purple orb per retired coordinator, numbered, brightest the newest. */
  if (archiveOn && retired.length) {
    rest.push(<g key="archive" data-lanes-archive={retired.length} />);
    retired.forEach((r, k) => {
      const p = nucleusAt(k, retired.length, sim.still ? 0 : tw);
      if (!sim.still && look.orbit > 0) sim.moving = true;
      const id = `retired:${r.c.id}`, back = revived.has(r.c.id), on = pointer === r.c.id;
      const col = rgbText(purpleOf(r.light));
      hits.unshift(<circle key={id} data-lanes-hit={id} cx={fmt(p.x)} cy={fmt(p.y)} r={NUCLEUS_R + 3} fill="transparent" style={{ cursor: "pointer" }}
        onMouseEnter={() => setHover(r.c.id)} onMouseLeave={() => setHover((h) => (h === r.c.id ? null : h))} onClick={() => revive(r.c.id)} />);
      scene.push({ key: id, z: p.z, el: (
        <g key={id} data-lanes-retired={r.c.id} data-n={r.n} data-light={r.light.toFixed(2)} data-back={back ? "1" : "0"} role="button" tabIndex={0}
          aria-label={`${r.c.name}, retired, ${r.c.chats.length} chats inside: press to ${back ? "put its ring away" : "bring it back as a ring"}`}
          transform={`translate(${fmt(p.x)} ${fmt(p.y)}) scale(${on ? 1.25 : 1})`} style={{ outline: "none", pointerEvents: "none" }}
          onFocus={() => setHover(r.c.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); revive(r.c.id); } }}>
          <circle r={NUCLEUS_R * 1.8} fill="url(#lanes-purple-halo)" opacity={0.3 + 0.6 * r.light} />
          {surface(id, NUCLEUS_R, col, true)}
          <circle r={NUCLEUS_R} fill="none" stroke={back ? "#ffffff" : PURPLE} strokeOpacity={0.4 + 0.6 * r.light} strokeWidth={back ? 2.5 : 1.2} />
          <text y={5} textAnchor="middle" fill="#ffffff" style={{ font: "800 13px ui-monospace, Menlo, Consolas, monospace", pointerEvents: "none" }}>{r.n}</text>
        </g>
      ) });
    });
  }

  scene.sort((a, b) => a.z - b.z);
  meter.moving = sim.moving;

  /* An answer sent: the orbs of the chats it is about pulse once. */
  function answered(d: Decision) {
    if (!feed) return;
    for (const x of chatsAbout(feed, d.about)) pulses.current.set(x.id, sim.t);
    /* Piece Q: read the feed again at once, so the orb and the count follow the answer in a second or two. */
    setTimeout(() => void readLanes(), 400);
  }
  function tumble(key: string) {
    setPicked(key);
    if (sim.still) return;
    if (!spinStart.current.has(key)) spinStart.current.set(key, sim.t);
  }
  /** A press on a chat: it is pinned in the panel, and if a question waits on J about it, that question opens (piece B). */
  function press(id: string) {
    setPicked(id);
    const q = asks.get(id)?.[0];
    if (q) openQuestion(q.id);
  }
  /** A retired coordinator brought back as a purple ring, or put away again (piece M). */
  function revive(id: string) {
    setPicked(id);
    setRevived((x) => { const n = new Set(x); if (n.has(id)) n.delete(id); else n.add(id); keep(REVIVED_KEY, JSON.stringify([...n])); return n; });
  }
  function flipArchive() { setArchiveOn((on) => { keep(ARCHIVE_KEY, on ? "off" : "on"); return !on; }); }

  /** Board units under a pointer. */
  const toBoard = (cx: number, cy: number) => {
    const m = svg.current?.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const p = new DOMPoint(cx, cy).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };
  /** A drag on the empty board turns it (J); Tune keeps the turn when the hand lets go. */
  function startTurn(e: React.PointerEvent) {
    if (e.button !== 0 || sim.still) return;
    turn.current = { x: e.clientX, y: e.clientY, yaw: look.axis, pitch: look.tilt };
    const t0 = { ...turn.current };
    const move = (ev: PointerEvent) => {
      if (!turn.current) return;
      turn.current.yaw = ((t0.yaw + (ev.clientX - t0.x) * 0.5 + 540) % 360) - 180;
      turn.current.pitch = Math.max(0, Math.min(70, t0.pitch + (ev.clientY - t0.y) * 0.25));
    };
    const up = () => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
      const tt = turn.current; turn.current = null;
      if (tt) setTune(BOARD_TUNE, { axis: Math.round(tt.yaw), tilt: Math.round(tt.pitch) });
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  }
  function startGrab(e: React.PointerEvent, id: string) {
    if (e.button !== 0) return;
    e.stopPropagation();
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

  /* The panel: what the pointer is on, else what was pressed (piece N). */
  const chatOf = (id: string | null) => { for (const c of coords) for (const x of c.chats) if (x.id === id) return x; return null; };
  const target = chatOf(pointer);
  const targetCoord = target ? null : coords.find((c) => c.id === pointer) ?? null;
  const clips = [...new Set([Math.round(R0), NUCLEUS_R])];
  const finished = archiveOf(feed);

  return (
    <div data-lanes-board="" className="absolute inset-0 z-10 flex flex-col overflow-y-auto overflow-x-hidden" style={{ background: "#020104", color: "#fff" }}>
      {feed ? <Decisions questions={feed.questions} chatsOf={(about) => chatsAbout(feed, about)} base={base} readAt={readAt} now={now} onFocus={setFocus} onAnswered={answered} lit={lit} /> : null}
      <div
        data-lanes-atom=""
        /* It stays in view at the foot of the column while the questions scroll above it, so a press's pulse is seen. */
        className="sticky bottom-0 z-10 flex shrink-0 flex-col"
        style={{ background: "#020104" }}
      >
        <ChatPanel chat={target} coord={targetCoord} retired={targetCoord ? retired.find((r) => r.c.id === targetCoord.id) ?? null : null} revived={targetCoord ? revived.has(targetCoord.id) : false}
          onRevive={revive} questions={target && feed ? questionsOf(feed, target.id) : []} priv={priv} now={now} said={said} onSaid={setSaid} summary={summaryOf(coords, feed)} />
        {/* The rings by keyboard: one button each, named, the same hover and click. */}
        <div className="sr-only">
          {shownRings.map(({ c }) => <button key={c.id} type="button" onFocus={() => setHover(c.id)} onClick={() => tumble(c.id)}>{c.name}</button>)}
        </div>
        <div className="relative">
          <div className="absolute right-2 top-2 z-20 flex gap-1.5">
            {retired.length ? (
              <button type="button" data-lanes-archive-toggle={archiveOn ? "on" : "off"} aria-pressed={archiveOn} onClick={flipArchive} title={archiveOn ? "Hide the retired coordinators" : "Show the retired coordinators by the sun"}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ color: "#12051f", background: archiveOn ? PURPLE : "rgba(255,255,255,.55)" }}>
                <Archive className="size-3.5" /> {archiveOn ? `Archive · ${retired.length}` : "Archive off"}
              </button>
            ) : null}
            <button type="button" data-lanes-tune-open="" aria-expanded={tuning} onClick={() => setTuning((x) => !x)} title="Tune the board: orientation, order, size, texture, light, speeds, motion"
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ color: "#021018", background: tuning ? "#fff" : "oklch(0.85 0.17 205)" }}>
              <Sliders className="size-3.5" /> Tune
            </button>
          </div>
          <svg ref={svg} viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`} role="group" aria-label="The sun, a ring per coordinator with its chats, and the retired coordinators by the sun" style={{ display: "block", width: "100%", height: "auto", touchAction: "none" }}
            data-camera={`${camera.pitch.toFixed(0)},${camera.yaw.toFixed(0)}`} onMouseLeave={() => setHover(null)}>
            <defs>
              <radialGradient id="lanes-sphere" cx="0.33" cy="0.28" r="0.8">
                <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" /><stop offset="0.16" stopColor="#ffffff" stopOpacity="0.6" /><stop offset="0.42" stopColor="#ffffff" stopOpacity="0.08" /><stop offset="1" stopColor="#ffffff" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="lanes-shade" cx="0.38" cy="0.32" r="0.78">
                <stop offset="0.45" stopColor="#000000" stopOpacity="0" /><stop offset="0.82" stopColor="#000000" stopOpacity="0.32" /><stop offset="1" stopColor="#000000" stopOpacity="0.7" />
              </radialGradient>
              <radialGradient id="lanes-rim" cx="0.5" cy="0.5" r="0.5" fx="0.3" fy="0.25">
                <stop offset="0.8" stopColor="#bfefff" stopOpacity="0" /><stop offset="0.94" stopColor="#bfefff" stopOpacity="0.55" /><stop offset="1" stopColor="#ffffff" stopOpacity="0.9" />
              </radialGradient>
              <radialGradient id="lanes-refract"><stop offset="0" stopColor="#ffffff" stopOpacity="0.4" /><stop offset="1" stopColor="#ffffff" stopOpacity="0" /></radialGradient>
              <radialGradient id="lanes-sun-core"><stop offset="0" stopColor="#ffffff" /><stop offset="0.45" stopColor="#fff3c4" /><stop offset="0.8" stopColor="#ffd36b" /><stop offset="1" stopColor="#ffb13b" /></radialGradient>
              <radialGradient id="lanes-sun-corona"><stop offset="0" stopColor="#fff1b8" stopOpacity="0.9" /><stop offset="0.3" stopColor="#ffc861" stopOpacity="0.45" /><stop offset="1" stopColor="#ff9a3c" stopOpacity="0" /></radialGradient>
              <radialGradient id="lanes-moon-glow"><stop offset="0.3" stopColor="#fffbe0" stopOpacity="0.9" /><stop offset="1" stopColor="#ffe8a0" stopOpacity="0" /></radialGradient>
              <radialGradient id="lanes-purple-halo"><stop offset="0.5" stopColor={PURPLE} stopOpacity="0.7" /><stop offset="1" stopColor={PURPLE} stopOpacity="0" /></radialGradient>
              {clips.map((r) => <clipPath key={r} id={`lanes-clip-${r}`}><circle r={r} /></clipPath>)}
              {HALO.map((s) => (
                <radialGradient key={s} id={`lanes-halo-${s}`}>
                  <stop offset="0.55" stopColor={STATE_COLOUR[s]} stopOpacity="0.6" /><stop offset="1" stopColor={STATE_COLOUR[s]} stopOpacity="0" />
                </radialGradient>
              ))}
            </defs>
            {/* The empty board: a drag here turns it. */}
            <rect data-lanes-turn="" x={VIEW.x} y={VIEW.y} width={VIEW.w} height={VIEW.h} fill="transparent" style={{ cursor: turn.current ? "grabbing" : "move" }} onPointerDown={startTurn} onMouseEnter={() => setHover(null)} />
            {glows}
            {scene.map((it) => <React.Fragment key={it.key}>{it.el}</React.Fragment>)}
            {hits}
            {moonHits}
            {rest}
          </svg>
          {!feed ? (
            <p data-lanes-empty="" className="absolute inset-x-0 top-[62%] mx-auto max-w-sm text-center text-small" style={{ color: "#d8d0ee" }}>
              {reached ? "No chats yet: the helper has no lanes.json on this PC." : "The chats are listed on your PC, and the helper isn't answering. Start it from the Helper tab."}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-col gap-3 px-3 pb-4 pt-3">
        {tuning ? <TuneDrawer schema={BOARD_TUNE} onClose={() => setTuning(false)} /> : null}
        {finished.length ? <FindFinished all={finished} now={now} onPick={(id) => { setPicked(id); setFocus([id]); }} /> : null}
        <ChatNotes coords={coords} retired={new Set(retired.map((r) => r.c.id))} now={now} questionsOf={(id) => (feed ? questionsOf(feed, id) : [])} onFocus={setFocus} onPick={setPicked} />
      </div>
    </div>
  );
}

/** The panel's line when nothing is under the pointer or pinned. */
function summaryOf(coords: LaneCoordinator[], feed: LanesFeed | null): string {
  const all = coords.filter((c) => !c.retired).flatMap((c) => c.chats);
  const work = all.filter((x) => x.state === "work").length, need = all.filter((x) => x.state === "need").length;
  const q = feed?.decisions ?? 0;
  return `${work} working · ${need} ${need === 1 ? "needs" : "need"} you · ${q} ${q === 1 ? "question" : "questions"} above`;
}

/**
 * The chat panel (piece N), above the board: the chat under the pointer, else the one pressed, else a summary.
 * It folds to one line, or is dragged taller. A chat shows its state and live age, its note and latest line
 * (piece G: read from J's PC, never published; while Private, paths, pids and ids inside them say "hidden"),
 * its whole timeline under Details, a count of its questions with a jump to them (piece I), and Steer, Pause,
 * Stop, Open chat and a field to say something.
 */
function ChatPanel({ chat, coord, retired, revived, onRevive, questions, priv, now, said, onSaid, summary }: {
  chat: LaneChat | null; coord: LaneCoordinator | null; retired: { n: number } | null; revived: boolean; onRevive: (id: string) => void;
  questions: Decision[]; priv: boolean; now: number; said: string; onSaid: (s: string) => void; summary: string;
}) {
  const [folded, setFolded] = React.useState(() => kept(PANEL_KEY, (s) => s === "folded"));
  const fold = () => setFolded((f) => { keep(PANEL_KEY, f ? "open" : "folded"); return !f; });
  const colour = chat ? STATE_COLOUR[chat.state] : coord ? (retired ? PURPLE : STATE_COLOUR[ringState(coord)]) : "#9fb8c8";
  const name = chat?.name ?? coord?.name ?? "Chats";
  const state = chat
    ? `${STATE_WORD[chat.state]}${chat.lastSeen || chat.sentAt ? ` · ${ageOf(chat.lastSeen || chat.sentAt, now)}` : ""}`
    : coord ? (retired ? `retired coordinator #${retired.n} · ${coord.chats.length} chats inside` : `coordinator · ${doneOf(coord)} of ${coord.chats.length} chats done`) : summary;
  return (
    <section
      data-lanes-menu={name}
      data-lanes-box={chat?.id}
      data-folded={folded ? "1" : "0"}
      className="mx-3 mb-2 mt-2 overflow-auto"
      style={{ boxSizing: "border-box", borderRadius: 18, padding: folded ? "6px 12px" : 14, border: `2px solid ${colour}`, fontFamily: mono, resize: folded ? "none" : "vertical", minHeight: folded ? 0 : 90, maxHeight: folded ? 40 : 420, height: folded ? "auto" : 170,
        backgroundColor: "oklch(0.13 0.05 300)", backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 3px)" }}
    >
      <div className="flex items-baseline gap-2">
        <h2 data-lanes-menu-name="" className="m-0 truncate text-[16px] font-bold text-white">{name}</h2>
        <span data-lanes-box-seen="" className="truncate text-[12px] font-bold" style={{ color: colour }}>{state}</span>
        <button type="button" data-lanes-panel-fold="" aria-expanded={!folded} aria-label={folded ? "Open the chat panel" : "Fold the chat panel to one line"} onClick={fold} className="ml-auto shrink-0 rounded-full p-0.5" style={{ color: "#d8d0ee" }}>
          {folded ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
        </button>
      </div>
      {folded ? null : chat ? <ChatBody chat={chat} questions={questions} priv={priv} now={now} said={said} onSaid={onSaid} /> : coord ? (
        <div className="mt-2 flex flex-col gap-2 text-[12px]" style={{ color: "#d8d0ee" }}>
          {coord.note ? <p className="m-0 leading-snug">{scrub(priv, coord.note)}</p> : null}
          {retired ? <button type="button" data-lanes-revive={coord.id} onClick={() => onRevive(coord.id)} className="self-start rounded-full px-3 py-1 font-bold" style={{ color: "#12051f", background: PURPLE }}>{revived ? "Put its ring away" : "Bring it back as a ring"}</button> : null}
          <Pills target={coord.id} helper={false} />
        </div>
      ) : null}
    </section>
  );
}

function ChatBody({ chat, questions, priv, now, said, onSaid }: { chat: LaneChat; questions: Decision[]; priv: boolean; now: number; said: string; onSaid: (s: string) => void }) {
  const [text, setText] = React.useState("");
  const link = chatLink(chat.id);
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
  const steps = [...chat.history].reverse();
  return (
    <div className="mt-1.5 flex flex-col gap-1.5 text-[12px] leading-snug" style={{ color: "#e6def8" }}>
      {chat.note ? <p data-lanes-note-text="" className="m-0">{scrub(priv, chat.note)}</p> : null}
      {chat.last && chat.last !== chat.note ? <p data-lanes-last="" className="m-0" style={{ color: "#c9bfe6" }}>Latest: {scrub(priv, chat.last)}</p> : null}
      {questions.length ? (
        <button type="button" data-lanes-jump={questions[0]!.id} onClick={() => openQuestion(questions[0]!.id)} className="self-start rounded-full px-2.5 py-0.5 font-bold" style={{ color: "#fff", background: STATE_COLOUR.need }}>
          {questions.length} {questions.length === 1 ? "question waits" : "questions wait"} · open ↑
        </button>
      ) : null}
      {steps.length ? (
        <details data-lanes-history="">
          <summary className="cursor-pointer" style={{ color: "#9fd8ff" }}>Details · {steps.length} {steps.length === 1 ? "step" : "steps"}</summary>
          <ol className="m-0 mt-1 flex list-none flex-col gap-1 p-0">
            {steps.map((h, i) => <li key={i}><span style={{ color: "#9fb8c8" }}>{whenOf(h.at)}</span> {scrub(priv, h.text)}</li>)}
          </ol>
        </details>
      ) : null}
      <Pills target={chat.id} helper={chat.helper} />
      {CHAT_BOX_SEND ? (
        <form className="flex gap-1.5" onSubmit={(e) => { e.preventDefault(); void send(); }}>
          <input data-lanes-say="" aria-label={`Say something to ${chat.name}`} placeholder={`Say something to ${chat.name}`} value={text} onChange={(e) => setText(e.target.value)} className="min-w-0 flex-1" style={{ boxSizing: "border-box", padding: "6px 10px", borderRadius: 10, border: "1px solid rgba(255,255,255,.25)", background: "rgba(0,0,0,.35)", color: "#fff", font: "inherit" }} />
          <button data-lanes-send="" type="submit" style={{ font: "inherit", fontWeight: 700, minHeight: 30, padding: "0 12px", color: "#021018", background: "oklch(0.85 0.17 205)", border: 0, borderRadius: 999 }}>Send</button>
        </form>
      ) : null}
      {said ? <div data-lanes-said="" style={{ fontSize: 12, color: "#9fb8c8" }}>{said}</div> : null}
    </div>
  );
}

/** Steer, Pause, Stop and Open chat: the chat's own controls, in the desktop app (or the helper's tab for its own agent). */
function Pills({ target, helper }: { target: string; helper: boolean }) {
  const link = chatLink(target);
  const pill = "inline-flex min-h-[30px] items-center rounded-full border-0 px-3 font-bold no-underline";
  const go = (word: string, cls: string, style: React.CSSProperties) => {
    const tell = { "data-lanes-control": word.toLowerCase() };
    if (helper) return <button key={word} {...tell} className={pill + cls} style={style} onClick={() => setDockTab("helper")}>{word}</button>;
    if (link) return <a key={word} {...tell} href={link} className={pill + cls} style={style}>{word}</a>;
    return <button key={word} {...tell} disabled className={pill + cls} style={{ ...style, opacity: 0.45 }}>{word}</button>;
  };
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-1.5 text-[12px]">
        {go("Steer", "", { color: "#021018", background: "oklch(0.85 0.17 205)" })}
        {go("Pause", "", { color: "#1a1204", background: "oklch(0.87 0.17 85)" })}
        {go("Stop", "", { color: "#fff", background: "oklch(0.55 0.23 27)" })}
        {go("Open chat", " font-normal", { color: "#fff", background: "transparent", border: "1px solid rgba(255,255,255,.6)" })}
      </div>
      <p data-lanes-how="" className="m-0 text-[11px] leading-snug" style={{ color: "#9fb8c8" }}>{HOW_CONTROLS}</p>
    </div>
  );
}

/** Every finished chat, searchable by name or lane, folded to one line (piece C, kept beside the nucleus). */
function FindFinished({ all, now, onPick }: { all: LaneChat[]; now: number; onPick: (id: string) => void }) {
  const [find, setFind] = React.useState("");
  const found = searchArchive(all, find).slice(0, 50);
  return (
    <details data-lanes-archive-list={all.length} className="rounded-2xl p-3 text-[12px]" style={{ fontFamily: mono, background: "rgba(61,255,174,.05)", border: `1px solid ${STATE_COLOUR.done}44` }}>
      <summary className="cursor-pointer font-bold" style={{ color: STATE_COLOUR.done }}>Find a finished chat · {all.length}</summary>
      <input data-lanes-archive-search="" aria-label="Search the finished chats" placeholder={`Search ${all.length} finished chats`} value={find} onChange={(e) => setFind(e.target.value)}
        className="mt-2 w-full rounded-lg px-2.5 py-1.5" style={{ boxSizing: "border-box", border: "1px solid rgba(255,255,255,.25)", background: "rgba(0,0,0,.35)", color: "#fff", font: "inherit" }} />
      <ul className="m-0 mt-1.5 flex max-h-48 list-none flex-col gap-0.5 overflow-y-auto p-0">
        {found.map((x) => (
          <li key={x.id}>
            <button type="button" data-lanes-archive-item={x.id} onClick={() => onPick(x.id)} className="flex w-full items-baseline gap-1.5 rounded-md px-2 py-1 text-left hover:bg-white/5">
              <b className="text-white">{x.name}</b><span className="ml-auto shrink-0" style={{ color: "#9fb8c8" }}>{ageOf(x.lastSeen || x.sentAt, now)}</span>
            </button>
          </li>
        ))}
        {!found.length ? <li data-lanes-archive-none="" style={{ color: "#9fb8c8" }}>No finished chat matches “{find}”.</li> : null}
      </ul>
    </details>
  );
}

/**
 * Under the board: each live coordinator, newest word first, and under it each chat by latest word with a live
 * age (piece H) and a count of its questions (piece I; the text lives in the questions above). Hovering one
 * lights its orb; a press pins it in the panel. Retired coordinators are one line each.
 */
function ChatNotes({ coords, retired, now, questionsOf: qOf, onFocus, onPick }: { coords: LaneCoordinator[]; retired: Set<string>; now: number; questionsOf: (id: string) => Decision[]; onFocus: (ids: string[]) => void; onPick: (id: string) => void }) {
  if (!coords.length) return null;
  const latest = (c: LaneCoordinator) => Math.max(0, ...c.chats.map((x) => Date.parse(x.lastSeen) || x.sentAt || 0));
  const ordered = [...coords].sort((a, b) => Number(retired.has(a.id)) - Number(retired.has(b.id)) || latest(b) - latest(a));
  return (
    <section data-lanes-notes="" aria-label="What each chat is doing" className="flex flex-col gap-3" style={{ fontFamily: mono }}>
      {ordered.map((c) => (
        <div key={c.id} data-lanes-notes-coord={c.id}>
          <h3 className="m-0 text-[13px] font-bold" style={{ color: retired.has(c.id) ? PURPLE : STATE_COLOUR[ringState(c)] }}>{c.name}{retired.has(c.id) ? " · retired" : ""}</h3>
          {retired.has(c.id) ? null : (
            <ul className="m-0 mt-1.5 flex list-none flex-col gap-1 p-0">
              {byLatest(c.chats).map((x) => {
                const when = ageOf(x.lastSeen || x.sentAt, now), q = qOf(x.id).length;
                return (
                  <li key={x.id} data-lanes-note={x.id} className="cursor-pointer rounded-lg px-2 py-1.5 text-[12px] leading-snug hover:bg-white/5"
                    onMouseEnter={() => onFocus([x.id])} onMouseLeave={() => onFocus([])} onClick={() => onPick(x.id)}>
                    <div className="flex items-baseline gap-1.5">
                      <span aria-hidden className="inline-block size-2 shrink-0 rounded-full" style={{ background: STATE_COLOUR[x.state] }} />
                      <b className="text-white">{x.name}</b>
                      <span style={{ color: STATE_COLOUR[x.state] }}>{STATE_WORD[x.state]}</span>
                      {q ? <span data-lanes-note-asks={q} className="rounded-full px-1.5 text-[10px] font-bold text-white" style={{ background: STATE_COLOUR.need }}>{q} ?</span> : null}
                      {when ? <span data-lanes-seen="" className="ml-auto shrink-0" style={{ color: "#9fb8c8" }}>{when}</span> : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ))}
    </section>
  );
}
