"use client";
/**
 * THE LANES BOARD (J, 2026-11-01/02): every chat working for J as an atom, in
 * the Agents dock's first tab. `lanes.ts` says what the feed means and where
 * things sit; this keeps the moving state and draws one frame at a time.
 *
 * Everything on the board is one flat, keyed list in paint order (far rings,
 * far orbs, nucleus, near rings, near orbs), so an orb crossing to the other
 * side is a move in that list, not a new element that drops its hover. Soft
 * light is gradients and stacked strokes, never a blur filter: a filter on
 * something that moves repaints every frame on the CPU. The nucleus's camouflage
 * is a filter, but it never moves.
 */
import * as React from "react";
import { HELPER_ORIGIN } from "./context";
import { setDockTab } from "./store";
import {
  ATOMS, ANSWER_S, POLL_MS, STATE_COLOUR, STATE_WORD, TUMBLE_S, VIEW, chatLink, doneOf, fanAngle, hashOf, hexCells, lapAngle, markOf, project, radiusAt, readFeed, ringArcs, ringState, thinkingPos, tumbleAt, wantTilt, withBeats, yawOf,
  type Atom, type LaneBeat, type LaneChat, type LaneCoordinator, type LanesFeed,
} from "./lanes";

/** J may drop the chat box's field and Send; the rest of the box stays. */
const CHAT_BOX_SEND = true;
const ORB_R = 24;
const EMBERS = [0, 1, 2, 3, 4, 5];
const FEED_WAIT_MS = 2500;
const HOW_CONTROLS = "Steer, Pause and Stop go through the chat: the desktop app takes them there. Only the helper's own agents have them here, in the Helper tab.";

type Feed = { feed: LanesFeed | null; reached: boolean };

async function ask(url: string): Promise<{ feed: unknown; beats?: LaneBeat[]; now?: number } | null> {
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), FEED_WAIT_MS);
  try {
    const r = await fetch(url, { cache: "no-store", signal: stop.signal });
    return r.ok ? await r.json() : null;
  } catch { return null; } finally { clearTimeout(timer); }
}

/** Every 5s while the board shows: the Builder's own route on this PC, else the helper. A failed read keeps the last good feed. */
function useLanesFeed(): Feed {
  const [state, setState] = React.useState<Feed>({ feed: null, reached: false });
  React.useEffect(() => {
    let live = true, viaHelper = false;
    const read = async () => {
      let got = viaHelper ? null : await ask("/api/lanes");
      if (!got?.feed) { const h = await ask(`${HELPER_ORIGIN}/lanes`); if (h) { got = h; viaHelper = true; } }
      if (!live) return;
      const feed = readFeed(got?.feed);
      if (feed) setState({ feed: withBeats(feed, got?.beats ?? [], got?.now ?? Date.now()), reached: true });
      else setState((s) => (s.feed ? s : { feed: null, reached: !!got }));
    };
    void read();
    const timer = setInterval(() => void read(), POLL_MS);
    return () => { live = false; clearInterval(timer); };
  }, []);
  return state;
}

/* The moving state, kept by chat and by ring across polls. */
type Lap = { pos: number; dock: number; state: LaneChat["state"]; sentAt: number | null; sent: number | null; answered: number | null };
type Sim = { t: number; last: number; drawn: number; tilt: Map<string, number>; spin: Map<string, number>; laps: Map<string, Lap>; still: boolean };

function stepLap(sim: Sim, x: LaneChat, dt: number): Lap {
  let L = sim.laps.get(x.id);
  if (!L) {
    /* First seen: done is already home, others at the front, and a chat already thinking is somewhere round the back. */
    const tau = 3 + (hashOf(x.id) % 40) / 10;
    L = { pos: x.state === "work" ? thinkingPos(tau) : 1, dock: x.state === "done" ? 1 : 0, state: x.state, sentAt: x.sentAt, sent: x.state === "work" ? sim.t - tau : null, answered: null };
    sim.laps.set(x.id, L);
  }
  const startsThinking = x.state === "work" && L.state !== "work";
  const newMessage = x.sentAt !== null && x.sentAt !== L.sentAt;
  if (startsThinking || newMessage) { L.sent = sim.t; L.answered = null; if (L.pos >= 0.99) L.pos = 0; L.dock = x.state === "done" ? L.dock : 0; }
  else if (x.state !== "work" && L.state === "work" && L.sent !== null) L.answered = sim.t;
  L.state = x.state; L.sentAt = x.sentAt;
  let want = 1;
  if (L.sent !== null) {
    if (L.answered === null) want = thinkingPos(sim.t - L.sent);
    else { const u = (sim.t - L.answered) / ANSWER_S; want = u >= 1 ? 1 : Math.max(L.pos, 0.72 + 0.28 * u); if (u >= 1) { L.sent = null; L.answered = null; } }
  }
  /* Quick out of the front, unhurried after. */
  L.pos += (want - L.pos) * (1 - Math.exp(-dt * (L.pos < 0.05 ? 14 : 3)));
  if (want === 1 && L.pos > 0.998) L.pos = 1;
  const home = x.state === "done" && L.pos >= 0.985 ? 1 : 0;
  L.dock += (home - L.dock) * (1 - Math.exp(-dt * 3));
  if (sim.still) { L.pos = x.state === "work" ? thinkingPos(4) : 1; L.dock = x.state === "done" ? 1 : 0; }
  return L;
}

type Item = { key: string; z: number; el: React.ReactNode };
const orbGrad = (colour: string) => `lanes-halo-${colour.slice(1)}`;
const fmt = (n: number) => n.toFixed(1);

export function LanesBoard({ atom = ATOMS.A1 }: { atom?: Atom }) {
  const { feed, reached } = useLanesFeed();
  const simRef = React.useRef<Sim>({ t: 0, last: 0, drawn: 0, tilt: new Map(), spin: new Map(), laps: new Map(), still: false });
  const spinStart = React.useRef(new Map<string, number>());
  const [, draw] = React.useReducer((n: number) => n + 1, 0);
  const [hover, setHover] = React.useState<string | null>(null);
  const [picked, setPicked] = React.useState<string | null>(null);
  const [said, setSaid] = React.useState("");
  const boxAt = React.useRef<{ id: string; x: number; y: number } | null>(null);
  const box = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const sim = simRef.current;
    sim.still = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (sim.still) { draw(); return; }
    let raf = 0, shown = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      /* Every frame only for a tumble. Laps creep, and with nothing on its way a slow redraw is plenty. */
      const moving = [...sim.laps.values()].some((l) => l.sent !== null || (l.pos < 1 && l.pos > 0) || (l.dock > 0.002 && l.dock < 0.998));
      const every = spinStart.current.size > 0 ? 0 : moving ? 33 : 66;
      if (now - shown < every) return;
      shown = now;
      const dt = sim.last ? Math.min(0.1, (now - sim.last) / 1000) : 0;
      sim.last = now; sim.t += dt;
      draw();
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const sim = simRef.current;
  const dt = sim.t - sim.drawn;
  sim.drawn = sim.t;

  const coords = feed?.coordinators ?? [];
  const pointer = hover ?? picked;
  const farRings: Item[] = [], nearRings: Item[] = [], farOrbs: Item[] = [], nearOrbs: Item[] = [];
  let hoverChat: { chat: LaneChat; x: number; y: number } | null = null;

  coords.forEach((c, i) => {
    const state = ringState(c), colour = STATE_COLOUR[state], key = c.id;
    const want = wantTilt(c);
    let tl = sim.tilt.get(key);
    if (tl === undefined) tl = sim.still ? want : 85;
    tl += (want - tl) * (sim.still ? 1 : 1 - Math.exp(-dt / 0.6));
    if (Math.abs(want - tl) < 0.02) tl = want;
    sim.tilt.set(key, tl);

    /* A tumble is time since the click: at its end, a whole number of turns, it is simply over. */
    const from = spinStart.current.get(key);
    let spin = 0;
    if (from !== undefined) {
      const u = (sim.t - from) / TUMBLE_S;
      if (u >= 1) spinStart.current.delete(key); else spin = tumbleAt(u, atom);
    }
    const yaw = yawOf(i, coords.length, atom), R = radiusAt(tl, atom, i);
    const arcs = ringArcs(R, tl, yaw, spin);
    const on = pointer === key;
    const stroke = (d: string, part: string) => (
      <g key={part} data-ring-part={part} style={{ pointerEvents: "none" }} opacity={part === "back" ? 0.62 : 1}>
        <path d={d} fill="none" stroke={colour} strokeOpacity={0.1} strokeWidth={on ? 40 : 30} />
        <path d={d} fill="none" stroke={colour} strokeOpacity={0.2} strokeWidth={on ? 26 : 18} />
        <path d={d} data-ring-line="" fill="none" stroke={colour} strokeOpacity={on ? 1 : 0.9} strokeWidth={on ? 14 : 9} />
      </g>
    );
    const hit = { fill: "none", stroke: "transparent", strokeWidth: 22, onMouseEnter: () => setHover(key), onClick: () => tumble(key) };
    /* What a pointer finds: each half at its own depth, under its side's orbs, nothing in the middle. */
    farRings.push({
      key: `${key}:back`,
      z: 0,
      el: <g>{stroke(arcs.back, "back")}<path d={arcs.back} data-ring-back={key} {...hit} style={{ pointerEvents: "stroke", cursor: "pointer" }} /></g>,
    });
    nearRings.push({
      key: `${key}:front`,
      z: 0,
      el: (
        <g key={`${key}:front`}>
          {stroke(arcs.front, "front")}
          <path
            d={arcs.front}
            {...hit}
            data-lanes-ring={key}
            data-state={state}
            data-colour={colour}
            data-tilt={tl.toFixed(1)}
            data-spin={spin.toFixed(0)}
            role="button"
            tabIndex={0}
            aria-label={c.name}
            style={{ pointerEvents: "stroke", cursor: "pointer", outline: "none" }}
            onFocus={() => setHover(key)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tumble(key); } }}
          />
        </g>
      ),
    });

    /* The chats still on the ring gather at the front, fanned out; the done ones go home to the grid. */
    const onRing = c.chats.filter((x) => x.state !== "done");
    const fanned = onRing.filter((x) => { const l = sim.laps.get(x.id); return !l || l.pos >= 0.9 || l.pos <= 0.1; });
    const cells = hexCells(c.chats.length - onRing.length, yaw);
    let cell = 0;
    c.chats.forEach((x) => {
      const L = stepLap(sim, x, dt);
      const slot = fanned.indexOf(x);
      const gather = L.pos > 0.9 ? (L.pos - 0.9) / 0.1 : L.pos < 0.1 ? 1 - L.pos / 0.1 : 0;
      const fan = slot < 0 ? 0 : fanAngle(slot, fanned.length, R, i, coords.length) * gather;
      const a = lapAngle(L.pos) + fan;
      const ringU = R * Math.cos(a), ringV = R * Math.sin(a);
      const to = x.state === "done" ? cells[cell++] : null;
      const k = L.dock * L.dock * (3 - 2 * L.dock);
      const u = to ? ringU + (to.u - ringU) * k : ringU, v = to ? ringV + (to.v - ringV) * k : ringV;
      const p = project(u, v, tl, yaw, spin % 360);
      const near = p.z >= 0;
      /* -1 far, +1 near: the far half is smaller and dimmer, easing through the crossing so nothing pops. */
      const depth = Math.max(-1, Math.min(1, p.z / 40));
      const eon = pointer === x.id;
      const scale = eon ? 1.3 : 0.9 + 0.1 * depth;
      const orbColour = STATE_COLOUR[x.state];
      if (hover === x.id) hoverChat = { chat: x, x: p.x, y: p.y };
      const el = (
        <g
          key={x.id}
          data-lanes-orb={x.id}
          data-state={x.state}
          data-colour={orbColour}
          data-side={near ? "near" : "far"}
          data-scale={scale.toFixed(3)}
          data-pos={L.pos.toFixed(3)}
          data-x={p.x.toFixed(1)}
          data-y={p.y.toFixed(1)}
          role="button"
          tabIndex={0}
          aria-label={`${x.name}, ${STATE_WORD[x.state]}`}
          transform={`translate(${fmt(p.x)} ${fmt(p.y)}) scale(${scale.toFixed(3)})`}
          opacity={(0.825 + 0.175 * depth).toFixed(2)}
          style={{ cursor: "pointer", outline: "none" }}
          onMouseEnter={() => setHover(x.id)}
          onFocus={() => setHover(x.id)}
          onClick={() => setPicked(x.id)}
        >
          <circle r={eon ? 50 : 38} fill={`url(#${orbGrad(orbColour)})`} />
          <circle r={ORB_R} fill={orbColour} />
          <circle r={ORB_R} fill="url(#lanes-sphere)" />
          <circle r={ORB_R} fill="none" stroke="#ffffff" strokeOpacity={eon ? 0.9 : 0.45} strokeWidth={2} />
          <text y={6} textAnchor="middle" fill="#061018" style={{ font: "800 15px ui-monospace, Menlo, Consolas, monospace", pointerEvents: "none" }}>{markOf(x.name)}</text>
        </g>
      );
      (near ? nearOrbs : farOrbs).push({ key: x.id, z: p.z, el });
    });
  });

  function tumble(key: string) {
    setPicked(key);
    if (sim.still) return;
    if (!spinStart.current.has(key)) spinStart.current.set(key, sim.t);
  }

  const decisions = feed?.decisions ?? 0;
  const nucleus = (
    <g
      key="nucleus"
      data-lanes-nucleus={decisions}
      role="button"
      tabIndex={0}
      aria-label={`Nucleus: ${decisions} decisions wait on you`}
      style={{ cursor: "pointer", outline: "none" }}
      onMouseEnter={() => setHover("nucleus")}
      onFocus={() => setHover("nucleus")}
      onClick={() => setPicked(null)}
    >
      {atom.disc ? (
        <g data-lanes-disc="">
          <circle r={46} fill="#0b0618" />
          <rect x={-46} y={-46} width={92} height={92} filter="url(#lanes-camo)" clipPath="url(#lanes-disc-clip)" />
          {EMBERS.map((_, k) => {
            const ang = k * 1.05 + sim.t * 0.1, far = 16 + (18 * ((k * 7) % 5)) / 5;
            return <circle key={k} cx={(Math.cos(ang) * far).toFixed(1)} cy={(Math.sin(ang) * far).toFixed(1)} r={(1.6 + Math.sin(sim.t * 3 + k) * 0.8).toFixed(2)} fill={STATE_COLOUR.need} opacity={(0.5 + (0.5 * (Math.sin(sim.t * 2.2 + k * 1.7) + 1)) / 2).toFixed(2)} />;
          })}
          <circle r={46} fill="url(#lanes-sphere)" opacity={0.6} />
          <circle r={46} fill="none" stroke={STATE_COLOUR.done} strokeOpacity={0.7} strokeWidth={2} />
        </g>
      ) : (
        <g>
          <circle r={44} fill="url(#lanes-nucleus)" />
          <circle r={44} fill="url(#lanes-sphere)" />
          <circle r={44} fill="none" stroke="#ffffff" strokeOpacity={0.5} strokeWidth={1.5} />
        </g>
      )}
      <text y={9} textAnchor="middle" fill={atom.disc ? "#ffffff" : "#061018"} style={{ font: "800 26px ui-monospace, Menlo, Consolas, monospace", pointerEvents: "none" }}>{decisions}</text>
    </g>
  );

  /* The menu: what the pointer is on, else what was picked, else the nucleus. */
  const chatOf = (id: string | null) => { for (const c of coords) for (const x of c.chats) if (x.id === id) return x; return null; };
  const coordOf = (id: string | null) => coords.find((c) => c.id === id) ?? null;
  const pick = chatOf(pointer), coord = coordOf(pointer);
  const menu = pick
    ? { name: pick.name, colour: STATE_COLOUR[pick.state], state: STATE_WORD[pick.state], note: pick.note, target: pick.id, helper: pick.helper }
    : coord
      ? { name: coord.name, colour: STATE_COLOUR[ringState(coord)], state: `coordinator · ${doneOf(coord)} of ${coord.chats.length} chats done · ring at ${Math.round(sim.tilt.get(coord.id) ?? 85)}°`, note: coord.note, target: coord.id, helper: false }
      : { name: "Nucleus", colour: decisions ? STATE_COLOUR.need : STATE_COLOUR.done, state: `${decisions} decisions wait on you · ${coords.length} coordinators`, note: "The number is what waits on you right now. Hover a ring to see its coordinator; click it to pick the coordinator and spin the ring with its chats.", target: null as string | null, helper: false };

  /* The box stays where it opened: an orb on its way mustn't drag the field being typed in. */
  const hc = hoverChat as { chat: LaneChat; x: number; y: number } | null;
  if (!hc) boxAt.current = null;
  else if (boxAt.current?.id !== hc.chat.id) boxAt.current = { id: hc.chat.id, x: hc.x, y: hc.y };
  const bx = boxAt.current ? ((boxAt.current.x - VIEW.x) / VIEW.w) * 100 : 0;
  const by = boxAt.current ? ((boxAt.current.y - VIEW.y + 24) / VIEW.h) * 100 : 0;

  return (
    <div data-lanes-board="" className="absolute inset-0 z-10 flex flex-wrap items-center justify-center gap-4 overflow-auto p-4" style={{ background: "#020104", color: "#fff" }}>
      <LanesMenu {...menu} />
      <div
        className="relative min-w-0 flex-[1_1_480px]"
        onMouseLeave={() => { if (!box.current?.contains(document.activeElement)) setHover(null); }}
      >
        <svg viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`} role="group" aria-label="Chats as orbs on their coordinator's ring around one nucleus" style={{ display: "block", width: "100%", height: "auto", maxHeight: "calc(100vh - var(--topbar-h) - 72px)" }}>
          <defs>
            <radialGradient id="lanes-sphere" cx="0.33" cy="0.28" r="0.8">
              <stop offset="0" stopColor="#ffffff" /><stop offset="0.18" stopColor="#ffffff" stopOpacity="0.85" /><stop offset="0.5" stopColor="#ffffff" stopOpacity="0.12" /><stop offset="0.86" stopColor="#000000" stopOpacity="0.25" /><stop offset="1" stopColor="#000000" stopOpacity="0.6" />
            </radialGradient>
            <filter id="lanes-camo" x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves={4} seed={3} />
              <feColorMatrix type="matrix" values="0.25 0 0 0 0.02  0.1 0.15 0 0 0.01  0.5 0.3 0 0 0.08  0 0 0 0 1" />
            </filter>
            <clipPath id="lanes-disc-clip"><circle r={46} /></clipPath>
            <radialGradient id="lanes-nucleus" cx="0.38" cy="0.32" r="0.8">
              <stop offset="0" stopColor="#ffffff" /><stop offset="0.25" stopColor="#d9ff8a" /><stop offset="0.7" stopColor="#2fe67f" /><stop offset="1" stopColor="#065c3b" />
            </radialGradient>
            {Object.values(STATE_COLOUR).map((colour) => (
              <radialGradient key={colour} id={orbGrad(colour)}>
                <stop offset="0.55" stopColor={colour} stopOpacity="0.7" /><stop offset="1" stopColor={colour} stopOpacity="0" />
              </radialGradient>
            ))}
          </defs>
          {[...farRings, ...farOrbs.sort((a, b) => a.z - b.z)].map((it) => <React.Fragment key={it.key}>{it.el}</React.Fragment>)}
          {nucleus}
          {[...nearRings, ...nearOrbs.sort((a, b) => a.z - b.z)].map((it) => <React.Fragment key={it.key}>{it.el}</React.Fragment>)}
        </svg>
        {!feed ? (
          <p data-lanes-empty="" className="absolute inset-x-0 top-[62%] mx-auto max-w-sm text-center text-small" style={{ color: "#d8d0ee" }}>
            {reached ? "No chats yet: the helper has no lanes.json on this PC." : "The chats are listed on your PC, and the helper isn't answering. Start it from the Helper tab."}
          </p>
        ) : null}
        {hc && boxAt.current ? <ChatBox ref={box} key={hc.chat.id} chat={hc.chat} left={bx} top={by} said={said} onSaid={setSaid} /> : null}
      </div>
    </div>
  );
}

/** Rounded card, a lit border in the picked thing's colour, scanlines, pills (H3). */
function LanesMenu({ name, colour, state, note, target, helper }: { name: string; colour: string; state: string; note: string; target: string | null; helper: boolean }) {
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
      className="w-[280px] shrink-0 self-center"
      style={{
        boxSizing: "border-box", borderRadius: 28, padding: 22, border: `3px solid ${colour}`, fontFamily: "ui-monospace, 'JetBrains Mono', Menlo, Consolas, monospace",
        backgroundColor: "oklch(0.13 0.05 300)", backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 3px), radial-gradient(circle at 85% 0%, oklch(0.42 0.2 320 / 0.6), transparent 60%)",
      }}
    >
      <h2 data-lanes-menu-name="" style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#fff" }}>{name}</h2>
      <p style={{ margin: "4px 0 0", color: colour, fontSize: 13, fontWeight: 700 }}>{state}</p>
      <p style={{ margin: "14px 0 16px", fontSize: 13, lineHeight: 1.5, color: "#f2ecff" }}>{note}</p>
      <div className="flex flex-wrap gap-1.5 text-[13px]">
        {go("Steer", "", { color: "#021018", background: "oklch(0.85 0.17 205)" })}
        {go("Pause", "", { color: "#1a1204", background: "oklch(0.87 0.17 85)" })}
        {go("Stop", "", { color: "#fff", background: "oklch(0.55 0.23 27)" })}
        {go("Open chat", " font-normal", { color: "#fff", background: "transparent", border: "1px solid rgba(255,255,255,0.6)" })}
      </div>
      <p data-lanes-how="" style={{ margin: "16px 0 0", fontSize: 12, lineHeight: 1.55, color: "#9fb8c8" }}>{HOW_CONTROLS}</p>
    </section>
  );
}

/**
 * Hovering a chat. Nothing on this page can reach a desktop chat, so Send is
 * honest about what it does: it copies the words and opens the chat to paste
 * them. The orb's lap starts when the chat really gets them (its heartbeat).
 */
const ChatBox = React.forwardRef<HTMLDivElement, { chat: LaneChat; left: number; top: number; said: string; onSaid: (s: string) => void }>(function ChatBox({ chat, left, top, said, onSaid }, ref) {
  const [text, setText] = React.useState("");
  const colour = STATE_COLOUR[chat.state];
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
  return (
    <div
      ref={ref}
      data-lanes-box={chat.id}
      className="absolute w-[250px]"
      style={{ left: `${Math.max(16, Math.min(84, left))}%`, top: `${Math.min(78, top)}%`, transform: "translate(-50%, 12px)", boxSizing: "border-box", borderRadius: 18, padding: "12px 14px", border: `2px solid ${colour}`, background: "oklch(0.16 0.05 300 / 0.96)", color: "#f2ecff", font: "13px/1.45 ui-monospace, 'JetBrains Mono', Menlo, Consolas, monospace", boxShadow: "0 10px 30px rgba(0,0,0,.6)" }}
    >
      <div style={{ fontWeight: 700, color: colour }}>{chat.name} · {STATE_WORD[chat.state]}</div>
      <div style={{ marginTop: 4, color: "#d8d0ee" }}>{chat.note}</div>
      {chat.last ? <div data-lanes-last="" style={{ marginTop: 6, fontSize: 12, color: "#9fb8c8" }}>{chat.last}</div> : null}
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
